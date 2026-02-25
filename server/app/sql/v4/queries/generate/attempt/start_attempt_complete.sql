-- ============================================================================
-- Query: start_attempt
-- Purpose: Create a new attempt with parent bridge + profile_personas_entry
-- Section: GENERATE/ATTEMPT
--
-- Minimal attempt creation: just the attempt_entry, parent bridge, and
-- profile_personas_entry (with profiles + personas connections).
-- Everything else (chat_entry_id, department, etc.) is resolved by
-- attempt_proceed.
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_start_attempt_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_start_attempt_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_start_attempt_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_start_attempt_v4_result AS (
    attempt_id uuid
);

CREATE OR REPLACE FUNCTION socket_start_attempt_v4(
    p_profile_id uuid,
    p_home_id uuid DEFAULT NULL,
    p_practice_id uuid DEFAULT NULL,
    p_infinite_mode boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_start_attempt_v4_result[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_attempt_id uuid;
    v_is_practice boolean;
    v_profiles_resource_id uuid;
    v_profile_personas_resource_id uuid;
    v_profile_personas_entry_id uuid;
    v_persona_id uuid;
    v_num_chats int;
BEGIN
    -- Validate exactly one parent
    IF (p_home_id IS NULL AND p_practice_id IS NULL)
       OR (p_home_id IS NOT NULL AND p_practice_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Exactly one of p_home_id or p_practice_id must be provided';
    END IF;

    v_is_practice := p_practice_id IS NOT NULL;

    -- Resolve profiles_resource_id
    SELECT pp.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction pp
    WHERE pp.profile_id = p_profile_id AND pp.active = true
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'Profile resource not found for profile_id %', p_profile_id;
    END IF;

    -- Resolve profile_personas_resource from home/practice
    IF v_is_practice THEN
        SELECT hpp.profile_personas_id INTO v_profile_personas_resource_id
        FROM practice_profile_personas_connection hpp
        JOIN profile_personas_resource ppr ON ppr.id = hpp.profile_personas_id AND ppr.active = true
        WHERE hpp.practice_id = p_practice_id
          AND hpp.active = true
          AND ppr.profile_id = v_profiles_resource_id
        LIMIT 1;
    ELSE
        SELECT hpp.profile_personas_id INTO v_profile_personas_resource_id
        FROM home_profile_personas_connection hpp
        JOIN profile_personas_resource ppr ON ppr.id = hpp.profile_personas_id AND ppr.active = true
        WHERE hpp.home_id = p_home_id
          AND hpp.active = true
          AND ppr.profile_id = v_profiles_resource_id
        LIMIT 1;
    END IF;

    IF v_profile_personas_resource_id IS NULL THEN
        RAISE EXCEPTION 'No profile persona found for profile % in parent', v_profiles_resource_id;
    END IF;

    -- Resolve persona_id from profile_personas_resource
    SELECT ppr.persona_id INTO v_persona_id
    FROM profile_personas_resource ppr
    WHERE ppr.id = v_profile_personas_resource_id;

    -- Count chats from parent
    IF v_is_practice THEN
        SELECT COUNT(*)::int INTO v_num_chats
        FROM practice_chat_entry
        WHERE practice_id = p_practice_id AND active = true;
    ELSE
        SELECT COUNT(*)::int INTO v_num_chats
        FROM home_chat_entry
        WHERE home_id = p_home_id AND active = true;
    END IF;

    -- 1. Create profile_personas_entry
    INSERT INTO profile_personas_entry DEFAULT VALUES
    RETURNING id INTO v_profile_personas_entry_id;

    -- Link entry → profiles_resource
    INSERT INTO profile_personas_profiles_connection (profile_personas_entry_id, profiles_id)
    VALUES (v_profile_personas_entry_id, v_profiles_resource_id);

    -- Link entry → personas_resource
    INSERT INTO profile_personas_personas_connection (profile_personas_entry_id, personas_id)
    VALUES (v_profile_personas_entry_id, v_persona_id);

    -- 2. Create attempt_entry with profile_personas_entry link
    INSERT INTO attempt_entry (infinite_mode, num_chats, profile_personas_entry_id)
    VALUES (p_infinite_mode, GREATEST(v_num_chats, 1), v_profile_personas_entry_id)
    RETURNING id INTO v_attempt_id;

    -- 3. Create parent bridge
    IF v_is_practice THEN
        INSERT INTO attempt_practice_entry (attempt_id, practice_id)
        VALUES (v_attempt_id, p_practice_id);
    ELSE
        INSERT INTO attempt_home_entry (attempt_id, home_id)
        VALUES (v_attempt_id, p_home_id);
    END IF;

    RETURN QUERY
    SELECT ARRAY[
        ROW(v_attempt_id)::types.q_start_attempt_v4_result
    ];
END;
$$;
