"""Handler for simulation_text_end WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.main import get_internal_sio, get_pool, sio

# Import chat creation function from start.py
from app.socket.v3.simulations.start import simulation_chat_create_impl

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class EndSimulationErrorPayload(BaseModel):
    """Response indicating an error occurred while ending simulation."""

    success: bool
    message: str


class EndAllStartedPayload(BaseModel):
    """Response indicating end all operation started."""

    chat_id: str
    attempt_id: str


class EndChatStartedPayload(BaseModel):
    """Response indicating end chat operation started."""

    chat_id: str
    attempt_id: str


class EndAllCompletedPayload(BaseModel):
    """Response indicating end all operation completed."""

    success: bool
    message: str
    chat_id: str
    attempt_id: str | None = None
    completed_chat_ids: list[str] | None = None
    next_chat_ids: list[str | None] | None = None
    all_completed: bool | None = None


class SimulationEndedPayload(BaseModel):
    """Response indicating simulation was ended successfully."""

    success: bool
    message: str
    completed_chat_id: str
    next_chat_id: str | None
    is_attempt_finished: bool | None = None
    simulation_grade_id: str | None = None


# Pydantic model for client-to-server event
class EndSimulationPayload(BaseModel):
    """Request to end simulation chat."""

    chat_id: str
    attempt_id: str
    end_all: bool = False
    previous_chat_id: str | None = None
    previous_chat_map: dict[str, str | None] | None = None


# Emit helper functions
async def simulation_text_end_error(
    payload: EndSimulationErrorPayload, room: str
) -> None:
    await sio.emit("simulations_text_end_error", payload.model_dump(), room=room)


async def end_all_started(payload: EndAllStartedPayload, room: str) -> None:
    await sio.emit("simulations_text_end_all_started", payload.model_dump(), room=room)


async def end_chat_started(payload: EndChatStartedPayload, room: str) -> None:
    await sio.emit("simulations_text_end_chat_started", payload.model_dump(), room=room)


async def end_all_completed(payload: EndAllCompletedPayload, room: str) -> None:
    await sio.emit(
        "simulations_text_end_all_completed", payload.model_dump(), room=room
    )


async def simulation_ended(payload: SimulationEndedPayload, room: str) -> None:
    await sio.emit("simulations_text_ended", payload.model_dump(), room=room)


async def _end_simulation_impl(sid: str, data: EndSimulationPayload) -> None:
    """
    Handle simulation end requests via WebSocket
    Replaces /simulations/continue endpoint
    Ends current chat and creates next chat if needed using start.py's randomization logic
    """
    try:
        chat_id = data.chat_id
        attempt_id = data.attempt_id
        end_all = data.end_all
        previous_chat_id = data.previous_chat_id
        previous_chat_map = data.previous_chat_map
        # department_id is now derived server-side from chat/scenario context

        if not chat_id or not attempt_id:
            await simulation_text_end_error(
                EndSimulationErrorPayload(
                    success=False, message="Missing chat_id or attempt_id"
                ),
                room=sid,
            )
            return

        # Get connection pool
        # Replaced with get_db_connection()

        async with get_db_connection() as conn:
            # Get the chat
            sql = load_sql("app/sql/v3/simulations/get_chat_basic.sql")
            chat = await conn.fetchrow(sql, chat_id)
            if not chat:
                await simulation_text_end_error(
                    EndSimulationErrorPayload(success=False, message="Chat not found"),
                    room=sid,
                )
                return

            # Get the attempt with profile
            sql = load_sql("app/sql/v3/attempts/get_attempt_with_profile.sql")
            attempt_with_profile = await conn.fetchrow(sql, attempt_id)
            if not attempt_with_profile:
                await simulation_text_end_error(
                    EndSimulationErrorPayload(
                        success=False, message="Attempt not found"
                    ),
                    room=sid,
                )
                return

            # If end_all is True, emit end_all_started event immediately so all watchers see the loading state
            if end_all:
                await end_all_started(
                    EndAllStartedPayload(chat_id=chat_id, attempt_id=attempt_id),
                    room=f"simulation_{chat_id}",
                )
            else:
                # If end_all is False, emit end_chat_started event immediately so all watchers see the loading state
                await end_chat_started(
                    EndChatStartedPayload(chat_id=chat_id, attempt_id=attempt_id),
                    room=f"simulation_{chat_id}",
                )
            simulation_attempt = attempt_with_profile
            profile_id = attempt_with_profile.get("profile_id")

            # Extract department_id from chat/scenario for grading
            # SQL query includes fallback: scenario -> profile -> any active department
            sql = load_sql("app/sql/v3/simulations/get_simulation_run_context.sql")
            run_context = await conn.fetchrow(sql, chat_id)

            if not run_context:
                await simulation_text_end_error(
                    EndSimulationErrorPayload(
                        success=False,
                        message="Failed to get run context for chat",
                    ),
                    room=sid,
                )
                return

            # department_id should always be present due to SQL fallback logic
            # but handle edge case where no departments exist in system
            department_id = run_context.get("department_id")
            if not department_id:
                await simulation_text_end_error(
                    EndSimulationErrorPayload(
                        success=False,
                        message="No active departments found in system",
                    ),
                    room=sid,
                )
                return

            department_id = uuid.UUID(str(department_id))

            # Get the simulation
            sql = load_sql("app/sql/v3/simulations/get_simulation_by_id.sql")
            simulation = await conn.fetchrow(
                sql, str(simulation_attempt["simulation_id"])
            )
            if not simulation:
                await simulation_text_end_error(
                    EndSimulationErrorPayload(
                        success=False, message="Simulation not found"
                    ),
                    room=sid,
                )
                return

            # Practice simulations cannot use previous chats - must always go through manual grading
            is_practice_simulation = bool(simulation.get("practice_simulation", False))
            if is_practice_simulation and (previous_chat_id or previous_chat_map):
                await simulation_text_end_error(
                    EndSimulationErrorPayload(
                        success=False,
                        message="Practice simulations cannot reuse previous attempts. Manual grading is required.",
                    ),
                    room=sid,
                )
                return

            # Load scenarios for this simulation from junction table
            sql = load_sql(
                "app/sql/v3/simulations/get_simulation_scenarios_ordered.sql"
            )
            scenario_links = await conn.fetch(sql, str(simulation["id"]))
            is_infinite_mode = bool(simulation_attempt["infinite_mode"])

            # Get existing chats for this attempt
            sql = load_sql("app/sql/v3/attempts/get_existing_chats_for_attempt.sql")
            existing_chats = await conn.fetch(sql, attempt_id)

            # Debug: Check if existing_chats have 'id' field
            if existing_chats and "id" not in existing_chats[0]:
                await simulation_text_end_error(
                    EndSimulationErrorPayload(
                        success=False,
                        message=f"Existing chats missing 'id' field: {existing_chats[0]}",
                    ),
                    room=sid,
                )
                return

            # Get parent scenarios from simulation_scenarios that have at least one graded chat
            # A scenario is considered "done" if it has a chat (linked via attempt_chats) with a grade
            # This uses simulation_scenarios as the source of truth
            sql = load_sql("app/sql/v3/simulations/get_scenarios_with_grades.sql")
            scenarios_with_grades = await conn.fetch(sql, attempt_id)
            scenarios_with_grades_set = {
                str(row["parent_scenario_id"]) for row in scenarios_with_grades
            }

            # Get current chat's scenario_id to exclude it from next scenario selection
            # (for normal grading, we don't want to create another chat for the current scenario)
            # Recursively map child scenario ID to root parent ID for comparison with scenario_links (which contain parent IDs)
            current_chat_child_scenario_id = str(chat.get("scenario_id"))
            sql = load_sql("app/sql/v3/scenario/get_root_scenario_id.sql")
            current_chat_parent_row = await conn.fetchrow(
                sql, current_chat_child_scenario_id
            )
            current_chat_scenario_id = (
                str(current_chat_parent_row["root_scenario_id"])
                if current_chat_parent_row
                and current_chat_parent_row.get("root_scenario_id")
                else current_chat_child_scenario_id
            )

            # Also get scenarios that already have chats (even without grades) to avoid duplicates
            # This prevents creating multiple chats for the same scenario in the same attempt
            # Recursively map child scenario IDs to root parent IDs for comparison with scenario_links (which contain parent IDs)
            existing_scenario_ids = set()
            if existing_chats:
                child_scenario_ids = [
                    str(ec.get("scenario_id"))
                    for ec in existing_chats
                    if ec.get("scenario_id")
                ]
                if child_scenario_ids:
                    # Batch query to recursively map all child IDs to root parent IDs
                    sql = load_sql("app/sql/v3/scenario/get_root_scenario_id.sql")
                    parent_mappings = []
                    for child_id in child_scenario_ids:
                        root_row = await conn.fetchrow(sql, child_id)
                        if root_row and root_row.get("root_scenario_id"):
                            parent_mappings.append(
                                {
                                    "child_id": child_id,
                                    "parent_id": str(root_row["root_scenario_id"]),
                                }
                            )
                    # Filter to only include parents that are actually in scenario_links
                    # This prevents excluding scenarios from other simulations/scenarios
                    scenario_links_parent_ids = {
                        str(sl["scenario_id"]) for sl in scenario_links
                    }
                    existing_scenario_ids = {
                        row["parent_id"]
                        for row in parent_mappings
                        if row["parent_id"] in scenario_links_parent_ids
                    }

            # Find the next scenario index that doesn't have a graded chat
            # Exclude the current chat's scenario (it will be graded but doesn't have a grade yet)
            # Also exclude scenarios that already have chats (to prevent duplicates)
            next_index = None
            for idx, scenario_link in enumerate(scenario_links):
                scenario_id_str = str(scenario_link["scenario_id"])
                # Skip scenarios that:
                # 1. Already have grades (completed with grade)
                # 2. Are the current chat's scenario (will be graded)
                # 3. Already have a chat in this attempt (prevent duplicates)
                if (
                    scenario_id_str not in scenarios_with_grades_set
                    and scenario_id_str != current_chat_scenario_id
                    and scenario_id_str not in existing_scenario_ids
                ):
                    next_index = idx
                    break

            # If all scenarios have graded chats or only current scenario remains, use the length for infinite mode cycling
            if next_index is None:
                next_index = len(scenario_links)

            # Handle previous_chat_id if provided (reusing score from previous attempt)
            if previous_chat_id:
                # Link the previous chat to current attempt via junction table
                sql = load_sql("app/sql/v3/attempts/link_chat_to_attempt.sql")
                await conn.execute(sql, attempt_id, previous_chat_id)

                # Check if the previous chat has a grade and update scenarios_with_grades_set
                sql = load_sql("app/sql/v3/simulations/get_previous_chat_info.sql")
                prev_chat_info = await conn.fetchrow(sql, previous_chat_id)
                if (
                    prev_chat_info
                    and prev_chat_info["has_grade"]
                    and prev_chat_info["scenario_id"]
                ):
                    # Recursively map child scenario ID to root parent ID for comparison with scenario_links
                    prev_chat_child_scenario_id = str(prev_chat_info["scenario_id"])
                    sql = load_sql("app/sql/v3/scenario/get_root_scenario_id.sql")
                    prev_chat_parent_row = await conn.fetchrow(
                        sql, prev_chat_child_scenario_id
                    )
                    prev_chat_parent_scenario_id = (
                        str(prev_chat_parent_row["root_scenario_id"])
                        if prev_chat_parent_row
                        and prev_chat_parent_row.get("root_scenario_id")
                        else prev_chat_child_scenario_id
                    )
                    scenarios_with_grades_set.add(prev_chat_parent_scenario_id)
                    # Recalculate next_index since we now have a new scenario with a grade
                    # Also need to check against existing_scenario_ids
                    next_index = None
                    for idx, scenario_link in enumerate(scenario_links):
                        scenario_id_str = str(scenario_link["scenario_id"])
                        if (
                            scenario_id_str not in scenarios_with_grades_set
                            and scenario_id_str != current_chat_scenario_id
                            and scenario_id_str not in existing_scenario_ids
                        ):
                            next_index = idx
                            break
                    if next_index is None:
                        next_index = len(scenario_links)

                # Mark current incomplete chat as completed (without grade = skipped)
                sql = load_sql("app/sql/v3/simulations/update_chat_completed.sql")
                await conn.execute(sql, chat_id)

                # If end_all, mark all remaining incomplete chats as completed
                if end_all:
                    for existing_chat in existing_chats:
                        if not existing_chat["completed"] and str(
                            existing_chat["id"]
                        ) != str(chat_id):
                            sql = load_sql(
                                "app/sql/v3/simulations/update_chat_completed.sql"
                            )
                            await conn.execute(sql, str(existing_chat["id"]))

            # Handle previous_chat_map if provided (for end_all with permutations)
            created_chats_count_map = 0
            if end_all and previous_chat_map:
                # Mark current chat as completed (without grading - user is using previous chat scores)
                sql = load_sql("app/sql/v3/simulations/update_chat_completed.sql")
                await conn.execute(sql, chat_id)

                # Get scenario IDs that already have chats in this attempt
                # Recursively map child scenario IDs to root parent IDs for comparison with scenario_links (which contain parent IDs)
                existing_scenario_ids = set()
                if existing_chats:
                    child_scenario_ids = [
                        str(ec.get("scenario_id"))
                        for ec in existing_chats
                        if ec.get("scenario_id")
                    ]
                    if child_scenario_ids:
                        # Batch query to recursively map all child IDs to root parent IDs
                        sql = load_sql("app/sql/v3/scenario/get_root_scenario_id.sql")
                        parent_mappings = []
                        for child_id in child_scenario_ids:
                            root_row = await conn.fetchrow(sql, child_id)
                            if root_row and root_row.get("root_scenario_id"):
                                parent_mappings.append(
                                    {
                                        "child_id": child_id,
                                        "parent_id": str(root_row["root_scenario_id"]),
                                    }
                                )
                        # Filter to only include parents that are actually in scenario_links
                        # This prevents excluding scenarios from other simulations/scenarios
                        scenario_links_parent_ids = {
                            str(sl["scenario_id"]) for sl in scenario_links
                        }
                        existing_scenario_ids = {
                            row["parent_id"]
                            for row in parent_mappings
                            if row["parent_id"] in scenario_links_parent_ids
                        }

                # Process ALL scenarios in the simulation
                # For each scenario in previous_chat_map: link previous chat if provided
                # For scenarios NOT in previous_chat_map: create skipped chat if they don't have a chat yet
                for scenario_link in scenario_links:
                    scenario_id_str = str(scenario_link["scenario_id"])

                    if scenario_id_str in previous_chat_map:
                        # User selected a previous chat to reuse for this scenario
                        prev_chat_id = previous_chat_map[scenario_id_str]
                        if prev_chat_id:
                            # Link the previous chat to current attempt via junction table
                            sql = load_sql(
                                "app/sql/v3/attempts/link_chat_to_attempt.sql"
                            )
                            await conn.execute(sql, attempt_id, prev_chat_id)

                            # Check if the previous chat has a grade and update scenarios_with_grades_set
                            sql = load_sql(
                                "app/sql/v3/simulations/get_previous_chat_info.sql"
                            )
                            prev_chat_info = await conn.fetchrow(sql, prev_chat_id)
                            if (
                                prev_chat_info
                                and prev_chat_info["has_grade"]
                                and prev_chat_info["scenario_id"]
                            ):
                                # Recursively map child scenario ID to root parent ID for comparison with scenario_links
                                prev_chat_child_scenario_id = str(
                                    prev_chat_info["scenario_id"]
                                )
                                sql = load_sql(
                                    "app/sql/v3/scenario/get_root_scenario_id.sql"
                                )
                                prev_chat_parent_row = await conn.fetchrow(
                                    sql, prev_chat_child_scenario_id
                                )
                                prev_chat_parent_scenario_id = (
                                    str(prev_chat_parent_row["root_scenario_id"])
                                    if prev_chat_parent_row
                                    and prev_chat_parent_row.get("root_scenario_id")
                                    else prev_chat_child_scenario_id
                                )
                                scenarios_with_grades_set.add(
                                    prev_chat_parent_scenario_id
                                )
                    elif scenario_id_str not in existing_scenario_ids:
                        # Scenario not in map and doesn't have a chat yet = skipped, create new completed chat (no grade)
                        created = await simulation_chat_create_impl(
                            conn,
                            scenario_id_str,
                            attempt_id,
                            profile_id,
                            mark_completed=True,
                        )
                        if created is None:
                            # Scenario not found, skip it
                            continue
                        created_chats_count_map += 1
            elif end_all and not previous_chat_map and not previous_chat_id:
                # If end_all but no previous_chat_map or previous_chat_id, mark all remaining incomplete chats as completed (skipped)
                for existing_chat in existing_chats:
                    if not existing_chat["completed"]:
                        sql = load_sql(
                            "app/sql/v3/simulations/update_chat_completed.sql"
                        )
                        await conn.execute(sql, str(existing_chat["id"]))

            # Check for next incomplete scenario and emit to next.py if found
            # (Don't create chat here - let next.py handle it)
            next_chat_id: str | None = None
            if not end_all:
                # Check if there's a next incomplete scenario
                sql = load_sql(
                    "app/sql/v3/simulations/check_next_incomplete_scenario.sql"
                )
                next_scenario_row = await conn.fetchrow(sql, attempt_id)

                if next_scenario_row and next_scenario_row.get("has_next_scenario"):
                    next_scenario_id = next_scenario_row.get("next_scenario_id")
                    if next_scenario_id:
                        # Emit to next.py handler - it will create the scenario/chat
                        await internal_sio.emit(
                            "simulation_next",
                            {
                                "attempt_id": str(attempt_id),
                                "scenario_id": str(next_scenario_id),
                                "profile_id": str(profile_id) if profile_id else None,
                                "simulation_id": str(simulation["id"]),
                            },
                        )
                        # Note: next_chat_id will be None here - client will receive it via advance event

            # Grade the just-completed chat if it has at least 2 messages
            # Skip grading if using previous_chat_id or previous_chat_map (user is reusing previous scores)
            simulation_grade_id = None
            if not previous_chat_id and not previous_chat_map:
                # Use optimized batch query to get message counts
                existing_chat_ids = [str(c["id"]) for c in existing_chats]
                sql = load_sql(
                    "app/sql/v3/simulations/get_messages_count_by_chat_ids.sql"
                )
                message_counts = await conn.fetch(sql, existing_chat_ids)
                message_count_map = {
                    str(row["chat_id"]): row["message_count"] for row in message_counts
                }

                chat_message_count = message_count_map.get(chat_id, 0)
                if chat_message_count >= 2:
                    # Emit grading start event (non-blocking)
                    await internal_sio.emit(
                        "simulation_grading_start",
                        {
                            "chat_id": chat_id,
                            "department_id": str(department_id),
                            "sid": sid,
                        },
                    )
                    simulation_grade_id = None  # Grading is now async, grade_id will be available via progress events

                    # After grading completes, add current chat's parent scenario to scenarios_with_grades_set
                    # and recalculate next_index (similar to previous_chat_id handling)
                    # This is mainly for tracking purposes - the next chat was already created correctly
                    # because we excluded current_chat_scenario_id and existing_scenario_ids when creating it
                    # Recursively map child scenario ID to root parent ID (scenarios_with_grades_set uses parent IDs from simulation_scenarios)
                    graded_chat_child_scenario_id = str(chat.get("scenario_id"))
                    if graded_chat_child_scenario_id:
                        # Recursively map to root parent ID from scenario_tree
                        sql = load_sql("app/sql/v3/scenario/get_root_scenario_id.sql")
                        graded_chat_parent_row = await conn.fetchrow(
                            sql, graded_chat_child_scenario_id
                        )
                        graded_chat_parent_scenario_id = (
                            str(graded_chat_parent_row["root_scenario_id"])
                            if graded_chat_parent_row
                            and graded_chat_parent_row.get("root_scenario_id")
                            else graded_chat_child_scenario_id
                        )
                        # Only add if this parent scenario is actually in simulation_scenarios
                        # (it should be, but verify to be safe)
                        if graded_chat_parent_scenario_id in {
                            str(sl["scenario_id"]) for sl in scenario_links
                        }:
                            scenarios_with_grades_set.add(
                                graded_chat_parent_scenario_id
                            )
                        # Recalculate next_index since we now have a new scenario with a grade
                        # This is for consistency and future operations, but shouldn't affect next_chat_id
                        # since it was already created with proper exclusions
                        next_index = None
                        for idx, scenario_link in enumerate(scenario_links):
                            scenario_id_str = str(scenario_link["scenario_id"])
                            if scenario_id_str not in scenarios_with_grades_set:
                                next_index = idx
                                break
                        if next_index is None:
                            next_index = len(scenario_links)

                # Mark the current chat as completed (if not already marked by previous_chat_map handling)
                if not (end_all and previous_chat_map):
                    sql = load_sql("app/sql/v3/simulations/update_chat_completed.sql")
                    await conn.execute(sql, chat_id)

            created_chats_count = 0
            # Only process remaining chats if not using previous_chat_map (already handled above)
            if end_all and not previous_chat_id and not previous_chat_map:
                # End any other incomplete chats for this attempt
                existing_chat_ids = [str(c["id"]) for c in existing_chats]
                sql = load_sql(
                    "app/sql/v3/simulations/get_messages_count_by_chat_ids.sql"
                )
                message_counts = await conn.fetch(sql, existing_chat_ids)
                message_count_map = {
                    str(row["chat_id"]): row["message_count"] for row in message_counts
                }

                for existing_chat in existing_chats:
                    if not existing_chat["completed"] and str(
                        existing_chat["id"]
                    ) != str(chat_id):
                        other_message_count = message_count_map.get(
                            str(existing_chat["id"]), 0
                        )
                        if other_message_count >= 2:
                            # Emit grading start event (non-blocking)
                            await internal_sio.emit(
                                "simulation_grading_start",
                                {
                                    "chat_id": str(existing_chat["id"]),
                                    "department_id": str(department_id),
                                    "sid": sid,
                                },
                            )
                        sql = load_sql(
                            "app/sql/v3/simulations/update_chat_completed.sql"
                        )
                        await conn.execute(sql, str(existing_chat["id"]))

                # Calculate and create remaining chats in order
                # Skip creating remaining chats in infinite mode - just stop here
                if not is_infinite_mode:
                    start_index = len(existing_chats)
                    total_needed = max(0, len(scenario_links) - start_index)

                    for offset in range(total_needed):
                        next_id = scenario_links[start_index + offset]["scenario_id"]
                        created = await simulation_chat_create_impl(
                            conn,
                            str(next_id),
                            attempt_id,
                            profile_id,
                            mark_completed=True,
                        )
                        if created is None:
                            break
                        created_chats_count += 1

            # Determine if attempt is finished: ALL parent scenarios from simulation_scenarios
            # must have at least one graded chat (linked via attempt_chats)
            # This uses simulation_scenarios as the source of truth
            # For infinite mode, attempts never finish (they cycle indefinitely)
            if is_infinite_mode:
                is_attempt_finished = False
            else:
                sql = load_sql("app/sql/v3/simulations/get_scenarios_with_grades.sql")
                scenarios_with_grades_for_finished_check = await conn.fetch(
                    sql, attempt_id
                )
                scenarios_with_grades_for_finished = {
                    str(row["parent_scenario_id"])
                    for row in scenarios_with_grades_for_finished_check
                }
                # Check if all parent scenarios from simulation_scenarios have graded chats
                all_parent_scenario_ids = {
                    str(sl["scenario_id"]) for sl in scenario_links
                }
                is_attempt_finished = len(
                    all_parent_scenario_ids
                ) > 0 and all_parent_scenario_ids.issubset(
                    scenarios_with_grades_for_finished
                )

            # Include chats created from previous_chat_map handling
            total_created_chats = created_chats_count + created_chats_count_map

            result = {
                "completed_chat_id": chat_id,
                "next_chat_id": next_chat_id,
                "is_attempt_finished": bool(is_attempt_finished),
                "simulation_grade_id": simulation_grade_id,
                "created_chats_count": total_created_chats,
            }

            if end_all:
                # Get all chat IDs for this attempt to help frontend with cache invalidation
                sql = load_sql("app/sql/v3/attempts/get_existing_chats_for_attempt.sql")
                all_chats = await conn.fetch(sql, attempt_id)
                completed_chat_ids = [
                    str(c["id"]) for c in all_chats if c.get("completed")
                ]
                next_chat_ids: list[str | None] = [
                    str(c["id"]) for c in all_chats if not c.get("completed")
                ]

                # Emit end all completed event
                payload_obj = EndAllCompletedPayload(
                    success=True,
                    message="Ended all chats for this attempt",
                    chat_id=chat_id,
                    attempt_id=attempt_id,
                    completed_chat_ids=completed_chat_ids
                    if completed_chat_ids
                    else None,
                    next_chat_ids=next_chat_ids if next_chat_ids else None,
                    all_completed=True,
                )
                # Emit to requester
                await end_all_completed(payload_obj, room=sid)
                # Also broadcast to the simulation room so watchers stay in sync
                await end_all_completed(payload_obj, room=f"simulation_{chat_id}")
            else:
                # Emit the new, more descriptive success response for single chat
                ended_payload = SimulationEndedPayload(
                    success=True,
                    message="Simulation ended successfully",
                    completed_chat_id=str(result["completed_chat_id"]),
                    next_chat_id=str(result["next_chat_id"])
                    if result["next_chat_id"]
                    else None,
                    is_attempt_finished=bool(result["is_attempt_finished"])
                    if result["is_attempt_finished"] is not None
                    else None,
                    simulation_grade_id=str(result["simulation_grade_id"])
                    if result["simulation_grade_id"]
                    else None,
                )
                # Emit to requester
                await simulation_ended(ended_payload, room=sid)
                # Also broadcast to the simulation room so watchers stay in sync
                await simulation_ended(ended_payload, room=f"simulation_{chat_id}")
                # Log activity
                try:
                    await log_websocket_activity(
                        sid=sid,
                        event_key="simulations.text.end",
                        template="{{ actor.name }} ended simulation",
                        context={"chat_id": str(chat_id)},
                        endpoint="/socket/v3/simulations/text/end",
                        error=False,
                    )
                except Exception as log_error:
    except Exception as e:
        await simulation_text_end_error(
            EndSimulationErrorPayload(
                success=False, message=f"Failed to end simulation: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.text.end",
                template="{{ actor.name }} failed to end simulation",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/text/end",
                error=True,
            )
        except Exception as log_error:
@sio.event  # type: ignore
async def simulation_text_end(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = EndSimulationPayload(**data)
        await _end_simulation_impl(sid, validated)
    except ValidationError as e:
        await simulation_text_end_error(
            EndSimulationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.text.end",
                template="{{ actor.name }} failed to end simulation (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/text/end",
                error=True,
            )
        except Exception as log_error:
    except Exception as e:
        await simulation_text_end_error(
            EndSimulationErrorPayload(
                success=False, message=f"Unexpected error: {str(e)}"
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.text.end",
                template="{{ actor.name }} failed to end simulation (unexpected error)",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/text/end",
                error=True,
            )
        except Exception as log_error:
# FastAPI endpoint for OpenAPI documentation
@client_router.post("/end", response_model=dict[str, bool])
async def simulation_text_end_api(
    request: EndSimulationPayload,
) -> dict[str, bool]:
    """Client-to-server event: End simulation chat."""
    return {"success": True}


@server_router.post("/end_error", response_model=dict[str, bool])
async def simulation_text_end_error_api(
    request: EndSimulationErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while ending simulation."""
    return {"success": True}


@server_router.post("/ended", response_model=dict[str, bool])
async def simulation_ended_api(
    request: SimulationEndedPayload,
) -> dict[str, bool]:
    """Server-to-client event: Simulation ended successfully."""
    return {"success": True}


@server_router.post("/end_all_started", response_model=dict[str, bool])
async def end_all_started_api(request: EndAllStartedPayload) -> dict[str, bool]:
    """Server-to-client event: Ending all chats started."""
    return {"success": True}


@server_router.post("/end_chat_started", response_model=dict[str, bool])
async def end_chat_started_api(request: EndChatStartedPayload) -> dict[str, bool]:
    """Server-to-client event: Ending chat started."""
    return {"success": True}


@server_router.post("/end_all_completed", response_model=dict[str, bool])
async def end_all_completed_api(request: EndAllCompletedPayload) -> dict[str, bool]:
    """Server-to-client event: Ending all chats completed."""
    return {"success": True}
