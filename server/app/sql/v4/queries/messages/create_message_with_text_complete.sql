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
)
INSERT INTO messages_entry (
    run_id,
    role,
    text_id,
    completed,
    audio,
    created_at,
    updated_at
)
SELECT
    $1::uuid,
    $2::message_type,
    rt.id,
    COALESCE($4::boolean, TRUE),
    COALESCE($5::boolean, FALSE),
    NOW(),
    NOW()
FROM resolved_text rt
RETURNING id;
