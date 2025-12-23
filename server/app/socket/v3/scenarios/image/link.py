"""Handler for scenario_image_link internal event - links images to scenarios."""

import uuid
from typing import Any

from app.main import get_internal_sio, get_pool
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class LinkImageToScenarioPayload(BaseModel):
    """Request to link an image to a scenario."""

    scenario_id: str
    image_id: str
    active: bool = True
    sid: str | None = None  # WebSocket session ID for error handling


async def _scenario_image_link_impl(
    scenario_id: uuid.UUID,
    image_id: uuid.UUID,
    active: bool = True,
    sid: str | None = None,
) -> bool:
    """Internal implementation for linking an image to a scenario."""
    pool = get_pool()
    if not pool:
        logger.error("Database connection pool not available for image linking")
        return False

    async with pool.acquire() as conn:
        try:
            # Link image to scenario
            sql_link = load_sql("sql/v3/scenarios/insert_scenario_image_link.sql")
            await conn.execute(
                sql_link,
                str(scenario_id),
                str(image_id),
                active,
            )

            logger.info(
                f"Linked image {image_id} to scenario {scenario_id} (active={active})"
            )
            return True

        except Exception as e:
            logger.error(
                f"Error linking image {image_id} to scenario {scenario_id}: {e}",
                exc_info=True,
            )
            return False


@internal_sio.on("scenario_image_link")
async def scenario_image_link_internal(data: dict[str, Any]) -> None:
    """Handle scenario_image_link event from internal bus."""
    try:
        validated = LinkImageToScenarioPayload(**data)
        await _scenario_image_link_impl(
            uuid.UUID(validated.scenario_id),
            uuid.UUID(validated.image_id),
            validated.active,
            validated.sid,
        )
    except ValidationError as e:
        logger.error(f"Validation error in scenario_image_link: {e}")
    except Exception as e:
        logger.error(
            f"Error in scenario_image_link_internal: {e}", exc_info=True
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/link", response_model=dict[str, bool])
async def scenario_image_link_api(
    request: LinkImageToScenarioPayload,
) -> dict[str, bool]:
    """Internal event: Link an image to a scenario."""
    return {"success": True}

