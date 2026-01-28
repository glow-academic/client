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
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_persona_resource_v4(
    id uuid
)
RETURNS TABLE (
    item types.q_get_persona_resource_v4_item
)
LANGUAGE sql
STABLE
AS $$
SELECT
    (
        p.id,
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM persona_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), ''),
        COALESCE((SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1), ''),
        COALESCE((SELECT i.value FROM persona_icons_junction pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1), ''),
        COALESCE((SELECT pf.value FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.name = 'image_model' LIMIT 1), false),
        COALESCE(p.generated, false)
    )::types.q_get_persona_resource_v4_item as item
FROM persona_artifact p
WHERE p.id = id
  AND EXISTS (
      SELECT 1 FROM persona_flags_junction pf
      JOIN flags_resource f ON pf.flag_id = f.id
      WHERE pf.persona_id = p.id
        AND f.name = 'persona_active'
        AND pf.value = true
  );
$$;
