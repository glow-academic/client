"""Unified message streaming handlers for simulations."""

import uuid
from typing import Any

import asyncpg  # type: ignore
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_internal_sio, get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for internal events
class SimulationMessageStartPayload(BaseModel):
    """Internal event to start a new message."""

    chat_id: str
    run_id: str | None = None
    role: str  # 'user' or 'assistant'
    content: str = ""  # Initial content (usually empty for assistant)
    completed: bool = False
    parent_message_id: str | None = None
    persona_id: str | None = None
    persona_name: str | None = None  # Alternative to persona_id for resolution
    created_at: str | None = None  # ISO format timestamp, or None for NOW()
    sid: str | None = None  # WebSocket session ID (for error handling)


class SimulationMessageTokenInternalPayload(BaseModel):
    """Internal event for message token update."""

    message_id: str
    chat_id: str
    token: str
    accumulated_content: str
    sid: str | None = None


class SimulationMessageCompleteInternalPayload(BaseModel):
    """Internal event to complete a message."""

    message_id: str
    chat_id: str
    final_content: str
    sid: str | None = None


# Client-facing payload models (reused from text/send.py)
class SimulationNewMessagePayload(BaseModel):
    """Response indicating a new simulation message was created."""

    message_id: str
    chat_id: str
    role: str
    content: str
    completed: bool
    created_at: str
    persona_id: str | None = None


class SimulationMessageTokenPayload(BaseModel):
    """Response indicating a token was received for a simulation message."""

    message_id: str
    chat_id: str
    token: str
    accumulated_content: str


class SimulationMessageCompletePayload(BaseModel):
    """Response indicating a simulation message was completed."""

    message_id: str
    chat_id: str
    final_content: str


# Client emission functions
async def simulation_new_message(
    payload: SimulationNewMessagePayload, room: str
) -> None:
    await sio.emit("simulations_text_new_message", payload.model_dump(), room=room)


async def simulation_message_token(
    payload: SimulationMessageTokenPayload, room: str
) -> None:
    await sio.emit("simulations_text_message_token", payload.model_dump(), room=room)


async def simulation_message_complete(
    payload: SimulationMessageCompletePayload, room: str
) -> None:
    await sio.emit("simulations_text_message_complete", payload.model_dump(), room=room)


async def _simulation_message_start_impl(
    sid: str, data: dict[str, Any], conn: asyncpg.Connection | None = None
) -> str | None:
    """Internal implementation for starting a new message.

    Returns the database message.id (UUID) if successful, None otherwise.
    This can be called directly when the ID is needed synchronously.

    Args:
        sid: WebSocket session ID
        data: Payload data
        conn: Optional database connection (if provided, uses it; otherwise acquires from pool)
    """
    logger.info(
        f"[simulation_message_start] Handler received event: sid={sid}, "
        f"chat_id={data.get('chat_id', 'unknown')}, role={data.get('role', 'unknown')}"
    )
    try:
        validated = SimulationMessageStartPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_message_start for {sid}: {e}")
        return None

    chat_id = validated.chat_id

    # Use provided connection or acquire from pool
    use_provided_conn = conn is not None
    conn_context = None
    if not use_provided_conn:
        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available")
            return None
        conn_context = pool.acquire()
        conn = await conn_context.__aenter__()

    assert conn is not None  # Type guard

    try:
        chat_id_uuid = uuid.UUID(chat_id)

        # Resolve persona_id if persona_name is provided
        persona_id_str = validated.persona_id
        if not persona_id_str and validated.persona_name:
            # Look up persona by name
            sql_find_persona = load_sql("sql/v3/personas/get_persona_by_name.sql")
            persona_row = await conn.fetchrow(
                sql_find_persona, validated.persona_name, str(chat_id_uuid)
            )
            if persona_row:
                persona_id_str = str(persona_row["id"])

        # Create message in database
        sql_create_message = load_sql("sql/v3/simulations/create_message.sql")
        created_at_param = None
        if validated.created_at:
            from datetime import datetime

            try:
                created_at_param = datetime.fromisoformat(
                    validated.created_at.replace("Z", "+00:00")
                )
            except Exception:
                logger.warning(
                    f"Invalid created_at format: {validated.created_at}, using NOW()"
                )

        message_row = await conn.fetchrow(
            sql_create_message,
            validated.role,
            validated.content,
            validated.completed,
            created_at_param,
        )

        if not message_row:
            logger.error(f"Failed to create message for chat {chat_id}")
            return None

        db_message_id = message_row["id"]
        message_created_at = message_row["created_at"]

        # Handle message ordering for voice mode (ensure assistant messages come after user messages)
        if validated.role == "assistant" and not validated.created_at:
            latest_user_message_row = await conn.fetchrow(
                """
                SELECT m.created_at
                FROM messages m
                JOIN message_runs mr ON mr.message_id = m.id
                JOIN runs r ON r.id = mr.run_id
                JOIN group_runs gr ON gr.run_id = r.id
                JOIN groups g ON g.id = gr.group_id
                JOIN chats c ON c.group_id = g.id
                WHERE c.id = $1::uuid
                  AND m.role = 'user'
                  AND m.id != $2::uuid
                ORDER BY m.created_at DESC
                LIMIT 1
                """,
                chat_id_uuid,
                db_message_id,
            )

            if latest_user_message_row:
                user_created_at = latest_user_message_row["created_at"]
                if user_created_at >= message_created_at:
                    await conn.execute(
                        """
                            UPDATE messages
                            SET created_at = $1::timestamp + INTERVAL '1 millisecond'
                            WHERE id = $2::uuid
                            """,
                        user_created_at,
                        db_message_id,
                    )
                    # Fetch updated created_at
                    updated_row = await conn.fetchrow(
                        "SELECT created_at FROM messages WHERE id = $1::uuid",
                        db_message_id,
                    )
                    if updated_row:
                        message_created_at = updated_row["created_at"]

        # Link message to run if run_id is provided
        if validated.run_id:
            sql_link = load_sql("sql/v3/simulations/link_message_to_run.sql")
            try:
                await conn.execute(sql_link, str(db_message_id), validated.run_id)
            except Exception as e:
                logger.warning(f"Failed to link message to run: {e}")

        # Link to persona if persona_id is available
        if persona_id_str:
            sql_link_persona = load_sql(
                "sql/v3/simulations/link_message_to_persona.sql"
            )
            try:
                await conn.execute(sql_link_persona, str(db_message_id), persona_id_str)
            except Exception as link_err:
                logger.warning(f"Failed to link message to persona: {link_err}")

        # Create message branch if parent_message_id is provided
        parent_id_str = validated.parent_message_id
        if not parent_id_str and validated.role == "assistant":
            # For assistant messages, find latest message with no active children
            latest_message_row = await conn.fetchrow(
                """
                SELECT m.id
                FROM messages m
                JOIN message_runs mr ON mr.message_id = m.id
                JOIN runs r ON r.id = mr.run_id
                JOIN group_runs gr ON gr.run_id = r.id
                JOIN groups g ON g.id = gr.group_id
                JOIN chats c ON c.group_id = g.id
                WHERE c.id = $1::uuid
                  AND m.id != $2::uuid
                  AND NOT EXISTS (
                      SELECT 1 FROM message_tree mt 
                      WHERE mt.parent_id = m.id AND mt.active = true
                  )
                ORDER BY m.created_at DESC
                LIMIT 1
                """,
                chat_id_uuid,
                db_message_id,
            )
            if latest_message_row and latest_message_row.get("id"):
                parent_id_str = str(latest_message_row["id"])

        if parent_id_str:
            assistant_id_str = str(db_message_id)
            if parent_id_str != assistant_id_str:
                sql_branch = load_sql("sql/v3/simulations/create_message_branch.sql")
                try:
                    await conn.execute(sql_branch, parent_id_str, assistant_id_str)
                    logger.info(
                        f"Created branch from message {parent_id_str} to message {assistant_id_str}"
                    )
                except Exception as e:
                    logger.warning(f"Failed to create message branch: {e}")

        # Emit new message event to clients
        room = f"simulation_{chat_id_uuid}"
        await simulation_new_message(
            SimulationNewMessagePayload(
                message_id=str(db_message_id),
                chat_id=chat_id,
                role=validated.role,
                content=validated.content,
                completed=validated.completed,
                created_at=message_created_at.isoformat(),
                persona_id=persona_id_str,
            ),
            room=room,
        )

        logger.info(
            f"Created and emitted message {db_message_id} for chat {chat_id} (role={validated.role})"
        )

        return str(db_message_id)

    except Exception as e:
        logger.error(
            f"Error in simulation_message_start for {sid}: {str(e)}", exc_info=True
        )
        return None
    finally:
        if not use_provided_conn and conn_context:
            await conn_context.__aexit__(None, None, None)


async def _simulation_message_token_impl(
    sid: str, data: dict[str, Any], conn: asyncpg.Connection | None = None
) -> None:
    """Internal implementation for message token update.

    Args:
        sid: WebSocket session ID
        data: Payload data
        conn: Optional database connection (if provided, uses it; otherwise acquires from pool)
    """
    logger.debug(
        f"[simulation_message_token] Handler received event: sid={sid}, "
        f"message_id={data.get('message_id', 'unknown')}"
    )
    try:
        validated = SimulationMessageTokenInternalPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_message_token for {sid}: {e}")
        return

    # Use provided connection or acquire from pool
    use_provided_conn = conn is not None
    conn_context = None
    if not use_provided_conn:
        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available")
            return
        conn_context = pool.acquire()
        conn = await conn_context.__aenter__()

    assert conn is not None  # Type guard

    try:
        # Update message content in database
        sql_update = load_sql("sql/v3/simulations/update_message_content.sql")
        await conn.execute(
            sql_update, validated.accumulated_content, validated.message_id
        )

        # Emit token event to clients
        room = f"simulation_{validated.chat_id}"
        await simulation_message_token(
            SimulationMessageTokenPayload(
                message_id=validated.message_id,
                chat_id=validated.chat_id,
                token=validated.token,
                accumulated_content=validated.accumulated_content,
            ),
            room=room,
        )

    except Exception as e:
        logger.error(
            f"Error in simulation_message_token for {sid}: {str(e)}", exc_info=True
        )
    finally:
        if not use_provided_conn and conn_context:
            await conn_context.__aexit__(None, None, None)


async def _simulation_message_complete_impl(
    sid: str, data: dict[str, Any], conn: asyncpg.Connection | None = None
) -> None:
    """Internal implementation for message completion.

    Args:
        sid: WebSocket session ID
        data: Payload data
        conn: Optional database connection (if provided, uses it; otherwise acquires from pool)
    """
    logger.info(
        f"[simulation_message_complete] Handler received event: sid={sid}, "
        f"message_id={data.get('message_id', 'unknown')}"
    )
    try:
        validated = SimulationMessageCompleteInternalPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_message_complete for {sid}: {e}")
        return

    # Use provided connection or acquire from pool
    use_provided_conn = conn is not None
    conn_context = None
    if not use_provided_conn:
        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available")
            return
        conn_context = pool.acquire()
        conn = await conn_context.__aenter__()

    assert conn is not None  # Type guard

    try:
        # Update message content with final content
        sql_update = load_sql("sql/v3/simulations/update_message_content.sql")
        await conn.execute(sql_update, validated.final_content, validated.message_id)

        # Complete message in database
        sql_complete = load_sql("sql/v3/simulations/complete_message.sql")
        await conn.execute(sql_complete, validated.final_content, validated.message_id)

        # Emit completion event to clients
        room = f"simulation_{validated.chat_id}"
        await simulation_message_complete(
            SimulationMessageCompletePayload(
                message_id=validated.message_id,
                chat_id=validated.chat_id,
                final_content=validated.final_content,
            ),
            room=room,
        )

        # Also emit updated message with completed=True
        message_row = await conn.fetchrow(
            "SELECT role, created_at FROM messages WHERE id = $1::uuid",
            validated.message_id,
        )
        if message_row:
            # Try to get persona_id
            persona_row = await conn.fetchrow(
                """
                    SELECT persona_id FROM message_personas 
                    WHERE message_id = $1::uuid 
                    LIMIT 1
                    """,
                validated.message_id,
            )
            persona_id_str = str(persona_row["persona_id"]) if persona_row else None

            await simulation_new_message(
                SimulationNewMessagePayload(
                    message_id=validated.message_id,
                    chat_id=validated.chat_id,
                    role=message_row["role"],
                    content=validated.final_content,
                    completed=True,
                    created_at=message_row["created_at"].isoformat(),
                    persona_id=persona_id_str,
                ),
                room=room,
            )

        logger.info(
            f"Completed and emitted message {validated.message_id} for chat {validated.chat_id}"
        )

    except Exception as e:
        logger.error(
            f"Error in simulation_message_complete for {sid}: {str(e)}", exc_info=True
        )
    finally:
        if not use_provided_conn and conn_context:
            await conn_context.__aexit__(None, None, None)


# Internal event handlers
@internal_sio.on("simulation_message_start")
async def simulation_message_start_internal(data: dict[str, Any]) -> None:
    """Handle message start event from internal bus (server-to-server)."""
    sid = data.get("sid")
    if not sid:
        logger.error("[simulation_message_start_internal] Missing 'sid' in payload")
        return
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _simulation_message_start_impl(sid, payload, conn=None)
    # Note: Return value is ignored for event handlers, use direct call if ID needed


@internal_sio.on("simulation_message_token")
async def simulation_message_token_internal(data: dict[str, Any]) -> None:
    """Handle message token event from internal bus (server-to-server)."""
    sid = data.get("sid", "internal")
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _simulation_message_token_impl(sid, payload, conn=None)


@internal_sio.on("simulation_message_complete")
async def simulation_message_complete_internal(data: dict[str, Any]) -> None:
    """Handle message complete event from internal bus (server-to-server)."""
    sid = data.get("sid", "internal")
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _simulation_message_complete_impl(sid, payload, conn=None)


# FastAPI endpoints for OpenAPI documentation
@client_router.post("/message_start", response_model=dict[str, bool])
async def simulation_message_start_api(
    request: SimulationMessageStartPayload,
) -> dict[str, bool]:
    """Internal event: Start a new message."""
    return {"success": True}


@client_router.post("/message_token", response_model=dict[str, bool])
async def simulation_message_token_api(
    request: SimulationMessageTokenPayload,
) -> dict[str, bool]:
    """Internal event: Update message with token."""
    return {"success": True}


@client_router.post("/message_complete", response_model=dict[str, bool])
async def simulation_message_complete_api(
    request: SimulationMessageCompleteInternalPayload,
) -> dict[str, bool]:
    """Internal event: Complete a message."""
    return {"success": True}
