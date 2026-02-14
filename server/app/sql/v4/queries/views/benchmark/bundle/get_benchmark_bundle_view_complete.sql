-- ============================================================================
-- Query: get_benchmark_bundle_view
-- Purpose: Thin MV filter for benchmark bundle customization flows
-- Section: VIEWS/BENCHMARK/BUNDLE
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_benchmark_bundle_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_benchmark_bundle_view_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_benchmark_bundle_view_v4(
    profile_id_filter uuid,
    benchmark_bundle_entry_id_filter uuid
)
RETURNS TABLE (
    profile_has_access boolean,
    benchmark_bundle_entry_id uuid,
    benchmark_id uuid,
    -- 12 bundle-level resource ID arrays
    department_ids uuid[],
    model_ids uuid[],
    prompt_ids uuid[],
    instruction_ids uuid[],
    voice_ids uuid[],
    temperature_level_ids uuid[],
    reasoning_level_ids uuid[],
    tool_ids uuid[],
    key_ids uuid[],
    flag_ids uuid[],
    name_ids uuid[],
    description_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id_filter AS profile_id,
        benchmark_bundle_entry_id_filter AS benchmark_bundle_entry_id
),
bundle AS (
    SELECT mbb.*
    FROM mv_benchmark_bundle mbb
    WHERE mbb.benchmark_bundle_entry_id = (SELECT benchmark_bundle_entry_id FROM params)
    LIMIT 1
),
benchmark AS (
    SELECT be.*
    FROM benchmark_entry be
    JOIN bundle b ON be.id = b.benchmark_id
    LIMIT 1
),
access_check AS (
    SELECT EXISTS (
        SELECT 1
        FROM params p
        JOIN benchmark bm ON TRUE
        JOIN benchmark_departments_connection bdc
          ON bdc.benchmark_id = bm.id
         AND bdc.active = true
        JOIN profile_profiles_junction ppj
          ON ppj.profile_id = p.profile_id
         AND ppj.active = true
        WHERE TRUE
    ) AS profile_has_access
)
SELECT
    COALESCE(ac.profile_has_access, false) AS profile_has_access,
    b.benchmark_bundle_entry_id,
    b.benchmark_id,
    b.department_ids,
    b.model_ids,
    b.prompt_ids,
    b.instruction_ids,
    b.voice_ids,
    b.temperature_level_ids,
    b.reasoning_level_ids,
    b.tool_ids,
    b.key_ids,
    b.flag_ids,
    b.name_ids,
    b.description_ids
FROM bundle b
LEFT JOIN access_check ac ON TRUE;
$$;
