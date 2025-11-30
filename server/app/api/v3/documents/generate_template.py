"""Document template generation endpoint - v3 API following DHH principles.

Note: This route uses the run_document_agent utility which currently returns
hardcoded template HTML and schema JSON. This can be replaced with actual AI
generation later.
"""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.agents.run_document_agent import run_document_agent
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel


class GenerateTemplateRequest(BaseModel):
    """Request to generate document template."""

    departmentId: str
    profileId: str | None = None


class GenerateTemplateResponse(BaseModel):
    """Response from document template generation."""

    success: bool
    message: str
    template_html: str
    template_schema: dict[str, Any]


router = APIRouter()


@router.post("/generate-template", response_model=GenerateTemplateResponse)
async def generate_template(
    request: GenerateTemplateRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GenerateTemplateResponse:
    """Generate document template HTML and schema JSON."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Convert string IDs to UUIDs
        department_id = uuid.UUID(request.departmentId)
        profile_id = uuid.UUID(request.profileId) if request.profileId else None

        # Get all context data in a single optimized query using SQL file
        sql_query = load_sql("sql/v3/agents/get_document_run_context.sql")
        sql_params = (
            str(department_id),
            str(profile_id) if profile_id else None,
        )
        context_row = await conn.fetchrow(sql_query, *sql_params)

        if not context_row:
            raise HTTPException(
                status_code=404,
                detail=f"No document agent configured for department {request.departmentId}",
            )

        # Build context dict
        context = {
            "agent_id": context_row["agent_id"],
            "agent_name": context_row["agent_name"],
            "system_prompt": context_row["system_prompt"],
            "temperature": float(context_row["temperature"])
            if context_row["temperature"] is not None
            else 0.0,
            "reasoning": context_row["reasoning"],
            "model_id": context_row["model_id"],
            "model_name": context_row["model_name"],
            "provider": context_row["provider"],
            "base_url": context_row["base_url"],
            "api_key": context_row["api_key"],
            "profile_id": context_row["profile_id"],
            "req_per_day": context_row["req_per_day"],
            "runs_today_count": context_row["runs_today_count"],
            "earliest_run_created_at": context_row["earliest_run_created_at"],
        }

        # Run document agent (currently returns hardcoded values)
        result = await run_document_agent(
            context=context,
            conn=conn,
            department_id=department_id,
            profile_id=profile_id,
        )

        return GenerateTemplateResponse(
            success=True,
            message="Document template generated successfully",
            template_html=result["template_html"],
            template_schema=result["template_schema"],
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="generate_template",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

