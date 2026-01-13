-- Delete eval (cascades to junction table and grades via FK)
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_delete_eval_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_eval_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_delete_eval_v4(
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
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = profile_artifact.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = profile_artifact.id AND pn2.type = 'last' LIMIT 1), 'System') as actor_name
    FROM params x
    JOIN profile_artifact ON profile_artifact.id = x.profile_id
),
eval_info AS (
    SELECT 
        e.id as eval_id, 
        (SELECT n.name FROM eval_names en JOIN names_resource n ON en.name_id = n.id WHERE en.eval_id = e.id LIMIT 1) as eval_name
    FROM params x
    JOIN evals_resource e ON e.id = x.eval_id
),
delete_eval AS (
    DELETE FROM eval_artifact
    USING params p
    WHERE eval_artifact.id = p.eval_id
    RETURNING eval_artifact.id as eval_id
)
SELECT ei.eval_id, ei.eval_name, ap.actor_name::text as actor_name
FROM eval_info ei
CROSS JOIN actor_profile ap
WHERE EXISTS (SELECT 1 FROM delete_eval)
$$;