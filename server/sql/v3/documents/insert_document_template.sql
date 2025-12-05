-- Insert document template and link to document
-- Parameters: $1=document_id, $2=upload_id, $3=args (jsonb - template schema), $4=active (boolean)
-- Marks all previous templates as inactive when inserting new active template

WITH deactivate_previous AS (
    -- Mark all previous templates as inactive if new one is active
    UPDATE document_template_uploads
    SET active = false, updated_at = NOW()
    WHERE document_id = $1::uuid
      AND active = true
      AND $4 = true
),
insert_template AS (
    -- Insert new template link
    INSERT INTO document_template_uploads (
        document_id,
        upload_id,
        args,
        active,
        created_at,
        updated_at
    )
    VALUES (
        $1::uuid,
        $2::uuid,
        COALESCE($3::jsonb, '{}'::jsonb),
        $4,
        NOW(),
        NOW()
    )
    ON CONFLICT (document_id, upload_id) DO UPDATE SET
        args = EXCLUDED.args,
        active = EXCLUDED.active,
        updated_at = NOW()
    RETURNING *
)
SELECT * FROM insert_template;

