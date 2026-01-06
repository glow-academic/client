"""OpenAI text generation adapter - handles text generation with tool calls."""

import asyncio
import uuid
from typing import Any, cast

from agents import (FunctionToolResult, RunContextWrapper, Runner, Tool,
                    ToolsToFinalOutputResult, trace)
from agents.items import TResponseInputItem
from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.tools.build_tool_from_config import build_tool_from_config
from app.infra.v4.websocket.remove_active_run import remove_active_run
from app.infra.v4.websocket.store_active_run import store_active_run
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import UPLOAD_FOLDER, get_internal_sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.sql.types import (GetMessagesByIdsSqlParams, GetMessagesByIdsSqlRow,
                           GetMessagesByRunIdSqlParams,
                           GetMessagesByRunIdSqlRow,
                           GetTextRunContextForExistingRunSqlParams,
                           GetTextRunContextForExistingRunSqlRow)
from utils.sql_helper import execute_sql_typed

from ..tool_call.openai import OpenAIToolCallAdapter
from .base import BaseTextAdapter

internal_sio = get_internal_sio()

SQL_PATH = "app/sql/v4/generate/text/get_text_run_context_for_existing_run_complete.sql"
SQL_PATH_MESSAGES_BY_IDS = "app/sql/v4/messages/get_messages_by_ids_complete.sql"
SQL_PATH_MESSAGES_BY_RUN = "app/sql/v4/messages/get_messages_by_run_id_complete.sql"


class OpenAITextAdapter(BaseTextAdapter):
    """OpenAI text generation adapter."""

    async def generate(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID,
        conn: Any,
    ) -> None:
        """Generate text using OpenAI agent.

        Args:
            sid: Socket ID
            data: Request data containing run_id, agent_id, resource_id, etc.
            profile_id: Profile ID
            conn: Database connection
        """
        trace_id: str | None = None
        group_id: uuid.UUID | None = None

        try:
            # Get context data for existing run (run already created in generate/start.py)
            try:
                # Convert message_ids to UUID array if provided
                message_ids_uuid = (
                    [uuid.UUID(mid) for mid in data.get("message_ids", [])]
                    if data.get("message_ids")
                    else None
                )

                params = GetTextRunContextForExistingRunSqlParams(
                    run_id=uuid.UUID(data["run_id"]),
                    agent_id=uuid.UUID(data["agent_id"]),
                    resource_id=uuid.UUID(data["resource_id"]),
                    resource_type=data["resource_type"],
                    message_ids=message_ids_uuid,
                    group_id=uuid.UUID(data["group_id"]) if data.get("group_id") else None,
                )
                result = cast(
                    GetTextRunContextForExistingRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Failed to initialize text generation: {str(e)}",
                        resource_id=str(data.get("resource_id")) if data.get("resource_id") else None,
                        group_id=data.get("group_id"),
                        resource_type=data.get("resource_type"),
                    ),
                    sid=sid,
                )
                return

            if not result:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Run not found or no agent configured",
                        resource_id=str(data.get("resource_id")) if data.get("resource_id") else None,
                        group_id=data.get("group_id"),
                        resource_type=data.get("resource_type"),
                    ),
                    sid=sid,
                )
                return

            # result.group_id and result.trace_id come from groups table
            trace_id = result.trace_id  # From groups.trace_id
            group_id = result.group_id  # From groups table

            # Extract run_id from data (already created in generate/start.py)
            model_run_id = uuid.UUID(data["run_id"])

            # Emit start event via internal bus
            await internal_sio.emit(
                "generate_text_start",
                {
                    "sid": sid,
                    "resource_id": str(data.get("resource_id")) if data.get("resource_id") else None,
                    "resource_type": data.get("resource_type"),
                    "run_id": str(model_run_id),
                    "message": f"Starting {result.agent_name or 'text'} generation",
                },
            )

            # Get tools from SQL result (composite type array)
            agent_tools_config = [
                tool for tool in (result.tools or []) if tool.name is not None
            ]

            # Build tools from database configs using generic helper
            text_tools: list[Tool] = []
            for tool in agent_tools_config:
                if tool.name is None:
                    continue
                try:
                    tool_config = {
                        "id": str(tool.id),
                        "name": tool.name,
                        "description": tool.description or "",
                        "tool_type": tool.tool_type or "",
                        "agent_role": tool.agent_role or "",
                        "arguments": tool.arguments,
                        "argument_descriptions": tool.argument_descriptions,
                        "argument_defaults": tool.argument_defaults,
                        "active": tool.active,
                    }
                    built_tool = build_tool_from_config(tool_config)
                    text_tools.append(built_tool)
                except Exception as e:
                    import logging

                    logging.getLogger(__name__).warning(
                        f"Failed to build tool {tool.name}: {e}"
                    )

            # Create tool use behavior
            def tool_use_behavior(
                tool_context: RunContextWrapper[Any],
                tool_results: list[FunctionToolResult],
            ) -> ToolsToFinalOutputResult:
                return ToolsToFinalOutputResult(is_final_output=False)

            # Build text agent
            text_agent = GenericAgent(
                agent_name=result.agent_name or "",
                system_prompt=result.system_prompt or "",
                temperature=result.temperature or 0.0,
                model_name=result.model_name or "",
                provider=result.provider or "",
                base_url=result.base_url,
                api_key=result.api_key or "",
                reasoning=result.reasoning,
                tools=text_tools,
                parallel_tool_calls=False,
                tool_use_behavior=tool_use_behavior,
            )

            # Construct input items for the agent
            input_items: list[TResponseInputItem] = []

            # Handle audio input if upload_id is provided
            if result.upload_id and result.file_path:
                audio_file_path = UPLOAD_FOLDER / result.file_path
                if audio_file_path.exists():
                    audio_input: TResponseInputItem = {
                        "role": "user",
                        "content": f"Audio file to process: {audio_file_path}",
                    }
                    input_items.append(audio_input)

            # Get all messages linked to the run (system/developer messages from previous runs)
            try:
                run_messages_params = GetMessagesByRunIdSqlParams(run_id=model_run_id)
                run_messages_result = cast(
                    GetMessagesByRunIdSqlRow,
                    await execute_sql_typed(conn, SQL_PATH_MESSAGES_BY_RUN, params=run_messages_params),
                )
                if run_messages_result.messages:
                    for msg in run_messages_result.messages:
                        if msg.role in ("system", "developer"):
                            input_items.append({
                                "role": msg.role,
                                "content": msg.content or "",
                            })
            except Exception as e:
                import logging

                logging.getLogger(__name__).warning(f"Failed to fetch run messages: {e}")

            # Get messages from message_ids (user regeneration message + context messages)
            if data.get("message_ids"):
                try:
                    messages_params = GetMessagesByIdsSqlParams(
                        message_ids=[uuid.UUID(mid) for mid in data["message_ids"]]
                    )
                    messages_result = cast(
                        GetMessagesByIdsSqlRow,
                        await execute_sql_typed(conn, SQL_PATH_MESSAGES_BY_IDS, params=messages_params),
                    )
                    if messages_result.messages:
                        for msg in messages_result.messages:
                            if msg.role not in ("system", "developer"):
                                input_items.append({
                                    "role": msg.role,
                                    "content": msg.content or "",
                                })
                except Exception as e:
                    import logging

                    logging.getLogger(__name__).warning(f"Failed to fetch messages by IDs: {e}")

            # Track completed tool names for verification
            required_tool_names: set[str] = {
                tool.name for tool in agent_tools_config if tool.name is not None
            }
            tool_name_to_type: dict[str, str] = {
                tool.name: tool.tool_type
                for tool in agent_tools_config
                if tool.name is not None and tool.tool_type is not None
            }

            # Run text generation with streaming
            resource_id_str = str(data.get("resource_id")) if data.get("resource_id") else sid
            with trace(
                f"{result.agent_name or 'Text'} Agent",
                trace_id=trace_id,
                group_id=resource_id_str,
            ):
                result_runner = Runner.run_streamed(
                    text_agent.agent(),
                    input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Store the result in active runs for potential cancellation
            await store_active_run(resource_id_str, result_runner)

            try:
                # Use tool call adapter
                tool_call_adapter = OpenAIToolCallAdapter()
                completed_tool_names = await tool_call_adapter.stream_tool_calls(
                    runner=result_runner,
                    sid=sid,
                    resource_id=str(data.get("resource_id")) if data.get("resource_id") else None,
                    resource_type=data.get("resource_type", ""),
                    run_id=model_run_id,
                    group_id=group_id,
                    tool_name_to_type=tool_name_to_type,
                    required_tool_names=required_tool_names,
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
                await remove_active_run(resource_id_str)

            # Verify all required tools were called
            missing_tools = required_tool_names - completed_tool_names
            if missing_tools:
                tool_names_str = ", ".join(sorted(missing_tools))
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=(
                            f"Agent did not call all required tools. "
                            f"Missing: {tool_names_str}"
                        ),
                        resource_id=str(data.get("resource_id")) if data.get("resource_id") else None,
                        group_id=str(group_id) if group_id else None,
                        resource_type=data.get("resource_type"),
                    ),
                    sid=sid,
                )
                return

            # Emit run completion event with usage data
            usage = result_runner.context_wrapper.usage
            assistant_output = getattr(result_runner, "final_output", None) or ""
            await internal_sio.emit(
                "generate_text_complete",
                {
                    "sid": sid,
                    "type": "run_complete",
                    "resource_id": str(data.get("resource_id")) if data.get("resource_id") else None,
                    "resource_type": data.get("resource_type"),
                    "run_id": str(model_run_id),
                    "group_id": str(group_id) if group_id else None,
                    "department_id": str(data.get("department_id")) if data.get("department_id") else None,
                    "input_text_tokens": usage.input_tokens,
                    "output_text_tokens": usage.output_tokens,
                    "system_prompt": result.system_prompt,
                    "input_items": input_items,
                    "assistant_output": assistant_output,
                },
            )

        except RuntimeError:
            await internal_sio.emit(
                "generate_error",
                {
                    "sid": sid,
                    "error_message": "Database connection pool not available",
                    "resource_id": str(data.get("resource_id")) if data.get("resource_id") else None,
                    "group_id": None,
                    "resource_type": data.get("resource_type"),
                },
            )
        except Exception as e:
            await internal_sio.emit(
                "generate_error",
                {
                    "sid": sid,
                    "error_message": str(e),
                    "resource_id": str(data.get("resource_id")) if data.get("resource_id") else None,
                    "group_id": None,
                    "resource_type": data.get("resource_type"),
                },
            )

