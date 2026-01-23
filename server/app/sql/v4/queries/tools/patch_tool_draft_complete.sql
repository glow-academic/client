-- Patch tool draft - accepts resource IDs and creates/updates draft
-- Creates draft if input_draft_id is NULL, updates if exists
-- Links resources via junction tables

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_patch_tool_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_tool_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_tool_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    args_ids uuid[] DEFAULT NULL,
    args_outputs_ids uuid[] DEFAULT NULL,
    expected_version int DEFAULT 0
)
RETURNS TABLE (
    draft_id uuid,
    new_version int,
    draft_exists boolean
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_draft_id uuid;
    v_new_version int;
    v_draft_exists boolean := false;
    v_profile_id uuid := profile_id;
    v_group_id uuid;
BEGIN
    -- Validate args IDs exist (error if missing and provided)
    IF args_ids IS NOT NULL AND COALESCE(array_length(args_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(args_ids) AS args_id
            WHERE NOT EXISTS (SELECT 1 FROM args_resource WHERE id = args_id)
        ) THEN
            RAISE EXCEPTION 'One or more args resources not found';
        END IF;
    END IF;

    -- Validate args_outputs IDs exist (error if missing and provided)
    IF args_outputs_ids IS NOT NULL AND COALESCE(array_length(args_outputs_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(args_outputs_ids) AS args_outputs_id
            WHERE NOT EXISTS (SELECT 1 FROM args_outputs_resource WHERE id = args_outputs_id)
        ) THEN
            RAISE EXCEPTION 'One or more args_outputs resources not found';
        END IF;
    END IF;

    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        -- Get existing draft's group_id
        SELECT group_id INTO v_group_id FROM drafts_entry WHERE id = input_draft_id;

        -- Create group if draft doesn't have one (shouldn't happen after migration, but safety check)
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (NOW(), NOW(), (SELECT id FROM sessions_entry WHERE profile_id = profile_id AND active = true ORDER BY created_at DESC LIMIT 1))
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE drafts_entry
        SET version = drafts_entry.version + 1,
            updated_at = now(),
            group_id = COALESCE(drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND drafts_entry.profile_id = v_profile_id
          AND drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;

            -- Delete old resource links
            DELETE FROM args_draft WHERE args_draft.draft_id = v_draft_id;
            DELETE FROM args_outputs_draft WHERE args_outputs_draft.draft_id = v_draft_id;

            -- Insert new resource links
            IF args_ids IS NOT NULL AND COALESCE(array_length(args_ids, 1), 0) > 0 THEN
                INSERT INTO args_draft (draft_id, args_id, version, generated, mcp)
                SELECT v_draft_id, args_id, v_new_version, false, false
                FROM UNNEST(args_ids) as args_id
                ON CONFLICT ON CONSTRAINT args_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF args_outputs_ids IS NOT NULL AND COALESCE(array_length(args_outputs_ids, 1), 0) > 0 THEN
                INSERT INTO args_outputs_draft (draft_id, args_outputs_id, version, generated, mcp)
                SELECT v_draft_id, args_outputs_id, v_new_version, false, false
                FROM UNNEST(args_outputs_ids) as args_outputs_id
                ON CONFLICT ON CONSTRAINT args_outputs_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
            RETURN;
        END IF;
    END IF;

    -- Create new draft with group
    -- First create a group for this draft
    INSERT INTO groups_entry (created_at, updated_at, session_id)
    VALUES (NOW(), NOW(), (SELECT id FROM sessions_entry WHERE profile_id = profile_id AND active = true ORDER BY created_at DESC LIMIT 1))
    RETURNING id INTO v_group_id;

    -- Create new draft with group_id
    INSERT INTO drafts_entry (artifact, profile_id, group_id)
    VALUES ('tool'::artifact_type, v_profile_id, v_group_id)
    RETURNING id, version INTO v_draft_id, v_new_version;

    -- Link resources to draft
    IF args_ids IS NOT NULL AND COALESCE(array_length(args_ids, 1), 0) > 0 THEN
        INSERT INTO args_draft (draft_id, args_id, version, generated, mcp)
        SELECT v_draft_id, args_id, v_new_version, false, false
        FROM UNNEST(args_ids) as args_id
        ON CONFLICT ON CONSTRAINT args_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF args_outputs_ids IS NOT NULL AND COALESCE(array_length(args_outputs_ids, 1), 0) > 0 THEN
        INSERT INTO args_outputs_draft (draft_id, args_outputs_id, version, generated, mcp)
        SELECT v_draft_id, args_outputs_id, v_new_version, false, false
        FROM UNNEST(args_outputs_ids) as args_outputs_id
        ON CONFLICT ON CONSTRAINT args_outputs_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;
