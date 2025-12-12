"""Handler for simulation_text_start WebSocket event."""

import json
import uuid
from typing import Any

from agents import (
    gen_trace_id,
)
from pydantic import BaseModel, ValidationError

from app.main import get_pool, sio
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)


# Pydantic models for server-to-client events
class StartSimulationErrorPayload(BaseModel):
    success: bool
    message: str


class SimulationStartedPayload(BaseModel):
    success: bool
    message: str
    attempt_id: str


# Pydantic model for client-to-server event
class StartSimulationPayload(BaseModel):
    simulation_id: str
    profile_id: str | None = None
    scenario_id: str | None = None
    infinite: bool = False
    infinite_time_limit: int | None = None


# Emit helper functions
async def simulation_text_start_error(
    payload: StartSimulationErrorPayload, room: str
) -> None:
    await sio.emit("simulation_text_start_error", payload.model_dump(), room=room)


async def simulation_started(payload: SimulationStartedPayload, room: str) -> None:
    await sio.emit("simulation_started", payload.model_dump(), room=room)


async def _simulation_text_start_impl(sid: str, data: StartSimulationPayload) -> None:
    """
    Handle simulation start requests via WebSocket
    Replaces /simulations/start endpoint
    """
    try:
        logger.info(
            f"Received simulation_text_start request from {sid} with data: {data}"
        )

        simulation_id = data.simulation_id
        profile_id = data.profile_id
        scenario_id_override = data.scenario_id
        infinite = data.infinite

        if not simulation_id:
            logger.error(f"Missing simulation_id in request from {sid}")
            await simulation_text_start_error(
                StartSimulationErrorPayload(
                    success=False, message="Missing simulation_id"
                ),
                room=sid,
            )
            logger.error(f"Emitted error to {sid}: Missing simulation_id")
            return

        # If the client indicates guest (empty/"null"/None), register under default guest profile
        if profile_id == "" or profile_id == "null" or profile_id is None:
            profile_id = None  # normalize before DB lookup

        logger.info(
            f"Processing simulation start: simulation_id={simulation_id}, profile_id={profile_id}, sid={sid}"
        )

        # Get connection pool
        pool = get_pool()
        if not pool:
            await simulation_text_start_error(
                StartSimulationErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            logger.error(
                f"Emitted error to {sid}: Database connection pool not available"
            )
            return

        async with pool.acquire() as conn:
            # Resolve profile for guests to avoid ghost attempts
            if profile_id is None:
                sql = load_sql("sql/v3/profile/get_default_guest_profile.sql")
                guest_row = await conn.fetchrow(sql)
                if guest_row:
                    profile_id = str(guest_row["id"])
                    logger.info(
                        f"Assigning simulation attempt to default guest profile {profile_id}"
                    )
                else:
                    logger.warning(
                        "No default guest profile found; proceeding without profile_id (will create ghost attempt)"
                    )

            # Parse infinite_time_limit
            # Note: infinite_time_limit parameter removed - time limits now managed via
            # simulation_time_limits junction table. Use infinite_mode boolean to bypass limits.

            # Generate trace_id using Python's gen_trace_id() for consistency
            trace_id = gen_trace_id()

            # Create attempt and chat using SQL
            sql = load_sql("sql/v3/simulations/start_simulation_attempt_complete.sql")
            row = await conn.fetchrow(
                sql,
                simulation_id,
                infinite,
                profile_id if profile_id else None,
                scenario_id_override if scenario_id_override else None,
                trace_id,
            )

            if not row:
                await simulation_text_start_error(
                    StartSimulationErrorPayload(
                        success=False, message="Failed to start simulation attempt"
                    ),
                    room=sid,
                )
                logger.error(
                    f"Emitted error to {sid}: Failed to start simulation attempt"
                )
                return

            # Check content type (video vs scenario)
            content_type = row.get("content_type", "scenario")
            video_id = row.get("video_id")

            # Handle video case - skip scenario-specific logic
            if content_type == "video" and video_id:
                logger.info(
                    f"Simulation {simulation_id} has video content, starting with video {video_id}"
                )
                # Videos don't have chats initially, so skip scenario generation and room joining
                # Build minimal payload for videos
                start_payload = {
                    "attempt_id": row["attempt_id"],
                    "chat_id": None,  # Videos don't have chats initially
                }
            else:
                # Parse JSONB fields if they're strings (only for scenarios)
                simulation_data = row["simulation_data"]
                scenario_metadata = row["scenario_metadata"]
                if isinstance(simulation_data, str):
                    simulation_data = json.loads(simulation_data)
                if isinstance(scenario_metadata, str):
                    scenario_metadata = json.loads(scenario_metadata)

                # Check if scenario needs generation
                needs_generation = row.get("needs_generation", False)
                scenario_id_raw = row.get("scenario_id")
                if not scenario_id_raw:
                    await simulation_text_start_error(
                        StartSimulationErrorPayload(
                            success=False, message="No scenario found for simulation"
                        ),
                        room=sid,
                    )
                    logger.error(f"Emitted error to {sid}: No scenario found")
                    return
                # Convert asyncpg UUID to Python UUID
                scenario_id = uuid.UUID(str(scenario_id_raw))

                # Handle scenario generation if needed
                if needs_generation:
                    logger.info(
                        f"Scenario {scenario_id} needs generation, starting agent..."
                    )

                    # Get profile_id from attempt
                    sql = load_sql("sql/v3/attempts/get_attempt_with_profile.sql")
                    attempt_with_profile = await conn.fetchrow(sql, row["attempt_id"])
                    attempt_profile_id_raw = (
                        attempt_with_profile["profile_id"]
                        if attempt_with_profile
                        else None
                    )
                    # Convert asyncpg UUID to Python UUID if needed
                    attempt_profile_id = (
                        str(attempt_profile_id_raw) if attempt_profile_id_raw else None
                    )

                    # Get department_id from scenario_departments
                    sql = load_sql("sql/v3/scenarios/get_scenario_departments.sql")
                    scenario_dept_rows = await conn.fetch(sql, scenario_id)
                    department_id = None

                    if scenario_dept_rows and len(scenario_dept_rows) > 0:
                        # Use first department from scenario
                        dept_id_raw = scenario_dept_rows[0]["department_id"]
                        department_id = uuid.UUID(str(dept_id_raw))
                        logger.info(
                            f"Using department_id from scenario: {department_id}"
                        )
                    elif attempt_profile_id:
                        # Fallback to profile's departments
                        sql = load_sql("sql/v3/profile/get_departments_for_profile.sql")
                        profile_dept_rows = await conn.fetch(sql, attempt_profile_id)
                        if profile_dept_rows and len(profile_dept_rows) > 0:
                            dept_id_raw = profile_dept_rows[0]["id"]
                            department_id = uuid.UUID(str(dept_id_raw))
                            logger.info(
                                f"Using department_id from profile: {department_id}"
                            )

                    if not department_id:
                        # Last resort: get any active department
                        sql = load_sql(
                            "sql/v3/departments/get_all_active_departments.sql"
                        )
                        all_dept_rows = await conn.fetch(sql)
                        if all_dept_rows and len(all_dept_rows) > 0:
                            dept_id_raw = all_dept_rows[0]["id"]
                            department_id = uuid.UUID(str(dept_id_raw))
                            logger.info(
                                f"Using first active department: {department_id}"
                            )

                    if not department_id:
                        logger.warning(
                            "Cannot generate scenario: no department_id available, continuing with parent scenario"
                        )
                    else:
                        # Use randomization function to select attributes and create child scenario
                        from app.api.v3.scenarios.randomize import (
                            randomize_scenario_attributes,
                        )

                        attempt_profile_uuid = (
                            uuid.UUID(attempt_profile_id)
                            if attempt_profile_id
                            else None
                        )

                        try:
                            # Call randomization function which handles attribute selection and child creation
                            randomized_result = await randomize_scenario_attributes(
                                conn=conn,
                                persona_ids=None,
                                document_ids=None,
                                parameter_item_ids=None,
                                department_ids=[
                                    department_id
                                ],  # Use the department we already selected
                                scenario_id=scenario_id,
                                profile_id=attempt_profile_uuid,
                                targets=None,  # Randomize all
                            )

                            new_scenario_id = randomized_result["child_scenario_id"]
                            if not new_scenario_id:
                                raise ValueError("Failed to create child scenario")

                            logger.info(
                                f"Created child scenario variant {new_scenario_id} for parent {scenario_id} "
                                f"with persona_id={randomized_result['persona_id']}, "
                                f"document_ids={randomized_result['document_ids']}, "
                                f"parameter_item_ids={randomized_result['parameter_item_ids']}"
                            )

                            # Update chat to use child scenario instead of parent
                            sql = load_sql(
                                "sql/v3/simulations/update_chat_scenario_id.sql"
                            )
                            await conn.execute(sql, row["chat_id"], new_scenario_id)
                            logger.info(
                                f"Updated chat {row['chat_id']} to use child scenario {new_scenario_id}"
                            )

                            # Update scenario_id for result - use child scenario
                            scenario_id = new_scenario_id

                            # Fetch child scenario data for result
                            sql = load_sql("sql/v3/scenarios/get_scenario_by_id.sql")
                            child_scenario = await conn.fetchrow(sql, new_scenario_id)
                            if child_scenario:
                                # Get problem statement from child
                                sql = load_sql(
                                    "sql/v3/scenarios/get_scenario_problem_statement_active.sql"
                                )
                                problem_row = await conn.fetchrow(sql, new_scenario_id)
                                child_problem_statement = (
                                    problem_row.get("problem_statement")
                                    if problem_row
                                    else None
                                )

                                # Update row data for result (convert Record to dict first)
                                row_dict = dict(row)
                                row_dict["scenario_id"] = new_scenario_id
                                row_dict["scenario_name"] = child_scenario.get(
                                    "name", ""
                                )
                                row_dict["problem_statement"] = (
                                    child_problem_statement or ""
                                )
                                row = row_dict
                                scenario_metadata["generated"] = True

                        except Exception as gen_error:
                            # Log error but don't fail the entire simulation start
                            logger.error(
                                f"Failed to generate scenario {scenario_id}: {str(gen_error)}",
                                exc_info=True,
                            )
                            # Continue with existing scenario (may have no problem statement)

                # Build payload for scenarios
                start_payload = {
                    "attempt_id": row["attempt_id"],
                    "chat_id": row["chat_id"],
                    "chat_title": row["chat_title"],
                    "scenario": {
                        "id": str(row["scenario_id"]),
                        "name": row["scenario_name"],
                        "problem_statement": row["problem_statement"],
                        "active": scenario_metadata.get("active"),
                        "generated": scenario_metadata.get("generated"),
                    },
                }

            logger.info(
                f"Created attempt {start_payload['attempt_id']} for simulation {simulation_id}"
            )

            # Invalidate cache after creating attempt - invalidate history sections
            # Overview sections are based on materialized views and don't need invalidation
            # History sections need invalidation since new attempts affect what's shown
            try:
                # Build invalidation tags
                # Dashboard uses general tags (no profileId filter), so always invalidate it
                # Home, reports, and practice use profile-specific tags (require profileId)
                invalidation_tags = [
                    "dashboard",  # Invalidates dashboard history endpoint (no profileId filter)
                    "attempts",  # Invalidates attempt-level cache
                ]

                # Add profile-specific tags for home/reports/practice when profile_id is available
                # These endpoints require profileId, so we only need profile-specific invalidation
                if profile_id:
                    invalidation_tags.extend(
                        [
                            f"home:profile:{profile_id}",
                            f"reports:profile:{profile_id}",
                            f"practice:profile:{profile_id}",
                            f"history:profile:{profile_id}",
                        ]
                    )

                await invalidate_tags(invalidation_tags)
                logger.info(
                    f"Invalidated cache for tags: {invalidation_tags} after creating attempt {start_payload['attempt_id']}"
                )
            except Exception as cache_error:
                # Log error but don't fail the simulation start
                logger.warning(
                    f"Failed to invalidate cache after simulation start: {cache_error}",
                    exc_info=True,
                )

            # Join the client to the simulation room for real-time updates (only for scenarios with chats)
            if start_payload.get("chat_id"):
                simulation_room = f"simulation_{start_payload['chat_id']}"
                await sio.enter_room(sid, simulation_room)
                logger.info(f"Client {sid} joined simulation room {simulation_room}")

            # Emit success response
            await simulation_started(
                SimulationStartedPayload(
                    success=True,
                    message="Simulation started successfully",
                    attempt_id=str(start_payload["attempt_id"]),
                ),
                room=sid,
            )

            logger.info(
                f"Simulation started successfully for {sid}: attempt={start_payload['attempt_id']}"
            )

    except Exception as e:
        logger.error(f"Error starting simulation for {sid}: {str(e)}")
        await simulation_text_start_error(
            StartSimulationErrorPayload(
                success=False, message=f"Failed to start simulation: {str(e)}"
            ),
            room=sid,
        )
        logger.error(f"Emitted error to {sid}: Failed to start simulation: {str(e)}")


@sio.event  # type: ignore
async def simulation_text_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = StartSimulationPayload(**data)
        await _simulation_text_start_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_text_start for {sid}: {e}")
        await simulation_text_start_error(
            StartSimulationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
