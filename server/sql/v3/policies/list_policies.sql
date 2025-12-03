-- List policies with department access control
-- Parameters: $1 = profile_id (uuid)

WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
policy_departments_data AS (
    SELECT 
        pd.policy_id,
        ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
    FROM policy_departments pd
    WHERE pd.active = true
    GROUP BY pd.policy_id
),
policy_videos_data AS (
    SELECT 
        vp.policy_id,
        COUNT(*) as video_count,
        ARRAY_AGG(vp.video_id::text ORDER BY vp.created_at) as video_ids
    FROM video_policies vp
    WHERE vp.active = true
    GROUP BY vp.policy_id
),
policy_data AS (
    SELECT 
        p.id as policy_id,
        p.name,
        p.description,
        p.upload_id::text,
        u.file_path,
        u.mime_type,
        p.active,
        p.created_at,
        p.updated_at,
        COALESCE(pdd.department_ids, NULL) as department_ids,
        COALESCE(pvd.video_ids, ARRAY[]::text[]) as video_ids,
        COALESCE(pvd.video_count, 0) as video_count,
        CASE 
            WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
            ELSE false
        END as can_delete
    FROM policies p
    LEFT JOIN uploads u ON u.id = p.upload_id
    LEFT JOIN policy_departments pd ON pd.policy_id = p.id AND pd.active = true
    LEFT JOIN policy_departments_data pdd ON pdd.policy_id = p.id
    LEFT JOIN policy_videos_data pvd ON pvd.policy_id = p.id
    CROSS JOIN user_profile up
    GROUP BY p.id, p.name, p.description, p.upload_id, u.file_path, u.mime_type, p.active, p.created_at, p.updated_at, pdd.department_ids, pvd.video_ids, pvd.video_count, up.role
    HAVING 
        COUNT(pd.policy_id) FILTER (WHERE pd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM policy_departments pd2 WHERE pd2.policy_id = p.id AND pd2.active = true)
),
all_video_ids AS (
    SELECT DISTINCT unnest(video_ids)::uuid as video_id
    FROM policy_data
    WHERE array_length(video_ids, 1) > 0
),
video_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            v.id::text,
            jsonb_build_object(
                'name', v.name,
                'description', '',
                'length_seconds', v.length_seconds,
                'active', v.active
            )
        ) FILTER (WHERE v.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_video_ids avi
    LEFT JOIN videos v ON v.id = avi.video_id
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
    pd.*,
    CASE 
        WHEN pd.file_path IS NOT NULL THEN SUBSTRING(pd.file_path FROM '\.([^\.]+)$')
        ELSE NULL
    END as extension,
    COALESCE(vm.mapping, '{}'::jsonb) as video_mapping,
    COALESCE(dm.mapping, '{}'::jsonb) as department_mapping
FROM policy_data pd
CROSS JOIN video_mapping_data vm
CROSS JOIN department_mapping_data dm
ORDER BY pd.updated_at DESC NULLS LAST

