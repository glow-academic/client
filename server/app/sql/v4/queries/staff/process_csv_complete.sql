-- Process CSV file and map columns to target fields
-- Converted to function with composite types (ZERO tolerance for JSONB)
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- Note: CSV parsing logic happens in Python, but SQL function defines types for consistency
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_process_csv_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_process_csv_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop types in correct order (parent types first, then child types)
-- Drop processed_row first (depends on csv_row_error), then csv_row_error, then column_mapping
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop processed_row first (depends on csv_row_error)
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname = 'q_process_csv_v4_processed_row'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
    -- Drop csv_row_error (no longer has dependencies)
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname = 'q_process_csv_v4_csv_row_error'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
    -- Drop column_mapping types
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE (typname LIKE 'q_process_csv_v4_column_mapping' OR typname LIKE 'i_process_csv_v4_column_mapping')
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
-- Input type for column mapping (from frontend)
CREATE TYPE types.i_process_csv_v4_column_mapping AS (
    csv_column text,
    target_field text  -- NULL if not mapped
);

-- Output type for column mapping (for consistency)
CREATE TYPE types.q_process_csv_v4_column_mapping AS (
    csv_column text,
    target_field text  -- NULL if not mapped
);

CREATE TYPE types.q_process_csv_v4_csv_row_error AS (
    row_index integer,
    field text,
    message text
);

CREATE TYPE types.q_process_csv_v4_processed_row AS (
    row_index integer,
    name text,  -- snake_case, not camelCase
    emails text[],
    primary_email_index integer,
    role text,
    department_ids text[],
    cohort_ids text[],
    errors types.q_process_csv_v4_csv_row_error[]
);

-- 4) Recreate function
-- Function accepts csv_content and column_mappings from frontend (matches frontend request format)
-- CSV parsing happens in Python, SQL function provides actor_name for response
CREATE OR REPLACE FUNCTION api_process_csv_v4(
    csv_content text,  -- Raw CSV content from frontend
    column_mappings types.i_process_csv_v4_column_mapping[],  -- Column mappings from frontend
    profile_id uuid
)
RETURNS TABLE (
    success boolean,
    headers text[],
    rows types.q_process_csv_v4_processed_row[],
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
-- Function accepts csv_content and column_mappings from frontend
-- CSV parsing happens in Python, then Python constructs full response
-- This function provides actor_name - Python will merge parsed data with actor_name
WITH params AS (
    SELECT 
        csv_content AS csv_content,
        COALESCE(column_mappings, ARRAY[]::types.i_process_csv_v4_column_mapping[]) AS column_mappings,
        profile_id AS profile_id
),
user_profile AS (
    SELECT COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
)
SELECT 
    true::boolean as success,
    ARRAY[]::text[] as headers,  -- Populated by Python after parsing
    ARRAY[]::types.q_process_csv_v4_processed_row[] as rows,  -- Populated by Python after parsing
    up.actor_name::text as actor_name
FROM params p
CROSS JOIN user_profile up
$$;
