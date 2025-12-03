-- Get policy detail
-- Parameters: $1 = policy_id (uuid), $2 = profile_id (uuid)

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT role FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
user_departments AS (
    SELECT department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
user_departments_array AS (
    SELECT COALESCE(ARRAY_AGG(DISTINCT department_id), ARRAY[]::uuid[]) as dept_ids
    FROM user_departments
),
department_mapping_data AS (
    SELECT 
        CASE 
            WHEN COUNT(d.id) > 0 THEN
                jsonb_object_agg(
                    d.id::text,
                    jsonb_build_object(
                        'name', d.title,
                        'description', COALESCE(d.description, '')
                    )
                ) FILTER (WHERE d.id IS NOT NULL)
            ELSE '{}'::jsonb
        END as mapping
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM user_departments)
    GROUP BY ()
),
policy_departments_data AS (
    SELECT 
        pd.policy_id,
        ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
    FROM policy_departments pd
    WHERE pd.policy_id = $1 AND pd.active = true
    GROUP BY pd.policy_id
),
policy_parameter_items_data AS (
    SELECT 
        ppi.policy_id,
        ARRAY_AGG(ppi.parameter_item_id::text ORDER BY ppi.created_at) as parameter_item_ids
    FROM policy_parameter_items ppi
    WHERE ppi.policy_id = $1 AND ppi.active = true
    GROUP BY ppi.policy_id
),
valid_param_items AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                pi.id::text,
                jsonb_build_object(
                    'name', pi.name,
                    'description', COALESCE(pi.description, ''),
                    'parameter_id', pi.parameter_id::text,
                    'parameter_name', p.name
                )
            ),
            '{}'::jsonb
        ) as param_item_mapping,
        array_agg(pi.id::text ORDER BY pi.name) as param_item_ids
    FROM parameter_items pi
    JOIN parameters p ON p.id = pi.parameter_id
    CROSS JOIN resolve_profile_id rpi
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    LEFT JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id AND pd.active = true
    WHERE p.active = true
      AND (p.document_parameter = true OR p.policy_parameter = true)
      AND (
          pid.department_id IN (SELECT department_id FROM user_departments)
          OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 WHERE pid2.parameter_item_id = pi.id AND pid2.active = true)
      )
),
policy_core AS (
    SELECT 
        p.id,
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
    LEFT JOIN policy_departments_data pdd ON pdd.policy_id = p.id
    LEFT JOIN policy_parameter_items_data ppid ON ppid.policy_id = p.id
    CROSS JOIN user_profile up
    WHERE p.id = $1::uuid
)
SELECT 
    pc.name,
    pc.description,
    pc.upload_id,
    pc.file_path,
    pc.mime_type,
    pc.active,
    pc.classify_agent_id,
    pc.created_at::text,
    pc.updated_at::text,
    pc.department_ids,
    pc.parameter_item_ids,
    COALESCE(uda.dept_ids, ARRAY[]::uuid[]) as valid_department_ids,
    COALESCE(vpi.param_item_ids, ARRAY[]::text[]) as valid_parameter_item_ids,
    pc.can_edit,
    pc.can_delete,
    COALESCE(dm.mapping, '{}'::jsonb) as department_mapping,
    COALESCE(vpi.param_item_mapping, '{}'::jsonb) as parameter_item_mapping
FROM policy_core pc
CROSS JOIN user_departments_array uda
CROSS JOIN department_mapping_data dm
CROSS JOIN valid_param_items vpi

