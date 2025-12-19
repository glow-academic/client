"""Unified tool call streaming handlers for simulations."""

from typing import Any

import asyncpg  # type: ignore
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_internal_sio, get_pool
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for internal events
class SimulationToolCallStartPayload(BaseModel):
    """Internal event to start a new tool call."""

    chat_id: str
    run_id: str
    call_id: str  # The call_id from the agent response
    tool_name: str
    sid: str | None = None  # WebSocket session ID (for error handling)


class SimulationToolCallTokenPayload(BaseModel):
    """Internal event for tool call arguments update."""

    tool_call_id: str  # Database tool_call.id (UUID)
    chat_id: str
    arguments_raw: str  # Accumulated arguments as raw string
    sid: str | None = None


class SimulationToolCallCompletePayload(BaseModel):
    """Internal event to complete a tool call."""

    tool_call_id: str  # Database tool_call.id (UUID)
    chat_id: str
    arguments_raw: str  # Final arguments as raw string
    sid: str | None = None


async def _simulation_tool_call_start_impl(
    sid: str, data: dict[str, Any], conn: asyncpg.Connection | None = None
) -> str | None:
    """Internal implementation for starting a new tool call.

    Returns the database tool_call.id (UUID) if successful, None otherwise.
    This can be called directly when the ID is needed synchronously.
    """
    logger.info(
        f"[simulation_tool_call_start] Handler received event: sid={sid}, "
        f"chat_id={data.get('chat_id', 'unknown')}, call_id={data.get('call_id', 'unknown')}, "
        f"tool_name={data.get('tool_name', 'unknown')}"
    )
    try:
        validated = SimulationToolCallStartPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_tool_call_start for {sid}: {e}")
        return None

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
        # Create tool call in database
        sql_create_tool_call = load_sql("sql/v3/tool_calls/create_tool_call.sql")
        tool_call_row = await conn.fetchrow(
            sql_create_tool_call, validated.call_id, validated.tool_name
        )

        if not tool_call_row:
            logger.error(
                f"Failed to create tool call for chat {validated.chat_id}, call_id={validated.call_id}"
            )
            return None

        db_tool_call_id = tool_call_row["id"]

        # Link tool call to run
        sql_link_tool_call = load_sql("sql/v3/tool_calls/link_tool_call_to_run.sql")
        try:
            await conn.execute(
                sql_link_tool_call, str(db_tool_call_id), validated.run_id
            )
        except Exception as e:
            logger.warning(f"Failed to link tool call to run: {e}")

        logger.info(
            f"Created tool call {db_tool_call_id} for chat {validated.chat_id} "
            f"(call_id={validated.call_id}, tool_name={validated.tool_name})"
        )

        return str(db_tool_call_id)

    except Exception as e:
        logger.error(
            f"Error in simulation_tool_call_start for {sid}: {str(e)}", exc_info=True
        )
        return None
    finally:
        if not use_provided_conn and conn_context:
            await conn_context.__aexit__(None, None, None)


async def _simulation_tool_call_token_impl(
    sid: str, data: dict[str, Any], conn: asyncpg.Connection | None = None
) -> None:
    """Internal implementation for tool call arguments update."""
    logger.debug(
        f"[simulation_tool_call_token] Handler received event: sid={sid}, "
        f"tool_call_id={data.get('tool_call_id', 'unknown')}"
    )
    try:
        validated = SimulationToolCallTokenPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_tool_call_token for {sid}: {e}")
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
        # Update tool call arguments in database
        sql_update_args = load_sql("sql/v3/tool_calls/update_tool_call_arguments.sql")
        await conn.execute(
            sql_update_args, validated.tool_call_id, validated.arguments_raw
        )

        logger.debug(
            f"Updated tool call {validated.tool_call_id} arguments "
            f"(length={len(validated.arguments_raw)})"
        )

    except Exception as e:
        logger.error(
            f"Error in simulation_tool_call_token for {sid}: {str(e)}", exc_info=True
        )
    finally:
        if not use_provided_conn and conn_context:
            await conn_context.__aexit__(None, None, None)


async def _simulation_tool_call_complete_impl(
    sid: str, data: dict[str, Any], conn: asyncpg.Connection | None = None
) -> None:
    """Internal implementation for tool call completion."""
    logger.info(
        f"[simulation_tool_call_complete] Handler received event: sid={sid}, "
        f"tool_call_id={data.get('tool_call_id', 'unknown')}"
    )
    try:
        validated = SimulationToolCallCompletePayload(**data)
    except ValidationError as e:
        logger.error(
            f"Validation error in simulation_tool_call_complete for {sid}: {e}"
        )
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
        # Finalize tool call in database
        sql_finalize = load_sql("sql/v3/tool_calls/finalize_tool_call.sql")
        await conn.execute(
            sql_finalize, validated.tool_call_id, validated.arguments_raw
        )

        logger.info(
            f"Finalized tool call {validated.tool_call_id} for chat {validated.chat_id}"
        )

    except Exception as e:
        logger.error(
            f"Error in simulation_tool_call_complete for {sid}: {str(e)}", exc_info=True
        )
    finally:
        if not use_provided_conn and conn_context:
            await conn_context.__aexit__(None, None, None)


# Internal event handlers
@internal_sio.on("simulation_tool_call_start")
async def simulation_tool_call_start_internal(data: dict[str, Any]) -> None:
    """Handle tool call start event from internal bus (server-to-server)."""
    sid = data.get("sid", "internal")
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _simulation_tool_call_start_impl(sid, payload)
    # Note: Return value is ignored for event handlers, use direct call if ID needed


@internal_sio.on("simulation_tool_call_token")
async def simulation_tool_call_token_internal(data: dict[str, Any]) -> None:
    """Handle tool call token event from internal bus (server-to-server)."""
    sid = data.get("sid", "internal")
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _simulation_tool_call_token_impl(sid, payload)


@internal_sio.on("simulation_tool_call_complete")
async def simulation_tool_call_complete_internal(data: dict[str, Any]) -> None:
    """Handle tool call complete event from internal bus (server-to-server)."""
    sid = data.get("sid", "internal")
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _simulation_tool_call_complete_impl(sid, payload)


# FastAPI endpoints for OpenAPI documentation
@client_router.post("/tool_call_start", response_model=dict[str, bool])
async def simulation_tool_call_start_api(
    request: SimulationToolCallStartPayload,
) -> dict[str, bool]:
    """Internal event: Start a new tool call."""
    return {"success": True}


@client_router.post("/tool_call_token", response_model=dict[str, bool])
async def simulation_tool_call_token_api(
    request: SimulationToolCallTokenPayload,
) -> dict[str, bool]:
    """Internal event: Update tool call arguments."""
    return {"success": True}


@client_router.post("/tool_call_complete", response_model=dict[str, bool])
async def simulation_tool_call_complete_api(
    request: SimulationToolCallCompletePayload,
) -> dict[str, bool]:
    """Internal event: Complete a tool call."""
    return {"success": True}
