"""Model generation handler - routes model generation through unified generate pipeline."""

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
from app.sql.types import GetModelApiRequest, GetModelSqlParams, GetModelSqlRow
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/models/get_model_complete.sql"


class GenerateModelPayload(GetModelApiRequest):
    """Request to generate model resources."""

    agent_type: str | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None


async def _generate_model_impl(
    sid: str,
    data: GenerateModelPayload,
    profile_id: uuid.UUID,
) -> None:
    try:
        if not data.resource_types:
            await emit_generation_error(
                sid=sid,
                artifact_type="model",
                message="resource_types must be provided",
                resource_id=str(data.model_id) if data.model_id else None,
                resource_type="model",
            )
            return

        async with get_db_connection() as conn:
            request_payload = GetModelApiRequest.model_validate(data.model_dump())
            params = GetModelSqlParams(
                profile_id=profile_id,
                **request_payload.model_dump(),
            )
            result = cast(
                GetModelSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            agent_id = pick_agent_id(result, data.agent_type, data.resource_types)
            if not agent_id:
                await emit_generation_error(
                    sid=sid,
                    artifact_type="model",
                    message="No agent configured for requested resources",
                    resource_id=str(data.model_id) if data.model_id else None,
                    group_id=str(extract_group_id(result))
                    if extract_group_id(result)
                    else None,
                    resource_type=(data.resource_types or ["model"])[0],
                )
                return

            await emit_generate_artifact(
                conn=conn,
                sid=sid,
                artifact_type="model",
                resource_id=str(data.model_id) if data.model_id else None,
                resource_types=data.resource_types,
                user_instructions=data.user_instructions,
                profile_id=profile_id,
                agent_id=agent_id,
                group_id=extract_group_id(result),
            )

    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="model",
            message=f"Failed to generate model: {str(e)}",
            resource_id=str(data.model_id) if data.model_id else None,
            resource_type="model",
        )


@sio.event  # type: ignore
async def model_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle model_generate client event."""
    try:
        payload = GenerateModelPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_generation_error(
                sid=sid,
                artifact_type="model",
                message="Profile not found. Please reconnect.",
                resource_id=str(payload.model_id) if payload.model_id else None,
                resource_type="model",
            )
            return

        await _generate_model_impl(sid, payload, uuid.UUID(profile_id_str))
    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="model",
            message=f"Invalid request: {str(e)}",
            resource_id=str(data.get("model_id")) if data.get("model_id") else None,
            resource_type="model",
        )
