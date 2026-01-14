-- Audit Script: Resource Tools, Schemas, and Agents Validation
-- This script provides SQL queries to audit:
-- 1. Tool existence per resource (Category 1)
-- 2. Schema validation - input/output schemas (Category 2)
-- 3. Output mapping validation - CREATE operations (Category 3)
-- 4. Agent existence per artifact (Category 4)
-- 5. Prompt/instruction schema validation (Category 5)

-- ============================================================================
-- CATEGORY 1: Tool Existence Per Resource
-- ============================================================================

-- Query 1: Resources missing tools
SELECT 
    enumlabel::text as resource
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'resources')
AND enumlabel::text NOT IN (
    SELECT DISTINCT resource::text 
    FROM resource_tools rt
    JOIN tool_artifact t ON t.id = rt.tool_id
    JOIN tool_flags tf ON tf.tool_id = t.id
    JOIN flags_resource f ON tf.flag_id = f.id
    WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
    AND rt.active = true
)
ORDER BY enumlabel;

-- Query 2: Resources with tools (coverage check)
SELECT 
    rt.resource::text,
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
ORDER BY rt.resource;

-- ============================================================================
-- CATEGORY 2: Schema Validation (Input/Output Schemas)
-- ============================================================================

-- Query 3: Tools missing input schemas
SELECT 
    t.id as tool_id,
    tool_n.name as tool_name,
    rt.resource::text as resource
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
ORDER BY tool_n.name;

-- Query 4: Tools missing output schemas
SELECT 
    t.id as tool_id,
    tool_n.name as tool_name,
    rt.resource::text as resource,
    tt.template_id
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
ORDER BY tool_n.name;

-- Query 5: Output schema fields vs database table columns
SELECT 
    t.id as tool_id,
    tool_n.name as tool_name,
    rt.resource::text as resource,
    sf.name as schema_field_name,
    sf.field_type as schema_field_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = rt.resource::text || '_resource'
            AND column_name = sf.name
        ) THEN true
        ELSE false
    END as field_exists_in_table,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = rt.resource::text || '_resource'
        ) THEN true
        ELSE false
    END as table_exists
FROM tool_artifact t
JOIN resource_tools rt ON rt.tool_id = t.id
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
    LEFT JOIN tool_names tn ON tn.tool_id = t.id AND tn.active = true
    LEFT JOIN names_resource tool_n ON tool_n.id = tn.name_id
LEFT JOIN tool_templates tt ON tt.tool_id = t.id AND tt.type = 'output'::type_tool_templates
LEFT JOIN schema_templates st ON st.template_id = tt.template_id
    LEFT JOIN schema_fields_resource sf ON sf.schema_id = st.schema_id AND sf.active = true
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
AND rt.active = true
AND sf.name IS NOT NULL
ORDER BY tool_n.name, sf.position NULLS LAST;

-- Query 6: Input schema fields validation
SELECT 
    t.id as tool_id,
    tool_n.name as tool_name,
    rt.resource::text as resource,
    sf.name as argument_name,
    sf.field_type as argument_type,
    sf.required,
    sf.description as argument_description,
    sf.position
FROM tool_artifact t
JOIN resource_tools rt ON rt.tool_id = t.id
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
    LEFT JOIN tool_names tn ON tn.tool_id = t.id AND tn.active = true
    LEFT JOIN names_resource tool_n ON tool_n.id = tn.name_id
LEFT JOIN tool_schemas ts ON ts.tool_id = t.id
    LEFT JOIN schema_fields_resource sf ON sf.schema_id = ts.schema_id AND sf.active = true
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
AND rt.active = true
ORDER BY tool_n.name, sf.position NULLS LAST;

-- ============================================================================
-- CATEGORY 3: Output Mapping Validation (CREATE Operations)
-- ============================================================================

-- Query 7: Required columns vs output schema coverage
WITH resource_columns AS (
    SELECT 
        table_name,
        column_name,
        is_nullable,
        column_default,
        data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name LIKE '%_resource'
    AND column_name NOT IN ('id', 'created_at', 'updated_at') -- These are auto-generated
),
tool_output_fields AS (
    SELECT 
        rt.resource::text as resource,
        sf.name as output_field,
        sf.template as jinja_template,
        sf.field_type
    FROM tool_artifact t
    JOIN resource_tools rt ON rt.tool_id = t.id
    JOIN tool_flags tf ON tf.tool_id = t.id
    JOIN flags_resource f ON tf.flag_id = f.id
    JOIN tool_templates tt ON tt.tool_id = t.id AND tt.type = 'output'::type_tool_templates
    JOIN schema_templates st ON st.template_id = tt.template_id
    JOIN schema_fields sf ON sf.schema_id = st.schema_id
    WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
    AND rt.active = true
)
SELECT 
    rc.table_name,
    rc.column_name,
    rc.is_nullable,
    rc.column_default,
    rc.data_type,
    CASE WHEN tof.output_field IS NOT NULL THEN true ELSE false END as covered_by_schema,
    tof.jinja_template,
    tof.field_type as schema_field_type
FROM resource_columns rc
LEFT JOIN tool_output_fields tof ON 
    rc.table_name = tof.resource || '_resource' 
    AND rc.column_name = tof.output_field
WHERE rc.is_nullable = 'NO' 
AND rc.column_default IS NULL
AND tof.output_field IS NULL
ORDER BY rc.table_name, rc.column_name;

-- Query 8: Foreign key columns in resource tables
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    CASE 
        WHEN EXISTS (
            SELECT 1
            FROM tool_artifact t
            JOIN resource_tools rt ON rt.tool_id = t.id
            JOIN tool_flags tf ON tf.tool_id = t.id
            JOIN flags_resource f ON tf.flag_id = f.id
            JOIN tool_templates tt ON tt.tool_id = t.id AND tt.type = 'output'::type_tool_templates
            JOIN schema_templates st ON st.template_id = tt.template_id
            JOIN schema_fields sf ON sf.schema_id = st.schema_id
            WHERE rt.resource::text || '_resource' = tc.table_name
            AND sf.name = kcu.column_name
            AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
            AND rt.active = true
        ) THEN true
        ELSE false
    END as covered_by_output_schema
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
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- CATEGORY 4: Agent Existence Per Artifact
-- ============================================================================

-- Query 9: Artifacts with agents
SELECT 
    a.artifact::text,
    COUNT(DISTINCT ag.id) as agent_count,
    COUNT(DISTINCT at.tool_id) as tool_count,
    string_agg(DISTINCT ag.id::text, ', ' ORDER BY ag.id::text) as agent_ids
FROM (
    SELECT enumlabel::text as artifact
    FROM pg_enum 
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'artifacts')
) a
LEFT JOIN artifact_resources ar ON ar.artifact::text = a.artifact
LEFT JOIN resource_tools rt ON rt.resource = ar.resource AND rt.active = true
LEFT JOIN agent_tools at ON at.tool_id = rt.tool_id AND at.active = true
LEFT JOIN agent_artifact ag ON ag.id = at.agent_id
GROUP BY a.artifact
ORDER BY a.artifact;

-- Query 10: Artifacts missing agents
SELECT 
    a.artifact::text
FROM (
    SELECT enumlabel::text as artifact
    FROM pg_enum 
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'artifacts')
) a
WHERE NOT EXISTS (
    SELECT 1
    FROM artifact_resources ar
    JOIN resource_tools rt ON rt.resource = ar.resource AND rt.active = true
    JOIN agent_tools at ON at.tool_id = rt.tool_id AND at.active = true
    JOIN agent_artifact ag ON ag.id = at.agent_id
    WHERE ar.artifact::text = a.artifact
)
ORDER BY a.artifact;

-- Query 11: Agents missing tools
SELECT 
    ag.id as agent_id,
    (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = ag.id LIMIT 1) as agent_name,
    COUNT(DISTINCT at.tool_id) as tool_count
FROM agent_artifact ag
LEFT JOIN agent_tools at ON at.agent_id = ag.id AND at.active = true
GROUP BY ag.id
HAVING COUNT(DISTINCT at.tool_id) = 0
ORDER BY ag.id;

-- ============================================================================
-- CATEGORY 5: Prompt/Instruction Schema Validation
-- ============================================================================

-- Query 12: Agents with prompts/instructions
SELECT 
    ag.id as agent_id,
    (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = ag.id LIMIT 1) as agent_name,
    COUNT(DISTINCT ap.prompt_id) as prompt_count,
    COUNT(DISTINCT ai.instruction_id) as instruction_count,
    COUNT(DISTINCT at.tool_id) as tool_count
FROM agent_artifact ag
LEFT JOIN agent_prompts ap ON ap.agent_id = ag.id AND ap.active = true
LEFT JOIN agent_instructions ai ON ai.agent_id = ag.id AND ai.active = true
LEFT JOIN agent_tools at ON at.agent_id = ag.id AND at.active = true
GROUP BY ag.id
ORDER BY ag.id;

-- Query 13: Agents missing prompts
SELECT 
    ag.id as agent_id,
    (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = ag.id LIMIT 1) as agent_name
FROM agent_artifact ag
LEFT JOIN agent_prompts ap ON ap.agent_id = ag.id AND ap.active = true
WHERE ap.prompt_id IS NULL
ORDER BY ag.id;

-- Query 14: Agents missing instructions
SELECT 
    ag.id as agent_id,
    (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = ag.id LIMIT 1) as agent_name
FROM agent_artifact ag
LEFT JOIN agent_instructions ai ON ai.agent_id = ag.id AND ai.active = true
WHERE ai.instruction_id IS NULL
ORDER BY ag.id;

-- Query 15: Tool names referenced in prompts/instructions (for manual validation)
-- Note: This query lists all tools that agents have access to, for manual checking
-- against prompt/instruction text to verify schema references match
SELECT DISTINCT
    ag.id as agent_id,
    (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = ag.id LIMIT 1) as agent_name,
    tool_n.name as tool_name,
    rt.resource::text as resource
FROM agent_artifact ag
JOIN agent_tools at ON at.agent_id = ag.id AND at.active = true
JOIN tool_artifact t ON t.id = at.tool_id
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
    LEFT JOIN tool_names tn ON tn.tool_id = t.id AND tn.active = true
    LEFT JOIN names_resource tool_n ON tool_n.id = tn.name_id
JOIN resource_tools rt ON rt.tool_id = t.id AND rt.active = true
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
ORDER BY ag.id, n.name;

-- Query 16: Input schema fields for agent tools (for manual validation against prompts/instructions)
SELECT DISTINCT
    ag.id as agent_id,
    (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = ag.id LIMIT 1) as agent_name,
    tool_n.name as tool_name,
    sf.name as argument_name,
    sf.field_type as argument_type,
    sf.required,
    sf.description as argument_description
FROM agent_artifact ag
JOIN agent_tools at ON at.agent_id = ag.id AND at.active = true
JOIN tool_artifact t ON t.id = at.tool_id
JOIN tool_flags tf ON tf.tool_id = t.id
JOIN flags_resource f ON tf.flag_id = f.id
    LEFT JOIN tool_names tn ON tn.tool_id = t.id AND tn.active = true
    LEFT JOIN names_resource tool_n ON tool_n.id = tn.name_id
JOIN tool_schemas ts ON ts.tool_id = t.id
JOIN schema_fields sf ON sf.schema_id = ts.schema_id
WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
ORDER BY ag.id, tool_n.name, sf.position NULLS LAST;

-- ============================================================================
-- SUMMARY STATISTICS
-- ============================================================================

-- Query 17: Summary statistics
SELECT 
    (SELECT COUNT(*) FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'resources')) as total_resources,
    (SELECT COUNT(DISTINCT resource) FROM resource_tools rt 
     JOIN tool_artifact t ON t.id = rt.tool_id
     JOIN tool_flags tf ON tf.tool_id = t.id
     JOIN flags_resource f ON tf.flag_id = f.id
     WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true AND rt.active = true) as resources_with_tools,
    (SELECT COUNT(*) FROM tool_artifact t
     JOIN tool_flags tf ON tf.tool_id = t.id
     JOIN flags_resource f ON tf.flag_id = f.id
     WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true) as total_active_tools,
    (SELECT COUNT(*) FROM tool_artifact t 
     JOIN resource_tools rt ON rt.tool_id = t.id
     JOIN tool_flags tf ON tf.tool_id = t.id
     JOIN flags_resource f ON tf.flag_id = f.id
     LEFT JOIN tool_schemas ts ON ts.tool_id = t.id
     WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
     AND rt.active = true AND ts.schema_id IS NULL) as tools_missing_input_schema,
    (SELECT COUNT(*) FROM tool_artifact t 
     JOIN resource_tools rt ON rt.tool_id = t.id
     JOIN tool_flags tf ON tf.tool_id = t.id
     JOIN flags_resource f ON tf.flag_id = f.id
     LEFT JOIN tool_templates tt ON tt.tool_id = t.id AND tt.type = 'output'::type_tool_templates
     LEFT JOIN schema_templates st ON st.template_id = tt.template_id
     WHERE f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true
     AND rt.active = true AND st.schema_id IS NULL) as tools_missing_output_schema,
    (SELECT COUNT(*) FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'artifacts')) as total_artifacts,
    (SELECT COUNT(DISTINCT ag.id) FROM agent_artifact ag) as total_agents,
    (SELECT COUNT(DISTINCT ag.id) 
     FROM agent_artifact ag
     WHERE EXISTS (
         SELECT 1 FROM agent_tools at WHERE at.agent_id = ag.id AND at.active = true
     )) as agents_with_tools,
    (SELECT COUNT(DISTINCT ag.id) 
     FROM agent_artifact ag
     WHERE EXISTS (
         SELECT 1 FROM agent_prompts ap WHERE ap.agent_id = ag.id AND ap.active = true
     )) as agents_with_prompts,
    (SELECT COUNT(DISTINCT ag.id) 
     FROM agent_artifact ag
     WHERE EXISTS (
         SELECT 1 FROM agent_instructions ai WHERE ai.agent_id = ag.id AND ai.active = true
     )) as agents_with_instructions;
