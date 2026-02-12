-- Get agents resources by IDs
-- Simple data fetching from denormalized agents_resource
-- Parameters: ids (uuid[])
-- Returns: items (array of agent resources with config fields)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_agents_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_agents_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop search function if exists (avoids type dependency conflicts)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_agents_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_agents_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_agents_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for agent item
CREATE TYPE types.q_get_agents_v4_item AS (
    id uuid,
    name text,
    description text,
    model_id uuid,
    temperature real,
    reasoning text,
    tool_ids uuid[],
    quality text,
    voice text,
    prompt_id uuid,
    instruction_ids uuid[],
    active boolean,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_agents_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_agents_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (a.id, a.name, a.description, a.model_id, a.temperature, a.reasoning, COALESCE(a.tool_ids, ARRAY[]::uuid[]), a.quality::text, a.voice, a.prompt_id, COALESCE(a.instruction_ids, ARRAY[]::uuid[]), COALESCE(a.active, true), COALESCE(a.generated, false))::types.q_get_agents_v4_item
        ORDER BY array_position(ids, a.id)
    ),
    ARRAY[]::types.q_get_agents_v4_item[]
) as items
FROM agents_resource a
WHERE a.id = ANY(ids)
  AND a.name IS NOT NULL
  AND a.name != '';
$$;
