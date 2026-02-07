"""Simulation generation router - unified handler for all simulation resource types.

Uses domain-based API: client sends domain_ids, server maps them to
resource_types and agent_id using get_simulation_websocket().
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.simulation.get import get_simulation_websocket
from app.api.v4.artifacts.simulation.types import (
    GetSimulationWebsocketResponse,
    SimulationResourceBucket,
)
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.generation.resource_utils import normalize_resources_for_sql
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.simulation.types import GenerateSimulationPayload
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

CREATE_RUN_SQL_PATH = "app/sql/v4/queries/generate/start/get_generation_run_context_and_create_run_complete.sql"
TEXT_RUN_CONTEXT_SQL_PATH = "app/sql/v4/queries/generate/text/get_text_run_context_for_existing_run_complete.sql"

# Simulation resource types
SIMULATION_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "departments",
    "flags",
    "scenarios",
    "scenario_flags",
    "scenario_positions",
    "scenario_rubrics",
    "scenario_time_limits",
]


def _serialize_resource_item(item: Any) -> Any:
    if item is None:
        return None
    if hasattr(item, "model_dump"):
        return item.model_dump()
    if hasattr(item, "_asdict"):
        return dict(item._asdict())
    if hasattr(item, "dict"):
        return item.dict()
    if isinstance(item, dict):
        return item
    return item


def _serialize_resource_list(items: list[Any] | None) -> list[Any]:
    if not items:
        return []
    return [
        serialized
        for item in items
        if (serialized := _serialize_resource_item(item)) is not None
    ]


def _build_simulation_jinja_context(
    response: GetSimulationWebsocketResponse, resource_types: list[str]
) -> dict[str, Any]:
    """Build Jinja context from simulation websocket response."""
    if response.resources and response.resources.resources:
        resources = response.resources.resources.model_dump()
        current = (
            response.resources.current.model_dump()
            if response.resources.current
            else SimulationResourceBucket().model_dump()
        )
        resources["current"] = current
        return resources
    return {"current": SimulationResourceBucket().model_dump()}


async def _simulation_generate_impl(
    sid: str, data: GenerateSimulationPayload, profile_id: uuid.UUID
) -> None:
    """Handle simulation generation with domain-based API.

    This function:
    1. Validates domain_ids and derives resource_types + agent_id
    2. Fetches simulation data via get_simulation_websocket() for context
    3. Creates generation run via generic SQL
    4. Renders developer instructions with Jinja
    5. Emits payload to generate_artifact handler
    """
    try:
        # Validate domain_ids
        if not data.domain_ids:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="domain_ids must be provided",
                    artifact_type="simulation",
                    group_id=None,
                    resource_type="simulation",
                ),
                sid=sid,
            )
            return

        # Step 1: Fetch simulation data for domain mapping and context
        result = await get_simulation_websocket(
            profile_id=profile_id,
            simulation_id=data.simulation_id,
            draft_id=data.draft_id,
        )

        # Build domain_id -> agent_id mapping from result.domains
        domain_to_agent: dict[uuid.UUID, uuid.UUID | None] = {}
        if result.domains:
            for domain in result.domains:
                domain_to_agent[domain.domain_id] = domain.agent_id

        # Build domain_id -> resource_type mapping from result
        domain_to_resource: dict[uuid.UUID | None, str] = {
            result.name_domain_id: "names",
            result.description_domain_id: "descriptions",
            result.flag_domain_id: "flags",
            result.departments_domain_id: "departments",
            result.scenarios_domain_id: "scenarios",
            result.scenario_flags_domain_id: "scenario_flags",
            result.scenario_personas_domain_id: "scenario_personas",
            result.scenario_positions_domain_id: "scenario_positions",
            result.scenario_rubrics_domain_id: "scenario_rubrics",
            result.scenario_time_limits_domain_id: "scenario_time_limits",
        }
        # Remove None key if present
        domain_to_resource.pop(None, None)

        # Derive resource_types from domain_ids
        resource_types: list[str] = []
        for did in data.domain_ids:
            if did in domain_to_resource:
                resource_types.append(domain_to_resource[did])

        if not resource_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No valid domain_ids provided",
                    artifact_type="simulation",
                    group_id=None,
                    resource_type="simulation",
                ),
                sid=sid,
            )
            return

        invalid_types = [
            rt for rt in resource_types if rt not in SIMULATION_RESOURCE_TYPES
        ]
        if invalid_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="simulation",
                    group_id=None,
                    resource_type="simulation",
                ),
                sid=sid,
            )
            return

        # Get agent_id from the first valid domain_id
        agent_id: uuid.UUID | None = None
        for did in data.domain_ids:
            if did in domain_to_agent and domain_to_agent[did] is not None:
                agent_id = domain_to_agent[did]
                break

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for the requested domains",
                    artifact_type="simulation",
                    group_id=None,
                    resource_type="simulation",
                ),
                sid=sid,
            )
            return

        # Build Jinja context from resources
        simulation_jinja_context = _build_simulation_jinja_context(
            result, resource_types
        )

        # Step 2: Build resources array from websocket response
        resources: list[dict[str, Any]] = []
        resources_bucket = result.resources.resources if result.resources else None

        if resources_bucket:
            if resources_bucket.names:
                resources.append(
                    {
                        "resource_type": "names",
                        "resource_ids": [
                            str(n.id) for n in resources_bucket.names if n.id
                        ],
                    }
                )
            if resources_bucket.descriptions:
                resources.append(
                    {
                        "resource_type": "descriptions",
                        "resource_ids": [
                            str(d.id) for d in resources_bucket.descriptions if d.id
                        ],
                    }
                )
            if resources_bucket.departments:
                dept_ids = []
                for d in resources_bucket.departments:
                    did = getattr(d, "department_id", None)
                    if did:
                        dept_ids.append(str(did))
                if dept_ids:
                    resources.append(
                        {
                            "resource_type": "departments",
                            "resource_ids": dept_ids,
                        }
                    )
            if resources_bucket.flags:
                resources.append(
                    {
                        "resource_type": "flags",
                        "resource_ids": [
                            str(f.flag_option_id)
                            for f in resources_bucket.flags
                            if f.flag_option_id
                        ],
                    }
                )
            if resources_bucket.scenarios:
                resources.append(
                    {
                        "resource_type": "scenarios",
                        "resource_ids": [
                            str(s.scenario_id)
                            for s in resources_bucket.scenarios
                            if s.scenario_id
                        ],
                    }
                )
            if resources_bucket.scenario_flags:
                ids = [
                    str(getattr(sf, "id", None) or "")
                    for sf in resources_bucket.scenario_flags
                    if getattr(sf, "id", None)
                ]
                if ids:
                    resources.append(
                        {"resource_type": "scenario_flags", "resource_ids": ids}
                    )
            if resources_bucket.scenario_positions:
                ids = [
                    str(getattr(sp, "id", None) or "")
                    for sp in resources_bucket.scenario_positions
                    if getattr(sp, "id", None)
                ]
                if ids:
                    resources.append(
                        {"resource_type": "scenario_positions", "resource_ids": ids}
                    )
            if resources_bucket.scenario_rubrics:
                ids = [
                    str(getattr(sr, "id", None) or "")
                    for sr in resources_bucket.scenario_rubrics
                    if getattr(sr, "id", None)
                ]
                if ids:
                    resources.append(
                        {"resource_type": "scenario_rubrics", "resource_ids": ids}
                    )
            if resources_bucket.scenario_time_limits:
                ids = [
                    str(getattr(stl, "id", None) or "")
                    for stl in resources_bucket.scenario_time_limits
                    if getattr(stl, "id", None)
                ]
                if ids:
                    resources.append(
                        {"resource_type": "scenario_time_limits", "resource_ids": ids}
                    )

        # Get group_id from response
        group_id: uuid.UUID | None = result.group_id

        resources_sql = normalize_resources_for_sql(resources)

        # Step 3: Create generation run
        async with get_db_connection() as conn:
            create_run_sql = load_sql(CREATE_RUN_SQL_PATH)
            create_run_row = await conn.fetchrow(
                create_run_sql,
                agent_id,
                profile_id,
                None,
                None,
                group_id,
                None,
                data.user_instructions if data.user_instructions else None,
                resources_sql,
            )

            if not create_run_row:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to create generation run",
                        artifact_type="simulation",
                        group_id=str(group_id) if group_id else None,
                        resource_type="simulation",
                    ),
                    sid=sid,
                )
                return

            run_id = str(create_run_row["run_id"])
            group_id = (
                create_run_row["group_id"] if create_run_row["group_id"] else group_id
            )
            trace_id = create_run_row.get("trace_id")
            message_ids = create_run_row.get("message_ids")

            run_context_sql = load_sql(TEXT_RUN_CONTEXT_SQL_PATH)
            run_context_row = await conn.fetchrow(
                run_context_sql,
                uuid.UUID(run_id),
                agent_id,
                message_ids,
                group_id,
                resources_sql,
            )

            if not run_context_row:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to load generation context",
                        artifact_type="simulation",
                        group_id=str(group_id) if group_id else None,
                        resource_type="simulation",
                    ),
                    sid=sid,
                )
                return

            # Step 4: Render developer instructions with Jinja context
            rendered_developer_messages = render_developer_instructions(
                templates=run_context_row.get("developer_instruction_templates"),
                jinja_context=simulation_jinja_context,
            )

            messages: list[dict[str, Any]] = []
            if run_context_row.get("system_prompt"):
                messages.append(
                    {"role": "system", "content": run_context_row["system_prompt"]}
                )
            for dev_msg in rendered_developer_messages:
                messages.append({"role": "developer", "content": dev_msg})
            for user_msg in data.user_instructions or []:
                messages.append({"role": "user", "content": user_msg})

            # Step 5: Emit to generate_artifact handler
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "simulation",
                    "resource_type": resource_types[0]
                    if resource_types
                    else "simulation",
                    "run_id": run_id,
                    "group_id": str(group_id) if group_id else None,
                    "message_id": None,
                    "messages": messages,
                    "llm_config": {
                        "model": run_context_row.get("model_name"),
                        "api_key": run_context_row.get("api_key"),
                        "base_url": run_context_row.get("base_url"),
                        "temperature": run_context_row.get("temperature"),
                        "reasoning": run_context_row.get("reasoning"),
                        "provider": run_context_row.get("provider"),
                        "voice": None,
                        "quality": None,
                        "length_seconds": None,
                    },
                    "tools": convert_tools_to_dict(run_context_row.get("tools")),
                    "metadata": {"trace_id": trace_id},
                    "eval_mode": False,
                },
            )

    except Exception as e:
        logger.exception(f"Failed to generate simulation resources: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate simulation resources: {str(e)}",
                artifact_type="simulation",
                group_id=None,
                resource_type="simulation",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def simulation_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle simulation_generate event (client-to-server)."""
    try:
        payload = GenerateSimulationPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="simulation",
                    group_id=None,
                    resource_type="simulation",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _simulation_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="simulation",
                group_id=None,
                resource_type="simulation",
            ),
            sid=sid,
        )


@internal_sio.on("simulation_generate")  # type: ignore
async def simulation_generate_internal(data: dict[str, Any]) -> None:
    """Handle simulation_generate event from internal bus (server-to-server)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="simulation",
                    group_id=None,
                    resource_type="simulation",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateSimulationPayload(**data)
        await _simulation_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="simulation",
                group_id=None,
                resource_type="simulation",
            ),
            sid=sid,
        )
