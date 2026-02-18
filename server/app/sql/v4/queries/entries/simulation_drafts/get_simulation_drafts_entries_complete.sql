-- Get simulation_drafts entries by IDs from simulation_drafts_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_simulation_drafts_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_drafts_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_simulation_drafts_entries_v4(
    ids uuid[]
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(
        jsonb_build_object(
            'draft_id', m.draft_id,
            'created_at', m.created_at,
            'updated_at', m.updated_at,
            'version', m.version,
            'generated', m.generated,
            'mcp', m.mcp,
            'active', m.active,
            'group_id', m.group_id,
            'department_ids', m.department_ids,
            'description_ids', m.description_ids,
            'flag_ids', m.flag_ids,
            'name_ids', m.name_ids,
            'scenario_flag_ids', m.scenario_flag_ids,
            'scenario_persona_ids', m.scenario_persona_ids,
            'scenario_position_ids', m.scenario_position_ids,
            'scenario_rubric_ids', m.scenario_rubric_ids,
            'scenario_time_limit_ids', m.scenario_time_limit_ids,
            'scenario_ids', m.scenario_ids,
            'simulation_ids', m.simulation_ids
        )
    ) AS items
    FROM simulation_drafts_mv m
    WHERE m.draft_id = ANY(ids);
END;
$$;
