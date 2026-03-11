"""Tests for MCP utility helpers."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.utils.logging.db_logger import profile_id_context
from app.utils.mcp.get_mcp import get_mcp, parse_mcp_header
from app.utils.mcp.get_mcp_profile_id import (
    get_mcp_profile_id,
    resolve_mcp_profile_id,
)


@pytest.mark.parametrize(
    ("raw_value", "expected"),
    [
        ("true", True),
        ("TRUE", True),
        ("1", True),
        (" yes ", True),
        ("false", False),
        ("0", False),
        (None, False),
    ],
)
def test_parse_mcp_header(raw_value, expected):
    assert parse_mcp_header(raw_value) is expected


def test_resolve_mcp_profile_id_prefers_request_state():
    request = SimpleNamespace(state=SimpleNamespace(profile_id="profile-123"))

    assert resolve_mcp_profile_id(request, "fallback-456") == "profile-123"


def test_resolve_mcp_profile_id_uses_context_fallback_without_request():
    assert resolve_mcp_profile_id(None, "fallback-456") == "fallback-456"


def test_resolve_mcp_profile_id_raises_when_request_has_no_profile():
    request = SimpleNamespace(state=SimpleNamespace(profile_id=None))

    with pytest.raises(HTTPException) as exc_info:
        resolve_mcp_profile_id(request)

    assert exc_info.value.status_code == 401


def test_resolve_mcp_profile_id_raises_when_nothing_available():
    with pytest.raises(HTTPException) as exc_info:
        resolve_mcp_profile_id(None)

    assert exc_info.value.status_code == 500


@pytest.mark.asyncio
async def test_get_mcp_sets_request_state_and_returns_boolean():
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [],
        }
    )

    result = await get_mcp(request, x_mcp="yes")

    assert result is True
    assert request.state.mcp is True


def test_get_mcp_profile_id_uses_injected_request_getter():
    request = SimpleNamespace(state=SimpleNamespace(profile_id="profile-123"))

    assert get_mcp_profile_id(request_getter=lambda: request) == "profile-123"


def test_get_mcp_profile_id_falls_back_to_context_when_request_getter_fails():
    token = profile_id_context.set("context-profile-456")
    try:
        assert (
            get_mcp_profile_id(
                request_getter=lambda: (_ for _ in ()).throw(RuntimeError("no request"))
            )
            == "context-profile-456"
        )
    finally:
        profile_id_context.reset(token)
