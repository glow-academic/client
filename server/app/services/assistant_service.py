"""Assistant service layer - business logic for assistant agent execution."""

import asyncio
from datetime import UTC
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore

from app.cache import keys
from app.queries.assistant_queries import AssistantQueries
from app.schemas.assistant import AssistantRunContext
from app.services.base import BaseService, with_cache


class AssistantService(BaseService):
    """Service layer for assistant agent operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        super().__init__(conn)
        self.queries = AssistantQueries()

    @with_cache(
        lambda self, chat_id, department_id: keys.assistant_run_context(
            str(chat_id), str(department_id)
        )
    )
    async def get_assistant_run_context(
        self, chat_id: UUID, department_id: UUID
    ) -> AssistantRunContext:
        """
        Get all data needed to run assistant agent with optimized queries.

        This method reduces database round trips by:
        1. Fetching chat/profile/agent/model/provider in one JOIN query
        2. Fetching messages and tool calls in parallel

        Args:
            chat_id: UUID of the assistant chat
            department_id: UUID of the department

        Returns:
            AssistantRunContext with all required data

        Raises:
            ValueError: If chat not found or agent not configured for department
        """
        chat_id_str = str(chat_id)
        department_id_str = str(department_id)

        # 1. Get main context with optimized JOIN query
        query, params = self.queries.get_assistant_run_context(
            chat_id_str, department_id_str
        )
        context_row = await self.conn.fetchrow(query, *params)

        if not context_row:
            raise ValueError(
                f"Chat {chat_id_str} not found or no assistant agent configured for department {department_id_str}"
            )

        # 2. Get messages and tool calls in parallel
        messages_query, messages_params = self.queries.get_messages_for_chat(
            chat_id_str
        )
        tool_calls_query, tool_calls_params = self.queries.get_tool_calls_for_chat(
            chat_id_str
        )

        messages_result, tool_calls_result = await asyncio.gather(
            self.conn.fetch(messages_query, *messages_params),
            self.conn.fetch(tool_calls_query, *tool_calls_params),
        )

        # 3. Convert database records to dicts
        messages: list[dict[str, Any]] = [dict(row) for row in messages_result]
        tool_calls: list[dict[str, Any]] = [dict(row) for row in tool_calls_result]

        # 4. Build and return context
        return AssistantRunContext(
            # Chat data
            chat_id=context_row["chat_id"],
            title=context_row["title"],
            trace_id=context_row["trace_id"],
            profile_id=context_row["profile_id"],
            # Profile data
            user_role=context_row["user_role"],
            user_first_name=context_row["user_first_name"],
            user_last_name=context_row["user_last_name"],
            # Agent data
            agent_id=context_row["agent_id"],
            agent_name=context_row["agent_name"],
            system_prompt=context_row["system_prompt"],
            temperature=float(context_row["temperature"]),
            reasoning=context_row["reasoning"],
            # Model data
            model_id=context_row["model_id"],
            model_name=context_row["model_name"],
            custom_model=context_row["custom_model"],
            # Provider data
            provider_id=context_row["provider_id"],
            provider_name=context_row["provider_name"],
            base_url=context_row["base_url"],
            api_key=context_row["api_key"],
            # Conversation data
            messages=messages,
            tool_calls=tool_calls,
        )

    async def update_chat_title(self, chat_id: UUID, title: str) -> None:
        """
        Update the title of an assistant chat.

        Args:
            chat_id: UUID of the assistant chat
            title: New title for the chat
        """
        chat_id_str = str(chat_id)
        query, params = self.queries.update_chat_title(chat_id_str, title)
        await self.conn.execute(query, *params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_assistant_by_chat_id(chat_id_str),
                keys.tag_assistant_all(),
            ]
        )

    async def verify_profile_exists(self, profile_id: UUID) -> bool:
        """
        Verify that a profile exists.

        Args:
            profile_id: UUID of the profile

        Returns:
            True if profile exists, False otherwise
        """
        profile_id_str = str(profile_id)
        query, params = self.queries.verify_profile_exists(profile_id_str)
        result = await self.conn.fetchrow(query, *params)
        return result is not None

    async def verify_chat_exists(self, chat_id: UUID) -> bool:
        """
        Verify that an assistant chat exists.

        Args:
            chat_id: UUID of the assistant chat

        Returns:
            True if chat exists, False otherwise
        """
        chat_id_str = str(chat_id)
        query, params = self.queries.verify_chat_exists(chat_id_str)
        result = await self.conn.fetchrow(query, *params)
        return result is not None

    async def create_chat(
        self, profile_id: UUID, title: str, trace_id: str
    ) -> dict[str, Any]:
        """
        Create a new assistant chat.

        Args:
            profile_id: UUID of the profile
            title: Title for the chat
            trace_id: Trace ID for the chat

        Returns:
            Dict containing chat data (id)
        """
        from datetime import datetime

        profile_id_str = str(profile_id)
        created_at = datetime.now(UTC)
        query, params = self.queries.create_chat(
            profile_id_str, title, trace_id, created_at
        )
        result = await self.conn.fetchrow(query, *params)
        chat_id_str = str(result["id"])

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_assistant_by_chat_id(chat_id_str),
                keys.tag_assistant_all(),
            ]
        )

        return {"id": chat_id_str}

    async def create_user_message(self, chat_id: UUID, content: str) -> dict[str, Any]:
        """
        Create a new user message in the chat.

        Args:
            chat_id: UUID of the assistant chat
            content: Content of the message

        Returns:
            Dict containing message data (id, created_at)
        """
        from datetime import datetime

        chat_id_str = str(chat_id)
        created_at = datetime.now(UTC)
        query, params = self.queries.create_message(
            chat_id_str, "user", content, True, created_at
        )
        result = await self.conn.fetchrow(query, *params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_assistant_by_chat_id(chat_id_str),
                keys.tag_assistant_all(),
            ]
        )

        return {
            "id": result["id"],
            "created_at": result["created_at"],
        }

    async def create_assistant_message(self, chat_id: UUID) -> dict[str, Any]:
        """
        Create a new assistant message placeholder in the chat.

        Args:
            chat_id: UUID of the assistant chat

        Returns:
            Dict containing message data (id, created_at)
        """
        from datetime import datetime

        chat_id_str = str(chat_id)
        created_at = datetime.now(UTC)
        query, params = self.queries.create_message(
            chat_id_str, "assistant", "", False, created_at
        )
        result = await self.conn.fetchrow(query, *params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_assistant_by_chat_id(chat_id_str),
                keys.tag_assistant_all(),
            ]
        )

        return {
            "id": result["id"],
            "created_at": result["created_at"],
        }

    async def update_message_content(self, message_id: UUID, content: str) -> None:
        """
        Update the content of an assistant message.

        Args:
            message_id: UUID of the message
            content: New content for the message
        """
        message_id_str = str(message_id)
        query, params = self.queries.update_message_content(message_id_str, content)
        await self.conn.execute(query, *params)

        # Invalidate caches (coarse-grained since we don't have chat_id)
        await self._invalidate_cache([keys.tag_assistant_all()])

    async def complete_message(self, message_id: UUID, content: str) -> None:
        """
        Mark a message as completed and update its content.

        Args:
            message_id: UUID of the message
            content: Final content for the message
        """
        message_id_str = str(message_id)
        query, params = self.queries.complete_message(message_id_str, content, True)
        await self.conn.execute(query, *params)

        # Invalidate caches (coarse-grained since we don't have chat_id)
        await self._invalidate_cache([keys.tag_assistant_all()])

    async def create_tool_call(
        self,
        chat_id: UUID,
        tool_name: str,
        tool_type: str,
        tool_arguments: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Create a new assistant tool call.

        Args:
            chat_id: UUID of the assistant chat
            tool_name: Name of the tool being called
            tool_type: Type of tool operation (read/create/update/delete)
            tool_arguments: Dict of tool arguments

        Returns:
            Dict containing tool call data (id)
        """
        import json
        from datetime import datetime

        chat_id_str = str(chat_id)
        tool_arguments_json = json.dumps(tool_arguments)
        created_at = datetime.now(UTC)
        query, params = self.queries.create_tool_call(
            chat_id_str, tool_name, tool_type, tool_arguments_json, created_at
        )
        result = await self.conn.fetchrow(query, *params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_assistant_by_chat_id(chat_id_str),
                keys.tag_assistant_all(),
            ]
        )

        return {"id": result["id"]}

    async def complete_tool_call(
        self, tool_call_id: UUID, tool_result: dict[str, Any]
    ) -> None:
        """
        Update a tool call with its result and mark as completed.

        Args:
            tool_call_id: UUID of the tool call
            tool_result: Dict of tool result
        """
        import json

        tool_call_id_str = str(tool_call_id)
        tool_result_json = json.dumps(tool_result)
        query, params = self.queries.update_tool_call_result(
            tool_call_id_str, tool_result_json, True
        )
        await self.conn.execute(query, *params)

        # Invalidate caches (coarse-grained since we don't have chat_id)
        await self._invalidate_cache([keys.tag_assistant_all()])

    @with_cache(
        lambda self, days=7: keys.assistant_usage_stats(days),
        fresh_ttl=60,
        stale_ttl=600,
    )
    async def get_usage_stats(self, days: int = 7) -> dict[str, Any]:
        """
        Get assistant usage statistics over a time period.

        Args:
            days: Number of days to analyze (default 7)

        Returns:
            Dict containing summary, daily_stats, top_users, and tool_usage
        """
        from datetime import datetime, timedelta

        cutoff_date = datetime.now() - timedelta(days=days)

        # Fetch data in parallel
        chats_query, chats_params = self.queries.get_chats_in_timeframe(cutoff_date)
        messages_query, messages_params = self.queries.get_messages_in_timeframe(
            cutoff_date
        )
        tool_calls_query, tool_calls_params = self.queries.get_tool_calls_in_timeframe(
            cutoff_date
        )

        chats_rows, messages_rows, tool_calls_rows = await asyncio.gather(
            self.conn.fetch(chats_query, *chats_params),
            self.conn.fetch(messages_query, *messages_params),
            self.conn.fetch(tool_calls_query, *tool_calls_params),
        )

        # Convert to lists of dicts for easier processing
        chats = [dict(row) for row in chats_rows]
        messages = [dict(row) for row in messages_rows]
        tool_calls = [dict(row) for row in tool_calls_rows]

        # Overall summary
        total_chats = len(chats)
        total_messages = len(messages)
        total_tool_calls = len(tool_calls)

        # Count unique users
        unique_users = len(
            set(chat["profile_id"] for chat in chats if chat["profile_id"])
        )

        # Count completed vs incomplete
        completed_chats = len(
            [
                chat
                for chat in chats
                if any(
                    msg["completed"] for msg in messages if msg["chat_id"] == chat["id"]
                )
            ]
        )

        completed_tool_calls = len([tc for tc in tool_calls if tc["completed"]])

        # Daily breakdown
        daily_stats = []
        for i in range(days):
            day_start = cutoff_date + timedelta(days=i)
            day_end = day_start + timedelta(days=1)

            day_chats = [c for c in chats if day_start <= c["created_at"] < day_end]
            day_messages = [
                m for m in messages if day_start <= m["created_at"] < day_end
            ]
            day_tool_calls = [
                tc for tc in tool_calls if day_start <= tc["created_at"] < day_end
            ]

            daily_stats.append(
                {
                    "date": day_start.strftime("%Y-%m-%d"),
                    "chats": len(day_chats),
                    "messages": len(day_messages),
                    "tool_calls": len(day_tool_calls),
                    "unique_users": len(
                        set(c["profile_id"] for c in day_chats if c["profile_id"])
                    ),
                }
            )

        # Top users by chat count
        user_chat_counts: dict[Any, int] = {}
        for chat in chats:
            if chat["profile_id"]:
                user_chat_counts[chat["profile_id"]] = (
                    user_chat_counts.get(chat["profile_id"], 0) + 1
                )

        # Get user details for top users
        top_users = []
        for profile_id, chat_count in sorted(
            user_chat_counts.items(), key=lambda x: x[1], reverse=True
        )[:10]:
            profile_query, profile_params = self.queries.get_profile_by_id(profile_id)
            profile_row = await self.conn.fetchrow(profile_query, *profile_params)

            if profile_row:
                user_messages = len(
                    [
                        m
                        for m in messages
                        if m["chat_id"]
                        in [c["id"] for c in chats if c["profile_id"] == profile_id]
                    ]
                )
                user_tool_calls = len(
                    [
                        tc
                        for tc in tool_calls
                        if tc["chat_id"]
                        in [c["id"] for c in chats if c["profile_id"] == profile_id]
                    ]
                )

                name = f"{profile_row['first_name']} {profile_row['last_name']}".strip()
                if not name:
                    name = profile_row["alias"]

                top_users.append(
                    {
                        "user_id": str(profile_row["id"]),
                        "name": name,
                        "alias": profile_row["alias"],
                        "role": profile_row["role"],
                        "chat_count": chat_count,
                        "message_count": user_messages,
                        "tool_call_count": user_tool_calls,
                    }
                )

        # Tool usage breakdown
        tool_usage: dict[str, int] = {}
        for tc in tool_calls:
            tool_name = tc["tool_name"]
            tool_usage[tool_name] = tool_usage.get(tool_name, 0) + 1

        tool_usage_list = [
            {"tool_name": name, "usage_count": count}
            for name, count in sorted(
                tool_usage.items(), key=lambda x: x[1], reverse=True
            )
        ]

        summary = {
            "analysis_period": f"{cutoff_date.strftime('%Y-%m-%d')} to {datetime.now().strftime('%Y-%m-%d')}",
            "days": days,
            "total_chats": total_chats,
            "total_messages": total_messages,
            "total_tool_calls": total_tool_calls,
            "unique_users": unique_users,
            "completed_chats": completed_chats,
            "completed_tool_calls": completed_tool_calls,
            "avg_chats_per_day": round(total_chats / days, 1) if days > 0 else 0,
            "avg_messages_per_chat": round(total_messages / total_chats, 1)
            if total_chats > 0
            else 0,
            "avg_tool_calls_per_chat": round(total_tool_calls / total_chats, 1)
            if total_chats > 0
            else 0,
        }

        return {
            "summary": summary,
            "daily_stats": daily_stats,
            "top_users": top_users,
            "tool_usage": tool_usage_list,
        }


def get_assistant_service(conn: asyncpg.Connection) -> AssistantService:
    """Get assistant service instance."""
    return AssistantService(conn)
