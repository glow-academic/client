"""Handler for document_regenerate WebSocket event."""

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

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.documents.format_document_template_context import (
    format_document_template_context,
)
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.utils.schema_helper import create_schema_from_dict

# Types will be auto-generated from SQL introspection
try:
    from app.sql.types import (
        CreateTemplateAndLinkSqlParams,
        CreateTemplateAndLinkSqlRow,
        DocumentGenerationCompleteApiRequest,
        DocumentGenerationErrorApiRequest,
        DocumentGenerationErrorSqlRow,
        DocumentGenerationProgressApiRequest,
        GetDocumentRegenerationRunContextAndCreateRunSqlParams,
        GetDocumentRegenerationRunContextAndCreateRunSqlRow,
        GetDocumentTemplateContextSqlParams,
        GetDocumentTemplateContextSqlRow,
    )
except ImportError:
    # Types not generated yet - will be created when SQL files are processed
    from pydantic import BaseModel

    class GetDocumentRegenerationRunContextAndCreateRunSqlParams(BaseModel):
        department_id: uuid.UUID
        profile_id: uuid.UUID
        document_agent_id: uuid.UUID
        group_id: uuid.UUID
        document_id: uuid.UUID | None = None
        document_name: str | None = None
        document_description: str | None = None
        field_ids: list[uuid.UUID] | None = None
        user_instructions: str | None = None

    class GetDocumentRegenerationRunContextAndCreateRunSqlRow(BaseModel):
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
        previous_messages: list[Any] | None = None

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
        schema_id: uuid.UUID
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

SQL_PATH = "app/sql/v4/documents/get_document_regeneration_run_context_and_create_run_complete.sql"
SQL_TEMPLATE_CONTEXT_PATH = (
    "app/sql/v4/documents/get_document_template_context_complete.sql"
)
SQL_CREATE_TEMPLATE_PATH = "app/sql/v4/documents/create_template_and_link_complete.sql"

internal_sio = get_internal_sio()


async def _document_regenerate_impl(
    sid: str,
    data: dict[str, Any],  # Will be validated by handle_client_event
    profile_id: uuid.UUID,
) -> None:
    """Handle document regeneration requests via WebSocket."""
    trace_id: str | None = None

    try:
        # Extract required fields (already validated as UUIDs by ApiRequest)
        department_id = (
            uuid.UUID(data["department_id"])
            if isinstance(data["department_id"], str)
            else data["department_id"]
        )
        document_agent_id = (
            uuid.UUID(data["document_agent_id"])
            if isinstance(data["document_agent_id"], str)
            else data["document_agent_id"]
        )
        group_id = uuid.UUID(data["group_id"])  # REQUIRED for regeneration
        document_id = (
            uuid.UUID(data["document_id"])
            if data.get("document_id") and isinstance(data["document_id"], str)
            else data.get("document_id")
        )
        document_name = data.get("document_name")
        document_description = data.get("document_description")
        field_ids = data.get("field_ids")
        user_instructions = data.get("user_instructions")

        async with get_db_connection() as conn:
            # Get all context data AND create run in single atomic transaction
            # This validates rate limits, creates run, gets all previous messages,
            # and links existing system/developer messages atomically
            try:
                # Use execute_sql_typed() - auto-detects function
                params = GetDocumentRegenerationRunContextAndCreateRunSqlParams(
                    department_id=department_id,
                    profile_id=profile_id,  # From sid lookup
                    document_agent_id=document_agent_id,
                    group_id=group_id,  # REQUIRED for regeneration (uses existing group)
                    document_id=document_id,
                    document_name=document_name,
                    document_description=document_description,
                    field_ids=[uuid.UUID(fid) for fid in field_ids]
                    if field_ids
                    else None,
                    user_instructions=user_instructions,
                )
                result = cast(
                    GetDocumentRegenerationRunContextAndCreateRunSqlRow,
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
                        error_message=f"Failed to initialize document regeneration: {str(e)}",
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
            group_id = result.group_id  # Uses existing group

            # Extract run_id from result (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)

            # Get previous messages from result (already properly typed as composite types)
            previous_messages: list[TResponseInputItem] = []
            if result.previous_messages:
                previous_messages = [
                    cast(
                        TResponseInputItem,
                        {
                            "role": msg.role or "",
                            "content": msg.content or "",
                        },
                    )
                    for msg in result.previous_messages
                ]

            # Emit start event via internal bus
            # trace_id comes from groups table via SQL, not passed in payload
            await emit_to_internal(
                "document_progress",
                DocumentGenerationProgressApiRequest(
                    document_id=document_id if document_id else None,
                    progress_type="start",
                    message="Starting document template regeneration",
                ),
                sid=sid,
                group_id=str(group_id),
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

            # Load agent tools from database
            agent_id_uuid = uuid.UUID(context["agent_id"])
            from app.sql.types import GetAgentToolsSqlRow

            # Function returns multiple rows, so we call it directly with fetch()
            function_call_sql = 'SELECT * FROM "public"."socket_get_agent_tools_v4"($1)'
            rows = await conn.fetch(function_call_sql, agent_id_uuid)
            agent_tools_config = [
                GetAgentToolsSqlRow.model_validate(dict(row)).model_dump()
                for row in rows
            ]
            tool_config_map_doc: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            # Build document tools inline (same as generate.py)
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
                # SQL handles persistence via tool_call_arguments
                return "Created title successfully"

            document_tools.append(function_tool(create_title))

            # Generate template HTML tool
            html_config = tool_config_map_doc.get("generate_html")
            if html_config:
                html_desc = html_config.get("argument_descriptions", {}).get(
                    "template_html",
                    "Jinja template HTML content with placeholders like {{ variable_name }}",
                )
            else:
                html_desc = "Jinja template HTML content with placeholders like {{ variable_name }}"

            async def generate_html(
                template_html: str = Field(description=html_desc),
            ) -> str:
                """Generate the Jinja template HTML for the document."""
                # SQL handles persistence via tool_call_arguments
                return "Generated template HTML successfully"

            document_tools.append(function_tool(generate_html))

            # Generate template schema tool
            schema_config = tool_config_map_doc.get("generate_schema")
            if schema_config:
                schema_desc = schema_config.get("argument_descriptions", {}).get(
                    "schema_json",
                    "JSON string in TemplateSchema format describing the template context fields and types. Must have structure: { 'name': string, 'fields': [{ 'name': string, 'type': 'string'|'number'|'boolean'|'array'|'object', 'required': bool (optional), 'item': {...} (optional for arrays), 'fields': [...] (optional for objects) }] }",
                )
            else:
                schema_desc = "JSON string in TemplateSchema format describing the template context fields and types. Must have structure: { 'name': string, 'fields': [{ 'name': string, 'type': 'string'|'number'|'boolean'|'array'|'object', 'required': bool (optional), 'item': {...} (optional for arrays), 'fields': [...] (optional for objects) }] }"

            async def generate_schema(
                schema_json: str = Field(description=schema_desc),
            ) -> str:
                """Generate the TemplateSchema JSON for template context."""
                # SQL handles persistence via tool_call_arguments
                return "Generated template schema successfully"

            document_tools.append(function_tool(generate_schema))

            # Create tool use behavior to wait for both tools to be called
            def tool_use_behavior(
                tool_context: RunContextWrapper[Any],
                tool_results: list[FunctionToolResult],
            ) -> ToolsToFinalOutputResult:
                # Tool completion is checked after run completes by querying SQL
                both_complete = True  # Will verify by querying SQL
                return ToolsToFinalOutputResult(is_final_output=both_complete)

            # Build document agent inline (same as generate.py)
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
                field_ids_uuid = [
                    uuid.UUID(fid) if isinstance(fid, str) else fid for fid in field_ids
                ]
                try:
                    # Use execute_sql_typed() - returns composite type array
                    template_context_params = GetDocumentTemplateContextSqlParams(
                        field_ids=field_ids_uuid,
                    )
                    template_context_result = cast(
                        GetDocumentTemplateContextSqlRow,
                        await execute_sql_typed(
                            conn,
                            SQL_TEMPLATE_CONTEXT_PATH,
                            params=template_context_params,
                        ),
                    )
                    # Convert composite type array to dict format for format_document_template_context
                    if template_context_result.fields:
                        fields_data = [
                            {
                                "item_name": getattr(field, "item_name", ""),
                                "item_description": getattr(
                                    field, "item_description", ""
                                ),
                                "param_name": getattr(field, "param_name", ""),
                                "param_description": getattr(
                                    field, "param_description", ""
                                ),
                            }
                            for field in template_context_result.fields
                        ]
                except Exception:
                    fields_data = []

            # Get department name
            department_name: str | None = None
            if department_id:
                sql_get_dept = load_sql(
                    "app/sql/v4/departments/get_department_title.sql"
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

            # Build input items: previous messages + document context + user instructions
            input_items: list[TResponseInputItem] = []

            # Add previous messages first (conversation history from all runs)
            input_items.extend(previous_messages)

            # Add document context (if any)
            if context_items:
                input_items.extend(context_items)

            # Append user instructions on top (most recent instruction goes last)
            if user_instructions and user_instructions.strip():
                input_items.append(
                    {
                        "role": "user",
                        "content": (
                            "Based on the document context provided above, regenerate the Jinja2 template HTML document and its corresponding JSON schema. "
                            "You must call both generate_html and generate_schema tools. "
                            "The template should be a complete HTML document with Jinja2 placeholders that fits the document's purpose and fields. "
                            "The schema should describe all template variables including their types (string, number, boolean, array, object) and whether they are required.\n\n"
                            f"User Instructions: {user_instructions}"
                        ),
                    }
                )
            else:
                # If no instructions, just add the regeneration instruction
                input_items.append(
                    {
                        "role": "user",
                        "content": (
                            "Based on the document context provided above, regenerate the Jinja2 template HTML document and its corresponding JSON schema. "
                            "You must call both generate_html and generate_schema tools. "
                            "The template should be a complete HTML document with Jinja2 placeholders that fits the document's purpose and fields. "
                            "The schema should describe all template variables including their types (string, number, boolean, array, object) and whether they are required."
                        ),
                    }
                )

            # Rate limit validation and run creation are now handled in SQL
            # (get_document_regeneration_run_context_and_create_run_complete.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully

            # Run document regeneration with tracing
            with trace(
                "Document Agent Regeneration",
                trace_id=trace_id,  # From groups table
                group_id=str(document_id)
                if document_id
                else None,  # Resource ID, not database group_id
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
                    "operationType": "document_regeneration",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": context["system_prompt"],
                    "inputItems": input_items,  # Serialized TResponseInputItem list
                    "assistantOutput": assistant_output,
                    "departmentId": str(department_id),
                },
            )

            # Extract results from SQL (tool_call_arguments table)
            # Query tool_call_arguments for completed tools
            import json

            template_html = ""
            template_schema_str = "{}"

            # Get template_html from generate_html tool_call
            html_tool_call_query = """
                SELECT tca.arguments_json->>'template_html' as template_html
                FROM tool_calls tc
                JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
                JOIN tool_call_arguments tca ON tca.tool_call_id = tc.id
                JOIN tools t ON t.id = tc.tool_id
                WHERE tcr.run_id = $1
                  AND t.name = 'generate_html'
                  AND tc.completed = true
                ORDER BY tc.created_at DESC
                LIMIT 1
            """
            html_result = await conn.fetchrow(html_tool_call_query, model_run_id)
            if html_result and html_result["template_html"]:
                template_html = html_result["template_html"]

            # Get schema_json from generate_schema tool_call
            schema_tool_call_query = """
                SELECT tca.arguments_json->>'schema_json' as schema_json
                FROM tool_calls tc
                JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
                JOIN tool_call_arguments tca ON tca.tool_call_id = tc.id
                JOIN tools t ON t.id = tc.tool_id
                WHERE tcr.run_id = $1
                  AND t.name = 'generate_schema'
                  AND tc.completed = true
                ORDER BY tc.created_at DESC
                LIMIT 1
            """
            schema_result = await conn.fetchrow(schema_tool_call_query, model_run_id)
            if schema_result and schema_result["schema_json"]:
                template_schema_str = schema_result["schema_json"]

            # Parse schema JSON
            try:
                template_schema = json.loads(template_schema_str)
            except (json.JSONDecodeError, TypeError):
                template_schema = {}

            # Verify both tools were called
            if not template_html or not template_schema_str or template_schema_str == "{}":
                await emit_to_internal(
                    "document_error",
                    DocumentGenerationErrorApiRequest(
                        document_id=document_id if document_id else None,
                        error_message=(
                            "Document agent did not call both required tools. "
                            "Expected: generate_html and generate_schema"
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
                    sql_insert_upload = load_sql("app/sql/v4/uploads/insert_upload.sql")
                    upload_id_result = await conn.fetchrow(
                        sql_insert_upload,
                        file_path,
                        "text/html",
                        len(template_html.encode("utf-8")),
                    )
                    upload_id = upload_id_result["id"]

                    # If documentId is provided, create template and link to document and run
                    if document_id:
                        template_name = f"Template for {document_name or 'Document'}"

                        # Create schema records from template_schema dict
                        schema_id = await create_schema_from_dict(conn, template_schema)

                        # Create template and link to document and run using execute_sql_typed()
                        create_template_params = CreateTemplateAndLinkSqlParams(
                            document_id=document_id,
                            upload_id=uuid.UUID(upload_id),
                            name=template_name,
                            schema_id=schema_id,
                            active=True,
                            run_id=model_run_id,
                        )
                        template_result = cast(
                            CreateTemplateAndLinkSqlRow,
                            await execute_sql_typed(
                                conn,
                                SQL_CREATE_TEMPLATE_PATH,
                                params=create_template_params,
                            ),
                        )

                        if template_result:
                            template_id = template_result.template_id

                        # Fetch updated templates and build mapping from array
                        from app.sql.types import (
                            GetDocumentTemplatesSqlParams,
                            GetDocumentTemplatesSqlRow,
                        )

                        template_params = GetDocumentTemplatesSqlParams(
                            document_id=document_id
                        )
                        template_result_list = cast(
                            GetDocumentTemplatesSqlRow,
                            await execute_sql_typed(
                                conn,
                                "app/sql/v4/documents/get_document_templates_complete.sql",
                                params=template_params,
                            ),
                        )

                        # Build mapping from array (now using schema_id instead of template_args)
                        template_mapping = {}
                        if (
                            hasattr(template_result_list, "templates")
                            and template_result_list.templates
                        ):
                            for template in template_result_list.templates:
                                upload_id_str = (
                                    str(template.upload_id)
                                    if template.upload_id
                                    else ""
                                )
                                schema_id_str = (
                                    str(template.schema_id)
                                    if template.schema_id
                                    else None
                                )
                                template_mapping[upload_id_str] = {
                                    "template_id": str(template.template_id),
                                    "schema_id": schema_id_str,
                                    "active": template.active,
                                    "created_at": template.created_at.isoformat()
                                    if template.created_at
                                    else None,
                                    "updated_at": template.updated_at.isoformat()
                                    if template.updated_at
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
                        message="Document template regenerated successfully",
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
                    event_key="documents.regenerated",
                    template="{{ actor.name }} regenerated document template",
                    context={
                        "department_id": str(department_id),
                    },
                    endpoint="/socket/v4/documents/regenerate",
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
                event_key="documents.regenerated",
                template="{{ actor.name }} failed to regenerate document template",
                context={"error": str(e)},
                endpoint="/socket/v4/documents/regenerate",
                error=True,
            )
        except Exception:
            pass


# Pydantic model for client-to-server event
class DocumentRegeneratePayload(BaseModel):
    """Request to regenerate a document template."""

    department_id: str
    document_agent_id: str
    group_id: str  # REQUIRED for regeneration
    document_id: str | None = None
    document_name: str | None = None
    document_description: str | None = None
    field_ids: list[str] | None = None
    user_instructions: str | None = None


@sio.event  # type: ignore
async def document_regenerate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    # Convert camelCase to snake_case for ApiRequest
    converted_data = {
        "department_id": data.get("departmentId") or data.get("department_id"),
        "document_agent_id": data.get("documentAgentId")
        or data.get("document_agent_id"),
        "group_id": data.get("groupId") or data.get("group_id"),  # REQUIRED
        "document_id": data.get("documentId") or data.get("document_id"),
        "document_name": data.get("documentName") or data.get("document_name"),
        "document_description": data.get("documentDescription")
        or data.get("document_description"),
        "field_ids": data.get("fieldIds") or data.get("field_ids"),
        "user_instructions": data.get("userInstructions")
        or data.get("user_instructions"),
    }
    await handle_client_event(
        sid=sid,
        data=converted_data,
        request_type=DocumentRegeneratePayload,
        handler=_document_regenerate_impl,  # type: ignore[arg-type]
        error_event_name="documents_generation_error",
        error_response_type=DocumentGenerationErrorSqlRow,
    )


register_client_endpoint(
    client_router,
    "/regenerate",
    DocumentRegeneratePayload,
    "Regenerate document template using AI",
)
