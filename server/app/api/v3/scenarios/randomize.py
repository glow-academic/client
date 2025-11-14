"""Scenario randomize endpoint - v3 API following DHH principles."""

import json
import random
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.error_handler import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel


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


class RandomizeScenarioResponse(BaseModel):
    """Response from scenario randomization."""

    success: bool
    message: str
    personaIds: list[str] = []
    documentIds: list[str] = []
    parameterItemIds: list[str] = []


router = APIRouter()


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            return json.loads(data)  # type: ignore
        except json.JSONDecodeError:
            return {}
    return data or {}


@router.post("/randomize", response_model=RandomizeScenarioResponse)
async def randomize_scenario_sections(
    request: RandomizeScenarioRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RandomizeScenarioResponse:
    """Suggest randomized persona/documents/parameters based on current inputs."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        # Convert string IDs to UUIDs
        persona_ids = (
            [uuid.UUID(p) for p in request.personaIds] if request.personaIds else None
        )
        # For now, use first persona for suggestions
        persona_id = persona_ids[0] if persona_ids and len(persona_ids) > 0 else None
        document_ids = (
            [uuid.UUID(d) for d in request.documentIds] if request.documentIds else None
        )
        parameter_item_ids = (
            [uuid.UUID(p) for p in request.parameterItemIds]
            if request.parameterItemIds
            else None
        )
        department_ids = (
            [str(d) for d in request.departmentIds] if request.departmentIds else None
        )

        # Normalize empty lists
        if document_ids:
            document_ids = [d for d in document_ids if d]
        if parameter_item_ids:
            parameter_item_ids = [p for p in parameter_item_ids if p]
        if department_ids:
            department_ids = [d for d in department_ids if d]
        targets = [t for t in request.targets if t.strip()] if request.targets else []

        # Get randomization data (single SQL file with conditional logic)
        dept_uuids = [uuid.UUID(d) for d in department_ids] if department_ids and len(department_ids) > 0 else None
        sql_query = load_sql("sql/v3/scenarios/get_randomization_data_complete.sql")
        sql_params = (dept_uuids,)
        result = await conn.fetchrow(sql_query, dept_uuids)

        if not result:
            raise ValueError("Failed to fetch randomization data")

        # Parse JSONB aggregations
        personas_data = parse_jsonb(result.get("personas"))
        if not isinstance(personas_data, list):
            personas_data = []

        documents_data = parse_jsonb(result.get("documents"))
        if not isinstance(documents_data, list):
            documents_data = []

        parameters_data = parse_jsonb(result.get("parameters"))
        if not isinstance(parameters_data, list):
            parameters_data = []

        parameter_items_data = parse_jsonb(result.get("parameter_items"))
        if not isinstance(parameter_items_data, list):
            parameter_items_data = []

        document_parameter_items_data = parse_jsonb(result.get("document_parameter_items"))
        if not isinstance(document_parameter_items_data, list):
            document_parameter_items_data = []

        # Build lookup maps
        parameter_items_by_id: dict[uuid.UUID, dict[str, Any]] = {}
        for pi in parameter_items_data:
            pi_id = uuid.UUID(str(pi["id"]))
            parameter_items_by_id[pi_id] = {
                **pi,
                "id": pi_id,
                "parameter_id": uuid.UUID(str(pi["parameter_id"])),
            }

        parameter_items_by_param_id: dict[uuid.UUID, list[dict[str, Any]]] = {}
        for pi in parameter_items_data:
            param_id = uuid.UUID(str(pi["parameter_id"]))
            if param_id not in parameter_items_by_param_id:
                parameter_items_by_param_id[param_id] = []
            parameter_items_by_param_id[param_id].append(parameter_items_by_id[uuid.UUID(str(pi["id"]))])

        documents_by_id: dict[uuid.UUID, dict[str, Any]] = {}
        for d in documents_data:
            doc_id = uuid.UUID(str(d["id"]))
            documents_by_id[doc_id] = {**d, "id": doc_id}

        # Simple randomization logic
        targets_set = {t.lower() for t in targets}

        # Suggest persona (random selection)
        suggested_persona_id = persona_id
        if "persona" in targets_set and personas_data:
            persona_dict = random.choice(personas_data)
            suggested_persona_id = uuid.UUID(str(persona_dict["id"]))

        # Suggest documents (random selection, matching via junction if parameter items provided)
        suggested_document_ids: list[uuid.UUID] = []
        if "documents" in targets_set:
            if parameter_item_ids:
                # Find documents linked to parameter items via junction
                matching_docs = [
                    documents_by_id[j["document_id"]]
                    for j in document_parameter_items_data
                    if uuid.UUID(str(j["parameter_item_id"])) in parameter_item_ids
                    and uuid.UUID(str(j["document_id"])) in documents_by_id
                ]
                if matching_docs:
                    suggested_document_ids = [random.choice(matching_docs)["id"]]
            else:
                # Random selection from all documents
                if documents_data:
                    suggested_document_ids = [uuid.UUID(str(random.choice(documents_data)["id"]))]

        # Suggest parameters (random selection, one per parameter)
        suggested_parameter_item_ids: list[uuid.UUID] = []
        if "parameters" in targets_set:
            for param in parameters_data:
                param_id = uuid.UUID(str(param["id"]))
                items = parameter_items_by_param_id.get(param_id, [])
                if items:
                    chosen_item = random.choice(items)
                    suggested_parameter_item_ids.append(chosen_item["id"])

        # Return persona_ids array
        suggested_persona_ids = []
        if suggested_persona_id:
            suggested_persona_ids = [str(suggested_persona_id)]
        elif persona_ids:
            suggested_persona_ids = [str(p) for p in persona_ids]

        return RandomizeScenarioResponse(
            success=True,
            message="Randomization suggestions generated",
            personaIds=suggested_persona_ids,
            documentIds=[str(x) for x in suggested_document_ids],
            parameterItemIds=[str(x) for x in suggested_parameter_item_ids],
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="randomize_scenario_sections",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

