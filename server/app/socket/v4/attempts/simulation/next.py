"""Handler for simulation_next WebSocket event - creates fresh scenario variant and delegates to generate.py."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from app.utils.sql_helper import execute_sql_typed, load_sql

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class SimulationNextErrorPayload(BaseModel):
    """Response indicating an error occurred in simulation next."""

    success: bool
    message: str


# Pydantic model for internal event
class SimulationNextPayload(BaseModel):
    """Request to create next scenario for attempt."""

    attempt_id: str
    scenario_id: str  # Parent scenario ID
    profile_id: str | None = None
    simulation_id: str | None = None


# Emit helper functions
async def simulation_next_error(payload: SimulationNextErrorPayload, room: str) -> None:
    await sio.emit("simulation_next_error", payload.model_dump(), room=room)


async def _simulation_next_impl(sid: str, data: SimulationNextPayload) -> None:
    """
    Handle simulation_next requests via WebSocket.
    Creates fresh scenario variant and delegates to generate.py for randomization and AI generation.
    """
    try:
        attempt_id = data.attempt_id
        parent_scenario_id = data.scenario_id
        profile_id = data.profile_id
        simulation_id = data.simulation_id

        if not attempt_id or not parent_scenario_id:
            await simulation_next_error(
                SimulationNextErrorPayload(
                    success=False, message="Missing attempt_id or scenario_id"
                ),
                room=sid,
            )
            return

        # Get connection pool
        # Replaced with get_db_connection()

        async with get_db_connection() as conn:
            parent_scenario_id_uuid = uuid.UUID(parent_scenario_id)
            profile_id_uuid = uuid.UUID(profile_id) if profile_id else None

            # Get parent scenario
            from typing import cast

            from app.sql.types import (
                GetScenarioByIdSqlParams,
                GetScenarioByIdSqlRow,
            )

            params = GetScenarioByIdSqlParams(scenario_id=parent_scenario_id_uuid)
            parent_scenario_result = cast(
                GetScenarioByIdSqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/scenario/get_scenario_by_id_complete.sql",
                    params=params,
                ),
            )
            if not parent_scenario_result:
                await simulation_next_error(
                    SimulationNextErrorPayload(
                        success=False, message="Parent scenario not found"
                    ),
                    room=sid,
                )
                return

            # Create child scenario variant (no links yet - generate.py will handle randomization and linking)
            parent_scenario_dict = parent_scenario_result.model_dump()
            scenario_title = parent_scenario_dict.get("name", "")

            from app.sql.types import (
                InsertScenarioVariantSqlParams,
                InsertScenarioVariantSqlRow,
            )

            variant_params = InsertScenarioVariantSqlParams(
                name=scenario_title or parent_scenario_dict.get("name", ""),
                generated=True,
                active=True,
                objectives_enabled=parent_scenario_dict.get("objectives_enabled", True),
                images_enabled=parent_scenario_dict.get("images_enabled", True),
                scenario_domain_id=parent_scenario_dict.get("scenario_domain_id"),
                image_domain_id=parent_scenario_dict.get("image_domain_id"),
            )
            new_scenario_result = cast(
                InsertScenarioVariantSqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/scenario/insert_scenario_variant_complete.sql",
                    params=variant_params,
                ),
            )
            child_scenario_id = new_scenario_result.id

            # Link scenario tree edge (parent to child)
            from app.sql.types import (
                InsertScenarioTreeEdgeSqlParams,
            )

            edge_params = InsertScenarioTreeEdgeSqlParams(
                parent_id=parent_scenario_id_uuid,
                child_id=child_scenario_id,
                active=True,
            )
            await execute_sql_typed(
                conn,
                "app/sql/v4/scenario/insert_scenario_tree_edge_complete.sql",
                params=edge_params,
            )
            # Check which AI fields need filling
            sql = load_sql("app/sql/v4/scenario/get_scenario_problem_statement.sql")
            problem_statement_row = await conn.fetchrow(sql, child_scenario_id)
            needs_statement = (
                not problem_statement_row
                or not problem_statement_row.get("problem_statement")
                or problem_statement_row.get("problem_statement") == ""
            )

            sql = load_sql("app/sql/v4/scenario/get_scenario_objectives.sql")
            objectives_rows = await conn.fetch(sql, child_scenario_id)
            needs_objectives = parent_scenario_dict.get(
                "objectives_enabled", True
            ) and (not objectives_rows or len(objectives_rows) == 0)

            sql = load_sql("app/sql/v4/scenario/get_scenario_videos.sql")
            videos_rows = await conn.fetch(sql, child_scenario_id)
            needs_video = parent_scenario_dict.get("video_enabled", False) and (
                not videos_rows or len(videos_rows) == 0
            )

            sql = load_sql("app/sql/v4/scenario/get_scenario_images.sql")
            images_rows = await conn.fetch(sql, child_scenario_id)
            needs_images = parent_scenario_dict.get("images_enabled", True) and (
                not images_rows or len(images_rows) == 0
            )

            sql = load_sql("app/sql/v4/scenario/get_scenario_questions.sql")
            questions_rows = await conn.fetch(sql, child_scenario_id)
            needs_questions = parent_scenario_dict.get("questions_enabled", False) and (
                not questions_rows or len(questions_rows) == 0
            )

            # Get department_id for scenario generation (fallback logic)
            department_id: uuid.UUID | None = None
            sql = load_sql("app/sql/v4/scenario/get_scenario_departments.sql")
            scenario_dept_rows = await conn.fetch(sql, parent_scenario_id_uuid)
            if scenario_dept_rows and len(scenario_dept_rows) > 0:
                department_id = uuid.UUID(str(scenario_dept_rows[0]["department_id"]))

            if not department_id and profile_id_uuid:
                sql = load_sql("app/sql/v4/profile/get_departments_for_profile.sql")
                profile_dept_rows = await conn.fetch(sql, str(profile_id_uuid))
                if profile_dept_rows and len(profile_dept_rows) > 0:
                    department_id = uuid.UUID(str(profile_dept_rows[0]["id"]))

            if not department_id:
                sql = load_sql("app/sql/v4/departments/get_all_active_departments.sql")
                all_dept_rows = await conn.fetch(sql)
                if all_dept_rows and len(all_dept_rows) > 0:
                    department_id = uuid.UUID(str(all_dept_rows[0]["id"]))

            if not department_id:
                await simulation_next_error(
                    SimulationNextErrorPayload(
                        success=False,
                        message="No department found for scenario generation",
                    ),
                    room=sid,
                )
                return

            # Get scenario domain ID from parent scenario or simulation
            scenario_domain_id = parent_scenario_dict.get("scenario_domain_id")
            if not scenario_domain_id and simulation_id:
                sql = load_sql("app/sql/v4/simulations/get_simulation_by_id.sql")
                simulation_row = await conn.fetchrow(sql, uuid.UUID(simulation_id))
                if simulation_row:
                    scenario_domain_id = simulation_row.get("simulation_text_domain_id")

            if not scenario_domain_id:
                await simulation_next_error(
                    SimulationNextErrorPayload(
                        success=False, message="No scenario domain ID found"
                    ),
                    room=sid,
                )
                return

            # If any AI fields needed, emit to scenario generate
            # generate.py will handle randomization and linking, then generate AI content
            if (
                needs_statement
                or needs_objectives
                or needs_video
                or needs_images
                or needs_questions
            ):
                # Don't pass personaIds/documentIds/fieldIds - let generate.py randomize them
                await sio.emit(
                    "generate_scenario",
                    {
                        "scenarioId": str(child_scenario_id),
                        "departmentId": str(department_id),
                        "scenarioDomainId": str(scenario_domain_id),
                        "objectivesEnabled": needs_objectives,
                        "videoEnabled": needs_video,
                        "imagesEnabled": needs_images,
                        "questionsEnabled": needs_questions,
                        "profileId": profile_id,
                        "simulationId": simulation_id,  # Pass simulation_id so advance can be emitted after generation
                        "attemptId": attempt_id,  # Pass attempt_id for advance event
                        # Note: personaIds, documentIds, fieldIds are NOT provided - generate.py will randomize them
                    },
                    room=sid,
                )
            else:
                # No AI fields needed, but we still need to randomize and link selections
                # Emit to generate_scenario anyway (it will randomize and link, then immediately advance)
                await sio.emit(
                    "generate_scenario",
                    {
                        "scenarioId": str(child_scenario_id),
                        "departmentId": str(department_id),
                        "scenarioDomainId": str(scenario_domain_id),
                        "objectivesEnabled": False,
                        "videoEnabled": False,
                        "imagesEnabled": False,
                        "questionsEnabled": False,
                        "profileId": profile_id,
                        "simulationId": simulation_id,
                        "attemptId": attempt_id,
                    },
                    room=sid,
                )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="simulations.next",
                    template="{{ actor.name }} created next scenario",
                    context={"scenario_id": str(child_scenario_id)},
                    endpoint="/socket/v4/simulations/next",
                    error=False,
                )
            except Exception:
                pass
    except Exception as e:
        await simulation_next_error(
            SimulationNextErrorPayload(success=False, message=str(e)),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.next",
                template="{{ actor.name }} failed to create next scenario",
                context={"error": str(e)},
                endpoint="/socket/v4/simulations/next",
                error=True,
            )
        except Exception:
            pass


@internal_sio.on("simulation_next")  # type: ignore
async def simulation_next_internal(data: dict[str, Any]) -> None:
    """Handle simulation_next event from internal bus (server-to-server)."""
    try:
        validated = SimulationNextPayload(**data)
        # Get sid from data if present, otherwise use a default
        sid = data.get("sid", "internal")
        await _simulation_next_impl(sid, validated)
    except ValidationError as e:
        await simulation_next_error(
            SimulationNextErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=data.get("sid", "internal"),
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/next", response_model=dict[str, bool])
async def simulation_next_api(request: SimulationNextPayload) -> dict[str, bool]:
    """Internal event: Create next scenario for attempt."""
    return {"success": True}


@server_router.post("/next_error", response_model=dict[str, bool])
async def simulation_next_error_api(
    request: SimulationNextErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in simulation next."""
    return {"success": True}
