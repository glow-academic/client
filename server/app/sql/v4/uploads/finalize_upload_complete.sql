-- Finalize upload - insert upload record and get actor name
-- Converted to function following agents pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_finalize_upload_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_finalize_upload_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE (if any exist)
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_finalize_upload_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Create function
CREATE OR REPLACE FUNCTION api_finalize_upload_v4(
    upload_file_path text,
    content_type text,
    file_size bigint,
    profile_id uuid
)
RETURNS TABLE (
    upload_id uuid,
    actor_name text,
    success boolean,
    message text,
    status text
)
LANGUAGE sql
VOLATILE
AS $$
    WITH inserted_upload AS (
        INSERT INTO uploads (file_path, mime_type, size, created_at, updated_at)
        VALUES (upload_file_path, content_type, file_size, NOW(), NOW())
        RETURNING id
    ),
    actor_info AS (
        SELECT 
            first_name || ' ' || last_name as actor_name
        FROM profiles
        WHERE id = profile_id
    )
    SELECT 
        iu.id as upload_id,
        COALESCE(ai.actor_name, '') as actor_name,
        true::boolean as success,
        'Upload finalized successfully'::text as message,
        'success'::text as status
    FROM inserted_upload iu
    CROSS JOIN LATERAL (SELECT actor_name FROM actor_info) ai
$$;