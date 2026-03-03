-- Get template values (deprecated - returns empty)
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'utils_get_template_values_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS utils_get_template_values_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create function (deprecated - returns empty result)
CREATE OR REPLACE FUNCTION utils_get_template_values_v4(
    template_id uuid
)
RETURNS TABLE (
    name text,
    string_value text,
    number_value numeric,
    boolean_value boolean,
    field_type text
)
LANGUAGE sql
STABLE
AS $$
    SELECT NULL::text, NULL::text, NULL::numeric, NULL::boolean, NULL::text
    WHERE false;
$$;
