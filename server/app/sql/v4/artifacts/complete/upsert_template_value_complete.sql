-- Upsert template value
-- Inserts or updates template_values record based on template_id and schema_field_id

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_upsert_template_value_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_upsert_template_value_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_upsert_template_value_v4(
    template_id uuid,
    schema_field_id uuid,
    call_id uuid,
    field_type text,
    string_value text,
    number_value numeric,
    boolean_value boolean
)
RETURNS TABLE (
    id uuid,
    updated boolean
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_id uuid;
    v_updated boolean;
BEGIN
    INSERT INTO template_values_resource (
        template_id,
        schema_field_id,
        call_id,
        string_value,
        number_value,
        boolean_value,
        active,
        created_at,
        updated_at
    )
    VALUES (
        template_id,
        schema_field_id,
        call_id,
        CASE WHEN field_type = 'string' THEN string_value ELSE NULL END,
        CASE WHEN field_type = 'number' THEN number_value ELSE NULL END,
        CASE WHEN field_type = 'boolean' THEN boolean_value ELSE NULL END,
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (template_id, schema_field_id)
    DO UPDATE SET
        string_value = CASE WHEN field_type = 'string' THEN string_value ELSE template_values.string_value END,
        number_value = CASE WHEN field_type = 'number' THEN number_value ELSE template_values.number_value END,
        boolean_value = CASE WHEN field_type = 'boolean' THEN boolean_value ELSE template_values.boolean_value END,
        updated_at = NOW()
    RETURNING template_values.id, (xmax = 0) as updated INTO v_id, v_updated;
    
    RETURN QUERY SELECT v_id, v_updated;
END;
$$;
