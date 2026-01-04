-- Create a profile email for test setup
-- Returns email data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_profile_email_v4(uuid, text, boolean, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_profile_email_v4(
    input_profile_id uuid,
    email_address text,
    is_primary boolean DEFAULT true,
    email_active boolean DEFAULT true
)
RETURNS TABLE (
    profile_id uuid,
    email text,
    is_primary boolean,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO profile_emails(profile_id, email, is_primary, active)
    VALUES (
        input_profile_id,
        email_address,
        is_primary,
        email_active
    )
    ON CONFLICT (profile_id, email) DO UPDATE SET
        is_primary = EXCLUDED.is_primary,
        active = EXCLUDED.active
    RETURNING profile_id, email, is_primary, active, created_at, updated_at;
$$;