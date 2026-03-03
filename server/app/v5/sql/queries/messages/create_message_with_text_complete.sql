WITH existing_text AS (
    SELECT tue.text_id AS id
    FROM text_uploads_entry tue
    WHERE tue.upload_id = $3::uuid AND tue.active = true
    LIMIT 1
),
inserted_text AS (
    INSERT INTO texts_entry (
        created_at,
        updated_at
    )
    SELECT NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM existing_text)
    RETURNING id
),
link_text_upload AS (
    INSERT INTO text_uploads_entry (text_id, upload_id)
    SELECT it.id, $3::uuid
    FROM inserted_text it
    RETURNING text_id AS id
),
new_message AS (
    INSERT INTO messages_entry (
        run_id,
        role,
        created_at,
        updated_at
    )
    VALUES (
        $1::uuid,
        $2::message_type,
        NOW(),
        NOW()
    )
    RETURNING id
),
link_message_upload AS (
    INSERT INTO message_uploads_entry (message_id, upload_id)
    SELECT nm.id, $3::uuid
    FROM new_message nm
    RETURNING message_id AS id
),
-- Mark as completed if requested (append-only)
mark_completed AS (
    INSERT INTO messages_completions_entry (message_id)
    SELECT nm.id FROM new_message nm
    WHERE COALESCE($4::boolean, TRUE) = TRUE
    RETURNING id
)
SELECT id FROM new_message;
