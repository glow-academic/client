"""Handler for member_generate WebSocket event - generates student responses."""

import uuid
from typing import Any, cast

from agents import Runner, trace
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.sql_helper import execute_sql_typed, load_sql

from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.chat.format_chat_scenario import format_chat_scenario
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.documents.format_document_info import format_document_info
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.socket.v4.agents.simulation.generate import (
    get_simulation_conversation_history,
)
from app.main import get_internal_sio, sio
from app.sql.types import (
    GetMemberRunContextAndCreateRunSqlParams,
    GetMemberRunContextAndCreateRunSqlRow,
    GetSimulationMessagesSqlParams,
    GetSimulationMessagesSqlRow,
)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_CONTEXT = (
    "app/sql/v4/member/get_member_run_context_and_create_run_complete.sql"
)
SQL_PATH_MESSAGES = "app/sql/v4/simulations/get_simulation_messages_complete.sql"


# Pydantic models
class MemberGeneratePayload(BaseModel):
    """Request to generate member agent response."""

    chat_id: str
    group_id: str | None = None


class MemberGenerateErrorPayload(BaseModel):
    """Response indicating an error occurred in member generation."""

    success: bool
    message: str


# Emit helper functions
async def member_generate_error(payload: MemberGenerateErrorPayload, room: str) -> None:
    await sio.emit("member_generate_error", payload.model_dump(), room=room)


async def _member_generate_impl(
    sid: str,
    data: MemberGeneratePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle member_generate internal event - runs agent and emits to progress/complete."""
    try:
        chat_id_uuid = uuid.UUID(data.chat_id)
        chat_id_str = str(chat_id_uuid)

        async with get_db_connection() as conn:
            # Get all context data AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            try:
                params = GetMemberRunContextAndCreateRunSqlParams(
                    chat_id=chat_id_uuid,
                    profile_id=profile_id,
                    group_id=group_id,
                )
                result = cast(
                    GetMemberRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH_CONTEXT, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                # Check if it's a rate limit error from SQL (PostgreSQL exception)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    # Extract the user-friendly message (everything after "RATE_LIMIT_EXCEEDED: ")
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await internal_sio.emit(
                        "member_generate_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": user_msg,
                        },
                    )
                    return
                await internal_sio.emit(
                    "member_generate_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Failed to initialize member generation: {str(e)}",
                    },
                )
                return

            if not result:
                await internal_sio.emit(
                    "member_generate_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"No member agent configured for chat {data.chat_id}",
                    },
                )
                return

            # Get department_id
            department_id_str = result.department_id
            if not department_id_str:
                await internal_sio.emit(
                    "member_generate_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "No active departments found in system",
                    },
                )
                return

            department_id = uuid.UUID(str(department_id_str))

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)
            group_id_from_result = result.group_id
            trace_id = result.trace_id

            # Build context dict from result
            context = {
                "chat_id": result.chat_id,
                "chat_title": result.chat_title,
                "trace_id": result.trace_id,
                "attempt_id": result.attempt_id,
                "simulation_id": result.simulation_id,
                "scenario_id": result.scenario_id,
                "department_id": result.department_id,
                "problem_statement": result.problem_statement,
                "persona_id": result.persona_id,
                "persona_name": result.persona_name,
                "system_prompt": result.system_prompt,
                "temperature": float(result.temperature)
                if result.temperature is not None
                else 0.0,
                "reasoning": result.reasoning,
                "model_id": result.model_id,
                "model_name": result.model_name,
                "provider": result.provider,
                "base_url": result.base_url,
                "api_key": result.api_key,
                "custom_model": result.custom_model,
                "provider_id": result.provider_id,
                "provider_name": result.provider_name,
                "agent_id": result.agent_id,
                "image_input_enabled": result.image_input_enabled,
                "copy_paste_allowed": result.copy_paste_allowed,
                "profile_id": result.profile_id,
                "documents": result.documents,
            }

            # Build input items
            input_items: list[TResponseInputItem] = []

            # Format document info if documents are available
            if context["documents"]:
                # Convert composite type documents to dict format for format_document_info
                documents_dict = [
                    {
                        "id": doc.id,
                        "name": doc.name,
                        "file_path": doc.file_path,
                        "mime_type": doc.mime_type,
                    }
                    for doc in context["documents"]
                ]
                document_info = format_document_info(
                    documents_dict, context["image_input_enabled"]
                )
                input_items.append(document_info)

            # Get all messages using execute_sql_typed
            messages_params = GetSimulationMessagesSqlParams(chat_id=chat_id_uuid)
            messages_result = cast(
                GetSimulationMessagesSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_MESSAGES, params=messages_params
                ),
            )
            # Convert composite type messages to dict format
            messages = [
                {
                    "id": msg.id,
                    "chat_id": msg.chat_id,
                    "role": msg.role,
                    "content": msg.content,
                    "created_at": msg.created_at,
                    "completed": msg.completed,
                    "updated_at": msg.updated_at,
                    "audio": msg.audio,
                    "upload_id": msg.upload_id,
                }
                for msg in (messages_result.messages or [])
            ]

            # Prepare conversation history
            conversation_history, _ = get_simulation_conversation_history(messages)

            # Format chat scenario
            chat_scenario = format_chat_scenario(context["problem_statement"])

            input_items.insert(0, chat_scenario)
            input_items.extend(conversation_history)

            # Get member agent ID
            member_agent_id = context["agent_id"]
            if not member_agent_id:
                raise ValueError(
                    f"Member Agent not found for chat {context['chat_id']}"
                )

            # Load agent tools from database
            agent_id_uuid = uuid.UUID(member_agent_id)
            from app.sql.types import GetAgentToolsSqlRow

            # Function returns multiple rows, so we call it directly with fetch()
            function_call_sql = 'SELECT * FROM "public"."socket_get_agent_tools_v4"($1)'
            rows = await conn.fetch(function_call_sql, agent_id_uuid)
            agent_tools_config = [
                GetAgentToolsSqlRow.model_validate(dict(row)).model_dump()
                for row in rows
            ]
            tool_config_map: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            # Build member agent tools
            # For member agent, tools are available but agent generates responses directly
            # Tools (speak, regenerate, instruct, prompt, end_conversation, debug_info) are tracked via SQL/socket handlers
            member_tools: list[Any] = []

            # Add debug_info tool if available
            if "debug_info" in tool_config_map:
                from app.infra.v4.debug.debug_info import debug_info

                member_tools.append(debug_info)

            # Note: speak, regenerate, instruct, prompt, and end_conversation tools
            # are tracked via SQL/socket handlers but don't need function_tool wrappers
            # for member agent since it generates student responses directly

            # Create agent instance with loaded tools
            member_agent = GenericAgent(
                agent_name=context["persona_name"] or "Member Agent",
                system_prompt=context["system_prompt"],
                temperature=context["temperature"],
                model_name=context["model_name"],
                provider=context["provider_name"],
                base_url=context["base_url"],
                reasoning=context["reasoning"],
                api_key=context["api_key"],
                tools=member_tools,
            )

            agent_instance = member_agent.agent()

            # Run agent with streaming
            with trace(
                context["chat_title"],
                trace_id=context["trace_id"],
                group_id=context["attempt_id"],
            ):
                result_agent = await Runner.run(
                    agent_instance,
                    input=input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Emit async pricing event
            usage = result_agent.context_wrapper.usage
            assistant_output = getattr(result_agent, "final_output", None) or ""
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "member",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": context["system_prompt"],
                    "inputItems": input_items,
                    "assistantOutput": assistant_output,
                    "departmentId": str(context.get("department_id")),
                },
            )

            # Emit completion event
            await internal_sio.emit(
                "member_generate_complete",
                {
                    "sid": sid,
                    "type": "run_complete",
                    "chat_id": chat_id_str,
                    "run_id": str(model_run_id),
                    "message": assistant_output,
                },
            )

    except Exception as e:
        await internal_sio.emit(
            "member_generate_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
            },
        )


@sio.event  # type: ignore
async def member_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle member_generate event from client (client-to-server)."""
    try:
        validated = MemberGeneratePayload(**data)
    except ValidationError as e:
        await member_generate_error(
            MemberGenerateErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        return

    # Get profile_id from sid lookup (O(1) Redis lookup)
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        await member_generate_error(
            MemberGenerateErrorPayload(
                success=False, message="Profile not found. Please reconnect."
            ),
            room=sid,
        )
        return
    profile_id = uuid.UUID(profile_id_str)

    group_id = None
    if validated.group_id:
        try:
            group_id = uuid.UUID(validated.group_id)
        except ValueError:
            pass

    await _member_generate_impl(sid, validated, profile_id, group_id)


@internal_sio.on("member_generate")  # type: ignore
async def member_generate_internal(data: dict[str, Any]) -> None:
    """Handle member_generate event from internal bus (server-to-server)."""
    from app.infra.v4.websocket.handler_wrapper import handle_internal_event

    await handle_internal_event(
        data=data,
        request_type=MemberGeneratePayload,
        handler=_member_generate_impl,  # type: ignore[arg-type]
        error_event_name="member_generate_error",
        error_response_type=MemberGenerateErrorPayload,
    )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/generate", response_model=dict[str, bool])
async def member_generate_api(request: MemberGeneratePayload) -> dict[str, bool]:
    """Client-to-server event: Generate member agent response."""
    return {"success": True}


@server_router.post("/generate_error", response_model=dict[str, bool])
async def member_generate_error_api(
    request: MemberGenerateErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in member generation."""
    return {"success": True}
