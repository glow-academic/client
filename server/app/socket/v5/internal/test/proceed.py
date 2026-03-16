"""Backwards-compat shim — canonical location is app.infra.test.proceed."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.test.proceed import test_proceed_internal_impl as test_proceed_internal_impl  # noqa: F401

internal_sio = get_internal_sio()


@internal_sio.on("test_proceed")  # type: ignore
async def test_proceed_handler(data: dict[str, Any]) -> None:
    await test_proceed_internal_impl(data)
