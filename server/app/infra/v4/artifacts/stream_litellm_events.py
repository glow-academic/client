"""Parse litellm streaming chunks into structured events."""

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

    Yields events:
    - text_start: First text delta received
    - text_delta: Incremental text content
    - text_complete: Text streaming complete
    - tool_call_start: Tool call started (with stable tool_call_id)
    - tool_call_delta: Incremental tool call arguments (with stable tool_call_id)
    - tool_call_complete: Tool call complete (with stable tool_call_id)
    - message_complete: Message complete with finish_reason

    Args:
        stream: AsyncIterator from litellm.acompletion(stream=True)

    Yields:
        Event dictionaries with 'type' and relevant fields
    """
    choices: dict[int, ChoiceState] = {}

    def get_choice_state(choice_index: int) -> ChoiceState:
        if choice_index not in choices:
            choices[choice_index] = ChoiceState()
        return choices[choice_index]

    def stable_tool_key(choice_index: int, tool_index: int) -> str:
        # stable even if provider omits tool_call_id
        return f"choice_{choice_index}_tool_{tool_index}"

    async for chunk in stream:
        # Normalize chunk choices
        if hasattr(chunk, "choices"):
            chunk_choices = chunk.choices
        elif isinstance(chunk, dict):
            chunk_choices = chunk.get("choices", [])
        else:
            continue

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
                            "completion_tokens": getattr(
                                usage_obj, "completion_tokens", 0
                            ),
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
                            "tool_call_id": (
                                tc_state.id or stable_tool_key(i, tool_index)
                            ),
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
