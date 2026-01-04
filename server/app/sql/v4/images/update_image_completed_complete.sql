-- Update image completion status
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_update_image_completed_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_image_completed_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_update_image_completed_v4(
    image_id uuid,
    completed boolean
)
RETURNS TABLE (
    id uuid,
    completed boolean,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
UPDATE images
SET completed = api_update_image_completed_v4.completed,
    updated_at = NOW()
WHERE id = image_id
RETURNING id, completed, updated_at
$$;