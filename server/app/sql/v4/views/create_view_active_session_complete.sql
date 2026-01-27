-- View: view_active_session_complete
-- Pre-computed active session per profile (single row per profile).
-- Uses DISTINCT ON to get the most recently created active session for each profile.
-- This eliminates the repeated active session lookup pattern across 28+ files.
-- Write to sessions_entry, read from this _view.

CREATE OR REPLACE VIEW view_active_session_complete AS
SELECT DISTINCT ON (profile_id)
    profile_id,
    id AS session_id,
    created_at AS session_created_at
FROM sessions_entry
WHERE active = true
ORDER BY profile_id, created_at DESC;
