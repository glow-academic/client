"""Document detail endpoint - v3 API."""

import json
import os
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import UPLOAD_FOLDER, get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import (AgentMapping, AgentMappingItem,
                              DepartmentMappingItem, ParameterItemMappingItem)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


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


class TemplateInfo(BaseModel):
    """Template version information."""

    template_args: dict[str, Any]
    active: bool
    created_at: str
    updated_at: str


class DocumentDetailRequest(BaseModel):
    """Request to get document details."""

    documentId: str
    profileId: str


class DocumentDetailResponse(BaseModel):
    """Detailed document response."""

    document_id: str
    name: str
    description: str
    active: bool
    type: str
    upload_id: str | None
    updated_at: str
    extension: str | None
    scenario_ids: list[str]
    can_edit: bool
    can_delete: bool
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
    template_id: str | None
    template_schema: dict[str, Any] | None
    template_args: dict[str, Any] | None
    template_upload_id: str | None
    template_html: str | None
    template_mapping: dict[str, TemplateInfo]


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
        
        # Parse parameter_item_ids (fields) from document_fields
        parameter_item_ids: list[str] = []
        if row.get("parameter_item_ids"):
            parameter_item_ids = [str(pid) for pid in row["parameter_item_ids"]]

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
        template_id = row.get("template_id")
        template_upload_id = row.get("template_upload_id")
        
        # Parse template_mapping (all template versions)
        template_mapping: dict[str, TemplateInfo] = {}
        template_mapping_data = parse_jsonb(row.get("template_mapping"))
        if isinstance(template_mapping_data, dict):
            for tid, tdata in template_mapping_data.items():
                if isinstance(tdata, dict):
                    template_args_data = tdata.get("template_args")
                    if isinstance(template_args_data, str):
                        template_args_data = json.loads(template_args_data)
                    elif not isinstance(template_args_data, dict):
                        template_args_data = {}
                    template_mapping[tid] = TemplateInfo(
                        template_args=template_args_data,
                        active=tdata.get("active", False),
                        created_at=tdata.get("created_at", ""),
                        updated_at=tdata.get("updated_at", ""),
                    )
        
        # Parse template_args JSONB from active template (this contains the schema, not the args values)
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
                # Try to get from template_file_path first, then fallback to regular upload
                template_file_path = row.get("template_file_path")
                if template_file_path:
                    full_path = os.path.join(UPLOAD_FOLDER, template_file_path)
                    if os.path.exists(full_path):
                        with open(full_path, encoding="utf-8") as f:
                            template_html = f.read()
                else:
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

        # Parse scenario_ids
        scenario_ids: list[str] = []
        if row.get("scenario_ids"):
            scenario_ids = [str(sid) for sid in row["scenario_ids"]]

        # Get updated_at
        updated_at = row.get("updated_at")
        if updated_at:
            if isinstance(updated_at, str):
                updated_at_str = updated_at
            else:
                updated_at_str = updated_at.isoformat() if hasattr(updated_at, "isoformat") else str(updated_at)
        else:
            updated_at_str = ""

        # Get extension
        extension = row.get("extension")

        # Get can_edit and can_delete
        can_edit = row.get("can_edit", False)
        can_delete = row.get("can_delete", False)

        # Get document_id
        document_id = str(row.get("document_id", request_body.documentId))

        # Type field was removed from documents table - derive from extension or use empty string
        doc_type = extension if extension else ""

        response_data = DocumentDetailResponse(
            document_id=document_id,
            name=row.get("name", ""),
            description=row.get("description", ""),
            active=row.get("active", False),
            type=doc_type,
            upload_id=row.get("upload_id"),
            updated_at=updated_at_str,
            extension=extension,
            scenario_ids=scenario_ids,
            can_edit=can_edit,
            can_delete=can_delete,
            document_type_options=document_type_options,
            department_ids=dept_ids,
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            parameter_item_ids=parameter_item_ids,
            valid_parameter_item_ids=valid_parameter_item_ids,
            parameter_item_mapping=parameter_item_mapping,
            classify_agent_id=row.get("classify_agent_id", ""),
            document_agent_id=row.get("document_agent_id", ""),
            agent_mapping=agent_mapping,
            valid_agent_ids=valid_agent_ids,
            template=template,
            template_id=template_id,
            template_schema=template_schema,
            template_args=template_args,
            template_upload_id=template_upload_id,
            template_html=template_html,
            template_mapping=template_mapping,
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
