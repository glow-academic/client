"""Provider generation handler - routes provider generation through unified generate pipeline."""

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
from app.sql.types import GetProviderApiRequest, GetProviderSqlParams, GetProviderSqlRow
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/providers/get_provider_complete.sql"


class GenerateProviderPayload(GetProviderApiRequest):
    """Request to generate provider resources."""

    agent_type: str | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None


async def _generate_provider_impl(
    sid: str,
    data: GenerateProviderPayload,
    profile_id: uuid.UUID,
) -> None:
    try:
        if not data.resource_types:
            await emit_generation_error(
                sid=sid,
                artifact_type="provider",
                message="resource_types must be provided",
                resource_id=str(data.provider_id) if data.provider_id else None,
                resource_type="provider",
            )
            return

        async with get_db_connection() as conn:
            request_payload = GetProviderApiRequest.model_validate(data.model_dump())
            params = GetProviderSqlParams(
                profile_id=profile_id,
                **request_payload.model_dump(),
            )
            result = cast(
                GetProviderSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            agent_id = pick_agent_id(result, data.agent_type, data.resource_types)
            if not agent_id:
                await emit_generation_error(
                    sid=sid,
                    artifact_type="provider",
                    message="No agent configured for requested resources",
                    resource_id=str(data.provider_id) if data.provider_id else None,
                    group_id=str(extract_group_id(result)) if extract_group_id(result) else None,
                    resource_type=(data.resource_types or ["provider"])[0],
                )
                return

            await emit_generate_artifact(
                conn=conn,
                sid=sid,
                artifact_type="provider",
                resource_id=str(data.provider_id) if data.provider_id else None,
                resource_types=data.resource_types,
                user_instructions=data.user_instructions,
                profile_id=profile_id,
                agent_id=agent_id,
                group_id=extract_group_id(result),
            )

    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="provider",
            message=f"Failed to generate provider: {str(e)}",
            resource_id=str(data.provider_id) if data.provider_id else None,
            resource_type="provider",
        )


@sio.event  # type: ignore
async def provider_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle provider_generate client event."""
    try:
        payload = GenerateProviderPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_generation_error(
                sid=sid,
                artifact_type="provider",
                message="Profile not found. Please reconnect.",
                resource_id=str(payload.provider_id) if payload.provider_id else None,
                resource_type="provider",
            )
            return

        await _generate_provider_impl(sid, payload, uuid.UUID(profile_id_str))
    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="provider",
            message=f"Invalid request: {str(e)}",
            resource_id=str(data.get("provider_id")) if data.get("provider_id") else None,
            resource_type="provider",
        )
