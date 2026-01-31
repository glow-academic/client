-- Refresh NEW home MVs in dependency order
-- Simple function to refresh all home materialized views

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_refresh_home_mvs_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_refresh_home_mvs_new_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_refresh_home_mvs_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
-- Note: REFRESH MATERIALIZED VIEW cannot be run inside a SQL function
-- So we use PLPGSQL instead
CREATE OR REPLACE FUNCTION api_refresh_home_mvs_new_v4(
    profile_id uuid,
    concurrent boolean DEFAULT TRUE
)
RETURNS TABLE (
    actor_name text,
    success boolean,
    refreshed_mvs text[],
    duration_ms int
)
LANGUAGE plpgsql
AS $$
DECLARE
    start_time timestamptz;
    end_time timestamptz;
    mv_name text;
    -- Note: mv_home_simulation_status removed - it doesn't support date filtering
    -- Overview queries now aggregate from mv_home_attempt_history instead
    mv_list text[] := ARRAY[
        'mv_home_chat_facts',
        'mv_home_attempt_history',
        'mv_home_certificate_status'
    ];
    refreshed text[] := ARRAY[]::text[];
    v_actor_name text;
BEGIN
    start_time := clock_timestamp();

    -- Get actor name
    SELECT pr.name INTO v_actor_name
    FROM profiles_resource pr
    WHERE pr.id = profile_id;

    -- Refresh each MV in order
    FOREACH mv_name IN ARRAY mv_list
    LOOP
        -- Check if MV exists
        IF EXISTS (
            SELECT 1 FROM pg_matviews
            WHERE schemaname = 'public' AND matviewname = mv_name
        ) THEN
            IF concurrent THEN
                EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', mv_name);
            ELSE
                EXECUTE format('REFRESH MATERIALIZED VIEW %I', mv_name);
            END IF;
            refreshed := array_append(refreshed, mv_name);
        END IF;
    END LOOP;

    end_time := clock_timestamp();

    RETURN QUERY SELECT
        v_actor_name,
        TRUE,
        refreshed,
        (EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)::int;
END;
$$;
