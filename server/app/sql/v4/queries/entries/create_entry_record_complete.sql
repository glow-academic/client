-- Create entry record via api_create_entry_record_v4

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_entry_record_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_entry_record_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_entry_record_v4(
    entry_type text,
    call_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false,
    entry_data jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(id uuid, already_exists boolean)
LANGUAGE plpgsql
AS $$
DECLARE
    v_entry_id uuid;
    v_call_id uuid;
    v_entry_data jsonb;
    v_table_name text;
    v_columns text[];
    v_values text[];
    v_query text;
    v_col_name text;
    v_col_data_type text;
    v_col_is_nullable boolean;
    v_col_default text;
    v_value text;
    v_is_view boolean := false;
    v_message_id uuid;
    v_persona_id uuid;
BEGIN
    -- Normalize entry_data
    v_entry_data := COALESCE(entry_data, '{}'::jsonb);

    -- Validate entry_type exists in enum
    PERFORM entry_type::entry_type;

    -- Resolve default call_id when not provided
    v_call_id := call_id;
    IF v_call_id IS NULL THEN
        SELECT vc.id INTO v_call_id FROM view_calls_entry vc LIMIT 1;
        IF v_call_id IS NULL THEN
            RAISE EXCEPTION 'No call_id found for entry inserts';
        END IF;
    END IF;

    -- Determine target table
    SELECT c.relkind = 'v'
    INTO v_is_view
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = entry_type || '_entry'
    LIMIT 1;

    IF v_is_view THEN
        -- Prefer simulation_* backing table when entry is a view
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'simulation_' || entry_type || '_entry'
              AND table_type = 'BASE TABLE'
        ) THEN
            v_table_name := 'simulation_' || entry_type || '_entry';
        ELSE
            RAISE EXCEPTION 'Entry view % has no writable base table', entry_type || '_entry';
        END IF;
    ELSE
        v_table_name := entry_type || '_entry';
    END IF;

    -- Special handling for contents: insert into attempt_content_entry
    IF entry_type = 'contents' THEN
        v_table_name := 'attempt_content_entry';

        v_columns := ARRAY[]::text[];
        v_values := ARRAY[]::text[];

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
            IF v_col_name = 'call_id' THEN
                v_columns := array_append(v_columns, v_col_name);
                v_values := array_append(v_values, quote_literal(v_call_id::text) || '::uuid');
            ELSIF v_col_name = 'active' THEN
                v_columns := array_append(v_columns, v_col_name);
                v_values := array_append(v_values, 'true');
            ELSIF v_col_name = 'generated' THEN
                v_columns := array_append(v_columns, v_col_name);
                v_values := array_append(v_values, 'true');
            ELSIF v_col_name = 'mcp' THEN
                v_columns := array_append(v_columns, v_col_name);
                v_values := array_append(v_values, mcp::text);
            ELSIF v_col_name = 'message_id' THEN
                v_columns := array_append(v_columns, v_col_name);
                v_value := COALESCE(v_entry_data->>'message_id', v_entry_data->>'simulation_message_id');
                v_values := array_append(v_values, quote_literal(v_value) || '::uuid');
            ELSIF v_col_name = 'persona_id' THEN
                v_columns := array_append(v_columns, v_col_name);
                v_value := COALESCE(v_entry_data->>'persona_id', v_entry_data->>'personas_id');
                IF v_value IS NULL OR v_value = '' THEN
                    v_values := array_append(v_values, 'NULL');
                ELSE
                    v_values := array_append(v_values, quote_literal(v_value) || '::uuid');
                END IF;
            ELSIF v_entry_data ? v_col_name AND v_entry_data->>v_col_name IS NOT NULL THEN
                v_columns := array_append(v_columns, v_col_name);
                v_value := v_entry_data->>v_col_name;
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
            ELSIF NOT v_col_is_nullable AND v_col_default IS NULL THEN
                IF v_col_data_type IN ('text', 'character varying', 'character') THEN
                    v_columns := array_append(v_columns, v_col_name);
                    v_values := array_append(v_values, quote_literal(''));
                ELSIF v_col_data_type IN ('integer', 'bigint', 'numeric', 'real', 'double precision') THEN
                    v_columns := array_append(v_columns, v_col_name);
                    v_values := array_append(v_values, '0');
                ELSIF v_col_data_type = 'boolean' THEN
                    v_columns := array_append(v_columns, v_col_name);
                    v_values := array_append(v_values, 'false');
                END IF;
            END IF;
        END LOOP;

        IF array_length(v_columns, 1) IS NULL THEN
            RAISE EXCEPTION 'No columns to insert for entry type: %', entry_type;
        END IF;

        v_query := format(
            'INSERT INTO %I (%s) VALUES (%s) RETURNING id',
            v_table_name,
            array_to_string(v_columns, ', '),
            array_to_string(v_values, ', ')
        );

        EXECUTE v_query INTO v_entry_id;
        RETURN QUERY SELECT v_entry_id, false;
        RETURN;
    END IF;

    -- Generic insert for other entry types
    v_columns := ARRAY[]::text[];
    v_values := ARRAY[]::text[];

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
        IF v_col_name = 'call_id' THEN
            v_columns := array_append(v_columns, v_col_name);
            v_values := array_append(v_values, quote_literal(v_call_id::text) || '::uuid');
        ELSIF v_col_name = 'active' THEN
            v_columns := array_append(v_columns, v_col_name);
            v_values := array_append(v_values, 'true');
        ELSIF v_col_name = 'generated' THEN
            v_columns := array_append(v_columns, v_col_name);
            v_values := array_append(v_values, 'true');
        ELSIF v_col_name = 'mcp' THEN
            v_columns := array_append(v_columns, v_col_name);
            v_values := array_append(v_values, mcp::text);
        ELSIF v_entry_data ? v_col_name AND v_entry_data->>v_col_name IS NOT NULL THEN
            v_columns := array_append(v_columns, v_col_name);
            v_value := v_entry_data->>v_col_name;
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
        ELSIF NOT v_col_is_nullable AND v_col_default IS NULL THEN
            IF v_col_data_type IN ('text', 'character varying', 'character') THEN
                v_columns := array_append(v_columns, v_col_name);
                v_values := array_append(v_values, quote_literal(''));
            ELSIF v_col_data_type IN ('integer', 'bigint', 'numeric', 'real', 'double precision') THEN
                v_columns := array_append(v_columns, v_col_name);
                v_values := array_append(v_values, '0');
            ELSIF v_col_data_type = 'boolean' THEN
                v_columns := array_append(v_columns, v_col_name);
                v_values := array_append(v_values, 'false');
            END IF;
        END IF;
    END LOOP;

    IF array_length(v_columns, 1) IS NULL THEN
        RAISE EXCEPTION 'No columns to insert for entry type: %', entry_type;
    END IF;

    v_query := format(
        'INSERT INTO %I (%s) VALUES (%s) RETURNING id',
        v_table_name,
        array_to_string(v_columns, ', '),
        array_to_string(v_values, ', ')
    );

    EXECUTE v_query INTO v_entry_id;

    RETURN QUERY SELECT v_entry_id, false;
END;
$$;
