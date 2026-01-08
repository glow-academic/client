-- Create/update schema_fields resource and link to draft
-- Always INSERT operation (preserves all information)
-- Parameters: draft_id (uuid), schema_id (text), name (text), field_type (text), required (text), position (text), template (text), description (text), default_value (text)
-- Returns: schema_field_id (uuid), version (int)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_draft_schema_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_draft_schema_fields_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_draft_schema_fields_v4(
    draft_id uuid, schema_id uuid, name text, field_type text, required boolean, position_value integer, template text, description text, default_value text
)
RETURNS TABLE (
    schema_field_id uuid,
    version int
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_schema_field_id uuid;
    v_version int;
BEGIN
    -- Get draft version
    SELECT d.version INTO v_version
    FROM drafts d
    WHERE d.id = draft_id;
    
    IF v_version IS NULL THEN
        RAISE EXCEPTION 'Draft not found: %', draft_id;
    END IF;
    
    -- INSERT into schema_fields table (always insert, never update)
    INSERT INTO schema_fields(schema_id, name, field_type, required, "position", template, description, default_value, active)
    VALUES (schema_id, name, field_type, required, position_value, template, description, default_value, true)
    RETURNING id INTO v_schema_field_id;
    
    -- INSERT into draft_schema_fields junction table (always insert, never update)
    INSERT INTO draft_schema_fields(draft_id, schema_field_id, version)
    VALUES (draft_id, v_schema_field_id, v_version)
    ON CONFLICT (draft_id, schema_field_id) DO UPDATE
    SET version = v_version,
        updated_at = now();
    
    RETURN QUERY SELECT v_schema_field_id, v_version;
END;
$$;
