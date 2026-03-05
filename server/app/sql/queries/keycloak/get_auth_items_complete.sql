DROP FUNCTION IF EXISTS api_get_auth_items_v4(uuid, uuid);
CREATE OR REPLACE FUNCTION api_get_auth_items_v4(
    auth_id uuid,        -- auth_artifact.id (stable entrypoint)
    department_id uuid   -- department_artifact.id (for config lookup)
)
RETURNS TABLE (
    name text,
    value text,
    encrypted boolean
)
LANGUAGE sql
STABLE
AS $$
-- Map auth_artifact.id -> auths_resource.id (needed for auth_item_keys_resource)
WITH auth_resource_mapping AS (
    SELECT aaj.auth_id as artifact_id, aaj.auths_id as resource_id
    FROM auth_auths_junction aaj
    WHERE aaj.auth_id = api_get_auth_items_v4.auth_id
    LIMIT 1
),
-- Department settings via resource-first: departments_resource.setting_ids -> settings_resource -> setting_settings_junction
dept_settings AS (
    SELECT DISTINCT ssj.setting_id as settings_id
    FROM departments_resource dr
    JOIN department_departments_junction ddj ON ddj.departments_id = dr.id
    CROSS JOIN LATERAL UNNEST(dr.setting_ids) AS s_id
    JOIN settings_resource sr ON sr.id = s_id AND sr.active = true
    JOIN setting_settings_junction ssj ON ssj.settings_id = s_id
    WHERE api_get_auth_items_v4.department_id IS NOT NULL
      AND ddj.department_id = api_get_auth_items_v4.department_id
),
-- Default settings: not linked to any department
default_settings AS (
    SELECT ssj.setting_id as settings_id
    FROM settings_resource sr
    JOIN setting_settings_junction ssj ON ssj.settings_id = sr.id
    WHERE sr.active = true
      AND NOT EXISTS (
          SELECT 1 FROM departments_resource dr
          WHERE sr.id = ANY(dr.setting_ids)
      )
    LIMIT 1
),
-- Try department-specific settings first (encrypted items)
dept_encrypted_items AS (
    SELECT DISTINCT ON (i.name) i.name, kr.key as value, i.encrypted
    FROM auth_resource_mapping arm
    JOIN auth_items_junction ai_j ON ai_j.auth_id = arm.artifact_id
    JOIN items_resource i ON i.id = ai_j.item_id
    JOIN setting_auth_item_keys_junction sak ON sak.active = true
    JOIN dept_settings ds ON sak.setting_id = ds.settings_id
    JOIN auth_item_keys_resource akr ON akr.id = sak.auth_item_keys_id AND akr.active = true
    JOIN keys_resource kr ON kr.id = akr.key_id AND kr.active
    WHERE i.encrypted = true
      AND akr.auth_id = arm.resource_id
      AND akr.item_id = ai_j.item_id
    ORDER BY i.name, kr.created_at DESC
),
-- Fall back to default settings (encrypted items)
default_encrypted_items AS (
    SELECT DISTINCT ON (i.name) i.name, kr.key as value, i.encrypted
    FROM auth_resource_mapping arm
    JOIN auth_items_junction ai_j ON ai_j.auth_id = arm.artifact_id
    JOIN items_resource i ON i.id = ai_j.item_id
    JOIN setting_auth_item_keys_junction sak ON sak.active = true
    JOIN default_settings ds ON sak.setting_id = ds.settings_id
    JOIN auth_item_keys_resource akr ON akr.id = sak.auth_item_keys_id AND akr.active = true
    JOIN keys_resource kr ON kr.id = akr.key_id AND kr.active
    WHERE i.encrypted = true
      AND akr.auth_id = arm.resource_id
      AND akr.item_id = ai_j.item_id
      AND NOT EXISTS (
          SELECT 1 FROM dept_encrypted_items dei
          WHERE dei.name = i.name
      )
    ORDER BY i.name, kr.created_at DESC
),
encrypted_items AS (
    SELECT name, value, encrypted FROM dept_encrypted_items
    UNION ALL
    SELECT name, value, encrypted FROM default_encrypted_items
),
-- Same logic for non-encrypted items
dept_non_encrypted_items AS (
    SELECT DISTINCT ON (i.name) i.name, aiv.value, i.encrypted
    FROM auth_resource_mapping arm
    JOIN auth_items_junction ai_j ON ai_j.auth_id = arm.artifact_id
    JOIN items_resource i ON i.id = ai_j.item_id
    JOIN auth_item_values_resource aiv ON aiv.auth_id = arm.resource_id AND aiv.item_id = ai_j.item_id AND aiv.active = true
    JOIN setting_auth_item_values_junction saiv ON saiv.auth_item_values_id = aiv.id AND saiv.active = true
    JOIN dept_settings ds ON saiv.setting_id = ds.settings_id
    WHERE i.encrypted = false
    ORDER BY i.name, aiv.created_at DESC
),
default_non_encrypted_items AS (
    SELECT DISTINCT ON (i.name) i.name, aiv.value, i.encrypted
    FROM auth_resource_mapping arm
    JOIN auth_items_junction ai_j ON ai_j.auth_id = arm.artifact_id
    JOIN items_resource i ON i.id = ai_j.item_id
    JOIN auth_item_values_resource aiv ON aiv.auth_id = arm.resource_id AND aiv.item_id = ai_j.item_id AND aiv.active = true
    JOIN setting_auth_item_values_junction saiv ON saiv.auth_item_values_id = aiv.id AND saiv.active = true
    JOIN default_settings ds ON saiv.setting_id = ds.settings_id
    WHERE i.encrypted = false
      AND NOT EXISTS (
          SELECT 1 FROM dept_non_encrypted_items dni
          WHERE dni.name = i.name
      )
    ORDER BY i.name, aiv.created_at DESC
),
non_encrypted_items AS (
    SELECT name, value, encrypted FROM dept_non_encrypted_items
    UNION ALL
    SELECT name, value, encrypted FROM default_non_encrypted_items
)
SELECT DISTINCT ON (name) name, value, encrypted
FROM (
    SELECT name, value, encrypted FROM encrypted_items
    UNION ALL
    SELECT name, value, encrypted FROM non_encrypted_items
) combined_items
ORDER BY name, encrypted DESC
$$;
