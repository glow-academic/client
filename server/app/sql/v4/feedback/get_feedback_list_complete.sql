-- Get all feedback entries with author information
-- Converted to PostgreSQL function
-- Returns all feedback entries ordered by resolved status (unresolved first) then created_at DESC
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_feedback_list_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_feedback_list_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types WITHOUT CASCADE
DROP TYPE IF EXISTS types.q_get_feedback_list_v4_feedback_row;

-- Create composite type for feedback row
CREATE TYPE types.q_get_feedback_list_v4_feedback_row AS (
    feedback_id uuid,
    type feedback_type,
    message text,
    created_at timestamptz,
    resolved boolean,
    author_name text,
    author_email text,
    author_emails text[],
    author_profile_id text
);

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_feedback_list_v4(
    profile_id uuid
)
RETURNS TABLE (
    actor_name text,
    feedback types.q_get_feedback_list_v4_feedback_row[]
)
LANGUAGE sql
STABLE
AS $$
WITH actor_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM profile_artifact p
    WHERE p.id = profile_id
),
feedback_rows AS (
    SELECT 
        f.id as feedback_id,
        f.type,
        COALESCE(f.message, '') as message,
        f.created_at,
        f.resolved,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = f.profile_id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = f.profile_id AND pn2.type = 'last' LIMIT 1), ''), 'Anonymous') as author_name,
        COALESCE(
            (SELECT email FROM profile_emails WHERE profile_id = f.profile_id AND is_primary = true AND active = true LIMIT 1),
            ''
        ) as author_email,
        COALESCE(
            ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true),
            ARRAY[]::text[]
        ) as author_emails,
        COALESCE(f.profile_id::text, '') as author_profile_id
    FROM problems f
    LEFT JOIN profile_artifact p ON p.id = f.profile_id
    LEFT JOIN profile_emails pe ON pe.profile_id = f.profile_id AND pe.active = true
    GROUP BY f.id, f.type, f.message, f.created_at, f.resolved, f.profile_id
    ORDER BY f.resolved ASC, f.created_at DESC
)
SELECT 
    COALESCE(ap.actor_name, '') as actor_name,
    COALESCE(
        ARRAY_AGG(
            (fr.feedback_id, fr.type, fr.message, fr.created_at, fr.resolved, fr.author_name, fr.author_email, fr.author_emails, fr.author_profile_id)::types.q_get_feedback_list_v4_feedback_row
        ),
        ARRAY[]::types.q_get_feedback_list_v4_feedback_row[]
    ) as feedback
FROM actor_profile ap
CROSS JOIN feedback_rows fr
GROUP BY ap.actor_name
$$;