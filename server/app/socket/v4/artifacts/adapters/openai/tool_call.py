"""OpenAI tool call streaming adapter - handles streaming tool call events."""

import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from app.infra.v4.agents.stream_agent_events import (StreamEventCallbacks,
                                                     stream_agent_events)


class ToolCallStreamer:
    """Handles streaming tool calls for OpenAI agents."""

    def __init__(
        self,
        sid: str,
        resource_id: str | None,
        resource_type: str,
        run_id: uuid.UUID,
        group_id: uuid.UUID | None,
        internal_sio: Any,
        tool_name_to_type: dict[str, str],
    ):
        """Initialize tool call streamer.

        Args:
            sid: Socket ID
            resource_id: Resource ID (optional)
            resource_type: Resource type (agent_role)
            run_id: Model run ID
            group_id: Group ID (optional)
            internal_sio: Internal Socket.IO instance for emitting events
            tool_name_to_type: Mapping from tool name to tool type
        """
        self.sid = sid
        self.resource_id = resource_id
        self.resource_type = resource_type
        self.run_id = run_id
        self.group_id = group_id
        self.internal_sio = internal_sio
        self.tool_name_to_type = tool_name_to_type

        # Track tool call state
        self.tool_call_id_to_name: dict[str, str] = {}
        self.tool_call_id_to_call_id: dict[str, str | None] = {}
        self.completed_tool_names: set[str] = set()

    async def stream(
        self,
        result_runner: Any,
        required_tool_names: set[str],
    ) -> set[str]:
        """Stream tool call events from agent runner.

        Args:
            result_runner: Runner instance from Runner.run_streamed()
            required_tool_names: Set of required tool names to verify completion

        Returns:
            Set of completed tool names
        """
        # Define callbacks for tool call events
        async def on_start(
            tool_call_id: str, tool_name: str, call_id: str | None
        ) -> None:
            self.tool_call_id_to_name[tool_call_id] = tool_name
            self.tool_call_id_to_call_id[tool_call_id] = call_id
            await self.internal_sio.emit(
                "generate_text_progress",
                {
                    "sid": self.sid,
                    "progress_type": "tool_call_start",
                    "resource_id": self.resource_id,
                    "resource_type": self.resource_type,
                    "run_id": str(self.run_id),
                    "tool_call_id": tool_call_id,
                    "call_id": call_id or tool_call_id or "",
                    "tool_name": tool_name or "",
                    "arguments_delta": "",  # Empty for start
                },
            )

        async def on_progress(tool_call_id: str, arguments_delta: str) -> None:
            # For progress events, call_id and tool_name may be None - SQL will look them up
            await self.internal_sio.emit(
                "generate_text_progress",
                {
                    "sid": self.sid,
                    "progress_type": "tool_call_progress",
                    "resource_id": self.resource_id,
                    "resource_type": self.resource_type,
                    "run_id": str(self.run_id),
                    "tool_call_id": tool_call_id,
                    "call_id": None,  # SQL will look it up
                    "tool_name": None,  # SQL will look it up
                    "arguments_delta": arguments_delta,  # Delta - SQL accumulates
                },
            )

        async def on_complete(
            tool_call_id: str, final_args: dict[str, Any]
        ) -> None:
            tool_name = self.tool_call_id_to_name.get(tool_call_id, "")
            if tool_name:
                self.completed_tool_names.add(tool_name)

            # Get call_id from stored mapping
            call_id = self.tool_call_id_to_call_id.get(tool_call_id)

            # Map tool_name to tool_type from database result
            tool_type: str | None = (
                self.tool_name_to_type.get(tool_name) if tool_name else None
            )

            await self.internal_sio.emit(
                "generate_text_complete",
                {
                    "sid": self.sid,
                    "type": "tool_call_complete",
                    "resource_id": self.resource_id,
                    "resource_type": self.resource_type,
                    "run_id": str(self.run_id),
                    "group_id": str(self.group_id) if self.group_id else None,
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

        await stream_agent_events(result_runner, callbacks, tool_call_id_generator)

        return self.completed_tool_names

