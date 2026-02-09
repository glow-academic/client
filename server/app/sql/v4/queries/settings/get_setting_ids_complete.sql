-- Settings IDs Query (Pass 2 of two-pass architecture)
-- Uses existing get_setting function contract as source of selected IDs and agent IDs.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_setting_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_setting_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_setting_ids_v4(
    profile_id uuid,
    setting_id uuid DEFAULT NULL,
    color_search text DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    name_id uuid,
    description_id uuid,
    active_flag_id uuid,
    color_ids uuid[],
    department_ids uuid[],
    name_agent_id uuid,
    description_agent_id uuid,
    colors_agent_id uuid,
    flag_agent_id uuid,
    departments_agent_id uuid,
    profiles_agent_id uuid,
    auths_agent_id uuid,
    provider_key_ids uuid[],
    keys_agent_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT
    s.name_id,
    s.description_id,
    s.active_flag_id,
    COALESCE(s.color_ids, ARRAY[]::uuid[]),
    COALESCE(s.department_ids, ARRAY[]::uuid[]),
    s.name_agent_id,
    s.description_agent_id,
    s.colors_agent_id,
    s.flag_agent_id,
    s.departments_agent_id,
    s.profiles_agent_id,
    s.auths_agent_id,
    s.provider_key_ids,
    s.keys_agent_id
FROM api_get_setting_v4(
    profile_id => profile_id,
    setting_id => setting_id,
    color_search => color_search,
    draft_id => draft_id,
    mcp => mcp
) s;
$$;
