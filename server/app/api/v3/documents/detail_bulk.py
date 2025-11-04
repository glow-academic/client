"""Document detail bulk endpoint - v3 API."""

import json
import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.schema import DepartmentMappingItem, ParameterItemMappingItem
from app.utils.sql_helper import load_sql


class DocumentDetailBulkRequest(BaseModel):
    """Request to get bulk document details."""

    documentIds: list[str]
    profileId: str


class DocumentDetailBulkResponse(BaseModel):
    """Bulk document detail response."""

    document_type_options: list[str]
    type: str | None
    department_ids: list[str]
    valid_department_ids: list[str]
    department_mapping: dict[str, DepartmentMappingItem]
    parameter_item_ids: list[str]
    valid_parameter_item_ids: list[str]
    parameter_item_mapping: dict[str, ParameterItemMappingItem]


router = APIRouter()


@router.post("/detail-bulk", response_model=DocumentDetailBulkResponse)
async def get_document_detail_bulk(
    request: DocumentDetailBulkRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocumentDetailBulkResponse:
    """Get bulk document detail information."""
    try:
        sql = load_sql("sql/v3/documents/get_document_detail_bulk_complete.sql")
        row = await conn.fetchrow(
            sql,
            [uuid.UUID(did) for did in request.documentIds],
            uuid.UUID(request.profileId),
        )

        if not row:
            raise HTTPException(status_code=404, detail="No documents found")

        # Parse types array and determine common type
        types = row.get("types") or []
        common_type = types[0] if len(types) == 1 else None

        # Parse department IDs from array
        department_ids = [str(did) for did in (row.get("department_ids") or [])]

        # Parse mappings
        department_mapping: dict[str, DepartmentMappingItem] = {}
        if row.get("department_mapping"):
            dept_data = row["department_mapping"]
            if isinstance(dept_data, str):
                dept_data = json.loads(dept_data)
            if isinstance(dept_data, dict):
                for did, ddata in dept_data.items():
                    if isinstance(ddata, dict):
                        param_ids = ddata.get("parameter_ids")
                        if isinstance(param_ids, str):
                            param_ids = json.loads(param_ids)
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                            parameter_ids=param_ids if isinstance(param_ids, list) else None,
                        )

        parameter_item_mapping: dict[str, ParameterItemMappingItem] = {}
        if row.get("parameter_item_mapping"):
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
                            value="",  # Not included in bulk query
                        )

        # Convert arrays
        valid_department_ids = [str(did) for did in (row.get("valid_department_ids") or [])]
        valid_parameter_item_ids = [str(pid) for pid in (row.get("valid_parameter_item_ids") or [])]

        # Document type options
        document_type_options = ["homework", "exam", "lab", "project"]

        return DocumentDetailBulkResponse(
            document_type_options=document_type_options,
            type=common_type,
            department_ids=department_ids,
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            parameter_item_ids=[],  # Not included in bulk query
            valid_parameter_item_ids=valid_parameter_item_ids,
            parameter_item_mapping=parameter_item_mapping,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

