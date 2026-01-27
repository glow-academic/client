-- Create run + user/assistant messages for practice simulation
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
    JOIN simulation_chats_entry pc ON pc.id = p.chat_id
    JOIN simulation_attempts_entry pa ON pa.id = pc.attempt_id
    LIMIT 1
),
existing_group AS (
    SELECT r.group_id
    FROM params p
    JOIN simulation_messages_entry m ON m.chat_id = p.chat_id
    JOIN runs_entry r ON r.id = m.run_id
    WHERE r.group_id IS NOT NULL
    LIMIT 1
),
create_group_if_needed AS (
    INSERT INTO groups_entry (created_at, updated_at, session_id)
    SELECT NOW(), NOW(),
        (SELECT id FROM sessions_entry
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
insert_user_message AS (
    INSERT INTO simulation_messages_entry (
        chat_id,
        run_id,
        content,
        role,
        completed,
        audio,
        created_at,
        updated_at
    )
    SELECT
        p.chat_id,
        cr.run_id,
        p.message_contents,
        'user'::message_type,
        true,
        p.audio,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN create_run cr
    RETURNING id as user_message_id, created_at
),
insert_assistant_message AS (
    INSERT INTO simulation_messages_entry (
        chat_id,
        run_id,
        content,
        role,
        completed,
        audio,
        created_at,
        updated_at
    )
    SELECT
        p.chat_id,
        cr.run_id,
        NULL,
        'assistant'::message_type,
        false,
        false,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN create_run cr
    RETURNING id as assistant_message_id
)
SELECT
    iu.user_message_id,
    ia.assistant_message_id,
    cr.run_id,
    (SELECT group_id FROM selected_group),
    iu.created_at
FROM create_run cr
CROSS JOIN insert_user_message iu
CROSS JOIN insert_assistant_message ia;
$$;
