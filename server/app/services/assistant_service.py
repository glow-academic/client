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

