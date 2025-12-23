"""Handler for simulation_group_link internal event - links runs to groups."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_internal_sio, get_pool
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class LinkRunToGroupPayload(BaseModel):
    """Request to link a run to a group."""

    chat_id: str
    run_id: str
    sid: str | None = None  # WebSocket session ID for error handling


async def _simulation_group_link_impl(
    chat_id: uuid.UUID, run_id: uuid.UUID, sid: str | None = None
) -> bool:
    """Internal implementation for linking a run to a group."""
    pool = get_pool()
    if not pool:
        logger.error("Database connection pool not available for group linking")
        return False

    async with pool.acquire() as conn:
        try:
            # Get or create group for chat
            sql_get_group = load_sql(
                "sql/v3/simulations/get_or_create_group_for_chat.sql"
            )
            group_row = await conn.fetchrow(sql_get_group, str(chat_id))

            if not group_row or not group_row.get("group_id"):
                logger.error(f"Failed to get or create group for chat {chat_id}")
                return False

            group_id = group_row["group_id"]

            # Link run to group
            sql_link = load_sql("sql/v3/simulations/link_run_to_group_complete.sql")
            await conn.execute(sql_link, str(group_id), str(run_id))

            logger.info(
                f"Linked run {run_id} to group {group_id} for chat {chat_id}"
            )
            return True

        except Exception as e:
            logger.error(
                f"Error linking run {run_id} to group for chat {chat_id}: {e}",
                exc_info=True,
            )
            return False


@internal_sio.on("simulation_group_link")
async def simulation_group_link_internal(data: dict[str, Any]) -> None:
    """Handle simulation_group_link event from internal bus."""
    try:
        validated = LinkRunToGroupPayload(**data)
        await _simulation_group_link_impl(
            uuid.UUID(validated.chat_id),
            uuid.UUID(validated.run_id),
            validated.sid,
        )
    except ValidationError as e:
        logger.error(f"Validation error in simulation_group_link: {e}")
    except Exception as e:
        logger.error(
            f"Error in simulation_group_link_internal: {e}", exc_info=True
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/link", response_model=dict[str, bool])
async def simulation_group_link_api(
    request: LinkRunToGroupPayload,
) -> dict[str, bool]:
    """Internal event: Link a run to a group for a simulation chat."""
    return {"success": True}

