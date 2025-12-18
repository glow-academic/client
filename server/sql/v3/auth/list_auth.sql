-- List all auth entries with item counts and permissions
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
auth_item_counts AS (
    SELECT 
        auth_id,
        COUNT(*) as num_items
    FROM auth_items
    GROUP BY auth_id
),
auth_sample_items AS (
    SELECT 
        ai.auth_id,
        jsonb_agg(
            jsonb_build_object(
                'auth_item_id', ai.id::text,
                'name', ai.name,
                'description', ai.description
            ) ORDER BY ai.name
        ) as sample_items
    FROM (
        SELECT id, auth_id, name, description,
               ROW_NUMBER() OVER (PARTITION BY auth_id ORDER BY name) as rn
        FROM auth_items
    ) ai
    WHERE ai.rn <= 3
    GROUP BY ai.auth_id
)
SELECT 
    a.id as auth_id,
    a.name,
    a.description,
    a.active,
    a.updated_at,
    COALESCE(aic.num_items, 0) as num_items,
    COALESCE(asi.sample_items, '[]'::jsonb) as sample_items_json,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_delete,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_duplicate,
    up.actor_name
FROM auth a
LEFT JOIN auth_item_counts aic ON aic.auth_id = a.id
LEFT JOIN auth_sample_items asi ON asi.auth_id = a.id
CROSS JOIN user_profile up
ORDER BY a.updated_at DESC NULLS LAST

