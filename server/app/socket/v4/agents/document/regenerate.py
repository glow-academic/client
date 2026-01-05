"""Handler for document_regenerate WebSocket event."""

import asyncio
import uuid
from typing import Any, cast

from agents import (
    FunctionToolResult,
    RunContextWrapper,
    Runner,
    Tool,
    ToolsToFinalOutputResult,
    trace,
)
from agents.items import TResponseInputItem
from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.agents.stream_agent_events import (
    StreamEventCallbacks,
    stream_agent_events,
)
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.documents.format_document_template_context import (
    format_document_template_context,
)
from app.infra.v4.tools.build_tool_from_config import build_tool_from_config
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.remove_active_run import remove_active_run
from app.infra.v4.websocket.store_active_run import store_active_run
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio

# SQL-generated types (from SQL introspection)
from app.sql.types import (
    GetDeveloperInstructionSqlParams,
    GetDeveloperInstructionSqlRow,
    GetDocumentRegenerationRunContextAndCreateRunSqlParams,
    GetDocumentRegenerationRunContextAndCreateRunSqlRow,
    GetDocumentTemplateContextSqlParams,
    GetDocumentTemplateContextSqlRow,
    LinkDeveloperMessageToRunSqlParams,
)
from fastapi import APIRouter
from jinja2 import Template
from pydantic import BaseModel
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

SQL_PATH = "app/sql/v4/documents/get_document_regeneration_run_context_and_create_run_complete.sql"
SQL_TEMPLATE_CONTEXT_PATH = (
    "app/sql/v4/documents/get_document_template_context_complete.sql"
)

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

            # Build document tools from database configs using generic helper
            document_tools: list[Tool] = []
            for tool_config in agent_tools_config:
                # Skip debug_info tool - it's handled separately
                if tool_config.get("name") == "debug_info":
                    continue
                try:
                    tool = build_tool_from_config(tool_config)
                    document_tools.append(tool)
                except Exception as e:
                    # Log error but continue - don't break if one tool fails
                    import logging

                    logging.getLogger(__name__).warning(
                        f"Failed to build tool {tool_config.get('name')}: {e}"
                    )

            # Add debug_info tool if available
            if "debug_info" in tool_config_map_doc:
                from app.infra.v4.debug.debug_info import debug_info

                document_tools.append(debug_info)

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

            # Get developer instruction template from database
            developer_message_content: str | None = None
            try:
                dev_instruction_params = GetDeveloperInstructionSqlParams(
                    instruction_type="document",
                    agent_role_val="document",
                )
                dev_instruction_result = cast(
                    GetDeveloperInstructionSqlRow,
                    await execute_sql_typed(
                        conn,
                        "app/sql/v4/developer_instructions/get_developer_instruction_complete.sql",
                        params=dev_instruction_params,
                    ),
                )
                if dev_instruction_result and dev_instruction_result.template:
                    # Render Jinja template (no context variables needed for document)
                    template = Template(dev_instruction_result.template)
                    developer_message_content = template.render()
            except Exception:
                # Fallback to hardcoded message if developer instruction not found
                developer_message_content = (
                    "Based on the document context provided above, regenerate the Jinja2 template HTML document and its corresponding JSON schema. "
                    "You must call both generate_html and generate_schema tools. "
                    "The template should be a complete HTML document with Jinja2 placeholders that fits the document's purpose and fields. "
                    "The schema should describe all template variables including their types (string, number, boolean, array, object) and whether they are required."
                )

            # Add user instructions if provided
            if user_instructions and user_instructions.strip():
                if developer_message_content:
                    developer_message_content += (
                        f"\n\nUser Instructions: {user_instructions}"
                    )

            if developer_message_content:
                developer_message: TResponseInputItem = {
                    "role": "developer",
                    "content": developer_message_content,
                }
                input_items.append(developer_message)

                # Link developer message to run
                try:
                    link_params = LinkDeveloperMessageToRunSqlParams(
                        content=developer_message_content,
                        run_id=model_run_id,
                    )
                    await execute_sql_typed(
                        conn,
                        "app/sql/v4/simulations/link_developer_message_to_run_complete.sql",
                        params=link_params,
                    )
                except Exception:
                    # Log error but continue - message is already in input_items
                    pass

            # Rate limit validation and run creation are now handled in SQL
            # (get_document_regeneration_run_context_and_create_run_complete.sql) - both happen atomically
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

            # Run document regeneration with streaming
            with trace(
                "Document Agent Regeneration",
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
            await store_active_run(
                str(document_id) if document_id else sid, result_runner
            )

            try:
                # Use generic streaming helper instead of manual parsing
                async def on_start(
                    tool_call_id: str, tool_name: str, call_id: str | None
                ) -> None:
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

                async def on_complete(
                    tool_call_id: str, final_args: dict[str, Any]
                ) -> None:
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

                await stream_agent_events(
                    result_runner, callbacks, tool_call_id_generator
                )

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
                await remove_active_run(str(document_id) if document_id else sid)

            # Emit async pricing event (non-blocking)
            # This handles token updates and message logging in background
            usage = result_runner.context_wrapper.usage
            assistant_output = getattr(result_runner, "final_output", None) or ""
            await internal_sio.emit(
                "log_run",
                {
                    "run_id": str(model_run_id),
                    "operation_type": "document_regeneration",
                    "input_text_tokens": usage.input_tokens,
                    "output_text_tokens": usage.output_tokens,
                    "system_prompt": context.get("system_prompt"),
                    "input_items": input_items,  # Serialized TResponseInputItem list
                    "assistant_output": assistant_output,
                    "department_id": str(department_id) if department_id else None,
                },
            )

            # Verify both required tools were called
            if (
                "generate_html" not in completed_tool_names
                or "generate_schema" not in completed_tool_names
            ):
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
        error_response_type=None,  # Error handler uses DocumentErrorPayload (defined in error.py)
    )


register_client_endpoint(
    client_router,
    "/regenerate",
    DocumentRegeneratePayload,
    "Regenerate document template using AI",
)
