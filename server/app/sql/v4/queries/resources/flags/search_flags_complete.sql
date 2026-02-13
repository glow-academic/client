-- Search flags resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[]), + artifact boolean filters
-- Returns: items (array of flag resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_flags_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_flags_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_flags_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    agent boolean DEFAULT false,
    auth boolean DEFAULT false,
    cohort boolean DEFAULT false,
    department boolean DEFAULT false,
    document boolean DEFAULT false,
    eval boolean DEFAULT false,
    field boolean DEFAULT false,
    model boolean DEFAULT false,
    parameter boolean DEFAULT false,
    persona boolean DEFAULT false,
    profile boolean DEFAULT false,
    provider boolean DEFAULT false,
    rubric boolean DEFAULT false,
    scenario boolean DEFAULT false,
    setting boolean DEFAULT false,
    simulation boolean DEFAULT false,
    tool boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_flags_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.description, q.icon, q.generated)::types.q_get_flags_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_flags_v4_item[]
) as items
FROM (
    SELECT f.id, f.name, f.description, f.icon, COALESCE(f.generated, false) AS generated
    FROM flags_resource f
    WHERE (search IS NULL OR search = '' OR LOWER(f.name) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (f.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT agent OR EXISTS (SELECT 1 FROM agent_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT auth OR EXISTS (SELECT 1 FROM auth_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT cohort OR EXISTS (SELECT 1 FROM cohort_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT department OR EXISTS (SELECT 1 FROM department_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT document OR EXISTS (SELECT 1 FROM document_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT eval OR EXISTS (SELECT 1 FROM eval_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT field OR EXISTS (SELECT 1 FROM field_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT model OR EXISTS (SELECT 1 FROM model_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT parameter OR EXISTS (SELECT 1 FROM parameter_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT persona OR EXISTS (SELECT 1 FROM persona_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT profile OR EXISTS (SELECT 1 FROM profile_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT provider OR EXISTS (SELECT 1 FROM provider_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT rubric OR EXISTS (SELECT 1 FROM rubric_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT scenario OR EXISTS (SELECT 1 FROM scenario_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT setting OR EXISTS (SELECT 1 FROM setting_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT simulation OR EXISTS (SELECT 1 FROM simulation_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
      AND (NOT tool OR EXISTS (SELECT 1 FROM tool_flags_junction j WHERE j.flag_id = f.id AND j.active = true))
    ORDER BY f.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
