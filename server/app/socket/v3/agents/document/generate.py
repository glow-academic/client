"""Handler for document_generate WebSocket event."""

import uuid
from typing import Any, cast

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
from pydantic import BaseModel, Field
from utils.sql_helper import execute_sql_typed, load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.infra.v3.agents.generic_agent import GenericAgent
from app.infra.v3.debug.debug_info import DebugContext
from app.infra.v3.documents.format_document_template_context import (
    format_document_template_context,
)
from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.handler_wrapper import handle_client_event
from app.infra.v3.websocket.openapi_helpers import register_client_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
# Types will be auto-generated from SQL introspection
# For now, using try/except to handle missing types gracefully
try:
    from app.sql.types import (
        GetDocumentRunContextAndCreateRunApiRequest,
        GetDocumentRunContextAndCreateRunSqlParams,
        GetDocumentRunContextAndCreateRunSqlRow,
        GetDocumentTemplateContextSqlParams,
        GetDocumentTemplateContextSqlRow,
        CreateTemplateAndLinkSqlParams,
        CreateTemplateAndLinkSqlRow,
        DocumentGenerationCompleteApiRequest,
        DocumentGenerationErrorApiRequest,
        DocumentGenerationErrorSqlRow,
        DocumentGenerationProgressApiRequest,
    )
except ImportError:
    # Types not generated yet - will be created when SQL files are processed
    # Using BaseModel as fallback for now
    from pydantic import BaseModel

    class GetDocumentRunContextAndCreateRunApiRequest(BaseModel):
        department_id: str
        document_id: str | None = None
        document_name: str | None = None
        document_description: str | None = None
        field_ids: list[str] | None = None

    class GetDocumentRunContextAndCreateRunSqlParams(BaseModel):
        department_id: uuid.UUID
        profile_id: uuid.UUID
        document_id: uuid.UUID | None = None
        document_name: str | None = None
        document_description: str | None = None
        field_ids: list[uuid.UUID] | None = None

    class GetDocumentRunContextAndCreateRunSqlRow(BaseModel):
        agent_id: str
        agent_name: str
        system_prompt: str
        temperature: float
        reasoning: str
        model_id: str
        model_name: str
        provider: str
        base_url: str
        api_key: str
        profile_id: str
        req_per_day: int
        runs_today_count: int
        earliest_run_created_at: str | None
        run_id: str
        group_id: uuid.UUID
        trace_id: str

    class GetDocumentTemplateContextSqlParams(BaseModel):
        field_ids: list[uuid.UUID]

    class DocumentTemplateContextField(BaseModel):
        item_name: str
        item_description: str
        param_name: str
        param_description: str

    class GetDocumentTemplateContextSqlRow(BaseModel):
        fields: list[DocumentTemplateContextField]

    class CreateTemplateAndLinkSqlParams(BaseModel):
        document_id: uuid.UUID
        upload_id: uuid.UUID
        name: str
        template_schema: str  # jsonb as string
        active: bool
        run_id: uuid.UUID

    class CreateTemplateAndLinkSqlRow(BaseModel):
        template_id: uuid.UUID

    class DocumentGenerationCompleteApiRequest(BaseModel):
        document_id: uuid.UUID | None = None
        message: str
        template_html: str
        template_schema: dict[str, Any]
        upload_id: str
        template_mapping: dict[str, Any] | None = None

    class DocumentGenerationErrorApiRequest(BaseModel):
        document_id: uuid.UUID | None = None
        error_message: str

    class DocumentGenerationErrorSqlRow(BaseModel):
        success: bool
        message: str

    class DocumentGenerationProgressApiRequest(BaseModel):
        document_id: uuid.UUID | None = None
        progress_type: str
        message: str | None = None

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v3/documents/get_document_run_context_and_create_run_complete.sql"
SQL_TEMPLATE_CONTEXT_PATH = "app/sql/v3/documents/get_document_template_context_complete.sql"
SQL_CREATE_TEMPLATE_PATH = "app/sql/v3/documents/create_template_and_link_complete.sql"

internal_sio = get_internal_sio()


async def _document_generate_impl(
    sid: str,
    data: GetDocumentRunContextAndCreateRunApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Handle document template generation requests via WebSocket."""
    trace_id: str | None = None
    group_id: uuid.UUID | None = None

    try:
        # data fields are already validated as UUIDs by GetDocumentRunContextAndCreateRunApiRequest
        # (Pydantic auto-converts strings to UUIDs)
        department_id = uuid.UUID(data.department_id) if isinstance(data.department_id, str) else data.department_id
        document_id = uuid.UUID(data.document_id) if data.document_id and isinstance(data.document_id, str) else data.document_id
        document_name = data.document_name
        document_description = data.document_description
        field_ids = data.field_ids

        async with get_db_connection() as conn:
            # Get all context data AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            try:
                # Use execute_sql_typed() - auto-detects function
                params = GetDocumentRunContextAndCreateRunSqlParams(
                    department_id=department_id,
                    profile_id=profile_id,  # From sid lookup
                    document_id=document_id,
                    document_name=document_name,
                    document_description=document_description,
                    field_ids=[uuid.UUID(fid) for fid in field_ids] if field_ids else None,
                )
                result = cast(
                    GetDocumentRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
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
                    await emit_to_internal(
                        "document_error",
                        DocumentGenerationErrorApiRequest(
                            document_id=document_id if document_id else None,
                            error_message=user_msg,
                        ),
                        sid=sid,
                    )
                    return
                await emit_to_internal(
                    "document_error",
                    DocumentGenerationErrorApiRequest(
                        document_id=document_id if document_id else None,
                        error_message=f"Failed to initialize document generation: {str(e)}",
                    ),
                    sid=sid,
                )
                return

            if not result:
                await emit_to_internal(
                    "document_error",
                    DocumentGenerationErrorApiRequest(
                        document_id=document_id if document_id else None,
                        error_message=f"No document agent configured for department {department_id}",
                    ),
                    sid=sid,
                )
                return

            # result.group_id and result.trace_id come from groups table
            trace_id = result.trace_id  # From groups.trace_id
            group_id = result.group_id  # Created by SQL

            # Emit start event via internal bus
            # trace_id comes from groups table via SQL, not passed in payload
            await emit_to_internal(
                "document_progress",
                DocumentGenerationProgressApiRequest(
                    document_id=document_id if document_id else None,
                    progress_type="start",
                    message="Starting document template generation",
                ),
                sid=sid,
                group_id=str(group_id) if group_id else None,
            )

            # Build context dict
            context = {
                "agent_id": result.agent_id,
                "agent_name": result.agent_name,
                "system_prompt": result.system_prompt,
                "temperature": float(result.temperature)
                if result.temperature is not None
                else 0.0,
                "reasoning": result.reasoning,
                "model_id": result.model_id,
                "model_name": result.model_name,
                "provider": result.provider,
                "base_url": result.base_url,
                "api_key": result.api_key,
                "profile_id": result.profile_id,
            }

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)

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

            # Create title tool
            title_config = tool_config_map_doc.get("create_title")
            if title_config:
                title_desc = title_config.get("argument_descriptions", {}).get(
                    "title",
                    "A descriptive title for this content item",
                )
            else:
                title_desc = "A descriptive title for this content item"

            async def create_title(
                title: str = Field(description=title_desc),
            ) -> str:
                """Create a descriptive title for this document."""
                document_results["title"] = title
                document_progress["title"] = True
                # Emit to internal bus for title creation
                await internal_sio.emit(
                    "document_tool_title",
                    {
                        "sid": sid,
                        "trace_id": trace_id,
                        "title": title,
                        "document_id": str(document_id) if document_id else None,
                    },
                )
                return "Created title successfully"

            document_tools.append(function_tool(create_title))

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
                return "Generated template HTML successfully"

            document_tools.append(function_tool(generate_template_html))

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
                return "Generated template schema successfully"

            document_tools.append(function_tool(generate_template_schema))

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
                return ToolsToFinalOutputResult(is_final_output=both_complete)

            # Build document agent inline
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
            if field_ids and len(field_ids) > 0:
                field_ids_uuid = [uuid.UUID(fid) for fid in field_ids]
                try:
                    # Use execute_sql_typed() - returns composite type array
                    template_context_params = GetDocumentTemplateContextSqlParams(
                        field_ids=field_ids_uuid,
                    )
                    template_context_result = cast(
                        GetDocumentTemplateContextSqlRow,
                        await execute_sql_typed(
                            conn, SQL_TEMPLATE_CONTEXT_PATH, params=template_context_params
                        ),
                    )
                    # Convert composite type array to dict format for format_document_template_context
                    if template_context_result.fields:
                        fields_data = [
                            {
                                "item_name": getattr(field, "item_name", ""),
                                "item_description": getattr(field, "item_description", ""),
                                "param_name": getattr(field, "param_name", ""),
                                "param_description": getattr(field, "param_description", ""),
                            }
                            for field in template_context_result.fields
                        ]
                except Exception:
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
                document_name=document_name,
                document_description=document_description,
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
            # (get_document_run_context_and_create_run_complete.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully

            # Run document generation with tracing
            with trace(
                "Document Agent",
                trace_id=trace_id,  # From groups table
                group_id=str(document_id) if document_id else None,  # Resource ID, not database group_id
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

            # Parse schema JSON (from tool output string)
            import json

            try:
                template_schema = json.loads(template_schema_str)
            except (json.JSONDecodeError, TypeError):
                template_schema = {}

            # Verify both tools were called
            if not document_progress.get("template_html") or not document_progress.get(
                "template_schema"
            ):
                await emit_to_internal(
                    "document_error",
                    DocumentGenerationErrorApiRequest(
                        document_id=document_id if document_id else None,
                        error_message=(
                            "Document agent did not call both required tools. "
                            "Expected: generate_template_html and generate_template_schema"
                        ),
                    ),
                    sid=sid,
                )
                return

            # Create template directly in database
            import os

            from utils.cache.invalidate_tags import invalidate_tags

            from app.main import UPLOAD_FOLDER

            try:
                # Save template HTML to file and create upload record
                upload_uuid = uuid.uuid4()
                file_path = f"{upload_uuid}.html"
                full_path = os.path.join(UPLOAD_FOLDER, file_path)

                # Ensure uploads directory exists
                os.makedirs(UPLOAD_FOLDER, exist_ok=True)

                # Write template HTML to file
                with open(full_path, "w", encoding="utf-8") as f:
                    f.write(template_html)

                template_mapping: dict[str, Any] | None = None

                async with conn.transaction():
                    # Create upload record
                    sql_insert_upload = load_sql("app/sql/v3/uploads/insert_upload.sql")
                    upload_id_result = await conn.fetchrow(
                        sql_insert_upload,
                        file_path,
                        "text/html",
                        len(template_html.encode("utf-8")),
                    )
                    upload_id = upload_id_result["id"]

                    # If documentId is provided, create template and link to document and run
                    if document_id:
                        # template_schema is dynamic JSON, so we need json.dumps() for SQL function
                        template_schema_jsonb = json.dumps(template_schema)
                        template_name = f"Template for {document_name or 'Document'}"

                        # Create template and link to document and run using execute_sql_typed()
                        # Note: template_schema_jsonb is passed as string, SQL function expects jsonb
                        create_template_params = CreateTemplateAndLinkSqlParams(
                            document_id=document_id,
                            upload_id=uuid.UUID(upload_id),
                            name=template_name,
                            template_schema=template_schema_jsonb,  # jsonb parameter as string
                            active=True,
                            run_id=model_run_id,
                        )
                        template_result = cast(
                            CreateTemplateAndLinkSqlRow,
                            await execute_sql_typed(
                                conn, SQL_CREATE_TEMPLATE_PATH, params=create_template_params
                            ),
                        )

                        if template_result:
                            template_id = template_result.template_id

                        # Fetch updated templates and build mapping from array
                        sql_templates = load_sql(
                            "app/sql/v3/documents/get_document_templates.sql"
                        )
                        template_rows = await conn.fetch(sql_templates, str(document_id))

                        # Build mapping from array
                        template_mapping = {}
                        for row in template_rows:
                            upload_id_str = str(row["upload_id"])
                            # template_args is jsonb from database, convert to dict if needed
                            template_args = row["template_args"]
                            if isinstance(template_args, str):
                                template_args = json.loads(template_args)
                            elif not isinstance(template_args, dict):
                                template_args = {}
                            template_mapping[upload_id_str] = {
                                "template_id": str(row["template_id"]),
                                "template_args": template_args,
                                "active": row["active"],
                                "created_at": row["created_at"].isoformat()
                                if row["created_at"]
                                else None,
                                "updated_at": row["updated_at"].isoformat()
                                if row["updated_at"]
                                else None,
                            }

                if document_id:
                    # Invalidate documents cache
                    await invalidate_tags(["documents"])

                # Emit completion event via internal bus
                await emit_to_internal(
                    "document_complete",
                    DocumentGenerationCompleteApiRequest(
                        document_id=document_id if document_id else None,
                        message="Document template created successfully",
                        template_html=template_html,
                        template_schema=template_schema,
                        upload_id=upload_id,
                        template_mapping=template_mapping,
                    ),
                    sid=sid,
                    group_id=str(group_id),
                )

            except Exception as create_error:
                # Error creating template - emit error event
                await emit_to_internal(
                    "document_error",
                    DocumentGenerationErrorApiRequest(
                        document_id=document_id if document_id else None,
                        error_message=f"Failed to create template: {str(create_error)}",
                    ),
                    sid=sid,
                )
                return

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
            except Exception:
                pass

    except RuntimeError:
        # Pool not initialized - emit error event
        await emit_to_internal(
            "document_error",
            DocumentGenerationErrorApiRequest(
                document_id=document_id if document_id else None,
                error_message="Database connection pool not available",
            ),
            sid=sid,
        )
    except Exception as e:
        await emit_to_internal(
            "document_error",
            DocumentGenerationErrorApiRequest(
                document_id=document_id if document_id else None,
                error_message=str(e),
            ),
            sid=sid,
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
        except Exception:
            pass


@sio.event  # type: ignore
async def document_generate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    # Convert camelCase to snake_case for ApiRequest
    converted_data = {
        "department_id": data.get("departmentId"),
        "document_id": data.get("documentId"),
        "document_name": data.get("documentName"),
        "document_description": data.get("documentDescription"),
        "field_ids": data.get("fieldIds"),
    }
    await handle_client_event(
        sid=sid,
        data=converted_data,
        request_type=GetDocumentRunContextAndCreateRunApiRequest,
        handler=_document_generate_impl,  # type: ignore[arg-type]
        error_event_name="documents_generation_error",
        error_response_type=DocumentGenerationErrorSqlRow,
    )


register_client_endpoint(
    client_router,
    "/generate",
    GetDocumentRunContextAndCreateRunApiRequest,
    "Generate document template using AI",
)
