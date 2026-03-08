"""Tests for infra.auth.generate — group messages via canonical black boxes.

resolve_group_messages is tested with mocked black-box fetchers.
Tests verify: correct arguments flow, chaining, error cases.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.auth.generate import GroupMessagesResult, resolve_group_messages
from app.routes.v5.tools.entries.groups.types import GetGroupResponse
from app.routes.v5.tools.entries.messages.types import SearchMessageResponse
from app.routes.v5.tools.entries.runs.search import RunViewItem

NOW = datetime.now(UTC)
MODULE = "app.infra.auth.generate"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _group(*, group_id=None, name="Test Group", session_id=None) -> GetGroupResponse:
    return GetGroupResponse(
        id=group_id or uuid4(),
        session_id=session_id or uuid4(),
        created_at=NOW,
        name=name,
        active=True,
        mcp=False,
        generated=False,
    )


def _run(*, run_id=None, group_id=None) -> RunViewItem:
    return RunViewItem(
        run_id=run_id or uuid4(),
        group_id=group_id or uuid4(),
        profiles_id=uuid4(),
        input_tokens=0,
        output_tokens=0,
        cached_input_tokens=0,
        run_created_at=NOW,
        agent_ids=[],
        model_ids=[],
        provider_ids=[],
        input_pricing_count=0,
        input_pricing_pricing_id=None,
        output_pricing_count=0,
        output_pricing_pricing_id=None,
        cached_pricing_count=0,
        cached_pricing_pricing_id=None,
    )


def _message(*, message_id=None, run_id=None, role="user") -> SearchMessageResponse:
    return SearchMessageResponse(
        message_id=message_id or uuid4(),
        run_id=run_id or uuid4(),
        role=role,
        message_created_at=NOW,
        text_upload_ids=[],
        audio_upload_ids=[],
        image_upload_ids=[],
        video_upload_ids=[],
        file_upload_ids=[],
        call_upload_ids=[],
    )


def _patch(target, return_value):
    return patch(
        f"{MODULE}.{target}", new_callable=AsyncMock, return_value=return_value
    )


# ═══════════════════════════════════════════════════════════════════════════
# resolve_group_messages — success
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveGroupMessagesSuccess:
    async def test_returns_full_result(self):
        group_id = uuid4()
        session_id = uuid4()
        run_id = uuid4()
        group = _group(group_id=group_id, name="My Group", session_id=session_id)
        run = _run(run_id=run_id, group_id=group_id)
        msg1 = _message(run_id=run_id, role="user")
        msg2 = _message(run_id=run_id, role="assistant")

        with (
            _patch("get_groups", [group]),
            _patch("search_runs", ([run], 1)),
            _patch("search_messages", ([msg1, msg2], 2)),
        ):
            result = await resolve_group_messages(None, group_id=group_id)

        assert isinstance(result, GroupMessagesResult)
        assert result.group_id == group_id
        assert result.group_name == "My Group"
        assert result.session_id == session_id
        assert len(result.messages) == 2
        assert result.total_message_count == 2

    async def test_passes_run_ids_to_search_messages(self):
        group_id = uuid4()
        run_id1 = uuid4()
        run_id2 = uuid4()
        group = _group(group_id=group_id)
        run1 = _run(run_id=run_id1, group_id=group_id)
        run2 = _run(run_id=run_id2, group_id=group_id)

        with (
            _patch("get_groups", [group]),
            _patch("search_runs", ([run1, run2], 2)),
            _patch("search_messages", ([], 0)) as mock_messages,
        ):
            await resolve_group_messages(None, group_id=group_id)

        call_kwargs = mock_messages.call_args[1]
        assert set(call_kwargs["run_ids"]) == {run_id1, run_id2}
        assert call_kwargs["roles"] == ["user", "assistant"]
        assert call_kwargs["sort_order"] == "asc"

    async def test_passes_pagination_params(self):
        group_id = uuid4()
        group = _group(group_id=group_id)
        run = _run(group_id=group_id)

        with (
            _patch("get_groups", [group]),
            _patch("search_runs", ([run], 1)),
            _patch("search_messages", ([], 0)) as mock_messages,
        ):
            await resolve_group_messages(
                None, group_id=group_id, page_limit=10, page_offset=20
            )

        call_kwargs = mock_messages.call_args[1]
        assert call_kwargs["limit"] == 10
        assert call_kwargs["offset"] == 20


# ═══════════════════════════════════════════════════════════════════════════
# resolve_group_messages — not found / empty cases
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveGroupMessagesNotFound:
    async def test_group_not_found_returns_none(self):
        with _patch("get_groups", []):
            result = await resolve_group_messages(None, group_id=uuid4())
        assert result is None

    async def test_no_runs_returns_empty_messages(self):
        group_id = uuid4()
        group = _group(group_id=group_id, name="Empty")

        with (
            _patch("get_groups", [group]),
            _patch("search_runs", ([], 0)),
        ):
            result = await resolve_group_messages(None, group_id=group_id)

        assert result is not None
        assert result.group_name == "Empty"
        assert result.messages == []
        assert result.total_message_count == 0

    async def test_no_messages_returns_empty_list(self):
        group_id = uuid4()
        group = _group(group_id=group_id)
        run = _run(group_id=group_id)

        with (
            _patch("get_groups", [group]),
            _patch("search_runs", ([run], 1)),
            _patch("search_messages", ([], 0)),
        ):
            result = await resolve_group_messages(None, group_id=group_id)

        assert result is not None
        assert result.messages == []
        assert result.total_message_count == 0
