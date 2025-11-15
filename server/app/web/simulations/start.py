"""Handler for start_simulation WebSocket event."""

import json
import logging
import uuid
from typing import Any

import socketio  # type: ignore
from agents import Runner, ToolsToFinalOutputResult, gen_trace_id, trace
from agents.items import TResponseInputItem
from app.db import get_pool
from app.main import sio
from app.utils.agent_tools import (create_scenario_tools, scenario_progress,
                                   scenario_results)
from app.utils.agents import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.document import format_document_info
from app.utils.personas import format_persona_info
from app.utils.scenario import format_parameter_item_info
from app.utils.sql_helper import load_sql
from app.web.simulations.utils import emit_error

logger = logging.getLogger(__name__)


@sio.event  # type: ignore
async def start_simulation(sid: str, data: dict[str, Any]) -> None:
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
                    
                    # Generate scenario content (inlined run_scenario_agent)
                    logger.info(
                        f"Generating scenario for scenario {scenario_id} with "
                        f"department_id={department_id}, persona_id={persona_id}, "
                        f"document_ids={doc_ids}, parameter_item_ids={param_ids}"
                    )
                    
                    # Clear previous results
                    scenario_results.clear()
                    scenario_progress.clear()
                    
                    # Get all context data in a single optimized query using SQL file
                    doc_ids_str = [str(d) for d in doc_ids] if doc_ids else []
                    param_ids_str = [str(p) for p in param_ids] if param_ids else []
                    
                    sql = load_sql("sql/v3/agents/get_scenario_run_context.sql")
                    context_row = await conn.fetchrow(
                        sql,
                        str(department_id),
                        str(persona_id) if persona_id else None,
                        doc_ids_str,
                        param_ids_str,
                    )
                    
                    if not context_row:
                        raise ValueError(f"No scenario agent configured for department {department_id}")
                    
                    # Parse JSON arrays
                    documents = (
                        json.loads(context_row["documents"])
                        if isinstance(context_row["documents"], str)
                        else context_row["documents"]
                    )
                    parameter_items = (
                        json.loads(context_row["parameter_items"])
                        if isinstance(context_row["parameter_items"], str)
                        else context_row["parameter_items"]
                    )
                    
                    context = {
                        "agent_id": context_row["agent_id"],
                        "agent_name": context_row["agent_name"],
                        "system_prompt": context_row["system_prompt"],
                        "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
                        "reasoning": context_row["reasoning"],
                        "model_id": context_row["model_id"],
                        "model_name": context_row["model_name"],
                        "custom_model": context_row["custom_model"],
                        "provider_id": context_row["provider_id"],
                        "provider_name": context_row["provider_name"],
                        "base_url": context_row["base_url"],
                        "api_key": context_row["api_key"],
                        "persona": {
                            "id": context_row["persona_id"],
                            "name": context_row["persona_name"],
                            "description": context_row["persona_description"],
                        } if context_row["persona_id"] else None,
                        "documents": documents,
                        "parameter_items": parameter_items,
                        "default_guest_profile_id": context_row["guest_profile_id"],
                        "req_per_day": context_row["req_per_day"],
                        "runs_today_count": context_row["runs_today_count"],
                        "earliest_run_created_at": context_row["earliest_run_created_at"],
                    }
                    
                    # Format persona info if persona was provided
                    if persona_id is None or context["persona"] is None:
                        persona_info = None
                        show_images = False
                    else:
                        persona_info = format_persona_info(context["persona"])
                        show_images = False
                    
                    # Format document info if documents were provided
                    if not doc_ids or len(doc_ids) == 0:
                        document_info = None
                    else:
                        document_info = format_document_info(context["documents"], show_images)
                    
                    # Format parameter item info if parameter items were provided
                    if not param_ids or len(param_ids) == 0:
                        parameter_item_info = None
                    else:
                        parameter_item_info = format_parameter_item_info(context["parameter_items"])
                    
                    # Create scenario generation tools
                    group_id = uuid.UUID(row["attempt_id"])
                    objectives_enabled = True
                    scenario_tools = create_scenario_tools(group_id, objectives_enabled=objectives_enabled)
                    scenario_tools.append(debug_info_tool)
                    logger.info(f"Created {len(scenario_tools)} scenario tools (including debug_info)")
                    
                    # Create tool use behavior to check when all required tools are called
                    def tool_use_behavior(
                        tool_context: Any, tool_results: list[Any]
                    ) -> ToolsToFinalOutputResult:
                        required_tools = ["title_description"]
                        if objectives_enabled:
                            required_tools.append("objectives")
                        
                        completed_required = all(
                            scenario_progress.get(tool, False) for tool in required_tools
                        )
                        
                        logger.info(
                            f"Tool use check: required={required_tools}, completed={completed_required}, progress={scenario_progress}"
                        )
                        return ToolsToFinalOutputResult(is_final_output=completed_required)
                    
                    scenario_agent_generic = GenericAgent(
                        agent_name=context["agent_name"],
                        system_prompt=context["system_prompt"],
                        temperature=context["temperature"],
                        model_name=context["model_name"],
                        model_provider=context["provider_name"],
                        base_url=context["base_url"],
                        api_key=context["api_key"],
                        reasoning=context["reasoning"],
                        tools=scenario_tools,
                        parallel_tool_calls=False,
                        tool_use_behavior=tool_use_behavior,
                        custom_model=context["custom_model"],
                    )
                    
                    agent_instance = scenario_agent_generic.agent()
                    
                    input_items: list[TResponseInputItem | None] = [
                        persona_info,
                        document_info,
                        parameter_item_info,
                    ]
                    
                    clean_input_items = [item for item in input_items if item is not None]
                    
                    # Generate a trace id for the scenario
                    scenario_trace_id = gen_trace_id()
                    
                    # Use default guest profile from context if no profile_id provided
                    final_profile_id = (
                        attempt_profile_uuid if attempt_profile_uuid else context["default_guest_profile_id"]
                    )
                    
                    # Check rate limit
                    profile_id_uuid = final_profile_id if final_profile_id else None
                    if not profile_id_uuid:
                        raise ValueError("Profile not found. Please contact support.")
                    
                    req_per_day = context["req_per_day"]
                    runs_today_count = context["runs_today_count"]
                    
                    if req_per_day is not None and runs_today_count >= req_per_day:
                        from datetime import timedelta
                        from zoneinfo import ZoneInfo
                        earliest_run_created_at = context["earliest_run_created_at"]
                        if earliest_run_created_at:
                            next_allowed_utc = earliest_run_created_at + timedelta(days=1)
                            eastern_tz = ZoneInfo("America/New_York")
                            next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
                            error_message = (
                                f"Daily request limit of {req_per_day} reached. "
                                f"Next request allowed after {next_allowed_et.strftime('%I:%M %p %Z')} on "
                                f"{next_allowed_et.strftime('%B %d, %Y')}."
                            )
                        else:
                            error_message = f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
                        raise ValueError(error_message)
                    
                    # Create model run with all junction records using SQL file
                    sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
                    model_run_row = await conn.fetchrow(
                        sql_create_run,
                        str(department_id),
                        context["model_id"],
                        context["agent_id"],
                        "agent",
                        final_profile_id,
                    )
                    model_run_id = uuid.UUID(model_run_row["model_run_id"])
                    
                    with trace("Scenario Agent", group_id=str(group_id), trace_id=scenario_trace_id):
                        result = await Runner.run(
                            agent_instance,
                            input=clean_input_items,
                            context=DebugContext(conn=conn, model_run_id=model_run_id),
                        )
                    
                    # Extract results from the global storage
                    scenario_result = scenario_results
                    
                    logger.info("Scenario generation completed successfully")
                    logger.info(f"Title: {scenario_result.get('title', 'N/A')}")
                    logger.info(f"Description: {scenario_result.get('description', 'N/A')[:100]}...")
                    objectives = scenario_result.get('objectives', []) if objectives_enabled else []
                    logger.info(f"Objectives: {objectives}")
                    
                    usage = result.context_wrapper.usage
                    
                    # Update model run with token usage using SQL file
                    sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
                    await conn.execute(
                        sql_update_tokens,
                        str(model_run_id),
                        usage.input_tokens,
                        usage.output_tokens,
                    )
                    
                    # Get result values
                    name = scenario_result.get("title", "")
                    description = scenario_result.get("description", "")
                    # Use the generated trace_id
                    trace_id = scenario_trace_id
                    
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
            simulation_room = f"simulation_{result['chat_id']}"
            await sio.enter_room(sid, simulation_room)
            logger.info(f"Client {sid} joined simulation room {simulation_room}")

            # Emit success response
            await sio.emit(
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

