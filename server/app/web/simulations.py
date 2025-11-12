# app/web/simulations.py

"""
WebSocket handlers for simulation chat functionality
Supports text and audio message processing with real-time streaming
"""

import asyncio
import logging
import uuid
from typing import Any

import socketio  # type: ignore
from agents import gen_trace_id
from agents.exceptions import OutputGuardrailTripwireTriggered
from app.agents.collection.hint import run_hint_agent
from app.agents.collection.simulation import (cancel_simulation_run,
                                              run_simulation_agent)
from app.db import get_pool
from app.utils.sql_helper import load_sql

logger = logging.getLogger(__name__)

# Global store for active simulation runs
active_simulation_runs: dict[str, Any] = {}


def get_sio_instance() -> socketio.AsyncServer:
    """Get the Socket.IO server instance from main.py"""
    from app.main import get_socketio_instance

    return get_socketio_instance()


async def handle_start_simulation(sid: str, data: dict[str, Any]) -> None:
    """
    Handle simulation start requests via WebSocket
    Replaces /simulations/start endpoint
    """
    try:
        logger.info(f"Received start_simulation request from {sid} with data: {data}")

        simulation_id = data.get("simulation_id")
        profile_id = data.get("profile_id")
        scenario_id_override = data.get("scenario_id")
        infinite = bool(data.get("infinite", False))
        infinite_time_limit = data.get("infinite_time_limit")

        if not simulation_id:
            logger.error(f"Missing simulation_id in request from {sid}")
            await emit_error(sid, "Missing simulation_id")
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
            await emit_error(sid, "Database connection pool not available")
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
                await emit_error(sid, "Failed to start simulation attempt")
                return
            
            # Parse JSONB fields if they're strings
            import json
            simulation_data = row["simulation_data"]
            scenario_metadata = row["scenario_metadata"]
            if isinstance(simulation_data, str):
                simulation_data = json.loads(simulation_data)
            if isinstance(scenario_metadata, str):
                scenario_metadata = json.loads(scenario_metadata)
            
            result = {
                "attempt_id": row["attempt_id"],
                "chat_id": row["chat_id"],
                "chat_title": row["chat_title"],
                "scenario": {
                    "id": row["scenario_id"],
                    "name": row["scenario_name"],
                    "problem_statement": row["problem_statement"],
                    "active": scenario_metadata.get("active"),
                    "generated": scenario_metadata.get("generated"),
                },
            }

            logger.info(
                f"Created attempt {result['attempt_id']} for simulation {simulation_id}"
            )

            # Join the client to the simulation room for real-time updates
            sio_instance = get_sio_instance()
            simulation_room = f"simulation_{result['chat_id']}"
            await sio_instance.enter_room(sid, simulation_room)
            logger.info(f"Client {sid} joined simulation room {simulation_room}")

            # Emit success response
            await sio_instance.emit(
                "simulation_started",
                {
                    "success": True,
                    "message": "Simulation started successfully",
                    "attempt_id": str(result["attempt_id"]),
                    "chat_id": str(result["chat_id"]),
                },
                room=sid,
            )

            logger.info(
                f"Simulation started successfully for {sid}: attempt={result['attempt_id']}, chat={result['chat_id']}"
            )

    except Exception as e:
        logger.error(f"Error starting simulation for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to start simulation: {str(e)}")


async def handle_stop_simulation(sid: str, data: dict[str, Any]) -> None:
    """
    Handle simulation stop requests via WebSocket
    Replaces /simulations/stop endpoint
    """
    try:
        chat_id = data.get("chat_id")

        if not chat_id:
            await emit_error(sid, "Missing chat_id")
            return

        # Get connection pool
        pool = get_pool()
        if not pool:
            await emit_error(sid, "Database connection pool not available")
            return

        async with pool.acquire() as conn:
            # Attempt to cancel the simulation run and the in-process Runner immediately
            from app.main import cancel_active_result

            # Try immediate in-process cancel first
            immediate = await cancel_active_result(str(chat_id))
            # Then set cooperative cancel flag (Redis)
            success = await cancel_simulation_run(chat_id)

            # Stop simulation and mark message complete using SQL
            sql = load_sql("sql/v3/simulations/stop_simulation_run_complete.sql")
            row = await conn.fetchrow(sql, chat_id)
            
            if not row:
                result = {
                    "success": False,
                    "cancelled_message_id": None,
                    "final_content": "",
                }
            else:
                result = {
                    "success": row["success"],
                    "cancelled_message_id": row["cancelled_message_id"],
                    "final_content": row["final_content"],
                }

            sio_instance = get_sio_instance()

            if result["success"] and result["cancelled_message_id"]:
                logger.info(f"Successfully cancelled simulation run for chat {chat_id}")

                # Emit a cancellation / final content event so clients update UI
                await sio_instance.emit(
                    "simulation_message_cancelled",
                    {
                        "message_id": str(result["cancelled_message_id"]),
                        "chat_id": str(chat_id),
                        "final_content": result["final_content"],
                    },
                    room=f"simulation_{chat_id}",
                )

                # Emit stop signal
                await sio_instance.emit(
                    "simulation_stopped",
                    {
                        "chat_id": chat_id,
                        "success": True,
                        "message": "",  # Empty message, no toast
                    },
                    room=f"simulation_{chat_id}",
                )

            else:
                logger.warning(f"No active simulation run found for chat {chat_id}")
                await sio_instance.emit(
                    "simulation_stopped",
                    {
                        "chat_id": chat_id,
                        "success": False,
                        "message": "No active message found for this chat",
                    },
                    room=f"simulation_{chat_id}",
                )

    except Exception as e:
        logger.error(f"Error stopping simulation for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to stop simulation: {str(e)}")


async def _randomly_fill_scenario_attributes_sql(
    conn: Any,
    scenario: dict[str, Any],
    profile_id: str | None = None,
) -> dict[str, Any]:
    """Randomly fill null attributes of a scenario using SQL files.
    
    This is a simplified version that updates the scenario in place
    (no variant creation). Uses SQL files for all database queries.
    Keeps complex business logic (random selection, text similarity) in Python.
    
    Args:
        conn: Database connection
        scenario: The scenario dict with potentially null attributes
        profile_id: Optional profile ID to get user's accessible departments for fallback
        
    Returns:
        Updated scenario dict with randomly selected values for null attributes
    """
    import json
    import logging
    import random
    import uuid as uuid_module
    
    logger = logging.getLogger(__name__)
    scenario_id = scenario["id"]
    
    # Step 1: Select department_id first
    # Priority 1: Get department_ids from scenario_departments junction table
    sql = load_sql("sql/v3/scenarios/get_scenario_departments.sql")
    scenario_dept_rows = await conn.fetch(sql, scenario_id)
    scenario_dept_ids = [row["department_id"] for row in scenario_dept_rows]
    
    selected_dept_id: uuid_module.UUID | None = None
    if scenario_dept_ids:
        # Randomly select one department from scenario's departments
        selected_dept_id = random.choice(scenario_dept_ids)
        logger.info(f"Selected department_id from scenario_departments: {selected_dept_id}")
    else:
        # Cross-department scenario - need to pick a department
        if profile_id:
            # Get user's accessible departments
            sql = load_sql("sql/v3/profile/get_departments_for_profile.sql")
            profile_dept_rows = await conn.fetch(sql, profile_id)
            profile_dept_ids = [row["id"] for row in profile_dept_rows]
            if profile_dept_ids:
                selected_dept_id = random.choice(profile_dept_ids)
                logger.info(f"Selected department_id from user's accessible departments: {selected_dept_id}")
            else:
                logger.warning(f"No accessible departments found for profile {profile_id}")
        else:
            # No profile_id - get all active departments
            sql = load_sql("sql/v3/departments/get_all_active_departments.sql")
            all_dept_rows = await conn.fetch(sql)
            all_dept_ids = [row["id"] for row in all_dept_rows]
            if all_dept_ids:
                selected_dept_id = random.choice(all_dept_ids)
                logger.info(f"Selected department_id from all active departments: {selected_dept_id}")
            else:
                logger.warning("No active departments found in database")
    
    if not selected_dept_id:
        raise ValueError("Cannot proceed without a department_id - no departments available")
    
    selected_dept_id_str = str(selected_dept_id)
    
    # Step 2: Get all randomization data in a single query
    sql = load_sql("sql/v3/scenarios/get_randomization_data_complete.sql")
    dept_uuids = [uuid_module.UUID(selected_dept_id_str)]
    result = await conn.fetchrow(sql, dept_uuids)
    
    if not result:
        raise ValueError("Failed to fetch randomization data")
    
    # Parse JSONB aggregations (may be string or list)
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
    document_parameter_items_data = parse_jsonb(result.get("document_parameter_items", []))
    
    # Convert UUIDs and build lookup maps
    active_personas = []
    for p in personas_data:
        active_personas.append({
            **p,
            "id": uuid_module.UUID(str(p["id"])),
        })
    
    active_documents = []
    for d in documents_data:
        active_documents.append({
            **d,
            "id": uuid_module.UUID(str(d["id"])),
        })
    
    active_parameters = []
    for p in parameters_data:
        active_parameters.append({
            **p,
            "id": uuid_module.UUID(str(p["id"])),
        })
    
    all_parameter_items = []
    for pi in parameter_items_data:
        all_parameter_items.append({
            **pi,
            "id": uuid_module.UUID(str(pi["id"])),
            "parameter_id": uuid_module.UUID(str(pi["parameter_id"])),
        })
    
    document_parameter_items_junction = [
        {
            "document_id": uuid_module.UUID(str(j["document_id"])),
            "parameter_item_id": uuid_module.UUID(str(j["parameter_item_id"])),
        }
        for j in document_parameter_items_data
    ]
    
    # Build lookup maps for efficiency
    parameter_items_by_id: dict[uuid_module.UUID, dict[str, Any]] = {}
    for pi in all_parameter_items:
        parameter_items_by_id[pi["id"]] = pi
    
    parameter_items_by_param_id: dict[uuid_module.UUID, list[dict[str, Any]]] = {}
    for pi in all_parameter_items:
        param_id = pi["parameter_id"]
        if param_id not in parameter_items_by_param_id:
            parameter_items_by_param_id[param_id] = []
        parameter_items_by_param_id[param_id].append(pi)
    
    documents_by_id: dict[uuid_module.UUID, dict[str, Any]] = {}
    for d in active_documents:
        documents_by_id[d["id"]] = d
    
    # Step 3: Get personas (priority: existing links, then random selection)
    scenario_persona_ids: list[uuid_module.UUID] = []
    
    # Priority 1: Check for existing persona links in database
    sql = load_sql("sql/v3/scenarios/get_scenario_persona_links.sql")
    existing_persona_links = await conn.fetchrow(sql, scenario_id)
    if existing_persona_links and existing_persona_links.get("persona_ids"):
        scenario_persona_ids = [
            uuid_module.UUID(p) for p in existing_persona_links["persona_ids"]
        ]
        logger.info(f"Found {len(scenario_persona_ids)} existing persona_ids: {scenario_persona_ids}")
    
    # Priority 2: Random persona selection if still none (filtered by selected department)
    if not scenario_persona_ids:
        if active_personas:
            # Randomly select 1-3 personas
            num_personas = random.randint(1, min(3, len(active_personas)))
            selected_personas = random.sample(active_personas, num_personas)
            scenario_persona_ids = [p["id"] for p in selected_personas]
            logger.info(f"Randomly selected {len(scenario_persona_ids)} persona_ids: {scenario_persona_ids}")
        else:
            logger.info("No active personas found")
    
    # Step 4: Update persona links (delete existing, insert new)
    if scenario_persona_ids:
        sql = load_sql("sql/v3/scenarios/delete_scenario_personas.sql")
        await conn.execute(sql, scenario_id)
        
        # Insert all selected personas
        sql = load_sql("sql/v3/scenarios/insert_scenario_persona_link.sql")
        for pid in scenario_persona_ids:
            await conn.execute(sql, scenario_id, pid, True)
    
    # Step 5: Get objectives (first 3 by idx)
    sql = load_sql("sql/v3/scenarios/get_scenario_objectives_top_n.sql")
    objectives_data = await conn.fetch(sql, scenario_id, 3)
    scenario_objectives = [obj["objective"] for obj in objectives_data]
    logger.info(f"Found {len(scenario_objectives)} objectives for scenario: {scenario_objectives}")
    
    # Step 6: Get most recent active problem statement
    sql = load_sql("sql/v3/scenarios/get_scenario_problem_statement_active.sql")
    problem_statement_row = await conn.fetchrow(sql, scenario_id)
    scenario_problem_statement = problem_statement_row["problem_statement"] if problem_statement_row else None
    logger.info(f"Found problem statement: {scenario_problem_statement}")
    
    # Step 7: Get existing documents and parameters from junction tables
    sql = load_sql("sql/v3/scenarios/get_scenario_document_links.sql")
    doc_links = await conn.fetch(sql, scenario_id)
    existing_doc_ids = [link["document_id"] for link in doc_links]
    
    sql = load_sql("sql/v3/scenarios/get_scenario_parameter_links.sql")
    param_links = await conn.fetch(sql, scenario_id)
    existing_param_ids = [link["parameter_item_id"] for link in param_links]
    
    # Step 8: Random document selection if documents still don't exist
    scenario_documents: list[uuid_module.UUID] = []
    if not existing_doc_ids:
        # First, get parameter items for this scenario (for document matching)
        doc_matching_param_item_ids = existing_param_ids.copy() if existing_param_ids else []
        
        # If no parameter items, randomly select one per active parameter
        if not doc_matching_param_item_ids and active_parameters:
            for param in active_parameters:
                param_items = parameter_items_by_param_id.get(param["id"], [])
                if param_items:
                    selected_item = random.choice(param_items)
                    doc_matching_param_item_ids.append(selected_item["id"])
        
        # Try to find documents that match parameter items via document_parameter_items junction
        matching_documents = []
        if doc_matching_param_item_ids:
            matching_documents = [
                documents_by_id[j["document_id"]]
                for j in document_parameter_items_junction
                if j["parameter_item_id"] in doc_matching_param_item_ids
                and j["document_id"] in documents_by_id
            ]
            logger.info(f"Found {len(matching_documents)} documents matching parameter items")
        
        if matching_documents:
            # Select 1 document from matching documents
            selected_doc = random.choice(matching_documents)
            scenario_documents = [selected_doc["id"]]
            logger.info(f"Selected document via parameter items: {selected_doc['id']} ({selected_doc['name']})")
        elif active_documents:
            # Fallback to text similarity scoring (simplified - just random selection for now)
            logger.info("No documents match parameter items, using random selection")
            selected_doc = random.choice(active_documents)
            scenario_documents = [selected_doc["id"]]
            logger.info(f"Randomly selected document: {selected_doc['id']} ({selected_doc['name']})")
        else:
            logger.info("No active documents found")
    else:
        scenario_documents = existing_doc_ids
        logger.info(f"Scenario already has {len(existing_doc_ids)} documents, keeping them")
    
    # Step 9: Random parameter item selection if no parameters linked via junction
    scenario_parameter_item_ids = []
    if not existing_param_ids:
        if active_parameters:
            # For each active parameter, randomly select one parameter item
            for param in active_parameters:
                param_items = parameter_items_by_param_id.get(param["id"], [])
                if param_items:
                    selected_item = random.choice(param_items)
                    scenario_parameter_item_ids.append(selected_item["id"])
            logger.info(f"Randomly selected {len(scenario_parameter_item_ids)} parameter items")
        else:
            logger.info("No active parameters found")
    else:
        scenario_parameter_item_ids = existing_param_ids
        logger.info(f"Scenario already has {len(existing_param_ids)} parameter items, keeping them")
    
    # Step 10: Update document and parameter links
    if scenario_documents:
        # Delete existing documents first (simplified - just insert, let DB handle conflicts)
        sql = load_sql("sql/v3/scenarios/insert_scenario_document_link.sql")
        for doc_id in scenario_documents:
            await conn.execute(sql, scenario_id, doc_id, True)
    
    if scenario_parameter_item_ids:
        # Delete existing parameters first (simplified - just insert, let DB handle conflicts)
        sql = load_sql("sql/v3/scenarios/insert_scenario_parameter_link.sql")
        for param_id in scenario_parameter_item_ids:
            await conn.execute(sql, scenario_id, param_id, True)
    
    # Return updated scenario with filled attributes
    scenario["objectives"] = scenario_objectives
    scenario["problem_statement"] = scenario_problem_statement
    scenario["department_id"] = selected_dept_id
    
    return scenario


async def _create_chat_for_scenario(
    conn: Any,
    scenario_id: str,
    attempt_id: str,
    profile_id: str | None,
    mark_completed: bool,
) -> dict[str, Any] | None:
    """Create chat for a scenario with full scenario preparation.
    
    Helper function for continue_simulation_attempt.
    Uses SQL files for database operations.
    """
    from datetime import UTC, datetime

    from agents import gen_trace_id

    # Get scenario by ID
    sql = load_sql("sql/v3/scenarios/get_scenario_by_id.sql")
    old_scenario = await conn.fetchrow(sql, scenario_id)
    if not old_scenario:
        return None

    # Randomly fill any null attributes using SQL files
    scenario = await _randomly_fill_scenario_attributes_sql(
        conn, dict(old_scenario), profile_id=profile_id
    )

    # Set chat title and generate trace_id
    chat_title = scenario["name"]
    trace_id = gen_trace_id()

    # Create chat using SQL
    sql = load_sql("sql/v3/simulations/create_simulation_chat.sql")
    chat = await conn.fetchrow(
        sql,
        datetime.now(UTC),
        chat_title,
        scenario_id,
        attempt_id,
        mark_completed,
        trace_id,
    )

    return dict(chat) if chat else None


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
            from app.agents.collection.grade import run_grade_agent
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
            sql = load_sql("sql/v3/simulations/get_simulation_run_context.sql")
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


async def _generate_hints_background(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    department_id: uuid.UUID,
    sio_instance: Any,
) -> None:
    """
    Background task to generate hints for a completed simulation message.
    Runs independently and emits progress via Socket.IO.
    """
    pool = get_pool()
    if not pool:
        logger.error("Database connection pool not available for hint generation")
        return

    async with pool.acquire() as conn:
        try:
            logger.info(f"Background hint generation started for message {message_id}")
            hint_results = await run_hint_agent(
                chat_id=chat_id,
                message_id=message_id,
                department_id=department_id,
                conn=conn,
                sio_instance=sio_instance,
            )
            logger.info(
                f"Background hint generation completed: {len(hint_results)} hints created"
            )
        except Exception as e:
            logger.error(
                f"Background hint generation failed for message {message_id}: {e}",
                exc_info=True,
            )


async def process_simulation_message_websocket(
    chat_id: uuid.UUID,
    message: str = "",
    is_retry: bool = False,
) -> None:
    """
    Process a simulation message and stream the response via WebSocket
    Handles both text and audio messages with unified pipeline
    """

    # Get connection pool
    pool = get_pool()
    if not pool:
        raise ValueError("Database connection pool not available")

    async with pool.acquire() as conn:
        try:
            # 1. Add the user message to the chat (skip if this is a retry)
            sio_instance = get_sio_instance()
            if message and message.strip() != "" and not is_retry:
                sql = load_sql("sql/v3/simulations/create_message.sql")
                user_message_row = await conn.fetchrow(
                    sql, str(chat_id), "query", message, True
                )
                user_message = {
                    "id": user_message_row["id"],
                    "created_at": user_message_row["created_at"],
                }

                # 2. Emit user message to connected clients
                logger.info(f"Emitting user message to room simulation_{chat_id}")
                await sio_instance.emit(
                    "simulation_new_message",
                    {
                        "message_id": str(user_message["id"]),
                        "chat_id": str(chat_id),
                        "role": "user",
                        "content": message,
                        "completed": True,
                        "created_at": user_message["created_at"].isoformat(),
                    },
                    room=f"simulation_{chat_id}",
                )
            else:
                if is_retry:
                    logger.info(
                        f"Skipping user message creation for retry in chat {chat_id}"
                    )

            # 3. Create placeholder assistant message
            sql = load_sql("sql/v3/simulations/create_message.sql")
            assistant_message_row = await conn.fetchrow(
                sql, str(chat_id), "response", "", False
            )
            assistant_message = {
                "id": assistant_message_row["id"],
                "created_at": assistant_message_row["created_at"],
            }

            # 4. Emit placeholder assistant message
            logger.info(f"Emitting assistant placeholder to room simulation_{chat_id}")
            await sio_instance.emit(
                "simulation_new_message",
                {
                    "message_id": str(assistant_message["id"]),
                    "chat_id": str(chat_id),
                    "role": "assistant",
                    "content": "",
                    "completed": False,
                    "created_at": assistant_message["created_at"].isoformat(),
                },
                room=f"simulation_{chat_id}",
            )

            logger.info(f"Processing simulation message for chat {chat_id}")

            # 5. Stream the assistant response
            accumulated_content = ""
            cancelled = False

            try:
                # Cooperative cancellation support using Redis flags
                # We poll for a cancellation flag bound to this chat's active run ID
                from app.extensions import get_active_run, is_run_cancelled

                async for token in run_simulation_agent(chat_id, conn):  # type: ignore[arg-type]
                    # Check cancellation BEFORE processing this token to avoid emitting it
                    try:
                        run_id = await get_active_run(str(chat_id))
                        if run_id and await is_run_cancelled(run_id):
                            cancelled = True
                            sql = load_sql("sql/v3/simulations/complete_message.sql")
                            await conn.execute(sql, None, str(assistant_message["id"]))
                            break
                    except Exception:
                        pass

                    # Regular content token
                    accumulated_content += token

                    # Update the database with accumulated content
                    sql = load_sql("sql/v3/simulations/update_message_content.sql")
                    await conn.execute(sql, accumulated_content, str(assistant_message["id"]))

                    logger.info(
                        f"Emitting token to room simulation_{chat_id}: {token[:20]}..."
                    )
                    await sio_instance.emit(
                        "simulation_message_token",
                        {
                            "message_id": str(assistant_message["id"]),
                            "chat_id": str(chat_id),
                            "token": token,
                            "accumulated_content": accumulated_content,
                        },
                        room=f"simulation_{chat_id}",
                    )
            except OutputGuardrailTripwireTriggered as e:
                # Handle guardrail-triggered output: overwrite message with model-provided reason
                reason = ""
                try:
                    reason = (
                        getattr(e, "guardrail_result", None)
                        and getattr(e.guardrail_result, "output", None)
                        and getattr(e.guardrail_result.output, "output_info", None)
                        and getattr(e.guardrail_result.output.output_info, "reason", "")
                    ) or ""
                except Exception:
                    reason = ""

                error_text = f"Error: {reason or 'Guardrail tripwire triggered'}"

                # Persist error onto the assistant message and emit completion + error
                sql = load_sql("sql/v3/simulations/complete_message.sql")
                await conn.execute(sql, error_text, str(assistant_message["id"]))

                sio_instance = get_sio_instance()
                await sio_instance.emit(
                    "simulation_message_complete",
                    {
                        "message_id": str(assistant_message["id"]),
                        "chat_id": str(chat_id),
                        "final_content": error_text,
                    },
                    room=f"simulation_{chat_id}",
                )

                await sio_instance.emit(
                    "simulation_message_error",
                    {"chat_id": str(chat_id), "error": error_text},
                    room=f"simulation_{chat_id}",
                )

                # Skip later completion emission
                cancelled = True

            except Exception as e:
                if "cancelled" in str(e).lower() or "canceled" in str(e).lower():
                    # Handle cancellation gracefully
                    cancelled = True
                    logger.info(f"Simulation run for chat {chat_id} was cancelled")

                    # Keep content as-is, don't add cancellation notice
                    # Mark message as completed when cancelled
                    sql = load_sql("sql/v3/simulations/complete_message.sql")
                    await conn.execute(sql, accumulated_content, str(assistant_message["id"]))

                    # Emit cancellation signal
                    logger.info(f"Emitting cancellation to room simulation_{chat_id}")
                    await sio_instance.emit(
                        "simulation_message_cancelled",
                        {
                            "message_id": str(assistant_message["id"]),
                            "chat_id": str(chat_id),
                            "final_content": accumulated_content,
                        },
                        room=f"simulation_{chat_id}",
                    )
                else:
                    # Re-raise other exceptions
                    raise e

            # 6. Mark as completed and ensure final content is persisted
            sql = load_sql("sql/v3/simulations/complete_message.sql")
            await conn.execute(sql, accumulated_content, str(assistant_message["id"]))

            # 7. Emit completion signal (only if not cancelled)
            if not cancelled:
                logger.info(f"Emitting completion to room simulation_{chat_id}")
                await sio_instance.emit(
                    "simulation_message_complete",
                    {
                        "message_id": str(assistant_message["id"]),
                        "chat_id": str(chat_id),
                        "final_content": accumulated_content,
                    },
                    room=f"simulation_{chat_id}",
                )

                # 8. Trigger hint generation for practice simulations only (fire and forget)
                # Use optimized query to get simulation metadata
                sql = load_sql("sql/v3/simulations/get_simulation_metadata_for_chat.sql")
                sim_metadata_row = await conn.fetchrow(sql, str(chat_id))
                if not sim_metadata_row:
                    logger.warning(f"Failed to get simulation metadata for chat {chat_id}")
                    sim_metadata = {"practice_simulation": False}
                else:
                    sim_metadata = {
                        "simulation_id": sim_metadata_row["simulation_id"],
                        "attempt_id": sim_metadata_row["attempt_id"],
                        "practice_simulation": sim_metadata_row["practice_simulation"],
                    }

                if sim_metadata["practice_simulation"]:
                    logger.info(
                        f"Triggering hint generation for practice message {assistant_message['id']}"
                    )
                    # Extract department_id from run context for hint generation
                    sql = load_sql("sql/v3/simulations/get_simulation_run_context.sql")
                    run_context_for_hints = await conn.fetchrow(sql, str(chat_id))
                    hint_dept_id = run_context_for_hints.get("department_id") if run_context_for_hints else None
                    if not hint_dept_id:
                        logger.warning(f"Failed to get department_id for hint generation in chat {chat_id}")
                    else:
                        asyncio.create_task(
                            _generate_hints_background(
                                chat_id=chat_id,
                                message_id=assistant_message["id"],
                                department_id=uuid.UUID(hint_dept_id),
                                sio_instance=sio_instance,
                            )
                        )
                else:
                    logger.debug("Skipping hint generation for non-practice simulation")

        except Exception as e:
            logger.error(f"Error in process_simulation_message_websocket: {str(e)}")
            sio_instance = get_sio_instance()

            # Best-effort: if we have already created a placeholder assistant message,
            # persist the error text onto it and mark it complete so the UI shows it.
            try:
                error_text = f"Error: {str(e)}"
                if "assistant_message" in locals() and assistant_message is not None:
                    sql = load_sql("sql/v3/simulations/complete_message.sql")
                    await conn.execute(sql, error_text, str(assistant_message["id"]))

                    # Emit a completion update using the same message so the client updates content
                    await sio_instance.emit(
                        "simulation_message_complete",
                        {
                            "message_id": str(assistant_message["id"]),
                            "chat_id": str(chat_id),
                            "final_content": error_text,
                        },
                        room=f"simulation_{chat_id}",
                    )
            except Exception as persist_error:
                logger.error(
                    f"Failed to persist/emit error content for chat {chat_id}: {persist_error}"
                )

            # Also emit the explicit error event for toasts/state resets
            # Only emit explicit error event if not cancelled
            if "cancelled" not in str(e).lower() and "canceled" not in str(e).lower():
                logger.info(f"Emitting error to room simulation_{chat_id}")
                await sio_instance.emit(
                    "simulation_message_error",
                    {"chat_id": str(chat_id), "error": str(e)},
                    room=f"simulation_{chat_id}",
                )


async def emit_error(sid: str, message: str) -> None:
    """Helper function to emit error messages to a specific client"""
    sio_instance = get_sio_instance()
    await sio_instance.emit(
        "simulation_error", {"success": False, "message": message}, room=sid
    )
    logger.error(f"Emitted error to {sid}: {message}")


def register_simulation_events(sio: socketio.AsyncServer) -> None:
    """Register all simulation WebSocket event handlers"""

    logger.info("Starting registration of simulation WebSocket event handlers")

    # Don't register connect/disconnect here as they're already handled in main.py
    # Just register simulation-specific events

    @sio.event  # type: ignore
    async def start_simulation(sid: str, data: dict[str, Any]) -> None:
        """Start a new simulation attempt"""
        logger.info(
            f"start_simulation event triggered for sid={sid} with data keys: {list(data.keys())}"
        )
        await handle_start_simulation(sid, data)

    @sio.event  # type: ignore
    async def stop_simulation(sid: str, data: dict[str, Any]) -> None:
        """Stop an active simulation"""
        await handle_stop_simulation(sid, data)

    @sio.event  # type: ignore
    async def continue_simulation(sid: str, data: dict[str, Any]) -> None:
        """Continue to next chat in simulation"""
        await handle_continue_simulation(sid, data)

    logger.info("Successfully registered simulation WebSocket event handlers")
