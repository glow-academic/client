-- Get complete assistant chat data with all related entities in a single query
-- Parameters: $1=chatId, $2=profileId
-- Returns: chat details, messages, tool calls, and all chats for the profile
WITH chat_data AS (
    -- Get specific chat details
    SELECT 
        id,
        created_at,
        updated_at,
        profile_id,
        title,
        trace_id
    FROM assistant_chats
    WHERE id = $1::uuid
),
all_chats_for_profile AS (
    -- Get all chats for this profile (for dropdown)
    SELECT 
        id,
        created_at,
        updated_at,
        profile_id,
        title,
        trace_id
    FROM assistant_chats
    WHERE profile_id = $2::uuid
    ORDER BY created_at DESC
),
chat_messages AS (
    -- Get all messages for this chat
    SELECT 
        id,
        created_at,
        updated_at,
        chat_id,
        role,
        content,
        completed
    FROM assistant_messages
    WHERE chat_id = $1::uuid
    ORDER BY created_at ASC
),
chat_tool_calls AS (
    -- Get all tool calls for this chat
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
    WHERE chat_id = $1::uuid
    ORDER BY created_at ASC
)
SELECT 
    -- Chat data (single row or NULL)
    (SELECT jsonb_build_object(
        'id', cd.id::text,
        'created_at', cd.created_at::text,
        'updated_at', cd.updated_at::text,
        'profile_id', cd.profile_id::text,
        'title', cd.title,
        'trace_id', cd.trace_id
    ) FROM chat_data cd LIMIT 1) as chat,
    -- All chats for profile (array)
    (SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', ac.id::text,
            'created_at', ac.created_at::text,
            'updated_at', ac.updated_at::text,
            'profile_id', ac.profile_id::text,
            'title', ac.title,
            'trace_id', ac.trace_id
        )
    ), '[]'::jsonb) FROM all_chats_for_profile ac) as all_chats,
    -- Messages (array)
    (SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', cm.id::text,
            'created_at', cm.created_at::text,
            'updated_at', cm.updated_at::text,
            'chat_id', cm.chat_id::text,
            'role', cm.role,
            'content', cm.content,
            'completed', cm.completed
        )
    ), '[]'::jsonb) FROM chat_messages cm) as messages,
    -- Tool calls (array)
    (SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', ctc.id::text,
            'created_at', ctc.created_at::text,
            'updated_at', ctc.updated_at::text,
            'chat_id', ctc.chat_id::text,
            'tool_name', ctc.tool_name,
            'tool_type', ctc.tool_type,
            'tool_arguments', ctc.tool_arguments,
            'tool_result', ctc.tool_result,
            'completed', ctc.completed
        )
    ), '[]'::jsonb) FROM chat_tool_calls ctc) as tool_calls

