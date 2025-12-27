-- Delete eval (cascades to junction table and grades via FK)
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_delete_eval_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_eval_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_delete_eval_v3(
    eval_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    eval_id uuid,
    eval_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        eval_id AS eval_id,
        profile_id AS profile_id
),
actor_profile AS (
    SELECT
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
eval_info AS (
    SELECT id as eval_id, name as eval_name 
    FROM params x
    JOIN evals ON evals.id = x.eval_id
),
delete_eval AS (
    DELETE FROM evals
    USING params p
    WHERE evals.id = p.eval_id
    RETURNING evals.id as eval_id
)
SELECT ei.eval_id, ei.eval_name, ap.actor_name::text as actor_name
FROM eval_info ei
CROSS JOIN actor_profile ap
WHERE EXISTS (SELECT 1 FROM delete_eval)
$$;

COMMIT;

