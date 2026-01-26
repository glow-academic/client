-- Persona Documentation: Table Columns
-- Returns columns from information_schema for a given table as an array

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_persona_docs_columns_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_docs_columns_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_persona_docs_columns_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Create composite type for column info
CREATE TYPE types.q_persona_docs_columns_v4_column AS (
    name text,
    type text,
    nullable boolean,
    default_value text
);

-- 4) Create function
CREATE OR REPLACE FUNCTION api_get_persona_docs_columns_v4(
    table_name_param text
)
RETURNS TABLE (
    columns types.q_persona_docs_columns_v4_column[]
)
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        array_agg(
            ROW(
                c.column_name::text,
                c.data_type::text,
                (c.is_nullable = 'YES')::boolean,
                c.column_default::text
            )::types.q_persona_docs_columns_v4_column
            ORDER BY c.ordinal_position
        ),
        ARRAY[]::types.q_persona_docs_columns_v4_column[]
    ) as columns
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = table_name_param;
$$;
