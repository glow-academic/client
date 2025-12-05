"""Document template generation endpoint - v3 API following DHH principles.

Note: This route calls the document agent with two tools:
- generate_template_html: Generates Jinja2 template HTML
- generate_template_schema: Generates JSON schema for template variables

Both tools must be called for successful generation.
"""

import json
import os
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from agents import Runner, trace
from agents.items import TResponseInputItem
from app.main import UPLOAD_FOLDER, get_db
from app.utils.agents.build_document_agent import build_document_agent
from app.utils.agents.tools.create_document_tools import (
    create_document_tools, document_progress, document_results)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

logger = get_logger(__name__)


class GenerateTemplateRequest(BaseModel):
    """Request to generate document template."""

    departmentId: str
    profileId: str | None = None
    documentId: str | None = None  # Optional: if provided, save template immediately


class GenerateTemplateResponse(BaseModel):
    """Response from document template generation."""

    success: bool
    message: str
    template_html: str
    template_schema: dict[str, Any]
    upload_id: str
    template_mapping: dict[str, Any] | None = None  # Optional: only when documentId provided


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

        # Clear previous results
        document_results.clear()
        document_progress.clear()

        # Build document agent with tools (includes tool_use_behavior to ensure both tools are called)
        document_tools = create_document_tools()
        document_agent = build_document_agent(context, document_tools)

        # Construct input items for the agent
        # The agent will generate both template HTML and schema using its tools
        input_items: list[TResponseInputItem] = [
            {
                "role": "user",
                "content": "Generate a Jinja2 template HTML document and its corresponding JSON schema. "
                "You must call both generate_template_html and generate_template_schema tools. "
                "The template should be a complete HTML document with Jinja2 placeholders. "
                "The schema should describe all template variables including their types (string, number, boolean, array, object) and whether they are required.",
            }
        ]

        # Import Runner and trace for agent execution
        from agents import Runner, trace
        from app.utils.debug_info import DebugContext

        # Check rate limit
        final_profile_id = profile_id or uuid.UUID(context["profile_id"])
        if not final_profile_id:
            raise ValueError("Profile not found. Please contact support.")

        req_per_day = context["req_per_day"]
        runs_today_count = context["runs_today_count"]

        if req_per_day is not None and runs_today_count >= req_per_day:
            from datetime import timedelta
            from zoneinfo import ZoneInfo

            earliest_run_created_at = context["earliest_run_created_at"]
            if earliest_run_created_at:
                next_allowed_utc = earliest_run_created_at + timedelta(days=1)
                eastern_tz = ZoneInfo("America/New_York")
                next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
                error_message = (
                    f"Daily request limit of {req_per_day} reached. "
                    f"Next request allowed after {next_allowed_et.strftime('%I:%M %p %Z')} on "
                    f"{next_allowed_et.strftime('%B %d, %Y')}."
                )
            else:
                error_message = (
                    f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
                )
            raise ValueError(error_message)

        # Create model run
        sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
        model_run_row = await conn.fetchrow(
            sql_create_run,
            str(department_id),
            context["model_id"],
            context["agent_id"],
            "agent",
            str(final_profile_id),
            None,  # key_id
            str(context["agent_id"]),  # agent_id
        )
        model_run_id = uuid.UUID(model_run_row["run_id"])

        # Run document generation with tracing
        with trace(
            "Document Agent",
            trace_id=None,
            group_id=None,
        ):
            run_result = await Runner.run(
                document_agent.agent(),
                input_items,
                context=DebugContext(conn=conn, run_id=model_run_id),
            )

        # Update token counts
        usage = run_result.context_wrapper.usage
        sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
        await conn.execute(
            sql_update_tokens,
            str(model_run_id),
            usage.input_tokens,
            usage.output_tokens,
        )

        # Extract results from document_results (populated by tool calls)
        template_html = document_results.get("template_html", "")
        template_schema_str = document_results.get("template_schema", "{}")

        # Parse schema JSON
        try:
            template_schema = json.loads(template_schema_str)
        except (json.JSONDecodeError, TypeError):
            template_schema = {}

        # Verify both tools were called
        if not document_progress.get("template_html") or not document_progress.get(
            "template_schema"
        ):
            raise ValueError(
                "Document agent did not call both required tools. "
                "Expected: generate_template_html and generate_template_schema"
            )

        # Save template HTML to file and create upload record
        upload_uuid = uuid.uuid4()
        file_path = f"{upload_uuid}.html"
        full_path = os.path.join(UPLOAD_FOLDER, file_path)

        # Ensure uploads directory exists
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        # Write template HTML to file
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(template_html)

        # Create upload record
        sql_insert_upload = load_sql("sql/v3/uploads/insert_upload.sql")
        upload_id_result = await conn.fetchrow(
            sql_insert_upload,
            file_path,
            "text/html",
            len(template_html.encode("utf-8")),
        )
        upload_id = upload_id_result["id"]

        # If documentId is provided, save template immediately to document_template_uploads
        template_mapping: dict[str, Any] | None = None
        if request.documentId:
            try:
                document_id = uuid.UUID(request.documentId)
                # Prepare template schema as JSONB
                template_schema_jsonb = json.dumps(template_schema)
                
                # Insert template into document_template_uploads (marks previous as inactive)
                sql_insert_template = load_sql("sql/v3/documents/insert_document_template.sql")
                await conn.execute(
                    sql_insert_template,
                    str(document_id),
                    str(uuid.UUID(upload_id)),
                    template_schema_jsonb,
                    True,  # active = true
                )
                # Note: We do NOT automatically set template = true here
                # Users must explicitly enable template mode via the update form
                
                # Fetch updated template_mapping to return in response
                sql_get_template_mapping = """
                    SELECT 
                        COALESCE(
                            jsonb_object_agg(
                                dtu.upload_id::text,
                                jsonb_build_object(
                                    'template_args', dtu.args,
                                    'active', dtu.active,
                                    'created_at', dtu.created_at::text,
                                    'updated_at', dtu.updated_at::text
                                )
                            ),
                            '{}'::jsonb
                        ) as template_mapping
                    FROM document_template_uploads dtu
                    WHERE dtu.document_id = $1
                """
                mapping_row = await conn.fetchrow(sql_get_template_mapping, str(document_id))
                if mapping_row and mapping_row.get("template_mapping"):
                    mapping_data = mapping_row["template_mapping"]
                    # Parse JSONB string to dict if needed (asyncpg returns JSONB as dict or str)
                    if isinstance(mapping_data, str):
                        try:
                            template_mapping = json.loads(mapping_data)
                        except json.JSONDecodeError:
                            logger.warning(f"Failed to parse template_mapping JSON: {mapping_data}")
                            template_mapping = {}
                    elif isinstance(mapping_data, dict):
                        template_mapping = mapping_data
                    else:
                        template_mapping = {}
                
                # Invalidate documents cache to ensure detail page shows updated template
                await invalidate_tags(["documents"])
                logger.info(f"Template saved to document {document_id} with upload_id {upload_id}")
            except ValueError as e:
                # If documentId is invalid UUID, log but don't fail the request
                # Template is still generated, just not saved
                logger.warning(f"Invalid documentId provided: {request.documentId}, template not saved: {e}")
            except Exception as e:
                # If saving fails, log but don't fail the request
                # Template is still generated and can be used
                logger.error(f"Failed to save template to document {request.documentId}: {e}", exc_info=True)

        return GenerateTemplateResponse(
            success=True,
            message="Document template generated successfully",
            template_html=template_html,
            template_schema=template_schema,
            upload_id=upload_id,
            template_mapping=template_mapping,
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

