"""Shared utilities for simulation WebSocket handlers."""

import asyncio
import json
import logging
import random
import uuid
from typing import Any

import asyncpg  # type: ignore
import socketio  # type: ignore
from agents import Runner, ToolsToFinalOutputResult, trace
from agents.items import TResponseInputItem
from app.agents.generic import GenericAgent
from app.db import get_pool
from app.utils.agent_helpers import build_hint_agent, emit_hint_progress
from app.utils.agent_tools import hint_progress, hint_results
from app.utils.chat import (format_chat_scenario,
                            get_simulation_conversation_history)
from app.utils.debug_info import DebugContext
from app.utils.document import format_document_info
from app.utils.sql_helper import load_sql

logger = logging.getLogger(__name__)


def get_sio_instance() -> socketio.AsyncServer:
    """Get the Socket.IO server instance from main.py"""
    from app.main import get_socketio_instance

    return get_socketio_instance()


async def emit_error(sid: str, message: str) -> None:
    """Helper function to emit error messages to a specific client"""
    sio_instance = get_sio_instance()
    await sio_instance.emit(
        "simulation_error", {"success": False, "message": message}, room=sid
    )
    logger.error(f"Emitted error to {sid}: {message}")


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
    scenario_id = scenario["id"]
    
    # Step 1: Select department_id first
    # Priority 1: Get department_ids from scenario_departments junction table
    sql = load_sql("sql/v3/scenarios/get_scenario_departments.sql")
    scenario_dept_rows = await conn.fetch(sql, scenario_id)
    scenario_dept_ids = [row["department_id"] for row in scenario_dept_rows]
    
    selected_dept_id: uuid.UUID | None = None
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
    dept_uuids = [uuid.UUID(selected_dept_id_str)]
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
            "id": uuid.UUID(str(p["id"])),
        })
    
    active_documents = []
    for d in documents_data:
        active_documents.append({
            **d,
            "id": uuid.UUID(str(d["id"])),
        })
    
    active_parameters = []
    for p in parameters_data:
        active_parameters.append({
            **p,
            "id": uuid.UUID(str(p["id"])),
        })
    
    all_parameter_items = []
    for pi in parameter_items_data:
        all_parameter_items.append({
            **pi,
            "id": uuid.UUID(str(pi["id"])),
            "parameter_id": uuid.UUID(str(pi["parameter_id"])),
        })
    
    document_parameter_items_junction = [
        {
            "document_id": uuid.UUID(str(j["document_id"])),
            "parameter_item_id": uuid.UUID(str(j["parameter_item_id"])),
        }
        for j in document_parameter_items_data
    ]
    
    # Build lookup maps for efficiency
    parameter_items_by_id: dict[uuid.UUID, dict[str, Any]] = {}
    for pi in all_parameter_items:
        parameter_items_by_id[pi["id"]] = pi
    
    parameter_items_by_param_id: dict[uuid.UUID, list[dict[str, Any]]] = {}
    for pi in all_parameter_items:
        param_id = pi["parameter_id"]
        if param_id not in parameter_items_by_param_id:
            parameter_items_by_param_id[param_id] = []
        parameter_items_by_param_id[param_id].append(pi)
    
    documents_by_id: dict[uuid.UUID, dict[str, Any]] = {}
    for d in active_documents:
        documents_by_id[d["id"]] = d
    
    # Step 3: Get personas (priority: existing links, then random selection)
    scenario_persona_ids: list[uuid.UUID] = []
    
    # Priority 1: Check for existing persona links in database
    sql = load_sql("sql/v3/scenarios/get_scenario_persona_links.sql")
    existing_persona_links = await conn.fetchrow(sql, scenario_id)
    if existing_persona_links and existing_persona_links.get("persona_ids"):
        scenario_persona_ids = [
            uuid.UUID(p) for p in existing_persona_links["persona_ids"]
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
    scenario_documents: list[uuid.UUID] = []
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


async def _generate_hints_background(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    department_id: uuid.UUID,
    sio_instance: Any,
) -> None:
    """
    Background task to generate hints for a completed simulation message.
    Runs independently and emits progress via Socket.IO.
    Inlined from run_hint_agent.
    """
    pool = get_pool()
    if not pool:
        logger.error("Database connection pool not available for hint generation")
        return

    async with pool.acquire() as conn:
        try:
            logger.info(f"Background hint generation started for message {message_id}")
            
            # Clear previous results
            hint_results.clear()
            hint_progress.clear()
            
            # Get all hint context data using SQL file
            sql = load_sql("sql/v3/agents/get_hint_run_context.sql")
            context_row = await conn.fetchrow(sql, str(message_id), str(chat_id), str(department_id))
            
            if not context_row:
                raise ValueError(
                    f"Message {message_id} in chat {chat_id} not found or "
                    f"no hint agent configured for department {department_id}"
                )
            
            # Parse JSON array for documents
            documents = (
                json.loads(context_row["documents"])
                if isinstance(context_row["documents"], str)
                else context_row["documents"]
            )
            
            # Resolve guest profile if needed
            profile_id = context_row["profile_id"]
            if not profile_id:
                sql_guest = load_sql("sql/v3/profile/get_default_guest_profile.sql")
                guest_row = await conn.fetchrow(sql_guest)
                if guest_row:
                    profile_id = guest_row["id"]
            
            context = {
                "message_id": context_row["message_id"],
                "message_created_at": context_row["message_created_at"],
                "chat_id": context_row["chat_id"],
                "attempt_id": context_row["attempt_id"],
                "scenario_id": context_row["scenario_id"],
                "trace_id": context_row["trace_id"],
                "chat_title": context_row["chat_title"],
                "simulation_id": context_row["simulation_id"],
                "problem_statement": context_row["problem_statement"],
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
                "profile_id": profile_id,
                "documents": documents,
                "req_per_day": context_row["req_per_day"],
                "runs_today_count": context_row["runs_today_count"],
                "earliest_run_created_at": context_row["earliest_run_created_at"],
            }
            
            # Extract data from context
            chat = {
                "id": uuid.UUID(context["chat_id"]),
                "attempt_id": uuid.UUID(context["attempt_id"]),
                "scenario_id": uuid.UUID(context["scenario_id"]),
                "trace_id": context["trace_id"],
                "title": context["chat_title"],
            }

            attempt = {
                "id": uuid.UUID(context["attempt_id"]),
                "simulation_id": uuid.UUID(context["simulation_id"]),
            }

            message_created_at = context["message_created_at"]

            logger.info(
                f"Starting hint generation for chat {chat_id}, message {message_id}"
            )

            # Emit start event
            await emit_hint_progress(
                {
                    "type": "start",
                    "message": "Starting hint generation",
                    "chat_id": str(chat_id),
                    "message_id": str(message_id),
                },
                sio_instance,
                chat_id,
            )

            # Build input items
            input_items: list[TResponseInputItem] = []

            # Format document info if documents are available (no images needed for hints)
            if context["documents"]:
                document_info = format_document_info(context["documents"], False)
                input_items.append(document_info)

            # Get all messages for the chat using SQL file
            sql = load_sql("sql/v3/simulations/get_simulation_messages.sql")
            message_rows = await conn.fetch(sql, str(chat_id))
            all_messages = [dict(row) for row in message_rows]

            # Filter messages up to and including the target message
            messages = [
                msg for msg in all_messages if msg["created_at"] <= message_created_at
            ]

            # Build conversation history
            conversation_history = get_simulation_conversation_history(messages)

            # Format scenario from context
            chat_scenario = format_chat_scenario(context["problem_statement"])
            input_items.insert(0, chat_scenario)
            input_items.extend(conversation_history)

            # Check rate limit
            profile_id_uuid = uuid.UUID(context["profile_id"]) if context["profile_id"] else None
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

            # Build hint agent from context
            hint_agent = build_hint_agent(context)

            # Create model run with all junction records using SQL file
            sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
            model_run_row = await conn.fetchrow(
                sql_create_run,
                str(department_id),
                context["model_id"],
                context["agent_id"],
                "agent",
                context["profile_id"],
            )
            model_run_id = uuid.UUID(model_run_row["model_run_id"])

            # Run the hint agent
            logger.info("Running hint agent with parallel tool calls...")
            with trace(
                chat["title"], trace_id=chat["trace_id"], group_id=str(attempt["id"])
            ):
                result = await Runner.run(
                    hint_agent.agent(),
                    input=input_items,
                    context=DebugContext(conn=conn, model_run_id=model_run_id),
                )

            # Update token usage using SQL file
            usage = result.context_wrapper.usage
            sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
            await conn.execute(
                sql_update_tokens,
                str(model_run_id),
                usage.input_tokens,
                usage.output_tokens,
            )

            logger.info("Hint agent completed successfully")

            # Extract hints from global storage
            hint_1 = hint_results.get("hint_1", "")
            hint_2 = hint_results.get("hint_2", "")
            hint_3 = hint_results.get("hint_3", "")

            # Log what was generated
            hints_generated = sum([bool(hint_1), bool(hint_2), bool(hint_3)])
            logger.info(f"Generated {hints_generated}/3 hints")

            if hints_generated < 3:
                logger.warning(
                    f"Not all hints were generated for message {message_id}. "
                    f"Got: hint_1={bool(hint_1)}, hint_2={bool(hint_2)}, hint_3={bool(hint_3)}"
                )

            # Create SimulationHints records using direct SQL
            hint_ids: list[dict[str, Any]] = []
            for i, hint_text in enumerate([hint_1, hint_2, hint_3], 1):
                if hint_text:  # Only save non-empty hints
                    # Get the next idx for this message
                    sql_max_idx = """
                        SELECT COALESCE(MAX(idx), -1) + 1 as next_idx
                        FROM simulation_hints
                        WHERE simulation_message_id = $1::uuid
                    """
                    max_idx_row = await conn.fetchrow(sql_max_idx, str(message_id))
                    next_idx = max_idx_row["next_idx"] if max_idx_row else 0
                    
                    # Insert the hint
                    sql_insert = """
                        INSERT INTO simulation_hints (simulation_message_id, idx, hint)
                        VALUES ($1::uuid, $2, $3)
                        RETURNING simulation_message_id::text, idx
                    """
                    hint_result_row = await conn.fetchrow(
                        sql_insert, str(message_id), next_idx, hint_text
                    )
                    hint_result = {
                        "simulation_message_id": hint_result_row["simulation_message_id"],
                        "idx": hint_result_row["idx"],
                    }
                    hint_ids.append(hint_result)
                    logger.info(
                        f"Created hint {i} (idx={hint_result['idx']}): {hint_text[:80]}..."
                    )

            logger.info(
                f"Successfully generated {len(hint_ids)} hints for message {message_id} "
                f"in chat {chat_id}"
            )

            # Emit completion event
            await emit_hint_progress(
                {
                    "type": "complete",
                    "message": "Hint generation completed successfully",
                    "chat_id": str(chat_id),
                    "message_id": str(message_id),
                    "hint_ids": [
                        f"{h['simulation_message_id']}_{h['idx']}" for h in hint_ids
                    ],
                    "hints_count": len(hint_ids),
                },
                sio_instance,
                chat_id,
            )
            
            logger.info(
                f"Background hint generation completed: {len(hint_ids)} hints created"
            )
        except Exception as e:
            logger.error(
                f"Background hint generation failed for message {message_id}: {e}",
                exc_info=True,
            )
            
            # Emit error event
            if sio_instance:
                try:
                    await sio_instance.emit(
                        "hint_generation_progress",
                        {
                            "type": "error",
                            "message": f"Hint generation failed: {str(e)}",
                            "error": str(e),
                            "chat_id": str(chat_id),
                            "message_id": str(message_id),
                        },
                        room=f"simulation_{chat_id}",
                    )
                except Exception as emit_error:
                    logger.warning(f"Failed to emit error event: {emit_error}")

