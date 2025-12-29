"""Handler for document_generate WebSocket event."""

import json
import uuid
from typing import Any

from agents import (
    FunctionToolResult,
    RunContextWrapper,
    Runner,
    Tool,
    ToolsToFinalOutputResult,
    function_tool,
    trace,
)
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, Field, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.infra.v3.debug.debug_info import DebugContext
from app.infra.v3.documents.format_document_template_context import (
    format_document_template_context,
)
from app.main import get_internal_sio, get_pool, sio

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class DocumentTemplateGenerationProgressPayload(BaseModel):
    """Response indicating progress in document template generation."""

    type: str  # "start", "complete"
    message: str | None = None
    trace_id: str | None = None


class DocumentTemplateGenerationCompletePayload(BaseModel):
    """Response indicating document template generation completed successfully."""

    success: bool
    message: str
    template_html: str
    template_schema: dict[str, Any]  # Dynamic JSON schema for template variables
    upload_id: str
    template_mapping: dict[str, Any] | None = (
        None  # Dynamic mapping of template uploads
    )
    trace_id: str | None = None


class DocumentTemplateGenerationErrorPayload(BaseModel):
    """Response indicating an error occurred in document template generation."""

    success: bool
    message: str
    trace_id: str | None = None


# Pydantic model for client-to-server event
class GenerateDocumentTemplatePayload(BaseModel):
    """Request to generate a document template."""

    departmentId: str
    profileId: str | None = None
    documentId: str | None = None
    documentName: str | None = None
    documentDescription: str | None = None
    fieldIds: list[str] | None = None


# Emit helper functions
async def document_template_generation_progress(
    payload: DocumentTemplateGenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "documents_generation_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def document_template_generation_complete(
    payload: DocumentTemplateGenerationCompletePayload, room: str
) -> None:
    await sio.emit("documents_generation_complete", payload.model_dump(), room=room)


async def document_template_generation_error(
    payload: DocumentTemplateGenerationErrorPayload, room: str
) -> None:
    await sio.emit("documents_generation_error", payload.model_dump(), room=room)


async def _document_generate_impl(
    sid: str, data: GenerateDocumentTemplatePayload
) -> None:
    """Handle document template generation requests via WebSocket."""
    trace_id = (
        None  # Document agent doesn't use trace_id, but we can generate one if needed
    )

    try:
        logger.info(f"Received document_generate request from {sid} with data: {data}")

        # Convert string IDs to UUIDs
        department_id = uuid.UUID(data.departmentId)
        profile_id = uuid.UUID(data.profileId) if data.profileId else None

        # Get connection pool
        pool = get_pool()
        if not pool:
            await document_template_generation_error(
                DocumentTemplateGenerationErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                    trace_id=trace_id,
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Emit start event
            await document_template_generation_progress(
                DocumentTemplateGenerationProgressPayload(
                    type="start",
                    message="Starting document template generation",
                    trace_id=trace_id,
                ),
                room=sid,
            )

            # Get all context data AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            sql_query = load_sql(
                "app/sql/v3/documents/get_document_run_context_and_create_run.sql"
            )
            try:
                context_row = await conn.fetchrow(
                    sql_query,
                    str(department_id),
                    str(profile_id) if profile_id else None,
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                # Check if it's a rate limit error from SQL (PostgreSQL exception)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    # Extract the user-friendly message (everything after "RATE_LIMIT_EXCEEDED: ")
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await document_template_generation_error(
                        DocumentTemplateGenerationErrorPayload(
                            success=False,
                            message=user_msg,
                            trace_id=trace_id,
                        ),
                        room=sid,
                    )
                    return
                # Log other errors
                logger.error(
                    f"Failed to get context and create run for {sid}: {str(e)}",
                    exc_info=True,
                )
                await document_template_generation_error(
                    DocumentTemplateGenerationErrorPayload(
                        success=False,
                        message=f"Failed to initialize document generation: {str(e)}",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            if not context_row:
                await document_template_generation_error(
                    DocumentTemplateGenerationErrorPayload(
                        success=False,
                        message=f"No document agent configured for department {data.departmentId}",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

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
            }

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(context_row["run_id"])

            # Module-level storage for document generation results
            document_results: dict[str, Any] = {}
            document_progress: dict[str, bool] = {}

            # Load agent tools from database
            agent_id_uuid = uuid.UUID(context["agent_id"])
            sql_get_agent_tools = load_sql("app/sql/v3/agents/get_agent_tools.sql")
            rows = await conn.fetch(sql_get_agent_tools, str(agent_id_uuid))
            agent_tools_config = [dict(row) for row in rows]
            tool_config_map_doc: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            # Build document tools inline
            document_tools: list[Tool] = []

            # Generate template HTML tool
            html_config = tool_config_map_doc.get("generate_template_html")
            if html_config:
                html_desc = html_config.get("argument_descriptions", {}).get(
                    "template_html",
                    "Jinja template HTML content with placeholders like {{ variable_name }}",
                )
            else:
                html_desc = "Jinja template HTML content with placeholders like {{ variable_name }}"

            async def generate_template_html(
                template_html: str = Field(description=html_desc),
            ) -> str:
                """Generate the Jinja template HTML for the document."""
                document_results["template_html"] = template_html
                document_progress["template_html"] = True
                logger.info(f"✓ Generated template HTML ({len(template_html)} chars)")
                return "Generated template HTML successfully"

            document_tools.append(function_tool(generate_template_html))
            logger.info("Created template HTML generation tool")

            # Generate template schema tool
            schema_config = tool_config_map_doc.get("generate_template_schema")
            if schema_config:
                schema_desc = schema_config.get("argument_descriptions", {}).get(
                    "schema_json",
                    "JSON string in TemplateSchema format describing the template context fields and types. Must have structure: { 'name': string, 'fields': [{ 'name': string, 'type': 'string'|'number'|'boolean'|'array'|'object', 'required': bool (optional), 'item': {...} (optional for arrays), 'fields': [...] (optional for objects) }] }",
                )
            else:
                schema_desc = "JSON string in TemplateSchema format describing the template context fields and types. Must have structure: { 'name': string, 'fields': [{ 'name': string, 'type': 'string'|'number'|'boolean'|'array'|'object', 'required': bool (optional), 'item': {...} (optional for arrays), 'fields': [...] (optional for objects) }] }"

            async def generate_template_schema(
                schema_json: str = Field(description=schema_desc),
            ) -> str:
                """Generate the TemplateSchema JSON for template context."""
                document_results["template_schema"] = schema_json
                document_progress["template_schema"] = True
                logger.info(f"✓ Generated template schema ({len(schema_json)} chars)")
                return "Generated template schema successfully"

            document_tools.append(function_tool(generate_template_schema))
            logger.info("Created template schema generation tool")

            # Create tool use behavior to wait for both tools to be called
            def tool_use_behavior(
                tool_context: RunContextWrapper[Any],
                tool_results: list[FunctionToolResult],
            ) -> ToolsToFinalOutputResult:
                template_html_complete = document_progress.get("template_html", False)
                template_schema_complete = document_progress.get(
                    "template_schema", False
                )
                both_complete = template_html_complete and template_schema_complete
                logger.info(
                    f"Tool use behavior check: template_html={template_html_complete}, "
                    f"template_schema={template_schema_complete}, both_complete={both_complete}"
                )
                return ToolsToFinalOutputResult(is_final_output=both_complete)

            # Build document agent inline
            from app.infra.v3.agents.generic_agent import GenericAgent

            document_agent = GenericAgent(
                agent_name=context["agent_name"],
                system_prompt=context["system_prompt"],
                temperature=context["temperature"],
                model_name=context["model_name"],
                provider=context["provider"],
                base_url=context["base_url"],
                api_key=context["api_key"],
                reasoning=context["reasoning"],
                tools=document_tools,
                parallel_tool_calls=False,
                tool_use_behavior=tool_use_behavior,
            )

            # Fetch fields information if fieldIds provided
            fields_data: list[dict[str, Any]] | None = None
            if data.fieldIds and len(data.fieldIds) > 0:
                field_ids_uuid = [uuid.UUID(fid) for fid in data.fieldIds]
                field_ids_str = [str(fid) for fid in field_ids_uuid]
                sql_query_fields = load_sql(
                    "app/sql/v3/documents/get_document_template_context.sql"
                )
                fields_row = await conn.fetchrow(sql_query_fields, field_ids_str)
                if fields_row and fields_row.get("fields"):
                    fields_json = fields_row["fields"]
                    if isinstance(fields_json, str):
                        fields_data = json.loads(fields_json)
                    elif isinstance(fields_json, list):
                        fields_data = fields_json
                    else:
                        fields_data = []

            # Get department name
            department_name: str | None = None
            if department_id:
                sql_get_dept = load_sql(
                    "app/sql/v3/departments/get_department_title.sql"
                )
                dept_row = await conn.fetchrow(sql_get_dept, department_id)
                if dept_row:
                    department_name = dept_row.get("title")

            # Format context for agent input
            context_items = format_document_template_context(
                document_name=data.documentName,
                document_description=data.documentDescription,
                department_name=department_name,
                fields=fields_data,
            )

            # Construct input items for the agent
            input_items: list[TResponseInputItem] = context_items.copy()

            # Add the main instruction
            if context_items:
                input_items.append(
                    {
                        "role": "user",
                        "content": (
                            "Based on the document context provided above, generate a Jinja2 template HTML document and its corresponding JSON schema. "
                            "You must call both generate_template_html and generate_template_schema tools. "
                            "The template should be a complete HTML document with Jinja2 placeholders that fits the document's purpose and fields. "
                            "The schema should describe all template variables including their types (string, number, boolean, array, object) and whether they are required."
                        ),
                    }
                )
            else:
                input_items.append(
                    {
                        "role": "user",
                        "content": (
                            "Generate a Jinja2 template HTML document and its corresponding JSON schema. "
                            "You must call both generate_template_html and generate_template_schema tools. "
                            "The template should be a complete HTML document with Jinja2 placeholders. "
                            "The schema should describe all template variables including their types (string, number, boolean, array, object) and whether they are required."
                        ),
                    }
                )

            # Rate limit validation and run creation are now handled in SQL
            # (get_document_run_context_and_create_run.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully

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

            # Emit async pricing event (non-blocking)
            # This handles token updates and message logging in background
            usage = run_result.context_wrapper.usage
            assistant_output = getattr(run_result, "final_output", None) or ""
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "document",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": context["system_prompt"],
                    "inputItems": input_items,  # Serialized TResponseInputItem list
                    "assistantOutput": assistant_output,
                    "departmentId": str(department_id),
                },
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
                await document_template_generation_error(
                    DocumentTemplateGenerationErrorPayload(
                        success=False,
                        message=(
                            "Document agent did not call both required tools. "
                            "Expected: generate_template_html and generate_template_schema"
                        ),
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Emit internal event to create template (separate event for database operations)
            # Completion event will be emitted by the create handler
            await internal_sio.emit(
                "document_template_create",
                {
                    "document_id": data.documentId,
                    "document_name": data.documentName,
                    "template_html": template_html,
                    "template_schema": template_schema,
                    "run_id": str(model_run_id),
                    "sid": sid,
                    "room": sid,
                },
            )
            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="documents.generated",
                    template="{{ actor.name }} generated document template",
                    context={
                        "department_id": str(department_id),
                    },
                    endpoint="/socket/v3/documents/generate",
                    error=False,
                )
            except Exception as log_error:
                logger.warning(
                    f"Error logging document generation activity: {log_error}"
                )

    except Exception as e:
        logger.error(f"Error in document_generate for {sid}: {str(e)}", exc_info=True)
        await document_template_generation_error(
            DocumentTemplateGenerationErrorPayload(
                success=False, message=str(e), trace_id=trace_id
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="documents.generated",
                template="{{ actor.name }} failed to generate document template",
                context={"error": str(e)},
                endpoint="/socket/v3/documents/generate",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging document generation error activity: {log_error}"
            )


@sio.event  # type: ignore
async def document_generate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = GenerateDocumentTemplatePayload(**data)
        await _document_generate_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in document_generate for {sid}: {e}")
        await document_template_generation_error(
            DocumentTemplateGenerationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}", trace_id=None
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="documents.generated",
                template="{{ actor.name }} failed to generate document template (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v3/documents/generate",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging document generation validation error activity: {log_error}"
            )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/generate", response_model=dict[str, bool])
async def document_generate_api(
    request: GenerateDocumentTemplatePayload,
) -> dict[str, bool]:
    """Client-to-server event: Generate a document template using AI."""
    return {"success": True}


@server_router.post("/generation_progress", response_model=dict[str, bool])
async def document_template_generation_progress_api(
    request: DocumentTemplateGenerationProgressPayload,
) -> dict[str, bool]:
    """Server-to-client event: Progress update for document template generation."""
    return {"success": True}


@server_router.post("/generation_complete", response_model=dict[str, bool])
async def document_template_generation_complete_api(
    request: DocumentTemplateGenerationCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Document template generation completed successfully."""
    return {"success": True}


@server_router.post("/generation_error", response_model=dict[str, bool])
async def document_template_generation_error_api(
    request: DocumentTemplateGenerationErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred during document template generation."""
    return {"success": True}
