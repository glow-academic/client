-- Persona Documentation: Foreign Key Relationships
-- Returns foreign key relationships for tables matching a pattern as an array

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_persona_docs_foreign_keys_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_docs_foreign_keys_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_persona_docs_fk_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Create composite type for foreign key info
CREATE TYPE types.q_persona_docs_fk_v4_foreign_key AS (
    table_name text,
    column_name text,
    references_table text
);

-- 4) Create function
CREATE OR REPLACE FUNCTION api_get_persona_docs_foreign_keys_v4(
    table_pattern_param text
)
RETURNS TABLE (
    foreign_keys types.q_persona_docs_fk_v4_foreign_key[]
)
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        array_agg(
            ROW(
                tc.table_name::text,
                kcu.column_name::text,
                ccu.table_name::text
            )::types.q_persona_docs_fk_v4_foreign_key
            ORDER BY tc.table_name, kcu.column_name
        ),
        ARRAY[]::types.q_persona_docs_fk_v4_foreign_key[]
    ) as foreign_keys
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name LIKE table_pattern_param;
$$;
