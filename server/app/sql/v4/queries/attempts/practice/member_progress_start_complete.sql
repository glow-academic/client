-- Create run + user/assistant messages for practice simulation
-- After migration 364: Insert into messages_entry first, then simulation_messages_entry
-- 1) Drop function first
DROP FUNCTION IF EXISTS socket_practice_member_progress_start_v4(uuid, text, boolean, uuid, uuid);

-- 2) Recreate function
-- Note: Required params must come before params with defaults
CREATE OR REPLACE FUNCTION socket_practice_member_progress_start_v4(
    chat_id uuid,
    message_contents text,
    audio boolean,
    group_id uuid DEFAULT NULL,
    upload_id uuid DEFAULT NULL
)
RETURNS TABLE (
    user_message_id uuid,
    assistant_message_id uuid,
    run_id uuid,
    group_id uuid,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT chat_id, message_contents, audio, group_id, upload_id
),
chat_context AS (
    SELECT
        pc.id as chat_id,
        pa.id as attempt_id,
        (SELECT ppj.profile_id
         FROM simulation_attempts_profiles_connection pap
         JOIN profile_profiles_junction ppj ON ppj.profiles_id = pap.profiles_id
         WHERE pap.attempt_id = pa.id
         LIMIT 1) as profile_id
    FROM params p
    JOIN view_simulation_chats_entry pc ON pc.id = p.chat_id
    JOIN view_simulation_attempts_entry pa ON pa.id = pc.attempt_id
    LIMIT 1
),
existing_group AS (
    SELECT r.group_id
    FROM params p
    JOIN simulation_messages_entry sm ON sm.chat_id = p.chat_id
    JOIN messages_entry m ON m.id = sm.id
    JOIN view_runs_entry r ON r.id = m.run_id
    WHERE r.group_id IS NOT NULL
    LIMIT 1
),
create_group_if_needed AS (
    INSERT INTO groups_entry (created_at, updated_at, session_id)
    SELECT NOW(), NOW(),
        (SELECT id FROM view_sessions_entry
         WHERE profile_id = (SELECT profile_id FROM chat_context)
           AND active = true
         ORDER BY created_at DESC
         LIMIT 1)
    FROM params p
    WHERE p.group_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM existing_group)
    RETURNING id AS group_id
),
selected_group AS (
    SELECT COALESCE(
        (SELECT group_id FROM params),
        (SELECT group_id FROM existing_group),
        (SELECT group_id FROM create_group_if_needed)
    ) as group_id
),
create_run AS (
    INSERT INTO runs_entry (input_tokens, output_tokens, group_id)
    SELECT 0, 0, (SELECT group_id FROM selected_group)
    RETURNING id as run_id
),
-- Insert user message into base table first
insert_user_message_base AS (
    INSERT INTO messages_entry (
        run_id,
        role,
        completed,
        audio,
        created_at,
        updated_at
    )
    SELECT
        cr.run_id,
        'user'::message_type,
        true,
        p.audio,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN create_run cr
    RETURNING id as user_message_id, created_at
),
-- Link user message to simulation chat
insert_user_message_sim AS (
    INSERT INTO simulation_messages_entry (id, chat_id)
    SELECT umb.user_message_id, p.chat_id
    FROM insert_user_message_base umb
    CROSS JOIN params p
    RETURNING id as user_message_id
),
-- Insert user content into simulation_contents_entry
insert_user_content AS (
    INSERT INTO simulation_contents_entry (message_id, content)
    SELECT umb.user_message_id, p.message_contents
    FROM insert_user_message_base umb
    CROSS JOIN params p
    RETURNING id as content_id
),
-- Insert assistant message into base table
insert_assistant_message_base AS (
    INSERT INTO messages_entry (
        run_id,
        role,
        completed,
        audio,
        created_at,
        updated_at
    )
    SELECT
        cr.run_id,
        'assistant'::message_type,
        false,
        false,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN create_run cr
    RETURNING id as assistant_message_id
),
-- Link assistant message to simulation chat
insert_assistant_message_sim AS (
    INSERT INTO simulation_messages_entry (id, chat_id)
    SELECT amb.assistant_message_id, p.chat_id
    FROM insert_assistant_message_base amb
    CROSS JOIN params p
    RETURNING id as assistant_message_id
)
SELECT
    ums.user_message_id,
    ams.assistant_message_id,
    cr.run_id,
    (SELECT group_id FROM selected_group),
    umb.created_at
FROM create_run cr
CROSS JOIN insert_user_message_base umb
CROSS JOIN insert_user_message_sim ums
CROSS JOIN insert_assistant_message_sim ams;
$$;
