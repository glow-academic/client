SELECT sdd.department_id::text
FROM settings s
JOIN settings_default_department sdd ON sdd.settings_id = s.id
WHERE s.active = true
  AND sdd.active = true
LIMIT 1
