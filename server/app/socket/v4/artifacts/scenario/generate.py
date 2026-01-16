"""Scenario generation router - unified handler for all scenario resource types."""

import json
import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.sql.types import (GetScenarioApiRequest, GetScenarioSqlParams,
                           GetScenarioSqlRow)
from fastapi import APIRouter
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/scenarios/get_scenario_complete.sql"

# Scenario resource types
SCENARIO_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "problem_statements",
    "objectives",
    "ranges",
    "scenario_flags",
    "images",
    "videos",
    "questions",
    "departments",
    "fields",
    "personas",
    "documents",
    "parameters",
]


class GenerateScenarioPayload(GetScenarioApiRequest):
    """Request to generate scenario resources - extends GET API request with generation-specific fields."""

    agent_type: str | None = None  # Optional: "name", "description", "basic", "content", "general"/"all"
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions


async def _scenario_generate_impl(
    sid: str, data: GenerateScenarioPayload, profile_id: uuid.UUID
) -> None:
    """Handle scenario generation - emit generate_artifact for each resource type, then emit client event."""
    try:
        # Validate resource types
        resource_types = data.resource_types
        if not resource_types:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="resource_types must be provided",
                    artifact_type="scenario",
                    group_id=None,
                    resource_type="scenario",
                ),
                sid=sid,
            )
            return

        invalid_types = [
            rt for rt in resource_types if rt not in SCENARIO_RESOURCE_TYPES
        ]
        if invalid_types:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="scenario",
                    group_id=None,
                    resource_type="scenario",
                ),
                sid=sid,
            )
            return

        # Map agent_type to agent_id from response (will be done after fetching scenario data)

        # Call get_scenario_v4 SQL function (same as GET API endpoint)
        async with get_db_connection() as conn:
            # Convert payload to SQL params (same as GET endpoint)
            params = GetScenarioSqlParams(
                profile_id=profile_id,
                scenario_id=data.scenario_id,
                use_image=data.use_image,
                use_objectives=data.use_objectives,
                document_ids=data.document_ids,
                problem_statement_ids=data.problem_statement_ids,
                template_document_ids=data.template_document_ids,
                use_video=data.use_video,
                filter_department_ids=data.filter_department_ids,
                filter_persona_ids=data.filter_persona_ids,
                filter_document_ids=data.filter_document_ids,
                filter_parameter_ids=data.filter_parameter_ids,
                filter_field_ids=data.filter_field_ids,
                persona_search=data.persona_search,
                document_search=data.document_search,
                parameter_search=data.parameter_search,
                persona_show_selected=data.persona_show_selected,
                document_show_selected=data.document_show_selected,
                parameter_show_selected=data.parameter_show_selected,
                field_show_selected_by_param=data.field_show_selected_by_param,
                draft_id=data.draft_id,
                mcp=getattr(data, "mcp", False) or False,
            )

            result = cast(
                GetScenarioSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Map agent_type to agent_id from response
            agent_id: uuid.UUID | None = None
            if data.agent_type:
                agent_type_map = {
                    "name": result.name_agent_id,
                    "description": result.description_agent_id,
                    "basic": result.basic_agent_id,
                    "content": result.content_agent_id,
                    "general": result.general_agent_id,
                    "all": result.general_agent_id,
                }
                agent_id = agent_type_map.get(data.agent_type)

            if not agent_id:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"No agent found for agent_type: {data.agent_type}",
                        artifact_type="scenario",
                        group_id=None,
                        resource_type="scenario",
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
            if result.problem_statements:
                resources.append({
                    "resource_type": "problem_statements",
                    "resource_ids": [str(ps.id) for ps in result.problem_statements if ps.id]
                })
            if result.objectives:
                resources.append({
                    "resource_type": "objectives",
                    "resource_ids": [str(o.id) for o in result.objectives if o.id]
                })
            if result.persona_ranges:
                resources.append({
                    "resource_type": "ranges",
                    "resource_ids": [str(r.id) for r in result.persona_ranges if r.id]
                })
            if result.document_ranges:
                resources.append({
                    "resource_type": "ranges",
                    "resource_ids": [str(r.id) for r in result.document_ranges if r.id]
                })
            if result.parameter_ranges:
                resources.append({
                    "resource_type": "ranges",
                    "resource_ids": [str(r.id) for r in result.parameter_ranges if r.id]
                })
            if result.field_ranges:
                resources.append({
                    "resource_type": "ranges",
                    "resource_ids": [str(r.id) for r in result.field_ranges if r.id]
                })
            if result.departments:
                resources.append({
                    "resource_type": "departments",
                    "resource_ids": [str(d.department_id) for d in result.departments if d.department_id]
                })
            if result.fields:
                resources.append({
                    "resource_type": "fields",
                    "resource_ids": [str(f.field_id) for f in result.fields if f.field_id]
                })
            if result.personas:
                resources.append({
                    "resource_type": "personas",
                    "resource_ids": [str(p.persona_id) for p in result.personas if p.persona_id]
                })
            if result.documents:
                resources.append({
                    "resource_type": "documents",
                    "resource_ids": [str(d.document_id) for d in result.documents if d.document_id]
                })
            if result.parameters:
                resources.append({
                    "resource_type": "parameters",
                    "resource_ids": [str(p.parameter_id) for p in result.parameters if p.parameter_id]
                })
            if result.images:
                resources.append({
                    "resource_type": "images",
                    "resource_ids": [str(i.id) for i in result.images if i.id]
                })
            if result.videos:
                resources.append({
                    "resource_type": "videos",
                    "resource_ids": [str(v.id) for v in result.videos if v.id]
                })
            if result.questions:
                resources.append({
                    "resource_type": "questions",
                    "resource_ids": [str(q.id) for q in result.questions if q.id]
                })

            # Get group_id from response if available
            group_id: uuid.UUID | None = result.group_id

            # Emit single generate_artifact event with all resource types
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "scenario",
                    "agent_id": str(agent_id),  # Use agent_id from mapping
                    "resource_types": resource_types,  # Pass all resource types at once
                    "group_id": str(group_id) if group_id else None,
                    "resources": resources,  # Pass resources array
                    "user_instructions": data.user_instructions
                    if data.user_instructions
                    else None,
                },
            )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate scenario resources: {str(e)}",
                artifact_type="scenario",
                group_id=None,
                resource_type="scenario",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def scenario_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle scenario_generate event (client-to-server)."""
    try:
        payload = GenerateScenarioPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="scenario",
                    group_id=None,
                    resource_type="scenario",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _scenario_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="scenario",
                group_id=None,
                resource_type="scenario",
            ),
            sid=sid,
        )


@internal_sio.on("scenario_generate")  # type: ignore
async def scenario_generate_internal(data: dict[str, Any]) -> None:
    """Handle scenario_generate event from internal bus (server-to-server)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="scenario",
                    group_id=None,
                    resource_type="scenario",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateScenarioPayload(**data)
        await _scenario_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="scenario",
                group_id=None,
                resource_type="scenario",
            ),
            sid=sid,
        )
