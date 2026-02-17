WITH inserted_text AS (
    INSERT INTO texts_entry (
        content,
        created_at,
        updated_at
    )
    VALUES (
        $3::text,
        NOW(),
        NOW()
    )
    ON CONFLICT (content_hash) DO UPDATE
    SET updated_at = NOW()
    RETURNING id
),
resolved_text AS (
    SELECT id
    FROM inserted_text
    UNION ALL
    SELECT te.id
    FROM texts_entry te
    WHERE te.content_hash = md5($3::text)
    LIMIT 1
),
new_message AS (
    INSERT INTO messages_entry (
        run_id,
        role,
        text_id,
        audio,
        created_at,
        updated_at
    )
    SELECT
        $1::uuid,
        $2::message_type,
        rt.id,
        COALESCE($5::boolean, FALSE),
        NOW(),
        NOW()
    FROM resolved_text rt
    RETURNING id
),
-- Mark as completed if requested (append-only)
mark_completed AS (
    INSERT INTO messages_completions_entry (message_id)
    SELECT nm.id FROM new_message nm
    WHERE COALESCE($4::boolean, TRUE) = TRUE
    RETURNING id
)
SELECT id FROM new_message;
