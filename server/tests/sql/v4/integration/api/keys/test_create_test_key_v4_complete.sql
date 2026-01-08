-- Create a test key for test setup
-- Returns key data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_key_v4(text, text, text, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_key_v4(
    key_name text,
    key_value text,
    key_description text DEFAULT 'Test key description',
    key_active boolean DEFAULT true
)
RETURNS TABLE (
    key_id uuid,
    name text,
    key text,
    description text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_key AS (
        INSERT INTO keys(key)
        VALUES (key_value)
        RETURNING id, created_at, updated_at
    ),
    name_resource AS (
        INSERT INTO names(name)
        VALUES (key_name)
        RETURNING id
    ),
    description_resource AS (
        INSERT INTO descriptions(description)
        VALUES (COALESCE(key_description, 'Test key description'))
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags WHERE name = 'active' LIMIT 1
    ),
    key_name_link AS (
        INSERT INTO key_names(key_id, name_id)
        SELECT nk.id, nr.id
        FROM new_key nk, name_resource nr
        RETURNING key_id
    ),
    key_description_link AS (
        INSERT INTO key_descriptions(key_id, description_id)
        SELECT nk.id, dr.id
        FROM new_key nk, description_resource dr
        RETURNING key_id
    ),
    key_flag_link AS (
        INSERT INTO key_flags(key_id, flag_id, type, value)
        SELECT nk.id, af.id, 'active'::type_key_flags, COALESCE(key_active, true)
        FROM new_key nk, active_flag af
        RETURNING key_id
    )
    SELECT 
        nk.id AS key_id,
        (SELECT n.name FROM key_names kn JOIN names n ON kn.name_id = n.id WHERE kn.key_id = nk.id LIMIT 1) AS name,
        k.key,
        (SELECT d.description FROM key_descriptions kd JOIN descriptions d ON kd.description_id = d.id WHERE kd.key_id = nk.id LIMIT 1) AS description,
        EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = nk.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) AS active,
        nk.created_at,
        nk.updated_at
    FROM new_key nk
    JOIN keys k ON k.id = nk.id;
$$;