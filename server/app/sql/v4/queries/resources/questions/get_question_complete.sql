-- Get question resource by ID
-- Simple data fetching for scenario two-pass architecture
-- Parameters: id (uuid)
-- Returns: item (single question resource)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_question_resource_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_question_resource_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_question_resource_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for question item
CREATE TYPE types.q_get_question_resource_v4_item AS (
    question_id uuid,
    question_text text,
    allow_multiple boolean,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_question_resource_v4(
    id uuid
)
RETURNS TABLE (
    item types.q_get_question_resource_v4_item
)
LANGUAGE sql
STABLE
AS $$
SELECT
    (
        q.id,
        q.question_text,
        COALESCE(q.allow_multiple, false),
        COALESCE(q.generated, false)
    )::types.q_get_question_resource_v4_item as item
FROM questions_resource q
WHERE q.id = id
  AND q.active = true;
$$;
