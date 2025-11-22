-- Get assistant usage statistics
-- Params: $1 = cutoff_date
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
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
        p.role,
        uc.chat_count
    FROM user_counts uc
    JOIN profiles p ON p.id = uc.profile_id
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    GROUP BY p.id, p.first_name, p.last_name, p.role, uc.chat_count
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
            'emails', COALESCE(tup.emails, ARRAY[]::text[]),
            'primaryEmail', tup.primary_email,
            'role', tup.role,
            'chat_count', tup.chat_count
        ))
        FROM top_users_profiles tup),
        '[]'::jsonb
    ) as top_users;

