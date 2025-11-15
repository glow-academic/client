"""Shared utilities for simulation WebSocket handlers."""

import asyncio
import json
import logging
import random
import uuid
from typing import Any

import socketio  # type: ignore
from app.agents.collection.hint import run_hint_agent
from app.db import get_pool
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

