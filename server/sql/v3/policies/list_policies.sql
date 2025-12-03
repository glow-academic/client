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
policy_parameter_items_data AS (
    SELECT 
        ppi.policy_id,
        ARRAY_AGG(ppi.parameter_item_id::text ORDER BY ppi.created_at) as parameter_item_ids
    FROM policy_parameter_items ppi
    WHERE ppi.active = true
    GROUP BY ppi.policy_id
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
        p.classify_agent_id::text,
        p.created_at,
        p.updated_at,
        COALESCE(pdd.department_ids, NULL) as department_ids,
        COALESCE(ppid.parameter_item_ids, ARRAY[]::text[]) as parameter_item_ids,
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
    LEFT JOIN policy_parameter_items_data ppid ON ppid.policy_id = p.id
    LEFT JOIN policy_videos_data pvd ON pvd.policy_id = p.id
    CROSS JOIN user_profile up
    GROUP BY p.id, p.name, p.description, p.upload_id, u.file_path, u.mime_type, p.active, p.classify_agent_id, p.created_at, p.updated_at, pdd.department_ids, ppid.parameter_item_ids, pvd.video_ids, pvd.video_count, up.role
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
parameter_item_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            pi.id::text,
            jsonb_build_object(
                'name', pi.name,
                'description', COALESCE(pi.description, ''),
                'parameter_id', pi.parameter_id::text,
                'parameter_name', pi.parameter_name,
                'value', COALESCE(pi.value, '')
            )
        ) FILTER (WHERE pi.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM (
        SELECT DISTINCT
            pi.id,
            pi.name,
            pi.description,
            pi.value,
            pi.parameter_id,
            p.name as parameter_name
        FROM parameter_items pi
        JOIN parameters p ON p.id = pi.parameter_id
        LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
        WHERE p.active = true
          AND (p.document_parameter = true OR p.policy_parameter = true)
        GROUP BY pi.id, pi.name, pi.description, pi.value, pi.parameter_id, p.name
        HAVING 
            COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id IN (SELECT department_id FROM user_departments)) > 0
            OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
    ) pi
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
    COALESCE(dm.mapping, '{}'::jsonb) as department_mapping,
    COALESCE(pim.mapping, '{}'::jsonb) as parameter_item_mapping
FROM policy_data pd
CROSS JOIN video_mapping_data vm
CROSS JOIN department_mapping_data dm
CROSS JOIN parameter_item_mapping_data pim
ORDER BY pd.updated_at DESC NULLS LAST

