"""Parse litellm streaming chunks into structured events.

Handles both completions() API (choices-based) and responses() API (response-based) formats.
Pure parsing/transformation only - no AI calls, no DB, no emits.
"""

from dataclasses import dataclass, field
from typing import Any, AsyncIterator


# ----------------------------
# Streaming parser state classes
# ----------------------------
@dataclass
class TextState:
    started: bool = False
    buffer: str = ""


@dataclass
class ToolFnState:
    name: str | None = None
    arguments: str = ""


@dataclass
class ToolCallState:
    id: str | None = None
    type: str = "function"
    function: ToolFnState = field(default_factory=ToolFnState)


@dataclass
class ChoiceState:
    text: TextState = field(default_factory=TextState)
    tool_calls: dict[int, ToolCallState] = field(default_factory=dict)
    finish_reason: str | None = None


async def stream_litellm_events(
    stream: AsyncIterator[Any],
) -> AsyncIterator[dict[str, Any]]:
    """Convert litellm streaming chunks into structured events.

    Handles both completions() API (choices-based) and responses() API (response-based).
    Normalizes both to the same event schema.

    Yields events:
    - text_start: First text delta received
    - text_delta: Incremental text content
    - text_complete: Text streaming complete
    - tool_call_start: Tool call started (with stable tool_call_id)
    - tool_call_delta: Incremental tool call arguments (with stable tool_call_id)
    - tool_call_complete: Tool call complete (with stable tool_call_id)
    - message_complete: Message complete with finish_reason

    Args:
        stream: AsyncIterator from litellm.acompletion(stream=True) or litellm.aresponses(stream=True)

    Yields:
        Event dictionaries with 'type' and relevant fields
    """
    # Detect format on first chunk
    format_detected: str | None = None
    choices: dict[int, ChoiceState] = {}
    response_items: dict[
        str, dict[str, Any]
    ] = {}  # item_id -> state for responses() format

    def get_choice_state(choice_index: int) -> ChoiceState:
        if choice_index not in choices:
            choices[choice_index] = ChoiceState()
        return choices[choice_index]

    def stable_tool_key(choice_index: int, tool_index: int) -> str:
        # stable even if provider omits tool_call_id
        return f"choice_{choice_index}_tool_{tool_index}"

    async for chunk in stream:
        # Detect format on first chunk
        if format_detected is None:
            if hasattr(chunk, "type") or (
                isinstance(chunk, dict) and chunk.get("type")
            ):
                # Responses API format (has "type" field)
                format_detected = "responses"
            elif hasattr(chunk, "choices") or (
                isinstance(chunk, dict) and "choices" in chunk
            ):
                # Completions API format (has "choices" field)
                format_detected = "completions"
            else:
                # Default to completions for backward compatibility
                format_detected = "completions"

        # Route to appropriate parser
        if format_detected == "responses":
            async for event in _parse_responses_chunk(chunk, response_items):
                yield event
        else:
            async for event in _parse_completions_chunk(
                chunk, choices, get_choice_state, stable_tool_key
            ):
                yield event

    # Emit final completion events for responses format
    if format_detected == "responses":
        # Check for any incomplete items and emit completion events
        for item_id, item_state in response_items.items():
            if item_state.get("type") == "text" and item_state.get("started"):
                yield {
                    "type": "text_complete",
                    "text": item_state.get("buffer", ""),
                }
            elif item_state.get("type") == "function_call":
                yield {
                    "type": "tool_call_complete",
                    "tool_call_id": item_id,
                    "name": item_state.get("name"),
                    "arguments": item_state.get("arguments", ""),
                }


async def _parse_responses_chunk(
    chunk: Any,
    response_items: dict[str, dict[str, Any]],
) -> AsyncIterator[dict[str, Any]]:
    """Parse responses() API format chunks.

    Responses API uses events like:
    - response.output_item.added
    - response.output_item.delta
    - response.output_item.done
    - response.done
    """
    chunk_type = None
    if hasattr(chunk, "type"):
        chunk_type = chunk.type
    elif isinstance(chunk, dict):
        chunk_type = chunk.get("type")

    if not chunk_type:
        return

    # Handle response.output_item.added
    if chunk_type == "response.output_item.added":
        item = None
        item_id = None
        if hasattr(chunk, "item"):
            item = chunk.item
            item_id = getattr(item, "id", None) or getattr(chunk, "item_id", None)
        elif isinstance(chunk, dict):
            item = chunk.get("item", {})
            item_id = item.get("id") if isinstance(item, dict) else None
            if not item_id:
                item_id = chunk.get("item_id")

        if not item_id or not item:
            return

        item_type = None
        if hasattr(item, "type"):
            item_type = item.type
        elif isinstance(item, dict):
            item_type = item.get("type")

        if item_type == "text":
            response_items[item_id] = {"type": "text", "started": True, "buffer": ""}
            yield {"type": "text_start"}
        elif item_type == "function_call":
            function_name = None
            call_id = None
            if hasattr(item, "name"):
                function_name = item.name
            elif isinstance(item, dict):
                function_name = item.get("name")
            if hasattr(item, "call_id"):
                call_id = item.call_id
            elif isinstance(item, dict):
                call_id = item.get("call_id")

            response_items[item_id] = {
                "type": "function_call",
                "name": function_name,
                "arguments": "",
                "call_id": call_id,
            }
            yield {
                "type": "tool_call_start",
                "tool_call_id": item_id,
                "tool_name": function_name,
            }

    # Handle response.output_item.delta
    elif chunk_type == "response.output_item.delta":
        item_id = None
        delta = None
        if hasattr(chunk, "item_id"):
            item_id = chunk.item_id
        elif isinstance(chunk, dict):
            item_id = chunk.get("item_id")

        if hasattr(chunk, "delta"):
            delta = chunk.delta
        elif isinstance(chunk, dict):
            delta = chunk.get("delta")

        if not item_id or item_id not in response_items:
            return

        item_state = response_items[item_id]
        if item_state.get("type") == "text" and delta:
            item_state["buffer"] = item_state.get("buffer", "") + delta
            yield {"type": "text_delta", "delta": delta}
        elif item_state.get("type") == "function_call" and delta:
            item_state["arguments"] = item_state.get("arguments", "") + delta
            yield {
                "type": "tool_call_delta",
                "tool_call_id": item_id,
                "delta": delta,
                "tool_name": item_state.get("name"),
            }

    # Handle response.output_item.done
    elif chunk_type == "response.output_item.done":
        item_id = None
        if hasattr(chunk, "item_id"):
            item_id = chunk.item_id
        elif isinstance(chunk, dict):
            item_id = chunk.get("item_id")

        if not item_id or item_id not in response_items:
            return

        item_state = response_items[item_id]
        if item_state.get("type") == "text":
            yield {
                "type": "text_complete",
                "text": item_state.get("buffer", ""),
            }
        elif item_state.get("type") == "function_call":
            yield {
                "type": "tool_call_complete",
                "tool_call_id": item_id,
                "name": item_state.get("name"),
                "arguments": item_state.get("arguments", ""),
            }

    # Handle response.done (message complete)
    elif chunk_type == "response.done":
        usage_data = None
        if hasattr(chunk, "usage"):
            usage_obj = chunk.usage
            if hasattr(usage_obj, "input_tokens"):
                usage_data = {
                    "prompt_tokens": getattr(usage_obj, "input_tokens", 0),
                    "completion_tokens": getattr(usage_obj, "output_tokens", 0),
                }
        elif isinstance(chunk, dict):
            usage = chunk.get("usage")
            if isinstance(usage, dict):
                usage_data = {
                    "prompt_tokens": usage.get(
                        "input_tokens", usage.get("prompt_tokens", 0)
                    ),
                    "completion_tokens": usage.get(
                        "output_tokens", usage.get("completion_tokens", 0)
                    ),
                }

        ev: dict[str, Any] = {
            "type": "message_complete",
            "finish_reason": "stop",
        }
        if usage_data:
            ev["usage"] = usage_data
        yield ev


async def _parse_completions_chunk(
    chunk: Any,
    choices: dict[int, ChoiceState],
    get_choice_state: Any,
    stable_tool_key: Any,
) -> AsyncIterator[dict[str, Any]]:
    """Parse completions() API format chunks (original implementation)."""
    # Normalize chunk choices
    if hasattr(chunk, "choices"):
        chunk_choices = chunk.choices
    elif isinstance(chunk, dict):
        chunk_choices = chunk.get("choices", [])
    else:
        return

    for ch in chunk_choices:
        # index
        if hasattr(ch, "index"):
            i = ch.index
        elif isinstance(ch, dict):
            i = ch.get("index", 0)
        else:
            i = 0

        st = get_choice_state(i)

        # delta
        if hasattr(ch, "delta"):
            delta = ch.delta
        elif isinstance(ch, dict):
            delta = ch.get("delta", {}) or {}
        else:
            delta = {}

        # finish_reason
        if hasattr(ch, "finish_reason"):
            finish_reason = ch.finish_reason
        elif isinstance(ch, dict):
            finish_reason = ch.get("finish_reason")
        else:
            finish_reason = None

        if not isinstance(delta, dict):
            delta = {}

        # assistant role
        if delta.get("role") == "assistant":
            yield {"type": "assistant_role", "choice_index": i}

        # -------- TEXT: start/delta
        content_piece = delta.get("content")
        if content_piece:
            if not st.text.started:
                st.text.started = True
                yield {"type": "text_start", "choice_index": i}
            st.text.buffer += content_piece
            yield {"type": "text_delta", "choice_index": i, "delta": content_piece}

        # -------- TOOLS: start/delta
        tool_calls_delta = delta.get("tool_calls") or []
        for tc in tool_calls_delta:
            if not isinstance(tc, dict):
                continue

            tool_index = tc.get("index", 0)
            if not isinstance(tool_index, int):
                tool_index = 0

            if tool_index not in st.tool_calls:
                st.tool_calls[tool_index] = ToolCallState()
                # stable id until/if provider gives real id
                tool_call_id = stable_tool_key(i, tool_index)
                yield {
                    "type": "tool_call_start",
                    "choice_index": i,
                    "tool_index": tool_index,
                    "tool_call_id": tool_call_id,
                }

            tc_state = st.tool_calls[tool_index]

            # If provider gives an ID, store it
            if tc.get("id"):
                tc_state.id = tc["id"]
            if tc.get("type"):
                tc_state.type = tc["type"]

            fn = tc.get("function") or {}
            if isinstance(fn, dict) and fn.get("name"):
                tc_state.function.name = fn["name"]

            args_piece = fn.get("arguments") if isinstance(fn, dict) else None
            if args_piece:
                tc_state.function.arguments += args_piece
                yield {
                    "type": "tool_call_delta",
                    "choice_index": i,
                    "tool_index": tool_index,
                    "tool_call_id": (tc_state.id or stable_tool_key(i, tool_index)),
                    "delta": args_piece,
                    "tool_name": tc_state.function.name,
                }

        # -------- COMPLETION
        if finish_reason is not None:
            st.finish_reason = finish_reason

            # usage extraction
            usage_data: dict[str, Any] | None = None
            if hasattr(chunk, "usage"):
                usage_obj = chunk.usage
                if hasattr(usage_obj, "prompt_tokens"):
                    usage_data = {
                        "prompt_tokens": usage_obj.prompt_tokens,
                        "completion_tokens": getattr(usage_obj, "completion_tokens", 0),
                    }
            elif isinstance(chunk, dict):
                usage_data = chunk.get("usage")

            ev: dict[str, Any] = {
                "type": "message_complete",
                "choice_index": i,
                "finish_reason": finish_reason,
            }
            if usage_data:
                ev["usage"] = usage_data
            yield ev

            # tool_call_complete for each
            if st.tool_calls:
                for tool_index, tc_state in st.tool_calls.items():
                    yield {
                        "type": "tool_call_complete",
                        "choice_index": i,
                        "tool_index": tool_index,
                        "tool_call_id": (tc_state.id or stable_tool_key(i, tool_index)),
                        "id": tc_state.id,  # raw provider id (may be None)
                        "name": tc_state.function.name,
                        "arguments": tc_state.function.arguments,
                    }

            # text_complete
            if st.text.started:
                yield {
                    "type": "text_complete",
                    "choice_index": i,
                    "text": st.text.buffer,
                }
