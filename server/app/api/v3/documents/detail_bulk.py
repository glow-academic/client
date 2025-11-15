"""Document detail bulk endpoint - v3 API."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import cache_key, get_cached, set_cached
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
    request_body: DocumentDetailBulkRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocumentDetailBulkResponse:
    """Get bulk document detail information."""
    tags = ["documents"]  # From router tags
    
    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)
    
    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return DocumentDetailBulkResponse.model_validate(cached["data"])
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        sql_query = load_sql("sql/v3/documents/get_document_detail_bulk_complete.sql")
        sql_params = (
            [uuid.UUID(did) for did in request_body.documentIds],
            uuid.UUID(request_body.profileId),
        )
        row = await conn.fetchrow(
            sql_query,
            [uuid.UUID(did) for did in request_body.documentIds],
            uuid.UUID(request_body.profileId),
        )

        if not row:
            raise HTTPException(status_code=404, detail="No documents found")

        # Parse types array and determine common type
        types = row.get("types") or []
        # If types is NULL or empty, no documents were found
        if not types or (isinstance(types, list) and len(types) == 0):
            raise HTTPException(status_code=404, detail="No documents found")
        
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

        response_data = DocumentDetailBulkResponse(
            document_type_options=document_type_options,
            type=common_type,
            department_ids=department_ids,
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            parameter_item_ids=[],  # Not included in bulk query
            valid_parameter_item_ids=valid_parameter_item_ids,
            parameter_item_mapping=parameter_item_mapping,
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
            operation="get_document_detail_bulk",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

