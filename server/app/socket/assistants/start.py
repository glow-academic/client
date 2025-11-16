"""Handler for start_assistant WebSocket event."""

import logging
import uuid
from typing import Any

from agents import Runner, gen_trace_id, trace
from app.main import get_pool, sio
from app.utils.agents.generic_agent import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)


# Pydantic models for server-to-client events
class StartAssistantErrorPayload(BaseModel):
    success: bool
    message: str
    chat_id: str | None = None
    error: str | None = None


class TitleUpdatedPayload(BaseModel):
    chat_id: str
    title: str


class AssistantStartedPayload(BaseModel):
    success: bool
    message: str
    chat_id: str


# Pydantic model for client-to-server event
class StartAssistantPayload(BaseModel):
    profile_id: str
    initial_message: str
    department_id: str


# Emit helper functions
async def start_assistant_error(payload: StartAssistantErrorPayload, room: str) -> None:
    await sio.emit(
        "start_assistant_error", payload.model_dump(exclude_none=True), room=room
    )


async def title_updated(payload: TitleUpdatedPayload, room: str) -> None:
    await sio.emit("title_updated", payload.model_dump(), room=room)


async def assistant_started(payload: AssistantStartedPayload, room: str) -> None:
    await sio.emit("assistant_started", payload.model_dump(), room=room)


async def _start_assistant_impl(sid: str, data: StartAssistantPayload) -> None:
    """
    Handle assistant start requests via WebSocket
    Creates a new assistant chat and processes the initial message
    """
    try:
        logger.info(f"Received start_assistant request from {sid} with data: {data}")

        profile_id = data.profile_id
        initial_message = data.initial_message
        department_id = data.department_id

        if not profile_id or not initial_message:
            logger.error(f"Missing profile_id or initial_message in request from {sid}")
            await start_assistant_error(
                StartAssistantErrorPayload(
                    success=False, message="Missing profile_id or initial_message"
                ),
                room=sid,
            )
            logger.error(
                f"Emitted assistant error to {sid}: Missing profile_id or initial_message"
            )
            return

        if not department_id:
            logger.error(f"Missing department_id in request from {sid}")
            await start_assistant_error(
                StartAssistantErrorPayload(
                    success=False,
                    message="Missing department_id - please refresh the page",
                ),
                room=sid,
            )
            logger.error(
                f"Emitted assistant error to {sid}: Missing department_id - please refresh the page"
            )
            return

        logger.info(f"Processing assistant start: profile_id={profile_id}, sid={sid}")

        # Get connection from pool
        pool = get_pool()
        if not pool:
            await start_assistant_error(
                StartAssistantErrorPayload(
                    success=False, message="Database not available"
                ),
                room=sid,
            )
            logger.error(f"Emitted assistant error to {sid}: Database not available")
            return

        async with pool.acquire() as conn:
            # Verify profile exists
            sql = load_sql("sql/v3/profile/verify_profile_exists.sql")
            profile_row = await conn.fetchrow(sql, uuid.UUID(profile_id))
            if not profile_row:
                await start_assistant_error(
                    StartAssistantErrorPayload(
                        success=False, message="Profile not found"
                    ),
                    room=sid,
                )
                logger.error(f"Emitted assistant error to {sid}: Profile not found")
                return

            # Generate a trace id for the chat
            trace_id = gen_trace_id()

            # Create the assistant chat
            from datetime import UTC, datetime

            sql = load_sql("sql/v3/assistant/create_chat.sql")
            chat_row = await conn.fetchrow(
                sql,
                datetime.now(UTC),
                "New Chat",  # Will be updated by title agent
                uuid.UUID(profile_id),
                trace_id,
            )
            chat_id_uuid_raw = chat_row["id"]  # asyncpg UUID object
            # Convert asyncpg UUID to Python UUID
            chat_id_uuid = uuid.UUID(str(chat_id_uuid_raw))
            chat_id = str(chat_id_uuid)
            logger.info(f"Created new assistant chat: {chat_id}")

            # Ensure client is joined to the assistant room
            assistant_room = f"assistant_{chat_id}"
            await sio.enter_room(sid, assistant_room)
            logger.info(f"Client {sid} joined assistant room {assistant_room}")

            # Update the title with the title agent (inlined run_title_agent)
            # Get all agent/model/provider/chat data in single query using SQL file
            sql = load_sql("sql/v3/agents/get_title_run_context.sql")
            # Pass as UUID objects - asyncpg needs explicit types for parameter inference
            context_row = await conn.fetchrow(
                sql, chat_id_uuid, uuid.UUID(str(department_id))
            )

            if not context_row:
                raise ValueError(
                    f"Chat {chat_id_uuid} not found or no title agent configured"
                )

            context = {
                "agent_id": context_row["agent_id"],
                "name": context_row["agent_name"],
                "system_prompt": context_row["system_prompt"],
                "temperature": float(context_row["temperature"])
                if context_row["temperature"] is not None
                else 0.0,
                "reasoning": context_row["reasoning"],
                "model_id": context_row["model_id"],
                "model_name": context_row["model_name"],
                "custom_model": context_row["custom_model"],
                "provider_name": context_row["provider_name"],
                "base_url": context_row["base_url"],
                "api_key": context_row["api_key"],
                "chat_title": context_row["chat_title"],
                "trace_id": context_row["trace_id"],
                "profile_id": context_row["profile_id"],
                "req_per_day": context_row["req_per_day"],
                "runs_today_count": context_row["runs_today_count"],
                "earliest_run_created_at": context_row["earliest_run_created_at"],
            }

            agent_instance = GenericAgent(
                agent_name=context["name"],
                system_prompt=context["system_prompt"],
                temperature=context["temperature"],
                model_name=context["model_name"],
                model_provider=context["provider_name"],
                base_url=context["base_url"],
                reasoning=context["reasoning"],
                api_key=context["api_key"],
                custom_model=context["custom_model"],
            )

            # Check rate limit
            profile_id_uuid = (
                uuid.UUID(context["profile_id"]) if context["profile_id"] else None
            )
            if not profile_id_uuid:
                raise ValueError("Profile not found. Please contact support.")

            req_per_day = context["req_per_day"]
            runs_today_count = context["runs_today_count"]

            if req_per_day is not None and runs_today_count >= req_per_day:
                from datetime import timedelta
                from zoneinfo import ZoneInfo

                earliest_run_created_at = context["earliest_run_created_at"]
                if earliest_run_created_at:
                    next_allowed_utc = earliest_run_created_at + timedelta(days=1)
                    eastern_tz = ZoneInfo("America/New_York")
                    next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
                    error_message = (
                        f"Daily request limit of {req_per_day} reached. "
                        f"Next request allowed after {next_allowed_et.strftime('%I:%M %p %Z')} on "
                        f"{next_allowed_et.strftime('%B %d, %Y')}."
                    )
                else:
                    error_message = f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
                raise ValueError(error_message)

            # Create model run with all junction records using SQL file
            sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
            model_run_row = await conn.fetchrow(
                sql_create_run,
                uuid.UUID(str(department_id)),
                uuid.UUID(context["model_id"]),
                uuid.UUID(context["agent_id"]),
                "agent",
                uuid.UUID(context["profile_id"]) if context["profile_id"] else None,
            )
            model_run_id = uuid.UUID(model_run_row["model_run_id"])

            with trace(context["chat_title"], trace_id=context["trace_id"]):
                result = await Runner.run(
                    agent_instance.agent(),
                    input=[{"role": "user", "content": initial_message}],
                    context=DebugContext(conn=conn, model_run_id=model_run_id),
                )

            chat_title = result.final_output

            usage = result.context_wrapper.usage

            # Update model run tokens using SQL file
            sql_update_tokens = load_sql(
                "sql/v3/model_runs/update_model_run_tokens.sql"
            )
            await conn.execute(
                sql_update_tokens,
                model_run_id,
                usage.input_tokens,
                usage.output_tokens,
            )

            # add the title to the trace by making an empty call
            with trace(chat_title, trace_id=context["trace_id"]):
                pass

            # Update the chat title using SQL file
            sql_update_title = load_sql("sql/v3/assistant/update_chat_title.sql")
            await conn.execute(sql_update_title, chat_id_uuid, chat_title)

            logger.info(f"Chat title: {chat_title}")

            # Emit title update to connected clients
            await title_updated(
                TitleUpdatedPayload(chat_id=chat_id, title=chat_title),
                room=assistant_room,
            )

            # Emit success response with chat_id
            await assistant_started(
                AssistantStartedPayload(
                    success=True,
                    message="Assistant started successfully",
                    chat_id=chat_id,
                ),
                room=sid,
            )

            logger.info(f"Assistant started successfully for {sid}: chat={chat_id}")

    except Exception as e:
        logger.error(f"Error starting assistant for {sid}: {str(e)}")
        await start_assistant_error(
            StartAssistantErrorPayload(
                success=False, message=f"Failed to start assistant: {str(e)}"
            ),
            room=sid,
        )
        logger.error(
            f"Emitted assistant error to {sid}: Failed to start assistant: {str(e)}"
        )


@sio.event  # type: ignore
async def start_assistant(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = StartAssistantPayload(**data)
        await _start_assistant_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in start_assistant for {sid}: {e}")
        await start_assistant_error(
            StartAssistantErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
