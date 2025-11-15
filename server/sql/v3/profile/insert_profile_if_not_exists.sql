-- Insert profile if alias doesn't exist, skip if exists
-- Parameters:
--   $1 = profile_id (uuid)
--   $2 = first_name (text)
--   $3 = alias (text)
--   $4 = role (text)
--   $5 = viewed_intro (boolean)
-- Returns: id if inserted, NULL if skipped

INSERT INTO profiles (id, first_name, alias, role, viewed_intro)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (alias) DO NOTHING
RETURNING id

