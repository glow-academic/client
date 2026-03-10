"""Tests for MCP utility helpers."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.utils.mcp.get_mcp import parse_mcp_header
from app.utils.mcp.get_mcp_profile_id import resolve_mcp_profile_id


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

