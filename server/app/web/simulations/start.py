"""Handler for start_simulation WebSocket event."""

import json
import logging
import uuid
from typing import Any

from agents import gen_trace_id
from app.agents.collection.scenario import run_scenario_agent
from app.db import get_pool
from app.utils.sql_helper import load_sql
from app.web.simulations.utils import emit_error, get_sio_instance

logger = logging.getLogger(__name__)


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
            simulation_data = row["simulation_data"]
            scenario_metadata = row["scenario_metadata"]
            if isinstance(simulation_data, str):
                simulation_data = json.loads(simulation_data)
            if isinstance(scenario_metadata, str):
                scenario_metadata = json.loads(scenario_metadata)
            
            # Check if scenario needs generation
            needs_generation = row.get("needs_generation", False)
            scenario_id_raw = row["scenario_id"]
            # Convert asyncpg UUID to Python UUID
            scenario_id = uuid.UUID(str(scenario_id_raw))
            
            # Handle scenario generation if needed
            if needs_generation:
                try:
                    logger.info(
                        f"Scenario {scenario_id} needs generation, starting agent..."
                    )
                    
                    # Get profile_id from attempt
                    sql = load_sql("sql/v3/attempts/get_attempt_with_profile.sql")
                    attempt_with_profile = await conn.fetchrow(sql, row["attempt_id"])
                    attempt_profile_id_raw = (
                        attempt_with_profile["profile_id"] if attempt_with_profile else None
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
                        logger.info(f"Using department_id from scenario: {department_id}")
                    elif attempt_profile_id:
                        # Fallback to profile's departments
                        sql = load_sql("sql/v3/profile/get_departments_for_profile.sql")
                        profile_dept_rows = await conn.fetch(sql, attempt_profile_id)
                        if profile_dept_rows and len(profile_dept_rows) > 0:
                            dept_id_raw = profile_dept_rows[0]["id"]
                            department_id = uuid.UUID(str(dept_id_raw))
                            logger.info(f"Using department_id from profile: {department_id}")
                    
                    if not department_id:
                        # Last resort: get any active department
                        sql = load_sql("sql/v3/departments/get_all_active_departments.sql")
                        all_dept_rows = await conn.fetch(sql)
                        if all_dept_rows and len(all_dept_rows) > 0:
                            dept_id_raw = all_dept_rows[0]["id"]
                            department_id = uuid.UUID(str(dept_id_raw))
                            logger.info(f"Using first active department: {department_id}")
                    
                    if not department_id:
                        raise ValueError("Cannot generate scenario: no department_id available")
                    
                    # Use shared helper function for selecting attributes
                    from app.api.v3.scenarios.select_attributes import \
                        select_scenario_attributes
                    
                    try:
                        selected_attributes = await select_scenario_attributes(
                            conn=conn,
                            scenario_id=scenario_id,
                            department_id=department_id,
                            profile_id=attempt_profile_id,
                        )
                        
                        persona_id = selected_attributes["persona_id"]
                        doc_ids = selected_attributes["document_ids"]
                        param_ids = selected_attributes["parameter_item_ids"]
                        
                        logger.info(
                            f"Selected attributes for scenario {scenario_id}: "
                            f"persona_id={persona_id}, document_ids={doc_ids}, parameter_item_ids={param_ids}"
                        )
                    except Exception as attr_error:
                        logger.error(
                            f"Failed to select attributes for scenario {scenario_id}: {str(attr_error)}",
                            exc_info=True,
                        )
                        raise  # Re-raise to be caught by outer exception handler
                    
                    attempt_profile_uuid = (
                        uuid.UUID(attempt_profile_id) if attempt_profile_id else None
                    )
                    
                    # Generate scenario content
                    logger.info(
                        f"Calling run_scenario_agent for scenario {scenario_id} with "
                        f"department_id={department_id}, persona_id={persona_id}, "
                        f"document_ids={doc_ids}, parameter_item_ids={param_ids}"
                    )
                    name, description, objectives, trace_id = await run_scenario_agent(
                        department_id=department_id,
                        persona_id=persona_id,
                        document_ids=doc_ids if doc_ids else None,
                        parameter_item_ids=param_ids if param_ids else None,
                        group_id=uuid.UUID(row["attempt_id"]),
                        conn=conn,
                        profile_id=attempt_profile_uuid,
                        objectives_enabled=True,
                    )
                    
                    logger.info(
                        f"Scenario generation completed: name={name}, "
                        f"description length={len(description)}, objectives count={len(objectives)}"
                    )
                    
                    # Create new child scenario variant (NEVER update parent in place)
                    # Create new scenario variant
                    sql = load_sql("sql/v3/scenarios/insert_scenario_variant.sql")
                    new_scenario_row = await conn.fetchrow(
                        sql,
                        name,  # scenario name ($1)
                        True,  # generated = True ($2)
                        True,  # active = True ($3)
                        False,  # hints_enabled ($4)
                        True,  # objectives_enabled ($5)
                        False,  # image_input_enabled ($6)
                        False,  # copy_paste_allowed ($7)
                        False,  # input_guardrail_enabled ($8)
                        False,  # output_guardrail_enabled ($9)
                    )
                    new_scenario_id = new_scenario_row["id"]
                    logger.info(f"Created child scenario variant {new_scenario_id} for parent {scenario_id}")
                    
                    # Insert problem statement into child scenario
                    sql = load_sql("sql/v3/scenarios/insert_scenario_problem_statement.sql")
                    await conn.fetchrow(
                        sql,
                        new_scenario_id,
                        description,  # problem_statement
                        True,  # active = True
                    )
                    logger.info(f"Created problem statement for child scenario {new_scenario_id}")
                    
                    # Insert objectives into child scenario
                    sql = load_sql("sql/v3/scenarios/insert_scenario_objective.sql")
                    for idx, objective in enumerate(objectives[:3]):  # Limit to 3 objectives
                        await conn.execute(sql, new_scenario_id, idx, objective)
                    logger.info(
                        f"Inserted {min(len(objectives), 3)} objectives for child scenario {new_scenario_id}"
                    )
                    
                    # Create scenario_tree edge linking parent -> child
                    sql = load_sql("sql/v3/scenarios/insert_scenario_tree_edge.sql")
                    await conn.execute(
                        sql,
                        scenario_id,  # parent (original scenario from simulation)
                        new_scenario_id,  # child (generated variant)
                        True,  # active
                    )
                    logger.info(f"Created scenario_tree edge: parent={scenario_id} -> child={new_scenario_id}")
                    
                    # Link selected attributes to child scenario (use selected attributes, not random)
                    # Link personas
                    if persona_id:
                        sql = load_sql("sql/v3/scenarios/insert_scenario_persona_link.sql")
                        await conn.execute(sql, new_scenario_id, persona_id, True)
                        logger.info(f"Linked persona {persona_id} to child scenario {new_scenario_id}")
                    
                    # Link documents
                    if doc_ids:
                        sql = load_sql("sql/v3/scenarios/insert_scenario_document_link.sql")
                        for doc_id in doc_ids:
                            await conn.execute(sql, new_scenario_id, doc_id, True)
                        logger.info(f"Linked {len(doc_ids)} document(s) to child scenario {new_scenario_id}")
                    
                    # Link parameter items
                    if param_ids:
                        sql = load_sql("sql/v3/scenarios/insert_scenario_parameter_link.sql")
                        for param_id in param_ids:
                            await conn.execute(sql, new_scenario_id, param_id, True)
                        logger.info(f"Linked {len(param_ids)} parameter item(s) to child scenario {new_scenario_id}")
                    
                    # Link department (use the department_id we selected)
                    sql = load_sql("sql/v3/scenarios/insert_scenario_department_link.sql")
                    await conn.execute(sql, new_scenario_id, department_id, True)
                    logger.info(f"Linked department {department_id} to child scenario {new_scenario_id}")
                    
                    # Update chat to use child scenario instead of parent
                    sql = load_sql("sql/v3/simulations/update_chat_scenario_id.sql")
                    await conn.execute(sql, row["chat_id"], new_scenario_id)
                    logger.info(f"Updated chat {row['chat_id']} to use child scenario {new_scenario_id}")
                    
                    # Update scenario_id for result - use child scenario
                    scenario_id = new_scenario_id
                    
                    # Fetch child scenario data for result
                    sql = load_sql("sql/v3/scenarios/get_scenario_by_id.sql")
                    child_scenario = await conn.fetchrow(sql, new_scenario_id)
                    if child_scenario:
                        # Get problem statement from child
                        sql = load_sql("sql/v3/scenarios/get_scenario_problem_statement_active.sql")
                        problem_row = await conn.fetchrow(sql, new_scenario_id)
                        child_problem_statement = problem_row.get("problem_statement") if problem_row else None
                        
                        # Update row data for result
                        row["scenario_id"] = new_scenario_id
                        row["scenario_name"] = child_scenario.get("name", name)
                        row["problem_statement"] = child_problem_statement or description
                        scenario_metadata["generated"] = True
                    
                except Exception as gen_error:
                    # Log error but don't fail the entire simulation start
                    logger.error(
                        f"Failed to generate scenario {scenario_id}: {str(gen_error)}",
                        exc_info=True,
                    )
                    # Continue with existing scenario (may have no problem statement)
            
            result = {
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

