"""Parameter generation handler - routes parameter generation through unified generate pipeline."""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.generation_common import (
    emit_generate_artifact,
    emit_generation_error,
    extract_group_id,
    pick_agent_id,
)
from app.sql.types import (
    GetParameterApiRequest,
    GetParameterSqlParams,
    GetParameterSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/parameters/get_parameter_complete.sql"


class GenerateParameterPayload(GetParameterApiRequest):
    """Request to generate parameter resources."""

    agent_type: str | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None


async def _generate_parameter_impl(
    sid: str,
    data: GenerateParameterPayload,
    profile_id: uuid.UUID,
) -> None:
    try:
        if not data.resource_types:
            await emit_generation_error(
                sid=sid,
                artifact_type="parameter",
                message="resource_types must be provided",
                resource_id=str(data.parameter_id) if data.parameter_id else None,
                resource_type="parameter",
            )
            return

        async with get_db_connection() as conn:
            request_payload = GetParameterApiRequest.model_validate(data.model_dump())
            params = GetParameterSqlParams(
                profile_id=profile_id,
                **request_payload.model_dump(),
            )
            result = cast(
                GetParameterSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            agent_id = pick_agent_id(result, data.agent_type, data.resource_types)
            if not agent_id:
                await emit_generation_error(
                    sid=sid,
                    artifact_type="parameter",
                    message="No agent configured for requested resources",
                    resource_id=str(data.parameter_id) if data.parameter_id else None,
                    group_id=str(extract_group_id(result))
                    if extract_group_id(result)
                    else None,
                    resource_type=(data.resource_types or ["parameter"])[0],
                )
                return

            await emit_generate_artifact(
                conn=conn,
                sid=sid,
                artifact_type="parameter",
                resource_id=str(data.parameter_id) if data.parameter_id else None,
                resource_types=data.resource_types,
                user_instructions=data.user_instructions,
                profile_id=profile_id,
                agent_id=agent_id,
                group_id=extract_group_id(result),
            )

    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="parameter",
            message=f"Failed to generate parameter: {str(e)}",
            resource_id=str(data.parameter_id) if data.parameter_id else None,
            resource_type="parameter",
        )


@sio.event  # type: ignore
async def parameter_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle parameter_generate client event."""
    try:
        payload = GenerateParameterPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_generation_error(
                sid=sid,
                artifact_type="parameter",
                message="Profile not found. Please reconnect.",
                resource_id=str(payload.parameter_id) if payload.parameter_id else None,
                resource_type="parameter",
            )
            return

        await _generate_parameter_impl(sid, payload, uuid.UUID(profile_id_str))
    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="parameter",
            message=f"Invalid request: {str(e)}",
            resource_id=str(data.get("parameter_id"))
            if data.get("parameter_id")
            else None,
            resource_type="parameter",
        )
