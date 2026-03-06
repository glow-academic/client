"""Create tool call — black box that executes a tool and persists everything."""

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import asyncpg  # type: ignore

from app.infra.tools.entries.build_call_payload import build_call_payload
from app.infra.tools.entries.create_run_message import create_run_message
from app.infra.tools.entries.save_call_upload import save_call_upload
from app.infra.tools.entries.save_text_upload import save_text_upload
from app.infra.tools.entries.types import CreateToolSetupResponse
from app.routes.v5.tools.entries.call_uploads.create import create_call_upload
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.message_uploads.create import create_message_upload
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.uploads.create import create_upload


# TODO: Migrate to profiles_id (profiles_resource.id) instead of profile_id.
#       Callers (draft endpoints) need to resolve profiles_id from ProfileContext
#       and pass it here. Then rename profile_id → profiles_id and update create_run call.
async def create_tool_call(
    conn: asyncpg.Connection,
    group_id: UUID,
    session_id: UUID,
    profile_id: UUID,
    upload_folder: Path,
    tool_fn: Callable[..., Any],
    arguments: dict[str, Any],
    tool_id: UUID | None = None,
    role: str = "assistant",
    mcp: bool = False,
) -> CreateToolSetupResponse:
    """Execute a tool and persist the full entry chain + files.

    1. Executes tool_fn(conn, **arguments) to get output.
    2. Writes .txt (always) and .json receipt (when tool_id is provided).
    3. Creates upload DB rows for each file.
    4. Creates run + message entry chain.
    """
    # 1. Execute — call tool_fn and capture both raw result + serialized output
    raw_result = await tool_fn(conn, **arguments)
    if isinstance(raw_result, str):
        output = raw_result
    else:
        output = json.dumps(raw_result, default=str)

    # Extract canonical ID from the tool function result
    result_id: UUID | None = None
    if hasattr(raw_result, "id"):
        result_id = raw_result.id
    elif isinstance(raw_result, dict) and "id" in raw_result:
        rid = raw_result["id"]
        result_id = rid if isinstance(rid, UUID) else UUID(str(rid))

    # 2. Write .txt (always)
    text_upload_id = uuid4()
    text_rel_path = save_text_upload(output, text_upload_id, upload_folder)
    text_full_path = upload_folder / text_rel_path
    text_size = text_full_path.stat().st_size

    # 3. Write .json receipt (only with tool_id)
    call_upload_db_id: UUID | None = None
    if tool_id is not None:
        call_upload_id = uuid4()
        output_dict = json.loads(output) if isinstance(output, str) else output
        payload = build_call_payload(
            call_id=call_upload_id,
            tool_id=tool_id,
            arguments=arguments,
            output=output_dict,
        )
        call_rel_path = save_call_upload(payload, call_upload_id, upload_folder)
        call_full_path = upload_folder / call_rel_path
        call_size = call_full_path.stat().st_size

    # 4. Create upload DB rows
    text_upload = await create_upload(
        conn,
        session_id=session_id,
        file_path=text_rel_path,
        mime_type="text/plain",
        size=text_size,
        mcp=mcp,
    )

    if tool_id is not None and call_upload_db_id is None:
        call_upload = await create_upload(
            conn,
            session_id=session_id,
            file_path=call_rel_path,
            mime_type="application/json",
            size=call_size,
            mcp=mcp,
        )
        call_upload_db_id = call_upload.id

    # 5. Create run
    run = await create_run(
        conn,
        group_id=group_id,
        session_id=session_id,
        profile_id=profile_id,
        mcp=mcp,
    )

    # 6. Call path (only when tool_id is provided)
    call_id: UUID | None = None
    call_upload_junction_id: UUID | None = None
    message_call_upload_junction_id: UUID | None = None

    if tool_id is not None:
        call_result = await create_call(
            conn,
            run_id=run.id,
            session_id=session_id,
            tool_id=tool_id,
            mcp=mcp,
        )
        call_id = call_result.id

    # 7. Text message path (always) — uses create_run_message building block
    msg = await create_run_message(
        conn,
        run_id=run.id,
        session_id=session_id,
        role=role,
        upload_id=text_upload.id,
        mcp=mcp,
    )

    # 8. Call upload junctions (only when tool_id is provided)
    if call_id is not None and call_upload_db_id is not None:
        call_upload_junction = await create_call_upload(
            conn,
            call_id=call_id,
            upload_id=call_upload_db_id,
            session_id=session_id,
            mcp=mcp,
        )
        call_upload_junction_id = call_upload_junction.id

        msg_call_upload = await create_message_upload(
            conn,
            message_id=msg.message_id,
            upload_id=call_upload_db_id,
            session_id=session_id,
            mcp=mcp,
        )
        message_call_upload_junction_id = msg_call_upload.id

    return CreateToolSetupResponse(
        result_id=result_id,
        run_id=run.id,
        call_id=call_id,
        message_id=msg.message_id,
        text_id=msg.text_id,
        text_upload_junction_id=msg.text_upload_junction_id,
        call_upload_junction_id=call_upload_junction_id,
        message_text_upload_junction_id=msg.message_upload_junction_id,
        message_call_upload_junction_id=message_call_upload_junction_id,
    )
