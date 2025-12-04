"""Document detail endpoint - v3 API."""

import json
import os
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import UPLOAD_FOLDER, get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import AgentMapping, AgentMappingItem, DepartmentMappingItem, ParameterItemMappingItem
from app.utils.sql_helper import load_sql


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            parsed: Any = json.loads(data)
            if isinstance(parsed, dict):
                return parsed
            if isinstance(parsed, list):
                return parsed
            return {}
        except json.JSONDecodeError:
            return {}
    if isinstance(data, dict):
        return data
    if isinstance(data, list):
        return data
    return None


class DocumentDetailRequest(BaseModel):
    """Request to get document details."""

    documentId: str
    profileId: str


class DocumentDetailResponse(BaseModel):
    """Detailed document response."""

    name: str
    active: bool
    type: str
    upload_id: str | None
    document_type_options: list[str]
    department_ids: list[str] | None
    valid_department_ids: list[str]
    department_mapping: dict[str, DepartmentMappingItem]
    parameter_item_ids: list[str]
    valid_parameter_item_ids: list[str]
    parameter_item_mapping: dict[str, ParameterItemMappingItem]
    classify_agent_id: str
    document_agent_id: str
    agent_mapping: AgentMapping
    valid_agent_ids: list[str]
    template: bool
    template_schema: dict[str, Any] | None
    template_args: dict[str, Any] | None
    template_upload_id: str | None
    template_html: str | None


router = APIRouter()


@router.post("/detail", response_model=DocumentDetailResponse)
async def get_document_detail(
    request_body: DocumentDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocumentDetailResponse:
    """Get document detail information."""
    tags = ["documents"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return DocumentDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/documents/get_document_detail_complete.sql")
        sql_params = (
            uuid.UUID(request_body.documentId),
            uuid.UUID(request_body.profileId),
        )
        row = await conn.fetchrow(
            sql_query,
            uuid.UUID(request_body.documentId),
            uuid.UUID(request_body.profileId),
        )

        if not row:
            raise HTTPException(status_code=404, detail="Document not found")

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
                            parameter_ids=param_ids
                            if isinstance(param_ids, list)
                            else None,
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
                            value="",  # Not included in detail query
                        )

        # Convert arrays
        valid_department_ids = [
            str(did) for did in (row.get("valid_department_ids") or [])
        ]
        valid_parameter_item_ids = [
            str(pid) for pid in (row.get("valid_parameter_item_ids") or [])
        ]
        dept_ids = None
        if row.get("department_ids"):
            dept_ids = [str(d) for d in row["department_ids"]]

        # Parse agent mapping
        agent_mapping: AgentMapping = {}
        if row.get("agent_mapping"):
            agent_data = row["agent_mapping"]
            if isinstance(agent_data, str):
                agent_data = json.loads(agent_data)
            if isinstance(agent_data, dict):
                for aid, adata in agent_data.items():
                    if isinstance(adata, dict):
                        agent_mapping[aid] = AgentMappingItem(
                            name=adata.get("name", ""),
                            description=adata.get("description", ""),
                            roles=adata.get("roles", []),
                        )

        valid_agent_ids = [
            str(aid) for aid in (row.get("valid_agent_ids") or [])
        ]

        # Document type options (from v2 - typically ["homework", "exam", "lab", "project"])
        document_type_options = ["homework", "exam", "lab", "project"]

        # Parse template fields
        template = row.get("template", False)
        template_upload_id = row.get("template_upload_id")
        
        # Parse template_args JSONB (this contains the schema, not the args values)
        template_args_raw = row.get("template_args")
        template_schema: dict[str, Any] | None = None
        template_args: dict[str, Any] | None = None
        template_html: str | None = None
        
        if template_args_raw:
            if isinstance(template_args_raw, str):
                template_schema = json.loads(template_args_raw)
            elif isinstance(template_args_raw, dict):
                template_schema = template_args_raw
            # For now, template_args (values) is empty - will be populated when user fills form
            template_args = {}

        # Read template HTML if template upload exists
        if template and template_upload_id:
            try:
                sql_get_upload = load_sql("sql/v3/uploads/get_upload_file_info.sql")
                upload_row = await conn.fetchrow(sql_get_upload, template_upload_id)
                if upload_row and upload_row.get("file_path"):
                    file_path = upload_row["file_path"]
                    full_path = os.path.join(UPLOAD_FOLDER, file_path)
                    if os.path.exists(full_path):
                        with open(full_path, encoding="utf-8") as f:
                            template_html = f.read()
            except Exception:
                # If reading fails, template_html will remain None
                pass

        response_data = DocumentDetailResponse(
            name=row.get("name", ""),
            active=row.get("active", False),
            type=row.get("type", ""),
            upload_id=row.get("upload_id"),
            document_type_options=document_type_options,
            department_ids=dept_ids,
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            parameter_item_ids=[],  # Not included in detail query
            valid_parameter_item_ids=valid_parameter_item_ids,
            parameter_item_mapping=parameter_item_mapping,
            classify_agent_id=row.get("classify_agent_id", ""),
            document_agent_id=row.get("document_agent_id", ""),
            agent_mapping=agent_mapping,
            valid_agent_ids=valid_agent_ids,
            template=template,
            template_schema=template_schema,
            template_args=template_args,
            template_upload_id=template_upload_id,
            template_html=template_html,
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
            operation="get_document_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
