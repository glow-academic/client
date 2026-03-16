"""Backwards-compat shim — canonical location is app.infra.test.start."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.test.start import test_start_internal_impl as test_start_internal_impl  # noqa: F401

internal_sio = get_internal_sio()


@internal_sio.on("test_start")  # type: ignore
async def test_start_handler_new(data: dict[str, Any]) -> None:
    await test_start_internal_impl(data)
