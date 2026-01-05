"""Handler for member_regenerate WebSocket event - regenerates student responses."""

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
from jinja2 import Template

# Types will be auto-generated from SQL introspection
try:
    from app.sql.types import (
        GetMemberRegenerationRunContextAndCreateRunSqlParams,
        GetMemberRegenerationRunContextAndCreateRunSqlRow,
        GetSimulationMessagesSqlParams,
        GetSimulationMessagesSqlRow,
        GetDeveloperInstructionSqlParams,
        GetDeveloperInstructionSqlRow,
        LinkDeveloperMessageToRunSqlParams,
    )
except ImportError:
    from pydantic import BaseModel

    class GetMemberRegenerationRunContextAndCreateRunSqlParams(BaseModel):
        chat_id: uuid.UUID
        profile_id: uuid.UUID
        group_id: uuid.UUID
        user_instructions: str | None = None

    class GetMemberRegenerationRunContextAndCreateRunSqlRow(BaseModel):
        chat_id: str
        chat_title: str
        trace_id: str
        attempt_id: str
        simulation_id: str
        scenario_id: str
        department_id: str
        problem_statement: str
        persona_id: str
        persona_name: str
        system_prompt: str
        temperature: float
        reasoning: str
        model_id: str
        model_name: str
        provider: str
        base_url: str
        api_key: str
        custom_model: str | None
        provider_id: str | None
        provider_name: str
        agent_id: str
        image_input_enabled: bool
        copy_paste_allowed: bool
        profile_id: str
        req_per_day: int
        runs_today_count: int
        earliest_run_created_at: str | None
        documents: list[Any] | None = None
        run_id: str
        group_id: uuid.UUID
        previous_messages: list[Any] | None = None

    class GetSimulationMessagesSqlParams(BaseModel):
        chat_id: uuid.UUID

    class GetSimulationMessagesSqlRow(BaseModel):
        messages: list[Any] | None = None


internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_CONTEXT = (
    "app/sql/v4/member/get_member_regeneration_run_context_and_create_run_complete.sql"
)
SQL_PATH_MESSAGES = "app/sql/v4/simulations/get_simulation_messages_complete.sql"


# Pydantic models
class MemberRegeneratePayload(BaseModel):
    """Request to regenerate member agent response."""

    chat_id: str
    group_id: str  # REQUIRED for regeneration
    user_instructions: str | None = None


class MemberRegenerateErrorPayload(BaseModel):
    """Response indicating an error occurred in member regeneration."""

    success: bool
    message: str


# Emit helper functions
async def member_regenerate_error(
    payload: MemberRegenerateErrorPayload, room: str
) -> None:
    await sio.emit("member_regenerate_error", payload.model_dump(), room=room)


async def _member_regenerate_impl(
    sid: str,
    data: MemberRegeneratePayload,
    profile_id: uuid.UUID,
) -> None:
    """Handle member_regenerate internal event - runs agent and emits to progress/complete."""
    try:
        chat_id_uuid = uuid.UUID(data.chat_id)
        chat_id_str = str(chat_id_uuid)
        group_id = uuid.UUID(data.group_id)  # REQUIRED for regeneration

        async with get_db_connection() as conn:
            # Get all context data AND create run in single atomic transaction
            # This validates rate limits, creates run, gets all previous messages,
            # and links existing system/developer messages atomically
            try:
                params = GetMemberRegenerationRunContextAndCreateRunSqlParams(
                    chat_id=chat_id_uuid,
                    profile_id=profile_id,
                    group_id=group_id,  # REQUIRED for regeneration (uses existing group)
                    user_instructions=data.user_instructions,
                )
                result = cast(
                    GetMemberRegenerationRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH_CONTEXT, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await internal_sio.emit(
                        "member_regenerate_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": user_msg,
                        },
                    )
                    return
                await internal_sio.emit(
                    "member_regenerate_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Failed to initialize member regeneration: {str(e)}",
                    },
                )
                return

            if not result:
                await internal_sio.emit(
                    "member_regenerate_error",
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
                    "member_regenerate_error",
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

            # Get previous messages from result (already properly typed as composite types)
            previous_messages: list[TResponseInputItem] = []
            if result.previous_messages:
                previous_messages = [
                    cast(
                        TResponseInputItem,
                        {
                            "role": msg.role or "",
                            "content": msg.content or "",
                        },
                    )
                    for msg in result.previous_messages
                ]

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

            # Build input items: previous messages + document context + chat scenario + conversation history + user instructions
            input_items: list[TResponseInputItem] = []

            # Add previous messages first (conversation history from all runs)
            input_items.extend(previous_messages)

            # Format document info if documents are available
            if context["documents"]:
                documents_dict = [
                    {
                        "id": doc.id
                        if hasattr(doc, "id")
                        else str(getattr(doc, "document_id", "")),
                        "name": getattr(doc, "name", ""),
                        "file_path": getattr(doc, "file_path", ""),
                        "mime_type": getattr(doc, "mime_type", ""),
                    }
                    for doc in context["documents"]
                ]
                document_info = format_document_info(
                    documents_dict, context["image_input_enabled"]
                )
                input_items.append(document_info)

            # Format chat scenario
            chat_scenario = format_chat_scenario(context["problem_statement"])
            input_items.append(chat_scenario)

            # Get all messages for conversation history (if needed for context)
            # Note: previous_messages already includes conversation history, but we may want to add current messages
            messages_params = GetSimulationMessagesSqlParams(chat_id=chat_id_uuid)
            messages_result = cast(
                GetSimulationMessagesSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_MESSAGES, params=messages_params
                ),
            )
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

            # Prepare conversation history (for current state)
            conversation_history, _ = get_simulation_conversation_history(messages)
            input_items.extend(conversation_history)

            # Add user instructions on top (most recent instruction goes last)
            if data.user_instructions and data.user_instructions.strip():
                input_items.append(
                    {
                        "role": "user",
                        "content": f"User Instructions: {data.user_instructions.strip()}",
                    }
                )

            # Get developer instruction template from database (if configured)
            try:
                dev_instruction_params = GetDeveloperInstructionSqlParams(
                    instruction_type="member",
                    agent_role_val="member",
                )
                dev_instruction_result = cast(
                    GetDeveloperInstructionSqlRow,
                    await execute_sql_typed(
                        conn,
                        "app/sql/v4/developer_instructions/get_developer_instruction_complete.sql",
                        params=dev_instruction_params,
                    ),
                )
                if dev_instruction_result and dev_instruction_result.template:
                    # Render Jinja template with user_instructions if provided
                    template = Template(dev_instruction_result.template)
                    developer_message_content = template.render(
                        user_instructions=data.user_instructions
                        if data.user_instructions
                        else ""
                    )
                    if developer_message_content:
                        developer_message: TResponseInputItem = {
                            "role": "developer",
                            "content": developer_message_content,
                        }
                        input_items.append(developer_message)

                        # Link developer message to run
                        try:
                            link_params = LinkDeveloperMessageToRunSqlParams(
                                content=developer_message_content,
                                run_id=model_run_id,
                            )
                            await execute_sql_typed(
                                conn,
                                "app/sql/v4/simulations/link_developer_message_to_run_complete.sql",
                                params=link_params,
                            )
                        except Exception:
                            # Log error but continue - message is already in input_items
                            pass
            except Exception:
                # No developer instruction configured - continue without it
                pass

            # Get member agent ID
            member_agent_id = context["agent_id"]
            if not member_agent_id:
                raise ValueError(
                    f"Member Agent not found for chat {context['chat_id']}"
                )

            # Create agent instance (no persona tools for member agent - generates student responses directly)
            member_agent = GenericAgent(
                agent_name=context["persona_name"] or "Member Agent",
                system_prompt=context["system_prompt"],
                temperature=context["temperature"],
                model_name=context["model_name"],
                provider=context["provider_name"],
                base_url=context["base_url"],
                reasoning=context["reasoning"],
                api_key=context["api_key"],
                tools=[],  # No tools for member agent
            )

            agent_instance = member_agent.agent()

            # Run agent
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
                    "operationType": "member_regeneration",
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
                "member_regenerate_complete",
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
            "member_regenerate_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
            },
        )


@sio.event  # type: ignore
async def member_regenerate(sid: str, data: dict[str, Any]) -> None:
    """Handle member_regenerate event from client (client-to-server)."""
    try:
        validated = MemberRegeneratePayload(**data)
    except ValidationError as e:
        await member_regenerate_error(
            MemberRegenerateErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        return

    # Get profile_id from sid lookup (O(1) Redis lookup)
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        await member_regenerate_error(
            MemberRegenerateErrorPayload(
                success=False, message="Profile not found. Please reconnect."
            ),
            room=sid,
        )
        return
    profile_id = uuid.UUID(profile_id_str)

    await _member_regenerate_impl(sid, validated, profile_id)


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/regenerate", response_model=dict[str, bool])
async def member_regenerate_api(request: MemberRegeneratePayload) -> dict[str, bool]:
    """Client-to-server event: Regenerate member agent response."""
    return {"success": True}
