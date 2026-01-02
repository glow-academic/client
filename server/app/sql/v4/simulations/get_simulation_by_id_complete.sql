-- Get simulation by ID
-- Converted to PostgreSQL function

BEGIN;

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_simulation_by_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_by_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_simulation_by_id_v4(
    simulation_id uuid
)
RETURNS TABLE (
    id uuid,
    title text,
    description text,
    active boolean,
    practice_simulation boolean,
    rubric_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    s.id,
    s.title,
    s.description,
    s.active,
    s.practice_simulation,
    (SELECT ss.rubric_id FROM simulation_scenarios ss WHERE ss.simulation_id = s.id AND ss.active = true ORDER BY ss.position LIMIT 1) as rubric_id
FROM simulations s
WHERE s.id = simulation_id
$$;

COMMIT;

