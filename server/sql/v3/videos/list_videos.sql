WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
video_departments_data AS (
    SELECT 
        vd.video_id,
        ARRAY_AGG(vd.department_id::text ORDER BY vd.created_at) as department_ids
    FROM video_departments vd
    WHERE vd.active = true
    GROUP BY vd.video_id
),
video_all_simulation_links AS (
    SELECT 
        sv.video_id,
        COUNT(*) as total_links
    FROM simulation_videos sv
    GROUP BY sv.video_id
),
video_data AS (
    SELECT 
        v.id as video_id,
        v.name,
        v.description,
        v.length_seconds,
        v.active,
        v.updated_at,
        COALESCE(vdd.department_ids, NULL) as department_ids,
        CASE WHEN COUNT(vd.video_id) > 0 THEN true ELSE false END as has_dept_links,
        CASE 
            WHEN COALESCE(vdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin', 'instructional', 'superadmin') 
                 AND COALESCE(vasl.total_links, 0) = 0 
            THEN true
            ELSE false
        END as can_edit,
        CASE 
            -- Can't delete if can't edit (stricter than can_edit)
            WHEN COALESCE(vdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin', 'instructional', 'superadmin') 
                 AND COALESCE(vasl.total_links, 0) = 0 
            THEN true
            ELSE false
        END as can_delete,
        true as can_duplicate
    FROM videos v
    -- Only include root videos (parent_id = child_id in video_tree)
    JOIN video_tree root_check ON root_check.parent_id = v.id AND root_check.child_id = v.id
    LEFT JOIN video_departments vd ON vd.video_id = v.id AND vd.active = true
    LEFT JOIN video_departments_data vdd ON vdd.video_id = v.id
    LEFT JOIN video_all_simulation_links vasl ON vasl.video_id = v.id
    CROSS JOIN user_profile up
    GROUP BY v.id, v.name, v.description, v.length_seconds, v.active, v.updated_at, 
             vdd.department_ids, vasl.total_links, up.role
    HAVING 
        -- Include if has matching department link OR has no department links at all (cross-dept)
        COUNT(vd.video_id) FILTER (WHERE vd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM video_departments vd2 WHERE vd2.video_id = v.id AND vd2.active = true)
),
department_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.title,
                'description', COALESCE(d.description, '')
            )
        ) FILTER (WHERE d.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM user_departments)
)
SELECT 
    vd.*,
    dm.mapping as department_mapping
FROM video_data vd
CROSS JOIN department_mapping_data dm
ORDER BY vd.updated_at DESC NULLS LAST

