"""Handler for scenario_randomize WebSocket event."""

import json
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.main import get_internal_sio, get_pool, sio

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class ScenarioRandomizeCompletePayload(BaseModel):
    """Response indicating scenario randomization completed successfully."""

    success: bool
    randomized_selections: dict[str, Any]  # RandomizedSelections structure
    message: str | None = None


class ScenarioRandomizeErrorPayload(BaseModel):
    """Response indicating an error occurred in scenario randomization."""

    success: bool
    message: str


# Pydantic model for client-to-server event
class RandomizeScenarioPayload(BaseModel):
    """Request to randomize scenario selections."""

    scenarioId: str | None = None  # Required for detail mode, None for new mode
    randomize: str  # "all", "persona", "document", "parameters", "parameter_{paramId}"
    # Filter parameters (same as REST endpoints)
    departmentIds: list[str] | None = None
    personaIds: list[str] | None = None
    documentIds: list[str] | None = None
    templateDocumentIds: list[str] | None = None
    parameterIds: list[str] | None = None
    fieldIds: list[str] | None = None
    # Search parameters (not used in randomization, but kept for consistency)
    personaSearch: str | None = None
    documentSearch: str | None = None
    parameterSearch: str | None = None
    # Range parameters
    personaMin: int | None = None
    personaMax: int | None = None
    documentMin: int | None = None
    documentMax: int | None = None
    parameterSelectionMin: int | None = None
    parameterSelectionMax: int | None = None
    fieldRanges: dict[str, dict[str, int]] | None = None
    # Agent filtering (not used in randomization, but kept for consistency)
    useImage: bool | None = None
    useVideo: bool | None = None
    profileId: str  # Required for context


# Emit helper functions
async def scenario_randomize_complete(
    payload: ScenarioRandomizeCompletePayload, room: str
) -> None:
    await sio.emit(
        "scenario_randomize_complete",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def scenario_randomize_error(
    payload: ScenarioRandomizeErrorPayload, room: str
) -> None:
    await sio.emit("scenario_randomize_error", payload.model_dump(), room=room)


async def _randomize_scenario_impl(sid: str, data: RandomizeScenarioPayload) -> None:
    """Handle scenario randomization requests via WebSocket."""
    try:
        logger.info(
            f"Received scenario_randomize request from {sid} with randomize: {data.randomize}"
        )

        # Get connection pool
        pool = get_pool()
        if not pool:
            await scenario_randomize_error(
                ScenarioRandomizeErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Convert string IDs to UUIDs
            scenario_id_uuid = None
            if data.scenarioId:
                try:
                    scenario_id_uuid = uuid.UUID(data.scenarioId)
                except (ValueError, TypeError):
                    await scenario_randomize_error(
                        ScenarioRandomizeErrorPayload(
                            success=False,
                            message=f"Invalid scenarioId: {data.scenarioId}",
                        ),
                        room=sid,
                    )
                    return

            profile_id_uuid = None
            if data.profileId:
                try:
                    profile_id_uuid = uuid.UUID(data.profileId)
                except (ValueError, TypeError):
                    await scenario_randomize_error(
                        ScenarioRandomizeErrorPayload(
                            success=False,
                            message=f"Invalid profileId: {data.profileId}",
                        ),
                        room=sid,
                    )
                    return

            if not profile_id_uuid:
                await scenario_randomize_error(
                    ScenarioRandomizeErrorPayload(
                        success=False,
                        message="profileId is required",
                    ),
                    room=sid,
                )
                return

            # Convert filter arrays to UUID arrays
            department_ids_uuid = None
            if data.departmentIds:
                try:
                    department_ids_uuid = [uuid.UUID(did) for did in data.departmentIds]
                except (ValueError, TypeError):
                    department_ids_uuid = None

            persona_ids_uuid = None
            if data.personaIds:
                try:
                    persona_ids_uuid = [uuid.UUID(pid) for pid in data.personaIds]
                except (ValueError, TypeError):
                    persona_ids_uuid = None

            document_ids_uuid = None
            if data.documentIds:
                try:
                    document_ids_uuid = [uuid.UUID(did) for did in data.documentIds]
                except (ValueError, TypeError):
                    document_ids_uuid = None

            parameter_ids_uuid = None
            if data.parameterIds:
                try:
                    parameter_ids_uuid = [uuid.UUID(pid) for pid in data.parameterIds]
                except (ValueError, TypeError):
                    parameter_ids_uuid = None

            field_ids_uuid = None
            if data.fieldIds:
                try:
                    field_ids_uuid = [uuid.UUID(fid) for fid in data.fieldIds]
                except (ValueError, TypeError):
                    field_ids_uuid = None

            # Convert fieldRanges dict to JSONB
            field_ranges_jsonb = None
            if data.fieldRanges:
                try:
                    field_ranges_jsonb = json.dumps(data.fieldRanges)
                except (TypeError, ValueError):
                    field_ranges_jsonb = None

            # Call PostgreSQL function
            sql_randomize = load_sql("app/sql/v3/scenario/randomize_scenario.sql")
            result = await conn.fetchrow(
                sql_randomize,
                scenario_id_uuid,
                profile_id_uuid,
                data.randomize.strip().lower(),
                department_ids_uuid or [],
                persona_ids_uuid or [],
                document_ids_uuid or [],
                parameter_ids_uuid or [],
                field_ids_uuid or [],
                data.personaMin,
                data.personaMax,
                data.documentMin,
                data.documentMax,
                data.parameterSelectionMin,
                data.parameterSelectionMax,
                field_ranges_jsonb or "{}",
            )

            if not result:
                await scenario_randomize_error(
                    ScenarioRandomizeErrorPayload(
                        success=False,
                        message="Failed to randomize scenario selections",
                    ),
                    room=sid,
                )
                return

            # Convert UUID arrays to string arrays
            randomized_selections = {
                "personaIds": (
                    [str(pid) for pid in result["randomized_persona_ids"]]
                    if result["randomized_persona_ids"]
                    else None
                ),
                "documentIds": (
                    [str(did) for did in result["randomized_document_ids"]]
                    if result["randomized_document_ids"]
                    else None
                ),
                "parameterIds": (
                    [str(pid) for pid in result["randomized_parameter_ids"]]
                    if result["randomized_parameter_ids"]
                    else None
                ),
                "fieldIds": (
                    [str(fid) for fid in result["randomized_field_ids"]]
                    if result["randomized_field_ids"]
                    else None
                ),
            }

            # Emit completion event
            await scenario_randomize_complete(
                ScenarioRandomizeCompletePayload(
                    success=True,
                    randomized_selections=randomized_selections,
                    message="Scenario selections randomized successfully",
                ),
                room=sid,
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="scenarios.randomized",
                    template="{{ actor.name }} randomized scenario selections",
                    context={"randomize_type": data.randomize},
                    endpoint="/socket/v3/scenarios/randomize",
                    error=False,
                )
            except Exception as log_error:
                logger.warning(
                    f"Error logging scenario randomization activity: {log_error}"
                )

    except Exception as e:
        logger.error(f"Error in scenario_randomize for {sid}: {str(e)}", exc_info=True)
        await scenario_randomize_error(
            ScenarioRandomizeErrorPayload(success=False, message=str(e)),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="scenarios.randomized",
                template="{{ actor.name }} failed to randomize scenario selections",
                context={"error": str(e)},
                endpoint="/socket/v3/scenarios/randomize",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging scenario randomization error activity: {log_error}"
            )


@sio.event  # type: ignore
async def scenario_randomize(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = RandomizeScenarioPayload(**data)
        await _randomize_scenario_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in scenario_randomize for {sid}: {e}")
        await scenario_randomize_error(
            ScenarioRandomizeErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="scenarios.randomized",
                template="{{ actor.name }} failed to randomize scenario selections (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v3/scenarios/randomize",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging scenario randomization validation error activity: {log_error}"
            )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/randomize", response_model=dict[str, bool])
async def scenario_randomize_api(
    request: RandomizeScenarioPayload,
) -> dict[str, bool]:
    """Client-to-server event: Randomize scenario selections."""
    return {"success": True}
