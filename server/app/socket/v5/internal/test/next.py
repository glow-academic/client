"""Backwards-compat shim — canonical location is app.infra.test.next."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.test.next import test_next_internal_impl as test_next_internal_impl  # noqa: F401

internal_sio = get_internal_sio()


@internal_sio.on("test_next")  # type: ignore
async def test_next_handler(data: dict[str, Any]) -> None:
    await test_next_internal_impl(data)
