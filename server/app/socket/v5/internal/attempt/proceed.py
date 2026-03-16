"""Backwards-compat shim — canonical location is app.infra.attempt.proceed."""

from app.infra.attempt.proceed import (  # noqa: F401
    attempt_proceed_internal_impl as attempt_proceed_internal_impl,
)
from app.infra.globals import get_internal_sio

internal_sio = get_internal_sio()


@internal_sio.on("attempt_proceed")  # type: ignore
async def attempt_proceed_handler(data: dict) -> None:  # type: ignore
    await attempt_proceed_internal_impl(data)
