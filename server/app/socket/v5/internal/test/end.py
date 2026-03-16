"""Backwards-compat shim — canonical location is app.infra.test.end."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.test.end import test_end_internal_impl as test_end_internal_impl  # noqa: F401

internal_sio = get_internal_sio()


@internal_sio.on("test_end")  # type: ignore
async def test_end_handler(data: dict[str, Any]) -> None:
    await test_end_internal_impl(data)
