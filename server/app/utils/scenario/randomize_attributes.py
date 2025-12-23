"""Scenario randomization utility - used by WebSocket events.

This module provides the core randomization logic for scenario attributes.
It is used by WebSocket events (start_simulation, continue_simulation) to
create randomized child scenario variants.

Note: Randomization in the UI happens via the /scenarios/new endpoint
with a randomize query parameter.
"""

import json
import random
import uuid
from typing import Any

import asyncpg  # type: ignore

from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from app.infra.agents.generic_agent import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.document.format_document_info import format_document_info
from app.utils.scenario.image_generation import get_image_generation_results, set_image_generation_context
from app.utils.tools.build_pydantic_fields import build_function_signature_string
from agents import FunctionToolResult, RunContextWrapper, Runner, Tool, ToolsToFinalOutputResult, function_tool, gen_trace_id, trace
from agents.items import TResponseInputItem
from pydantic import Field

logger = get_logger(__name__)


async def randomize_scenario_attributes(
    conn: asyncpg.Connection,
    persona_ids: list[uuid.UUID] | None = None,
    document_ids: list[uuid.UUID] | None = None,
    parameter_item_ids: list[uuid.UUID] | None = None,
    department_ids: list[uuid.UUID] | None = None,
    scenario_id: uuid.UUID | None = None,
    profile_id: uuid.UUID | None = None,
    targets: list[str] | None = None,
) -> dict[str, Any]:
    """Core randomization logic for scenario attributes.

    Returns dict with keys:
        - department_id: UUID
        - persona_id: UUID | None
        - persona_ids: list[UUID]
        - document_ids: list[UUID]
        - parameter_item_ids: list[UUID]
        - child_scenario_id: UUID | None (if scenario_id provided)
    """
    if targets is None:
        targets = []

    # Step 1: Department selection with fallback logic
    # Track if we should use "all departments" (empty array) vs specific department(s)
    # Normalize None to empty list for consistent handling
    if department_ids is None:
        department_ids = []
    use_all_departments = not department_ids or len(department_ids) == 0

    selected_department_id: uuid.UUID | None = None
    if department_ids and len(department_ids) > 0:
        # Use provided departments, randomly pick one
        selected_department_id = random.choice(department_ids)
        logger.info(f"Using provided department_id: {selected_department_id}")
    elif profile_id:
        # Get profile's accessible departments
        sql = load_sql("sql/v3/profile/get_departments_for_profile.sql")
        profile_dept_rows = await conn.fetch(sql, str(profile_id))
        if profile_dept_rows and len(profile_dept_rows) > 0:
            profile_dept_ids = [uuid.UUID(str(row["id"])) for row in profile_dept_rows]
            selected_department_id = random.choice(profile_dept_ids)
            logger.info(f"Using department_id from profile: {selected_department_id}")

    # Allow None/empty - will use empty array for SQL query to select general/cross-department items
    # Only raise error if we explicitly need a department (e.g., for scenario linking)
    # For randomization, empty array is valid and selects items with no department links
    if not selected_department_id:
        logger.info(
            "No department_id available - will select general/cross-department items "
            "(items with no department links)"
        )

    # Step 1.5: Get randomization ranges (with defaults if scenario_id is None)
    sql = load_sql("sql/v3/scenarios/get_randomization_ranges.sql")
    ranges_result = await conn.fetchrow(sql, scenario_id)
    if not ranges_result:
        # Fallback to defaults if query fails
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
        # Parse field_ranges_json
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
    # If department_ids was null/empty (all departments), pass empty array to SQL query
    # Otherwise pass the selected department for filtering
    dept_uuids: list[uuid.UUID] = (
        [] if use_all_departments else [selected_department_id]
    )
    sql = load_sql("sql/v3/scenarios/get_randomization_data_complete.sql")
    result = await conn.fetchrow(sql, dept_uuids, scenario_id)

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
    # Check if persona is in targets - if so, ignore provided persona_ids and randomize
    should_randomize_persona = not targets or "persona" in [t.lower() for t in targets]

    if scenario_id and existing_persona_ids:
        # Use existing persona links from parent - keep all personas (supports multiple agents)
        scenario_persona_ids = [uuid.UUID(p) for p in existing_persona_ids]
        logger.info(
            f"Found {len(scenario_persona_ids)} existing persona_ids: {scenario_persona_ids}"
        )
    elif persona_ids and not should_randomize_persona:
        # Use provided personas only if persona is NOT in targets
        scenario_persona_ids = persona_ids[:1]  # Take first one only
        logger.info(f"Using provided persona_id: {scenario_persona_ids}")
    elif should_randomize_persona:
        # Random selection from active personas (when persona is in targets)
        # Use ranges to determine count
        if active_personas:
            available_count = len(active_personas)
            capped_max = min(persona_max, available_count)
            # Ensure min doesn't exceed available count
            effective_min = min(persona_min, available_count)
            # Random count between min and max (inclusive)
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
                # Fallback: select at least one if available
                selected_persona = random.choice(active_personas)
                scenario_persona_ids = [selected_persona["id"]]
                logger.info(
                    f"Range invalid ({effective_min}-{capped_max}), selected 1 persona: {scenario_persona_ids[0]}"
                )
        else:
            logger.info("No active personas found")

    # Get single persona_id for agent calls
    persona_id = scenario_persona_ids[0] if scenario_persona_ids else None

    # Step 3.5: Persona parameter selection (when randomizing personas)
    persona_param_ids: list[uuid.UUID] = []
    if not targets or "persona" in [t.lower() for t in targets]:
        # Randomize persona parameters when randomizing personas
        # Use per-parameter field ranges if available
        persona_parameters = [
            p for p in active_parameters if p.get("persona_parameter", False)
        ]
        if persona_parameters:
            for param in persona_parameters:
                param_items = parameter_items_by_param_id.get(param["id"], [])
                if param_items:
                    # Get range for this parameter from field_ranges_json
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

                    # Use range to determine how many items to select for this parameter
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
                        # Fallback: select at least one
                        selected_item = random.choice(param_items)
                        persona_param_ids.append(selected_item["id"])
            logger.info(
                f"Randomly selected {len(persona_param_ids)} persona parameter_item_ids using per-parameter ranges: {persona_param_ids}"
            )

    # Step 4: Parameter item selection
    param_ids: list[uuid.UUID] = []
    # Check if parameters is in targets - if so, ignore provided parameter_item_ids and randomize
    should_randomize_parameters = not targets or "parameters" in [
        t.lower() for t in targets
    ]

    if scenario_id and existing_parameter_item_ids:
        # Use existing parameter item links from parent
        param_ids = [uuid.UUID(p) for p in existing_parameter_item_ids]
        logger.info(f"Using {len(param_ids)} existing parameter_item_ids: {param_ids}")
    elif parameter_item_ids and not should_randomize_parameters:
        # Use provided parameter items only if parameters is NOT in targets
        param_ids = parameter_item_ids
        logger.info(f"Using provided parameter_item_ids: {param_ids}")
    elif should_randomize_parameters:
        # Random selection: use ranges to determine how many parameters to select
        general_parameters = [
            p
            for p in active_parameters
            if not p.get("document_parameter", False)
            and not p.get("persona_parameter", False)
        ]
        if general_parameters:
            available_count = len(general_parameters)
            capped_max = min(parameter_max, available_count)
            # Ensure min doesn't exceed available count
            effective_min = min(parameter_min, available_count)
            # Random count between min and max (inclusive)
            if effective_min <= capped_max:
                count = random.randint(effective_min, capped_max)
                shuffled = general_parameters.copy()
                random.shuffle(shuffled)
                selected_parameters = shuffled[:count]
            else:
                # Fallback: select at least one if available
                selected_parameters = [random.choice(general_parameters)]

            # For each selected parameter, use per-parameter field ranges to determine item count
            for param in selected_parameters:
                param_items = parameter_items_by_param_id.get(param["id"], [])
                if param_items:
                    # Get range for this parameter from field_ranges_json
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

                    # Use range to determine how many items to select for this parameter
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
                        # Fallback: select at least one
                        selected_item = random.choice(param_items)
                        param_ids.append(selected_item["id"])
            logger.info(
                f"Randomly selected {len(selected_parameters)} parameter(s) "
                f"(range: {parameter_min}-{parameter_max}, available: {available_count}), "
                f"with {len(param_ids)} parameter_item_ids: {param_ids}"
            )
        else:
            logger.info("No active general parameters found")

    # Step 5: Document selection (with document_parameter_items junction logic)
    doc_ids: list[uuid.UUID] = []
    # Check if documents is in targets - if so, ignore provided document_ids and randomize
    should_randomize_documents = not targets or "documents" in [
        t.lower() for t in targets
    ]

    if scenario_id and existing_document_ids:
        # Use existing document links from parent
        doc_ids = [uuid.UUID(d) for d in existing_document_ids]
        logger.info(f"Using {len(doc_ids)} existing document_ids: {doc_ids}")
    elif document_ids and not should_randomize_documents:
        # Use provided documents only if documents is NOT in targets
        doc_ids = document_ids
        logger.info(f"Using provided document_ids: {doc_ids}")
    elif should_randomize_documents:
        # Get parameter items for document matching
        doc_matching_param_item_ids = param_ids.copy() if param_ids else []

        # If no parameter items, randomly select one per active parameter
        if not doc_matching_param_item_ids and active_parameters:
            for param in active_parameters:
                param_items = parameter_items_by_param_id.get(param["id"], [])
                if param_items:
                    selected_item = random.choice(param_items)
                    doc_matching_param_item_ids.append(selected_item["id"])

        # Try to find documents matching parameter items via document_parameter_items junction
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

        # Use ranges to determine how many documents to select
        available_documents = (
            matching_documents if matching_documents else active_documents
        )
        if available_documents:
            available_count = len(available_documents)
            capped_max = min(document_max, available_count)
            # Ensure min doesn't exceed available count
            effective_min = min(document_min, available_count)
            # Random count between min and max (inclusive)
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
                # Fallback: select at least one if available (or zero if min is 0)
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

    # Step 5.5: Document parameter extraction (when randomizing documents)
    document_param_ids: list[uuid.UUID] = []
    if doc_ids and (not targets or "documents" in [t.lower() for t in targets]):
        # Extract document parameters from selected documents via document_parameter_items junction
        for doc_id in doc_ids:
            doc_param_items = [
                j["parameter_item_id"]
                for j in document_parameter_items_junction
                if j["document_id"] == doc_id
            ]
            # Only include if they're document parameters
            for param_item_id in doc_param_items:
                param_item = parameter_items_by_id.get(param_item_id)
                if param_item:
                    param_id = param_item["parameter_id"]
                    # Check if this parameter is a document parameter
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
    if scenario_id:
        # Get parent scenario
        sql = load_sql("sql/v3/scenarios/get_scenario_by_id.sql")
        parent_scenario = await conn.fetchrow(sql, scenario_id)
        if not parent_scenario:
            raise ValueError(f"Parent scenario {scenario_id} not found")

        parent_scenario_dict = dict(parent_scenario)

        # Check for problem statement
        sql = load_sql("sql/v3/scenarios/get_scenario_problem_statement_active.sql")
        problem_statement_row = await conn.fetchrow(sql, scenario_id)
        scenario_problem_statement = (
            problem_statement_row["problem_statement"]
            if problem_statement_row
            else None
        )

        # Generate problem statement if missing
        if not scenario_problem_statement:
            logger.info("No problem statement found, generating via scenario agent")
            scenario_agent_id = parent_scenario_dict.get("scenario_agent_id")
            if not scenario_agent_id:
                raise ValueError(
                    f"Parent scenario {scenario_id} has no scenario_agent_id configured"
                )

            # Generate problem statement inline (moved from generate_problem_statement.py)
            agent_id_uuid = uuid.UUID(scenario_agent_id)
            objectives_enabled = parent_scenario_dict.get("objectives_enabled", True)
            images_enabled = False  # Disable image generation for API endpoints
            
            # Ensure department_id is set (required for SQL query)
            if not selected_department_id:
                raise ValueError("department_id is required for scenario problem statement generation")
            
            logger.info(
                f"Generating scenario problem statement with "
                f"department_id={selected_department_id}, agent_id={agent_id_uuid}, persona_id={persona_id}, "
                f"document_ids={doc_ids}, parameter_item_ids={param_ids}"
            )

            # Get all context data in a single optimized query using SQL file
            if not profile_id:
                raise ValueError("profile_id is required for scenario problem statement generation")
            sql = load_sql("sql/v3/agents/get_scenario_run_context.sql")
            context_row = await conn.fetchrow(
                sql,
                selected_department_id,
                persona_id if persona_id else None,
                [str(d) for d in doc_ids] if doc_ids else [],
                [str(p) for p in param_ids] if param_ids else [],
                str(agent_id_uuid),
                str(profile_id),
            )

            if not context_row:
                raise ValueError(
                    f"Agent {agent_id_uuid} not found or not available for department {selected_department_id}"
                )

            # Parse JSON arrays
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

            # Format persona info if persona was provided
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

            # Format document info if documents were provided
            if not doc_ids or len(doc_ids) == 0:
                document_info = None
            else:
                document_info = format_document_info(context["documents"], show_images)

            # Format parameter item info if parameter items were provided
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

                    content = "The following is the parameter item information:\n" + "\n".join(
                        formatted_items
                    )
                    parameter_item_info = {
                        "role": "user",
                        "content": content,
                    }

            final_profile_id: uuid.UUID = profile_id

            # Create scenario generation tools
            group_id = uuid.uuid4()
            scenario_trace_id = gen_trace_id()
            primary_id = str(group_id)

            # Set image generation context before creating tools (async)
            if images_enabled and final_profile_id:
                await set_image_generation_context(
                    agent_id=context["agent_id"],
                    profile_id=str(final_profile_id),
                    primary_id=primary_id,
                    department_id=str(selected_department_id) if selected_department_id else None,
                    room=None,  # API endpoint - no WebSocket room
                )

            # Load agent tools from database
            sql_get_agent_tools = load_sql("sql/v3/agents/get_agent_tools.sql")
            rows = await conn.fetch(sql_get_agent_tools, str(agent_id_uuid))
            agent_tools_config = [dict(row) for row in rows]
            tool_config_map: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            # Create scenario generation tools inline
            scenario_results: dict[str, Any] = {}
            scenario_tools: list[Tool] = []
            
            # 1. Title and Description Tool (always included)
            title_desc_config = tool_config_map.get("set_title_and_description")
            if title_desc_config:
                title_desc = title_desc_config.get("argument_descriptions", {}).get("title", "Short, descriptive title for the scenario (5-10 words)")
                scenario_desc = title_desc_config.get("argument_descriptions", {}).get("scenario", "Scenario description (1-2 sentences) that subtly demonstrates the persona without naming it")
            else:
                title_desc = "Short, descriptive title for the scenario (5-10 words)"
                scenario_desc = "Scenario description (1-2 sentences) that subtly demonstrates the persona without naming it"
            
            async def set_title_description(
                title: str = Field(description=title_desc),
                scenario: str = Field(description=scenario_desc),
            ) -> str:
                """Set the title and description for the scenario."""
                scenario_results["title"] = title
                scenario_results["description"] = scenario
                logger.info(f"✓ Set title: {title}")
                return "Set title and description successfully"
            
            scenario_tools.append(function_tool(set_title_description))
            
            # 2. Objectives Tool (if enabled)
            if objectives_enabled:
                objectives_config = tool_config_map.get("set_objectives")
                if objectives_config:
                    objectives_desc = objectives_config.get("argument_descriptions", {}).get("objectives", "List of 1-3 specific learning objectives that GTAs should achieve in this scenario")
                else:
                    objectives_desc = "List of 1-3 specific learning objectives that GTAs should achieve in this scenario"
                
                async def set_objectives(
                    objectives: list[str] = Field(description=objectives_desc),
                ) -> str:
                    """Set the learning objectives for this scenario."""
                    objectives = objectives[:3]  # Limit to 3
                    scenario_results["objectives"] = objectives
                    logger.info(f"✓ Set {len(objectives)} objectives")
                    return f"Set {len(objectives)} learning objectives successfully"
                
                scenario_tools.append(function_tool(set_objectives))
            
            # 3. Image Generation Tool (if enabled)
            if images_enabled:
                image_config = tool_config_map.get("generate_image")
                if image_config:
                    name_desc = image_config.get("argument_descriptions", {}).get("name", "Descriptive name for the generated image")
                    prompt_desc = image_config.get("argument_descriptions", {}).get("prompt", "Detailed, descriptive prompt for image generation")
                else:
                    name_desc = "Descriptive name for the generated image"
                    prompt_desc = "Detailed, descriptive prompt for image generation"
                
                async def generate_image(
                    name: str = Field(description=name_desc),
                    prompt: str = Field(description=prompt_desc),
                ) -> str:
                    """Generate an image from a detailed prompt."""
                    if "image_requests" not in scenario_results:
                        scenario_results["image_requests"] = {}
                    scenario_results["image_requests"][name] = prompt
                    logger.info(f"✓ Queued image generation: {name}")
                    return f"Image generation queued for '{name}'"
                
                scenario_tools.append(function_tool(generate_image))
            
            scenario_tools.append(debug_info_tool)
            logger.info(f"Created {len(scenario_tools)} scenario tools (including debug_info)")

            # Create tool use behavior
            def tool_use_behavior(
                tool_context: RunContextWrapper[Any],
                tool_results: list[FunctionToolResult],
            ) -> ToolsToFinalOutputResult:
                required_tools = ["title_description"]
                if objectives_enabled:
                    required_tools.append("objectives")
                completed_required = True
                logger.info(
                    f"Tool use check: required={required_tools}, completed={completed_required}"
                )
                return ToolsToFinalOutputResult(is_final_output=completed_required)

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

            # Check rate limit
            req_per_day = context["req_per_day"]
            runs_today_count = context["runs_today_count"]

            if req_per_day is not None and runs_today_count >= req_per_day:
                from datetime import timedelta
                from zoneinfo import ZoneInfo

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

            # Create model run with all junction records using SQL file
            sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
            model_run_row = await conn.fetchrow(
                sql_create_run,
                selected_department_id,
                uuid.UUID(context["model_id"]),
                uuid.UUID(context["agent_id"]),
                "agent",
                final_profile_id,
                None,  # key_id
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

            # Extract results from closure variables
            logger.info("Scenario generation completed successfully")
            logger.info(f"Title: {scenario_results.get('title', 'N/A')}")
            logger.info(f"Description: {scenario_results.get('description', 'N/A')[:100]}...")
            objectives = scenario_results.get("objectives", []) if objectives_enabled else []
            logger.info(f"Objectives: {objectives}")

            usage = result.context_wrapper.usage

            # Update model run with token usage using SQL file
            sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
            await conn.execute(
                sql_update_tokens,
                str(model_run_id),
                usage.input_tokens,
                usage.output_tokens,
            )

            # Get result values
            title = scenario_results.get("title") or ""
            description = scenario_results.get("description") or ""

            logger.info(
                f"Scenario generation completed: title={title}, "
                f"description length={len(description)}, objectives count={len(objectives)}"
            )

            # Retrieve image_ids from image generation results
            generated_image_ids: list[str] = []
            if final_profile_id:
                image_results = await get_image_generation_results(
                    profile_id=str(final_profile_id),
                    primary_id=primary_id,
                )
                image_ids = image_results.get("images", [])
                if image_ids:
                    generated_image_ids = image_ids
                    logger.info(
                        f"Retrieved {len(generated_image_ids)} image IDs "
                        f"(generation in progress in background)"
                    )

            scenario_problem_statement = description
            scenario_title = title
            scenario_objectives = objectives
        else:
            scenario_title = parent_scenario_dict.get("name", "")
            # Get objectives from parent
            sql = load_sql("sql/v3/scenarios/get_scenario_objectives_top_n.sql")
            objectives_data = await conn.fetch(sql, scenario_id, 3)
            scenario_objectives = [obj["objective"] for obj in objectives_data]

        # Create child scenario variant
        sql = load_sql("sql/v3/scenarios/insert_scenario_variant.sql")
        new_scenario_row = await conn.fetchrow(
            sql,
            scenario_title or parent_scenario_dict.get("name", ""),
            True,  # generated = True
            True,  # active = True
            parent_scenario_dict.get("objectives_enabled", True),
            parent_scenario_dict.get(
                "image_enabled", True
            ),  # Use image_enabled, not image_input_enabled
            parent_scenario_dict.get("scenario_agent_id"),  # Required field
            parent_scenario_dict.get("image_agent_id"),  # Required field
        )
        child_scenario_id = new_scenario_row["id"]
        logger.info(
            f"Created child scenario variant {child_scenario_id} for parent {scenario_id}"
        )

        # Insert problem statement
        if scenario_problem_statement:
            sql = load_sql("sql/v3/scenarios/insert_scenario_problem_statement.sql")
            # Ensure we have a valid name - use scenario title if available, otherwise fallback
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
                True,  # active = True
            )
            logger.info(
                f"Created problem statement for child scenario {child_scenario_id}"
            )

        # Insert objectives
        if scenario_objectives and parent_scenario_dict.get("objectives_enabled", True):
            sql = load_sql("sql/v3/scenarios/insert_scenario_objective.sql")
            for idx, objective in enumerate(scenario_objectives[:3]):  # Limit to 3
                await conn.execute(sql, child_scenario_id, idx, objective)
            logger.info(
                f"Inserted {min(len(scenario_objectives), 3)} objectives for child scenario {child_scenario_id}"
            )

        # Create scenario_tree edge
        sql = load_sql("sql/v3/scenarios/insert_scenario_tree_edge.sql")
        await conn.execute(
            sql,
            scenario_id,  # parent
            child_scenario_id,  # child
            True,  # active
        )
        logger.info(
            f"Created scenario_tree edge: parent={scenario_id} -> child={child_scenario_id}"
        )

        # Link selected attributes to child scenario
        # Link persona (only ONE active)
        if persona_id:
            sql = load_sql("sql/v3/scenarios/insert_scenario_persona_link.sql")
            await conn.execute(sql, child_scenario_id, persona_id, True)
            logger.info(
                f"Linked persona {persona_id} to child scenario {child_scenario_id}"
            )

        # Link documents
        if doc_ids:
            sql = load_sql("sql/v3/scenarios/insert_scenario_document_link.sql")
            for doc_id in doc_ids:
                await conn.execute(sql, child_scenario_id, doc_id, True)
            logger.info(
                f"Linked {len(doc_ids)} document(s) to child scenario {child_scenario_id}"
            )

        # Link parameter items
        if param_ids:
            sql = load_sql("sql/v3/scenarios/insert_scenario_parameter_link.sql")
            for param_id in param_ids:
                await conn.execute(sql, child_scenario_id, param_id, True)
            logger.info(
                f"Linked {len(param_ids)} parameter item(s) to child scenario {child_scenario_id}"
            )

        # Link department (only if we have one)
        if selected_department_id:
            sql = load_sql("sql/v3/scenarios/insert_scenario_department_link.sql")
            await conn.execute(sql, child_scenario_id, selected_department_id, True)
            logger.info(
                f"Linked department {selected_department_id} to child scenario {child_scenario_id}"
            )
        else:
            logger.info(
                f"No department to link - child scenario {child_scenario_id} will be cross-department"
            )

    # Combine all parameter item IDs: general + persona + document
    all_param_item_ids = (
        list(param_ids) + list(persona_param_ids) + list(document_param_ids)
    )
    # Remove duplicates while preserving order
    seen = set()
    unique_param_item_ids = []
    for pid in all_param_item_ids:
        if pid not in seen:
            seen.add(pid)
            unique_param_item_ids.append(pid)

    return {
        "department_id": selected_department_id,
        "persona_id": persona_id,
        "persona_ids": scenario_persona_ids,
        "document_ids": doc_ids,
        "parameter_item_ids": unique_param_item_ids,
        "child_scenario_id": child_scenario_id,
    }


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
