"""Backwards-compat shim — canonical location is app.infra.test.group."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.test.group import test_group_internal_impl as test_group_internal_impl  # noqa: F401

internal_sio = get_internal_sio()


@internal_sio.on("test_group")  # type: ignore
async def test_group_handler(data: dict[str, Any]) -> None:
    await test_group_internal_impl(data)
