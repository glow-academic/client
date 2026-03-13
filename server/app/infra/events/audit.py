"""Generic tool-backed audit wrappers for artifact operations."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, TypeVar
from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.common_context import resolve_common_context
from app.infra.globals import UPLOAD_FOLDER
from app.infra.tool_graph import SettingsToolGraph
from app.infra.tools.entries.create_tool_call import create_tool_call

T = TypeVar("T")


def resolve_artifact_operation_tool(
    tool_graph: SettingsToolGraph,
    *,
    artifact: str,
    operation: str,
) -> UUID | None:
    """Pick the canonical tool for an artifact operation from the tool graph."""
    matches = [
        tool
        for tool in tool_graph.tools
        if tool.target_type == "artifact"
        and tool.target == artifact
        and tool.operation == operation
    ]
    if not matches:
        return None

    best = min(matches, key=lambda tool: (tool.system_id, tool.agent_id, tool.tool_id))
    return best.tool_id


async def run_artifact_operation_with_audit(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    artifact: str,
    profile_id: UUID,
    operation: str,
    runner: Callable[[], Awaitable[T]],
    arguments: dict[str, Any],
    session_id: UUID | None = None,
    draft_id: UUID | None = None,
    group_id: UUID | None = None,
    attempt_id: UUID | None = None,
    test_id: UUID | None = None,
    bypass_cache: bool = False,
    response_model: type[T] | None = None,
    role: str = "assistant",
    mcp: bool = False,
    upload_folder: Path | None = None,
) -> T:
    """Execute an artifact operation and persist a tool-call audit receipt when possible.

    TODO: Add typed progress entry emission once call lifecycle progress exists.
    """
    common = await resolve_common_context(
        pool,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        group_id=group_id,
        draft_id=draft_id,
        attempt_id=attempt_id,
        test_id=test_id,
        artifact_type=artifact,
        bypass_cache=bypass_cache,
    )
    if common is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    tool_id = resolve_artifact_operation_tool(
        common.tool_graph,
        artifact=artifact,
        operation=operation,
    )
    effective_session_id = session_id or common.profile.session_id
    effective_group_id = group_id or common.profile.group_id

    effective_profiles_id = common.profile.profiles_id
    effective_upload_folder = upload_folder or UPLOAD_FOLDER

    if (
        tool_id is None
        or effective_session_id is None
        or effective_group_id is None
        or effective_profiles_id is None
    ):
        from app.infra.stream.emitter import (
            emit_artifact_operation_events,
            emit_artifact_operation_failure,
        )

        try:
            result = await runner()
        except Exception as exc:
            await emit_artifact_operation_failure(
                artifact=artifact,
                operation=operation,
                arguments=arguments,
                message=str(exc),
                error_type=type(exc).__name__,
                entity_id=None,
                tool_id=tool_id,
            )
            raise

        output = result.model_dump(mode="json") if hasattr(result, "model_dump") else result
        if isinstance(output, dict):
            await emit_artifact_operation_events(
                artifact=artifact,
                operation=operation,
                arguments=arguments,
                output=output,
                entity_id=None,
                call_id=None,
                tool_id=tool_id,
            )
        return result

    async def _tool_fn(_conn: asyncpg.Connection, **_arguments: Any) -> Any:
        result = await runner()
        if hasattr(result, "model_dump"):
            return result.model_dump(mode="json")
        return result

    try:
        from app.infra.stream.emitter import (
            emit_artifact_operation_events,
            emit_artifact_operation_failure,
        )

        async with pool.acquire() as conn:
            result = await create_tool_call(
                conn,
                group_id=effective_group_id,
                session_id=effective_session_id,
                profile_id=effective_profiles_id,
                upload_folder=effective_upload_folder,
                tool_fn=_tool_fn,
                arguments=arguments,
                tool_id=tool_id,
                role=role,
                mcp=mcp,
                raise_on_error=True,
            )
    except Exception as exc:
        await emit_artifact_operation_failure(
            artifact=artifact,
            operation=operation,
            arguments=arguments,
            message=str(exc),
            error_type=type(exc).__name__,
            entity_id=None,
            tool_id=tool_id,
        )
        raise

    emitted_output = (
        result.result.model_dump(mode="json")
        if hasattr(result.result, "model_dump")
        else result.result
    )
    if isinstance(emitted_output, dict):
        await emit_artifact_operation_events(
            artifact=artifact,
            operation=operation,
            arguments=arguments,
            output=emitted_output,
            entity_id=None,
            call_id=result.call_id,
            tool_id=tool_id,
        )

    if response_model is not None:
        return response_model.model_validate(result.result)
    return result.result


def build_audit_arguments(data: dict[str, Any]) -> dict[str, Any]:
    """Strip transport-only keys from an audited operation payload."""
    return {
        key: value
        for key, value in data.items()
        if key not in {"sid", "profile_id", "session_id"}
    }
