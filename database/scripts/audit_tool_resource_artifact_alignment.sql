-- Comprehensive Audit: Tool-Resource-Artifact Alignment
-- This script audits:
-- 1. Tools have proper resource mappings
-- 2. Resources are mapped to correct artifacts
-- 3. Tools have output schemas (required)
-- 4. Tools have input schemas (optional but recommended)
-- 5. Schema fields match table structure
-- 6. Tools are attached to correct artifacts via resources

-- ============================================================================
-- Query 1: Tools Missing Output Schemas (CRITICAL)
-- ============================================================================
SELECT 
    t.id as tool_id,
    tool_n.name as tool_name,
    rt.resource::text as resource,
    (SELECT DISTINCT ar.artifact::text FROM artifact_resources ar WHERE ar.resource = rt.resource LIMIT 1) as artifact
FROM tool_artifact t
JOIN resource_tools rt ON rt.tool_id = t.id
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
LEFT JOIN tool_names tn ON tn.tool_id = t.id AND tn.active = true
LEFT JOIN names_resource tool_n ON tool_n.id = tn.name_id
LEFT JOIN tool_templates tt ON tt.tool_id = t.id AND tt.type = 'output'::type_tool_templates
LEFT JOIN schema_templates st ON st.template_id = tt.template_id
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
AND rt.active = true
AND st.schema_id IS NULL
ORDER BY rt.resource, tool_n.name;

-- ============================================================================
-- Query 2: Tools Missing Input Schemas (WARNING - Optional)
-- ============================================================================
SELECT 
    t.id as tool_id,
    tool_n.name as tool_name,
    rt.resource::text as resource,
    (SELECT DISTINCT ar.artifact::text FROM artifact_resources ar WHERE ar.resource = rt.resource LIMIT 1) as artifact
FROM tool_artifact t
JOIN resource_tools rt ON rt.tool_id = t.id
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
LEFT JOIN tool_names tn ON tn.tool_id = t.id AND tn.active = true
LEFT JOIN names_resource tool_n ON tool_n.id = tn.name_id
LEFT JOIN tool_schemas ts ON ts.tool_id = t.id
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
AND rt.active = true
AND ts.schema_id IS NULL
ORDER BY rt.resource, tool_n.name;

-- ============================================================================
-- Query 3: Resources Not Mapped to Artifacts
-- ============================================================================
SELECT
    rt.resource::text as resource,
    COUNT(DISTINCT rt.tool_id) as tool_count,
    string_agg(DISTINCT tool_n.name, ', ' ORDER BY tool_n.name) as tool_names
FROM resource_tools rt
JOIN tool_artifact t ON t.id = rt.tool_id
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
LEFT JOIN tool_names tn ON tn.tool_id = t.id AND tn.active = true
LEFT JOIN names_resource tool_n ON tool_n.id = tn.name_id
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
AND rt.active = true
AND NOT EXISTS (
    SELECT 1 FROM artifact_resources ar WHERE ar.resource = rt.resource
)
GROUP BY rt.resource
ORDER BY rt.resource;

-- ============================================================================
-- Query 4: Tool-Resource-Artifact Alignment Summary
-- ============================================================================
SELECT 
    rt.resource::text as resource,
    (SELECT DISTINCT ar.artifact::text FROM artifact_resources ar WHERE ar.resource = rt.resource LIMIT 1) as artifact,
    COUNT(DISTINCT rt.tool_id) as tool_count,
    COUNT(DISTINCT CASE WHEN EXISTS (
        SELECT 1 FROM tool_templates tt 
        JOIN schema_templates st ON st.template_id = tt.template_id 
        WHERE tt.tool_id = rt.tool_id AND tt.type = 'output'::type_tool_templates
    ) THEN rt.tool_id END) as tools_with_output_schema,
    COUNT(DISTINCT CASE WHEN EXISTS (
        SELECT 1 FROM tool_schemas ts WHERE ts.tool_id = rt.tool_id
    ) THEN rt.tool_id END) as tools_with_input_schema,
    CASE 
        WHEN COUNT(DISTINCT rt.tool_id) = COUNT(DISTINCT CASE WHEN EXISTS (
            SELECT 1 FROM tool_templates tt 
            JOIN schema_templates st ON st.template_id = tt.template_id 
            WHERE tt.tool_id = rt.tool_id AND tt.type = 'output'::type_tool_templates
        ) THEN rt.tool_id END) THEN 'COMPLETE'
        ELSE 'MISSING_OUTPUT_SCHEMAS'
    END as schema_status
FROM resource_tools rt
JOIN tool_artifact t ON t.id = rt.tool_id
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
AND rt.active = true
GROUP BY rt.resource
ORDER BY 
    CASE 
        WHEN COUNT(DISTINCT rt.tool_id) = COUNT(DISTINCT CASE WHEN EXISTS (
            SELECT 1 FROM tool_templates tt 
            JOIN schema_templates st ON st.template_id = tt.template_id 
            WHERE tt.tool_id = rt.tool_id AND tt.type = 'output'::type_tool_templates
        ) THEN rt.tool_id END) THEN 2
        ELSE 1
    END,
    rt.resource;

-- ============================================================================
-- Query 5: Schema Fields Missing from Tables
-- ============================================================================
SELECT 
    rt.resource::text as resource,
    tool_n.name as tool_name,
    sf.name as schema_field_name,
    sf.field_type as schema_field_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = rt.resource::text || '_resource'
            AND column_name = sf.name
        ) THEN 'EXISTS'
        ELSE 'MISSING'
    END as table_column_status
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
AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = rt.resource::text || '_resource'
    AND column_name = sf.name
)
ORDER BY rt.resource, tool_n.name, sf.position;

-- ============================================================================
-- Query 6: Tools with Multiple Resources (Should be One Resource Per Tool)
-- ============================================================================
SELECT 
    t.id as tool_id,
    tool_n.name as tool_name,
    COUNT(DISTINCT rt.resource) as resource_count,
    string_agg(DISTINCT rt.resource::text, ', ' ORDER BY rt.resource::text) as resources
FROM tool_artifact t
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
JOIN resource_tools rt ON rt.tool_id = t.id
LEFT JOIN tool_names tn ON tn.tool_id = t.id AND tn.active = true
LEFT JOIN names_resource tool_n ON tool_n.id = tn.name_id
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
AND rt.active = true
GROUP BY t.id, tool_n.name
HAVING COUNT(DISTINCT rt.resource) > 1
ORDER BY resource_count DESC, tool_n.name;

-- ============================================================================
-- Query 7: Resources with Multiple Tools (Should be One Tool Per Resource)
-- ============================================================================
SELECT 
    rt.resource::text as resource,
    (SELECT DISTINCT ar.artifact::text FROM artifact_resources ar WHERE ar.resource = rt.resource LIMIT 1) as artifact,
    COUNT(DISTINCT rt.tool_id) as tool_count,
    string_agg(DISTINCT tool_n.name, ', ' ORDER BY tool_n.name) as tool_names
FROM resource_tools rt
JOIN tool_artifact t ON t.id = rt.tool_id
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
LEFT JOIN tool_names tn ON tn.tool_id = t.id AND tn.active = true
LEFT JOIN names_resource tool_n ON tool_n.id = tn.name_id
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
AND rt.active = true
GROUP BY rt.resource
HAVING COUNT(DISTINCT rt.tool_id) > 1
ORDER BY tool_count DESC, rt.resource;

-- ============================================================================
-- Query 8: Summary Statistics
-- ============================================================================
SELECT 
    'Total Active Tools' as metric,
    COUNT(DISTINCT t.id)::text as value
FROM tool_artifact t
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
UNION ALL
SELECT 
    'Tools with Output Schemas',
    COUNT(DISTINCT t.id)::text
FROM tool_artifact t
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
JOIN tool_templates tt ON tt.tool_id = t.id AND tt.type = 'output'::type_tool_templates
JOIN schema_templates st ON st.template_id = tt.template_id
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
UNION ALL
SELECT 
    'Tools with Input Schemas',
    COUNT(DISTINCT t.id)::text
FROM tool_artifact t
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
JOIN tool_schemas ts ON ts.tool_id = t.id
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
UNION ALL
SELECT 
    'Resources with Tools',
    COUNT(DISTINCT rt.resource)::text
FROM resource_tools rt
JOIN tool_artifact t ON t.id = rt.tool_id
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
AND rt.active = true
UNION ALL
SELECT 
    'Resources Mapped to Artifacts',
    COUNT(DISTINCT ar.resource)::text
FROM artifact_resources ar
JOIN resource_tools rt ON rt.resource = ar.resource
JOIN tool_artifact t ON t.id = rt.tool_id
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
AND rt.active = true;
