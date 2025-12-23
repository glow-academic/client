"""Document list endpoint - v3 API."""

from __future__ import annotations

import json
from collections import Counter
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import load_sql


# Inline mapping types (DHH style - no shared types)
class DepartmentMappingItem(BaseModel):
    """Department mapping item - extends MappingItem with optional entity ID arrays."""

    name: str
    description: str
    scenario_ids: list[str] | None = None
    simulation_ids: list[str] | None = None
    persona_ids: list[str] | None = None
    document_ids: list[str] | None = None
    rubric_ids: list[str] | None = None
    parameter_ids: list[str] | None = None
    parameter_item_ids: list[str] | None = None
    field_ids: list[str] | None = None
    agent_ids: list[str] | None = None
    staff_ids: list[str] | None = None
    cohort_ids: list[str] | None = None


class FieldMappingItem(BaseModel):
    """Field mapping item with parameter context."""

    name: str
    description: str
    parameter_id: str
    parameter_name: str


class ParameterMappingItem(BaseModel):
    """Parameter mapping item."""

    name: str
    description: str
    numerical: bool
    document_parameter: bool
    persona_parameter: bool
    scenario_parameter: bool = False
    video_parameter: bool = False


class PersonaMappingItem(BaseModel):
    """Persona mapping item with custom color and icon fields."""

    name: str
    description: str
    color: str
    icon: str
    image_model: bool | None = None


class DocumentMappingItem(BaseModel):
    """Document mapping item."""

    name: str
    description: str


# Type aliases for Dict mappings (defined before ScenarioMappingItem for forward references)
PersonaMapping = dict[str, PersonaMappingItem]
DocumentMapping = dict[str, DocumentMappingItem]
FieldMapping = dict[str, FieldMappingItem]


class ScenarioMappingItem(BaseModel):
    """Scenario mapping item with extended fields for nested data."""

    name: str
    description: str
    persona_ids: list[str]
    persona_mapping: PersonaMapping
    document_mapping: DocumentMapping
    parameter_item_mapping: FieldMapping
    parameter_item_ids: list[str]
    document_ids: list[str]


class DocumentsListRequest(BaseModel):
    """Request for documents list."""

    # profileId removed - comes from X-Profile-Id header


class DocumentItem(BaseModel):
    """Document item for list view."""

    document_id: str
    name: str
    updated_at: str
    upload_id: str | None = None
    active: bool
    extension: str | None = None
    department_ids: list[str] | None = None
    scenario_ids: list[str]
    field_ids: list[str]
    valid_field_ids: list[str]
    active_scenario_count: int
    total_scenario_links: int
    can_edit: bool
    can_delete: bool


class DocumentsListResponse(BaseModel):
    """Response for documents list."""

    documents: list[DocumentItem]
    scenario_mapping: dict[str, ScenarioMappingItem]
    field_mapping: dict[str, FieldMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]
    parameter_mapping: dict[str, ParameterMappingItem]
    # UI-ready facet options (precomputed on server)
    scenario_options: list[dict[str, str]]  # Array of {value, label}
    department_options: list[dict[str, str]]  # Array of {value, label}
    # Edit dialog data (consolidated from detail endpoint)
    valid_department_ids: list[str]
    document_type_options: list[str]


# Rebuild models to resolve forward references for OpenAPI schema generation
ScenarioMappingItem.model_rebuild()
DocumentsListResponse.model_rebuild()


router = APIRouter()


def disambiguate_scenarios(
    smap: dict[str, ScenarioMappingItem],
) -> list[dict[str, str]]:
    """Build scenario options with disambiguation for duplicate names."""
    names = Counter([v.name for v in smap.values()])
    out = []
    for sid, v in smap.items():
        label = v.name
        if names[v.name] > 1:
            # Use last 8 characters of UUID for disambiguation
            label = f"{v.name} ({sid[-8:]})"
        out.append({"value": sid, "label": label})
    return out


@router.post(
    "/list",
    response_model=DocumentsListResponse,
    dependencies=[
        audit_activity("documents.list", "{{ actor.name }} visited the Documents page")
    ],
)
async def get_documents_list(
    filters: DocumentsListRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocumentsListResponse:
    """Get documents list with tags and scenarios."""
    tags = ["documents"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return DocumentsListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("app/sql/v3/documents/list_documents.sql")
        sql_params = (profile_id,)
        rows = await conn.fetch(sql_query, profile_id)

        # Get actor name from first row (same for all rows)
        actor_name = rows[0]["actor_name"] if rows else None

        # Set audit context
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        documents: list[DocumentItem] = []
        scenario_mapping: dict[str, ScenarioMappingItem] = {}
        field_mapping: dict[str, FieldMappingItem] = {}
        department_mapping: dict[str, DepartmentMappingItem] = {}
        parameter_mapping: dict[str, ParameterMappingItem] = {}

        # Parse mappings from first row (same across all rows, replicate v2 logic)
        if rows:
            first_row = rows[0]

            # Parse scenario mapping from JSONB (replicate v2 logic)
            scenario_mapping_data = first_row.get("scenario_mapping")
            if isinstance(scenario_mapping_data, str):
                scenario_mapping_data = json.loads(scenario_mapping_data)
            if scenario_mapping_data and isinstance(scenario_mapping_data, dict):
                for sid, sdata in scenario_mapping_data.items():
                    if isinstance(sdata, dict):
                        scenario_mapping[sid] = ScenarioMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            persona_ids=[],
                            persona_mapping={},
                            document_mapping={},
                            parameter_item_mapping={},
                            parameter_item_ids=[],
                            document_ids=[],
                        )

            # Parse field mapping from JSONB (replicate v2 logic)
            field_mapping_data = first_row.get("field_mapping")
            if isinstance(field_mapping_data, str):
                field_mapping_data = json.loads(field_mapping_data)
            if field_mapping_data and isinstance(field_mapping_data, dict):
                for pid, pdata in field_mapping_data.items():
                    if isinstance(pdata, dict):
                        field_mapping[pid] = FieldMappingItem(
                            name=pdata.get("name", ""),
                            description=pdata.get("description", ""),
                            parameter_id=str(pdata.get("parameter_id", ""))
                            if pdata.get("parameter_id")
                            else "",
                            parameter_name=pdata.get("parameter_name", ""),
                        )

            # Parse department mapping from JSONB (replicate v2 logic)
            dept_mapping_data = first_row.get("department_mapping")
            if isinstance(dept_mapping_data, str):
                dept_mapping_data = json.loads(dept_mapping_data)
            if dept_mapping_data and isinstance(dept_mapping_data, dict):
                for did, ddata in dept_mapping_data.items():
                    if isinstance(ddata, dict):
                        # Parse optional ID arrays (replicate v2 logic)
                        parameter_ids = ddata.get("parameter_ids")
                        field_ids = ddata.get("field_ids")

                        def to_str_list(value: Any) -> list[str] | None:  # noqa: ANN401
                            if value is None:
                                return None
                            if isinstance(value, list):
                                return [str(v) for v in value if v]
                            return None

                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                            parameter_ids=to_str_list(parameter_ids),
                            field_ids=to_str_list(field_ids),
                        )

            # Parse parameter mapping from JSONB (replicate v2 logic)
            param_mapping_raw = first_row.get("parameter_mapping")
            if isinstance(param_mapping_raw, str):
                param_mapping_raw = json.loads(param_mapping_raw)
            if param_mapping_raw and isinstance(param_mapping_raw, dict):
                for pid, pdata in param_mapping_raw.items():
                    if isinstance(pdata, dict):
                        parameter_mapping[pid] = ParameterMappingItem(
                            name=pdata.get("name", ""),
                            description=pdata.get("description", ""),
                            numerical=pdata.get("numerical", False),
                            document_parameter=pdata.get("document_parameter", False),
                            persona_parameter=pdata.get("persona_parameter", False),
                            scenario_parameter=pdata.get("scenario_parameter", False),
                            video_parameter=pdata.get("video_parameter", False),
                        )

        for row in rows:
            scenario_ids = [str(sid) for sid in (row["scenario_ids"] or [])]
            field_ids = [str(pid) for pid in (row["field_ids"] or [])]
            valid_field_ids = [str(pid) for pid in (row.get("valid_field_ids") or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            # Handle extension (replicate v2 logic)
            extension = row.get("extension") or ""

            documents.append(
                DocumentItem(
                    document_id=str(row["document_id"]),
                    name=row["name"],
                    updated_at=row["updated_at"].isoformat()
                    if row["updated_at"]
                    else "",
                    upload_id=row.get("upload_id"),
                    active=row["active"],
                    extension=extension,
                    department_ids=dept_ids,
                    scenario_ids=scenario_ids,
                    field_ids=field_ids,
                    valid_field_ids=valid_field_ids,
                    active_scenario_count=row["active_scenario_count"],
                    total_scenario_links=row["total_scenario_links"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                )
            )

        # Build facet options
        scenario_options = disambiguate_scenarios(scenario_mapping)
        department_options = [
            {"value": did, "label": d.name or did}
            for (did, d) in department_mapping.items()
        ]

        # Extract valid_department_ids from department_mapping keys
        valid_department_ids = list(department_mapping.keys())

        # Document type options for edit dialog (hardcoded list)
        document_type_options = [
            "homework",
            "project",
            "quiz",
            "midterm",
            "lab",
            "lecture",
            "syllabus",
        ]

        response_data = DocumentsListResponse(
            documents=documents,
            scenario_mapping=scenario_mapping,
            field_mapping=field_mapping,
            department_mapping=department_mapping,
            parameter_mapping=parameter_mapping,
            scenario_options=scenario_options,
            department_options=department_options,
            valid_department_ids=valid_department_ids,
            document_type_options=document_type_options,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_documents_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
