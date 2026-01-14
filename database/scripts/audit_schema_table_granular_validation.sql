-- Granular Schema-Table Validation
-- This script provides detailed validation comparing:
-- 1. Output schema fields vs actual INSERT column lists from SQL functions
-- 2. Data type compatibility (schema field_type vs table column data_type)
-- 3. Required field matching (schema required vs table is_nullable)
-- 4. Default value handling
-- 5. Foreign key column validation

-- ============================================================================
-- Query 1: Extract INSERT Column Lists from SQL Functions
-- ============================================================================
-- Extract the column list from INSERT statements: INSERT INTO {resource}_resource(column1, column2, ...)

WITH function_defs AS (
    SELECT 
        p.proname,
        pg_get_functiondef(p.oid) as function_body
    FROM pg_proc p
    WHERE p.proname LIKE 'api_create_%_v4'
    AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
),
insert_extracts AS (
    SELECT 
        proname,
        regexp_replace(proname, 'api_create_', '') as resource_name,
        regexp_replace(proname, 'api_create_', '') as resource_name_clean,
        (regexp_match(function_body, 'INSERT INTO (\w+_resource)\s*\(([^)]+)\)'))[1] as table_name,
        (regexp_match(function_body, 'INSERT INTO (\w+_resource)\s*\(([^)]+)\)'))[2] as insert_columns_raw
    FROM function_defs
    WHERE function_body ~* 'INSERT INTO.*_resource\s*\('
)
SELECT 
    proname,
    resource_name,
    table_name,
    insert_columns_raw,
    -- Split columns and clean up
    string_to_array(regexp_replace(insert_columns_raw, '\s+', '', 'g'), ',') as insert_columns_array
FROM insert_extracts
ORDER BY proname
LIMIT 20;

-- ============================================================================
-- Query 2: Granular Schema-Table Field Comparison with Data Types
-- ============================================================================

WITH tool_output_schemas AS (
    SELECT 
        rt.resource::text as resource,
        tool_n.name as tool_name,
        sf.name as schema_field_name,
        sf.field_type as schema_field_type,
        sf.required as schema_required,
        sf.template as schema_template,
        sf.position as schema_position,
        sf.description as schema_description
    FROM tool_artifact t
    JOIN resource_tools rt ON rt.tool_id = t.id
    JOIN tool_flags tf ON tf.tool_id = t.id
    JOIN flags_resource f ON tf.flag_id = f.id
    LEFT JOIN tool_names tn ON tn.tool_id = t.id AND tn.active = true
    LEFT JOIN names_resource tool_n ON tool_n.id = tn.name_id
    JOIN tool_templates tt ON tt.tool_id = t.id AND tt.type = 'output'::type_tool_templates
    JOIN schema_templates st ON st.template_id = tt.template_id
    JOIN schema_fields_resource sf ON sf.schema_id = st.schema_id AND sf.active = true
    WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
    AND rt.active = true
),
table_columns AS (
    SELECT 
        table_name,
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name LIKE '%_resource'
),
type_compatibility AS (
    SELECT 
        tos.resource,
        tos.tool_name,
        tos.schema_field_name,
        tos.schema_field_type,
        tos.schema_required,
        tos.schema_template,
        tos.schema_position,
        tc.column_name as table_column_name,
        tc.data_type as table_data_type,
        tc.udt_name as table_udt_name,
        tc.is_nullable as table_nullable,
        tc.column_default as table_default,
        -- Data type compatibility check
        CASE 
            WHEN tos.schema_field_type = 'string' AND tc.data_type IN ('text', 'character varying', 'character') THEN 'COMPATIBLE'
            WHEN tos.schema_field_type = 'string' AND tc.udt_name = 'uuid' THEN 'COMPATIBLE'
            WHEN tos.schema_field_type = 'number' AND tc.data_type IN ('integer', 'bigint', 'smallint') THEN 'COMPATIBLE'
            WHEN tos.schema_field_type = 'number' AND tc.data_type IN ('real', 'double precision', 'numeric') THEN 'COMPATIBLE'
            WHEN tos.schema_field_type = 'boolean' AND tc.data_type = 'boolean' THEN 'COMPATIBLE'
            WHEN tos.schema_field_type = 'array' AND tc.data_type LIKE '%[]' THEN 'COMPATIBLE'
            WHEN tos.schema_field_type = 'string' AND tc.data_type = 'jsonb' THEN 'COMPATIBLE'
            WHEN tc.column_name IS NULL THEN 'MISSING_COLUMN'
            ELSE 'TYPE_MISMATCH'
        END as type_compatibility,
        -- Required/nullable compatibility check
        CASE 
            WHEN tc.column_name IS NULL THEN 'MISSING_COLUMN'
            WHEN tos.schema_required = true AND tc.is_nullable = 'NO' AND tc.column_default IS NULL THEN 'OK'
            WHEN tos.schema_required = true AND tc.is_nullable = 'YES' THEN 'WARNING: Schema required but column nullable'
            WHEN tos.schema_required = false AND tc.is_nullable = 'NO' AND tc.column_default IS NULL THEN 'WARNING: Schema optional but column NOT NULL'
            WHEN tos.schema_required = false AND (tc.is_nullable = 'YES' OR tc.column_default IS NOT NULL) THEN 'OK'
            ELSE 'OK'
        END as nullable_compatibility
    FROM tool_output_schemas tos
    LEFT JOIN table_columns tc ON 
        tc.table_name = tos.resource || '_resource'
        AND tc.column_name = tos.schema_field_name
)
SELECT 
    resource,
    tool_name,
    schema_field_name,
    schema_field_type,
    schema_required,
    schema_template,
    table_column_name,
    table_data_type,
    table_nullable,
    table_default,
    type_compatibility,
    nullable_compatibility,
        CASE 
        WHEN type_compatibility = 'MISSING_COLUMN' THEN 'CRITICAL'
        WHEN type_compatibility = 'TYPE_MISMATCH' THEN 'ERROR'
        WHEN nullable_compatibility LIKE 'WARNING:%' THEN 'WARNING'
        ELSE 'OK'
    END as severity
FROM type_compatibility
ORDER BY 
    CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'ERROR' THEN 2
        WHEN 'WARNING' THEN 3
        ELSE 4
    END,
    resource,
    schema_position;

-- ============================================================================
-- Query 3: INSERT Column Coverage Analysis
-- ============================================================================
-- Extract INSERT columns from SQL functions and compare with output schema fields

WITH function_inserts AS (
    SELECT 
        p.proname,
        regexp_replace(p.proname, 'api_create_', '') as resource_name,
        (regexp_match(pg_get_functiondef(p.oid), 'INSERT INTO (\w+_resource)\s*\(([^)]+)\)'))[2] as insert_columns_str
    FROM pg_proc p
    WHERE p.proname LIKE 'api_create_%_v4'
    AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND pg_get_functiondef(p.oid) ~* 'INSERT INTO.*_resource\s*\('
),
insert_columns_expanded AS (
    SELECT 
        proname,
        resource_name,
        trim(unnest(string_to_array(regexp_replace(insert_columns_str, '\s+', '', 'g'), ','))) as insert_column
    FROM function_inserts
    WHERE insert_columns_str IS NOT NULL
),
system_managed_columns AS (
    SELECT unnest(ARRAY['id', 'created_at', 'updated_at', 'call_id', 'active', 'mcp', 'generated', 'group_id']) as column_name
),
schema_fields_for_resource AS (
    SELECT 
        rt.resource::text as resource,
        tool_n.name as tool_name,
        sf.name as schema_field_name
    FROM tool_artifact t
    JOIN resource_tools rt ON rt.tool_id = t.id
    JOIN tool_flags tf ON tf.tool_id = t.id
    JOIN flags_resource f ON tf.flag_id = f.id
    LEFT JOIN tool_names tn ON tn.tool_id = t.id AND tn.active = true
    LEFT JOIN names_resource tool_n ON tool_n.id = tn.name_id
    JOIN tool_templates tt ON tt.tool_id = t.id AND tt.type = 'output'::type_tool_templates
    JOIN schema_templates st ON st.template_id = tt.template_id
    JOIN schema_fields_resource sf ON sf.schema_id = st.schema_id AND sf.active = true
    WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
    AND rt.active = true
)
SELECT 
    ice.proname,
    ice.resource_name,
    ice.insert_column,
    CASE 
        WHEN smc.column_name IS NOT NULL THEN 'SYSTEM_MANAGED'
        WHEN sfr.schema_field_name IS NOT NULL THEN 'COVERED_BY_SCHEMA'
        ELSE 'MISSING_FROM_SCHEMA'
    END as coverage_status,
    sfr.tool_name,
    sfr.schema_field_name
FROM insert_columns_expanded ice
LEFT JOIN system_managed_columns smc ON smc.column_name = ice.insert_column
LEFT JOIN schema_fields_for_resource sfr ON 
    sfr.resource = ice.resource_name
    AND sfr.schema_field_name = ice.insert_column
ORDER BY 
    CASE 
        WHEN smc.column_name IS NOT NULL THEN 3
        WHEN sfr.schema_field_name IS NOT NULL THEN 2
        ELSE 1
    END,
    ice.proname,
    ice.insert_column;

-- ============================================================================
-- Query 4: Data Type Compatibility Matrix
-- ============================================================================

SELECT 
    sf.field_type as schema_type,
    c.data_type as pg_data_type,
    c.udt_name as pg_udt_name,
    COUNT(*) as usage_count,
    CASE 
        WHEN sf.field_type = 'string' AND c.data_type IN ('text', 'character varying', 'character') THEN 'COMPATIBLE'
        WHEN sf.field_type = 'string' AND c.udt_name = 'uuid' THEN 'COMPATIBLE'
        WHEN sf.field_type = 'number' AND c.data_type IN ('integer', 'bigint', 'smallint') THEN 'COMPATIBLE'
        WHEN sf.field_type = 'number' AND c.data_type IN ('real', 'double precision', 'numeric') THEN 'COMPATIBLE'
        WHEN sf.field_type = 'boolean' AND c.data_type = 'boolean' THEN 'COMPATIBLE'
    WHEN sf.field_type = 'array' AND c.data_type LIKE '%[]' THEN 'COMPATIBLE'
    WHEN sf.field_type = 'string' AND c.data_type = 'jsonb' THEN 'COMPATIBLE'
    ELSE 'INCOMPATIBLE'
    END as compatibility_status
FROM schema_fields_resource sf
JOIN tool_templates tt ON tt.template_id IN (
    SELECT template_id FROM schema_templates WHERE schema_id = sf.schema_id
) AND tt.type = 'output'::type_tool_templates
JOIN tool_artifact t ON t.id = tt.tool_id
JOIN resource_tools rt ON rt.tool_id = t.id
JOIN information_schema.columns c ON 
    c.table_name = rt.resource::text || '_resource'
    AND c.table_schema = 'public'
    AND c.column_name = sf.name
WHERE sf.active = true
GROUP BY sf.field_type, c.data_type, c.udt_name
ORDER BY usage_count DESC, compatibility_status;

-- ============================================================================
-- Query 5: Required Field Validation (Detailed)
-- ============================================================================

SELECT 
    rt.resource::text as resource,
    tool_n.name as tool_name,
    sf.name as schema_field,
    sf.field_type as schema_type,
    sf.required as schema_required,
    sf.template as schema_template,
    c.column_name as table_column,
    c.data_type as table_type,
    c.is_nullable as table_nullable,
    c.column_default as table_default,
    CASE 
        WHEN sf.required = true AND c.is_nullable = 'NO' AND c.column_default IS NULL THEN 'OK'
        WHEN sf.required = true AND c.is_nullable = 'YES' THEN 'WARNING: Schema required but column nullable'
        WHEN sf.required = true AND c.column_default IS NOT NULL THEN 'INFO: Schema required but column has default'
        WHEN sf.required = false AND c.is_nullable = 'NO' AND c.column_default IS NULL THEN 'WARNING: Schema optional but column NOT NULL'
        WHEN sf.required = false AND (c.is_nullable = 'YES' OR c.column_default IS NOT NULL) THEN 'OK'
        ELSE 'OK'
    END as validation_status
FROM tool_artifact t
JOIN resource_tools rt ON rt.tool_id = t.id
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
LEFT JOIN tool_names tn ON tn.tool_id = t.id AND tn.active = true
LEFT JOIN names_resource tool_n ON tool_n.id = tn.name_id
JOIN tool_templates tt ON tt.tool_id = t.id AND tt.type = 'output'::type_tool_templates
JOIN schema_templates st ON st.template_id = tt.template_id
JOIN schema_fields_resource sf ON sf.schema_id = st.schema_id AND sf.active = true
JOIN information_schema.columns c ON 
    c.table_name = rt.resource::text || '_resource'
    AND c.table_schema = 'public'
    AND c.column_name = sf.name
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
AND rt.active = true
ORDER BY 
    CASE 
        WHEN sf.required = true AND c.is_nullable = 'YES' THEN 1
        WHEN sf.required = false AND c.is_nullable = 'NO' AND c.column_default IS NULL THEN 1
        ELSE 2
    END,
    rt.resource,
    sf.position;

-- ============================================================================
-- Query 6: Foreign Key Column Validation
-- ============================================================================
-- Check if FK columns in resource tables are covered by output schemas

WITH fk_columns AS (
    SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        CASE 
            WHEN tc.table_name LIKE '%_resource' THEN 
                regexp_replace(tc.table_name, '_resource$', '')
            ELSE NULL
        END as resource_name
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name LIKE '%_resource'
),
schema_fk_coverage AS (
    SELECT 
        rt.resource::text as resource,
        tool_n.name as tool_name,
        sf.name as schema_field_name,
        sf.field_type as schema_field_type,
        sf.template as schema_template
    FROM tool_artifact t
    JOIN resource_tools rt ON rt.tool_id = t.id
    JOIN tool_flags tf ON tf.tool_id = t.id
    JOIN flags_resource f ON tf.flag_id = f.id
    LEFT JOIN tool_names tn ON tn.tool_id = t.id AND tn.active = true
    LEFT JOIN names_resource tool_n ON tool_n.id = tn.name_id
    JOIN tool_templates tt ON tt.tool_id = t.id AND tt.type = 'output'::type_tool_templates
    JOIN schema_templates st ON st.template_id = tt.template_id
    JOIN schema_fields_resource sf ON sf.schema_id = st.schema_id AND sf.active = true
    WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
    AND rt.active = true
)
SELECT 
    fk.table_name,
    fk.column_name,
    fk.foreign_table_name,
    fk.foreign_column_name,
    fk.resource_name,
    CASE 
        WHEN sfc.schema_field_name IS NOT NULL THEN 'COVERED'
        WHEN fk.column_name IN ('call_id', 'id') THEN 'SYSTEM_MANAGED'
        ELSE 'MISSING'
    END as schema_coverage,
    sfc.tool_name,
    sfc.schema_field_name,
    sfc.schema_field_type,
    sfc.schema_template
FROM fk_columns fk
LEFT JOIN schema_fk_coverage sfc ON 
    sfc.resource = fk.resource_name
    AND sfc.schema_field_name = fk.column_name
ORDER BY 
    CASE 
        WHEN sfc.schema_field_name IS NOT NULL THEN 2
        WHEN fk.column_name IN ('call_id', 'id') THEN 3
        ELSE 1
    END,
    fk.table_name,
    fk.column_name;
