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
    -- Link template to run if run_id provided
    INSERT INTO template_runs (template_id, run_id, created_at, updated_at)
    SELECT 
        ltd.template_id,
        $6::uuid,
        NOW(),
        NOW()
    FROM link_to_document ltd
    WHERE $6::uuid IS NOT NULL
    ON CONFLICT (template_id, run_id) DO NOTHING
    RETURNING template_id
)
SELECT template_id FROM link_to_document LIMIT 1;

