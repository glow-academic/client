"""OpenAI text generation adapter - handles text generation with tool calls."""

import asyncio
import uuid
from typing import Any

from agents import (FunctionToolResult, RunContextWrapper, Runner,
                    ToolsToFinalOutputResult, trace)
from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.websocket.remove_active_run import remove_active_run
from app.infra.v4.websocket.store_active_run import store_active_run

from ...call import OpenAIToolCallAdapter
from ....base.config import AdapterConfig, AdapterEventCallbacks
from ....base.output_adapter import BaseOutputAdapter


class OpenAITextAdapter(BaseOutputAdapter):
    """OpenAI text generation adapter."""

    async def generate_output(
        self,
        sid: str,
        config: AdapterConfig,
        callbacks: AdapterEventCallbacks,
    ) -> None:
        """Generate text using OpenAI agent.

        Args:
            sid: Socket ID
            config: AdapterConfig with all necessary data (no database access)
            callbacks: Event callbacks for progress, completion, and error events
        """
        try:
            # Emit start event via callback
            await callbacks.emit_progress(
                "generate_text_start",
                {
                    "sid": sid,
                    "resource_id": str(config.resource_id) if config.resource_id else None,
                    "resource_type": config.resource_type,
                    "run_id": str(config.run_id),
                    "message": f"Starting {config.agent_name or 'text'} generation",
                },
            )

            # Create tool use behavior
            def tool_use_behavior(
                tool_context: RunContextWrapper[Any],
                tool_results: list[FunctionToolResult],
            ) -> ToolsToFinalOutputResult:
                return ToolsToFinalOutputResult(is_final_output=False)

            # Build text agent using config
            text_agent = GenericAgent(
                agent_name=config.agent_name,
                system_prompt=config.system_prompt,
                temperature=config.temperature,
                model_name=config.model_name,
                provider=config.provider,
                base_url=config.base_url,
                api_key=config.api_key,  # Already decrypted
                reasoning=config.reasoning,
                tools=config.tools,  # Already built
                parallel_tool_calls=False,
                tool_use_behavior=tool_use_behavior,
            )

            # Run text generation with streaming
            resource_id_str = str(config.group_id) if config.group_id else sid
            with trace(
                f"{config.agent_name or 'Text'} Agent",
                trace_id=config.trace_id,
                group_id=resource_id_str,
            ):
                # Note: DebugContext still needs conn, but adapter doesn't have it
                # This will need to be passed from generate.py or removed
                result_runner = Runner.run_streamed(
                    text_agent.agent(),
                    config.input_items,  # Already formatted
                    context=None,  # DebugContext removed - will need to handle differently
                )

            # Store the result in active runs for potential cancellation
            await store_active_run(resource_id_str, result_runner)

            try:
                # Use tool call adapter
                tool_call_adapter = OpenAIToolCallAdapter()
                completed_tool_names = await tool_call_adapter.stream_tool_calls(
                    runner=result_runner,
                    sid=sid,
                    resource_id=str(config.resource_id) if config.resource_id else None,
                    resource_type=config.resource_type,
                    run_id=config.run_id,
                    group_id=config.group_id,
                    tool_name_to_type=config.tool_name_to_type,
                    required_tool_names=config.required_tool_names,
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
            missing_tools = config.required_tool_names - completed_tool_names
            if missing_tools:
                tool_names_str = ", ".join(sorted(missing_tools))
                await callbacks.emit_error(
                    "generate_error",
                    {
                        "sid": sid,
                        "error_message": (
                            f"Agent did not call all required tools. "
                            f"Missing: {tool_names_str}"
                        ),
                        "resource_id": str(config.resource_id) if config.resource_id else None,
                        "group_id": str(config.group_id) if config.group_id else None,
                        "resource_type": config.resource_type,
                    },
                )
                return

            # Emit run completion event with usage data
            usage = result_runner.context_wrapper.usage
            assistant_output = getattr(result_runner, "final_output", None) or ""
            await callbacks.emit_complete(
                "generate_text_complete",
                {
                    "sid": sid,
                    "type": "run_complete",
                    "resource_id": str(config.resource_id) if config.resource_id else None,
                    "resource_type": config.resource_type,
                    "run_id": str(config.run_id),
                    "group_id": str(config.group_id) if config.group_id else None,
                    "department_id": str(config.department_id) if config.department_id else None,
                    "input_text_tokens": usage.input_tokens,
                    "output_text_tokens": usage.output_tokens,
                    "system_prompt": config.system_prompt,
                    "input_items": config.input_items,
                    "assistant_output": assistant_output,
                },
            )

        except RuntimeError:
            await callbacks.emit_error(
                "generate_error",
                {
                    "sid": sid,
                    "error_message": "Database connection pool not available",
                    "resource_id": str(config.resource_id) if config.resource_id else None,
                    "group_id": None,
                    "resource_type": config.resource_type,
                },
            )
        except Exception as e:
            await callbacks.emit_error(
                "generate_error",
                {
                    "sid": sid,
                    "error_message": str(e),
                    "resource_id": str(config.resource_id) if config.resource_id else None,
                    "group_id": None,
                    "resource_type": config.resource_type,
                },
            )
