-- Create/update standard_groups resource and link to draft
-- Always INSERT operation (preserves all information)
-- Parameters: draft_id (uuid), name (numeric), short_name (numeric), description (numeric), points (numeric), pass_points (numeric)
-- Returns: standard_group_id (uuid), version (int)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_draft_standard_groups_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_draft_standard_groups_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_draft_standard_groups_v4(
    draft_id uuid, name text, short_name text, description text, points numeric, pass_points numeric
)
RETURNS TABLE (
    standard_group_id uuid,
    version int
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_standard_group_id uuid;
    v_version int;
BEGIN
    -- Get draft version
    SELECT d.version INTO v_version
    FROM drafts d
    WHERE d.id = draft_id;
    
    IF v_version IS NULL THEN
        RAISE EXCEPTION 'Draft not found: %', draft_id;
    END IF;
    
    -- INSERT into standard_groups table (always insert, never update)
    INSERT INTO standard_groups(name, short_name, description, points, pass_points, active)
    VALUES (name, short_name, description, points, pass_points, true)
    RETURNING id INTO v_standard_group_id;
    
    -- INSERT into draft_standard_groups junction table (always insert, never update)
    INSERT INTO draft_standard_groups(draft_id, standard_group_id, version)
    VALUES (draft_id, v_standard_group_id, v_version)
    ON CONFLICT (draft_id, standard_group_id) DO UPDATE
    SET version = v_version,
        updated_at = now();
    
    RETURN QUERY SELECT v_standard_group_id, v_version;
END;
$$;
