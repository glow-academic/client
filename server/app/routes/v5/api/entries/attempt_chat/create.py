"""AttemptChat entry CREATE endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.entries.attempt_chat.types import (
    CreateAttemptChatEntryRequest,
    CreateAttemptChatEntryResponse,
)
from app.routes.v5.tools.entries.attempt_chat.create import create_attempt_chat
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.messages.create import create_message
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/attempt-chat/create", response_model=CreateAttemptChatEntryResponse)
async def create_attempt_chat_entry(
    request: CreateAttemptChatEntryRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAttemptChatEntryResponse:
    """Create attempt_chat entry."""
    tags = ["entries", "attempt_chat"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        if not request.run_id:
            raise HTTPException(status_code=400, detail="run_id is required")

        mcp = getattr(http_request.state, "mcp", False) or False
        session_id = getattr(http_request.state, "session_id", None)

        async with conn.transaction():
            call = await create_call(
                conn,
                run_id=request.run_id,
                session_id=session_id or request.run_id,
                mcp=mcp,
            )
            result = await create_attempt_chat(
                conn,
                call_id=call.id,
                group_id=request.group_id,
                chat_id=request.chat_id,
                title=request.title,
                position=request.position,
                time_limit=request.time_limit,
                negative_time=request.negative_time,
                audio_enabled=request.audio_enabled,
                text_enabled=request.text_enabled,
                hints_enabled=request.hints_enabled,
                copy_paste_allowed=request.copy_paste_allowed,
                show_images=request.show_images,
                show_objectives=request.show_objectives,
                show_problem_statement=request.show_problem_statement,
                analyses_enabled=request.analyses_enabled,
                improvements_enabled=request.improvements_enabled,
                replacements_enabled=request.replacements_enabled,
                strengths_enabled=request.strengths_enabled,
                use_custom=request.use_custom,
                use_previous=request.use_previous,
                problem_statement_enabled=request.problem_statement_enabled,
                objectives_enabled=request.objectives_enabled,
                video_enabled=request.video_enabled,
                images_enabled=request.images_enabled,
                questions_enabled=request.questions_enabled,
                assistant_persona_ids=request.assistant_persona_ids,
                rubrics_ids=request.rubrics_ids,
                standards_ids=request.standards_ids,
                standard_groups_ids=request.standard_groups_ids,
                departments_ids=request.departments_ids,
                personas_ids=request.personas_ids,
                problem_statements_ids=request.problem_statements_ids,
                objectives_ids=request.objectives_ids,
                questions_ids=request.questions_ids,
                options_ids=request.options_ids,
                videos_ids=request.videos_ids,
                images_ids=request.images_ids,
                documents_ids=request.documents_ids,
                parameter_fields_ids=request.parameter_fields_ids,
                mcp=mcp,
            )
            message = await create_message(
                conn, run_id=request.run_id, role="assistant", mcp=mcp
            )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return CreateAttemptChatEntryResponse(
            id=result.id, call_id=call.id, message_id=message.id
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_attempt_chat_entry",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
