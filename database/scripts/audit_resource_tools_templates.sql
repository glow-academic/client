-- Audit Script: Resource Tools Template Validation
-- This script provides SQL queries to audit:
-- 1. All resources in the resources enum
-- 2. Which resources have tools
-- 3. Tool structure validation (template_id chains, schemas)
-- 4. Output schema vs database table validation

-- ============================================================================
-- Query 1: List all resources from enum
-- ============================================================================

SELECT 
    enumlabel::text as resource
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'resources')
ORDER BY enumlabel;

-- ============================================================================
-- Query 2: Resources with tools (coverage check)
-- ============================================================================

SELECT 
    rt.resource::text,
    COUNT(DISTINCT rt.tool_id) as tool_count,
    string_agg(DISTINCT t.name, ', ' ORDER BY t.name) as tool_names
FROM resource_tools rt
JOIN tools t ON t.id = rt.tool_id
WHERE t.active = true
GROUP BY rt.resource
ORDER BY rt.resource;

-- ============================================================================
-- Query 3: Resources missing tools
-- ============================================================================

SELECT 
    enumlabel::text as resource
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'resources')
AND enumlabel::text NOT IN (
    SELECT DISTINCT resource::text 
    FROM resource_tools
)
ORDER BY enumlabel;

-- ============================================================================
-- Query 4: Tool structure validation
-- ============================================================================

SELECT 
    t.id as tool_id,
    t.name as tool_name,
    t.template_id,
    rt.resource::text as resource,
    CASE WHEN ts.schema_id IS NOT NULL THEN true ELSE false END as has_input_schema,
    ts.schema_id as input_schema_id,
    CASE WHEN st.schema_id IS NOT NULL THEN true ELSE false END as has_output_schema,
    st.schema_id as output_schema_id,
    CASE WHEN tmpl.id IS NOT NULL THEN true ELSE false END as template_exists,
    (SELECT COUNT(*) FROM schema_fields WHERE schema_id = ts.schema_id) as input_field_count,
    (SELECT COUNT(*) FROM schema_fields WHERE schema_id = st.schema_id) as output_field_count
FROM tools t
LEFT JOIN resource_tools rt ON rt.tool_id = t.id
LEFT JOIN tool_schemas ts ON ts.tool_id = t.id
LEFT JOIN schema_templates st ON st.template_id = t.template_id
LEFT JOIN templates tmpl ON tmpl.id = t.template_id
WHERE t.active = true
ORDER BY t.name;

-- ============================================================================
-- Query 5: Tools missing output schemas
-- ============================================================================

SELECT 
    t.id as tool_id,
    t.name as tool_name,
    t.template_id,
    rt.resource::text as resource
FROM tools t
JOIN resource_tools rt ON rt.tool_id = t.id
LEFT JOIN schema_templates st ON st.template_id = t.template_id
WHERE t.active = true
AND st.schema_id IS NULL
ORDER BY t.name;

-- ============================================================================
-- Query 6: Tool input arguments (for Jinja validation)
-- ============================================================================

SELECT 
    t.id as tool_id,
    t.name as tool_name,
    rt.resource::text as resource,
    sf.name as argument_name,
    sf.field_type as argument_type,
    sf.description as argument_description,
    sf.position
FROM tools t
JOIN resource_tools rt ON rt.tool_id = t.id
LEFT JOIN tool_schemas ts ON ts.tool_id = t.id
LEFT JOIN schema_fields sf ON sf.schema_id = ts.schema_id
WHERE t.active = true
ORDER BY t.name, sf.position NULLS LAST;

-- ============================================================================
-- Query 7: Tool output schema fields with Jinja templates
-- ============================================================================

SELECT 
    t.id as tool_id,
    t.name as tool_name,
    rt.resource::text as resource,
    sf.name as output_field_name,
    sf.field_type as output_field_type,
    sf.template as jinja_template,
    sf.position
FROM tools t
JOIN resource_tools rt ON rt.tool_id = t.id
LEFT JOIN schema_templates st ON st.template_id = t.template_id
LEFT JOIN schema_fields sf ON sf.schema_id = st.schema_id
WHERE t.active = true
ORDER BY t.name, sf.position NULLS LAST;

-- ============================================================================
-- Query 8: Output schema fields vs database table columns
-- ============================================================================

SELECT 
    t.id as tool_id,
    t.name as tool_name,
    rt.resource::text as resource,
    sf.name as schema_field_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = rt.resource::text
            AND column_name = sf.name
        ) THEN true
        ELSE false
    END as field_exists_in_table,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = rt.resource::text
        ) THEN true
        ELSE false
    END as table_exists
FROM tools t
JOIN resource_tools rt ON rt.tool_id = t.id
LEFT JOIN schema_templates st ON st.template_id = t.template_id
LEFT JOIN schema_fields sf ON sf.schema_id = st.schema_id
WHERE t.active = true
AND sf.name IS NOT NULL
ORDER BY t.name, sf.position;

-- ============================================================================
-- Query 9: Resources without corresponding tables
-- ============================================================================

SELECT 
    enumlabel::text as resource
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'resources')
AND enumlabel::text NOT IN (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
)
ORDER BY enumlabel;

-- ============================================================================
-- Query 10: Summary statistics
-- ============================================================================

SELECT 
    (SELECT COUNT(*) FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'resources')) as total_resources,
    (SELECT COUNT(DISTINCT resource) FROM resource_tools) as resources_with_tools,
    (SELECT COUNT(*) FROM tools WHERE active = true) as total_active_tools,
    (SELECT COUNT(*) FROM tools t 
     JOIN resource_tools rt ON rt.tool_id = t.id
     LEFT JOIN schema_templates st ON st.template_id = t.template_id
     WHERE t.active = true AND st.schema_id IS NULL) as tools_missing_output_schema,
    (SELECT COUNT(*) FROM tools t
     JOIN resource_tools rt ON rt.tool_id = t.id
     LEFT JOIN tool_schemas ts ON ts.tool_id = t.id
     WHERE t.active = true AND ts.schema_id IS NULL) as tools_missing_input_schema;
