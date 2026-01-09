"""OpenAI tool call streaming adapter - handles streaming tool call events."""

import uuid
from typing import Any

from app.infra.v4.agents.stream_agent_events import (
    StreamEventCallbacks,
    stream_agent_events,
)
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio

from ....base.output_adapter import BaseOutputAdapter

internal_sio = get_internal_sio()


class OpenAIToolCallAdapter(BaseOutputAdapter):
    """Handles streaming tool calls for OpenAI agents."""

    async def stream_tool_calls(
        self,
        runner: Any,
        sid: str,
        resource_id: str | None,
        resource_type: str,
        run_id: uuid.UUID,
        group_id: uuid.UUID | None,
        tool_name_to_type: dict[str, str],
        required_tool_names: set[str],
    ) -> set[str]:
        """Stream tool calls - returns unified result types.

        Args:
            runner: Runner instance from Runner.run_streamed()
            sid: Socket ID
            resource_id: Resource ID (optional)
            resource_type: Resource type (agent_role)
            run_id: Model run ID
            group_id: Group ID (optional)
            tool_name_to_type: Mapping from tool name to tool type
            required_tool_names: Set of required tool names to verify completion

        Returns:
            Set of completed tool names
        """
        # Track tool call state
        tool_call_id_to_name: dict[str, str] = {}
        tool_call_id_to_call_id: dict[str, str | None] = {}
        completed_tool_names: set[str] = set()

        # Define callbacks for tool call events
        async def on_start(
            tool_call_id: str, tool_name: str, call_id: str | None
        ) -> None:
            tool_call_id_to_name[tool_call_id] = tool_name
            tool_call_id_to_call_id[tool_call_id] = call_id
            await internal_sio.emit(
                "generate_text_progress",
                {
                    "sid": sid,
                    "progress_type": "tool_call_start",
                    "resource_id": resource_id,
                    "resource_type": resource_type,
                    "run_id": str(run_id),
                    "tool_call_id": tool_call_id,
                    "call_id": call_id or tool_call_id or "",
                    "tool_name": tool_name or "",
                    "arguments_delta": "",  # Empty for start
                },
            )

        async def on_progress(tool_call_id: str, arguments_delta: str) -> None:
            # For progress events, call_id and tool_name may be None - SQL will look them up
            await internal_sio.emit(
                "generate_text_progress",
                {
                    "sid": sid,
                    "progress_type": "tool_call_progress",
                    "resource_id": resource_id,
                    "resource_type": resource_type,
                    "run_id": str(run_id),
                    "tool_call_id": tool_call_id,
                    "call_id": None,  # SQL will look it up
                    "tool_name": None,  # SQL will look it up
                    "arguments_delta": arguments_delta,  # Delta - SQL accumulates
                },
            )

        async def on_complete(
            tool_call_id: str, final_args: dict[str, Any]
        ) -> None:
            tool_name = tool_call_id_to_name.get(tool_call_id, "")
            if tool_name:
                completed_tool_names.add(tool_name)

            # Get call_id from stored mapping
            call_id = tool_call_id_to_call_id.get(tool_call_id)

            # Map tool_name to tool_type from database result
            tool_type: str | None = (
                tool_name_to_type.get(tool_name) if tool_name else None
            )

            await internal_sio.emit(
                "generate_text_complete",
                {
                    "sid": sid,
                    "type": "tool_call_complete",
                    "resource_id": resource_id,
                    "resource_type": resource_type,
                    "run_id": str(run_id),
                    "group_id": str(group_id) if group_id else None,
                    "tool_call_id": tool_call_id,
                    "call_id": call_id or tool_call_id or "",
                    "tool_name": tool_name or "",
                    "tool_type": tool_type,
                    "final_content": str(final_args),
                    "arguments_raw": "",  # Will be retrieved from SQL if needed
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
            return f"text_{uuid.uuid4().hex[:16]}"

        await stream_agent_events(runner, callbacks, tool_call_id_generator)

        return completed_tool_names

    async def generate_output(
        self,
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID,
        conn: Any,
    ) -> set[str]:
        """Generate tool calls - returns set of completed tool names.

        This is called by the text adapter, not directly by generate.py.
        """
        # This method is not used directly - stream_tool_calls is called by text adapter
        raise NotImplementedError(
            "Tool call adapter is used via stream_tool_calls method, not generate_output"
        )
