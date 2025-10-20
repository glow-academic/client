"""Assistant queries for v2 API endpoints."""

from datetime import datetime
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore


class AssistantQueries:
    """Query builders for assistant operations."""

    def get_assistant_run_context(
        self, chat_id: str, department_id: str
    ) -> tuple[str, list[Any]]:
        """
        Get all data needed to run assistant agent with optimized JOIN query.

        Fetches chat, profile, agent (via department_agents), model, and provider
        in a single query to minimize database round trips.

        Args:
            chat_id: UUID of the assistant chat
            department_id: UUID of the department

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            -- Chat data
            ac.id::text as chat_id,
            ac.title,
            ac.trace_id,
            ac.profile_id::text,
            
            -- Profile data
            p.role as user_role,
            p.first_name as user_first_name,
            p.last_name as user_last_name,
            
            -- Agent data (via department_agents junction)
            a.id::text as agent_id,
            a.name as agent_name,
            a.system_prompt,
            a.temperature,
            a.reasoning,
            
            -- Model data
            m.id::text as model_id,
            m.name as model_name,
            m.custom_model,
            
            -- Provider data
            pr.id::text as provider_id,
            pr.name as provider_name,
            COALESCE(pe.base_url, '') as base_url,
            pr.api_key

        FROM assistant_chats ac
        INNER JOIN profiles p ON p.id = ac.profile_id
        INNER JOIN department_agents da ON da.department_id = $2 AND da.role = 'assistant'
        INNER JOIN agents a ON a.id = da.agent_id
        INNER JOIN models m ON m.id = a.model_id
        INNER JOIN providers pr ON pr.id = m.provider_id
        LEFT JOIN provider_endpoints pe ON pe.provider_id = pr.id AND pe.active = true
        WHERE ac.id = $1
        """

        params: list[Any] = [chat_id, department_id]
        return query, params

    def get_assistant_run_context_complete(
        self, chat_id: str, department_id: str
    ) -> tuple[str, list[Any]]:
        """
        Get complete assistant run context in ONE optimized query.

        Fetches chat, profile, agent, model, provider, messages, and tool calls
        using CTEs and JSONB aggregation to eliminate parallel queries.

        Args:
            chat_id: UUID of the assistant chat
            department_id: UUID of the department

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH chat_context AS (
            SELECT 
                -- Chat data
                ac.id::text as chat_id,
                ac.title,
                ac.trace_id,
                ac.profile_id::text,
                
                -- Profile data
                p.role as user_role,
                p.first_name as user_first_name,
                p.last_name as user_last_name,
                
                -- Agent data (via department_agents junction)
                a.id::text as agent_id,
                a.name as agent_name,
                a.system_prompt,
                a.temperature,
                a.reasoning,
                
                -- Model data
                m.id::text as model_id,
                m.name as model_name,
                m.custom_model,
                
            -- Provider data
            pr.id::text as provider_id,
            pr.name as provider_name,
            COALESCE(pe.base_url, '') as base_url,
            pr.api_key
        FROM assistant_chats ac
        INNER JOIN profiles p ON p.id = ac.profile_id
        INNER JOIN department_agents da ON da.department_id = $2 AND da.role = 'assistant'
        INNER JOIN agents a ON a.id = da.agent_id
        INNER JOIN models m ON m.id = a.model_id
        INNER JOIN providers pr ON pr.id = m.provider_id
        LEFT JOIN provider_endpoints pe ON pe.provider_id = pr.id AND pe.active = true
        WHERE ac.id = $1
        ),
        chat_messages AS (
            SELECT 
                COALESCE(
                    jsonb_agg(jsonb_build_object(
                        'id', id,
                        'created_at', created_at,
                        'updated_at', updated_at,
                        'chat_id', chat_id,
                        'role', role,
                        'content', content,
                        'completed', completed
                    ) ORDER BY created_at ASC),
                    '[]'::jsonb
                ) as messages
            FROM assistant_messages
            WHERE chat_id = $1
        ),
        chat_tool_calls AS (
            SELECT 
                COALESCE(
                    jsonb_agg(jsonb_build_object(
                        'id', id,
                        'created_at', created_at,
                        'updated_at', updated_at,
                        'chat_id', chat_id,
                        'tool_name', tool_name,
                        'tool_type', tool_type,
                        'tool_arguments', tool_arguments,
                        'tool_result', tool_result,
                        'completed', completed
                    ) ORDER BY created_at ASC),
                    '[]'::jsonb
                ) as tool_calls
            FROM assistant_tool_calls
            WHERE chat_id = $1
        )
        SELECT 
            cc.*,
            cm.messages,
            ctc.tool_calls
        FROM chat_context cc
        CROSS JOIN chat_messages cm
        CROSS JOIN chat_tool_calls ctc
        """

        params: list[Any] = [chat_id, department_id]
        return query, params

    def update_chat_title(self, chat_id: str, title: str) -> tuple[str, list[Any]]:
        """
        Update the title of an assistant chat.

        Args:
            chat_id: UUID of the assistant chat
            title: New title for the chat

        Returns:
            Tuple of (query, params)
        """
        query = """
        UPDATE assistant_chats 
        SET title = $1, updated_at = NOW()
        WHERE id = $2
        """

        params: list[Any] = [title, chat_id]
        return query, params

    def verify_profile_exists(self, profile_id: str) -> tuple[str, list[Any]]:
        """
        Verify that a profile exists.

        Args:
            profile_id: UUID of the profile

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT id FROM profiles WHERE id = $1
        """

        params: list[Any] = [profile_id]
        return query, params

    def verify_chat_exists(self, chat_id: str) -> tuple[str, list[Any]]:
        """
        Verify that an assistant chat exists.

        Args:
            chat_id: UUID of the assistant chat

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT id FROM assistant_chats WHERE id = $1
        """

        params: list[Any] = [chat_id]
        return query, params

    def create_chat(
        self, profile_id: str, title: str, trace_id: str, created_at: datetime
    ) -> tuple[str, list[Any]]:
        """
        Create a new assistant chat.

        Args:
            profile_id: UUID of the profile
            title: Title for the chat
            trace_id: Trace ID for the chat
            created_at: Timestamp for chat creation

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO assistant_chats (created_at, title, profile_id, trace_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """

        params: list[Any] = [created_at, title, profile_id, trace_id]
        return query, params

    def create_message(
        self,
        chat_id: str,
        role: str,
        content: str,
        completed: bool,
        created_at: datetime,
    ) -> tuple[str, list[Any]]:
        """
        Create a new assistant message.

        Args:
            chat_id: UUID of the assistant chat
            role: Role of the message sender (user/assistant)
            content: Content of the message
            completed: Whether the message is completed
            created_at: Timestamp for message creation

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO assistant_messages (chat_id, role, content, completed, created_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at
        """

        params: list[Any] = [chat_id, role, content, completed, created_at]
        return query, params

    def update_message_content(
        self, message_id: str, content: str
    ) -> tuple[str, list[Any]]:
        """
        Update the content of an assistant message.

        Args:
            message_id: UUID of the message
            content: New content for the message

        Returns:
            Tuple of (query, params)
        """
        query = """
        UPDATE assistant_messages SET content = $1 WHERE id = $2
        """

        params: list[Any] = [content, message_id]
        return query, params

    def complete_message(
        self, message_id: str, content: str, completed: bool
    ) -> tuple[str, list[Any]]:
        """
        Mark a message as completed and update its content.

        Args:
            message_id: UUID of the message
            content: Final content for the message
            completed: Whether the message is completed

        Returns:
            Tuple of (query, params)
        """
        query = """
        UPDATE assistant_messages SET content = $1, completed = $2 WHERE id = $3
        """

        params: list[Any] = [content, completed, message_id]
        return query, params

    def create_tool_call(
        self,
        chat_id: str,
        tool_name: str,
        tool_type: str,
        tool_arguments: str,
        created_at: datetime,
    ) -> tuple[str, list[Any]]:
        """
        Create a new assistant tool call.

        Args:
            chat_id: UUID of the assistant chat
            tool_name: Name of the tool being called
            tool_type: Type of tool operation (read/create/update/delete)
            tool_arguments: JSON string of tool arguments
            created_at: Timestamp for tool call creation

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO assistant_tool_calls 
        (chat_id, tool_name, tool_type, tool_arguments, tool_result, completed, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        """

        params: list[Any] = [
            chat_id,
            tool_name,
            tool_type,
            tool_arguments,
            "{}",
            False,
            created_at,
        ]
        return query, params

    def update_tool_call_result(
        self, tool_call_id: str, tool_result: str, completed: bool
    ) -> tuple[str, list[Any]]:
        """
        Update a tool call with its result.

        Args:
            tool_call_id: UUID of the tool call
            tool_result: JSON string of tool result
            completed: Whether the tool call is completed

        Returns:
            Tuple of (query, params)
        """
        query = """
        UPDATE assistant_tool_calls SET tool_result = $1, completed = $2 WHERE id = $3
        """

        params: list[Any] = [tool_result, completed, tool_call_id]
        return query, params

    def get_usage_stats_complete(self, cutoff_date: datetime) -> tuple[str, list[Any]]:
        """
        Get complete usage statistics in ONE optimized query.

        Eliminates N+1 queries by fetching chats, messages, tool_calls,
        and top user profiles using CTEs and JSONB aggregation.

        Args:
            cutoff_date: Minimum creation date for analysis

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH chats_data AS (
            SELECT 
                id,
                created_at,
                profile_id
            FROM assistant_chats
            WHERE created_at >= $1
        ),
        messages_data AS (
            SELECT 
                id,
                chat_id,
                completed,
                created_at
            FROM assistant_messages
            WHERE created_at >= $1
        ),
        tool_calls_data AS (
            SELECT 
                id,
                chat_id,
                tool_name,
                completed,
                created_at
            FROM assistant_tool_calls
            WHERE created_at >= $1
        ),
        user_counts AS (
            SELECT 
                profile_id,
                COUNT(*) as chat_count
            FROM chats_data
            WHERE profile_id IS NOT NULL
            GROUP BY profile_id
            ORDER BY chat_count DESC
            LIMIT 10
        ),
        top_users_profiles AS (
            SELECT 
                p.id::text as user_id,
                p.first_name,
                p.last_name,
                p.alias,
                p.role,
                uc.chat_count
            FROM user_counts uc
            JOIN profiles p ON p.id = uc.profile_id
        )
        SELECT
            COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'id', cd.id::text,
                    'created_at', cd.created_at,
                    'profile_id', cd.profile_id::text
                ))
                FROM chats_data cd),
                '[]'::jsonb
            ) as chats,
            COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'id', md.id::text,
                    'chat_id', md.chat_id::text,
                    'completed', md.completed,
                    'created_at', md.created_at
                ))
                FROM messages_data md),
                '[]'::jsonb
            ) as messages,
            COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'id', tcd.id::text,
                    'chat_id', tcd.chat_id::text,
                    'tool_name', tcd.tool_name,
                    'completed', tcd.completed,
                    'created_at', tcd.created_at
                ))
                FROM tool_calls_data tcd),
                '[]'::jsonb
            ) as tool_calls,
            COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'user_id', tup.user_id,
                    'first_name', tup.first_name,
                    'last_name', tup.last_name,
                    'alias', tup.alias,
                    'role', tup.role,
                    'chat_count', tup.chat_count
                ))
                FROM top_users_profiles tup),
                '[]'::jsonb
            ) as top_users_profiles
        """

        params: list[Any] = [cutoff_date]
        return query, params


async def get_assistant_chat_full_data(
    conn: asyncpg.Connection, chat_id: UUID, profile_id: UUID
) -> dict[str, Any]:
    """Get complete assistant chat data with all related entities.

    Args:
        conn: Database connection
        chat_id: Optional chat ID to fetch specific chat data
        profile_id: Profile ID to fetch all chats for dropdown

    Returns:
        Dict containing chat, messages, toolCalls, and allChats
    """
    chat_id_str = str(chat_id) if chat_id else None
    profile_id_str = str(profile_id)

    result: dict[str, Any] = {
        "chat": None,
        "messages": [],
        "toolCalls": [],
        "allChats": [],
    }

    # 1. Get all chats for this profile (for dropdown)
    all_chats_query = """
        SELECT 
            id,
            created_at,
            updated_at,
            profile_id,
            title,
            trace_id
        FROM assistant_chats
        WHERE profile_id = $1
        ORDER BY created_at DESC
    """

    all_chats_result = await conn.fetch(all_chats_query, profile_id_str)
    result["allChats"] = [
        {
            "id": str(row["id"]),
            "createdAt": row["created_at"].isoformat(),
            "updatedAt": row["updated_at"].isoformat(),
            "profileId": str(row["profile_id"]),
            "title": row["title"],
            "traceId": row["trace_id"],
        }
        for row in all_chats_result
    ]

    # If no chat_id provided, return early with just the chats list
    if not chat_id_str:
        return result

    # 2. Get specific chat details
    chat_query = """
        SELECT 
            id,
            created_at,
            updated_at,
            profile_id,
            title,
            trace_id
        FROM assistant_chats
        WHERE id = $1
    """

    chat_result = await conn.fetchrow(chat_query, chat_id_str)
    if not chat_result:
        raise ValueError(f"Assistant chat {chat_id} not found")

    result["chat"] = {
        "id": str(chat_result["id"]),
        "createdAt": chat_result["created_at"].isoformat(),
        "updatedAt": chat_result["updated_at"].isoformat(),
        "profileId": str(chat_result["profile_id"]),
        "title": chat_result["title"],
        "traceId": chat_result["trace_id"],
    }

    # 3. Get all messages for this chat
    messages_query = """
        SELECT 
            id,
            created_at,
            updated_at,
            chat_id,
            role,
            content,
            completed
        FROM assistant_messages
        WHERE chat_id = $1
        ORDER BY created_at ASC
    """

    messages_result = await conn.fetch(messages_query, chat_id_str)
    result["messages"] = [
        {
            "id": str(row["id"]),
            "createdAt": row["created_at"].isoformat(),
            "updatedAt": row["updated_at"].isoformat(),
            "chatId": str(row["chat_id"]),
            "role": row["role"],
            "content": row["content"],
            "completed": row["completed"],
        }
        for row in messages_result
    ]

    # 4. Get all tool calls for this chat
    tool_calls_query = """
        SELECT 
            id,
            created_at,
            updated_at,
            chat_id,
            tool_name,
            tool_type,
            tool_arguments,
            tool_result,
            completed
        FROM assistant_tool_calls
        WHERE chat_id = $1
        ORDER BY created_at ASC
    """

    tool_calls_result = await conn.fetch(tool_calls_query, chat_id_str)
    result["toolCalls"] = [
        {
            "id": str(row["id"]),
            "createdAt": row["created_at"].isoformat(),
            "updatedAt": row["updated_at"].isoformat(),
            "chatId": str(row["chat_id"]),
            "toolName": row["tool_name"],
            "toolType": row["tool_type"],
            "toolArguments": row["tool_arguments"],
            "toolResult": row["tool_result"],
            "completed": row["completed"],
        }
        for row in tool_calls_result
    ]

    return result
