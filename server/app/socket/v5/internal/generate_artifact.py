"""Unified token factory for artifact generation.

This handler is AI-only: it performs model calls and emits progress/complete/error events.
It does NOT perform any database operations. All writes are handled by domain handlers.

Moved from v4/artifacts/generate.py to v5/internal/ as part of Phase 3.5.
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from collections.abc import AsyncIterator
from typing import Any, cast

from pydantic import BaseModel

from app.infra.v4.artifacts import (
    convert_tools_to_openai_format,
    convert_tools_to_responses_format,
    format_messages_for_litellm,
    stream_litellm_events,
)
from app.infra.v4.tools.tool_executor import execute_tool_call
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.types import GenerateErrorApiRequest
from app.utils.auth.decrypt_api_key import decrypt_api_key

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

logger = logging.getLogger(__name__)


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
    modality: str = "text"
    artifact_type: str | None = None
    resource_type: str | None = None
    resource_types: list[str] | None = None
    resource_id: str | None = None
    messages: list[dict[str, Any]]
    llm_config: ModelConfig
    tools: list[dict[str, Any]] | None = None
    tool_timeout_seconds: float = 60.0
    file_path: str | None = None
    save: bool = True
    mime_type: str | None = None
    file_size: int | None = None
    upload_id: str | None = None
    chat_id: str | None = None  # For audio session store, never emitted externally
    metadata: dict[str, Any] | None = (
        None  # Opaque passthrough — domain handlers read this
    )
    # Artifact tool support: needed to re-fetch context and re-render developer messages
    profile_id: str | None = None
    artifact_id: str | None = None
    draft_id: str | None = None
    developer_instruction_templates: list[str] | None = None


def _extract_template_var(template: str) -> str | None:
    """Extract variable name from a Jinja template like '{{ content }}'."""
    match = re.search(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)", template)
    return match.group(1) if match else None


def _resolve_output_fields(
    parsed_args: dict[str, Any] | None,
    tool_name: str | None,
    tool_output_schemas: dict[str, dict[str, str]],
) -> dict[str, Any] | None:
    """Resolve output schema fields from parsed tool arguments."""
    if not parsed_args or not tool_name or tool_name not in tool_output_schemas:
        return None
    schema = tool_output_schemas[tool_name]
    resolved = {
        col: parsed_args[arg] for col, arg in schema.items() if arg in parsed_args
    }
    return resolved or None


def _parse_partial_json(partial: str) -> dict[str, Any] | None:
    """Parse partial JSON by closing open strings and structures.

    Handles streaming tool call arguments that are incomplete JSON.
    Returns the parsed dict if successful, None otherwise.
    """
    if not partial or not partial.strip():
        return None

    candidate = partial.rstrip()

    # Try as-is first (might already be complete)
    try:
        result = json.loads(candidate)
        return result if isinstance(result, dict) else None
    except json.JSONDecodeError:
        pass

    # Walk the string tracking state to figure out what closings are needed
    in_string = False
    escape_next = False
    open_stack: list[str] = []

    for ch in candidate:
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if not in_string:
            if ch == "{":
                open_stack.append("}")
            elif ch == "[":
                open_stack.append("]")
            elif ch in ("}", "]") and open_stack:
                open_stack.pop()

    # Close open string if needed
    if in_string:
        candidate += '"'

    # Close open structures
    for closer in reversed(open_stack):
        candidate += closer

    try:
        result = json.loads(candidate)
        return result if isinstance(result, dict) else None
    except json.JSONDecodeError:
        return None


def _parse_bool(val: str | bool | None) -> bool | None:
    """Parse a string/bool value to bool or None."""
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ("true", "1", "yes")
    return None


def _parse_int(val: str | int | None) -> int | None:
    """Parse a string/int value to int or None."""
    if val is None:
        return None
    if isinstance(val, int):
        return val
    if isinstance(val, str):
        try:
            return int(val)
        except ValueError:
            return None
    return None


def _build_refetch_kwargs(
    artifact_type: str,
    arguments: dict[str, Any],
    profile_id: uuid.UUID | None,
    artifact_id: uuid.UUID | None,
    draft_id: uuid.UUID | None,
    fetcher_id_kwarg: str,
) -> dict[str, Any]:
    """Build kwargs for the refetch function call."""
    kwargs: dict[str, Any] = {"bypass_cache": True}

    if profile_id:
        kwargs["profile_id"] = profile_id

    if fetcher_id_kwarg and artifact_id:
        kwargs[fetcher_id_kwarg] = artifact_id

    if draft_id:
        kwargs["draft_id"] = draft_id

    # Persona-specific: parse parameter_ids and bool search params
    if artifact_type == "persona":
        param_ids_str = arguments.get("parameter_ids")
        if param_ids_str and isinstance(param_ids_str, str):
            try:
                kwargs["parameter_ids"] = [
                    uuid.UUID(pid.strip())
                    for pid in param_ids_str.split(",")
                    if pid.strip()
                ]
            except ValueError:
                pass
        for key in (
            "color_search",
            "icon_search",
            "descriptions_search",
            "instructions_search",
            "parameter_field_search",
        ):
            val = arguments.get(key)
            if val:
                kwargs[key] = val
        for key in (
            "color_show_selected",
            "icon_show_selected",
            "parameter_field_show_selected",
        ):
            val = _parse_bool(arguments.get(key))
            if val is not None:
                kwargs[key] = val
        return kwargs

    # Home/practice: type-convert history params
    if artifact_type in ("home", "practice"):
        for key in (
            "history_sort_by",
            "history_sort_order",
            "history_simulation_search",
            "history_scenario_search",
        ):
            val = arguments.get(key)
            if val:
                kwargs[key] = val
        for key in ("history_page", "history_page_size"):
            val = _parse_int(arguments.get(key))
            if val is not None:
                kwargs[key] = val
        for key in ("history_show_archived", "history_infinite_mode"):
            val = _parse_bool(arguments.get(key))
            if val is not None:
                kwargs[key] = val
        return kwargs

    # All other agents: pass through any extra string arguments
    for key, val in arguments.items():
        if val is not None and val != "":
            kwargs[key] = val

    return kwargs


async def _execute_artifact_tool_inline(
    artifact_type: str,
    arguments: dict[str, Any],
    profile_id: uuid.UUID | None,
    artifact_id: uuid.UUID | None,
    draft_id: uuid.UUID | None,
    developer_instruction_templates: list[str] | None,
) -> tuple[str, list[str]]:
    """Execute artifact tool: re-fetch context, re-render developer messages.

    Uses the REGISTRY to dispatch to the correct fetcher for any artifact type.

    Returns:
        (tool_result_json, developer_messages) — result for LLM + messages to inject
    """
    import importlib

    from app.infra.v4.generation.render_developer_instructions import (
        render_developer_instructions,
    )
    from app.socket.v5.client.registry import REGISTRY
    from app.socket.v5.internal.generate import _build_jinja_context

    config = REGISTRY.get(artifact_type)
    if not config or not config.fetcher_module or not config.fetcher_func:
        return (
            json.dumps(
                {
                    "success": False,
                    "message": f"Unsupported artifact type: {artifact_type}",
                }
            ),
            [],
        )

    if not profile_id:
        return (
            json.dumps({"success": False, "message": "No profile_id available"}),
            [],
        )

    mod = importlib.import_module(config.fetcher_module)
    fn = getattr(mod, config.fetcher_func)

    kwargs = _build_refetch_kwargs(
        artifact_type,
        arguments,
        profile_id,
        artifact_id,
        draft_id,
        config.fetcher_id_kwarg,
    )

    try:
        if config.needs_conn:
            async with get_db_connection() as conn:
                kwargs["conn"] = conn
                result = await fn(**kwargs)
        elif config.requires_pool:
            from app.main import get_pool

            pool = get_pool()
            kwargs["pool"] = pool
            result = await fn(**kwargs)
        else:
            result = await fn(**kwargs)
    except Exception as e:
        return (
            json.dumps(
                {
                    "success": False,
                    "message": f"Failed to refetch {artifact_type}: {str(e)}",
                }
            ),
            [],
        )

    # Build Jinja context from the refreshed result and re-render
    jinja_context = _build_jinja_context(result)
    rendered_msgs = render_developer_instructions(
        templates=developer_instruction_templates,
        jinja_context=jinja_context,
    )

    return (
        json.dumps({"success": True, "message": f"Refreshed {artifact_type} context"}),
        rendered_msgs,
    )


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


def _validate_responses_tools(
    tools: list[dict[str, Any]] | list[ToolParam],
) -> list[dict[str, Any]]:
    """Validate and convert tools to Responses API format."""
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
    return validated_tools


async def _call_responses_api(
    model: str,
    responses_input: list[dict[str, Any]],
    tools: list[dict[str, Any]] | list[ToolParam] | None = None,
    tool_choice: str | ToolChoice = "auto",
    api_key: str | None = None,
    base_url: str | None = None,
    temperature: float = 0.0,
    extra_body: dict[str, Any] | None = None,
) -> AsyncIterator[Any]:
    """Call LLM using Responses API with proper input format.

    Args:
        responses_input: List of Responses API items (messages, function_call, function_call_output)
        tools: Tools in responses API format
    """
    if not LITELLM_AVAILABLE or not hasattr(litellm, "aresponses"):
        raise ValueError("litellm aresponses not available")

    responses_kwargs: dict[str, Any] = {
        "input": responses_input,
        "model": model,
        "stream": True,
        "api_key": api_key,
        "temperature": temperature,
        "timeout": 120.0,
    }

    if base_url:
        responses_kwargs["base_url"] = base_url

    if tools:
        validated_tools = _validate_responses_tools(tools)
        responses_kwargs["tools"] = validated_tools
        responses_kwargs["tool_choice"] = tool_choice

    if extra_body:
        responses_kwargs["extra_body"] = extra_body

    debug_kwargs = {k: v for k, v in responses_kwargs.items() if k != "api_key"}
    logger.info(
        f"Calling aresponses API - model: {model}, "
        f"num_tools: {len(responses_kwargs.get('tools', []))}, "
        f"tool_choice: {tool_choice}, "
        f"num_input_items: {len(responses_input)}"
    )
    logger.debug(f"aresponses kwargs (sans api_key): {debug_kwargs}")

    return await litellm.aresponses(**responses_kwargs)  # type: ignore


async def _call_chat_completions_api(
    model: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    tool_choice: str | ToolChoice = "auto",
    api_key: str | None = None,
    base_url: str | None = None,
    temperature: float = 0.0,
    reasoning: str | None = None,
    extra_body: dict[str, Any] | None = None,
) -> AsyncIterator[Any]:
    """Call LLM using Chat Completions API.

    Args:
        messages: List of chat messages (role/content/tool_calls format)
        tools: Tools in OpenAI chat completion format
    """
    if not LITELLM_AVAILABLE:
        raise ValueError("litellm is not available")

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
    debug_kwargs = {k: v for k, v in base_kwargs.items() if k != "api_key"}
    logger.info(
        f"Calling acompletion API - model: {model}, "
        f"num_tools: {len(tools) if tools else 0}, "
        f"tool_choice: {base_kwargs.get('tool_choice', 'none')}, "
        f"num_messages: {len(messages)}"
    )
    logger.debug(f"acompletion kwargs (sans api_key): {debug_kwargs}")

    return await litellm.acompletion(**base_kwargs)  # type: ignore


async def _call_llm_with_mode(
    mode: str,
    model: str,
    responses_input: list[dict[str, Any]] | None = None,
    chat_messages: list[dict[str, Any]] | None = None,
    responses_tools: list[dict[str, Any]] | list[ToolParam] | None = None,
    openai_tools: list[dict[str, Any]] | None = None,
    tool_choice: str | ToolChoice = "auto",
    api_key: str | None = None,
    base_url: str | None = None,
    temperature: float = 0.0,
    reasoning: str | None = None,
    extra_body: dict[str, Any] | None = None,
) -> AsyncIterator[Any]:
    """Call LLM using the specified mode.

    Args:
        mode: "responses" or "chat_completions"
        responses_input: Input for Responses API (items with type=function_call, etc.)
        chat_messages: Input for Chat Completions API (messages with role/content)
        responses_tools: Tools in Responses API format
        openai_tools: Tools in OpenAI chat completions format
    """
    if not model or not model.strip():
        raise ValueError("model name is required but was empty or null")

    if mode == "responses":
        if responses_input is None:
            raise ValueError("responses_input required for responses mode")
        return await _call_responses_api(
            model=model,
            responses_input=responses_input,
            tools=responses_tools,
            tool_choice=tool_choice,
            api_key=api_key,
            base_url=base_url,
            temperature=temperature,
            extra_body=extra_body,
        )
    else:
        if chat_messages is None:
            raise ValueError("chat_messages required for chat_completions mode")
        return await _call_chat_completions_api(
            model=model,
            messages=chat_messages,
            tools=openai_tools,
            tool_choice=tool_choice,
            api_key=api_key,
            base_url=base_url,
            temperature=temperature,
            reasoning=reasoning,
            extra_body=extra_body,
        )


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

        model_config = data.llm_config

        # Decrypt the API key if provided (keys are stored encrypted in the database)
        decrypted_api_key: str | None = None
        if model_config.api_key:
            decrypted_api_key = decrypt_api_key(model_config.api_key)

        extra_body: dict[str, Any] = {}
        if model_config.voice is not None:
            extra_body["voice"] = model_config.voice
        if model_config.quality is not None:
            extra_body["quality"] = model_config.quality
        if model_config.length_seconds is not None:
            extra_body["length_seconds"] = model_config.length_seconds
        if model_config.response_format is not None:
            extra_body["response_format"] = model_config.response_format
        # Note: provider is not passed to extra_body - it's for internal routing only
        if model_config.extra_body:
            extra_body.update(model_config.extra_body)

        openai_tools = None
        responses_tools = None
        # Build output schema lookup: tool_name -> {output_column: argument_name}
        tool_output_schemas: dict[str, dict[str, str]] = {}
        # Build name -> pre-fetched config lookups to avoid redundant DB queries
        tool_id_by_name: dict[str, uuid.UUID] = {}
        tool_resource_type_by_name: dict[str, str] = {}
        tool_entry_type_by_name: dict[str, str] = {}
        tool_artifact_type_by_name: dict[str, str] = {}
        tool_createable_by_name: dict[str, bool] = {}
        if data.tools:
            openai_tools = convert_tools_to_openai_format(data.tools)
            responses_tools = convert_tools_to_responses_format(data.tools)
            for tool_def in data.tools:
                if not isinstance(tool_def, dict):
                    continue
                t_name = tool_def.get("name")
                t_id = tool_def.get("id")
                if t_name and t_id:
                    try:
                        tool_id_by_name[t_name] = (
                            t_id
                            if isinstance(t_id, uuid.UUID)
                            else uuid.UUID(str(t_id))
                        )
                    except (ValueError, AttributeError):
                        pass
                if t_name:
                    t_resource = tool_def.get("resource")
                    t_entry = tool_def.get("entry")
                    t_artifact = tool_def.get("artifact")
                    t_createable = tool_def.get("createable")
                    if t_resource:
                        tool_resource_type_by_name[t_name] = t_resource
                    if t_entry:
                        tool_entry_type_by_name[t_name] = t_entry
                    if t_artifact:
                        tool_artifact_type_by_name[t_name] = t_artifact
                    if t_createable is not None:
                        tool_createable_by_name[t_name] = bool(t_createable)
                t_args_outputs = tool_def.get("_args_outputs")
                if t_name and isinstance(t_args_outputs, list):
                    resolved: dict[str, str] = {}
                    for ao in t_args_outputs:
                        if not isinstance(ao, dict):
                            continue
                        col = ao.get("name")
                        template = ao.get("template")
                        if col and template:
                            arg_name = _extract_template_var(template)
                            if arg_name:
                                resolved[col] = arg_name
                    if resolved:
                        tool_output_schemas[t_name] = resolved

        tool_choice = model_config.tool_choice or "auto"
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
                "type": "start",
                "message": "Starting generation",
                "metadata": data.metadata,
            },
        )

        if data.modality in ("image", "video"):
            if data.file_path:
                # Pre-uploaded media passthrough
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
                        "file_path": data.file_path,
                        "mime_type": data.mime_type,
                        "file_size": data.file_size,
                        "upload_id": data.upload_id,
                        "metadata": data.metadata,
                    },
                )
                return

            # AI-generated media via adapter
            from app.infra.v4.websocket.media_lifecycle import get_media_adapter

            adapter = get_media_adapter()
            prompt = data.messages[-1]["content"] if data.messages else ""
            context = {
                "sid": sid,
                "run_id": data.run_id,
                "group_id": data.group_id,
                "artifact_type": data.artifact_type,
                "resource_type": resource_type,
                "resource_id": data.resource_id,
                "metadata": data.metadata,
            }

            try:
                await adapter.generate(
                    modality=data.modality,
                    prompt=prompt,
                    model=model_config.model,
                    api_key=decrypted_api_key or "",
                    base_url=model_config.base_url,
                    quality=model_config.quality,
                    extra_body=extra_body or None,
                    context=context,
                )
            except Exception as e:
                await _emit_modality_event(
                    data.modality,
                    "error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Media generation failed: {str(e)}",
                        artifact_type=data.artifact_type,
                        group_id=data.group_id,
                        resource_type=resource_type,
                        resource_id=data.resource_id,
                    ).model_dump(),
                )
            return

        if data.modality == "audio":
            from app.infra.v4.websocket.audio_lifecycle import get_audio_adapter
            from app.infra.v4.websocket.session_store import (
                create_session,
                remove_session,
            )

            if not decrypted_api_key:
                await _emit_modality_event(
                    "audio",
                    "error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="No API key configured for voice mode",
                        artifact_type=data.artifact_type,
                        group_id=data.group_id,
                    ).model_dump(),
                )
                return

            voice = model_config.voice or "alloy"
            group_id = data.group_id or str(uuid.uuid4())

            # Create session -- chat_id stored for domain translator lookups
            session = create_session(sid, group_id, data.chat_id or group_id)
            adapter = get_audio_adapter()

            try:
                await adapter.initialize_session(
                    session=session,
                    api_key=decrypted_api_key,
                    base_url=model_config.base_url,
                    model=model_config.model,
                    voice=voice,
                    instructions=None,
                )
            except Exception as e:
                remove_session(group_id)
                await _emit_modality_event(
                    "audio",
                    "error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Failed to connect to voice service: {str(e)}",
                        artifact_type=data.artifact_type,
                        group_id=group_id,
                    ).model_dump(),
                )
                return

            # Only emit group_id -- domain translators resolve chat_id from session
            await _emit_modality_event(
                "audio",
                "start",
                {
                    "sid": sid,
                    "group_id": group_id,
                    "artifact_type": data.artifact_type,
                    "type": "start",
                    "message": "Audio session ready",
                    "metadata": data.metadata,
                },
            )
            return

        # Agentic loop - allows model to see tool results and retry on errors
        # We maintain two parallel conversation states:
        # - responses_input: For Responses API (items with type=function_call, function_call_output)
        # - chat_messages: For Chat Completions API (messages with role/content/tool_calls)
        max_iterations = 10
        iteration = 0
        total_input_tokens = 0
        total_output_tokens = 0
        all_tool_results: list[dict[str, Any]] = []
        final_assistant_output = ""

        # Initialize both conversation states from initial messages
        # Chat messages: standard role/content format
        chat_messages = list(messages)  # Copy to avoid mutation

        # Responses input: convert to item format (messages without tool history work directly)
        # Note: "developer" role is used for system instructions in Responses API
        responses_input: list[dict[str, Any]] = [
            {"role": m["role"], "content": m.get("content", "")}
            for m in messages
            if m.get("role") in ("system", "user", "assistant", "developer")
            and not m.get("tool_calls")
        ]

        # Determine which API mode to use (try Responses first)
        api_mode = "chat_completions"  # Default fallback
        if LITELLM_AVAILABLE and hasattr(litellm, "aresponses"):
            api_mode = "responses"
            logger.info("Using Responses API mode for agentic loop")
        else:
            logger.info("Using Chat Completions API mode for agentic loop")

        while iteration < max_iterations:
            iteration += 1
            logger.info(
                f"Agentic loop iteration {iteration}/{max_iterations} (mode: {api_mode})"
            )

            # Call the appropriate API
            try:
                if api_mode == "responses":
                    stream = await _call_responses_api(
                        model=model_config.model,
                        responses_input=responses_input,
                        tools=responses_tools,
                        tool_choice=tool_choice,
                        api_key=decrypted_api_key,
                        base_url=model_config.base_url,
                        temperature=model_config.temperature or 0.0,
                        extra_body=extra_body or None,
                    )
                else:
                    stream = await _call_chat_completions_api(
                        model=model_config.model,
                        messages=chat_messages,
                        tools=openai_tools,
                        tool_choice=tool_choice,
                        api_key=decrypted_api_key,
                        base_url=model_config.base_url,
                        temperature=model_config.temperature or 0.0,
                        reasoning=model_config.reasoning,
                        extra_body=extra_body or None,
                    )
            except Exception as e:
                if api_mode == "responses":
                    # Fall back to chat completions
                    logger.warning(
                        f"Responses API failed, falling back to Chat Completions: {e}"
                    )
                    api_mode = "chat_completions"
                    stream = await _call_chat_completions_api(
                        model=model_config.model,
                        messages=chat_messages,
                        tools=openai_tools,
                        tool_choice=tool_choice,
                        api_key=decrypted_api_key,
                        base_url=model_config.base_url,
                        temperature=model_config.temperature or 0.0,
                        reasoning=model_config.reasoning,
                        extra_body=extra_body or None,
                    )
                else:
                    raise

            assistant_output = ""
            input_tokens = 0
            output_tokens = 0
            tool_call_states: dict[str, dict[str, Any]] = {}
            tool_results: list[dict[str, Any]] = []
            output_items: list[
                dict[str, Any]
            ] = []  # Raw output items for Responses API

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
                            "type": "start",
                            "event_type": "text_start",
                            "metadata": data.metadata,
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
                                "type": "progress",
                                "event_type": "text_delta",
                                "delta": delta,
                                "accumulated_content": assistant_output,
                                "metadata": data.metadata,
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
                            "type": "complete",
                            "event_type": "text_complete",
                            "text": assistant_output,
                            "metadata": data.metadata,
                        },
                    )

                elif event_type == "tool_call_start":
                    raw_id = cast(str, event.get("tool_call_id"))
                    # Only truncate for chat completions (40 char limit)
                    # Responses API can handle longer IDs
                    tool_call_id = (
                        raw_id[:40]
                        if api_mode == "chat_completions" and len(raw_id) > 40
                        else raw_id
                    )
                    tool_call_states.setdefault(
                        tool_call_id,
                        {
                            "call_id": tool_call_id,
                            "raw_id": raw_id,  # Keep original for responses API
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
                            "type": "start",
                            "event_type": "tool_call_start",
                            "tool_call_id": tool_call_id,
                            "metadata": data.metadata,
                        },
                    )

                elif event_type == "tool_call_delta":
                    raw_id = cast(str, event.get("tool_call_id"))
                    tool_call_id = (
                        raw_id[:40]
                        if api_mode == "chat_completions" and len(raw_id) > 40
                        else raw_id
                    )
                    delta = event.get("delta", "") or ""
                    tool_name = event.get("tool_name")
                    st = tool_call_states.setdefault(
                        tool_call_id,
                        {
                            "call_id": tool_call_id,
                            "raw_id": raw_id,
                            "tool_name": None,
                            "arguments": "",
                        },
                    )
                    if tool_name and not st["tool_name"]:
                        st["tool_name"] = tool_name
                    st["arguments"] += delta
                    parsed_args = _parse_partial_json(st["arguments"])
                    resolved_fields = _resolve_output_fields(
                        parsed_args, st.get("tool_name"), tool_output_schemas
                    )
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
                            "type": "progress",
                            "event_type": "tool_call_delta",
                            "tool_call_id": tool_call_id,
                            "delta": delta,
                            "tool_name": st.get("tool_name"),
                            "arguments_delta": delta,
                            "arguments": parsed_args,
                            "resolved_fields": resolved_fields,
                            "metadata": data.metadata,
                        },
                    )

                elif event_type == "tool_call_complete":
                    raw_id = cast(str, event.get("tool_call_id"))
                    tool_call_id = (
                        raw_id[:40]
                        if api_mode == "chat_completions" and len(raw_id) > 40
                        else raw_id
                    )
                    tool_name = (
                        event.get("name")
                        or tool_call_states.get(tool_call_id, {}).get("tool_name")
                        or ""
                    )
                    st = tool_call_states.get(tool_call_id, {})
                    arguments_str = event.get("arguments") or st.get("arguments", "")

                    try:
                        arguments_dict = (
                            json.loads(arguments_str) if arguments_str else {}
                        )
                    except json.JSONDecodeError:
                        arguments_dict = {}

                    complete_resolved = _resolve_output_fields(
                        arguments_dict, tool_name, tool_output_schemas
                    )
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
                            "type": "complete",
                            "event_type": "tool_call_complete",
                            "tool_call_id": tool_call_id,
                            "tool_name": tool_name,
                            "arguments": arguments_dict,
                            "arguments_delta": arguments_str,
                            "call_id": tool_call_id,
                            "resolved_fields": complete_resolved,
                            "metadata": data.metadata,
                        },
                    )

                    # Execute tool inline using the agentic pattern
                    # Tool result (including errors) will be visible to model for retries
                    artifact_dev_msgs: list[str] = []
                    if tool_name in tool_artifact_type_by_name:
                        # Artifact tool — re-fetch context and re-render developer messages
                        art_type = tool_artifact_type_by_name[tool_name]
                        (
                            tool_result_str,
                            artifact_dev_msgs,
                        ) = await _execute_artifact_tool_inline(
                            artifact_type=art_type,
                            arguments=arguments_dict,
                            profile_id=uuid.UUID(data.profile_id)
                            if data.profile_id
                            else None,
                            artifact_id=uuid.UUID(data.artifact_id)
                            if data.artifact_id
                            else None,
                            draft_id=uuid.UUID(data.draft_id)
                            if data.draft_id
                            else None,
                            developer_instruction_templates=data.developer_instruction_templates,
                        )
                    else:
                        # Existing resource/entry tool path
                        resolved_tool_id = tool_id_by_name.get(tool_name)
                        if not resolved_tool_id:
                            tool_result_str = json.dumps(
                                {
                                    "success": False,
                                    "message": f"Tool not found: {tool_name}",
                                    "error_stage": "tool_resolve",
                                }
                            )
                        else:
                            async with get_db_connection() as conn:
                                tool_result_str = await execute_tool_call(
                                    conn=conn,
                                    tool_name=tool_name,
                                    arguments=arguments_dict,
                                    tool_id=resolved_tool_id,
                                    run_id=uuid.UUID(data.run_id)
                                    if data.run_id
                                    else None,
                                    external_call_id=tool_call_id,
                                    resource_type=tool_resource_type_by_name.get(
                                        tool_name
                                    ),
                                    entry_type=tool_entry_type_by_name.get(tool_name),
                                    is_creatable=tool_createable_by_name.get(tool_name),
                                )

                    # Parse result for internal tracking
                    try:
                        tool_result = json.loads(tool_result_str)
                    except json.JSONDecodeError:
                        tool_result = {
                            "success": False,
                            "message": tool_result_str,
                            "error_stage": "result_parse",
                        }

                    # Store for agentic loop - we'll append to appropriate state
                    tool_results.append(
                        {
                            "tool_call_id": tool_call_id,
                            "raw_id": raw_id,  # Original ID for responses API
                            "tool_name": tool_name,
                            "arguments": arguments_dict,
                            "arguments_str": arguments_str,
                            "result": tool_result,
                            "result_str": tool_result_str,
                            "artifact_dev_msgs": artifact_dev_msgs,
                        }
                    )

                    # Use resource_type from tool result if available (more accurate for multi-resource agents)
                    result_resource_type = (
                        tool_result.get("resource_type") or resource_type
                    )

                    # Use entry_type/entry_id from tool result if available
                    result_entry_type = tool_result.get("entry_type")
                    result_entry_id = tool_result.get("entry_id")

                    await _emit_modality_event(
                        "call",
                        "complete",
                        {
                            "modality": "call",
                            "sid": sid,
                            "artifact_type": data.artifact_type,
                            "resource_type": result_resource_type,
                            "entry_type": result_entry_type,
                            "entry_id": result_entry_id,
                            "run_id": data.run_id,
                            "group_id": data.group_id,
                            "type": "complete",
                            "event_type": "tool_result",
                            "tool_call_id": tool_call_id,
                            "tool_name": tool_name,
                            "result": tool_result,
                            "resolved_fields": complete_resolved,
                            "metadata": data.metadata,
                        },
                    )

                elif event_type == "output_item":
                    # Collect raw output items for Responses API conversation history
                    item = event.get("item")
                    if item:
                        output_items.append(item)

                elif event_type == "message_complete":
                    usage_data = event.get("usage")
                    if isinstance(usage_data, dict):
                        input_tokens = usage_data.get("prompt_tokens", 0) or 0
                        output_tokens = usage_data.get("completion_tokens", 0) or 0

            # End of async for event loop

            # Track cumulative stats
            total_input_tokens += input_tokens
            total_output_tokens += output_tokens
            all_tool_results.extend(tool_results)
            final_assistant_output = assistant_output

            # Check if we need to continue the agentic loop
            if not tool_results:
                # No tool calls in this iteration, we're done
                logger.info(
                    f"Agentic loop complete after {iteration} iterations (no tool calls)"
                )
                break

            # Update conversation state based on API mode
            if api_mode == "responses":
                # Responses API: append model's output items + our function_call_output items
                # 1. Append the model's output items (text, function_call) - persisted from stream
                for item in output_items:
                    responses_input.append(item)

                # 2. Append our function_call_output items (our responses to the tool calls)
                for tr in tool_results:
                    responses_input.append(
                        {
                            "type": "function_call_output",
                            "call_id": tr["raw_id"],
                            "output": tr["result_str"],
                        }
                    )
                    # Inject re-rendered developer messages for artifact tools
                    for dm in tr.get("artifact_dev_msgs", []):
                        responses_input.append({"role": "developer", "content": dm})
                logger.info(
                    f"Agentic loop iteration {iteration}: {len(output_items)} output items, "
                    f"{len(tool_results)} tool outputs, "
                    f"continuing with {len(responses_input)} responses items"
                )
            else:
                # Chat Completions: append assistant message with tool_calls + tool messages
                assistant_tool_calls = []
                for tr in tool_results:
                    assistant_tool_calls.append(
                        {
                            "id": tr[
                                "tool_call_id"
                            ],  # Truncated ID for chat completions
                            "type": "function",
                            "function": {
                                "name": tr["tool_name"],
                                "arguments": tr["arguments_str"],
                            },
                        }
                    )

                chat_messages.append(
                    {
                        "role": "assistant",
                        "content": assistant_output or "",
                        "tool_calls": assistant_tool_calls,
                    }
                )

                for tr in tool_results:
                    chat_messages.append(
                        {
                            "tool_call_id": tr["tool_call_id"],
                            "role": "tool",
                            "name": tr["tool_name"],
                            "content": tr["result_str"],
                        }
                    )
                    # Inject re-rendered developer messages for artifact tools
                    for dm in tr.get("artifact_dev_msgs", []):
                        chat_messages.append({"role": "system", "content": dm})
                logger.info(
                    f"Agentic loop iteration {iteration}: {len(tool_results)} tool calls, "
                    f"continuing with {len(chat_messages)} chat messages"
                )

            # After first iteration with tool calls, switch to auto tool_choice
            # to allow model to decide whether to call more tools or respond
            if tool_choice == "required":
                tool_choice = "auto"

        # End of agentic while loop

        if iteration >= max_iterations:
            logger.warning(
                f"Agentic loop reached max iterations ({max_iterations}), "
                f"returning partial results"
            )

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
                "input_text_tokens": total_input_tokens,
                "output_text_tokens": total_output_tokens,
                "assistant_output": final_assistant_output,
                "tool_results": all_tool_results,
                "save": data.save,
                "metadata": data.metadata,
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
