-- Create resource record dynamically
-- Uses EXECUTE to handle dynamic TABLE names_resource based on resource_type
-- Returns the created resource id

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_resource_record_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_resource_record_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_resource_record_v4(
    resource_type text,
    call_id uuid,
    mcp boolean,
    resource_data jsonb
)
RETURNS TABLE (
    id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_resource_id uuid;
    v_table_name text;
    v_columns text[];
    v_values text[];
    v_query text;
    v_col_name text;
    v_col_data_type text;
    v_col_is_nullable boolean;
    v_col_default text;
    v_value text;
    v_system_columns jsonb;
BEGIN
    -- Validate resource_type exists in resources enum
    IF NOT EXISTS (
        SELECT 1 FROM resource_tools
        WHERE resource = resource_type::resources
    ) THEN
        RAISE EXCEPTION 'Invalid resource type: %', resource_type;
    END IF;
    
    v_table_name := resource_type;
    v_system_columns := jsonb_build_object(
        'call_id', call_id::text,
        'active', 'true',
        'generated', 'true',
        'mcp', mcp::text
    );
    
    -- Build column and value lists dynamically
    v_columns := ARRAY[]::text[];
    v_values := ARRAY[]::text[];
    
    -- Get columns from information_schema
    FOR v_col_name, v_col_data_type, v_col_is_nullable, v_col_default IN
        SELECT 
            column_name::text,
            data_type::text,
            (is_nullable = 'YES')::boolean,
            column_default::text
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = v_table_name
          AND column_name NOT IN ('id', 'created_at', 'updated_at')
        ORDER BY ordinal_position
    LOOP
        -- Handle system columns
        IF v_col_name = 'call_id' THEN
            v_columns := array_append(v_columns, v_col_name);
            v_values := array_append(v_values, quote_literal(call_id::text) || '::uuid');
        ELSIF v_col_name = 'active' THEN
            v_columns := array_append(v_columns, v_col_name);
            v_values := array_append(v_values, 'true');
        ELSIF v_col_name = 'generated' THEN
            v_columns := array_append(v_columns, v_col_name);
            v_values := array_append(v_values, 'true');
        ELSIF v_col_name = 'mcp' THEN
            v_columns := array_append(v_columns, v_col_name);
            v_values := array_append(v_values, mcp::text);
        -- Handle resource_data columns
        ELSIF resource_data ? v_col_name AND resource_data->>v_col_name IS NOT NULL THEN
            v_columns := array_append(v_columns, v_col_name);
            v_value := resource_data->>v_col_name;
            -- Type-specific quoting
            IF v_col_data_type IN ('text', 'character varying', 'character') THEN
                v_values := array_append(v_values, quote_literal(v_value));
            ELSIF v_col_data_type IN ('integer', 'bigint', 'numeric', 'real', 'double precision') THEN
                v_values := array_append(v_values, v_value);
            ELSIF v_col_data_type = 'boolean' THEN
                v_values := array_append(v_values, v_value);
            ELSIF v_col_data_type = 'uuid' THEN
                v_values := array_append(v_values, quote_literal(v_value) || '::uuid');
            ELSE
                v_values := array_append(v_values, quote_literal(v_value));
            END IF;
        -- Handle required columns without defaults
        ELSIF NOT v_col_is_nullable AND v_col_default IS NULL THEN
            v_columns := array_append(v_columns, v_col_name);
            -- Use type-appropriate defaults
            IF v_col_data_type IN ('text', 'character varying', 'character') THEN
                v_values := array_append(v_values, quote_literal(''));
            ELSIF v_col_data_type IN ('integer', 'bigint', 'numeric', 'real', 'double precision') THEN
                v_values := array_append(v_values, '0');
            ELSIF v_col_data_type = 'boolean' THEN
                v_values := array_append(v_values, 'false');
            END IF;
        END IF;
    END LOOP;
    
    -- Build and execute INSERT query
    IF array_length(v_columns, 1) IS NULL THEN
        RAISE EXCEPTION 'No columns to insert for resource type: %', resource_type;
    END IF;
    
    v_query := format(
        'INSERT INTO %I (%s) VALUES (%s) RETURNING id',
        v_table_name,
        array_to_string(v_columns, ', '),
        array_to_string(v_values, ', ')
    );
    
    EXECUTE v_query INTO v_resource_id;
    
    RETURN QUERY SELECT v_resource_id;
END;
$$;
