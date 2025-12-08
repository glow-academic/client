"""Scenario randomize endpoint - v3 API following DHH principles."""

import json
import random
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.scenario.generate_problem_statement import (
    generate_scenario_problem_statement,
)
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)


# Inline request/response schemas
class RandomizeScenarioRequest(BaseModel):
    """Request to randomize scenario sections."""

    name: str | None = None
    description: str | None = None
    personaIds: list[str] | None = None
    documentIds: list[str] | None = None
    parameterItemIds: list[str] | None = None
    departmentIds: list[str] | None = None
    targets: list[str] = []  # ["persona", "documents", "parameters"]
    scenarioId: str | None = None  # When provided, creates child scenario
    profileId: str | None = None  # For department fallback logic


class RandomizeScenarioResponse(BaseModel):
    """Response from scenario randomization."""

    success: bool
    message: str
    personaIds: list[str] = []
    documentIds: list[str] = []
    parameterItemIds: list[str] = []
    childScenarioId: str | None = None  # Returned when scenarioId provided


router = APIRouter()


async def randomize_scenario_attributes(
    conn: asyncpg.Connection,
    persona_ids: list[uuid.UUID] | None = None,
    document_ids: list[uuid.UUID] | None = None,
    parameter_item_ids: list[uuid.UUID] | None = None,
    department_ids: list[uuid.UUID] | None = None,
    scenario_id: uuid.UUID | None = None,
    profile_id: uuid.UUID | None = None,
    targets: list[str] | None = None,
) -> dict[str, Any]:
    """Core randomization logic for scenario attributes.

    Returns dict with keys:
        - department_id: UUID
        - persona_id: UUID | None
        - persona_ids: list[UUID]
        - document_ids: list[UUID]
        - parameter_item_ids: list[UUID]
        - child_scenario_id: UUID | None (if scenario_id provided)
    """
    if targets is None:
        targets = []

    # Step 1: Department selection with fallback logic
    # Track if we should use "all departments" (empty array) vs specific department(s)
    use_all_departments = not department_ids or len(department_ids) == 0

    selected_department_id: uuid.UUID | None = None
    if department_ids and len(department_ids) > 0:
        # Use provided departments, randomly pick one
        selected_department_id = random.choice(department_ids)
        logger.info(f"Using provided department_id: {selected_department_id}")
    elif profile_id:
        # Get profile's accessible departments
        sql = load_sql("sql/v3/profile/get_departments_for_profile.sql")
        profile_dept_rows = await conn.fetch(sql, str(profile_id))
        if profile_dept_rows and len(profile_dept_rows) > 0:
            profile_dept_ids = [uuid.UUID(str(row["id"])) for row in profile_dept_rows]
            selected_department_id = random.choice(profile_dept_ids)
            logger.info(f"Using department_id from profile: {selected_department_id}")
    else:
        # Fallback to all active departments
        sql = load_sql("sql/v3/departments/get_all_active_departments.sql")
        all_dept_rows = await conn.fetch(sql)
        if all_dept_rows and len(all_dept_rows) > 0:
            all_dept_ids = [uuid.UUID(str(row["id"])) for row in all_dept_rows]
            selected_department_id = random.choice(all_dept_ids)
            logger.info(f"Using first active department: {selected_department_id}")

    if not selected_department_id:
        raise ValueError(
            "Cannot proceed without a department_id - no departments available"
        )

    # Step 2: Load randomization data
    # If department_ids was null/empty (all departments), pass empty array to SQL query
    # Otherwise pass the selected department for filtering
    dept_uuids: list[uuid.UUID] = (
        [] if use_all_departments else [selected_department_id]
    )
    sql = load_sql("sql/v3/scenarios/get_randomization_data_complete.sql")
    result = await conn.fetchrow(sql, dept_uuids, scenario_id)

    if not result:
        raise ValueError("Failed to fetch randomization data")

    # Parse JSONB aggregations
    personas_data = parse_jsonb(result.get("personas", []))
    documents_data = parse_jsonb(result.get("documents", []))
    parameters_data = parse_jsonb(result.get("parameters", []))
    parameter_items_data = parse_jsonb(result.get("parameter_items", []))
    document_parameter_items_data = parse_jsonb(
        result.get("document_parameter_items", [])
    )

    # Get existing scenario links if scenario_id provided
    existing_persona_ids = result.get("persona_ids", []) or []
    existing_document_ids = result.get("document_ids", []) or []
    existing_parameter_item_ids = result.get("parameter_item_ids", []) or []

    # Build lookup maps
    active_personas = []
    for p in personas_data:
        if "id" not in p:
            logger.warning("Skipping persona entry missing 'id' field")
            continue
        active_personas.append(
            {
                **p,
                "id": uuid.UUID(str(p["id"])),
            }
        )

    active_documents = []
    for d in documents_data:
        if "id" not in d:
            logger.warning("Skipping document entry missing 'id' field")
            continue
        active_documents.append(
            {
                **d,
                "id": uuid.UUID(str(d["id"])),
            }
        )

    active_parameters = []
    for p in parameters_data:
        if "id" not in p:
            logger.warning("Skipping parameter entry missing 'id' field")
            continue
        active_parameters.append(
            {
                **p,
                "id": uuid.UUID(str(p["id"])),
                "document_parameter": p.get("document_parameter", False),
                "persona_parameter": p.get("persona_parameter", False),
            }
        )

    all_parameter_items = []
    for pi in parameter_items_data:
        if "id" not in pi or "parameter_id" not in pi:
            logger.warning(
                "Skipping parameter item entry missing 'id' or 'parameter_id' field"
            )
            continue
        all_parameter_items.append(
            {
                **pi,
                "id": uuid.UUID(str(pi["id"])),
                "parameter_id": uuid.UUID(str(pi["parameter_id"])),
            }
        )

    document_parameter_items_junction = []
    for j in document_parameter_items_data:
        if "document_id" not in j or "parameter_item_id" not in j:
            logger.warning(
                "Skipping document_parameter_item junction entry missing required fields"
            )
            continue
        document_parameter_items_junction.append(
            {
                "document_id": uuid.UUID(str(j["document_id"])),
                "parameter_item_id": uuid.UUID(str(j["parameter_item_id"])),
            }
        )

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

    # Step 3: Persona selection
    scenario_persona_ids: list[uuid.UUID] = []
    # Check if persona is in targets - if so, ignore provided persona_ids and randomize
    should_randomize_persona = not targets or "persona" in [t.lower() for t in targets]

    if scenario_id and existing_persona_ids:
        # Use existing persona links from parent - keep all personas (supports multiple agents)
        scenario_persona_ids = [uuid.UUID(p) for p in existing_persona_ids]
        logger.info(
            f"Found {len(scenario_persona_ids)} existing persona_ids: {scenario_persona_ids}"
        )
    elif persona_ids and not should_randomize_persona:
        # Use provided personas only if persona is NOT in targets
        scenario_persona_ids = persona_ids[:1]  # Take first one only
        logger.info(f"Using provided persona_id: {scenario_persona_ids}")
    elif should_randomize_persona:
        # Random selection from active personas (when persona is in targets)
        if active_personas:
            selected_persona = random.choice(active_personas)
            scenario_persona_ids = [selected_persona["id"]]
            logger.info(f"Randomly selected persona_id: {scenario_persona_ids[0]}")
        else:
            logger.info("No active personas found")

    # Get single persona_id for agent calls
    persona_id = scenario_persona_ids[0] if scenario_persona_ids else None

    # Step 3.5: Persona parameter selection (when randomizing personas)
    persona_param_ids: list[uuid.UUID] = []
    if not targets or "persona" in [t.lower() for t in targets]:
        # Randomize persona parameters when randomizing personas
        persona_parameters = [
            p for p in active_parameters if p.get("persona_parameter", False)
        ]
        if persona_parameters:
            for param in persona_parameters:
                param_items = parameter_items_by_param_id.get(param["id"], [])
                if param_items:
                    selected_item = random.choice(param_items)
                    persona_param_ids.append(selected_item["id"])
            logger.info(
                f"Randomly selected {len(persona_param_ids)} persona parameter_item_ids: {persona_param_ids}"
            )

    # Step 4: Parameter item selection
    param_ids: list[uuid.UUID] = []
    # Check if parameters is in targets - if so, ignore provided parameter_item_ids and randomize
    should_randomize_parameters = not targets or "parameters" in [
        t.lower() for t in targets
    ]

    if scenario_id and existing_parameter_item_ids:
        # Use existing parameter item links from parent
        param_ids = [uuid.UUID(p) for p in existing_parameter_item_ids]
        logger.info(f"Using {len(param_ids)} existing parameter_item_ids: {param_ids}")
    elif parameter_item_ids and not should_randomize_parameters:
        # Use provided parameter items only if parameters is NOT in targets
        param_ids = parameter_item_ids
        logger.info(f"Using provided parameter_item_ids: {param_ids}")
    elif should_randomize_parameters:
        # Random selection: one per parameter (excluding persona/document parameters)
        general_parameters = [
            p
            for p in active_parameters
            if not p.get("document_parameter", False)
            and not p.get("persona_parameter", False)
        ]
        if general_parameters:
            for param in general_parameters:
                param_items = parameter_items_by_param_id.get(param["id"], [])
                if param_items:
                    selected_item = random.choice(param_items)
                    param_ids.append(selected_item["id"])
            logger.info(
                f"Randomly selected {len(param_ids)} general parameter_item_ids: {param_ids}"
            )
        else:
            logger.info("No active general parameters found")

    # Step 5: Document selection (with document_parameter_items junction logic)
    doc_ids: list[uuid.UUID] = []
    # Check if documents is in targets - if so, ignore provided document_ids and randomize
    should_randomize_documents = not targets or "documents" in [
        t.lower() for t in targets
    ]

    if scenario_id and existing_document_ids:
        # Use existing document links from parent
        doc_ids = [uuid.UUID(d) for d in existing_document_ids]
        logger.info(f"Using {len(doc_ids)} existing document_ids: {doc_ids}")
    elif document_ids and not should_randomize_documents:
        # Use provided documents only if documents is NOT in targets
        doc_ids = document_ids
        logger.info(f"Using provided document_ids: {doc_ids}")
    elif should_randomize_documents:
        # Get parameter items for document matching
        doc_matching_param_item_ids = param_ids.copy() if param_ids else []

        # If no parameter items, randomly select one per active parameter
        if not doc_matching_param_item_ids and active_parameters:
            for param in active_parameters:
                param_items = parameter_items_by_param_id.get(param["id"], [])
                if param_items:
                    selected_item = random.choice(param_items)
                    doc_matching_param_item_ids.append(selected_item["id"])

        # Try to find documents matching parameter items via document_parameter_items junction
        matching_documents = []
        if doc_matching_param_item_ids:
            matching_documents = [
                documents_by_id[j["document_id"]]
                for j in document_parameter_items_junction
                if j["parameter_item_id"] in doc_matching_param_item_ids
                and j["document_id"] in documents_by_id
            ]
            logger.info(
                f"Found {len(matching_documents)} documents matching parameter items"
            )

        if matching_documents:
            # Select 1 document from matching documents
            selected_doc = random.choice(matching_documents)
            doc_ids = [selected_doc["id"]]
            logger.info(f"Selected document via parameter items: {selected_doc['id']}")
        elif active_documents:
            # Fallback to random selection from active documents
            logger.info("No documents match parameter items, using random selection")
            selected_doc = random.choice(active_documents)
            doc_ids = [selected_doc["id"]]
            logger.info(f"Randomly selected document: {selected_doc['id']}")
        else:
            logger.info("No active documents found")

    # Step 5.5: Document parameter extraction (when randomizing documents)
    document_param_ids: list[uuid.UUID] = []
    if doc_ids and (not targets or "documents" in [t.lower() for t in targets]):
        # Extract document parameters from selected documents via document_parameter_items junction
        for doc_id in doc_ids:
            doc_param_items = [
                j["parameter_item_id"]
                for j in document_parameter_items_junction
                if j["document_id"] == doc_id
            ]
            # Only include if they're document parameters
            for param_item_id in doc_param_items:
                param_item = parameter_items_by_id.get(param_item_id)
                if param_item:
                    param_id = param_item["parameter_id"]
                    # Check if this parameter is a document parameter
                    param = next(
                        (p for p in active_parameters if p["id"] == param_id), None
                    )
                    if param and param.get("document_parameter", False):
                        if param_item_id not in document_param_ids:
                            document_param_ids.append(param_item_id)
        logger.info(
            f"Extracted {len(document_param_ids)} document parameter_item_ids from selected documents: {document_param_ids}"
        )

    # Step 6: Child scenario creation (if scenario_id provided)
    child_scenario_id: uuid.UUID | None = None
    if scenario_id:
        # Get parent scenario
        sql = load_sql("sql/v3/scenarios/get_scenario_by_id.sql")
        parent_scenario = await conn.fetchrow(sql, scenario_id)
        if not parent_scenario:
            raise ValueError(f"Parent scenario {scenario_id} not found")

        parent_scenario_dict = dict(parent_scenario)

        # Check for problem statement
        sql = load_sql("sql/v3/scenarios/get_scenario_problem_statement_active.sql")
        problem_statement_row = await conn.fetchrow(sql, scenario_id)
        scenario_problem_statement = (
            problem_statement_row["problem_statement"]
            if problem_statement_row
            else None
        )

        # Generate problem statement if missing
        if not scenario_problem_statement:
            logger.info("No problem statement found, generating via scenario agent")
            # Disable image generation for API endpoints (only WebSocket should handle AI)
            generated = await generate_scenario_problem_statement(
                conn=conn,
                department_id=selected_department_id,
                persona_id=persona_id,
                document_ids=doc_ids if doc_ids else None,
                parameter_item_ids=param_ids if param_ids else None,
                profile_id=profile_id,
                objectives_enabled=parent_scenario_dict.get("objectives_enabled", True),
                images_enabled=False,  # Disable image generation for API endpoints
            )
            scenario_problem_statement = generated.get("description") or ""
            scenario_title = generated.get("title") or ""
            scenario_objectives = generated.get("objectives") or []
        else:
            scenario_title = parent_scenario_dict.get("name", "")
            # Get objectives from parent
            sql = load_sql("sql/v3/scenarios/get_scenario_objectives_top_n.sql")
            objectives_data = await conn.fetch(sql, scenario_id, 3)
            scenario_objectives = [obj["objective"] for obj in objectives_data]

        # Create child scenario variant
        sql = load_sql("sql/v3/scenarios/insert_scenario_variant.sql")
        new_scenario_row = await conn.fetchrow(
            sql,
            scenario_title or parent_scenario_dict.get("name", ""),
            True,  # generated = True
            True,  # active = True
            parent_scenario_dict.get("objectives_enabled", True),
            parent_scenario_dict.get(
                "image_enabled", True
            ),  # Use image_enabled, not image_input_enabled
            parent_scenario_dict.get("scenario_agent_id"),  # Required field
            parent_scenario_dict.get("image_agent_id"),  # Required field
        )
        child_scenario_id = new_scenario_row["id"]
        logger.info(
            f"Created child scenario variant {child_scenario_id} for parent {scenario_id}"
        )

        # Insert problem statement
        if scenario_problem_statement:
            sql = load_sql("sql/v3/scenarios/insert_scenario_problem_statement.sql")
            # Ensure we have a valid name - use scenario title if available, otherwise fallback
            problem_statement_name = (
                scenario_title.strip()
                if scenario_title and scenario_title.strip()
                else "Generated Problem Statement"
            )
            await conn.fetchrow(
                sql,
                child_scenario_id,
                scenario_problem_statement,
                problem_statement_name,
                True,  # active = True
            )
            logger.info(
                f"Created problem statement for child scenario {child_scenario_id}"
            )

        # Insert objectives
        if scenario_objectives and parent_scenario_dict.get("objectives_enabled", True):
            sql = load_sql("sql/v3/scenarios/insert_scenario_objective.sql")
            for idx, objective in enumerate(scenario_objectives[:3]):  # Limit to 3
                await conn.execute(sql, child_scenario_id, idx, objective)
            logger.info(
                f"Inserted {min(len(scenario_objectives), 3)} objectives for child scenario {child_scenario_id}"
            )

        # Create scenario_tree edge
        sql = load_sql("sql/v3/scenarios/insert_scenario_tree_edge.sql")
        await conn.execute(
            sql,
            scenario_id,  # parent
            child_scenario_id,  # child
            True,  # active
        )
        logger.info(
            f"Created scenario_tree edge: parent={scenario_id} -> child={child_scenario_id}"
        )

        # Link selected attributes to child scenario
        # Link persona (only ONE active)
        if persona_id:
            sql = load_sql("sql/v3/scenarios/insert_scenario_persona_link.sql")
            await conn.execute(sql, child_scenario_id, persona_id, True)
            logger.info(
                f"Linked persona {persona_id} to child scenario {child_scenario_id}"
            )

        # Link documents
        if doc_ids:
            sql = load_sql("sql/v3/scenarios/insert_scenario_document_link.sql")
            for doc_id in doc_ids:
                await conn.execute(sql, child_scenario_id, doc_id, True)
            logger.info(
                f"Linked {len(doc_ids)} document(s) to child scenario {child_scenario_id}"
            )

        # Link parameter items
        if param_ids:
            sql = load_sql("sql/v3/scenarios/insert_scenario_parameter_link.sql")
            for param_id in param_ids:
                await conn.execute(sql, child_scenario_id, param_id, True)
            logger.info(
                f"Linked {len(param_ids)} parameter item(s) to child scenario {child_scenario_id}"
            )

        # Link department
        sql = load_sql("sql/v3/scenarios/insert_scenario_department_link.sql")
        await conn.execute(sql, child_scenario_id, selected_department_id, True)
        logger.info(
            f"Linked department {selected_department_id} to child scenario {child_scenario_id}"
        )

    # Combine all parameter item IDs: general + persona + document
    all_param_item_ids = (
        list(param_ids) + list(persona_param_ids) + list(document_param_ids)
    )
    # Remove duplicates while preserving order
    seen = set()
    unique_param_item_ids = []
    for pid in all_param_item_ids:
        if pid not in seen:
            seen.add(pid)
            unique_param_item_ids.append(pid)

    return {
        "department_id": selected_department_id,
        "persona_id": persona_id,
        "persona_ids": scenario_persona_ids,
        "document_ids": doc_ids,
        "parameter_item_ids": unique_param_item_ids,
        "child_scenario_id": child_scenario_id,
    }


def parse_jsonb(data: Any) -> list[dict[str, Any]]:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            return []
    if not isinstance(data, list):
        return []
    return [dict(item) for item in data]


@router.post("/randomize", response_model=RandomizeScenarioResponse)
async def randomize_scenario_sections(
    request: RandomizeScenarioRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RandomizeScenarioResponse:
    """Randomize scenario attributes and optionally create child scenario variant."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Convert string IDs to UUIDs
        persona_ids = (
            [uuid.UUID(p) for p in request.personaIds] if request.personaIds else None
        )
        document_ids = (
            [uuid.UUID(d) for d in request.documentIds] if request.documentIds else None
        )
        parameter_item_ids = (
            [uuid.UUID(p) for p in request.parameterItemIds]
            if request.parameterItemIds
            else None
        )
        department_ids = (
            [uuid.UUID(d) for d in request.departmentIds]
            if request.departmentIds
            else None
        )
        scenario_id = uuid.UUID(request.scenarioId) if request.scenarioId else None
        profile_id = uuid.UUID(request.profileId) if request.profileId else None

        # Normalize empty lists
        if document_ids:
            document_ids = [d for d in document_ids if d]
        if parameter_item_ids:
            parameter_item_ids = [p for p in parameter_item_ids if p]
        if department_ids:
            department_ids = [d for d in department_ids if d]
        targets = [t for t in request.targets if t.strip()] if request.targets else []

        # Call core randomization function
        result = await randomize_scenario_attributes(
            conn=conn,
            persona_ids=persona_ids,
            document_ids=document_ids,
            parameter_item_ids=parameter_item_ids,
            department_ids=department_ids,
            scenario_id=scenario_id,
            profile_id=profile_id,
            targets=targets,
        )

        # Return response
        suggested_persona_ids = [str(p) for p in result["persona_ids"]]

        return RandomizeScenarioResponse(
            success=True,
            message="Randomization completed successfully",
            personaIds=suggested_persona_ids,
            documentIds=[str(x) for x in result["document_ids"]],
            parameterItemIds=[str(x) for x in result["parameter_item_ids"]],
            childScenarioId=str(result["child_scenario_id"])
            if result["child_scenario_id"]
            else None,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="randomize_scenario_sections",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
