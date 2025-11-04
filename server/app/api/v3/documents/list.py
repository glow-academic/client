"""Document list endpoint - v3 API."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.schema import DepartmentMappingItem, ParameterItemMappingItem, ParameterMappingItem
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
    scenario_mapping: dict[str, dict[str, Any]]  # Complex nested structure
    parameter_item_mapping: dict[str, ParameterItemMappingItem]
    department_mapping: dict[str, DepartmentMappingItem]
    parameter_mapping: dict[str, ParameterMappingItem]


router = APIRouter()


@router.post("/list")
async def get_documents_list(
    request: DocumentsListRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocumentsListResponse:
    """Get documents list with tags and scenarios."""
    try:
        sql = load_sql("sql/v3/documents/list_documents.sql")
        rows = await conn.fetch(sql, request.profileId)

        documents: list[DocumentItem] = []
        scenario_mapping: dict[str, Any] = {}  # Complex nested structure
        parameter_item_mapping: dict[str, ParameterItemMappingItem] = {}
        department_mapping: dict[str, DepartmentMappingItem] = {}
        parameter_mapping: dict[str, ParameterMappingItem] = {}

        for row in rows:
            scenario_ids = [str(sid) for sid in (row["scenario_ids"] or [])]
            parameter_item_ids = [str(pid) for pid in (row["parameter_item_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            documents.append(
                DocumentItem(
                    document_id=row["document_id"],
                    name=row["name"],
                    type=row["type"],
                    updated_at=row["updated_at"].isoformat(),
                    mime_type=row.get("mime_type"),
                    active=row["active"],
                    file_path=row.get("file_path"),
                    extension=row.get("extension"),
                    department_ids=dept_ids,
                    scenario_ids=scenario_ids,
                    parameter_item_ids=parameter_item_ids,
                    active_scenario_count=row["active_scenario_count"],
                    total_scenario_links=row["total_scenario_links"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                )
            )

            # Parse mappings from first row
            if not scenario_mapping and row["scenario_mapping"]:
                scenario_data = row["scenario_mapping"]
                if isinstance(scenario_data, str):
                    scenario_data = json.loads(scenario_data)
                if isinstance(scenario_data, dict):
                    scenario_mapping = scenario_data

            if not parameter_item_mapping and row["parameter_item_mapping"]:
                param_item_data = row["parameter_item_mapping"]
                if isinstance(param_item_data, str):
                    param_item_data = json.loads(param_item_data)
                if isinstance(param_item_data, dict):
                    for pid, pdata in param_item_data.items():
                        if isinstance(pdata, dict):
                            parameter_item_mapping[pid] = ParameterItemMappingItem(
                                name=pdata.get("name", ""),
                                description=pdata.get("description", ""),
                                parameter_id=pdata.get("parameter_id", ""),
                                parameter_name=pdata.get("parameter_name", ""),
                                value=pdata.get("value", ""),
                            )

            if not department_mapping and row["department_mapping"]:
                dept_data = row["department_mapping"]
                if isinstance(dept_data, str):
                    dept_data = json.loads(dept_data)
                if isinstance(dept_data, dict):
                    for did, ddata in dept_data.items():
                        if isinstance(ddata, dict):
                            department_mapping[did] = DepartmentMappingItem(
                                name=ddata.get("name", ""),
                                description=ddata.get("description", ""),
                            )

            if not parameter_mapping and row["parameter_mapping"]:
                param_data = row["parameter_mapping"]
                if isinstance(param_data, str):
                    param_data = json.loads(param_data)
                if isinstance(param_data, dict):
                    for pid, pdata in param_data.items():
                        if isinstance(pdata, dict):
                            from app.utils.schema import ParameterMappingItem
                            parameter_mapping[pid] = ParameterMappingItem(
                                name=pdata.get("name", ""),
                                description=pdata.get("description", ""),
                                numerical=pdata.get("numerical", False),
                                document_parameter=pdata.get("document_parameter", False),
                            )

        return DocumentsListResponse(
            documents=documents,
            scenario_mapping=scenario_mapping,
            parameter_item_mapping=parameter_item_mapping,
            department_mapping=department_mapping,
            parameter_mapping=parameter_mapping,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

