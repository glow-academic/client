"""Document list endpoint - v3 API."""

import json
from collections import Counter
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import (
    DepartmentMappingItem,
    ParameterItemMappingItem,
    ParameterMappingItem,
    ScenarioMappingItem,
)
from app.utils.sql_helper import load_sql


class DocumentsListRequest(BaseModel):
    """Request for documents list."""

    profileId: str


class DocumentItem(BaseModel):
    """Document item for list view."""

    document_id: str
    name: str
    type: str
    updated_at: str
    mime_type: str | None = None
    active: bool
    file_path: str | None = None
    extension: str | None = None
    department_ids: list[str] | None = None
    scenario_ids: list[str]
    parameter_item_ids: list[str]
    active_scenario_count: int
    total_scenario_links: int
    can_edit: bool
    can_delete: bool


class DocumentsListResponse(BaseModel):
    """Response for documents list."""

    documents: list[DocumentItem]
    scenario_mapping: dict[str, ScenarioMappingItem]
    parameter_item_mapping: dict[str, ParameterItemMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]
    parameter_mapping: dict[str, ParameterMappingItem]
    # UI-ready facet options (precomputed on server)
    type_options: list[dict[str, str]]  # Array of {value, label}
    scenario_options: list[dict[str, str]]  # Array of {value, label}
    department_options: list[dict[str, str]]  # Array of {value, label}


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


@router.post("/list", response_model=DocumentsListResponse)
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
        sql_query = load_sql("sql/v3/documents/list_documents.sql")
        sql_params = (filters.profileId,)
        rows = await conn.fetch(sql_query, filters.profileId)

        documents: list[DocumentItem] = []
        scenario_mapping: dict[str, ScenarioMappingItem] = {}
        parameter_item_mapping: dict[str, ParameterItemMappingItem] = {}
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

            # Parse parameter_item mapping from JSONB (replicate v2 logic)
            param_item_mapping_data = first_row.get("parameter_item_mapping")
            if isinstance(param_item_mapping_data, str):
                param_item_mapping_data = json.loads(param_item_mapping_data)
            if param_item_mapping_data and isinstance(param_item_mapping_data, dict):
                for pid, pdata in param_item_mapping_data.items():
                    if isinstance(pdata, dict):
                        parameter_item_mapping[pid] = ParameterItemMappingItem(
                            name=pdata.get("name", ""),
                            description=pdata.get("description", ""),
                            parameter_id=str(pdata.get("parameter_id", ""))
                            if pdata.get("parameter_id")
                            else "",
                            parameter_name=pdata.get("parameter_name", ""),
                            value=pdata.get("value", ""),
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
                        parameter_item_ids = ddata.get("parameter_item_ids")

                        def to_str_list(value: Any) -> list[str] | None:
                            if value is None:
                                return None
                            if isinstance(value, list):
                                return [str(v) for v in value if v]
                            return None

                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                            parameter_ids=to_str_list(parameter_ids),
                            parameter_item_ids=to_str_list(parameter_item_ids),
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
                        )

        for row in rows:
            scenario_ids = [str(sid) for sid in (row["scenario_ids"] or [])]
            parameter_item_ids = [str(pid) for pid in (row["parameter_item_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            # Handle extension (replicate v2 logic)
            extension = row.get("extension") or ""

            documents.append(
                DocumentItem(
                    document_id=str(row["document_id"]),
                    name=row["name"],
                    type=row["type"],
                    updated_at=row["updated_at"].isoformat()
                    if row["updated_at"]
                    else "",
                    mime_type=row.get("mime_type"),
                    active=row["active"],
                    file_path=row.get("file_path"),
                    extension=extension,
                    department_ids=dept_ids,
                    scenario_ids=scenario_ids,
                    parameter_item_ids=parameter_item_ids,
                    active_scenario_count=row["active_scenario_count"],
                    total_scenario_links=row["total_scenario_links"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                )
            )

        # Build facet options
        type_options = [
            {"value": "homework", "label": "📚 Homework"},
            {"value": "project", "label": "🎯 Project"},
            {"value": "quiz", "label": "❓ Quiz"},
            {"value": "midterm", "label": "📝 Midterm"},
            {"value": "lab", "label": "🧪 Lab"},
            {"value": "lecture", "label": "📖 Lecture"},
            {"value": "syllabus", "label": "📋 Syllabus"},
        ]
        scenario_options = disambiguate_scenarios(scenario_mapping)
        department_options = [
            {"value": did, "label": d.name or did}
            for (did, d) in department_mapping.items()
        ]

        response_data = DocumentsListResponse(
            documents=documents,
            scenario_mapping=scenario_mapping,
            parameter_item_mapping=parameter_item_mapping,
            department_mapping=department_mapping,
            parameter_mapping=parameter_mapping,
            type_options=type_options,
            scenario_options=scenario_options,
            department_options=department_options,
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
