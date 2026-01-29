-- Search personas resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), user_department_ids (uuid[]), group_id (uuid), exclude_ids (uuid[])
-- Returns: items (array of persona resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_personas_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_personas_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_personas_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    group_id uuid DEFAULT NULL,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_personas_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.persona_id, q.name, q.description, q.color, q.icon, q.image_model, q.generated)::types.q_get_personas_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_personas_v4_item[]
) as items
FROM (
    SELECT
        p.id AS persona_id,
        p.name,
        COALESCE(p.description, '') AS description,
        COALESCE(p.color, '') AS color,
        COALESCE(p.icon, '') AS icon,
        false AS image_model,
        COALESCE(p.generated, false) AS generated
    FROM personas_resource p
    -- Join to persona artifact to check active flag
    LEFT JOIN persona_personas_junction ppj ON ppj.personas_id = p.id
    LEFT JOIN persona_artifact pa ON pa.id = ppj.persona_id
    LEFT JOIN persona_flags_junction pf ON pf.persona_id = pa.id
    LEFT JOIN flags_resource f ON f.id = pf.flag_id AND f.name = 'persona_active'
    -- Join to departments for filtering
    LEFT JOIN persona_departments_junction pd ON pd.persona_id = pa.id AND pd.active = true
    WHERE
        -- Must be active
        COALESCE(pf.value, false) = true
        -- Department access: user can see if persona has matching department OR has no departments
        AND (
            COALESCE(array_length(user_department_ids, 1), 0) = 0
            OR pd.department_id = ANY(user_department_ids)
            OR NOT EXISTS (SELECT 1 FROM persona_departments_junction pd2 WHERE pd2.persona_id = pa.id AND pd2.active = true)
        )
        -- Exclude already selected
        AND (exclude_ids IS NULL OR NOT (p.id = ANY(exclude_ids)))
        -- Optional search filter
        AND (search IS NULL OR search = '' OR LOWER(p.name) LIKE '%' || LOWER(search) || '%')
    GROUP BY p.id, p.name, p.description, p.color, p.icon, p.generated
    ORDER BY p.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
