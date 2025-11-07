-- Create a new assistant chat
-- Parameters: $1=created_at (timestamp with time zone), $2=title (text), $3=profile_id (uuid), $4=trace_id (text)
-- Returns: id
INSERT INTO assistant_chats (created_at, title, profile_id, trace_id)
VALUES ($1::timestamp with time zone, $2::text, $3::uuid, $4::text)
RETURNING id

