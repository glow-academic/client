-- Patch eval draft (section-action compatible, ID-first)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_patch_eval_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_eval_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_eval_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    flag_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    agent_ids uuid[] DEFAULT NULL,
    model_run_ids uuid[] DEFAULT NULL,
    group_ids uuid[] DEFAULT NULL,
    run_position_ids uuid[] DEFAULT NULL,
    group_position_ids uuid[] DEFAULT NULL,
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
    v_profiles_resource_id uuid;
    v_group_id uuid := group_id;
BEGIN
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = v_profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'No profiles_resource linked to profile_artifact: %', v_profile_id;
    END IF;

    IF input_draft_id IS NOT NULL THEN
        SELECT vde.group_id INTO v_group_id
        FROM drafts_entry vde
        WHERE vde.id = input_draft_id;

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (
                    SELECT id
                    FROM sessions_entry
                    WHERE sessions_entry.profile_id = v_profile_id
                      AND sessions_entry.active = TRUE
                    ORDER BY created_at DESC
                    LIMIT 1
                )
            )
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE drafts_entry
        SET version = drafts_entry.version + 1,
            updated_at = NOW(),
            group_id = COALESCE(drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND drafts_entry.version = expected_version
          AND EXISTS (
                SELECT 1
                FROM profiles_drafts_connection pdc
                WHERE pdc.draft_id = drafts_entry.id
                  AND pdc.profiles_id = v_profiles_resource_id
          )
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
        END IF;
    END IF;

    IF v_draft_id IS NULL THEN
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (
                    SELECT id
                    FROM sessions_entry
                    WHERE sessions_entry.profile_id = v_profile_id
                      AND sessions_entry.active = TRUE
                    ORDER BY created_at DESC
                    LIMIT 1
                )
            )
            RETURNING id INTO v_group_id;
        END IF;

        INSERT INTO drafts_entry (artifact, group_id)
        VALUES ('eval'::artifact_type, v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;

        INSERT INTO profiles_drafts_connection (draft_id, profiles_id, version)
        VALUES (v_draft_id, v_profiles_resource_id, v_new_version);
    END IF;

    DELETE FROM eval_drafts_names_connection WHERE draft_id = v_draft_id;
    DELETE FROM eval_drafts_descriptions_connection WHERE draft_id = v_draft_id;
    DELETE FROM eval_drafts_flags_connection WHERE draft_id = v_draft_id;
    DELETE FROM eval_drafts_departments_connection WHERE draft_id = v_draft_id;
    DELETE FROM eval_drafts_agents_connection WHERE draft_id = v_draft_id;
    DELETE FROM eval_drafts_runs_connection WHERE draft_id = v_draft_id;
    DELETE FROM eval_drafts_groups_connection WHERE draft_id = v_draft_id;
    DELETE FROM eval_drafts_run_positions_connection WHERE draft_id = v_draft_id;
    DELETE FROM eval_drafts_group_positions_connection WHERE draft_id = v_draft_id;

    IF name_id IS NOT NULL THEN
        INSERT INTO eval_drafts_names_connection (draft_id, names_id, version)
        VALUES (v_draft_id, name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF description_id IS NOT NULL THEN
        INSERT INTO eval_drafts_descriptions_connection (draft_id, descriptions_id, version)
        VALUES (v_draft_id, description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    INSERT INTO eval_drafts_flags_connection (draft_id, flags_id, version)
    SELECT v_draft_id, fid, v_new_version
    FROM UNNEST(COALESCE(flag_ids, ARRAY[]::uuid[])) AS fid
    ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
    SET version = v_new_version;

    INSERT INTO eval_drafts_departments_connection (draft_id, departments_id, version)
    SELECT v_draft_id, did, v_new_version
    FROM UNNEST(COALESCE(department_ids, ARRAY[]::uuid[])) AS did
    ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
    SET version = v_new_version;

    INSERT INTO eval_drafts_agents_connection (draft_id, agents_id, version)
    SELECT v_draft_id, aid, v_new_version
    FROM UNNEST(COALESCE(agent_ids, ARRAY[]::uuid[])) AS aid
    ON CONFLICT ON CONSTRAINT agents_draft_pkey DO UPDATE
    SET version = v_new_version;

    INSERT INTO eval_drafts_runs_connection (draft_id, runs_id, version)
    SELECT v_draft_id, rid, v_new_version
    FROM UNNEST(COALESCE(model_run_ids, ARRAY[]::uuid[])) AS rid
    ON CONFLICT ON CONSTRAINT runs_draft_pkey DO UPDATE
    SET version = v_new_version;

    INSERT INTO eval_drafts_groups_connection (draft_id, groups_id, version)
    SELECT v_draft_id, gid, v_new_version
    FROM UNNEST(COALESCE(group_ids, ARRAY[]::uuid[])) AS gid
    ON CONFLICT ON CONSTRAINT groups_draft_pkey DO UPDATE
    SET version = v_new_version;

    INSERT INTO eval_drafts_run_positions_connection (draft_id, run_positions_id, version)
    SELECT v_draft_id, rpid, v_new_version
    FROM UNNEST(COALESCE(run_position_ids, ARRAY[]::uuid[])) AS rpid
    ON CONFLICT ON CONSTRAINT run_positions_draft_pkey DO UPDATE
    SET version = v_new_version;

    INSERT INTO eval_drafts_group_positions_connection (draft_id, group_positions_id, version)
    SELECT v_draft_id, gpid, v_new_version
    FROM UNNEST(COALESCE(group_position_ids, ARRAY[]::uuid[])) AS gpid
    ON CONFLICT ON CONSTRAINT group_positions_draft_pkey DO UPDATE
    SET version = v_new_version;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END;
$$;
