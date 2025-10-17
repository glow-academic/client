"""Assistant service layer - business logic for assistant agent execution."""

import asyncio
from typing import Any, Dict, List
from uuid import UUID

import asyncpg  # type: ignore
from app.queries.assistant_queries import AssistantQueries
from app.schemas.assistant import AssistantRunContext


class AssistantService:
    """Service layer for assistant agent operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        self.conn = conn
        self.queries = AssistantQueries()

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
                f"Chat {chat_id} not found or no assistant agent configured for department {department_id}"
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
        messages: List[Dict[str, Any]] = [dict(row) for row in messages_result]
        tool_calls: List[Dict[str, Any]] = [dict(row) for row in tool_calls_result]

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
    ) -> Dict[str, Any]:
        """
        Create a new assistant chat.

        Args:
            profile_id: UUID of the profile
            title: Title for the chat
            trace_id: Trace ID for the chat

        Returns:
            Dict containing chat data (id)
        """
        from datetime import datetime, timezone

        profile_id_str = str(profile_id)
        created_at = datetime.now(timezone.utc)
        query, params = self.queries.create_chat(
            profile_id_str, title, trace_id, created_at
        )
        result = await self.conn.fetchrow(query, *params)
        return {"id": str(result["id"])}

    async def create_user_message(
        self, chat_id: UUID, content: str
    ) -> Dict[str, Any]:
        """
        Create a new user message in the chat.

        Args:
            chat_id: UUID of the assistant chat
            content: Content of the message

        Returns:
            Dict containing message data (id, created_at)
        """
        from datetime import datetime, timezone

        chat_id_str = str(chat_id)
        created_at = datetime.now(timezone.utc)
        query, params = self.queries.create_message(
            chat_id_str, "user", content, True, created_at
        )
        result = await self.conn.fetchrow(query, *params)
        return {
            "id": result["id"],
            "created_at": result["created_at"],
        }

    async def create_assistant_message(self, chat_id: UUID) -> Dict[str, Any]:
        """
        Create a new assistant message placeholder in the chat.

        Args:
            chat_id: UUID of the assistant chat

        Returns:
            Dict containing message data (id, created_at)
        """
        from datetime import datetime, timezone

        chat_id_str = str(chat_id)
        created_at = datetime.now(timezone.utc)
        query, params = self.queries.create_message(
            chat_id_str, "assistant", "", False, created_at
        )
        result = await self.conn.fetchrow(query, *params)
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

    async def create_tool_call(
        self,
        chat_id: UUID,
        tool_name: str,
        tool_type: str,
        tool_arguments: Dict[str, Any],
    ) -> Dict[str, Any]:
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
        from datetime import datetime, timezone

        chat_id_str = str(chat_id)
        tool_arguments_json = json.dumps(tool_arguments)
        created_at = datetime.now(timezone.utc)
        query, params = self.queries.create_tool_call(
            chat_id_str, tool_name, tool_type, tool_arguments_json, created_at
        )
        result = await self.conn.fetchrow(query, *params)
        return {"id": result["id"]}

    async def complete_tool_call(
        self, tool_call_id: UUID, tool_result: Dict[str, Any]
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

