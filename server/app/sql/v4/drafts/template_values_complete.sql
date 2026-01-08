-- Create/update template_values resource and link to draft
-- Always INSERT operation (preserves all information)
-- Parameters: draft_id (uuid), template_id (text), schema_field_id (text), string_value (text), number_value (text), boolean_value (text)
-- Returns: template_value_id (uuid), version (int)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_draft_template_values_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_draft_template_values_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_draft_template_values_v4(
    draft_id uuid, template_id uuid, schema_field_id uuid, string_value text, number_value text, boolean_value text
)
RETURNS TABLE (
    template_value_id uuid,
    version int
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_template_value_id uuid;
    v_version int;
BEGIN
    -- Get draft version
    SELECT d.version INTO v_version
    FROM drafts d
    WHERE d.id = draft_id;
    
    IF v_version IS NULL THEN
        RAISE EXCEPTION 'Draft not found: %', draft_id;
    END IF;
    
    -- INSERT into template_values table (always insert, never update)
    INSERT INTO template_values(template_id, schema_field_id, string_value, number_value, boolean_value, active)
    VALUES (template_id, schema_field_id, string_value, number_value, boolean_value, true)
    RETURNING id INTO v_template_value_id;
    
    -- INSERT into draft_template_values junction table (always insert, never update)
    INSERT INTO draft_template_values(draft_id, template_value_id, version)
    VALUES (draft_id, v_template_value_id, v_version)
    ON CONFLICT (draft_id, template_value_id) DO UPDATE
    SET version = v_version,
        updated_at = now();
    
    RETURN QUERY SELECT v_template_value_id, v_version;
END;
$$;
