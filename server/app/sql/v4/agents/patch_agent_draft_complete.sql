-- Patch agent draft (create if not exists, patch if exists)
-- Function handles both create and patch logic
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_patch_agent_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_agent_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function (same as migration, but with parameter names matching API)
-- Note: input_draft_id parameter renamed to avoid conflict with return column draft_id
-- Note: patch parameter is text (not jsonb) to allow asyncpg to pass JSON strings directly
CREATE OR REPLACE FUNCTION api_patch_agent_draft_v4(
    profile_id uuid,
    patch text,
    expected_version int,
    input_draft_id uuid DEFAULT NULL
)
RETURNS TABLE (draft_id uuid, new_version int, draft_exists boolean)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_draft_id uuid;
    v_new_version int;
    v_profile_id uuid := profile_id;  -- Store function parameter in local variable to avoid ambiguity
    v_patch jsonb := patch::jsonb;  -- Cast text to jsonb at the start
BEGIN
    -- If input_draft_id provided, try to patch existing draft
    IF input_draft_id IS NOT NULL THEN
        UPDATE drafts
        SET
            payload = drafts.payload || v_patch,
            version = drafts.version + 1,
            updated_at = now()
        WHERE
            drafts.id = input_draft_id
            AND drafts.profile_id = v_profile_id
            AND drafts.version = expected_version
        RETURNING drafts.id, drafts.version INTO v_draft_id, v_new_version;
        
        -- If update succeeded, return result
        IF v_draft_id IS NOT NULL THEN
            RETURN QUERY SELECT v_draft_id, v_new_version, true;
            RETURN;
        END IF;
    END IF;
    
    -- If no input_draft_id or update failed (version mismatch), create new draft
    WITH defaults AS (
        SELECT jsonb_build_object(
            'name', 'New Agent',
            'description', '',
            'systemPrompt', '',
            'promptId', null,
            'modelId', '',
            'active', true,
            'role', 'assistant',
            'departmentIds', jsonb_build_array(),
            'model_temperature_level_id', null,
            'model_reasoning_level_id', null,
            'model_voice_ids', jsonb_build_array()
        ) AS d
    ),
    payload AS (
        SELECT (d || v_patch) AS p
        FROM defaults
    ),
    params AS (
        SELECT v_profile_id AS p_profile_id
    )
    INSERT INTO drafts(resource_type, profile_id, payload)
    SELECT 'agents'::draft_resource_type, p_profile_id, p
    FROM payload, params
    RETURNING id, version INTO v_draft_id, v_new_version;
    
    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;