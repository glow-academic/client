-- Patch persona draft (create if not exists, patch if exists)
-- Function handles both create and patch logic

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_patch_persona_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_persona_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function (same as migration, but with parameter names matching API)
CREATE OR REPLACE FUNCTION api_patch_persona_draft_v4(
    p_draft_id uuid,
    p_profile_id uuid,
    p_patch jsonb,
    p_expected_version int
)
RETURNS TABLE (draft_id uuid, new_version int, draft_exists boolean)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_draft_id uuid;
    v_new_version int;
BEGIN
    -- If draft_id provided, try to patch existing draft
    IF p_draft_id IS NOT NULL THEN
        UPDATE drafts
        SET
            payload = drafts.payload || p_patch,
            version = drafts.version + 1,
            updated_at = now()
        WHERE
            drafts.id = p_draft_id
            AND drafts.profile_id = p_profile_id
            AND drafts.version = p_expected_version
        RETURNING drafts.id, drafts.version INTO v_draft_id, v_new_version;
        
        -- If update succeeded, return result
        IF v_draft_id IS NOT NULL THEN
            RETURN QUERY SELECT v_draft_id, v_new_version, true;
            RETURN;
        END IF;
    END IF;
    
    -- If no draft_id or update failed (version mismatch), create new draft
    WITH defaults AS (
        SELECT jsonb_build_object(
            'name', '',
            'description', '',
            'active', true,
            'color', '#3B82F6',
            'icon', 'Sparkles',
            'instructions', '',
            'department_ids', jsonb_build_array(),
            'example_ids', jsonb_build_array()
        ) AS d
    ),
    payload AS (
        SELECT (d || p_patch) AS p
        FROM defaults
    )
    INSERT INTO drafts(resource_type, profile_id, payload)
    SELECT 'personas'::draft_resource_type, p_profile_id, p
    FROM payload
    RETURNING id, version INTO v_draft_id, v_new_version;
    
    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;

COMMIT;

