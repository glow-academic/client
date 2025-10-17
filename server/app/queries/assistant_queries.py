"""Assistant queries for v2 API endpoints."""

from datetime import datetime
from typing import Any, Dict, List, Tuple
from uuid import UUID

import asyncpg  # type: ignore


class AssistantQueries:
    """Query builders for assistant operations."""

    def get_assistant_run_context(
        self, chat_id: str, department_id: str
    ) -> Tuple[str, List[Any]]:
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
            pr.base_url,
            pr.api_key

        FROM assistant_chats ac
        INNER JOIN profiles p ON p.id = ac.profile_id
        INNER JOIN department_agents da ON da.department_id = $2 AND da.role = 'assistant'
        INNER JOIN agents a ON a.id = da.agent_id
        INNER JOIN models m ON m.id = a.model_id
        INNER JOIN providers pr ON pr.id = m.provider_id
        WHERE ac.id = $1
        """
        
        params: List[Any] = [chat_id, department_id]
        return query, params

    def get_messages_for_chat(self, chat_id: str) -> Tuple[str, List[Any]]:
        """
        Get all messages for a chat, ordered chronologically.

        Args:
            chat_id: UUID of the assistant chat

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            id,
            created_at,
            updated_at,
            completed_at,
            chat_id,
            role,
            content,
            completed
        FROM assistant_messages
        WHERE chat_id = $1
        ORDER BY created_at ASC
        """
        
        params: List[Any] = [chat_id]
        return query, params

    def get_tool_calls_for_chat(self, chat_id: str) -> Tuple[str, List[Any]]:
        """
        Get all tool calls for a chat, ordered chronologically.

        Args:
            chat_id: UUID of the assistant chat

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT 
            id,
            created_at,
            updated_at,
            completed_at,
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
        
        params: List[Any] = [chat_id]
        return query, params

    def update_chat_title(self, chat_id: str, title: str) -> Tuple[str, List[Any]]:
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
        
        params: List[Any] = [title, chat_id]
        return query, params

    def verify_profile_exists(self, profile_id: str) -> Tuple[str, List[Any]]:
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
        
        params: List[Any] = [profile_id]
        return query, params

    def verify_chat_exists(self, chat_id: str) -> Tuple[str, List[Any]]:
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
        
        params: List[Any] = [chat_id]
        return query, params

    def create_chat(
        self, profile_id: str, title: str, trace_id: str, created_at: datetime
    ) -> Tuple[str, List[Any]]:
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
        
        params: List[Any] = [created_at, title, profile_id, trace_id]
        return query, params

    def create_message(
        self, chat_id: str, role: str, content: str, completed: bool, created_at: datetime
    ) -> Tuple[str, List[Any]]:
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
        
        params: List[Any] = [chat_id, role, content, completed, created_at]
        return query, params

    def update_message_content(
        self, message_id: str, content: str
    ) -> Tuple[str, List[Any]]:
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
        
        params: List[Any] = [content, message_id]
        return query, params

    def complete_message(
        self, message_id: str, content: str, completed: bool
    ) -> Tuple[str, List[Any]]:
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
        
        params: List[Any] = [content, completed, message_id]
        return query, params

    def create_tool_call(
        self,
        chat_id: str,
        tool_name: str,
        tool_type: str,
        tool_arguments: str,
        created_at: datetime,
    ) -> Tuple[str, List[Any]]:
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
        
        params: List[Any] = [chat_id, tool_name, tool_type, tool_arguments, "{}", False, created_at]
        return query, params

    def update_tool_call_result(
        self, tool_call_id: str, tool_result: str, completed: bool
    ) -> Tuple[str, List[Any]]:
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
        
        params: List[Any] = [tool_result, completed, tool_call_id]
        return query, params

    def get_chats_in_timeframe(self, cutoff_date: datetime) -> Tuple[str, List[Any]]:
        """
        Get all assistant chats created after cutoff date.

        Args:
            cutoff_date: Minimum creation date

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT id, profile_id, created_at
        FROM assistant_chats
        WHERE created_at >= $1
        """
        
        params: List[Any] = [cutoff_date]
        return query, params

    def get_messages_in_timeframe(self, cutoff_date: datetime) -> Tuple[str, List[Any]]:
        """
        Get all assistant messages created after cutoff date.

        Args:
            cutoff_date: Minimum creation date

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT id, chat_id, completed, created_at
        FROM assistant_messages
        WHERE created_at >= $1
        """
        
        params: List[Any] = [cutoff_date]
        return query, params

    def get_tool_calls_in_timeframe(self, cutoff_date: datetime) -> Tuple[str, List[Any]]:
        """
        Get all assistant tool calls created after cutoff date.

        Args:
            cutoff_date: Minimum creation date

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT id, chat_id, tool_name, completed, created_at
        FROM assistant_tool_calls
        WHERE created_at >= $1
        """
        
        params: List[Any] = [cutoff_date]
        return query, params

    def get_profile_by_id(self, profile_id: UUID) -> Tuple[str, List[Any]]:
        """
        Get profile details by ID.

        Args:
            profile_id: UUID of the profile

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT id, first_name, last_name, alias, role
        FROM profiles
        WHERE id = $1
        """
        
        params: List[Any] = [str(profile_id)]
        return query, params


async def get_assistant_chat_full_data(conn: asyncpg.Connection, chat_id: UUID, profile_id: UUID) -> Dict[str, Any]:
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
    
    result: Dict[str, Any] = {
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
            "id": str(row['id']),
            "createdAt": row['created_at'].isoformat(),
            "updatedAt": row['updated_at'].isoformat(),
            "profileId": str(row['profile_id']),
            "title": row['title'],
            "traceId": row['trace_id'],
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
        "id": str(chat_result['id']),
        "createdAt": chat_result['created_at'].isoformat(),
        "updatedAt": chat_result['updated_at'].isoformat(),
        "profileId": str(chat_result['profile_id']),
        "title": chat_result['title'],
        "traceId": chat_result['trace_id'],
    }
    
    # 3. Get all messages for this chat
    messages_query = """
        SELECT 
            id,
            created_at,
            updated_at,
            completed_at,
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
            "id": str(row['id']),
            "createdAt": row['created_at'].isoformat(),
            "updatedAt": row['updated_at'].isoformat(),
            "completedAt": row['completed_at'].isoformat() if row['completed_at'] else None,
            "chatId": str(row['chat_id']),
            "role": row['role'],
            "content": row['content'],
            "completed": row['completed'],
        }
        for row in messages_result
    ]
    
    # 4. Get all tool calls for this chat
    tool_calls_query = """
        SELECT 
            id,
            created_at,
            updated_at,
            completed_at,
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
            "id": str(row['id']),
            "createdAt": row['created_at'].isoformat(),
            "updatedAt": row['updated_at'].isoformat(),
            "completedAt": row['completed_at'].isoformat() if row['completed_at'] else None,
            "chatId": str(row['chat_id']),
            "toolName": row['tool_name'],
            "toolType": row['tool_type'],
            "toolArguments": row['tool_arguments'],
            "toolResult": row['tool_result'],
            "completed": row['completed'],
        }
        for row in tool_calls_result
    ]
    
    return result
