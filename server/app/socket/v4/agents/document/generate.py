"""Handler for document_generate WebSocket event."""

import asyncio
import uuid
from typing import Any, cast

from agents import (FunctionToolResult, RunContextWrapper, Runner, Tool,
                    ToolsToFinalOutputResult, function_tool, trace)
from agents.items import TResponseInputItem
from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.agents.stream_agent_events import (StreamEventCallbacks,
                                                     stream_agent_events)
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.documents.format_document_template_context import \
    format_document_template_context
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
# SQL-generated types (from SQL introspection)
from app.sql.types import (GetDocumentRunContextAndCreateRunApiRequest,
                           GetDocumentRunContextAndCreateRunSqlParams,
                           GetDocumentRunContextAndCreateRunSqlRow,
                           GetDocumentTemplateContextSqlParams,
                           GetDocumentTemplateContextSqlRow)
from fastapi import APIRouter
from pydantic import BaseModel, Field
from utils.sql_helper import execute_sql_typed, load_sql


# Event payload types (not SQL-generated, defined inline)
class DocumentGenerationErrorApiRequest(BaseModel):
    """Error event payload for document generation."""
    document_id: str | None = None
    error_message: str


class DocumentGenerationProgressApiRequest(BaseModel):
    """Progress event payload for document generation."""
    document_id: str | None = None
    progress_type: str
    message: str | None = None


client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/documents/get_document_run_context_and_create_run_complete.sql"
SQL_TEMPLATE_CONTEXT_PATH = (
    "app/sql/v4/documents/get_document_template_context_complete.sql"
)

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
        department_id = (
            uuid.UUID(data.department_id)
            if isinstance(data.department_id, str)
            else data.department_id
        )
        document_id = (
            uuid.UUID(data.document_id)
            if data.document_id and isinstance(data.document_id, str)
            else data.document_id
        )
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
                    field_ids=[uuid.UUID(fid) for fid in field_ids]
                    if field_ids
                    else None,
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
                # Tool completion is checked after streaming completes by querying SQL
                # For now, always return False to let agent continue calling tools
                return ToolsToFinalOutputResult(is_final_output=False)

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

            # Construct input items for the agent
            input_items: list[TResponseInputItem] = context_items.copy()

            # Add the main instruction
            if context_items:
                input_items.append(
                    {
                        "role": "user",
                        "content": (
                            "Based on the document context provided above, generate a Jinja2 template HTML document and its corresponding JSON schema. "
                            "You must call both generate_html and generate_schema tools. "
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
                            "You must call both generate_html and generate_schema tools. "
                            "The template should be a complete HTML document with Jinja2 placeholders. "
                            "The schema should describe all template variables including their types (string, number, boolean, array, object) and whether they are required."
                        ),
                    }
                )

            # Rate limit validation and run creation are now handled in SQL
            # (get_document_run_context_and_create_run_complete.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully

            # Track completed tool names for verification (SQL handles persistence)
            completed_tool_names: set[str] = set()
            tool_call_id_to_name: dict[str, str] = {}
            
            # Map tool_name to tool_type (stable enum mapping)
            TOOL_NAME_TO_TYPE = {
                "create_title": "title",
                "generate_html": "html",
                "generate_schema": "schema",
            }

            # Run document generation with streaming
            with trace(
                "Document Agent",
                trace_id=trace_id,  # From groups table
                group_id=str(document_id)
                if document_id
                else None,  # Resource ID, not database group_id
            ):
                result_runner = Runner.run_streamed(
                    document_agent.agent(),
                    input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Store the result in active runs for potential cancellation
            from app.infra.v4.websocket.store_active_run import \
                store_active_run

            await store_active_run(
                str(document_id) if document_id else sid, result_runner
            )

            try:
                # Use generic streaming helper instead of manual parsing
                async def on_start(tool_call_id: str, tool_name: str, call_id: str | None) -> None:
                    tool_call_id_to_name[tool_call_id] = tool_name
                    await internal_sio.emit(
                        "document_progress",
                        {
                            "sid": sid,
                            "progress_type": "tool_call_start",
                            "document_id": str(document_id) if document_id else None,
                            "run_id": str(model_run_id),
                            "tool_call_id": tool_call_id,
                            "call_id": call_id or tool_call_id,
                            "tool_name": tool_name,
                            "arguments_raw": "",  # Empty for start
                        },
                    )

                async def on_progress(tool_call_id: str, arguments_delta: str) -> None:
                    await internal_sio.emit(
                        "document_progress",
                        {
                            "sid": sid,
                            "progress_type": "tool_call_progress",
                            "document_id": str(document_id) if document_id else None,
                            "run_id": str(model_run_id),
                            "tool_call_id": tool_call_id,
                            "call_id": None,  # SQL will look it up
                            "tool_name": None,  # SQL will look it up
                            "arguments_raw": arguments_delta,  # Delta - SQL accumulates
                        },
                    )

                async def on_complete(tool_call_id: str, final_args: dict[str, Any]) -> None:
                    tool_name = tool_call_id_to_name.get(tool_call_id, "")
                    if tool_name:
                        completed_tool_names.add(tool_name)
                    
                    # Map tool_name to tool_type (stable enum)
                    tool_type = TOOL_NAME_TO_TYPE.get(tool_name)
                    
                    await internal_sio.emit(
                        "document_complete",
                        {
                            "sid": sid,
                            "type": "tool_call_complete",
                            "document_id": str(document_id) if document_id else None,
                            "run_id": str(model_run_id),
                            "tool_call_id": tool_call_id,
                            "call_id": None,  # SQL will look it up
                            "tool_type": tool_type,  # For routing by tool_type
                            "final_content": str(final_args),
                            "arguments_raw": None,  # SQL has the accumulated version
                        },
                    )

                callbacks = StreamEventCallbacks(
                    on_tool_call_start=on_start,
                    on_tool_call_progress=on_progress,
                    on_tool_call_complete=on_complete,
                )

                # Generate tool_call_id from call_id
                def tool_call_id_generator(call_id: str | None) -> str:
                    if call_id:
                        return call_id
                    return f"document_{uuid.uuid4().hex[:16]}"

                await stream_agent_events(result_runner, callbacks, tool_call_id_generator)

            except BaseException as stream_error:
                if isinstance(
                    stream_error,
                    (asyncio.CancelledError, KeyboardInterrupt, SystemExit),
                ):
                    raise
                raise
            except Exception:
                raise
            finally:
                # Clean up active run
                from app.infra.v4.websocket.remove_active_run import \
                    remove_active_run

                await remove_active_run(str(document_id) if document_id else sid)

            # Emit async pricing event (non-blocking)
            # This handles token updates and message logging in background
            usage = result_runner.context_wrapper.usage
            assistant_output = getattr(result_runner, "final_output", None) or ""
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

            # Verify both required tools were called
            if "generate_html" not in completed_tool_names or "generate_schema" not in completed_tool_names:
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

            # Emit run completion event - complete.py will handle result extraction and template creation
            await internal_sio.emit(
                "document_complete",
                {
                    "sid": sid,
                    "type": "run_complete",
                    "document_id": str(document_id) if document_id else None,
                    "run_id": str(model_run_id),
                    "group_id": str(group_id) if group_id else None,
                    "department_id": str(department_id),
                    "document_name": document_name,
                },
            )

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
                endpoint="/socket/v4/documents/generate",
                error=True,
            )
        except Exception:
            pass


from app.main import sio


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
        error_response_type=None,  # Error handler uses DocumentErrorPayload (defined in error.py)
    )


register_client_endpoint(
    client_router,
    "/generate",
    GetDocumentRunContextAndCreateRunApiRequest,
    "Generate document template using AI",
)
