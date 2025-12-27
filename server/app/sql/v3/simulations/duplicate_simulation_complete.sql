-- Duplicate simulation with all relationships
-- Converted to function

BEGIN;

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
        WHERE proname = 'api_duplicate_simulation_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_simulation_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_duplicate_simulation_v3(
    simulation_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    simulation_id uuid,
    simulation_name text,
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
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
source_simulation AS (
    SELECT 
        s.id as source_id,
        s.title,
        s.description
    FROM params x
    JOIN simulations s ON s.id = x.simulation_id
),
new_simulation AS (
    INSERT INTO simulations (
        title,
        description,
        active,
        practice_simulation,
        created_at,
        updated_at
    )
    SELECT 
        ss.title || ' Copy',
        ss.description,
        false,
        false,
        NOW(),
        NOW()
    FROM source_simulation ss
    RETURNING id as simulation_id
),
copy_scenarios AS (
    INSERT INTO simulation_scenarios (simulation_id, scenario_id, active, position, rubric_id, created_at, updated_at)
    SELECT 
        ns.simulation_id,
        ss.scenario_id,
        ss.active,
        ss.position,
        ss.rubric_id,
        NOW(),
        NOW()
    FROM source_simulation ssim
    JOIN simulation_scenarios ss ON ss.simulation_id = ssim.source_id
    CROSS JOIN new_simulation ns
),
copy_departments AS (
    INSERT INTO simulation_departments (simulation_id, department_id, active, created_at, updated_at)
    SELECT 
        ns.simulation_id,
        sd.department_id,
        sd.active,
        NOW(),
        NOW()
    FROM source_simulation ssim
    JOIN simulation_departments sd ON sd.simulation_id = ssim.source_id AND sd.active = true
    CROSS JOIN new_simulation ns
)
SELECT 
    ns.simulation_id,
    ss.title::text as simulation_name,
    ap.actor_name::text as actor_name
FROM new_simulation ns
CROSS JOIN source_simulation ss
CROSS JOIN actor_profile ap
$$;

COMMIT;

