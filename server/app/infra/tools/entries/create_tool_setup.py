"""Create tool setup — orchestrates core entry creation for a tool call."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.tools.entries.types import CreateToolSetupResponse
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.messages.create import create_message
from app.routes.v5.tools.entries.texts.create import create_text
from app.routes.v5.tools.entries.text_uploads.create import create_text_upload
from app.routes.v5.tools.entries.call_uploads.create import create_call_upload
from app.routes.v5.tools.entries.message_uploads.create import create_message_upload


async def create_tool_setup(
    conn: asyncpg.Connection,
    group_id: UUID,
    session_id: UUID,
    tool_id: UUID,
    text_upload_id: UUID,
    call_upload_id: UUID,
    profile_id: UUID,
    role: str = "assistant",
    mcp: bool = False,
) -> CreateToolSetupResponse:
    """Create the full entry chain for a tool call.

    Creates: run → call → message → text, then links the two uploads
    to their respective entries and both to the message.
    """
    run = await create_run(
        conn,
        group_id=group_id,
        session_id=session_id,
        profile_id=profile_id,
        mcp=mcp,
    )

    call = await create_call(
        conn,
        run_id=run.id,
        session_id=session_id,
        tool_id=tool_id,
        mcp=mcp,
    )

    message = await create_message(
        conn,
        run_id=run.id,
        role=role,
        mcp=mcp,
    )

    text = await create_text(
        conn,
        session_id=session_id,
        mcp=mcp,
    )

    text_upload_junction = await create_text_upload(
        conn,
        text_id=text.id,
        upload_id=text_upload_id,
        session_id=session_id,
        mcp=mcp,
    )

    call_upload_junction = await create_call_upload(
        conn,
        call_id=call.id,
        upload_id=call_upload_id,
        session_id=session_id,
        mcp=mcp,
    )

    message_text_upload_junction = await create_message_upload(
        conn,
        message_id=message.id,
        upload_id=text_upload_id,
        session_id=session_id,
        mcp=mcp,
    )

    message_call_upload_junction = await create_message_upload(
        conn,
        message_id=message.id,
        upload_id=call_upload_id,
        session_id=session_id,
        mcp=mcp,
    )

    return CreateToolSetupResponse(
        run_id=run.id,
        call_id=call.id,
        message_id=message.id,
        text_id=text.id,
        text_upload_junction_id=text_upload_junction.id,
        call_upload_junction_id=call_upload_junction.id,
        message_text_upload_junction_id=message_text_upload_junction.id,
        message_call_upload_junction_id=message_call_upload_junction.id,
    )
