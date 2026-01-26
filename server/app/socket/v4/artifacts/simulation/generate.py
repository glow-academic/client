"""Simulation generation router - unified handler for all simulation resource types."""

import uuid
from typing import Any, cast

from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.generation.resource_utils import normalize_resources_for_sql
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (GetSimulationApiRequest, GetSimulationSqlParams,
                           GetSimulationSqlRow)
from fastapi import APIRouter
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/simulations/get_simulation_complete.sql"
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


class GenerateSimulationPayload(GetSimulationApiRequest):
    """Request to generate simulation resources - extends GET API request with generation-specific fields."""

    agent_type: str | None = None  # Optional: "name", "description", "departments", "flags", "scenarios", "general"/"all"
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions


async def _simulation_generate_impl(
    sid: str, data: GenerateSimulationPayload, profile_id: uuid.UUID
) -> None:
    """Handle simulation generation - emit generate_artifact for each resource type, then emit client event."""
    try:
        # Validate resource types
        resource_types = data.resource_types
        if not resource_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="resource_types must be provided",
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

        # Map agent_type to agent_id from response (will be done after fetching simulation data)

        # Call get_simulation_v4 SQL function (same as GET API endpoint)
        async with get_db_connection() as conn:
            # Convert payload to SQL params (same as GET endpoint)
            params = GetSimulationSqlParams(
                profile_id=profile_id,
                simulation_id=data.simulation_id,
                draft_id=data.draft_id,
                scenario_search=data.scenario_search,
                scenario_show_selected=data.scenario_show_selected,
                filter_scenario_ids=data.filter_scenario_ids,
                mcp=getattr(data, "mcp", False) or False,
            )

            result = cast(
                GetSimulationSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Map agent_type to agent_id from response
            agent_id: uuid.UUID | None = None
            if data.agent_type:
                agent_type_map = {
                    "name": result.name_agent_id,
                    "description": result.description_agent_id,
                    "departments": result.departments_agent_id,
                    "flags": result.flag_agent_id,
                    "scenarios": result.scenarios_agent_id,
                    "scenario_flags": result.scenario_flags_agent_id,
                    "scenario_positions": result.scenario_positions_agent_id,
                    "scenario_rubrics": result.scenario_rubrics_agent_id,
                    "scenario_time_limits": result.scenario_time_limits_agent_id,
                    "general": result.general_agent_id,
                    "all": result.general_agent_id,
                }
                agent_id = agent_type_map.get(data.agent_type)

            if not agent_id:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"No agent found for agent_type: {data.agent_type}",
                        artifact_type="simulation",
                        group_id=None,
                        resource_type="simulation",
                    ),
                    sid=sid,
                )
                return

            # Extract resource IDs from arrays and build resources array (composite type format)
            resources: list[dict[str, Any]] = []

            # Extract IDs from each resource array
            if result.names:
                resources.append({
                    "resource_type": "names",
                    "resource_ids": [str(n.id) for n in result.names if n.id]
                })
            if result.descriptions:
                resources.append({
                    "resource_type": "descriptions",
                    "resource_ids": [str(d.id) for d in result.descriptions if d.id]
                })
            if result.departments:
                resources.append({
                    "resource_type": "departments",
                    "resource_ids": [str(d.department_id) for d in result.departments if d.department_id]
                })
            if result.flags:
                resources.append({
                    "resource_type": "flags",
                    "resource_ids": [str(f.id) for f in result.flags if f.id]
                })
            if result.scenarios:
                resources.append({
                    "resource_type": "scenarios",
                    "resource_ids": [str(s.id) for s in result.scenarios if s.id]
                })
            if result.scenario_flags:
                resources.append({
                    "resource_type": "scenario_flags",
                    "resource_ids": [str(sf.id) for sf in result.scenario_flags if sf.id]
                })
            if result.scenario_positions:
                # scenario_positions uses composite key (simulation_id, scenario_id)
                # Format as "simulation_id-scenario_id" strings
                resources.append({
                    "resource_type": "scenario_positions",
                    "resource_ids": [
                        f"{sp.simulation_id}-{sp.scenario_id}" 
                        for sp in result.scenario_positions 
                        if sp.simulation_id and sp.scenario_id
                    ]
                })
            if result.scenario_rubrics:
                resources.append({
                    "resource_type": "scenario_rubrics",
                    "resource_ids": [str(sr.id) for sr in result.scenario_rubrics if sr.id]
                })
            if result.scenario_time_limits:
                resources.append({
                    "resource_type": "scenario_time_limits",
                    "resource_ids": [str(stl.id) for stl in result.scenario_time_limits if stl.id]
                })

            # Get group_id from response if available
            group_id: uuid.UUID | None = result.group_id

            resources_sql = normalize_resources_for_sql(resources)

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

            rendered_developer_messages = render_developer_instructions(
                templates=run_context_row.get("developer_instruction_templates"),
                jinja_context=run_context_row.get("context"),
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

            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "simulation",
                    "resource_type": resource_types[0] if resource_types else "simulation",
                    "run_id": run_id,
                    "group_id": str(group_id) if group_id else None,
                    "message_id": None,
                    "messages": messages,
                    "model_config": {
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
