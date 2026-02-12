-- Create group_rubrics resource
-- Get or create operation (returns existing ID if group_id + rubric_id already exists)
-- Parameters: target_group_id (uuid, required), rubric_id (uuid, required), mcp (boolean, optional)
-- Returns: id (uuid) - unique resource id

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_group_rubrics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_group_rubrics_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_group_rubrics_v4(
    target_group_id uuid,
    rubric_id uuid,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_resource_id uuid;
BEGIN
    -- Check if group_rubrics already exists (match on group_id + rubric_id)
    SELECT r.id INTO v_resource_id
    FROM group_rubrics_resource r
    WHERE r.group_id = api_create_group_rubrics_v4.target_group_id
      AND r.rubric_id = api_create_group_rubrics_v4.rubric_id
    LIMIT 1;

    IF v_resource_id IS NOT NULL THEN
        RETURN QUERY SELECT v_resource_id;
        RETURN;
    END IF;

    -- INSERT INTO group_rubrics_resource table (always insert, never update)
    INSERT INTO group_rubrics_resource (
        group_id,
        rubric_id,
        active,
        generated,
        mcp,
        created_at
    )
    VALUES (
        api_create_group_rubrics_v4.target_group_id,
        api_create_group_rubrics_v4.rubric_id,
        true,
        true,
        mcp,
        NOW()
    )
    ON CONFLICT (group_id, rubric_id)
    DO UPDATE SET
        active = true,
        generated = EXCLUDED.generated,
        mcp = EXCLUDED.mcp
    RETURNING group_rubrics_resource.id INTO v_resource_id;

    RETURN QUERY SELECT v_resource_id;
END;
$$;
