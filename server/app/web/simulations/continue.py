"""Handler for continue_simulation WebSocket event."""

import logging
import uuid
from typing import Any

from app.agents.collection.grade import run_grade_agent
from app.db import get_pool
from app.utils.sql_helper import load_sql
from app.web.simulations.utils import (
    _create_chat_for_scenario,
    emit_error,
    get_sio_instance,
)

logger = logging.getLogger(__name__)


async def handle_continue_simulation(sid: str, data: dict[str, Any]) -> None:
    """
    Handle simulation continue requests via WebSocket
    Replaces /simulations/continue endpoint
    Inlined from SimulationService.continue_simulation_attempt to use SQL files
    """
    try:
        chat_id = data.get("chat_id")
        attempt_id = data.get("attempt_id")
        end_all = data.get("end_all", False)
        previous_chat_id = data.get("previous_chat_id")
        previous_chat_map = data.get("previous_chat_map")  # Map of scenario_id -> previous_chat_id

        if not chat_id or not attempt_id:
            await emit_error(sid, "Missing chat_id or attempt_id")
            return

        # Get connection pool
        pool = get_pool()
        if not pool:
            await emit_error(sid, "Database connection pool not available")
            return

        async with pool.acquire() as conn:
            sio_instance = get_sio_instance()
            
            # Get the chat
            sql = load_sql("sql/v3/simulations/get_chat_basic.sql")
            chat = await conn.fetchrow(sql, chat_id)
            if not chat:
                await emit_error(sid, "Chat not found")
                return

            # Get the attempt with profile
            sql = load_sql("sql/v3/attempts/get_attempt_with_profile.sql")
            attempt_with_profile = await conn.fetchrow(sql, attempt_id)
            if not attempt_with_profile:
                await emit_error(sid, "Attempt not found")
                return
            
            simulation_attempt = attempt_with_profile
            profile_id = attempt_with_profile.get("profile_id")
            
            # Extract department_id from chat/scenario for grading
            sql = load_sql("sql/v3/agents/get_simulation_run_context.sql")
            run_context = await conn.fetchrow(sql, chat_id)
            
            if not run_context or not run_context.get("department_id"):
                await emit_error(sid, f"Failed to get department_id from run context for chat {chat_id}")
                return
            
            department_id = run_context["department_id"]

            # Get the simulation
            sql = load_sql("sql/v3/simulations/get_simulation_by_id.sql")
            simulation = await conn.fetchrow(sql, str(simulation_attempt["simulation_id"]))
            if not simulation:
                await emit_error(sid, "Simulation not found")
                return

            # Load scenarios for this simulation from junction table
            sql = load_sql("sql/v3/simulations/get_simulation_scenarios_ordered.sql")
            scenario_links = await conn.fetch(sql, str(simulation["id"]))
            is_infinite_mode = bool(simulation_attempt["infinite_mode"])

            # Get existing chats for this attempt
            sql = load_sql("sql/v3/attempts/get_existing_chats_for_attempt.sql")
            existing_chats = await conn.fetch(sql, attempt_id)
            
            # Debug: Check if existing_chats have 'id' field
            if existing_chats and "id" not in existing_chats[0]:
                await emit_error(sid, f"Existing chats missing 'id' field: {existing_chats[0]}")
                return
            
            # Get scenarios that already have graded chats (completed with grade)
            # A scenario is considered done only if it has at least one chat with a grade
            sql = load_sql("sql/v3/simulations/get_scenarios_with_grades.sql")
            scenarios_with_grades = await conn.fetch(sql, attempt_id)
            scenarios_with_grades_set = {
                str(row["scenario_id"]) for row in scenarios_with_grades
            }
            
            # Get current chat's scenario_id to exclude it from next scenario selection
            # (for normal grading, we don't want to create another chat for the current scenario)
            current_chat_scenario_id = str(chat.get("scenario_id"))
            
            # Also get scenarios that already have chats (even without grades) to avoid duplicates
            # This prevents creating multiple chats for the same scenario in the same attempt
            existing_scenario_ids = {
                str(ec.get("scenario_id")) for ec in existing_chats if ec.get("scenario_id")
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
                if (scenario_id_str not in scenarios_with_grades_set 
                    and scenario_id_str != current_chat_scenario_id
                    and scenario_id_str not in existing_scenario_ids):
                    next_index = idx
                    break
            
            # If all scenarios have graded chats or only current scenario remains, use the length for infinite mode cycling
            if next_index is None:
                next_index = len(scenario_links)

            # Handle previous_chat_id if provided (reusing score from previous attempt)
            if previous_chat_id:
                # Link the previous chat to current attempt via junction table
                sql = load_sql("sql/v3/attempts/link_chat_to_attempt.sql")
                await conn.execute(sql, attempt_id, previous_chat_id)
                
                # Check if the previous chat has a grade and update scenarios_with_grades_set
                sql = load_sql("sql/v3/simulations/get_previous_chat_info.sql")
                prev_chat_info = await conn.fetchrow(sql, previous_chat_id)
                if prev_chat_info and prev_chat_info["has_grade"] and prev_chat_info["scenario_id"]:
                    scenarios_with_grades_set.add(str(prev_chat_info["scenario_id"]))
                    # Recalculate next_index since we now have a new scenario with a grade
                    next_index = None
                    for idx, scenario_link in enumerate(scenario_links):
                        scenario_id_str = str(scenario_link["scenario_id"])
                        if scenario_id_str not in scenarios_with_grades_set:
                            next_index = idx
                            break
                    if next_index is None:
                        next_index = len(scenario_links)
                
                # Mark current incomplete chat as completed (without grade = skipped)
                sql = load_sql("sql/v3/simulations/update_chat_completed.sql")
                await conn.execute(sql, chat_id)
                
                # If end_all, mark all remaining incomplete chats as completed
                if end_all:
                    for existing_chat in existing_chats:
                        if not existing_chat["completed"] and existing_chat["id"] != chat_id:
                            sql = load_sql("sql/v3/simulations/update_chat_completed.sql")
                            await conn.execute(sql, str(existing_chat["id"]))
            
            # Handle previous_chat_map if provided (for end_all with permutations)
            created_chats_count_map = 0
            if end_all and previous_chat_map:
                # Mark current chat as completed (without grading - user is using previous chat scores)
                sql = load_sql("sql/v3/simulations/update_chat_completed.sql")
                await conn.execute(sql, chat_id)
                
                # Get scenario IDs that already have chats in this attempt
                existing_scenario_ids = {
                    str(ec.get("scenario_id")) for ec in existing_chats if ec.get("scenario_id")
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
                            sql = load_sql("sql/v3/attempts/link_chat_to_attempt.sql")
                            await conn.execute(sql, attempt_id, prev_chat_id)
                            
                            # Check if the previous chat has a grade and update scenarios_with_grades_set
                            sql = load_sql("sql/v3/simulations/get_previous_chat_info.sql")
                            prev_chat_info = await conn.fetchrow(sql, prev_chat_id)
                            if prev_chat_info and prev_chat_info["has_grade"] and prev_chat_info["scenario_id"]:
                                scenarios_with_grades_set.add(str(prev_chat_info["scenario_id"]))
                    elif scenario_id_str not in existing_scenario_ids:
                        # Scenario not in map and doesn't have a chat yet = skipped, create new completed chat (no grade)
                        created = await _create_chat_for_scenario(
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
                        sql = load_sql("sql/v3/simulations/update_chat_completed.sql")
                        await conn.execute(sql, str(existing_chat["id"]))
            
            # Create next chat if not end_all (works for both previous_chat_id and normal cases)
            next_chat_id = chat_id
            if not end_all and scenario_links:
                next_scenario_id = None
                if is_infinite_mode:
                    # Cycle through the configured scenarios indefinitely
                    # Find the next scenario without a graded chat, cycling if needed
                    # Exclude the current chat's scenario (it will be graded but doesn't have a grade yet)
                    # Also exclude scenarios that already have chats (to prevent duplicates)
                    num_scenarios = len(scenario_links)
                    if num_scenarios > 0:
                        # Start from next_index and cycle until we find one without a graded chat
                        for offset in range(num_scenarios):
                            cycling_index = (next_index + offset) % num_scenarios
                            scenario_id_str = str(scenario_links[cycling_index]["scenario_id"])
                            # Skip scenarios that:
                            # 1. Already have grades OR
                            # 2. Are the current chat's scenario OR
                            # 3. Already have a chat in this attempt
                            if (scenario_id_str not in scenarios_with_grades_set 
                                and scenario_id_str != current_chat_scenario_id
                                and scenario_id_str not in existing_scenario_ids):
                                next_scenario_id = scenario_links[cycling_index]["scenario_id"]
                                break
                elif next_index is not None and next_index < len(scenario_links):
                    # Use the next scenario that doesn't have a graded chat
                    # (next_index already excludes current_chat_scenario_id)
                    next_scenario_id = scenario_links[next_index]["scenario_id"]

                if next_scenario_id is not None:
                    # Double-check that this scenario doesn't already have a graded chat,
                    # is not the current chat's scenario, and doesn't already have a chat
                    # (it might have been created between the query and now)
                    scenario_id_str = str(next_scenario_id)
                    if (scenario_id_str not in scenarios_with_grades_set 
                        and scenario_id_str != current_chat_scenario_id
                        and scenario_id_str not in existing_scenario_ids):
                        created_next_chat = await _create_chat_for_scenario(
                            conn,
                            scenario_id_str,
                            attempt_id,
                            profile_id,
                            mark_completed=False,
                        )
                        if created_next_chat is None:
                            await emit_error(sid, "Next scenario not found")
                            return
                        if "id" not in created_next_chat:
                            await emit_error(sid, f"Created chat missing 'id' field: {created_next_chat}")
                            return
                        next_chat_id = created_next_chat["id"]

            # Grade the just-completed chat if it has at least 2 messages
            # Skip grading if using previous_chat_id or previous_chat_map (user is reusing previous scores)
            simulation_grade_id = None
            if not previous_chat_id and not previous_chat_map:
                # Use optimized batch query to get message counts
                existing_chat_ids = [str(c["id"]) for c in existing_chats]
                sql = load_sql("sql/v3/simulations/get_messages_count_by_chat_ids.sql")
                message_counts = await conn.fetch(sql, existing_chat_ids)
                message_count_map = {
                    str(row["chat_id"]): row["message_count"] for row in message_counts
                }

                chat_message_count = message_count_map.get(chat_id, 0)
                if chat_message_count >= 2:
                    simulation_grade_id = await run_grade_agent(
                        uuid.UUID(chat_id), uuid.UUID(department_id), conn, sio_instance
                    )  # type: ignore
                    
                    # After grading completes, add current chat's scenario to scenarios_with_grades_set
                    # and recalculate next_index (similar to previous_chat_id handling)
                    # This is mainly for tracking purposes - the next chat was already created correctly
                    # because we excluded current_chat_scenario_id and existing_scenario_ids when creating it
                    graded_chat_scenario_id = str(chat.get("scenario_id"))
                    if graded_chat_scenario_id:
                        scenarios_with_grades_set.add(graded_chat_scenario_id)
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
                    sql = load_sql("sql/v3/simulations/update_chat_completed.sql")
                    await conn.execute(sql, chat_id)

            created_chats_count = 0
            # Only process remaining chats if not using previous_chat_map (already handled above)
            if end_all and not previous_chat_id and not previous_chat_map:
                # End any other incomplete chats for this attempt
                existing_chat_ids = [str(c["id"]) for c in existing_chats]
                sql = load_sql("sql/v3/simulations/get_messages_count_by_chat_ids.sql")
                message_counts = await conn.fetch(sql, existing_chat_ids)
                message_count_map = {
                    str(row["chat_id"]): row["message_count"] for row in message_counts
                }
                
                for existing_chat in existing_chats:
                    if not existing_chat["completed"] and existing_chat["id"] != chat_id:
                        other_message_count = message_count_map.get(
                            str(existing_chat["id"]), 0
                        )
                        if other_message_count >= 2:
                            await run_grade_agent(
                                uuid.UUID(str(existing_chat["id"])),
                                uuid.UUID(department_id),
                                conn,
                                sio_instance,
                            )  # type: ignore
                        sql = load_sql("sql/v3/simulations/update_chat_completed.sql")
                        await conn.execute(sql, str(existing_chat["id"]))

                # Calculate and create remaining chats in order
                start_index = len(existing_chats)
                total_needed = max(0, len(scenario_links) - start_index)

                for offset in range(total_needed):
                    next_id = scenario_links[start_index + offset]["scenario_id"]
                    created = await _create_chat_for_scenario(
                        conn,
                        str(next_id), 
                        attempt_id, 
                        profile_id, 
                        mark_completed=True
                    )
                    if created is None:
                        break
                    created_chats_count += 1

            is_attempt_finished = next_chat_id == chat_id

            # Include chats created from previous_chat_map handling
            total_created_chats = created_chats_count + created_chats_count_map

            result = {
                "completed_chat_id": chat_id,
                "next_chat_id": next_chat_id,
                "is_attempt_finished": is_attempt_finished,
                "simulation_grade_id": simulation_grade_id,
                "created_chats_count": total_created_chats,
            }

            if end_all:
                logger.info(
                    f"End all completed for attempt {attempt_id}: created {result['created_chats_count']} new chats"
                )

                # Emit end all completed event
                payload = {
                    "success": True,
                    "message": "Ended all chats for this attempt",
                    "attempt_id": attempt_id,
                }
                # Emit to requester
                await sio_instance.emit(
                    "end_all_completed",
                    payload,
                    room=sid,
                )
                # Also broadcast to the simulation room so watchers stay in sync
                await sio_instance.emit(
                    "end_all_completed",
                    payload,
                    room=f"simulation_{chat_id}",
                )
            else:
                # Emit the new, more descriptive success response for single chat
                payload = {
                    "success": True,
                    "message": "Simulation continued successfully",
                    "completed_chat_id": str(result["completed_chat_id"]),
                    "next_chat_id": str(result["next_chat_id"]),
                    "is_attempt_finished": result["is_attempt_finished"],
                    "simulation_grade_id": result["simulation_grade_id"],
                }
                # Emit to requester
                await sio_instance.emit(
                    "simulation_continued",
                    payload,
                    room=sid,
                )
                # Also broadcast to the simulation room so watchers stay in sync
                await sio_instance.emit(
                    "simulation_continued",
                    payload,
                    room=f"simulation_{chat_id}",
                )

                logger.info(
                    f"Simulation continued successfully: completed_chat={result['completed_chat_id']}, next_chat={result['next_chat_id']}"
                )

    except Exception as e:
        logger.error(f"Error continuing simulation for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to continue simulation: {str(e)}")

