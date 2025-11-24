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
policy_core AS (
    SELECT 
        p.id,
        p.name,
        p.description,
        p.file_path,
        p.mime_type,
        p.active,
        p.created_at,
        p.updated_at,
        COALESCE(pdd.department_ids, NULL) as department_ids,
        CASE 
            WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
            ELSE false
        END as can_delete
    FROM policies p
    LEFT JOIN policy_departments_data pdd ON pdd.policy_id = p.id
    CROSS JOIN user_profile up
    WHERE p.id = $1::uuid
)
SELECT 
    pc.name,
    pc.description,
    pc.file_path,
    pc.mime_type,
    pc.active,
    pc.created_at::text,
    pc.updated_at::text,
    pc.department_ids,
    COALESCE(uda.dept_ids, ARRAY[]::uuid[]) as valid_department_ids,
    pc.can_edit,
    pc.can_delete,
    COALESCE(dm.mapping, '{}'::jsonb) as department_mapping
FROM policy_core pc
CROSS JOIN user_departments_array uda
CROSS JOIN department_mapping_data dm

