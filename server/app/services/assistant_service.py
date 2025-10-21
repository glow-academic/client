"""Assistant service layer - business logic for assistant agent execution."""

import json
from datetime import UTC
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore

from app.cache import keys
from app.queries.assistant_queries import AssistantQueries
from app.schemas.assistant import AssistantRunContext
from app.services.base_service import BaseService, with_cache


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
        Get all data needed to run assistant agent in ONE optimized query.

        This method reduces database round trips by fetching chat/profile/agent/
        model/provider/messages/tool_calls all in a single query with JSONB aggregation.

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

        # Get all context data in ONE optimized query
        query, params = self.queries.get_assistant_run_context_complete(
            chat_id_str, department_id_str
        )
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError(
                f"Chat {chat_id_str} not found or no assistant agent configured for department {department_id_str}"
            )

        # Parse messages from JSONB (may be string or list)
        messages: list[dict[str, Any]] = []
        messages_data = result["messages"]
        if isinstance(messages_data, str):
            messages_data = json.loads(messages_data)
        if messages_data and isinstance(messages_data, list):
            messages = messages_data

        # Parse tool_calls from JSONB (may be string or list)
        tool_calls: list[dict[str, Any]] = []
        tool_calls_data = result["tool_calls"]
        if isinstance(tool_calls_data, str):
            tool_calls_data = json.loads(tool_calls_data)
        if tool_calls_data and isinstance(tool_calls_data, list):
            tool_calls = tool_calls_data

        # Build and return context
        return AssistantRunContext(
            # Chat data
            chat_id=result["chat_id"],
            title=result["title"],
            trace_id=result["trace_id"],
            profile_id=result["profile_id"],
            # Profile data
            user_role=result["user_role"],
            user_first_name=result["user_first_name"],
            user_last_name=result["user_last_name"],
            # Agent data
            agent_id=result["agent_id"],
            agent_name=result["agent_name"],
            system_prompt=result["system_prompt"],
            temperature=float(result["temperature"]),
            reasoning=result["reasoning"],
            # Model data
            model_id=result["model_id"],
            model_name=result["model_name"],
            custom_model=result["custom_model"],
            # Provider data
            provider_id=result["provider_id"],
            provider_name=result["provider_name"],
            base_url=result["base_url"],
            api_key=result["api_key"],
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

        cutoff_date = datetime.now(UTC) - timedelta(days=days)

        # Get all usage data in ONE optimized query (eliminates N+1)
        query, params = self.queries.get_usage_stats_complete(cutoff_date)
        result = await self.conn.fetchrow(query, *params)

        # Helper to parse datetime from JSONB (may be string or datetime)
        def parse_datetime(val: Any) -> datetime:
            if isinstance(val, str):
                # Parse ISO format string to timezone-aware datetime
                dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
                # Ensure timezone-aware
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=UTC)
                return dt
            # If already datetime, ensure it's timezone-aware
            if isinstance(val, datetime) and val.tzinfo is None:
                return val.replace(tzinfo=UTC)
            return val  # type: ignore

        # Parse chats from JSONB (may be string or list)
        chats = []
        chats_data = result["chats"]
        if isinstance(chats_data, str):
            chats_data = json.loads(chats_data)
        if chats_data and isinstance(chats_data, list):
            # Convert created_at strings to datetime objects
            chats = [
                {**c, "created_at": parse_datetime(c.get("created_at"))}
                if c.get("created_at")
                else c
                for c in chats_data
            ]

        # Parse messages from JSONB (may be string or list)
        messages = []
        messages_data = result["messages"]
        if isinstance(messages_data, str):
            messages_data = json.loads(messages_data)
        if messages_data and isinstance(messages_data, list):
            # Convert created_at strings to datetime objects
            messages = [
                {**m, "created_at": parse_datetime(m.get("created_at"))}
                if m.get("created_at")
                else m
                for m in messages_data
            ]

        # Parse tool_calls from JSONB (may be string or list)
        tool_calls = []
        tool_calls_data = result["tool_calls"]
        if isinstance(tool_calls_data, str):
            tool_calls_data = json.loads(tool_calls_data)
        if tool_calls_data and isinstance(tool_calls_data, list):
            # Convert created_at strings to datetime objects
            tool_calls = [
                {**tc, "created_at": parse_datetime(tc.get("created_at"))}
                if tc.get("created_at")
                else tc
                for tc in tool_calls_data
            ]

        # Parse top users profiles from JSONB (may be string or list)
        top_users_profiles_raw = []
        top_users_data = result["top_users_profiles"]
        if isinstance(top_users_data, str):
            top_users_data = json.loads(top_users_data)
        if top_users_data and isinstance(top_users_data, list):
            top_users_profiles_raw = top_users_data

        # Overall summary
        total_chats = len(chats)
        total_messages = len(messages)
        total_tool_calls = len(tool_calls)

        # Count unique users
        unique_users = len(
            set(chat["profile_id"] for chat in chats if chat.get("profile_id"))
        )

        # Count completed vs incomplete
        completed_chats = len(
            [
                chat
                for chat in chats
                if any(
                    msg.get("completed")
                    for msg in messages
                    if msg.get("chat_id") == chat.get("id")
                )
            ]
        )

        completed_tool_calls = len([tc for tc in tool_calls if tc.get("completed")])

        # Daily breakdown
        daily_stats = []
        for i in range(days):
            day_start = cutoff_date + timedelta(days=i)
            day_end = day_start + timedelta(days=1)

            day_chats = [c for c in chats if day_start <= c.get("created_at") < day_end]  # type: ignore
            day_messages = [
                m
                for m in messages
                if day_start <= m.get("created_at") < day_end  # type: ignore
            ]
            day_tool_calls = [
                tc
                for tc in tool_calls
                if day_start <= tc.get("created_at") < day_end  # type: ignore
            ]

            daily_stats.append(
                {
                    "date": day_start.strftime("%Y-%m-%d"),
                    "chats": len(day_chats),
                    "messages": len(day_messages),
                    "tool_calls": len(day_tool_calls),
                    "unique_users": len(
                        set(
                            c.get("profile_id")
                            for c in day_chats
                            if c.get("profile_id")
                        )
                    ),
                }
            )

        # Build top users list from pre-fetched profiles
        top_users = []
        for user_profile in top_users_profiles_raw:
            if isinstance(user_profile, dict):
                user_id = user_profile.get("user_id")
                chat_count = user_profile.get("chat_count", 0)

                # Calculate message and tool call counts for this user
                user_chats_ids = [
                    c.get("id") for c in chats if c.get("profile_id") == user_id
                ]
                user_messages = len(
                    [m for m in messages if m.get("chat_id") in user_chats_ids]
                )
                user_tool_calls = len(
                    [tc for tc in tool_calls if tc.get("chat_id") in user_chats_ids]
                )

                name = f"{user_profile.get('first_name', '')} {user_profile.get('last_name', '')}".strip()
                if not name:
                    name = user_profile.get("alias", "")

                top_users.append(
                    {
                        "user_id": user_id,
                        "name": name,
                        "alias": user_profile.get("alias", ""),
                        "role": user_profile.get("role", ""),
                        "chat_count": chat_count,
                        "message_count": user_messages,
                        "tool_call_count": user_tool_calls,
                    }
                )

        # Tool usage breakdown
        tool_usage: dict[str, int] = {}
        for tc in tool_calls:
            tool_name = tc.get("tool_name")
            if tool_name:
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
