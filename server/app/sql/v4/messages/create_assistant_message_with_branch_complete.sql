-- Create assistant message, link to run, and create branch from developer (or system if no developer)
-- Converted to PostgreSQL function
-- Creates message, links to run, and creates message_tree branch
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_assistant_message_with_branch_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_assistant_message_with_branch_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_create_assistant_message_with_branch_v4(
    content text,
    run_id uuid,
    parent_message_id uuid
)
RETURNS TABLE (
    id uuid,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
WITH assistant_message AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    VALUES ('assistant'::message_role, true, false, NOW(), NOW())
    RETURNING id, created_at, updated_at
),
insert_content AS (
    INSERT INTO message_content (message_id, idx, content, created_at, updated_at)
    SELECT id, 0, content, created_at, updated_at
    FROM assistant_message
),
link_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT am.id, run_id, NOW(), NOW()
    FROM assistant_message am
    ON CONFLICT (message_id, run_id) 
    DO UPDATE SET updated_at = NOW()
),
create_branch AS (
    INSERT INTO message_tree (parent_id, child_id, active, created_at, updated_at)
    SELECT parent_message_id, am.id, true, NOW(), NOW()
    FROM assistant_message am
    WHERE parent_message_id IS NOT NULL
    ON CONFLICT (parent_id, child_id) 
    DO UPDATE SET 
        active = true,
        updated_at = NOW()
)
SELECT id, created_at FROM assistant_message
$$;