-- Refresh View - Generic API Endpoint for Materialized View Refresh
-- Converted to function following agents pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_refresh_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_refresh_view_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function that refreshes any materialized view and returns actor_name and response
-- This is a generic refresh function that can be used for any MV when views are upgraded.
CREATE OR REPLACE FUNCTION api_refresh_view_v4(
    profile_id uuid,
    view_name text
)
RETURNS TABLE (
    actor_name text,
    success boolean,
    message text,
    status text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    actor_name_val text;
    is_materialized boolean;
BEGIN
    -- Check if the view is a materialized view
    SELECT EXISTS (
        SELECT 1 FROM pg_matviews WHERE matviewname = view_name
    ) INTO is_materialized;

    IF NOT is_materialized THEN
        RETURN QUERY SELECT
            'System'::text as actor_name,
            false::boolean as success,
            format('%s is not a materialized view', view_name)::text as message,
            'error'::text as status;
        RETURN;
    END IF;

    -- Refresh the materialized view
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_name);

    -- Get actor_name from profile_artifact using profile_names_junction junction table
    SELECT COALESCE(
        (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = api_refresh_view_v4.profile_id LIMIT 1),
        'System'
    ) INTO actor_name_val
    FROM profile_artifact
    WHERE id = api_refresh_view_v4.profile_id;

    -- Return response
    RETURN QUERY SELECT
        COALESCE(actor_name_val, 'System')::text as actor_name,
        true::boolean as success,
        format('%s refreshed successfully', view_name)::text as message,
        'success'::text as status;
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT
            'System'::text as actor_name,
            false::boolean as success,
            format('Failed to refresh %s: %s', view_name, SQLERRM)::text as message,
            'error'::text as status;
END $$;
