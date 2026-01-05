"""Handler for document_generate WebSocket event."""

import asyncio
import uuid
from typing import Any, cast

from agents import (FunctionToolResult, RunContextWrapper, Runner, Tool,
                    ToolsToFinalOutputResult, trace)
from agents.items import TResponseInputItem
from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.agents.stream_agent_events import (StreamEventCallbacks,
                                                     stream_agent_events)
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.documents.format_document_template_context import \
    format_document_template_context
from app.infra.v4.tools.build_tool_from_config import build_tool_from_config
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
# SQL-generated types (from SQL introspection)
from app.sql.types import (GetDocumentRunContextAndCreateRunApiRequest,
                           GetDocumentRunContextAndCreateRunSqlParams,
                           GetDocumentRunContextAndCreateRunSqlRow)
from fastapi import APIRouter
from jinja2 import Template
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed


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
        department_id = data.department_id
        document_id = data.document_id
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
                    field_ids=field_ids,  # Already UUIDs from Pydantic
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
                            document_id=str(document_id) if document_id else None,
                            error_message=user_msg,
                        ),
                        sid=sid,
                    )
                    return
                await emit_to_internal(
                    "document_error",
                    DocumentGenerationErrorApiRequest(
                        document_id=str(document_id) if document_id else None,
                        error_message=f"Failed to initialize document generation: {str(e)}",
                    ),
                    sid=sid,
                )
                return

            if not result:
                await emit_to_internal(
                    "document_error",
                    DocumentGenerationErrorApiRequest(
                        document_id=str(document_id) if document_id else None,
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
                    document_id=str(document_id) if document_id else None,
                    progress_type="start",
                    message=f"Starting {result.agent_name or 'document'} generation",
                ),
                sid=sid,
                group_id=str(group_id) if group_id else None,
            )

            # Build context dict with proper type casting
            context: dict[str, Any] = {
                "agent_id": str(result.agent_id) if result.agent_id else "",
                "agent_name": str(result.agent_name) if result.agent_name else "",
                "system_prompt": str(result.system_prompt)
                if result.system_prompt
                else "",
                "temperature": float(result.temperature)
                if result.temperature is not None
                else 0.0,
                "reasoning": str(result.reasoning) if result.reasoning else None,
                "model_id": str(result.model_id) if result.model_id else "",
                "model_name": str(result.model_name) if result.model_name else "",
                "provider": str(result.provider) if result.provider else "",
                "base_url": str(result.base_url) if result.base_url else None,
                "api_key": str(result.api_key) if result.api_key else "",
                "profile_id": str(result.profile_id) if result.profile_id else "",
            }

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(str(result.run_id))

            # Get tools from SQL result (composite type array)
            # Filter out tools with None names (shouldn't happen, but defensive)
            agent_tools_config_filtered: list[Any] = [
                tool for tool in (result.tools or []) if tool.name is not None
            ]
            # Type assertion: after filtering, all tools have non-None names
            agent_tools_config = agent_tools_config_filtered  # type: ignore[assignment]
            tool_config_map_doc: dict[str, dict[str, Any]] = {}
            for tool in agent_tools_config:
                if tool.name is not None:
                    tool_name = cast(str, tool.name)
                    tool_config_map_doc[tool_name] = {
                        "id": str(tool.id),
                        "name": tool_name,
                        "description": tool.description or "",
                        "tool_type": tool.tool_type or "",
                        "agent_role": tool.agent_role or "",
                        "arguments": tool.arguments,
                        "argument_descriptions": tool.argument_descriptions,
                        "argument_defaults": tool.argument_defaults,
                        "active": tool.active,
                    }

            # Build document tools from database configs using generic helper
            document_tools: list[Tool] = []
            for tool in agent_tools_config:
                # Skip debug_info tool - it's handled separately
                if tool.name == "debug_info":
                    continue
                # tool.name is guaranteed non-None after filter above
                if tool.name is None:
                    continue
                try:
                    tool_name = cast(str, tool.name)
                    tool_config = tool_config_map_doc.get(tool_name)
                    if not tool_config:
                        continue
                    built_tool = build_tool_from_config(tool_config)
                    document_tools.append(built_tool)
                except Exception as e:
                    # Log error but continue - don't break if one tool fails
                    import logging

                    logging.getLogger(__name__).warning(
                        f"Failed to build tool {tool.name}: {e}"
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
                # Tool completion is checked after streaming completes by querying SQL
                # For now, always return False to let agent continue calling tools
                return ToolsToFinalOutputResult(is_final_output=False)

            # Build document agent inline
            document_agent = GenericAgent(
                agent_name=cast(str, context["agent_name"]),
                system_prompt=cast(str, context["system_prompt"]),
                temperature=cast(float, context["temperature"]),
                model_name=cast(str, context["model_name"]),
                provider=cast(str, context["provider"]),
                base_url=cast(str | None, context["base_url"]),
                api_key=cast(str, context["api_key"]),
                reasoning=cast(str | None, context["reasoning"]),
                tools=document_tools,
                parallel_tool_calls=False,
                tool_use_behavior=tool_use_behavior,
            )

            # Get fields data from SQL result (composite type array)
            fields_data: list[dict[str, Any]] | None = None
            if result.template_context_fields:
                fields_data = [
                    {
                        "item_name": field.item_name or "",
                        "item_description": field.item_description or "",
                        "param_name": field.param_name or "",
                        "param_description": field.param_description or "",
                    }
                    for field in result.template_context_fields
                ]

            # Get department name from SQL result
            department_name: str | None = result.department_name

            # Format context for agent input
            context_items = format_document_template_context(
                document_name=document_name,
                document_description=document_description,
                department_name=department_name,
                fields=fields_data,
            )

            # Construct input items for the agent
            input_items: list[TResponseInputItem] = context_items.copy()

            # Get developer instruction template from SQL result
            developer_message_content: str | None = (
                result.developer_instruction_template
            )
            if developer_message_content:
                # Render Jinja template (no context variables needed for document)
                template = Template(developer_message_content)
                developer_message_content = template.render()

                developer_message: TResponseInputItem = {
                    "role": "developer",
                    "content": developer_message_content,
                }
                input_items.append(developer_message)
                # Developer message linking is handled in SQL (result.developer_message_id)

            # Rate limit validation and run creation are now handled in SQL
            # (get_document_run_context_and_create_run_complete.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully

            # Track completed tool names for verification (SQL handles persistence)
            # Get required tool names from database result
            # tool.name is guaranteed non-None after filter above
            required_tool_names: set[str] = set()
            for tool in agent_tools_config:
                if tool.name is not None:
                    required_tool_names.add(cast(str, tool.name))
            completed_tool_names: set[str] = set()
            tool_call_id_to_name: dict[str, str] = {}
            # Map tool_name to tool_type from database result
            tool_name_to_type: dict[str, str] = {}
            for tool in agent_tools_config:
                if tool.name is not None and tool.tool_type is not None:
                    tool_name_to_type[cast(str, tool.name)] = cast(str, tool.tool_type)

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

                    # Map tool_name to tool_type from database result
                    tool_type: str | None = (
                        tool_name_to_type.get(tool_name) if tool_name else None
                    )

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
                    "run_id": str(model_run_id),
                    "operation_type": result.agent_role
                    or "document",  # Use agent_role from database
                    "input_text_tokens": usage.input_tokens,
                    "output_text_tokens": usage.output_tokens,
                    "system_prompt": context.get("system_prompt"),
                    "input_items": input_items,  # Serialized TResponseInputItem list
                    "assistant_output": assistant_output,
                    "department_id": str(department_id) if department_id else None,
                },
            )

            # Verify all required tools were called (based on database config)
            missing_tools = required_tool_names - completed_tool_names
            if missing_tools:
                tool_names_str = ", ".join(sorted(missing_tools))
                await emit_to_internal(
                    "document_error",
                    DocumentGenerationErrorApiRequest(
                        document_id=str(document_id) if document_id else None,
                        error_message=(
                            f"Agent did not call all required tools. "
                            f"Missing: {tool_names_str}"
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
        document_id_str_error: str | None = None
        try:
            document_id_str_error = str(document_id) if document_id else None
        except Exception:
            pass
        await emit_to_internal(
            "document_error",
            DocumentGenerationErrorApiRequest(
                document_id=document_id_str_error,
                error_message="Database connection pool not available",
            ),
            sid=sid,
        )
    except Exception as e:
        document_id_str_error: str | None = None
        try:
            document_id_str_error = str(document_id) if document_id else None
        except Exception:
            pass
        await emit_to_internal(
            "document_error",
            DocumentGenerationErrorApiRequest(
                document_id=document_id_str_error,
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
