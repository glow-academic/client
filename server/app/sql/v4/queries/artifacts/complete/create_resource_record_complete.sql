-- Create resource record dynamically
-- Uses EXECUTE to handle dynamic TABLE names_resource based on resource_type
-- Returns the created resource id
-- Handles duplicate key violations by returning the existing record's id

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
    id uuid,
    already_exists boolean
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
    v_unique_col text;
    v_unique_val text;
    v_constraint_name text;
BEGIN
    -- Validate resource_type exists in tool_domains_junction + domains_resource
    IF NOT EXISTS (
        SELECT 1 FROM tool_domains_junction tdj
        JOIN domains_resource dr ON dr.id = tdj.domain_id AND dr.active = true
        WHERE dr.resource = resource_type::resource_type
    ) THEN
        RAISE EXCEPTION 'Invalid resource type: %', resource_type;
    END IF;
    
    v_table_name := resource_type || '_resource';
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
          AND column_name NOT IN ('id', 'created_at')
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

    BEGIN
        EXECUTE v_query INTO v_resource_id;
        RETURN QUERY SELECT v_resource_id, false;
    EXCEPTION
        WHEN unique_violation THEN
            -- Get constraint name from the error
            GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;

            -- Find the unique column from the constraint
            -- Look up which column(s) this constraint covers
            SELECT a.attname INTO v_unique_col
            FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            WHERE c.conname = v_constraint_name
            LIMIT 1;

            -- If no constraint found, try index lookup (for unique indexes)
            IF v_unique_col IS NULL THEN
                SELECT a.attname INTO v_unique_col
                FROM pg_index i
                JOIN pg_class c ON c.oid = i.indexrelid
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE c.relname = v_constraint_name
                  AND i.indisunique
                LIMIT 1;
            END IF;

            -- Get the value that caused the conflict from resource_data
            IF v_unique_col IS NOT NULL AND resource_data ? v_unique_col THEN
                v_unique_val := resource_data->>v_unique_col;

                -- Query for the existing record
                v_query := format(
                    'SELECT id FROM %I WHERE %I = %L LIMIT 1',
                    v_table_name,
                    v_unique_col,
                    v_unique_val
                );
                EXECUTE v_query INTO v_resource_id;

                IF v_resource_id IS NOT NULL THEN
                    RETURN QUERY SELECT v_resource_id, true;
                    RETURN;
                END IF;
            END IF;

            -- Fallback: re-raise if we couldn't find the existing record
            RAISE;
    END;
END;
$$;
