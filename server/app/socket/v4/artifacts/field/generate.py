"""Field generation handler - routes field generation through unified generate pipeline."""

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
from app.sql.types import GetFieldApiRequest, GetFieldSqlParams, GetFieldSqlRow
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/fields/get_field_complete.sql"


class GenerateFieldPayload(GetFieldApiRequest):
    """Request to generate field resources."""

    agent_type: str | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None


async def _generate_field_impl(
    sid: str,
    data: GenerateFieldPayload,
    profile_id: uuid.UUID,
) -> None:
    try:
        if not data.resource_types:
            await emit_generation_error(
                sid=sid,
                artifact_type="field",
                message="resource_types must be provided",
                resource_id=str(data.field_id) if data.field_id else None,
                resource_type="field",
            )
            return

        async with get_db_connection() as conn:
            request_payload = GetFieldApiRequest.model_validate(data.model_dump())
            params = GetFieldSqlParams(
                profile_id=profile_id,
                **request_payload.model_dump(),
            )
            result = cast(
                GetFieldSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            agent_id = pick_agent_id(result, data.agent_type, data.resource_types)
            if not agent_id:
                await emit_generation_error(
                    sid=sid,
                    artifact_type="field",
                    message="No agent configured for requested resources",
                    resource_id=str(data.field_id) if data.field_id else None,
                    group_id=str(extract_group_id(result))
                    if extract_group_id(result)
                    else None,
                    resource_type=(data.resource_types or ["field"])[0],
                )
                return

            await emit_generate_artifact(
                conn=conn,
                sid=sid,
                artifact_type="field",
                resource_id=str(data.field_id) if data.field_id else None,
                resource_types=data.resource_types,
                user_instructions=data.user_instructions,
                profile_id=profile_id,
                agent_id=agent_id,
                group_id=extract_group_id(result),
            )

    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="field",
            message=f"Failed to generate field: {str(e)}",
            resource_id=str(data.field_id) if data.field_id else None,
            resource_type="field",
        )


@sio.event  # type: ignore
async def field_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle field_generate client event."""
    try:
        payload = GenerateFieldPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_generation_error(
                sid=sid,
                artifact_type="field",
                message="Profile not found. Please reconnect.",
                resource_id=str(payload.field_id) if payload.field_id else None,
                resource_type="field",
            )
            return

        await _generate_field_impl(sid, payload, uuid.UUID(profile_id_str))
    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="field",
            message=f"Invalid request: {str(e)}",
            resource_id=str(data.get("field_id")) if data.get("field_id") else None,
            resource_type="field",
        )
