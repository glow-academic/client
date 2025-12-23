-- Check if profile exists
SELECT EXISTS(SELECT 1 FROM profiles WHERE id = $1::uuid)

