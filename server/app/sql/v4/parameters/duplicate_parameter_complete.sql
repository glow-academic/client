-- Duplicate parameter with items and department links in a single transaction
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first
DROP FUNCTION IF EXISTS api_duplicate_parameter_v4(uuid, uuid);

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_duplicate_parameter_v4(
    parameter_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    parameter_id uuid,
    original_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        parameter_id AS parameter_id,
        profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        (SELECT profile_id FROM params) as profile_id,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
original_parameter AS (
    SELECT 
        (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1) as name,
        (SELECT d.description FROM parameter_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1) as description,
        COALESCE((SELECT pf.value FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'simulation_parameter' LIMIT 1), false) as simulation_parameter,
        COALESCE((SELECT pf.value FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'document_parameter' LIMIT 1), false) as document_parameter,
        COALESCE((SELECT pf.value FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'persona_parameter' LIMIT 1), false) as persona_parameter,
        COALESCE((SELECT pf.value FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'scenario_parameter' LIMIT 1), false) as scenario_parameter,
        COALESCE((SELECT pf.value FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'video_parameter' LIMIT 1), false) as video_parameter
    FROM params x
    JOIN parameters_resource p ON p.id = x.parameter_id
),
-- Insert name INTO names_resource table
new_name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT name || ' Copy', NOW(), NOW()
    FROM original_parameter
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description INTO descriptions_resource table
new_description_resource AS (
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM original_parameter
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
new_parameter AS (
    -- Insert parameter without name/description/active/flag columns
    INSERT INTO parameter_artifact (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM original_parameter
    RETURNING id as parameter_id
),
-- Link parameter to name
link_parameter_name AS (
    INSERT INTO parameter_names (parameter_id, name_id, created_at, updated_at)
    SELECT np.parameter_id, nnr.name_id, NOW(), NOW()
    FROM new_parameter np
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (parameter_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link parameter to description
link_parameter_description AS (
    INSERT INTO parameter_descriptions (parameter_id, description_id, created_at, updated_at)
    SELECT np.parameter_id, ndr.description_id, NOW(), NOW()
    FROM new_parameter np
    CROSS JOIN new_description_resource ndr
    ON CONFLICT (parameter_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link parameter active flag (set to false for duplicate)
link_parameter_active_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, value, created_at, updated_at) SELECT np.parameter_id,
        f.id,
        FALSE,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
    ON CONFLICT (parameter_id, flag_id) DO UPDATE SET 
        value = FALSE,
        updated_at = NOW()
),
-- Link parameter type flags (simulation_parameter, document_parameter, etc.)
link_parameter_type_flags AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, value, created_at, updated_at)
    SELECT 
        np.parameter_id,
        f.id,
        op.simulation_parameter,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN original_parameter op
    CROSS JOIN flags_resource f
    WHERE f.name = 'simulation_parameter' AND op.simulation_parameter = TRUE
    ON CONFLICT (parameter_id, flag_id) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
link_parameter_document_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, value, created_at, updated_at)
    SELECT 
        np.parameter_id,
        f.id,
        op.document_parameter,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN original_parameter op
    CROSS JOIN flags_resource f
    WHERE f.name = 'document_parameter' AND op.document_parameter = TRUE
    ON CONFLICT (parameter_id, flag_id) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
link_parameter_persona_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, value, created_at, updated_at)
    SELECT 
        np.parameter_id,
        f.id,
        op.persona_parameter,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN original_parameter op
    CROSS JOIN flags_resource f
    WHERE f.name = 'persona_parameter' AND op.persona_parameter = TRUE
    ON CONFLICT (parameter_id, flag_id) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
link_parameter_scenario_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, value, created_at, updated_at)
    SELECT 
        np.parameter_id,
        f.id,
        op.scenario_parameter,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN original_parameter op
    CROSS JOIN flags_resource f
    WHERE f.name = 'scenario_parameter' AND op.scenario_parameter = TRUE
    ON CONFLICT (parameter_id, flag_id) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
link_parameter_video_flag AS (
    INSERT INTO parameter_flags (parameter_id, flag_id, value, created_at, updated_at)
    SELECT 
        np.parameter_id,
        f.id,
        op.video_parameter,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN original_parameter op
    CROSS JOIN flags_resource f
    WHERE f.name = 'video_parameter' AND op.video_parameter = TRUE
    ON CONFLICT (parameter_id, flag_id) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
original_fields AS (
    SELECT 
        f.id as original_field_id,
        (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1)
    FROM params x
    JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = x.parameter_id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource f ON ff.flag_id = f.id WHERE ff.field_id = f.id AND f.name = 'active' AND ff.value = true)
),
original_field_departments AS (
    SELECT 
        of.original_field_id,
        COALESCE(ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) FILTER (WHERE fd.department_id IS NOT NULL), NULL) as department_ids
    FROM original_fields of
    LEFT JOIN field_departments fd ON fd.field_id = of.original_field_id AND fd.active = true
    GROUP BY of.original_field_id
),
-- Insert field names INTO names_resource table
field_names_resources AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT of.name, NOW(), NOW()
    FROM original_fields of
    WHERE of.name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name
),
-- Insert field descriptions INTO descriptions_resource table
field_descriptions_resources AS (
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT of.description, NOW(), NOW()
    FROM original_fields of
    WHERE of.description IS NOT NULL AND of.description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id, description
),
new_fields AS (
    -- Create all fields (without name/description/parameter_id columns)
    INSERT INTO field_artifact (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM original_fields of
    CROSS JOIN new_parameter np
    RETURNING id as field_id
),
-- Link fields to names
link_field_names AS (
    INSERT INTO field_names (field_id, name_id, created_at, updated_at)
    SELECT 
        nf.field_id,
        fnr.name_id,
        NOW(),
        NOW()
    FROM new_fields nf
    CROSS JOIN original_fields of
    JOIN field_names_resources fnr ON fnr.name = of.name
    ON CONFLICT (field_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link fields to descriptions
link_field_descriptions AS (
    INSERT INTO field_descriptions (field_id, description_id, created_at, updated_at)
    SELECT 
        nf.field_id,
        fdr.description_id,
        NOW(),
        NOW()
    FROM new_fields nf
    CROSS JOIN original_fields of
    JOIN field_descriptions_resources fdr ON fdr.description = of.description
    ON CONFLICT (field_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link fields to parameter via parameter_fields junction table
link_fields_to_parameter AS (
    INSERT INTO parameter_fields (parameter_id, field_id, created_at, updated_at)
    SELECT 
        np.parameter_id,
        nf.field_id,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN new_fields nf
    ON CONFLICT (parameter_id, field_id) DO UPDATE SET updated_at = NOW()
),
-- Get field names for return (matching by order)
new_fields_with_names AS (
    SELECT 
        nf.field_id,
        fnr.name as field_name,
        ROW_NUMBER() OVER (ORDER BY nf.field_id) as field_row_num
    FROM new_fields nf
    JOIN field_names_resources fnr ON true
    JOIN original_fields of ON of.name = fnr.name
    ORDER BY nf.field_id
),
new_fields_with_order AS (
    -- Add row numbers to new fields for matching
    SELECT 
        field_id,
        field_name,
        field_row_num
    FROM new_fields_with_names
),
fields_with_depts AS (
    -- Match new fields with original fields and their department arrays
    -- Use ROW_NUMBER to match fields in order since names might not be unique
    SELECT 
        nf.field_id,
        ofd.department_ids
    FROM new_fields_with_order nf
    JOIN (
        SELECT 
            original_field_id,
            name,
            ROW_NUMBER() OVER (ORDER BY name) as field_row_num
        FROM original_fields
    ) of ON of.field_row_num = nf.field_row_num
    LEFT JOIN original_field_departments ofd ON ofd.original_field_id = of.original_field_id
    WHERE ofd.department_ids IS NOT NULL AND array_length(ofd.department_ids, 1) > 0
),
-- Fields are already linked via parameter_id in new_fields CTE above
link_departments AS (
    -- Link departments to fields if they existed on original (only if dept_ids exist)
    INSERT INTO field_departments (field_id, department_id, active, created_at, updated_at)
    SELECT 
        fwd.field_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM fields_with_depts fwd
    CROSS JOIN UNNEST(fwd.department_ids) as dept_id
    WHERE fwd.department_ids IS NOT NULL AND array_length(fwd.department_ids, 1) > 0
    ON CONFLICT (field_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    np.parameter_id,
    op.name::text as original_name,
    ap.actor_name::text as actor_name
FROM new_parameter np
CROSS JOIN original_parameter op
CROSS JOIN actor_profile ap
$$;