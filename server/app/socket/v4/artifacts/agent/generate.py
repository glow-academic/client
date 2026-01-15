"""Agent page handler - handles prompt/instructions logic, then routes to artifacts/generate.py."""

import uuid
from typing import Any, cast

from app.infra.v4.chat.format_chat_scenario import format_chat_scenario
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_CONTEXT = (
    "app/sql/v4/prompt/get_prompt_run_context_and_create_run_complete.sql"
)
SQL_PATH_MESSAGES = "app/sql/v4/simulations/get_simulation_messages_complete.sql"


class GenerateAgentPayload(BaseModel):
    """Request to generate prompt/instructions."""

    chat_id: str
    group_id: str | None = None


async def _generate_agent_impl(
    sid: str, data: GenerateAgentPayload, profile_id: uuid.UUID
) -> None:
    """Handle prompt/instructions generation - format chat scenario then route to artifacts."""
    try:
        async with get_db_connection() as conn:
            # Get prompt context from SQL
            from app.sql.types import (
                GetPromptRunContextAndCreateRunSqlParams,
                GetPromptRunContextAndCreateRunSqlRow,
                GetSimulationMessagesSqlParams,
                GetSimulationMessagesSqlRow,
            )

            chat_id_uuid = uuid.UUID(data.chat_id)
            group_id_uuid = uuid.UUID(data.group_id) if data.group_id else None

            params = GetPromptRunContextAndCreateRunSqlParams(
                chat_id=chat_id_uuid,
                profile_id=profile_id,
                group_id=group_id_uuid,
            )

            result = cast(
                GetPromptRunContextAndCreateRunSqlRow,
                await execute_sql_typed(conn, SQL_PATH_CONTEXT, params=params),
            )

            if not result:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to get prompt context",
                        resource_id=data.chat_id,
                        group_id=data.group_id,
                        resource_type="prompt",
                    ),
                    sid=sid,
                )
                return

            # Get conversation history
            messages_params = GetSimulationMessagesSqlParams(chat_id=chat_id_uuid)
            messages_result = cast(
                GetSimulationMessagesSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_MESSAGES, params=messages_params
                ),
            )
            conversation_history = (
                messages_result.messages if messages_result.messages else []
            )

            # Step 1: Format chat scenario for context
            scenario_text = format_chat_scenario(result.scenario_id)

            # Build input items for agent
            input_items: list[dict[str, Any]] = []

            # Add system prompt
            system_prompt = str(result.system_prompt) if result.system_prompt else ""
            if system_prompt:
                input_items.append({"role": "system", "content": system_prompt})

            # Add scenario context
            if scenario_text:
                input_items.append({"role": "user", "content": scenario_text})

            # Add conversation history
            for msg in conversation_history:
                input_items.append(msg)

            # Step 2: Route to generate_artifact (which will create run and handle generation)
            # Note: Context should be handled via instructions linked to agent, not developer_message_contents
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "agent_id": result.agent_id,
                    "resource_id": data.chat_id,
                    "resource_type": "prompt",
                    "group_id": data.group_id,  # May be None for new group
                    "user_instructions": None,
                    "message_ids": None,
                },
            )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate prompt: {str(e)}",
                resource_id=data.chat_id,
                group_id=data.group_id,
                resource_type="prompt",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def agent_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle agent_generate event (client-to-server)."""
    try:
        payload = GenerateAgentPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    resource_id=data.get("chat_id"),
                    group_id=data.get("group_id"),
                    resource_type="prompt",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _generate_agent_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                resource_id=data.get("chat_id"),
                group_id=data.get("group_id"),
                resource_type="prompt",
            ),
            sid=sid,
        )


@internal_sio.on("agent_generate")  # type: ignore
async def agent_generate_internal(data: dict[str, Any]) -> None:
    """Handle agent_generate event from internal bus (server-to-server).

    Routes directly to artifacts/generate.py which will create run and handle generation.
    """
    try:
        # Route to artifacts/generate.py which will create run and handle generation
        await internal_sio.emit("generate_artifact", data)
    except Exception as e:
        sid = data.get("sid", "")
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to route agent generation: {str(e)}",
                resource_id=data.get("resource_id"),
                group_id=data.get("group_id"),
                resource_type="prompt",
            ),
            sid=sid,
        )
