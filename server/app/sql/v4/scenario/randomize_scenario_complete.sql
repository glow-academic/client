-- Randomize scenario selections with validation and integrity checks
-- Converted to function following DHH principles
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_randomize_scenario_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_randomize_scenario_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- No composite types needed for this function

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_randomize_scenario_v4(
    scenario_id uuid,
    profile_id uuid,
    randomize_type text,
    department_ids uuid[],
    persona_ids uuid[],
    document_ids uuid[],
    parameter_ids uuid[],
    field_ids uuid[],
    persona_min integer,
    persona_max integer,
    document_min integer,
    document_max integer,
    parameter_selection_min integer,
    parameter_selection_max integer,
    field_ranges_json jsonb
)
RETURNS TABLE (
    randomized_persona_ids uuid[],
    randomized_document_ids uuid[],
    randomized_parameter_ids uuid[],
    randomized_field_ids uuid[]
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    -- Valid IDs (will be populated from filtering)
    valid_persona_ids uuid[];
    valid_document_ids uuid[];
    valid_parameter_ids uuid[];
    valid_field_ids uuid[];
    
    -- Ranges from database or defaults
    allowed_persona_min integer;
    allowed_persona_max integer;
    allowed_document_min integer;
    allowed_document_max integer;
    allowed_parameter_min integer;
    allowed_parameter_max integer;
    
    -- Validated and capped ranges
    final_persona_min integer;
    final_persona_max integer;
    final_document_min integer;
    final_document_max integer;
    final_parameter_min integer;
    final_parameter_max integer;
    
    -- Counts for capping
    max_valid_personas integer;
    max_valid_documents integer;
    max_valid_parameters integer;
    
    -- Randomization results
    randomized_persona_ids uuid[];
    randomized_document_ids uuid[];
    randomized_parameter_ids uuid[];
    randomized_field_ids uuid[];
    
    -- Random count
    random_count integer;
    capped_max integer;
    
    -- Field randomization variables
    param_id uuid;
    param_range jsonb;
    param_min_val integer;
    param_max_val integer;
    valid_items_for_param uuid[];
    max_valid_items integer;
    randomized_items uuid[];
BEGIN
    -- Initialize result arrays as NULL
    randomized_persona_ids := NULL;
    randomized_document_ids := NULL;
    randomized_parameter_ids := NULL;
    randomized_field_ids := NULL;
    
    -- Get user's accessible departments
    WITH user_departments AS (
        SELECT DISTINCT d.id
        FROM department_artifact d
        JOIN profile_departments pd ON pd.department_id = d.id
        WHERE pd.profile_id = api_randomize_scenario_v4.profile_id 
          AND pd.active = true 
          AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
    ),
    -- Get valid persona IDs (filtered by departments if provided)
    filtered_personas AS (
        SELECT DISTINCT p.id
        FROM persona_artifact p
        LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
        WHERE EXISTS (SELECT 1 FROM persona_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.name = 'active' AND pf.value = true)
        AND (
            -- If department_ids provided, filter by them
            (COALESCE(array_length(api_randomize_scenario_v4.department_ids, 1), 0) = 0 
             OR EXISTS (
                 SELECT 1 FROM user_departments ud 
                 WHERE ud.id = ANY(api_randomize_scenario_v4.department_ids)
                 AND (pd.department_id = ud.id OR NOT EXISTS (
                     SELECT 1 FROM persona_departments pd2 
                     WHERE pd2.persona_id = p.id AND pd2.active = true
                 ))
             ))
            -- Or if no department filter, include all accessible
            OR (COALESCE(array_length(api_randomize_scenario_v4.department_ids, 1), 0) = 0
                AND (pd.department_id IN (SELECT id FROM user_departments)
                     OR NOT EXISTS (
                         SELECT 1 FROM persona_departments pd2 
                         WHERE pd2.persona_id = p.id AND pd2.active = true
                     )))
        )
        -- Filter by provided persona_ids if any
        AND (COALESCE(array_length(api_randomize_scenario_v4.persona_ids, 1), 0) = 0
             OR p.id = ANY(api_randomize_scenario_v4.persona_ids))
    ),
    -- Get valid document IDs
    filtered_documents AS (
        SELECT DISTINCT d.id
        FROM document_artifact d
        INNER JOIN document_uploads du ON du.document_id = d.id AND du.active = true
        LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
        WHERE EXISTS (SELECT 1 FROM document_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.document_id = d.id AND f.name = 'active' AND df.value = true)
        AND (
            COALESCE(array_length(api_randomize_scenario_v4.department_ids, 1), 0) = 0
            OR EXISTS (
                SELECT 1 FROM user_departments ud 
                WHERE ud.id = ANY(api_randomize_scenario_v4.department_ids)
                AND (dd.department_id = ud.id OR NOT EXISTS (
                    SELECT 1 FROM document_departments dd2 
                    WHERE dd2.document_id = d.id AND dd2.active = true
                ))
            )
            OR (COALESCE(array_length(api_randomize_scenario_v4.department_ids, 1), 0) = 0
                AND (dd.department_id IN (SELECT id FROM user_departments)
                     OR NOT EXISTS (
                         SELECT 1 FROM document_departments dd2 
                         WHERE dd2.document_id = d.id AND dd2.active = true
                     )))
        )
        AND (COALESCE(array_length(api_randomize_scenario_v4.document_ids, 1), 0) = 0
             OR d.id = ANY(api_randomize_scenario_v4.document_ids))
    ),
    -- Get valid parameter IDs
    filtered_parameters AS (
        SELECT DISTINCT p.id
        FROM parameter_artifact p
        JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = p.id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
        LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
        WHERE EXISTS (SELECT 1 FROM persona_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = p.id AND f.name = 'active' AND pf.value = true)
        AND (
            COALESCE(array_length(api_randomize_scenario_v4.department_ids, 1), 0) = 0
            OR EXISTS (
                SELECT 1 FROM user_departments ud 
                WHERE ud.id = ANY(api_randomize_scenario_v4.department_ids)
                AND (fd.department_id = ud.id OR NOT EXISTS (
                    SELECT 1 FROM field_departments fd2 
                    JOIN fields_resource f2 ON f2.id = fd2.field_id 
                    WHERE f2.parameter_id = p.id AND f2.active = true AND fd2.active = true
                ))
            )
            OR (COALESCE(array_length(api_randomize_scenario_v4.department_ids, 1), 0) = 0
                AND (fd.department_id IN (SELECT id FROM user_departments)
                     OR NOT EXISTS (
                         SELECT 1 FROM field_departments fd2 
                         JOIN fields_resource f2 ON f2.id = fd2.field_id 
                         WHERE f2.parameter_id = p.id AND f2.active = true AND fd2.active = true
                     )))
        )
        AND (COALESCE(array_length(api_randomize_scenario_v4.parameter_ids, 1), 0) = 0
             OR p.id = ANY(api_randomize_scenario_v4.parameter_ids))
    ),
    -- Get valid field IDs (filtered by departments and parameters)
    filtered_fields AS (
        SELECT DISTINCT f.id
        FROM field_artifact f
        LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
        WHERE EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true) AND (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
        AND (
            COALESCE(array_length(api_randomize_scenario_v4.department_ids, 1), 0) = 0
            OR EXISTS (
                SELECT 1 FROM user_departments ud 
                WHERE ud.id = ANY(api_randomize_scenario_v4.department_ids)
                AND (fd.department_id = ud.id OR NOT EXISTS (
                    SELECT 1 FROM field_departments fd2 
                    WHERE fd2.field_id = f.id AND fd2.active = true
                ))
            )
            OR (COALESCE(array_length(api_randomize_scenario_v4.department_ids, 1), 0) = 0
                AND (fd.department_id IN (SELECT id FROM user_departments)
                     OR NOT EXISTS (
                         SELECT 1 FROM field_departments fd2 
                         WHERE fd2.field_id = f.id AND fd2.active = true
                     )))
        )
        AND (COALESCE(array_length(api_randomize_scenario_v4.field_ids, 1), 0) = 0
             OR f.id = ANY(api_randomize_scenario_v4.field_ids))
        AND (COALESCE(array_length(api_randomize_scenario_v4.parameter_ids, 1), 0) = 0
             OR pf.parameter_id = ANY(api_randomize_scenario_v4.parameter_ids))
    )
    SELECT 
        (SELECT ARRAY_AGG(id ORDER BY id) FROM filtered_personas),
        (SELECT ARRAY_AGG(id ORDER BY id) FROM filtered_documents),
        (SELECT ARRAY_AGG(id ORDER BY id) FROM filtered_parameters),
        (SELECT ARRAY_AGG(id ORDER BY id) FROM filtered_fields)
    INTO 
        valid_persona_ids,
        valid_document_ids,
        valid_parameter_ids,
        valid_field_ids;
    
    -- Handle NULL arrays (no results)
    valid_persona_ids := COALESCE(valid_persona_ids, ARRAY[]::uuid[]);
    valid_document_ids := COALESCE(valid_document_ids, ARRAY[]::uuid[]);
    valid_parameter_ids := COALESCE(valid_parameter_ids, ARRAY[]::uuid[]);
    valid_field_ids := COALESCE(valid_field_ids, ARRAY[]::uuid[]);
    
    -- Use hardcoded defaults (ranges logic removed)
    allowed_persona_min := 1;
    allowed_persona_max := 3;
    allowed_document_min := 0;
    allowed_document_max := 3;
    allowed_parameter_min := 0;
    allowed_parameter_max := 3;
    
    -- Validate and cap persona ranges
    final_persona_min := COALESCE(api_randomize_scenario_v4.persona_min, allowed_persona_min);
    final_persona_max := COALESCE(api_randomize_scenario_v4.persona_max, allowed_persona_min);
    final_persona_min := GREATEST(allowed_persona_min, LEAST(final_persona_min, allowed_persona_max));
    final_persona_max := GREATEST(allowed_persona_min, LEAST(final_persona_max, allowed_persona_max));
    final_persona_min := LEAST(final_persona_min, final_persona_max);
    
    -- Validate and cap document ranges
    final_document_min := COALESCE(api_randomize_scenario_v4.document_min, allowed_document_min);
    final_document_max := COALESCE(api_randomize_scenario_v4.document_max, allowed_document_min);
    final_document_min := GREATEST(allowed_document_min, LEAST(final_document_min, allowed_document_max));
    final_document_max := GREATEST(allowed_document_min, LEAST(final_document_max, allowed_document_max));
    final_document_min := LEAST(final_document_min, final_document_max);
    
    -- Validate and cap parameter ranges
    final_parameter_min := COALESCE(api_randomize_scenario_v4.parameter_selection_min, allowed_parameter_min);
    final_parameter_max := COALESCE(api_randomize_scenario_v4.parameter_selection_max, allowed_parameter_max);
    final_parameter_min := GREATEST(allowed_parameter_min, LEAST(final_parameter_min, allowed_parameter_max));
    final_parameter_max := GREATEST(allowed_parameter_min, LEAST(final_parameter_max, allowed_parameter_max));
    final_parameter_min := LEAST(final_parameter_min, final_parameter_max);
    
    -- Get counts for capping
    max_valid_personas := array_length(valid_persona_ids, 1);
    max_valid_documents := array_length(valid_document_ids, 1);
    max_valid_parameters := array_length(valid_parameter_ids, 1);
    
    -- Handle NULL counts
    max_valid_personas := COALESCE(max_valid_personas, 0);
    max_valid_documents := COALESCE(max_valid_documents, 0);
    max_valid_parameters := COALESCE(max_valid_parameters, 0);
    
    -- Perform randomization based on randomize_type
    IF randomize_type = 'all' THEN
        -- Randomize personas
        IF max_valid_personas > 0 THEN
            capped_max := LEAST(final_persona_max, max_valid_personas);
            random_count := LEAST(capped_max, GREATEST(final_persona_min, 
                final_persona_min + FLOOR(RANDOM() * (capped_max - final_persona_min + 1))::integer));
            SELECT ARRAY_AGG(id ORDER BY random())
            INTO randomized_persona_ids
            FROM unnest(valid_persona_ids) AS id
            LIMIT random_count;
        END IF;
        
        -- Randomize documents
        IF max_valid_documents > 0 THEN
            capped_max := LEAST(final_document_max, max_valid_documents);
            random_count := LEAST(capped_max, GREATEST(final_document_min,
                final_document_min + FLOOR(RANDOM() * (capped_max - final_document_min + 1))::integer));
            SELECT ARRAY_AGG(id ORDER BY random())
            INTO randomized_document_ids
            FROM unnest(valid_document_ids) AS id
            LIMIT random_count;
        END IF;
        
        -- Randomize parameters
        IF max_valid_parameters > 0 THEN
            capped_max := LEAST(final_parameter_max, max_valid_parameters);
            random_count := LEAST(capped_max, GREATEST(final_parameter_min,
                final_parameter_min + FLOOR(RANDOM() * (capped_max - final_parameter_min + 1))::integer));
            SELECT ARRAY_AGG(id ORDER BY random())
            INTO randomized_parameter_ids
            FROM unnest(valid_parameter_ids) AS id
            LIMIT random_count;
        END IF;
        
        -- Randomize all fields (for all valid parameters)
        randomized_items := ARRAY[]::uuid[];
        FOR param_id IN SELECT unnest(valid_parameter_ids)
        LOOP
            -- Use hardcoded defaults (ranges logic removed)
            param_min_val := 1;
            param_max_val := 1;
            param_max_val := LEAST(param_max_val, 3);
            param_min_val := LEAST(param_min_val, param_max_val);
            
            -- Get valid fields for this parameter
            SELECT ARRAY_AGG(f.id)
            INTO valid_items_for_param
            FROM field_artifact f
            WHERE EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
              AND (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
              AND (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = param_id
              AND f.id = ANY(valid_field_ids);
            
            IF valid_items_for_param IS NOT NULL AND array_length(valid_items_for_param, 1) > 0 THEN
                max_valid_items := array_length(valid_items_for_param, 1);
                capped_max := LEAST(param_max_val, max_valid_items);
                random_count := LEAST(capped_max, GREATEST(param_min_val,
                    param_min_val + FLOOR(RANDOM() * (capped_max - param_min_val + 1))::integer));
                
                -- Get randomized fields for this parameter
                SELECT ARRAY_AGG(id ORDER BY random())
                INTO valid_items_for_param
                FROM unnest(valid_items_for_param) AS id
                LIMIT random_count;
                
                -- Accumulate into randomized_items
                randomized_items := randomized_items || valid_items_for_param;
            END IF;
        END LOOP;
        
        IF array_length(randomized_items, 1) > 0 THEN
            randomized_field_ids := randomized_items;
        END IF;
        
    ELSIF randomize_type = 'persona' THEN
        -- Randomize personas only
        IF max_valid_personas > 0 THEN
            capped_max := LEAST(final_persona_max, max_valid_personas);
            random_count := LEAST(capped_max, GREATEST(final_persona_min,
                final_persona_min + FLOOR(RANDOM() * (capped_max - final_persona_min + 1))::integer));
            SELECT ARRAY_AGG(id ORDER BY random())
            INTO randomized_persona_ids
            FROM unnest(valid_persona_ids) AS id
            LIMIT random_count;
        END IF;
        
    ELSIF randomize_type = 'document' THEN
        -- Randomize documents only
        IF max_valid_documents > 0 THEN
            capped_max := LEAST(final_document_max, max_valid_documents);
            random_count := LEAST(capped_max, GREATEST(final_document_min,
                final_document_min + FLOOR(RANDOM() * (capped_max - final_document_min + 1))::integer));
            SELECT ARRAY_AGG(id ORDER BY random())
            INTO randomized_document_ids
            FROM unnest(valid_document_ids) AS id
            LIMIT random_count;
        END IF;
        
    ELSIF randomize_type = 'parameters' THEN
        -- Randomize parameters only
        IF max_valid_parameters > 0 THEN
            capped_max := LEAST(final_parameter_max, max_valid_parameters);
            random_count := LEAST(capped_max, GREATEST(final_parameter_min,
                final_parameter_min + FLOOR(RANDOM() * (capped_max - final_parameter_min + 1))::integer));
            SELECT ARRAY_AGG(id ORDER BY random())
            INTO randomized_parameter_ids
            FROM unnest(valid_parameter_ids) AS id
            LIMIT random_count;
        END IF;
        
    ELSIF randomize_type LIKE 'parameter_%' THEN
        -- Randomize fields for specific parameter
        param_id := (regexp_replace(randomize_type, '^parameter_', ''))::uuid;
        
        -- Use hardcoded defaults (ranges logic removed)
        param_min_val := 1;
        param_max_val := 1;
        param_max_val := LEAST(param_max_val, 3);
        param_min_val := LEAST(param_min_val, param_max_val);
        
        -- Get valid fields for this parameter
        SELECT ARRAY_AGG(f.id)
        INTO valid_items_for_param
        FROM field_artifact f
        WHERE EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
          AND (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = param_id
          AND f.id = ANY(valid_field_ids);
        
        IF valid_items_for_param IS NOT NULL AND array_length(valid_items_for_param, 1) > 0 THEN
            max_valid_items := array_length(valid_items_for_param, 1);
            capped_max := LEAST(param_max_val, max_valid_items);
            random_count := LEAST(capped_max, GREATEST(param_min_val,
                param_min_val + FLOOR(RANDOM() * (capped_max - param_min_val + 1))::integer));
            
            SELECT ARRAY_AGG(id ORDER BY random())
            INTO randomized_field_ids
            FROM unnest(valid_items_for_param) AS id
            LIMIT random_count;
        END IF;
    END IF;
    
    -- Return results (NULL arrays if no randomization occurred)
    RETURN QUERY SELECT 
        randomized_persona_ids,
        randomized_document_ids,
        randomized_parameter_ids,
        randomized_field_ids;
END;
$$;