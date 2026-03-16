"""Backwards-compat shim — canonical location is app.infra.test.run."""

from typing import Any

from app.infra.globals import get_internal_sio
from app.infra.test.run import test_run_internal_impl as test_run_internal_impl  # noqa: F401

internal_sio = get_internal_sio()


@internal_sio.on("test_run")  # type: ignore
async def test_run_handler(data: dict[str, Any]) -> None:
    await test_run_internal_impl(data)
