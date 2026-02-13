-- Get persona resource by ID
-- Simple data fetching for scenario two-pass architecture
-- Parameters: id (uuid)
-- Returns: item (single persona resource)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_persona_resource_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_resource_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_persona_resource_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for persona item
CREATE TYPE types.q_get_persona_resource_v4_item AS (
    persona_id uuid,
    name text,
    description text,
    color text,
    icon text,
    image_model boolean,
    instructions text,
    examples text[],
    generated boolean
);

-- Create function — reads directly from personas_resource columns
CREATE OR REPLACE FUNCTION api_get_persona_resource_v4(
    id uuid
)
RETURNS TABLE (
    items types.q_get_persona_resource_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            pr.id,
            COALESCE(pr.name, ''),
            COALESCE(pr.description, ''),
            COALESCE(pr.color, ''),
            COALESCE(pr.icon, ''),
            false,  -- image_model: pending denormalization onto personas_resource
            COALESCE(pr.instructions, ''),
            COALESCE(pr.examples, ARRAY[]::text[]),
            COALESCE(pr.generated, false)
        )::types.q_get_persona_resource_v4_item
    ),
    ARRAY[]::types.q_get_persona_resource_v4_item[]
) as items
FROM personas_resource pr
WHERE pr.id = $1
  AND pr.active = true;
$$;
