"""Internal handler: attempt_response_submit — canonical orchestration entry."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.infra.globals import get_internal_sio
from app.infra.websocket.socket_event import EmitFn, SocketEvent, make_emit
from app.routes.v5.socket.client.types import AttemptResponsePayload
from app.routes.v5.socket.internal.attempt.types import (
    AttemptErrorData,
    AttemptResponseResultData,
)

internal_sio = get_internal_sio()


class AttemptResponseInternalResult(BaseModel):
    success: bool
    message: str | None = None
    is_correct: bool | None = None


async def attempt_response_internal_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn | None = None,
) -> AttemptResponseInternalResult:
    """Run canonical attempt response placeholder orchestration for any surface."""
    payload = AttemptResponsePayload(**data)
    del payload

    sid = data.get("sid", "")
    chat_id = str(data.get("chat_id", ""))
    question_id = str(data.get("question_id", ""))
    option_ids = [str(option_id) for option_id in data.get("option_ids", [])]

    downstream_emit = emit or make_emit()
    recorded: list[SocketEvent] = []

    async def _emit(events: list[SocketEvent]) -> None:
        recorded.extend(events)
        await downstream_emit(events)

    if not chat_id or not question_id or not option_ids:
        await _emit(
            [
                SocketEvent(
                    bus="internal",
                    event="attempt_error",
                    data=AttemptErrorData(
                        sid=sid,
                        error_type="quiz",
                        message="Missing required fields",
                        chat_id=chat_id or None,
                    ).model_dump(mode="json"),
                )
            ]
        )
    else:
        await _emit(
            [
                SocketEvent(
                    bus="internal",
                    event="attempt_response_result",
                    data=AttemptResponseResultData(
                        sid=sid,
                        success=True,
                        message="Response submitted",
                        is_correct=None,
                    ).model_dump(mode="json"),
                )
            ]
        )

    for event in recorded:
        if event.bus != "internal":
            continue
        if event.event == "attempt_response_result":
            return AttemptResponseInternalResult(
                success=bool(event.data.get("success", False)),
                message=event.data.get("message"),
                is_correct=event.data.get("is_correct"),
            )
        if event.event == "attempt_error":
            error = AttemptErrorData(**event.data)
            raise ValueError(error.message)

    raise ValueError("Attempt response completed without a terminal event")


@internal_sio.on("attempt_response_submit")  # type: ignore
async def attempt_response_handler(data: dict[str, Any]) -> None:
    await attempt_response_internal_impl(data)
