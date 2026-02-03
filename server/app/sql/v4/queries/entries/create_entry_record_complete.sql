-- Create entry record via api_create_entry_record_v4
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_entry_record_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_entry_record_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create function
CREATE OR REPLACE FUNCTION api_create_entry_record_v4(
    entry_type text,
    call_id uuid,
    mcp boolean,
    entry_data jsonb
)
RETURNS TABLE(id uuid, already_exists boolean)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_entry_id uuid;
    v_table_name text;
    v_columns text[];
    v_values text[];
    v_query text;
    v_col_name text;
    v_col_data_type text;
    v_col_is_nullable boolean;
    v_col_default text;
    v_value text;
BEGIN
    -- Validate entry_type exists in entry_type enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'entry_type')
          AND enumlabel = entry_type
    ) THEN
        RAISE EXCEPTION 'Invalid entry type: %', entry_type;
    END IF;

    v_table_name := entry_type || '_entry';

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
            IF call_id IS NOT NULL THEN
                v_columns := array_append(v_columns, v_col_name);
                v_values := array_append(v_values, quote_literal(call_id::text) || '::uuid');
            END IF;
        ELSIF v_col_name = 'active' THEN
            v_columns := array_append(v_columns, v_col_name);
            v_values := array_append(v_values, 'true');
        ELSIF v_col_name = 'generated' THEN
            v_columns := array_append(v_columns, v_col_name);
            v_values := array_append(v_values, 'true');
        ELSIF v_col_name = 'mcp' THEN
            v_columns := array_append(v_columns, v_col_name);
            v_values := array_append(v_values, mcp::text);
        -- Handle entry_data columns
        ELSIF entry_data ? v_col_name AND entry_data->>v_col_name IS NOT NULL THEN
            v_columns := array_append(v_columns, v_col_name);
            v_value := entry_data->>v_col_name;
            -- Type-specific quoting
            IF v_col_data_type IN ('text', 'character varying', 'character') THEN
                v_values := array_append(v_values, quote_literal(v_value));
            ELSIF v_col_data_type IN ('integer', 'bigint', 'numeric', 'real', 'double precision') THEN
                v_values := array_append(v_values, v_value);
            ELSIF v_col_data_type = 'boolean' THEN
                v_values := array_append(v_values, v_value);
            ELSIF v_col_data_type = 'uuid' THEN
                v_values := array_append(v_values, quote_literal(v_value) || '::uuid');
            ELSIF v_col_data_type = 'jsonb' THEN
                v_values := array_append(v_values, quote_literal(v_value) || '::jsonb');
            ELSIF v_col_data_type = 'ARRAY' THEN
                v_values := array_append(v_values, quote_literal(v_value) || '::text[]');
            ELSIF v_col_data_type = 'timestamp with time zone' THEN
                v_values := array_append(v_values, quote_literal(v_value) || '::timestamptz');
            ELSE
                v_values := array_append(v_values, quote_literal(v_value));
            END IF;
        END IF;
    END LOOP;

    -- Build and execute INSERT query
    IF array_length(v_columns, 1) > 0 THEN
        v_query := format(
            'INSERT INTO %I (%s) VALUES (%s) RETURNING id',
            v_table_name,
            array_to_string(v_columns, ', '),
            array_to_string(v_values, ', ')
        );

        EXECUTE v_query INTO v_entry_id;
    ELSE
        -- No columns to insert, just create with defaults
        v_query := format('INSERT INTO %I DEFAULT VALUES RETURNING id', v_table_name);
        EXECUTE v_query INTO v_entry_id;
    END IF;

    RETURN QUERY SELECT v_entry_id, false;

EXCEPTION
    WHEN unique_violation THEN
        -- Entry already exists, return existing id
        RETURN QUERY SELECT NULL::uuid, true;
END;
$function$;
