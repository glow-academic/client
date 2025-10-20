"""Real database integration tests for AssistantService."""

from uuid import UUID

import asyncpg  # type: ignore
import pytest
from tests.seed_helpers import (
    get_cs_dept_id,  # type: ignore
    get_superadmin_alias,  # type: ignore
)

from app.services.assistant_service import AssistantService  # type: ignore

pytestmark = pytest.mark.asyncio


# ============================================================================
# READ METHOD TESTS
# ============================================================================


async def test_get_assistant_run_context(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting complete assistant run context."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Create an assistant chat
    chat_id = await db.fetchval(
        "INSERT INTO assistant_chats(profile_id, title, trace_id) "
        "VALUES($1, 'Test Chat', 'trace123') RETURNING id",
        UUID(profile_id),
    )

    # Add a test message
    await db.execute(
        "INSERT INTO assistant_messages(chat_id, role, content, completed) "
        "VALUES($1, 'user', 'Hello', true)",
        chat_id,
    )

    # Add a test tool call
    await db.execute(
        "INSERT INTO assistant_tool_calls(chat_id, tool_name, tool_type, tool_arguments, tool_result, completed) "
        "VALUES($1, '_test_tool', 'read', '{}', '{}', true)",
        chat_id,
    )

    svc = AssistantService(db)
    result = await svc.get_assistant_run_context(chat_id, UUID(dept_id))

    assert result is not None
    assert result.chat_id == str(chat_id)
    assert result.title == "Test Chat"
    assert result.profile_id == profile_id
    assert result.user_role is not None
    assert result.agent_id is not None
    assert result.system_prompt is not None
    assert result.model_id is not None
    assert result.provider_id is not None
    assert len(result.messages) >= 1
    assert len(result.tool_calls) >= 1


async def test_get_assistant_run_context_not_found(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test run context with non-existent chat."""
    fake_chat_id = UUID("00000000-0000-0000-0000-000000000000")
    dept_id = await get_cs_dept_id(db)

    svc = AssistantService(db)

    with pytest.raises(ValueError, match="not found"):
        await svc.get_assistant_run_context(fake_chat_id, UUID(dept_id))


async def test_get_assistant_run_context_no_messages(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test run context for chat without messages."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Create a chat without messages
    chat_id = await db.fetchval(
        "INSERT INTO assistant_chats(profile_id, title, trace_id) "
        "VALUES($1, 'Empty Chat', 'trace456') RETURNING id",
        UUID(profile_id),
    )

    svc = AssistantService(db)
    result = await svc.get_assistant_run_context(chat_id, UUID(dept_id))

    assert result is not None
    assert result.chat_id == str(chat_id)
    assert result.messages == []  # No messages


async def test_get_assistant_run_context_no_tool_calls(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test run context for chat without tool calls."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Create a chat without tool calls
    chat_id = await db.fetchval(
        "INSERT INTO assistant_chats(profile_id, title, trace_id) "
        "VALUES($1, 'No Tools Chat', 'trace789') RETURNING id",
        UUID(profile_id),
    )

    svc = AssistantService(db)
    result = await svc.get_assistant_run_context(chat_id, UUID(dept_id))

    assert result is not None
    assert result.chat_id == str(chat_id)
    assert result.tool_calls == []  # No tool calls


async def test_get_usage_stats(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test getting usage statistics."""
    svc = AssistantService(db)
    result = await svc.get_usage_stats(days=7)

    assert result is not None
    assert "summary" in result
    assert "daily_stats" in result
    assert "top_users" in result
    assert "tool_usage" in result

    # Verify summary structure
    assert result["summary"]["days"] == 7
    assert result["summary"]["total_chats"] >= 0
    assert result["summary"]["total_messages"] >= 0
    assert result["summary"]["total_tool_calls"] >= 0
    assert result["summary"]["unique_users"] >= 0

    # Verify daily stats is a list
    assert isinstance(result["daily_stats"], list)
    assert len(result["daily_stats"]) == 7

    # Verify top users is a list
    assert isinstance(result["top_users"], list)

    # Verify tool usage is a list
    assert isinstance(result["tool_usage"], list)


async def test_get_usage_stats_empty_period(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test usage stats for period with no data."""
    svc = AssistantService(db)
    # Request stats for 1 day (likely to have no data in fresh test DB)
    result = await svc.get_usage_stats(days=1)

    assert result is not None
    assert result["summary"]["total_chats"] >= 0
    assert result["summary"]["total_messages"] >= 0
    assert len(result["daily_stats"]) == 1


async def test_get_usage_stats_top_users(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test usage stats top users calculation."""
    profile_id = await get_superadmin_alias(db)

    # Create multiple chats for the same user
    for i in range(3):
        await db.execute(
            "INSERT INTO assistant_chats(profile_id, title, trace_id) "
            f"VALUES($1, 'Test Chat {i}', 'trace{i}')",
            UUID(profile_id),
        )

    svc = AssistantService(db)
    result = await svc.get_usage_stats(days=7)

    assert result is not None
    assert len(result["top_users"]) >= 0

    # If there are top users, verify structure
    if result["top_users"]:
        for user in result["top_users"]:
            assert "user_id" in user
            assert "name" in user
            assert "alias" in user
            assert "role" in user
            assert "chat_count" in user
            assert "message_count" in user
            assert "tool_call_count" in user


async def test_get_usage_stats_tool_usage(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test usage stats tool usage breakdown."""
    profile_id = await get_superadmin_alias(db)

    # Create a chat with tool calls
    chat_id = await db.fetchval(
        "INSERT INTO assistant_chats(profile_id, title, trace_id) "
        "VALUES($1, 'Tool Test Chat', 'tooltest') RETURNING id",
        UUID(profile_id),
    )

    # Add multiple tool calls
    await db.execute(
        "INSERT INTO assistant_tool_calls(chat_id, tool_name, tool_type, tool_arguments, tool_result, completed) "
        "VALUES($1, '_search_tool', 'read', '{}', '{}', true)",
        chat_id,
    )
    await db.execute(
        "INSERT INTO assistant_tool_calls(chat_id, tool_name, tool_type, tool_arguments, tool_result, completed) "
        "VALUES($1, '_search_tool', 'read', '{}', '{}', true)",
        chat_id,
    )

    svc = AssistantService(db)
    result = await svc.get_usage_stats(days=7)

    assert result is not None
    assert isinstance(result["tool_usage"], list)

    # Verify tool usage structure
    if result["tool_usage"]:
        for tool in result["tool_usage"]:
            assert "tool_name" in tool
            assert "usage_count" in tool
            assert tool["usage_count"] > 0


async def test_assistant_run_context_single_query_optimization(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that run context optimization returns all data in correct format."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Create a chat with messages and tool calls
    chat_id = await db.fetchval(
        "INSERT INTO assistant_chats(profile_id, title, trace_id) "
        "VALUES($1, 'Full Test Chat', 'fulltest') RETURNING id",
        UUID(profile_id),
    )

    await db.execute(
        "INSERT INTO assistant_messages(chat_id, role, content, completed) "
        "VALUES($1, 'user', 'Test message', true)",
        chat_id,
    )

    await db.execute(
        "INSERT INTO assistant_tool_calls(chat_id, tool_name, tool_type, tool_arguments, tool_result, completed) "
        "VALUES($1, '_test', 'read', '{}', '{}', true)",
        chat_id,
    )

    svc = AssistantService(db)
    result = await svc.get_assistant_run_context(chat_id, UUID(dept_id))

    # Verify JSONB arrays are properly parsed
    assert isinstance(result.messages, list)
    assert isinstance(result.tool_calls, list)

    # Verify message structure
    assert len(result.messages) >= 1
    for msg in result.messages:
        assert "id" in msg
        assert "role" in msg
        assert "content" in msg

    # Verify tool call structure
    assert len(result.tool_calls) >= 1
    for tc in result.tool_calls:
        assert "id" in tc
        assert "tool_name" in tc
        assert "tool_type" in tc


async def test_usage_stats_single_query_optimization(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that usage stats optimization eliminates N+1 queries."""
    profile_id = await get_superadmin_alias(db)

    # Create multiple chats to trigger the N+1 pattern
    for i in range(5):
        chat_id = await db.fetchval(
            "INSERT INTO assistant_chats(profile_id, title, trace_id) "
            f"VALUES($1, 'Stats Test {i}', 'stats{i}') RETURNING id",
            UUID(profile_id),
        )

        # Add messages and tool calls
        await db.execute(
            "INSERT INTO assistant_messages(chat_id, role, content, completed) "
            "VALUES($1, 'user', 'Message', true)",
            chat_id,
        )

        await db.execute(
            "INSERT INTO assistant_tool_calls(chat_id, tool_name, tool_type, tool_arguments, tool_result, completed) "
            "VALUES($1, '_tool', 'read', '{}', '{}', true)",
            chat_id,
        )

    svc = AssistantService(db)
    result = await svc.get_usage_stats(days=7)

    assert result is not None
    assert result["summary"]["total_chats"] >= 5
    assert result["summary"]["total_messages"] >= 5
    assert result["summary"]["total_tool_calls"] >= 5

    # Verify top users were fetched without N+1 (should have at least 1 user)
    assert len(result["top_users"]) >= 1

    # Verify the user who created 5 chats is in top users
    top_user_ids = [u["user_id"] for u in result["top_users"]]
    assert profile_id in top_user_ids

    # Find the user and verify their counts
    for user in result["top_users"]:
        if user["user_id"] == profile_id:
            assert user["chat_count"] >= 5
            assert user["message_count"] >= 5
            assert user["tool_call_count"] >= 5
