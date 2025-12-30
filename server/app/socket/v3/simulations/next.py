"""Handler for simulation_next WebSocket event - creates fresh scenario based on child, randomizes, checks AI fields."""

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
async def simulation_next_error(
    payload: SimulationNextErrorPayload, room: str
) -> None:
    await sio.emit("simulations_next_error", payload.model_dump(), room=room)


async def _simulation_next_impl(sid: str, data: SimulationNextPayload) -> None:
    """
    Handle simulation_next requests via WebSocket.
    Creates fresh scenario based on child, randomizes where needed, checks AI fields,
    and routes to scenario generate or advance.
    """
    try:
        logger.info(
            f"Received simulation_next request from {sid} with data: {data}"
        )

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
        pool = get_pool()
        if not pool:
            await simulation_next_error(
                SimulationNextErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Import randomization logic from start.py
            # For now, we'll reuse the _create_chat_with_randomization function
            # but extract just the scenario creation part
            from app.socket.v3.agents.simulation_text.start import (
                _create_chat_with_randomization,
            )

            # Create child scenario with randomization
            # Note: This creates both scenario and chat - we'll refactor later to separate
            # For now, we'll create the scenario and then check AI fields
            import random

            parent_scenario_id_uuid = uuid.UUID(parent_scenario_id)
            profile_id_uuid = uuid.UUID(profile_id) if profile_id else None

            # Get parent scenario
            sql = load_sql("app/sql/v3/scenario/get_scenario_by_id.sql")
            parent_scenario = await conn.fetchrow(sql, parent_scenario_id_uuid)
            if not parent_scenario:
                await simulation_next_error(
                    SimulationNextErrorPayload(
                        success=False, message="Parent scenario not found"
                    ),
                    room=sid,
                )
                return

            # Get department_ids from scenario_departments
            sql = load_sql("app/sql/v3/scenario/get_scenario_departments.sql")
            scenario_dept_rows = await conn.fetch(sql, parent_scenario_id_uuid)
            scenario_dept_ids = (
                [uuid.UUID(str(row["department_id"])) for row in scenario_dept_rows]
                if scenario_dept_rows
                else None
            )

            # Randomize department
            selected_department_id: uuid.UUID | None = None
            if scenario_dept_ids and len(scenario_dept_ids) > 0:
                selected_department_id = random.choice(scenario_dept_ids)
            elif profile_id_uuid:
                sql = load_sql("app/sql/v3/profile/get_departments_for_profile.sql")
                profile_dept_rows = await conn.fetch(sql, str(profile_id_uuid))
                if profile_dept_rows and len(profile_dept_rows) > 0:
                    profile_dept_ids = [
                        uuid.UUID(str(row["id"])) for row in profile_dept_rows
                    ]
                    selected_department_id = random.choice(profile_dept_ids)

            # Get randomization ranges
            sql = load_sql("app/sql/v3/scenario/get_randomization_ranges.sql")
            ranges_result = await conn.fetchrow(sql, parent_scenario_id_uuid)
            if not ranges_result:
                persona_min, persona_max = 1, 3
                document_min, document_max = 0, 3
                parameter_min, parameter_max = 0, 3
                field_ranges_json: dict[str, dict[str, int]] = {}
            else:
                persona_min = ranges_result.get("persona_min", 1)
                persona_max = ranges_result.get("persona_max", 3)
                document_min = ranges_result.get("document_min", 0)
                document_max = ranges_result.get("document_max", 3)
                parameter_min = ranges_result.get("parameter_min", 0)
                parameter_max = ranges_result.get("parameter_max", 3)
                field_ranges_raw = ranges_result.get("field_ranges_json", {})
                if isinstance(field_ranges_raw, str):
                    try:
                        field_ranges_json = json.loads(field_ranges_raw)
                    except json.JSONDecodeError:
                        field_ranges_json = {}
                elif isinstance(field_ranges_raw, dict):
                    field_ranges_json = field_ranges_raw
                else:
                    field_ranges_json = {}

            # Get randomization data
            dept_uuids: list[uuid.UUID] = (
                [] if not selected_department_id else [selected_department_id]
            )
            sql = load_sql("app/sql/v3/scenario/get_randomization_data_complete.sql")
            result = await conn.fetchrow(sql, dept_uuids, parent_scenario_id_uuid)

            if not result:
                await simulation_next_error(
                    SimulationNextErrorPayload(
                        success=False, message="Failed to fetch randomization data"
                    ),
                    room=sid,
                )
                return

            # Parse JSONB aggregations
            def parse_jsonb(data: Any) -> list[dict[str, Any]]:
                if isinstance(data, str):
                    try:
                        data = json.loads(data)
                    except json.JSONDecodeError:
                        return []
                if not isinstance(data, list):
                    return []
                return [dict(item) for item in data]

            personas_data = parse_jsonb(result.get("personas", []))
            documents_data = parse_jsonb(result.get("documents", []))
            parameters_data = parse_jsonb(result.get("parameters", []))
            parameter_items_data = parse_jsonb(result.get("parameter_items", []))

            # Randomize selections
            # Randomize personas
            persona_count = random.randint(persona_min, min(persona_max, len(personas_data)))
            selected_personas = random.sample(personas_data, persona_count) if personas_data else []
            persona_id = selected_personas[0]["id"] if selected_personas else None

            # Randomize documents
            document_count = random.randint(document_min, min(document_max, len(documents_data)))
            selected_documents = random.sample(documents_data, document_count) if documents_data else []
            doc_ids = [d["id"] for d in selected_documents]

            # Randomize parameters
            parameter_count = random.randint(parameter_min, min(parameter_max, len(parameters_data)))
            selected_parameters = random.sample(parameters_data, parameter_count) if parameters_data else []
            param_ids = [p["id"] for p in selected_parameters]

            # Get parameter items for selected parameters
            param_item_ids = []
            for param in selected_parameters:
                param_items = [pi for pi in parameter_items_data if pi.get("parameter_id") == str(param["id"])]
                if param_items:
                    # Select 1-3 items per parameter
                    item_count = random.randint(1, min(3, len(param_items)))
                    selected_items = random.sample(param_items, item_count)
                    param_item_ids.extend([uuid.UUID(str(item["id"])) for item in selected_items])

            # Create child scenario
            parent_scenario_dict = dict(parent_scenario)
            scenario_title = parent_scenario_dict.get("name", "")
            
            sql = load_sql("app/sql/v3/scenario/insert_scenario_variant.sql")
            new_scenario_row = await conn.fetchrow(
                sql,
                scenario_title or parent_scenario_dict.get("name", ""),
                True,  # generated
                True,  # active
                parent_scenario_dict.get("objectives_enabled", True),
                parent_scenario_dict.get("images_enabled", True),
                parent_scenario_dict.get("scenario_agent_id"),
                parent_scenario_dict.get("image_agent_id"),
            )
            child_scenario_id = new_scenario_row["id"]

            # Link scenario tree
            sql = load_sql("app/sql/v3/scenario/insert_scenario_tree_edge.sql")
            await conn.execute(
                sql,
                parent_scenario_id_uuid,
                child_scenario_id,
                True,
            )

            # Link persona
            if persona_id:
                sql = load_sql("app/sql/v3/scenario/insert_scenario_persona_link.sql")
                await conn.execute(sql, child_scenario_id, persona_id, True)

            # Link documents
            if doc_ids:
                sql = load_sql("app/sql/v3/scenario/insert_scenario_document_link.sql")
                for doc_id in doc_ids:
                    await conn.execute(sql, child_scenario_id, doc_id, True)

            # Link parameters
            if param_item_ids:
                sql = load_sql("app/sql/v3/scenario/insert_scenario_parameter_link.sql")
                for param_id in param_item_ids:
                    await conn.execute(sql, child_scenario_id, param_id, True)

            # Link department
            if selected_department_id:
                sql = load_sql("app/sql/v3/scenario/insert_scenario_department_link.sql")
                await conn.execute(sql, child_scenario_id, selected_department_id, True)

            logger.info(
                f"Created child scenario {child_scenario_id} for parent {parent_scenario_id}"
            )

            # Check which AI fields need filling
            # Check problem statement
            sql = load_sql("app/sql/v3/scenario/get_scenario_problem_statement.sql")
            problem_statement_row = await conn.fetchrow(sql, child_scenario_id)
            needs_statement = (
                not problem_statement_row
                or not problem_statement_row.get("problem_statement")
                or problem_statement_row.get("problem_statement") == ""
            )

            # Check objectives
            sql = load_sql("app/sql/v3/scenario/get_scenario_objectives.sql")
            objectives_rows = await conn.fetch(sql, child_scenario_id)
            needs_objectives = (
                parent_scenario_dict.get("objectives_enabled", True)
                and (not objectives_rows or len(objectives_rows) == 0)
            )

            # Check videos
            sql = load_sql("app/sql/v3/scenario/get_scenario_videos.sql")
            videos_rows = await conn.fetch(sql, child_scenario_id)
            needs_video = (
                parent_scenario_dict.get("video_enabled", False)
                and (not videos_rows or len(videos_rows) == 0)
            )

            # Check images
            sql = load_sql("app/sql/v3/scenario/get_scenario_images.sql")
            images_rows = await conn.fetch(sql, child_scenario_id)
            needs_images = (
                parent_scenario_dict.get("images_enabled", True)
                and (not images_rows or len(images_rows) == 0)
            )

            # Check questions
            sql = load_sql("app/sql/v3/scenario/get_scenario_questions.sql")
            questions_rows = await conn.fetch(sql, child_scenario_id)
            needs_questions = (
                parent_scenario_dict.get("questions_enabled", False)
                and (not questions_rows or len(questions_rows) == 0)
            )

            # If any AI fields needed, emit to scenario generate
            if needs_statement or needs_objectives or needs_video or needs_images or needs_questions:
                logger.info(
                    f"Child scenario {child_scenario_id} needs AI generation, emitting to scenario generate"
                )
                # Get department_id for scenario generation
                department_id = selected_department_id
                if not department_id and profile_id_uuid:
                    sql = load_sql("app/sql/v3/profile/get_departments_for_profile.sql")
                    profile_dept_rows = await conn.fetch(sql, str(profile_id_uuid))
                    if profile_dept_rows and len(profile_dept_rows) > 0:
                        department_id = uuid.UUID(str(profile_dept_rows[0]["id"]))

                if not department_id:
                    # Get any active department
                    sql = load_sql("app/sql/v3/departments/get_all_active_departments.sql")
                    all_dept_rows = await conn.fetch(sql)
                    if all_dept_rows and len(all_dept_rows) > 0:
                        department_id = uuid.UUID(str(all_dept_rows[0]["id"]))

                if not department_id:
                    await simulation_next_error(
                        SimulationNextErrorPayload(
                            success=False, message="No department found for scenario generation"
                        ),
                        room=sid,
                    )
                    return

                # Get scenario agent ID from parent scenario or simulation
                scenario_agent_id = parent_scenario_dict.get("scenario_agent_id")
                if not scenario_agent_id and simulation_id:
                    # Try to get from simulation
                    sql = load_sql("app/sql/v3/simulations/get_simulation_by_id.sql")
                    simulation_row = await conn.fetchrow(sql, uuid.UUID(simulation_id))
                    if simulation_row:
                        scenario_agent_id = simulation_row.get("simulation_text_agent_id")
                
                if not scenario_agent_id:
                    await simulation_next_error(
                        SimulationNextErrorPayload(
                            success=False, message="No scenario agent ID found"
                        ),
                        room=sid,
                    )
                    return

                # Emit to scenario generate with simulation_id if present
                await sio.emit(
                    "generate_scenario",
                    {
                        "scenarioId": str(child_scenario_id),
                        "departmentId": str(department_id),
                        "scenarioAgentId": str(scenario_agent_id),
                        "objectivesEnabled": needs_objectives,
                        "videoEnabled": needs_video,
                        "imagesEnabled": needs_images,
                        "questionsEnabled": needs_questions,
                        "profileId": profile_id,
                        "simulationId": simulation_id,  # Pass simulation_id so advance can be emitted after generation
                        "attemptId": attempt_id,  # Pass attempt_id for advance event
                    },
                    room=sid,
                )
            else:
                # No AI fields needed, emit to advance
                logger.info(
                    f"Child scenario {child_scenario_id} is ready, emitting to advance"
                )
                await internal_sio.emit(
                    "simulation_advance",
                    {
                        "scenario_id": str(child_scenario_id),
                        "attempt_id": attempt_id,
                        "profile_id": profile_id,
                        "simulation_id": simulation_id,
                    },
                )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="simulations.next",
                    template="{{ actor.name }} created next scenario",
                    context={"scenario_id": str(child_scenario_id)},
                    endpoint="/socket/v3/simulations/next",
                    error=False,
                )
            except Exception as log_error:
                logger.warning(
                    f"Error logging simulation next activity: {log_error}"
                )

    except Exception as e:
        logger.error(f"Error in simulation_next for {sid}: {str(e)}", exc_info=True)
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
                endpoint="/socket/v3/simulations/next",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging simulation next error activity: {log_error}"
            )


@internal_sio.on("simulation_next")  # type: ignore
async def simulation_next_internal(data: dict[str, Any]) -> None:
    """Handle simulation_next event from internal bus (server-to-server)."""
    try:
        validated = SimulationNextPayload(**data)
        # Get sid from data if present, otherwise use a default
        sid = data.get("sid", "internal")
        await _simulation_next_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_next_internal: {e}")
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

