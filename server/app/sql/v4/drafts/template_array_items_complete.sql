-- Create/update template_array_items resource and link to draft
-- Always INSERT operation (preserves all information)
-- Parameters: draft_id (uuid), template_id (numeric), schema_field_id (numeric), item_template_id (numeric), position (numeric)
-- Returns: template_array_items_id (uuid), version (int)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_draft_template_array_items_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_draft_template_array_items_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_draft_template_array_items_v4(
    draft_id uuid, template_id uuid, schema_field_id uuid, item_template_id uuid, position_value integer
)
RETURNS TABLE (
    template_array_items_id uuid,
    version int
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_template_array_items_id uuid;
    v_version int;
BEGIN
    -- Get draft version
    SELECT d.version INTO v_version
    FROM drafts d
    WHERE d.id = draft_id;
    
    IF v_version IS NULL THEN
        RAISE EXCEPTION 'Draft not found: %', draft_id;
    END IF;
    
    -- INSERT into template_array_items table (always insert, never update)
    INSERT INTO template_array_items(template_id, schema_field_id, item_template_id, "position", active)
    VALUES (template_id, schema_field_id, item_template_id, position_value, true)
    RETURNING id INTO v_template_array_items_id;
    
    -- INSERT into draft_template_array_items junction table (always insert, never update)
    INSERT INTO draft_template_array_items(draft_id, template_array_items_id, version)
    VALUES (draft_id, v_template_array_items_id, v_version)
    ON CONFLICT (draft_id, template_array_items_id) DO UPDATE
    SET version = v_version,
        updated_at = now();
    
    RETURN QUERY SELECT v_template_array_items_id, v_version;
END;
$$;
