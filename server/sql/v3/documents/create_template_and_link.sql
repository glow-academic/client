-- Create template and link to document and run
-- Parameters: $1=document_id, $2=upload_id, $3=name (text), $4=args (jsonb - template schema), $5=active (boolean), $6=run_id (uuid)
-- Returns: template_id (uuid)
-- Marks all previous templates as inactive when inserting new active template

WITH deactivate_previous AS (
    -- Mark all previous templates as inactive if new one is active
    UPDATE document_templates
    SET active = false, updated_at = NOW()
    WHERE document_id = $1::uuid
      AND active = true
      AND $5 = true
),
existing_template AS (
    -- Check if template already exists (same upload_id and args)
    SELECT id as template_id
    FROM templates
    WHERE upload_id = $2::uuid 
      AND args = COALESCE($4::jsonb, '{}'::jsonb)
    LIMIT 1
),
create_template AS (
    -- Create template if it doesn't exist
    INSERT INTO templates (name, upload_id, args, created_at, updated_at)
    SELECT 
        $3::text,
        $2::uuid,
        COALESCE($4::jsonb, '{}'::jsonb),
        NOW(),
        NOW()
    WHERE NOT EXISTS (SELECT 1 FROM existing_template)
    RETURNING id as template_id
),
template_id AS (
    SELECT template_id FROM existing_template
    UNION ALL
    SELECT template_id FROM create_template
    LIMIT 1
),
link_to_document AS (
    -- Link template to document
    INSERT INTO document_templates (document_id, template_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        ti.template_id,
        $5,
        NOW(),
        NOW()
    FROM template_id ti
    ON CONFLICT (document_id, template_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
    RETURNING template_id
),
link_to_run AS (
    -- Link template to run via tool_call if run_id provided
    -- Note: This assumes templates have tool_call_id set (via tool_calls)
    -- The run relationship is derived via templates → tool_call → tool_call_runs → run
    -- This CTE verifies the relationship exists but no longer inserts into template_runs
    SELECT 
        ltd.template_id
    FROM link_to_document ltd
    WHERE $6::uuid IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM templates t
        JOIN tool_calls tc ON tc.id = t.tool_call_id
        JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
        WHERE t.id = ltd.template_id
        AND tcr.run_id = $6::uuid
    )
)
SELECT template_id FROM link_to_document LIMIT 1;

