-- Get persona generation context (domain_id and agent_id)
-- Returns domain_id and agent_id for persona generation based on persona's department or profile's primary department
-- Uses safe drop/recreate pattern
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_persona_generation_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_generation_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_get_persona_generation_context_v4(
    profile_id uuid,
    persona_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    domain_id uuid,
    agent_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        persona_id AS persona_id,
        draft_id AS draft_id,
        profile_id AS profile_id
),
-- Get persona's department (if persona_id provided)
persona_department AS (
    SELECT pd.department_id
    FROM params p
    JOIN persona_departments_junction pd ON pd.persona_id = p.persona_id AND pd.active = true
    WHERE p.persona_id IS NOT NULL
    LIMIT 1
),
-- Get profile's primary department (if only draft_id provided)
profile_primary_department AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    WHERE p.persona_id IS NULL
    LIMIT 1
),
-- Determine department to use
selected_department AS (
    SELECT 
        COALESCE(
            (SELECT department_id FROM persona_department),
            (SELECT department_id FROM profile_primary_department)
        ) as department_id
)
-- Domain-based agent assignment removed - return NULL
SELECT 
    NULL::uuid as domain_id,
    NULL::uuid as agent_id
FROM selected_department
$$;
