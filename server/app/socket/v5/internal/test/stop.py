"""Backwards-compat shim — canonical location is app.infra.test.stop."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.test.stop import test_stop_internal_impl as test_stop_internal_impl  # noqa: F401

internal_sio = get_internal_sio()


@internal_sio.on("test_stop")  # type: ignore
async def test_stop_handler(data: dict[str, Any]) -> None:
    await test_stop_internal_impl(data)
