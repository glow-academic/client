-- Search available profile personas for profiles
-- Returns available personas from profile_personas_resource
-- Parameters: profile_ids (uuid[]), persona_ids (uuid[]), cohort (boolean)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_profile_personas_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_profile_personas_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Reuses type from get endpoint: types.q_get_profile_personas_v4_item

CREATE OR REPLACE FUNCTION api_search_profile_personas_v4(
    profile_ids uuid[] DEFAULT ARRAY[]::uuid[],
    persona_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    cohort boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_profile_personas_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT
    COALESCE(
        ARRAY_AGG(
            (ppr.id, ppr.profile_id, ppr.persona_id, COALESCE(ppr.generated, false))::types.q_get_profile_personas_v4_item
            ORDER BY ppr.profile_id
        ),
        '{}'::types.q_get_profile_personas_v4_item[]
    ) as items
FROM profile_personas_resource ppr
WHERE ppr.active = true
  AND (
    COALESCE(array_length(profile_ids, 1), 0) = 0
    OR ppr.profile_id = ANY(profile_ids)
  )
  AND (COALESCE(array_length(persona_ids, 1), 0) = 0 OR ppr.persona_id = ANY(persona_ids))
  -- Artifact boolean filters
  AND (NOT cohort OR EXISTS (SELECT 1 FROM cohort_profile_personas_junction j WHERE j.profile_persona_id = ppr.id AND j.active = true));
$$;
