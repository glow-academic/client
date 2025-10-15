"""Assistant queries for v2 API endpoints."""

from typing import Any, Dict, List
from uuid import UUID

from sqlalchemy import text


def get_assistant_chat_full_data(db: Any, chat_id: UUID, profile_id: UUID) -> Dict[str, Any]:
    """Get complete assistant chat data with all related entities.
    
    Args:
        db: Database session
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
    all_chats_query = text("""
        SELECT 
            id,
            created_at,
            updated_at,
            profile_id,
            title,
            trace_id
        FROM assistant_chats
        WHERE profile_id = :profile_id
        ORDER BY created_at DESC
    """)
    
    all_chats_result = db.execute(all_chats_query, {"profile_id": profile_id_str}).fetchall()
    result["allChats"] = [
        {
            "id": str(row.id),
            "createdAt": row.created_at.isoformat(),
            "updatedAt": row.updated_at.isoformat(),
            "profileId": str(row.profile_id),
            "title": row.title,
            "traceId": row.trace_id,
        }
        for row in all_chats_result
    ]
    
    # If no chat_id provided, return early with just the chats list
    if not chat_id_str:
        return result
    
    # 2. Get specific chat details
    chat_query = text("""
        SELECT 
            id,
            created_at,
            updated_at,
            profile_id,
            title,
            trace_id
        FROM assistant_chats
        WHERE id = :chat_id
    """)
    
    chat_result = db.execute(chat_query, {"chat_id": chat_id_str}).fetchone()
    if not chat_result:
        raise ValueError(f"Assistant chat {chat_id} not found")
    
    result["chat"] = {
        "id": str(chat_result.id),
        "createdAt": chat_result.created_at.isoformat(),
        "updatedAt": chat_result.updated_at.isoformat(),
        "profileId": str(chat_result.profile_id),
        "title": chat_result.title,
        "traceId": chat_result.trace_id,
    }
    
    # 3. Get all messages for this chat
    messages_query = text("""
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
        WHERE chat_id = :chat_id
        ORDER BY created_at ASC
    """)
    
    messages_result = db.execute(messages_query, {"chat_id": chat_id_str}).fetchall()
    result["messages"] = [
        {
            "id": str(row.id),
            "createdAt": row.created_at.isoformat(),
            "updatedAt": row.updated_at.isoformat(),
            "completedAt": row.completed_at.isoformat() if row.completed_at else None,
            "chatId": str(row.chat_id),
            "role": row.role,
            "content": row.content,
            "completed": row.completed,
        }
        for row in messages_result
    ]
    
    # 4. Get all tool calls for this chat
    tool_calls_query = text("""
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
        WHERE chat_id = :chat_id
        ORDER BY created_at ASC
    """)
    
    tool_calls_result = db.execute(tool_calls_query, {"chat_id": chat_id_str}).fetchall()
    result["toolCalls"] = [
        {
            "id": str(row.id),
            "createdAt": row.created_at.isoformat(),
            "updatedAt": row.updated_at.isoformat(),
            "completedAt": row.completed_at.isoformat() if row.completed_at else None,
            "chatId": str(row.chat_id),
            "toolName": row.tool_name,
            "toolType": row.tool_type,
            "toolArguments": row.tool_arguments,
            "toolResult": row.tool_result,
            "completed": row.completed,
        }
        for row in tool_calls_result
    ]
    
    return result

