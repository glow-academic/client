SELECT id
FROM profiles
WHERE role = 'guest' AND first_name = 'Default'
ORDER BY created_at DESC
LIMIT 1

