"""Unified token factory for artifact generation.

This handler is AI-only: it performs model calls and emits progress/complete/error events.
It does NOT perform any database operations. All writes are handled by domain handlers.
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator, cast

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.artifacts import (
    convert_tools_to_openai_format,
    convert_tools_to_responses_format,
    format_messages_for_litellm,
    stream_litellm_events,
)
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.socket.v4.artifacts.tool_registry import wait_for_tool_result

# Try to import litellm
try:
    import litellm  # type: ignore
    from openai.types.responses.response_create_params import ToolChoice
    from openai.types.responses.tool_param import ToolParam

    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    ToolChoice = Any  # type: ignore
    ToolParam = Any  # type: ignore

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class ModelConfig(BaseModel):
    """Model configuration for token factory."""

    model: str
    api_key: str | None = None
    base_url: str | None = None
    temperature: float | None = None
    reasoning: str | None = None
    provider: str | None = None
    voice: str | None = None
    quality: str | None = None
    length_seconds: int | None = None
    response_format: dict[str, Any] | None = None
    tool_choice: str | ToolChoice | None = None
    extra_body: dict[str, Any] | None = None


class GenerateArtifactPayload(BaseModel):
    """Payload for generate_artifact internal event."""

    sid: str | None = None
    run_id: str
    group_id: str | None = None
    chat_id: str | None = None
    message_id: str | None = None
    modality: str = "text"
    artifact_type: str | None = None
    resource_type: str | None = None
    resource_types: list[str] | None = None
    resource_id: str | None = None
    messages: list[dict[str, Any]]
    model_config: ModelConfig
    tools: list[dict[str, Any]] | None = None
    eval_mode: bool = False
    metadata: dict[str, Any] | None = None
    tool_timeout_seconds: float = 60.0
    file_path: str | None = None
    mime_type: str | None = None
    file_size: int | None = None
    upload_id: str | None = None


def _event_name_for_modality(modality: str, phase: str) -> str:
    """Return event name for a modality/phase pair."""
    return f"generate_{modality}_{phase}"


async def _emit_modality_event(
    modality: str,
    phase: str,
    payload: dict[str, Any],
) -> None:
    """Emit a modality-scoped event, falling back to generate_error if unknown."""
    supported = {"text", "audio", "image", "video", "call"}
    if modality not in supported:
        await internal_sio.emit("generate_error", payload)
        return
    await internal_sio.emit(_event_name_for_modality(modality, phase), payload)


async def _call_llm_text_stream(
    model: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | list[ToolParam] | None = None,
    tool_choice: str | ToolChoice = "auto",
    api_key: str | None = None,
    base_url: str | None = None,
    temperature: float = 0.0,
    reasoning: str | None = None,
    metadata: dict[str, Any] | None = None,
    extra_body: dict[str, Any] | None = None,
) -> AsyncIterator[Any]:
    """Call LLM with streaming, preferring aresponses() API, falling back to acompletion()."""
    if not LITELLM_AVAILABLE:
        raise ValueError("litellm is not available")

    if not model or not model.strip():
        raise ValueError("model name is required but was empty or null")

    base_kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": True,
        "api_key": api_key,
        "temperature": temperature,
        "timeout": 120.0,
    }

    if base_url:
        base_kwargs["base_url"] = base_url

    if tools:
        base_kwargs["tools"] = tools
        base_kwargs["tool_choice"] = tool_choice

    merged_extra_body: dict[str, Any] | None = None
    if reasoning:
        merged_extra_body = {"reasoning": reasoning}

    if extra_body:
        merged_extra_body = {**(merged_extra_body or {}), **extra_body}

    if merged_extra_body:
        base_kwargs["extra_body"] = merged_extra_body

    if metadata:
        extra_headers: dict[str, str] = {}
        if metadata.get("trace_id"):
            extra_headers["OpenAI-Trace-Id"] = str(metadata["trace_id"])
        if metadata.get("run_id"):
            extra_headers["X-Run-Id"] = str(metadata["run_id"])
        if extra_headers:
            base_kwargs["extra_headers"] = extra_headers

    try:
        if hasattr(litellm, "aresponses"):
            responses_kwargs: dict[str, Any] = {
                "input": messages,
                "model": model,
                "stream": True,
                "api_key": api_key,
                "temperature": temperature,
                "timeout": 120.0,
            }
            if base_url:
                responses_kwargs["base_url"] = base_url

            if tools:
                validated_tools: list[dict[str, Any]] = []
                for tool in tools:
                    tool_dict: dict[str, Any] | None = None
                    if isinstance(tool, dict):
                        tool_dict = cast(dict[str, Any], tool)
                    elif hasattr(tool, "model_dump"):
                        tool_dict = tool.model_dump()
                    elif hasattr(tool, "dict"):
                        tool_dict = tool.dict()
                    if not tool_dict:
                        continue
                    if tool_dict.get("type") == "function" and "name" in tool_dict:
                        tool_copy = {**tool_dict}
                        if tool_copy.get("strict") and isinstance(
                            tool_copy.get("parameters"), dict
                        ):
                            tool_copy["parameters"] = {
                                **tool_copy["parameters"],
                                "additionalProperties": False,
                            }
                        validated_tools.append(tool_copy)
                    elif tool_dict.get("type") == "function" and "function" in tool_dict:
                        func = tool_dict.get("function")
                        if isinstance(func, dict) and func.get("name"):
                            validated_tools.append(
                                {
                                    "type": "function",
                                    "name": func.get("name"),
                                    "parameters": func.get("parameters", {}),
                                    "description": func.get("description"),
                                    "strict": func.get("strict"),
                                }
                            )
                responses_kwargs["tools"] = validated_tools
                responses_kwargs["tool_choice"] = tool_choice

            if merged_extra_body:
                responses_kwargs["extra_body"] = merged_extra_body

            return await litellm.aresponses(**responses_kwargs)  # type: ignore
    except Exception:
        pass

    return await litellm.acompletion(**base_kwargs)  # type: ignore


async def _generate_artifact_impl(
    sid: str,
    data: GenerateArtifactPayload,
    profile_id: str | None,
) -> None:
    """Pure token factory: stream model outputs and emit progress/complete/error events."""
    try:
        resource_type = data.resource_type
        if not resource_type and data.resource_types:
            resource_type = data.resource_types[0]

        messages = format_messages_for_litellm(data.messages)

        model_config = data.model_config
        extra_body: dict[str, Any] = {}
        if model_config.voice is not None:
            extra_body["voice"] = model_config.voice
        if model_config.quality is not None:
            extra_body["quality"] = model_config.quality
        if model_config.length_seconds is not None:
            extra_body["length_seconds"] = model_config.length_seconds
        if model_config.response_format is not None:
            extra_body["response_format"] = model_config.response_format
        if model_config.provider is not None:
            extra_body["provider"] = model_config.provider
        if model_config.extra_body:
            extra_body.update(model_config.extra_body)

        openai_tools = None
        responses_tools = None
        if data.tools:
            openai_tools = convert_tools_to_openai_format(data.tools)
            responses_tools = convert_tools_to_responses_format(data.tools)

        tool_choice = model_config.tool_choice or "auto"

        metadata = {
            "run_id": data.run_id,
            "trace_id": (data.metadata or {}).get("trace_id"),
            "group_id": data.group_id,
            "resource_type": resource_type,
        }

        await _emit_modality_event(
            data.modality,
            "start",
            {
                "modality": data.modality,
                "sid": sid,
                "artifact_type": data.artifact_type,
                "resource_type": resource_type,
                "resource_id": data.resource_id,
                "run_id": data.run_id,
                "group_id": data.group_id,
                "chat_id": data.chat_id,
                "message_id": data.message_id,
                "type": "start",
                "message": "Starting generation",
                "eval_mode": data.eval_mode,
            },
        )

        if data.modality in ("image", "video"):
            if not data.file_path:
                await _emit_modality_event(
                    data.modality,
                    "error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Missing file_path for media generation",
                        artifact_type=data.artifact_type,
                        group_id=data.group_id,
                        resource_type=resource_type,
                        resource_id=data.resource_id,
                    ).model_dump(),
                )
                return

            await _emit_modality_event(
                data.modality,
                "complete",
                {
                    "modality": data.modality,
                    "sid": sid,
                    "artifact_type": data.artifact_type,
                    "type": "complete",
                    "event_type": "media_complete",
                    "resource_type": resource_type,
                    "resource_id": data.resource_id,
                    "run_id": data.run_id,
                    "group_id": data.group_id,
                    "chat_id": data.chat_id,
                    "message_id": data.message_id,
                    "file_path": data.file_path,
                    "mime_type": data.mime_type,
                    "file_size": data.file_size,
                    "upload_id": data.upload_id,
                    "eval_mode": data.eval_mode,
                },
            )
            return

        stream = _call_llm_text_stream(
            model=model_config.model,
            messages=messages,
            tools=responses_tools if responses_tools else (openai_tools if openai_tools else None),
            tool_choice=tool_choice,
            api_key=model_config.api_key,
            base_url=model_config.base_url,
            temperature=model_config.temperature or 0.0,
            reasoning=model_config.reasoning,
            metadata=metadata,
            extra_body=extra_body or None,
        )

        assistant_output = ""
        input_tokens = 0
        output_tokens = 0
        tool_call_states: dict[str, dict[str, Any]] = {}
        tool_results: list[dict[str, Any]] = []

        async for event in stream_litellm_events(stream):
            event_type = event.get("type")

            if event_type == "text_start":
                await _emit_modality_event(
                    "text",
                    "start",
                    {
                        "modality": data.modality,
                        "sid": sid,
                        "artifact_type": data.artifact_type,
                        "resource_type": resource_type,
                        "run_id": data.run_id,
                        "group_id": data.group_id,
                        "chat_id": data.chat_id,
                        "message_id": data.message_id,
                        "type": "start",
                        "event_type": "text_start",
                        "eval_mode": data.eval_mode,
                    },
                )

            elif event_type == "text_delta":
                delta = event.get("delta", "")
                if delta:
                    assistant_output += delta
                    await _emit_modality_event(
                        "text",
                        "progress",
                        {
                            "modality": data.modality,
                            "sid": sid,
                            "artifact_type": data.artifact_type,
                            "resource_type": resource_type,
                            "run_id": data.run_id,
                            "group_id": data.group_id,
                            "chat_id": data.chat_id,
                            "message_id": data.message_id,
                            "type": "progress",
                            "event_type": "text_delta",
                            "delta": delta,
                            "accumulated_content": assistant_output,
                            "eval_mode": data.eval_mode,
                        },
                    )

            elif event_type == "text_complete":
                assistant_output = event.get("text", assistant_output)
                await _emit_modality_event(
                    "text",
                    "complete",
                    {
                        "modality": data.modality,
                        "sid": sid,
                        "artifact_type": data.artifact_type,
                        "resource_type": resource_type,
                        "run_id": data.run_id,
                        "group_id": data.group_id,
                        "chat_id": data.chat_id,
                        "message_id": data.message_id,
                        "type": "complete",
                        "event_type": "text_complete",
                        "text": assistant_output,
                        "eval_mode": data.eval_mode,
                    },
                )

            elif event_type == "tool_call_start":
                tool_call_id = cast(str, event.get("tool_call_id"))
                tool_call_states.setdefault(
                    tool_call_id,
                    {
                        "call_id": tool_call_id,
                        "tool_name": None,
                        "arguments": "",
                    },
                )
                await _emit_modality_event(
                    "call",
                    "start",
                    {
                        "modality": "call",
                        "sid": sid,
                        "artifact_type": data.artifact_type,
                        "resource_type": resource_type,
                        "run_id": data.run_id,
                        "group_id": data.group_id,
                        "chat_id": data.chat_id,
                        "message_id": data.message_id,
                        "type": "start",
                        "event_type": "tool_call_start",
                        "tool_call_id": tool_call_id,
                        "eval_mode": data.eval_mode,
                    },
                )

            elif event_type == "tool_call_delta":
                tool_call_id = cast(str, event.get("tool_call_id"))
                delta = event.get("delta", "") or ""
                tool_name = event.get("tool_name")
                st = tool_call_states.setdefault(
                    tool_call_id,
                    {
                        "call_id": tool_call_id,
                        "tool_name": None,
                        "arguments": "",
                    },
                )
                if tool_name and not st["tool_name"]:
                    st["tool_name"] = tool_name
                st["arguments"] += delta
                await _emit_modality_event(
                    "call",
                    "progress",
                    {
                        "modality": "call",
                        "sid": sid,
                        "artifact_type": data.artifact_type,
                        "resource_type": resource_type,
                        "run_id": data.run_id,
                        "group_id": data.group_id,
                        "chat_id": data.chat_id,
                        "message_id": data.message_id,
                        "type": "progress",
                        "event_type": "tool_call_delta",
                        "tool_call_id": tool_call_id,
                        "delta": delta,
                        "tool_name": st.get("tool_name"),
                        "arguments_delta": delta,
                        "eval_mode": data.eval_mode,
                    },
                )

            elif event_type == "tool_call_complete":
                tool_call_id = cast(str, event.get("tool_call_id"))
                tool_name = (
                    event.get("name")
                    or tool_call_states.get(tool_call_id, {}).get("tool_name")
                    or ""
                )
                st = tool_call_states.get(tool_call_id, {})
                arguments_str = event.get("arguments") or st.get("arguments", "")

                try:
                    arguments_dict = json.loads(arguments_str) if arguments_str else {}
                except json.JSONDecodeError:
                    arguments_dict = {}

                await _emit_modality_event(
                    "call",
                    "complete",
                    {
                        "modality": "call",
                        "sid": sid,
                        "artifact_type": data.artifact_type,
                        "resource_type": resource_type,
                        "run_id": data.run_id,
                        "group_id": data.group_id,
                        "chat_id": data.chat_id,
                        "message_id": data.message_id,
                        "type": "complete",
                        "event_type": "tool_call_complete",
                        "tool_call_id": tool_call_id,
                        "tool_name": tool_name,
                        "arguments": arguments_dict,
                        "arguments_delta": arguments_str,
                        "call_id": tool_call_id,
                        "eval_mode": data.eval_mode,
                    },
                )

                await internal_sio.emit(
                    "tool_call",
                    {
                        "sid": sid,
                        "artifact_type": data.artifact_type,
                        "resource_type": resource_type,
                        "run_id": data.run_id,
                        "group_id": data.group_id,
                        "chat_id": data.chat_id,
                        "message_id": data.message_id,
                        "call_id": tool_call_id,
                        "tool_call_id": tool_call_id,
                        "tool_name": tool_name,
                        "arguments": arguments_dict,
                        "eval_mode": data.eval_mode,
                    },
                )

                tool_result = await wait_for_tool_result(
                    tool_call_id, data.tool_timeout_seconds
                )
                if tool_result is None:
                    await _emit_modality_event(
                        data.modality,
                        "error",
                        GenerateErrorApiRequest(
                            sid=sid,
                            error_message=f"Tool result timeout for {tool_name}",
                            artifact_type=data.artifact_type,
                            group_id=data.group_id,
                            resource_type=resource_type,
                        ).model_dump(),
                    )
                    return

                tool_results.append(tool_result)
                await _emit_modality_event(
                    "call",
                    "complete",
                    {
                        "modality": "call",
                        "sid": sid,
                        "artifact_type": data.artifact_type,
                        "resource_type": resource_type,
                        "run_id": data.run_id,
                        "group_id": data.group_id,
                        "chat_id": data.chat_id,
                        "message_id": data.message_id,
                        "type": "complete",
                        "event_type": "tool_result",
                        "tool_call_id": tool_call_id,
                        "tool_name": tool_name,
                        "result": tool_result,
                        "eval_mode": data.eval_mode,
                    },
                )

            elif event_type == "message_complete":
                usage_data = event.get("usage")
                if isinstance(usage_data, dict):
                    input_tokens = usage_data.get("prompt_tokens", 0) or 0
                    output_tokens = usage_data.get("completion_tokens", 0) or 0

        await _emit_modality_event(
            data.modality,
            "complete",
            {
                "modality": data.modality,
                "sid": sid,
                "artifact_type": data.artifact_type,
                "type": "complete",
                "event_type": "run_complete",
                "resource_type": resource_type,
                "run_id": data.run_id,
                "group_id": data.group_id,
                "chat_id": data.chat_id,
                "message_id": data.message_id,
                "input_text_tokens": input_tokens,
                "output_text_tokens": output_tokens,
                "assistant_output": assistant_output,
                "tool_results": tool_results,
                "eval_mode": data.eval_mode,
            },
        )

    except Exception as e:
        await _emit_modality_event(
            data.modality,
            "error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Token factory error: {str(e)}",
                artifact_type=data.artifact_type,
                group_id=data.group_id,
                resource_type=data.resource_type,
            ).model_dump(),
        )


@internal_sio.on("generate_artifact")  # type: ignore
async def generate_artifact_internal(data: dict[str, Any]) -> None:
    """Handle generate_artifact event from internal bus (server-to-server)."""
    sid = data.get("sid", "")
    if not sid:
        return
    try:
        payload = GenerateArtifactPayload(**data)
    except Exception as e:
        await internal_sio.emit(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid generate_artifact payload: {str(e)}",
                artifact_type=data.get("artifact_type"),
                group_id=data.get("group_id"),
                resource_type=data.get("resource_type"),
            ).model_dump(),
        )
        return

    profile_id = await find_profile_by_socket(sid)
    await _generate_artifact_impl(sid, payload, profile_id)
