"""Create tool call — black box that executes a tool and persists everything."""

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import asyncpg  # type: ignore

from app.infra.tools.entries.build_call_payload import build_call_payload
from app.infra.tools.entries.execute_tool_fn import execute_tool_fn
from app.infra.tools.entries.save_call_upload import save_call_upload
from app.infra.tools.entries.save_text_upload import save_text_upload
from app.infra.tools.entries.create_tool_setup import create_tool_setup
from app.infra.tools.entries.types import CreateToolSetupResponse
from app.routes.v5.tools.entries.uploads.create import create_upload


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
    4. Creates the full entry chain via create_tool_setup.
    """
    # 1. Execute
    output = await execute_tool_fn(tool_fn, conn, arguments)

    # 2. Write .txt (always)
    text_upload_id = uuid4()
    text_rel_path = save_text_upload(output, text_upload_id, upload_folder)
    text_full_path = upload_folder / text_rel_path
    text_size = text_full_path.stat().st_size

    # 3. Write .json receipt (only with tool_id)
    call_upload_id: UUID | None = None
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

    if tool_id is not None and call_upload_id is not None:
        call_upload = await create_upload(
            conn,
            session_id=session_id,
            file_path=call_rel_path,
            mime_type="application/json",
            size=call_size,
            mcp=mcp,
        )
        call_upload_id = call_upload.id

    # 5. Create entry chain
    return await create_tool_setup(
        conn,
        group_id=group_id,
        session_id=session_id,
        text_upload_id=text_upload.id,
        profile_id=profile_id,
        tool_id=tool_id,
        call_upload_id=call_upload_id,
        role=role,
        mcp=mcp,
    )
