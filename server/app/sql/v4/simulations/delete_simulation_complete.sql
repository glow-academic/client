-- Delete simulation with existence and usage checks in a single transaction
-- Converted to function
-- 1) Drop function first
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_delete_simulation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_simulation_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_delete_simulation_v4(
    simulation_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    deleted boolean,
    usage_count bigint,
    title text,
    actor_name text
)
LANGUAGE sql
AS $$
WITH params AS (
    SELECT simulation_id AS simulation_id,
           profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        x.profile_id,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
simulation_info AS (
    SELECT 
        s.id,
        (SELECT n.name FROM simulation_names sn JOIN names n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as title,
        (SELECT COUNT(*) FROM cohort_simulations WHERE cohort_simulations.simulation_id = s.id) as usage_count
    FROM params x
    JOIN simulations s ON s.id = x.simulation_id
),
delete_simulation AS (
    DELETE FROM simulations
    WHERE id IN (
        SELECT id FROM simulation_info WHERE usage_count = 0
    )
    RETURNING id
)
SELECT 
    CASE WHEN ds.id IS NOT NULL THEN true ELSE false END as deleted,
    si.usage_count,
    si.title::text as title,
    ap.actor_name::text as actor_name
FROM simulation_info si
LEFT JOIN delete_simulation ds ON ds.id = si.id
CROSS JOIN actor_profile ap
$$;