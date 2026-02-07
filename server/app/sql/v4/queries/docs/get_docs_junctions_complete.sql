-- Documentation: Junction Tables
-- Returns junction tables and their columns for a given prefix as an array

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_docs_junctions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_docs_junctions_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_docs_junctions_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Create composite type for junction table info
CREATE TYPE types.q_docs_junctions_v4_junction AS (
    name text,
    columns text[]
);

-- 4) Create function
CREATE OR REPLACE FUNCTION api_get_docs_junctions_v4(
    prefix_param text
)
RETURNS TABLE (
    junction_tables types.q_docs_junctions_v4_junction[]
)
LANGUAGE sql
STABLE
AS $$
    WITH junction_data AS (
        SELECT
            t.table_name::text as name,
            array_agg(c.column_name::text ORDER BY c.ordinal_position) as columns
        FROM information_schema.tables t
        JOIN information_schema.columns c
            ON t.table_name = c.table_name
            AND t.table_schema = c.table_schema
        WHERE t.table_schema = 'public'
          AND (t.table_name LIKE prefix_param || '_%_junction'
               OR t.table_name LIKE '%_' || prefix_param || 's_%')
        GROUP BY t.table_name
        ORDER BY t.table_name
    )
    SELECT COALESCE(
        array_agg(
            ROW(jd.name, jd.columns)::types.q_docs_junctions_v4_junction
        ),
        ARRAY[]::types.q_docs_junctions_v4_junction[]
    ) as junction_tables
    FROM junction_data jd;
$$;
