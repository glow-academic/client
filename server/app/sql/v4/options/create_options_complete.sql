-- Create options for questions
-- Converted to PostgreSQL function
-- Options can be reused across multiple questions
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_options_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_options_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_create_options_v4(
    options_json jsonb,
    scenario_id uuid
)
RETURNS TABLE (
    option_id uuid,
    option_text text
)
LANGUAGE sql
VOLATILE
AS $$
WITH options_data AS (
    -- Parse options from JSON
    SELECT 
        opt->>'option_text' as option_text
    FROM jsonb_array_elements(options_json) as opt
    WHERE opt->>'option_text' IS NOT NULL AND opt->>'option_text' != ''
),
create_options AS (
    -- Create options (reusable across questions, no type column)
    INSERT INTO options_resource (option_text, active, created_at, updated_at)
    SELECT DISTINCT
        od.option_text,
        true,
        NOW(),
        NOW()
    FROM options_data od
    ON CONFLICT DO NOTHING
    RETURNING id::uuid as option_id, option_text
),
get_existing_options AS (
    -- Get existing options that match
    SELECT 
        o.id as option_id,
        o.option_text
    FROM options_resource o
    JOIN options_data od ON o.option_text = od.option_text
    WHERE o.active = true
),
all_options AS (
    SELECT * FROM create_options
    UNION
    SELECT * FROM get_existing_options
),
link_scenario_options AS (
    -- Link options to scenario via junction table
    INSERT INTO scenario_options (scenario_id, option_id, active, created_at, updated_at)
    SELECT 
        scenario_id,
        ao.option_id,
        true,
        NOW(),
        NOW()
    FROM all_options ao
    ON CONFLICT (scenario_id, option_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT DISTINCT
    ao.option_id,
    ao.option_text
FROM all_options ao
ORDER BY ao.option_id
$$;

