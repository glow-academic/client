"""Handler for simulation_start WebSocket event."""

import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import asyncpg  # type: ignore
from agents import (
    FunctionToolResult,
    RunContextWrapper,
    Runner,
    Tool,
    ToolsToFinalOutputResult,
    function_tool,
    gen_trace_id,
    trace,
)
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, Field, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.infra.v3.agents.generic_agent import GenericAgent
from app.infra.v3.debug.debug_info import DebugContext
from app.infra.v3.debug.debug_info import debug_info as debug_info_tool
from app.infra.v3.documents.format_document_info import format_document_info
from app.main import get_internal_sio, get_pool, sio

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class StartSimulationErrorPayload(BaseModel):
    """Response indicating an error occurred while starting simulation."""

    success: bool
    message: str


class SimulationStartedPayload(BaseModel):
    """Response indicating simulation started successfully."""

    success: bool
    message: str
    attempt_id: str


# Pydantic model for client-to-server event
class StartSimulationPayload(BaseModel):
    """Request to start a simulation attempt."""

    simulation_id: str | None = None  # Optional for practice mode
    profile_id: str | None = None
    scenario_id: str | None = None
    infinite: bool = False
    # Practice mode fields (when practice_mode=True, simulation_id can be None)
    practice_mode: bool = False
    practice_persona_id: str | None = None
    practice_parameter_item_ids: list[str] = []
    practice_department_id: str | None = None


# Emit helper functions
async def simulation_start_error(
    payload: StartSimulationErrorPayload, room: str
) -> None:
    await sio.emit("simulations_start_error", payload.model_dump(), room=room)


async def simulation_started(payload: SimulationStartedPayload, room: str) -> None:
    await sio.emit("simulations_started", payload.model_dump(), room=room)


# Chat creation helpers (moved from simulation_text/start.py)
async def _create_chat_with_randomization(
    conn: asyncpg.Connection,
    scenario_id: str,
    attempt_id: str,
    profile_id: str | None,
    mark_completed: bool,
) -> dict[str, Any] | None:
    """
    Create a chat for a scenario with full randomization logic.
    This function handles all randomization, child scenario creation, and chat creation.
    Used by both start.py (for initial chat) and internal event handler (for subsequent chats).
    """
    import random

    def parse_jsonb(data: Any) -> list[dict[str, Any]]:
        """Parse JSONB data with type safety."""
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                return []
        if not isinstance(data, list):
            return []
        return [dict(item) for item in data]

    # Get parent scenario by ID (NEVER modify the original scenario)
    sql = load_sql("app/sql/v3/scenario/get_scenario_by_id.sql")
    parent_scenario = await conn.fetchrow(sql, scenario_id)
    if not parent_scenario:
        return None

    # Convert asyncpg UUID to Python UUID
    parent_scenario_id_uuid = uuid.UUID(str(parent_scenario["id"]))
    profile_id_uuid = uuid.UUID(str(profile_id)) if profile_id else None

    # Get department_ids from scenario_departments junction table (for better department selection)
    sql = load_sql("app/sql/v3/scenario/get_scenario_departments.sql")
    scenario_dept_rows = await conn.fetch(sql, parent_scenario_id_uuid)
    scenario_dept_ids = (
        [uuid.UUID(str(row["department_id"])) for row in scenario_dept_rows]
        if scenario_dept_rows
        else None
    )

    # Randomization parameters
    persona_ids = None
    document_ids = None
    parameter_item_ids = None
    department_ids = scenario_dept_ids  # Use scenario's departments if available
    scenario_id_uuid = parent_scenario_id_uuid
    profile_id_for_randomization = profile_id_uuid
    targets = None  # Randomize all

    # Start of inlined randomize_scenario_attributes logic
    if targets is None:
        targets = []

    # Step 1: Department selection with fallback logic
    if department_ids is None:
        department_ids = []
    use_all_departments = not department_ids or len(department_ids) == 0

    selected_department_id: uuid.UUID | None = None
    if department_ids and len(department_ids) > 0:
        selected_department_id = random.choice(department_ids)
        logger.info(f"Using provided department_id: {selected_department_id}")
    elif profile_id_for_randomization:
        sql = load_sql("app/sql/v3/profile/get_departments_for_profile.sql")
        profile_dept_rows = await conn.fetch(sql, str(profile_id_for_randomization))
        if profile_dept_rows and len(profile_dept_rows) > 0:
            profile_dept_ids = [uuid.UUID(str(row["id"])) for row in profile_dept_rows]
            selected_department_id = random.choice(profile_dept_ids)
            logger.info(f"Using department_id from profile: {selected_department_id}")

    if not selected_department_id:
        logger.info(
            "No department_id available - will select general/cross-department items "
            "(items with no department links)"
        )

    # Step 1.5: Get randomization ranges
    sql = load_sql("app/sql/v3/scenario/get_randomization_ranges.sql")
    ranges_result = await conn.fetchrow(sql, scenario_id_uuid)
    if not ranges_result:
        persona_min = 1
        persona_max = 3
        document_min = 0
        document_max = 3
        parameter_min = 0
        parameter_max = 3
        field_ranges_json: dict[str, dict[str, int]] = {}
    else:
        persona_min = ranges_result.get("persona_min", 1)
        persona_max = ranges_result.get("persona_max", 3)
        document_min = ranges_result.get("document_min", 0)
        document_max = ranges_result.get("document_max", 3)
        parameter_min = ranges_result.get("parameter_min", 0)
        parameter_max = ranges_result.get("parameter_max", 3)
        field_ranges_raw = ranges_result.get("field_ranges_json", {})
        if isinstance(field_ranges_raw, str):
            try:
                field_ranges_json = json.loads(field_ranges_raw)
            except json.JSONDecodeError:
                field_ranges_json = {}
        elif isinstance(field_ranges_raw, dict):
            field_ranges_json = field_ranges_raw
        else:
            field_ranges_json = {}

    logger.info(
        f"Using randomization ranges - personas: {persona_min}-{persona_max}, "
        f"documents: {document_min}-{document_max}, parameters: {parameter_min}-{parameter_max}"
    )

    # Step 2: Load randomization data
    dept_uuids: list[uuid.UUID] = (
        [] if use_all_departments else [selected_department_id]
    )
    sql = load_sql("app/sql/v3/scenario/get_randomization_data_complete.sql")
    result = await conn.fetchrow(sql, dept_uuids, scenario_id_uuid)

    if not result:
        raise ValueError("Failed to fetch randomization data")

    # Parse JSONB aggregations
    personas_data = parse_jsonb(result.get("personas", []))
    documents_data = parse_jsonb(result.get("documents", []))
    parameters_data = parse_jsonb(result.get("parameters", []))
    parameter_items_data = parse_jsonb(result.get("parameter_items", []))
    document_parameter_items_data = parse_jsonb(
        result.get("document_parameter_items", [])
    )

    # Get existing scenario links if scenario_id provided
    existing_persona_ids = result.get("persona_ids", []) or []
    existing_document_ids = result.get("document_ids", []) or []
    existing_parameter_item_ids = result.get("parameter_item_ids", []) or []

    # Build lookup maps
    active_personas = []
    for p in personas_data:
        if "id" not in p:
            logger.warning("Skipping persona entry missing 'id' field")
            continue
        active_personas.append(
            {
                **p,
                "id": uuid.UUID(str(p["id"])),
            }
        )

    active_documents = []
    for d in documents_data:
        if "id" not in d:
            logger.warning("Skipping document entry missing 'id' field")
            continue
        active_documents.append(
            {
                **d,
                "id": uuid.UUID(str(d["id"])),
            }
        )

    active_parameters = []
    for p in parameters_data:
        if "id" not in p:
            logger.warning("Skipping parameter entry missing 'id' field")
            continue
        active_parameters.append(
            {
                **p,
                "id": uuid.UUID(str(p["id"])),
                "document_parameter": p.get("document_parameter", False),
                "persona_parameter": p.get("persona_parameter", False),
            }
        )

    all_parameter_items = []
    for pi in parameter_items_data:
        if "id" not in pi or "parameter_id" not in pi:
            logger.warning(
                "Skipping parameter item entry missing 'id' or 'parameter_id' field"
            )
            continue
        all_parameter_items.append(
            {
                **pi,
                "id": uuid.UUID(str(pi["id"])),
                "parameter_id": uuid.UUID(str(pi["parameter_id"])),
            }
        )

    document_parameter_items_junction = []
    for j in document_parameter_items_data:
        if "document_id" not in j or "parameter_item_id" not in j:
            logger.warning(
                "Skipping document_parameter_item junction entry missing required fields"
            )
            continue
        document_parameter_items_junction.append(
            {
                "document_id": uuid.UUID(str(j["document_id"])),
                "parameter_item_id": uuid.UUID(str(j["parameter_item_id"])),
            }
        )

    parameter_items_by_id: dict[uuid.UUID, dict[str, Any]] = {}
    for pi in all_parameter_items:
        parameter_items_by_id[pi["id"]] = pi

    parameter_items_by_param_id: dict[uuid.UUID, list[dict[str, Any]]] = {}
    for pi in all_parameter_items:
        param_id = pi["parameter_id"]
        if param_id not in parameter_items_by_param_id:
            parameter_items_by_param_id[param_id] = []
        parameter_items_by_param_id[param_id].append(pi)

    documents_by_id: dict[uuid.UUID, dict[str, Any]] = {}
    for d in active_documents:
        documents_by_id[d["id"]] = d

    # Step 3: Persona selection
    scenario_persona_ids: list[uuid.UUID] = []
    should_randomize_persona = not targets or "persona" in [t.lower() for t in targets]

    if scenario_id_uuid and existing_persona_ids:
        scenario_persona_ids = [uuid.UUID(p) for p in existing_persona_ids]
        logger.info(
            f"Found {len(scenario_persona_ids)} existing persona_ids: {scenario_persona_ids}"
        )
    elif persona_ids and not should_randomize_persona:
        scenario_persona_ids = persona_ids[:1]
        logger.info(f"Using provided persona_id: {scenario_persona_ids}")
    elif should_randomize_persona:
        if active_personas:
            available_count = len(active_personas)
            capped_max = min(persona_max, available_count)
            effective_min = min(persona_min, available_count)
            if effective_min <= capped_max:
                count = random.randint(effective_min, capped_max)
                shuffled = active_personas.copy()
                random.shuffle(shuffled)
                scenario_persona_ids = [p["id"] for p in shuffled[:count]]
                logger.info(
                    f"Randomly selected {count} persona(s) (range: {persona_min}-{persona_max}, "
                    f"available: {available_count}): {scenario_persona_ids}"
                )
            else:
                selected_persona = random.choice(active_personas)
                scenario_persona_ids = [selected_persona["id"]]
                logger.info(
                    f"Range invalid ({effective_min}-{capped_max}), selected 1 persona: {scenario_persona_ids[0]}"
                )
        else:
            logger.info("No active personas found")

    persona_id = scenario_persona_ids[0] if scenario_persona_ids else None

    # Step 3.5: Persona parameter selection
    persona_param_ids: list[uuid.UUID] = []
    if not targets or "persona" in [t.lower() for t in targets]:
        persona_parameters = [
            p for p in active_parameters if p.get("persona_parameter", False)
        ]
        if persona_parameters:
            for param in persona_parameters:
                param_items = parameter_items_by_param_id.get(param["id"], [])
                if param_items:
                    param_id_str = str(param["id"])
                    param_range = field_ranges_json.get(param_id_str, {})
                    param_min = (
                        param_range.get("min", 1)
                        if isinstance(param_range, dict)
                        else 1
                    )
                    param_max = (
                        param_range.get("max", 3)
                        if isinstance(param_range, dict)
                        else 3
                    )

                    available_count = len(param_items)
                    capped_max = min(param_max, available_count)
                    effective_min = min(param_min, available_count)

                    if effective_min <= capped_max:
                        count = random.randint(effective_min, capped_max)
                        shuffled = param_items.copy()
                        random.shuffle(shuffled)
                        selected_items = shuffled[:count]
                        persona_param_ids.extend(
                            [item["id"] for item in selected_items]
                        )
                    else:
                        selected_item = random.choice(param_items)
                        persona_param_ids.append(selected_item["id"])
            logger.info(
                f"Randomly selected {len(persona_param_ids)} persona parameter_item_ids using per-parameter ranges: {persona_param_ids}"
            )

    # Step 4: Parameter item selection
    param_ids: list[uuid.UUID] = []
    should_randomize_parameters = not targets or "parameters" in [
        t.lower() for t in targets
    ]

    if scenario_id_uuid and existing_parameter_item_ids:
        param_ids = [uuid.UUID(p) for p in existing_parameter_item_ids]
        logger.info(f"Using {len(param_ids)} existing parameter_item_ids: {param_ids}")
    elif parameter_item_ids and not should_randomize_parameters:
        param_ids = parameter_item_ids
        logger.info(f"Using provided parameter_item_ids: {param_ids}")
    elif should_randomize_parameters:
        general_parameters = [
            p
            for p in active_parameters
            if not p.get("document_parameter", False)
            and not p.get("persona_parameter", False)
        ]
        if general_parameters:
            available_count = len(general_parameters)
            capped_max = min(parameter_max, available_count)
            effective_min = min(parameter_min, available_count)
            if effective_min <= capped_max:
                count = random.randint(effective_min, capped_max)
                shuffled = general_parameters.copy()
                random.shuffle(shuffled)
                selected_parameters = shuffled[:count]
            else:
                selected_parameters = [random.choice(general_parameters)]

            for param in selected_parameters:
                param_items = parameter_items_by_param_id.get(param["id"], [])
                if param_items:
                    param_id_str = str(param["id"])
                    param_range = field_ranges_json.get(param_id_str, {})
                    param_min = (
                        param_range.get("min", 1)
                        if isinstance(param_range, dict)
                        else 1
                    )
                    param_max = (
                        param_range.get("max", 3)
                        if isinstance(param_range, dict)
                        else 3
                    )

                    available_count = len(param_items)
                    capped_max = min(param_max, available_count)
                    effective_min = min(param_min, available_count)

                    if effective_min <= capped_max:
                        count = random.randint(effective_min, capped_max)
                        shuffled = param_items.copy()
                        random.shuffle(shuffled)
                        selected_items = shuffled[:count]
                        param_ids.extend([item["id"] for item in selected_items])
                    else:
                        selected_item = random.choice(param_items)
                        param_ids.append(selected_item["id"])
            logger.info(
                f"Randomly selected {len(selected_parameters)} parameter(s) "
                f"(range: {parameter_min}-{parameter_max}, available: {available_count}), "
                f"with {len(param_ids)} parameter_item_ids: {param_ids}"
            )
        else:
            logger.info("No active general parameters found")

    # Step 5: Document selection
    doc_ids: list[uuid.UUID] = []
    should_randomize_documents = not targets or "documents" in [
        t.lower() for t in targets
    ]

    if scenario_id_uuid and existing_document_ids:
        doc_ids = [uuid.UUID(d) for d in existing_document_ids]
        logger.info(f"Using {len(doc_ids)} existing document_ids: {doc_ids}")
    elif document_ids and not should_randomize_documents:
        doc_ids = document_ids
        logger.info(f"Using provided document_ids: {doc_ids}")
    elif should_randomize_documents:
        doc_matching_param_item_ids = param_ids.copy() if param_ids else []

        if not doc_matching_param_item_ids and active_parameters:
            for param in active_parameters:
                param_items = parameter_items_by_param_id.get(param["id"], [])
                if param_items:
                    selected_item = random.choice(param_items)
                    doc_matching_param_item_ids.append(selected_item["id"])

        matching_documents = []
        if doc_matching_param_item_ids:
            matching_documents = [
                documents_by_id[j["document_id"]]
                for j in document_parameter_items_junction
                if j["parameter_item_id"] in doc_matching_param_item_ids
                and j["document_id"] in documents_by_id
            ]
            logger.info(
                f"Found {len(matching_documents)} documents matching parameter items"
            )

        available_documents = (
            matching_documents if matching_documents else active_documents
        )
        if available_documents:
            available_count = len(available_documents)
            capped_max = min(document_max, available_count)
            effective_min = min(document_min, available_count)
            if effective_min <= capped_max:
                count = random.randint(effective_min, capped_max)
                shuffled = available_documents.copy()
                random.shuffle(shuffled)
                doc_ids = [d["id"] for d in shuffled[:count]]
                logger.info(
                    f"Randomly selected {count} document(s) (range: {document_min}-{document_max}, "
                    f"available: {available_count}): {doc_ids}"
                )
            else:
                if effective_min == 0:
                    doc_ids = []
                    logger.info("Range allows 0 documents, selected none")
                else:
                    selected_doc = random.choice(available_documents)
                    doc_ids = [selected_doc["id"]]
                    logger.info(
                        f"Range invalid ({effective_min}-{capped_max}), selected 1 document: {doc_ids[0]}"
                    )
        else:
            logger.info("No active documents found")

    # Step 5.5: Document parameter extraction
    document_param_ids: list[uuid.UUID] = []
    if doc_ids and (not targets or "documents" in [t.lower() for t in targets]):
        for doc_id in doc_ids:
            doc_param_items = [
                j["parameter_item_id"]
                for j in document_parameter_items_junction
                if j["document_id"] == doc_id
            ]
            for param_item_id in doc_param_items:
                param_item = parameter_items_by_id.get(param_item_id)
                if param_item:
                    param_id = param_item["parameter_id"]
                    param_dict: dict[str, Any] | None = next(
                        (p for p in active_parameters if p["id"] == param_id), None
                    )
                    if param_dict and param_dict.get("document_parameter", False):
                        if param_item_id not in document_param_ids:
                            document_param_ids.append(param_item_id)
        logger.info(
            f"Extracted {len(document_param_ids)} document parameter_item_ids from selected documents: {document_param_ids}"
        )

    # Step 6: Child scenario creation (if scenario_id provided)
    child_scenario_id: uuid.UUID | None = None
    if scenario_id_uuid:
        sql = load_sql("app/sql/v3/scenario/get_scenario_by_id.sql")
        parent_scenario_row = await conn.fetchrow(sql, scenario_id_uuid)
        if not parent_scenario_row:
            raise ValueError(f"Parent scenario {scenario_id_uuid} not found")

        parent_scenario_dict = dict(parent_scenario_row)

        sql = load_sql("app/sql/v3/scenario/get_scenario_problem_statement_active.sql")
        problem_statement_row = await conn.fetchrow(sql, scenario_id_uuid)
        scenario_problem_statement = (
            problem_statement_row["problem_statement"]
            if problem_statement_row
            else None
        )

        if not scenario_problem_statement:
            logger.info("No problem statement found, generating via scenario agent")
            scenario_agent_id = parent_scenario_dict.get("scenario_agent_id")
            if not scenario_agent_id:
                raise ValueError(
                    f"Parent scenario {scenario_id_uuid} has no scenario_agent_id configured"
                )

            agent_id_uuid = uuid.UUID(scenario_agent_id)
            objectives_enabled = parent_scenario_dict.get("objectives_enabled", True)
            images_enabled = False

            if not selected_department_id:
                raise ValueError(
                    "department_id is required for scenario problem statement generation"
                )

            logger.info(
                f"Generating scenario problem statement with "
                f"department_id={selected_department_id}, agent_id={agent_id_uuid}, persona_id={persona_id}, "
                f"document_ids={doc_ids}, parameter_item_ids={param_ids}"
            )

            if not profile_id_for_randomization:
                raise ValueError(
                    "profile_id is required for scenario problem statement generation"
                )
            sql = load_sql("app/sql/v3/scenario/get_scenario_run_context.sql")
            context_row = await conn.fetchrow(
                sql,
                selected_department_id,
                persona_id if persona_id else None,
                [str(d) for d in doc_ids] if doc_ids else [],
                [str(p) for p in param_ids] if param_ids else [],
                str(agent_id_uuid),
                str(profile_id_for_randomization),
            )

            if not context_row:
                raise ValueError(
                    f"Agent {agent_id_uuid} not found or not available for department {selected_department_id}"
                )

            documents = (
                json.loads(context_row["documents"])
                if isinstance(context_row["documents"], str)
                else context_row["documents"]
            )
            parameter_items = (
                json.loads(context_row["parameter_items"])
                if isinstance(context_row["parameter_items"], str)
                else context_row["parameter_items"]
            )

            context = {
                "agent_id": context_row["agent_id"],
                "agent_name": context_row["agent_name"],
                "system_prompt": context_row["system_prompt"],
                "temperature": float(context_row["temperature"])
                if context_row["temperature"] is not None
                else 0.0,
                "reasoning": context_row["reasoning"],
                "model_id": context_row["model_id"],
                "model_name": context_row["model_name"],
                "provider": context_row["provider"],
                "base_url": context_row["base_url"],
                "api_key": context_row["api_key"],
                "persona": {
                    "id": context_row["persona_id"],
                    "name": context_row["persona_name"],
                    "description": context_row["persona_description"],
                }
                if context_row["persona_id"]
                else None,
                "documents": documents,
                "parameter_items": parameter_items,
                "req_per_day": context_row["req_per_day"],
                "runs_today_count": context_row["runs_today_count"],
                "earliest_run_created_at": context_row["earliest_run_created_at"],
            }

            if persona_id is None or context["persona"] is None:
                persona_info = None
                show_images = False
            else:
                persona_data = context["persona"]
                persona_info = {
                    "role": "user",
                    "content": f"This is the profile of the student: Name: {persona_data['name']} Description: {persona_data.get('description', '')}",
                }
                show_images = False

            if not doc_ids or len(doc_ids) == 0:
                document_info = None
            else:
                document_info = format_document_info(context["documents"], show_images)

            if not param_ids or len(param_ids) == 0:
                parameter_item_info = None
            else:
                parameter_items_data = context["parameter_items"]
                if not parameter_items_data:
                    parameter_item_info = {
                        "role": "user",
                        "content": "No parameter items found.",
                    }
                else:
                    formatted_items = []
                    for row in parameter_items_data:
                        formatted_item = (
                            f"This is the {row['param_name']} ({row.get('param_description', '')}) for this chat: {row['item_name']}. "
                            f"Description: {row.get('item_description', '')}."
                        )
                        formatted_items.append(formatted_item)

                    content = (
                        "The following is the parameter item information:\n"
                        + "\n".join(formatted_items)
                    )
                    parameter_item_info = {
                        "role": "user",
                        "content": content,
                    }

            final_profile_id: uuid.UUID = profile_id_for_randomization

            group_id = uuid.uuid4()
            scenario_trace_id = gen_trace_id()
            primary_id = str(group_id)

            sql_get_agent_tools = load_sql("app/sql/v3/agents/get_agent_tools.sql")
            rows = await conn.fetch(sql_get_agent_tools, str(agent_id_uuid))
            agent_tools_config = [dict(row) for row in rows]
            tool_config_map: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            scenario_results: dict[str, Any] = {}

            scenario_tools: list[Tool] = []

            statement_config = tool_config_map.get("create_statement")
            if statement_config:
                statement_desc = statement_config.get("argument_descriptions", {}).get(
                    "statement",
                    "The problem statement for the scenario (1-2 sentences)",
                )
            else:
                statement_desc = (
                    "The problem statement for the scenario (1-2 sentences)"
                )

            async def create_statement(
                statement: str = Field(description=statement_desc),
            ) -> str:
                """Create the problem statement for the scenario."""
                scenario_results["description"] = statement
                logger.info(f"✓ Created statement: {statement[:50]}...")
                return "Created problem statement successfully"

            scenario_tools.append(function_tool(create_statement))

            if objectives_enabled:
                objective_config = tool_config_map.get("create_objective")
                if objective_config:
                    objective_desc = objective_config.get(
                        "argument_descriptions", {}
                    ).get(
                        "objective",
                        "A specific learning objective that GTAs should achieve in this scenario",
                    )
                else:
                    objective_desc = "A specific learning objective that GTAs should achieve in this scenario"

                async def create_objective(
                    objective: str = Field(description=objective_desc),
                ) -> str:
                    """Create a learning objective for this scenario. Call multiple times to create multiple objectives."""
                    if "objectives" not in scenario_results:
                        scenario_results["objectives"] = []
                    scenario_results["objectives"].append(objective)
                    logger.info(f"✓ Created objective: {objective[:50]}...")
                    return f"Created learning objective successfully (total: {len(scenario_results['objectives'])})"

                scenario_tools.append(function_tool(create_objective))

            if images_enabled:
                image_config = tool_config_map.get("create_image")
                if image_config:
                    name_desc = image_config.get("argument_descriptions", {}).get(
                        "name", "Descriptive name for the generated image"
                    )
                    prompt_desc = image_config.get("argument_descriptions", {}).get(
                        "prompt", "Detailed, descriptive prompt for image generation"
                    )
                else:
                    name_desc = "Descriptive name for the generated image"
                    prompt_desc = "Detailed, descriptive prompt for image generation"

                async def create_image(
                    name: str = Field(description=name_desc),
                    prompt: str = Field(description=prompt_desc),
                ) -> str:
                    """Create an image for this scenario."""
                    if "image_requests" not in scenario_results:
                        scenario_results["image_requests"] = {}
                    scenario_results["image_requests"][name] = prompt
                    logger.info(f"✓ Queued image creation: {name}")
                    return f"Image creation queued for '{name}'"

                scenario_tools.append(function_tool(create_image))

            scenario_tools.append(debug_info_tool)
            logger.info(
                f"Created {len(scenario_tools)} scenario tools (including debug_info)"
            )

            def tool_use_behavior(
                tool_context: RunContextWrapper[Any],
                tool_results: list[FunctionToolResult],
            ) -> ToolsToFinalOutputResult:
                required_tools = ["create_statement"]
                if objectives_enabled:
                    required_tools.append("create_objective")
                completed_tools: list[str] = []
                logger.info(
                    f"Tool use check: required={required_tools}, tool_results={len(tool_results)}"
                )

                for idx, result in enumerate(tool_results):
                    tool_name = None
                    if hasattr(result, "tool_name"):
                        tool_name = result.tool_name  # type: ignore[attr-defined]
                    else:
                        tool_name = getattr(result, "tool_name", None)  # type: ignore[misc]

                    if not tool_name:
                        tool_obj = getattr(result, "tool", None)  # type: ignore[misc]
                        if tool_obj:
                            tool_name = getattr(tool_obj, "name", None)  # type: ignore[misc]

                    if tool_name and isinstance(tool_name, str):
                        normalized_name = tool_name
                        if tool_name == "create_statement" or (
                            "statement" in tool_name.lower()
                            and (
                                "create" in tool_name.lower()
                                or "title" in tool_name.lower()
                                or "description" in tool_name.lower()
                            )
                        ):
                            normalized_name = "create_statement"
                        elif tool_name == "create_objective" or (
                            "objective" in tool_name.lower()
                            and "create" in tool_name.lower()
                        ):
                            normalized_name = "create_objective"
                        completed_tools.append(normalized_name)
                        logger.info(
                            f"Tool result {idx}: tool_name={tool_name} normalized={normalized_name}"
                        )
                    else:
                        logger.warning(
                            f"Tool result {idx}: Could not extract tool name. tool_name={tool_name}"
                        )

                all_completed = all(tool in completed_tools for tool in required_tools)
                logger.info(
                    f"Tool use behavior check: required={required_tools}, completed={completed_tools}, all_completed={all_completed}"
                )
                return ToolsToFinalOutputResult(is_final_output=all_completed)

            scenario_agent_generic = GenericAgent(
                agent_name=context["agent_name"],
                system_prompt=context["system_prompt"],
                temperature=context["temperature"],
                model_name=context["model_name"],
                provider=context["provider"],
                base_url=context["base_url"],
                api_key=context["api_key"],
                reasoning=context["reasoning"],
                tools=scenario_tools,
                parallel_tool_calls=False,
                tool_use_behavior=tool_use_behavior,
            )

            agent_instance = scenario_agent_generic.agent()

            input_items: list[TResponseInputItem | None] = [
                persona_info,
                document_info,
                parameter_item_info,
            ]

            clean_input_items = [item for item in input_items if item is not None]

            req_per_day = context["req_per_day"]
            runs_today_count = context["runs_today_count"]

            if req_per_day is not None and runs_today_count >= req_per_day:
                earliest_run_created_at = context["earliest_run_created_at"]
                if earliest_run_created_at:
                    next_allowed_utc = earliest_run_created_at + timedelta(days=1)
                    eastern_tz = ZoneInfo("America/New_York")
                    next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
                    error_message = (
                        f"Daily request limit of {req_per_day} reached. "
                        f"Next request allowed after {next_allowed_et.strftime('%I:%M %p %Z')} on "
                        f"{next_allowed_et.strftime('%B %d, %Y')}."
                    )
                else:
                    error_message = f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
                raise ValueError(error_message)

            sql_create_run = load_sql(
                "app/sql/v3/model_runs/create_model_run_complete.sql"
            )
            model_run_row = await conn.fetchrow(
                sql_create_run,
                selected_department_id,
                uuid.UUID(context["model_id"]),
                uuid.UUID(context["agent_id"]),
                "agent",
                final_profile_id,
                None,
                context["agent_id"],
            )
            model_run_id = uuid.UUID(model_run_row["run_id"])

            with trace(
                "Scenario Agent",
                group_id=str(group_id),
                trace_id=scenario_trace_id,
            ):
                result = await Runner.run(
                    agent_instance,
                    input=clean_input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            logger.info("Scenario generation completed successfully")
            logger.info(f"Title: {scenario_results.get('title', 'N/A')}")
            logger.info(
                f"Description: {scenario_results.get('description', 'N/A')[:100]}..."
            )
            objectives = (
                scenario_results.get("objectives", []) if objectives_enabled else []
            )
            logger.info(f"Objectives: {objectives}")

            usage = result.context_wrapper.usage

            sql_update_tokens = load_sql(
                "app/sql/v3/model_runs/update_model_run_tokens.sql"
            )
            await conn.execute(
                sql_update_tokens,
                str(model_run_id),
                usage.input_tokens,
                usage.output_tokens,
            )
            assistant_output = getattr(result, "final_output", None) or ""

            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "scenario",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": context["system_prompt"],
                    "inputItems": clean_input_items,
                    "assistantOutput": assistant_output,
                    "departmentId": str(selected_department_id) if selected_department_id else None,
                },
            )

            title = scenario_results.get("title") or ""
            description = scenario_results.get("description") or ""

            logger.info(
                f"Scenario generation completed: title={title}, "
                f"description length={len(description)}, objectives count={len(objectives)}"
            )

            generated_image_ids: list[str] = []

            scenario_problem_statement = description
            scenario_title = title
            scenario_objectives = objectives
        else:
            scenario_title = parent_scenario_dict.get("name", "")
            sql = load_sql("app/sql/v3/scenario/get_scenario_objectives_top_n.sql")
            objectives_data = await conn.fetch(sql, scenario_id_uuid, 3)
            scenario_objectives = [obj["objective"] for obj in objectives_data]

        sql = load_sql("app/sql/v3/scenario/insert_scenario_variant.sql")
        new_scenario_row = await conn.fetchrow(
            sql,
            scenario_title or parent_scenario_dict.get("name", ""),
            True,
            True,
            parent_scenario_dict.get("objectives_enabled", True),
            parent_scenario_dict.get("image_enabled", True),
            parent_scenario_dict.get("scenario_agent_id"),
            parent_scenario_dict.get("image_agent_id"),
        )
        child_scenario_id = new_scenario_row["id"]
        logger.info(
            f"Created child scenario variant {child_scenario_id} for parent {scenario_id_uuid}"
        )

        if scenario_problem_statement:
            sql = load_sql("app/sql/v3/scenario/insert_scenario_problem_statement.sql")
            problem_statement_name = (
                scenario_title.strip()
                if scenario_title and scenario_title.strip()
                else "Generated Problem Statement"
            )
            await conn.fetchrow(
                sql,
                child_scenario_id,
                scenario_problem_statement,
                problem_statement_name,
                True,
            )
            logger.info(
                f"Created problem statement for child scenario {child_scenario_id}"
            )

        if scenario_objectives and parent_scenario_dict.get("objectives_enabled", True):
            sql = load_sql("app/sql/v3/scenario/insert_scenario_objective.sql")
            for idx, objective in enumerate(scenario_objectives[:3]):
                await conn.execute(sql, child_scenario_id, idx, objective)
            logger.info(
                f"Inserted {min(len(scenario_objectives), 3)} objectives for child scenario {child_scenario_id}"
            )

        sql = load_sql("app/sql/v3/scenario/insert_scenario_tree_edge.sql")
        await conn.execute(
            sql,
            scenario_id_uuid,
            child_scenario_id,
            True,
        )
        logger.info(
            f"Created scenario_tree edge: parent={scenario_id_uuid} -> child={child_scenario_id}"
        )

        if persona_id:
            sql = load_sql("app/sql/v3/scenario/insert_scenario_persona_link.sql")
            await conn.execute(sql, child_scenario_id, persona_id, True)
            logger.info(
                f"Linked persona {persona_id} to child scenario {child_scenario_id}"
            )

        if doc_ids:
            sql = load_sql("app/sql/v3/scenario/insert_scenario_document_link.sql")
            for doc_id in doc_ids:
                await conn.execute(sql, child_scenario_id, doc_id, True)
            logger.info(
                f"Linked {len(doc_ids)} document(s) to child scenario {child_scenario_id}"
            )

        if param_ids:
            sql = load_sql("app/sql/v3/scenario/insert_scenario_parameter_link.sql")
            for param_id in param_ids:
                await conn.execute(sql, child_scenario_id, param_id, True)
            logger.info(
                f"Linked {len(param_ids)} parameter item(s) to child scenario {child_scenario_id}"
            )

        if selected_department_id:
            sql = load_sql("app/sql/v3/scenario/insert_scenario_department_link.sql")
            await conn.execute(sql, child_scenario_id, selected_department_id, True)
            logger.info(
                f"Linked department {selected_department_id} to child scenario {child_scenario_id}"
            )
        else:
            logger.info(
                f"No department to link - child scenario {child_scenario_id} will be cross-department"
            )

    # Combine all parameter item IDs
    all_param_item_ids = (
        list(param_ids) + list(persona_param_ids) + list(document_param_ids)
    )
    seen = set()
    unique_param_item_ids = []
    for pid in all_param_item_ids:
        if pid not in seen:
            seen.add(pid)
            unique_param_item_ids.append(pid)

    randomized_result = {
        "department_id": selected_department_id,
        "persona_id": persona_id,
        "persona_ids": scenario_persona_ids,
        "document_ids": doc_ids,
        "parameter_item_ids": unique_param_item_ids,
        "child_scenario_id": child_scenario_id,
    }

    new_scenario_id = randomized_result["child_scenario_id"]
    if not new_scenario_id:
        raise ValueError("Failed to create child scenario")

    logger.info(
        f"Created child scenario variant {new_scenario_id} for parent {parent_scenario_id_uuid} "
        f"with persona_id={randomized_result['persona_id']}, "
        f"document_ids={randomized_result['document_ids']}, "
        f"parameter_item_ids={randomized_result['parameter_item_ids']}"
    )

    # Step 15: Create chat using child scenario ID (not parent)
    chat_title = parent_scenario.get("name", "")
    trace_id = gen_trace_id()

    sql = load_sql("app/sql/v3/simulations/create_simulation_chat.sql")
    chat = await conn.fetchrow(
        sql,
        datetime.now(UTC),
        chat_title,
        str(new_scenario_id),  # Use child scenario ID, not parent
        attempt_id,
        mark_completed,
        trace_id,
    )

    return dict(chat) if chat else None


# Internal event handler for chat creation
@internal_sio.on("simulation_chat_create")
async def simulation_chat_create_internal(data: dict[str, Any]) -> None:
    """Handle simulation_chat_create event from internal bus (server-to-server).

    This handler creates a new chat with randomization logic.
    Called by end.py when it needs to create a new chat.
    """
    try:
        scenario_id = data.get("scenario_id")
        attempt_id = data.get("attempt_id")
        profile_id = data.get("profile_id")
        mark_completed = data.get("mark_completed", False)

        if not scenario_id or not attempt_id:
            logger.error(
                "[simulation_chat_create_internal] Missing required fields: scenario_id or attempt_id"
            )
            return

        pool = get_pool()
        if not pool:
            logger.error(
                "[simulation_chat_create_internal] Database connection pool not available"
            )
            return

        async with pool.acquire() as conn:
            chat = await _create_chat_with_randomization(
                conn=conn,
                scenario_id=str(scenario_id),
                attempt_id=str(attempt_id),
                profile_id=str(profile_id) if profile_id else None,
                mark_completed=bool(mark_completed),
            )

            if chat:
                logger.info(
                    f"[simulation_chat_create_internal] Created chat {chat.get('id')} for scenario {scenario_id}"
                )
                # Emit completion event if callback provided
                if "callback" in data:
                    callback_data = data["callback"]
                    await internal_sio.emit(
                        callback_data.get("event", "simulation_chat_created"),
                        {
                            **callback_data.get("payload", {}),
                            "chat_id": str(chat["id"]),
                            "chat": chat,
                        },
                    )
            else:
                logger.error(
                    f"[simulation_chat_create_internal] Failed to create chat for scenario {scenario_id}"
                )

    except Exception as e:
        logger.error(
            f"[simulation_chat_create_internal] Error creating chat: {str(e)}",
            exc_info=True,
        )


# Direct callable function for when return value is needed
async def simulation_chat_create_impl(
    conn: asyncpg.Connection,
    scenario_id: str,
    attempt_id: str,
    profile_id: str | None,
    mark_completed: bool,
) -> dict[str, Any] | None:
    """Direct callable implementation for creating chat with randomization.

    This can be called directly when the return value is needed (e.g., from end.py).
    The internal event handler wraps this function.
    """
    return await _create_chat_with_randomization(
        conn=conn,
        scenario_id=scenario_id,
        attempt_id=attempt_id,
        profile_id=profile_id,
        mark_completed=mark_completed,
    )


async def _simulation_start_impl(sid: str, data: StartSimulationPayload) -> None:
    """
    Handle simulation start requests via WebSocket.
    Creates attempt and checks for next incomplete scenario, then emits to next.py if found.
    """
    try:
        logger.info(
            f"Received simulation_start request from {sid} with data: {data}"
        )

        simulation_id = data.simulation_id
        profile_id = data.profile_id
        scenario_id_override = data.scenario_id
        infinite = data.infinite

        # Validate profile_id is required
        if not profile_id or profile_id == "" or profile_id == "null":
            await simulation_start_error(
                StartSimulationErrorPayload(
                    success=False, message="profileId is required"
                ),
                room=sid,
            )
            logger.error(f"Emitted error to {sid}: profileId is required")
            return

        # Validate simulation_id (required unless in practice mode)
        if not data.practice_mode and not simulation_id:
            logger.error(f"Missing simulation_id in request from {sid}")
            await simulation_start_error(
                StartSimulationErrorPayload(
                    success=False, message="Missing simulation_id"
                ),
                room=sid,
            )
            logger.error(f"Emitted error to {sid}: Missing simulation_id")
            return

        logger.info(
            f"Processing simulation start: simulation_id={simulation_id}, profile_id={profile_id}, practice_mode={data.practice_mode}, sid={sid}"
        )

        # Get connection pool
        pool = get_pool()
        if not pool:
            await simulation_start_error(
                StartSimulationErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            logger.error(
                f"Emitted error to {sid}: Database connection pool not available"
            )
            return

        async with pool.acquire() as conn:
            # Handle practice mode: find simulation and create variant if needed
            if data.practice_mode:
                # Practice mode: find practice simulation with persona
                if not data.practice_persona_id:
                    await simulation_start_error(
                        StartSimulationErrorPayload(
                            success=False, message="Missing persona_id for practice mode"
                        ),
                        room=sid,
                    )
                    return

                # Find practice simulation with persona
                department_ids = (
                    [data.practice_department_id] if data.practice_department_id else []
                )
                sql = load_sql(
                    "app/sql/v3/practice/find_practice_simulation_with_persona.sql"
                )
                result = await conn.fetchrow(sql, data.practice_persona_id, department_ids)

                if not result:
                    await simulation_start_error(
                        StartSimulationErrorPayload(
                            success=False,
                            message=f"No practice simulation found for persona {data.practice_persona_id}",
                        ),
                        room=sid,
                    )
                    return

                simulation_id = result["simulation_id"]
                parent_scenario_id = result["scenario_id"]
                logger.info(
                    f"Found practice simulation {simulation_id} with scenario {parent_scenario_id}"
                )

                # Get parent scenario
                sql = load_sql("app/sql/v3/scenario/get_scenario_by_id.sql")
                parent_scenario = await conn.fetchrow(sql, parent_scenario_id)
                if not parent_scenario:
                    await simulation_start_error(
                        StartSimulationErrorPayload(
                            success=False, message="Parent scenario not found"
                        ),
                        room=sid,
                    )
                    return

                parent_scenario_dict = dict(parent_scenario)
                parent_scenario_id_uuid = uuid.UUID(parent_scenario_id)

                # Determine department_id (allow None for guests)
                selected_dept_id: uuid.UUID | None = None
                if data.practice_department_id:
                    selected_dept_id = uuid.UUID(data.practice_department_id)
                else:
                    # Fallback: get from scenario or profile
                    sql = load_sql("app/sql/v3/scenario/get_scenario_departments.sql")
                    scenario_dept_rows = await conn.fetch(sql, parent_scenario_id_uuid)
                    if scenario_dept_rows and len(scenario_dept_rows) > 0:
                        selected_dept_id = scenario_dept_rows[0]["department_id"]
                    elif profile_id:
                        sql = load_sql("app/sql/v3/profile/get_departments_for_profile.sql")
                        profile_dept_rows = await conn.fetch(sql, profile_id)
                        if profile_dept_rows and len(profile_dept_rows) > 0:
                            selected_dept_id = profile_dept_rows[0]["id"]

                # For guests without departments, allow None and use empty array for randomization
                if not selected_dept_id:
                    logger.info(
                        f"No department_id found for guest profile {profile_id}, "
                        "proceeding with general/cross-department items"
                    )

                # Determine if we need to create a customized scenario variant
                needs_customization = data.practice_persona_id or (
                    data.practice_parameter_item_ids
                    and len(data.practice_parameter_item_ids) > 0
                )

                if needs_customization:
                    # Create scenario variant with selected attributes
                    logger.info(
                        f"Creating customized scenario variant for persona={data.practice_persona_id}, "
                        f"parameters={data.practice_parameter_item_ids}"
                    )

                    # Create child scenario variant
                    sql = load_sql("app/sql/v3/scenario/insert_scenario_variant.sql")
                    new_scenario_row = await conn.fetchrow(
                        sql,
                        parent_scenario_dict["name"],
                        True,  # generated
                        True,  # active
                        parent_scenario_dict.get("objectives_enabled", True),
                        parent_scenario_dict.get("images_enabled", True),
                        parent_scenario_dict.get("scenario_agent_id"),
                        parent_scenario_dict.get("image_agent_id"),
                    )
                    new_scenario_id = new_scenario_row["id"]
                    logger.info(
                        f"Created child scenario variant {new_scenario_id} for parent {parent_scenario_id_uuid}"
                    )

                    # Create scenario_tree edge
                    sql = load_sql("app/sql/v3/scenario/insert_scenario_tree_edge.sql")
                    await conn.execute(
                        sql, parent_scenario_id_uuid, new_scenario_id, True
                    )

                    # Link persona
                    if data.practice_persona_id:
                        persona_id_to_link = uuid.UUID(data.practice_persona_id)
                        sql = load_sql(
                            "app/sql/v3/scenario/insert_scenario_persona_link.sql"
                        )
                        await conn.execute(sql, new_scenario_id, persona_id_to_link, True)
                        logger.info(
                            f"Linked persona {persona_id_to_link} to child scenario"
                        )

                    # Link parameter items
                    if data.practice_parameter_item_ids:
                        sql = load_sql(
                            "app/sql/v3/scenario/insert_scenario_parameter_link.sql"
                        )
                        for param_id_str in data.practice_parameter_item_ids:
                            param_id = uuid.UUID(param_id_str)
                            await conn.execute(sql, new_scenario_id, param_id, True)
                        logger.info(
                            f"Linked {len(data.practice_parameter_item_ids)} parameter item(s) to child scenario"
                        )

                    # Link department
                    if selected_dept_id:
                        sql = load_sql(
                            "app/sql/v3/scenario/insert_scenario_department_link.sql"
                        )
                        await conn.execute(sql, new_scenario_id, selected_dept_id, True)
                        logger.info(
                            f"Linked department {selected_dept_id} to child scenario"
                        )
                    else:
                        logger.info(
                            "No department to link - scenario will be cross-department"
                        )

                    scenario_id_override = str(new_scenario_id)
                else:
                    # No customization needed, use parent scenario
                    scenario_id_override = parent_scenario_id

            # Generate trace_id
            from agents import gen_trace_id

            trace_id = gen_trace_id()

            # Create attempt using SQL
            sql = load_sql(
                "app/sql/v3/simulations/start_simulation_attempt_complete.sql"
            )
            row = await conn.fetchrow(
                sql,
                simulation_id,
                infinite,
                profile_id if profile_id else None,
                scenario_id_override if scenario_id_override else None,
                trace_id,
            )

            if not row:
                await simulation_start_error(
                    StartSimulationErrorPayload(
                        success=False, message="Failed to start simulation attempt"
                    ),
                    room=sid,
                )
                logger.error(
                    f"Emitted error to {sid}: Failed to start simulation attempt"
                )
                return

            attempt_id = row["attempt_id"]

            # Check if there's a next incomplete scenario
            sql = load_sql(
                "app/sql/v3/simulations/check_next_incomplete_scenario.sql"
            )
            next_scenario_row = await conn.fetchrow(sql, attempt_id)

            if not next_scenario_row:
                await simulation_start_error(
                    StartSimulationErrorPayload(
                        success=False,
                        message="Failed to check for next scenario",
                    ),
                    room=sid,
                )
                logger.error(
                    f"Emitted error to {sid}: Failed to check for next scenario"
                )
                return

            has_next_scenario = next_scenario_row.get("has_next_scenario", False)
            next_scenario_id = next_scenario_row.get("next_scenario_id")

            # Emit success event
            await simulation_started(
                SimulationStartedPayload(
                    success=True,
                    message="Simulation attempt created successfully",
                    attempt_id=str(attempt_id),
                ),
                room=sid,
            )

            # If there's a next scenario, emit to next.py handler
            if has_next_scenario and next_scenario_id:
                logger.info(
                    f"Found next scenario {next_scenario_id} for attempt {attempt_id}, emitting to next.py"
                )
                await internal_sio.emit(
                    "simulation_next",
                    {
                        "attempt_id": str(attempt_id),
                        "scenario_id": str(next_scenario_id),
                        "profile_id": profile_id,
                        "simulation_id": simulation_id,
                    },
                )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="simulations.started",
                    template="{{ actor.name }} started simulation",
                    context={"attempt_id": str(attempt_id)},
                    endpoint="/socket/v3/simulations/start",
                    error=False,
                )
            except Exception as log_error:
                logger.warning(
                    f"Error logging simulation start activity: {log_error}"
                )

    except Exception as e:
        logger.error(f"Error starting simulation for {sid}: {str(e)}", exc_info=True)
        await simulation_start_error(
            StartSimulationErrorPayload(
                success=False, message=f"Failed to start simulation: {str(e)}"
            ),
            room=sid,
        )
        logger.error(f"Emitted error to {sid}: Failed to start simulation: {str(e)}")
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.started",
                template="{{ actor.name }} failed to start simulation",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/start",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging simulation start error activity: {log_error}"
            )


@sio.event  # type: ignore
async def simulation_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = StartSimulationPayload(**data)
        await _simulation_start_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_start for {sid}: {e}")
        await simulation_start_error(
            StartSimulationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.started",
                template="{{ actor.name }} failed to start simulation (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/start",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging simulation start validation error activity: {log_error}"
            )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/start", response_model=dict[str, bool])
async def simulation_start_api(request: StartSimulationPayload) -> dict[str, bool]:
    """Client-to-server event: Start simulation attempt."""
    return {"success": True}


@server_router.post("/start_error", response_model=dict[str, bool])
async def simulation_start_error_api(
    request: StartSimulationErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while starting simulation."""
    return {"success": True}


@server_router.post("/started", response_model=dict[str, bool])
async def simulation_started_api(
    request: SimulationStartedPayload,
) -> dict[str, bool]:
    """Server-to-client event: Simulation started successfully."""
    return {"success": True}

