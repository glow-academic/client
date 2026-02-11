"""Setting generation handler - routes setting generation through unified generate pipeline."""

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
)
from app.sql.types import GetSettingApiRequest, GetSettingSqlParams, GetSettingSqlRow
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/settings/get_setting_complete.sql"


class GenerateSettingPayload(GetSettingApiRequest):
    """Request to generate setting resources."""

    resource_types: list[str]
    user_instructions: list[str] | None = None


async def _generate_setting_impl(
    sid: str,
    data: GenerateSettingPayload,
    profile_id: uuid.UUID,
) -> None:
    try:
        if not data.resource_types:
            await emit_generation_error(
                sid=sid,
                artifact_type="setting",
                message="resource_types must be provided",
                resource_id=str(data.setting_id) if data.setting_id else None,
                resource_type="setting",
            )
            return

        async with get_db_connection() as conn:
            request_payload = GetSettingApiRequest.model_validate(data.model_dump())
            params = GetSettingSqlParams(
                profile_id=profile_id,
                **request_payload.model_dump(),
            )
            result = cast(
                GetSettingSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            resource_agent_ids: dict[str, uuid.UUID | None] = {
                "names": result.name_agent_id,
                "descriptions": result.description_agent_id,
                "colors": result.colors_agent_id,
                "flags": result.flag_agent_id,
                "departments": result.departments_agent_id,
                "profiles": result.profiles_agent_id,
                "auths": result.auths_agent_id,
                "auth_item_keys": result.keys_agent_id,
            }
            agent_id = next(
                (
                    resource_agent_ids.get(rt)
                    for rt in data.resource_types
                    if rt in resource_agent_ids and resource_agent_ids.get(rt)
                ),
                None,
            )
            if not agent_id:
                await emit_generation_error(
                    sid=sid,
                    artifact_type="setting",
                    message="No agent configured for requested resources",
                    resource_id=str(data.setting_id) if data.setting_id else None,
                    group_id=str(extract_group_id(result))
                    if extract_group_id(result)
                    else None,
                    resource_type=(data.resource_types or ["setting"])[0],
                )
                return

            await emit_generate_artifact(
                conn=conn,
                sid=sid,
                artifact_type="setting",
                resource_id=str(data.setting_id) if data.setting_id else None,
                resource_types=data.resource_types,
                user_instructions=data.user_instructions,
                profile_id=profile_id,
                agent_id=agent_id,
                group_id=extract_group_id(result),
            )

    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="setting",
            message=f"Failed to generate setting: {str(e)}",
            resource_id=str(data.setting_id) if data.setting_id else None,
            resource_type="setting",
        )


@sio.event  # type: ignore
async def setting_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle setting_generate client event."""
    try:
        payload = GenerateSettingPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_generation_error(
                sid=sid,
                artifact_type="setting",
                message="Profile not found. Please reconnect.",
                resource_id=str(payload.setting_id) if payload.setting_id else None,
                resource_type="setting",
            )
            return

        await _generate_setting_impl(sid, payload, uuid.UUID(profile_id_str))
    except Exception as e:
        await emit_generation_error(
            sid=sid,
            artifact_type="setting",
            message=f"Invalid request: {str(e)}",
            resource_id=str(data.get("setting_id")) if data.get("setting_id") else None,
            resource_type="setting",
        )
