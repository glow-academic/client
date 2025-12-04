"""Shared helper for selecting scenario attributes (persona, documents, parameter_items).

This follows the cohesive pattern established in _randomly_fill_scenario_attributes_sql
and the randomize endpoint. Can be used internally or via API endpoint.
"""

import json
import random
import uuid
from collections.abc import Sequence
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

router = APIRouter()


class SelectAttributesRequest(BaseModel):
    """Request to select scenario attributes."""

    scenarioId: str
    departmentId: str
    profileId: str | None = None


class SelectAttributesResponse(BaseModel):
    """Response with selected scenario attributes."""

    success: bool
    message: str
    personaId: str | None = None
    personaIds: list[str] = []
    documentIds: list[str] = []
    parameterItemIds: list[str] = []


def parse_jsonb(data: Sequence[object] | str | None) -> list[dict[str, Any]]:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            return []
    if not isinstance(data, list):
        return []
    return [dict(item) for item in data]


async def select_scenario_attributes(
    conn: asyncpg.Connection,
    scenario_id: uuid.UUID | str,
    department_id: uuid.UUID | str,
    profile_id: str | None = None,
) -> dict[str, Any]:
    """Select persona, documents, and parameter_items for a scenario.

    Follows the cohesive pattern: existing links → random selection.
    Returns persona_id (for backward compatibility with agent calls) and persona_ids (all selected personas).
    Supports multiple personas per scenario (enables multiple agents in a single room).

    Args:
        conn: Database connection
        scenario_id: UUID or string UUID of the scenario
        department_id: UUID or string UUID of the department to filter by
        profile_id: Optional profile ID for fallback logic

    Returns:
        dict with keys:
            - persona_id: UUID | None (first persona for backward compatibility with agent calls)
            - persona_ids: list[UUID] (all selected personas - supports multiple agents)
            - document_ids: list[UUID] (selected documents, 1 document)
            - parameter_item_ids: list[UUID] (selected parameter items)
    """
    # Convert string UUIDs or asyncpg UUIDs to Python UUID objects
    if isinstance(scenario_id, str):
        scenario_id_uuid = uuid.UUID(scenario_id)
    else:
        # Handle asyncpg UUID objects or Python UUID objects
        scenario_id_uuid = uuid.UUID(str(scenario_id))

    if isinstance(department_id, str):
        department_id_uuid = uuid.UUID(department_id)
    else:
        # Handle asyncpg UUID objects or Python UUID objects
        department_id_uuid = uuid.UUID(str(department_id))

    # Step 1: Get all randomization data and existing scenario links in a single query
    sql = load_sql("sql/v3/scenarios/get_randomization_data_complete.sql")
    dept_uuids = [department_id_uuid]
    result = await conn.fetchrow(sql, dept_uuids, scenario_id_uuid)

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

    # Get existing scenario links from the same query result
    existing_persona_ids = result.get("persona_ids", []) or []
    existing_document_ids = result.get("document_ids", []) or []
    existing_parameter_item_ids = result.get("parameter_item_ids", []) or []

    # Convert UUIDs and build lookup maps
    active_personas = []
    for p in personas_data:
        active_personas.append(
            {
                **p,
                "id": uuid.UUID(str(p["id"])),
            }
        )

    active_documents = []
    for d in documents_data:
        active_documents.append(
            {
                **d,
                "id": uuid.UUID(str(d["id"])),
            }
        )

    active_parameters = []
    for p in parameters_data:
        active_parameters.append(
            {
                **p,
                "id": uuid.UUID(str(p["id"])),
            }
        )

    all_parameter_items = []
    for pi in parameter_items_data:
        all_parameter_items.append(
            {
                **pi,
                "id": uuid.UUID(str(pi["id"])),
                "parameter_id": uuid.UUID(str(pi["parameter_id"])),
            }
        )

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

    # Step 2: Select personas (priority: existing links, then random selection)
    scenario_persona_ids: list[uuid.UUID] = []

    # Priority 1: Check for existing persona links
    if existing_persona_ids:
        scenario_persona_ids = [uuid.UUID(p) for p in existing_persona_ids]
        logger.info(
            f"Found {len(scenario_persona_ids)} existing persona_ids: {scenario_persona_ids}"
        )

    # Priority 2: Random persona selection if still none (filtered by selected department)
    if not scenario_persona_ids:
        if active_personas:
            # Randomly select 1 persona from active personas
            selected_persona = random.choice(active_personas)
            scenario_persona_ids = [selected_persona["id"]]
            logger.info(f"Randomly selected persona_id: {scenario_persona_ids[0]}")
        else:
            logger.info("No active personas found")

    # Get single persona_id for backward compatibility (agent calls may still need single persona)
    # persona_ids contains all selected personas (supports multiple agents)
    persona_id = scenario_persona_ids[0] if scenario_persona_ids else None
    logger.info(f"Using persona_id for scenario generation: {persona_id} (all personas: {scenario_persona_ids})")

    # Step 3: Select parameter_items (priority: existing links, then random selection)
    # Priority 1: Check for existing parameter item links
    existing_param_ids = []
    if existing_parameter_item_ids:
        existing_param_ids = [uuid.UUID(p) for p in existing_parameter_item_ids]

    param_ids: list[uuid.UUID] = []
    if existing_param_ids:
        # Use existing parameter items
        param_ids = existing_param_ids
        logger.info(f"Using {len(param_ids)} existing parameter_item_ids: {param_ids}")
    else:
        # Priority 2: Random parameter item selection if none linked
        # For each active parameter, randomly select one parameter item
        if active_parameters:
            for param in active_parameters:
                param_items = parameter_items_by_param_id.get(param["id"], [])
                if param_items:
                    selected_item = random.choice(param_items)
                    param_ids.append(selected_item["id"])
            logger.info(
                f"Randomly selected {len(param_ids)} parameter_item_ids: {param_ids}"
            )
        else:
            logger.info("No active parameters found")

    # Step 4: Select documents (priority: existing links, then parameter_item matching, then random)
    # Priority 1: Check for existing document links
    existing_doc_ids = []
    if existing_document_ids:
        existing_doc_ids = [uuid.UUID(d) for d in existing_document_ids]

    doc_ids: list[uuid.UUID] = []
    if existing_doc_ids:
        # Use existing documents
        doc_ids = existing_doc_ids
        logger.info(f"Using {len(doc_ids)} existing document_ids: {doc_ids}")
    else:
        # Priority 2: Find documents matching parameter_items via document_parameter_items junction
        # First, get parameter items for this scenario (for document matching)
        doc_matching_param_item_ids = param_ids.copy() if param_ids else []

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
            logger.info(
                f"Found {len(matching_documents)} documents matching parameter items"
            )

        if matching_documents:
            # Select 1 document from matching documents (matching other implementations)
            selected_doc = random.choice(matching_documents)
            doc_ids = [selected_doc["id"]]
            logger.info(
                f"Selected document via parameter items: {selected_doc['id']} ({selected_doc.get('name', 'unknown')})"
            )
        elif active_documents:
            # Priority 3: Fallback to random selection from active documents
            logger.info("No documents match parameter items, using random selection")
            selected_doc = random.choice(active_documents)
            doc_ids = [selected_doc["id"]]
            logger.info(
                f"Randomly selected document: {selected_doc['id']} ({selected_doc.get('name', 'unknown')})"
            )
        else:
            logger.info("No active documents found")

    return {
        "persona_id": persona_id,
        "persona_ids": scenario_persona_ids,
        "document_ids": doc_ids,
        "parameter_item_ids": param_ids,
    }


@router.post("/select-attributes", response_model=SelectAttributesResponse)
async def select_scenario_attributes_endpoint(
    request: SelectAttributesRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SelectAttributesResponse:
    """API endpoint for selecting scenario attributes."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        result = await select_scenario_attributes(
            conn=conn,
            scenario_id=uuid.UUID(request.scenarioId),
            department_id=uuid.UUID(request.departmentId),
            profile_id=request.profileId,
        )

        return SelectAttributesResponse(
            success=True,
            message="Scenario attributes selected successfully",
            personaId=str(result["persona_id"]) if result["persona_id"] else None,
            personaIds=[str(p) for p in result["persona_ids"]],
            documentIds=[str(d) for d in result["document_ids"]],
            parameterItemIds=[str(p) for p in result["parameter_item_ids"]],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="select_scenario_attributes_endpoint",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
