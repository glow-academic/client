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
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
original_parameter AS (
    SELECT
        (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.parameter_id = pa.id LIMIT 1) as name,
        (SELECT pd.descriptions_id FROM parameter_descriptions_junction pd WHERE pd.parameter_id = pa.id LIMIT 1) as descriptions_id,
        COALESCE((SELECT f.value FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flags_id = f.id WHERE pf.parameter_id = pa.id AND f.name = 'parameter_simulation' LIMIT 1), false) as simulation_parameter,
        COALESCE((SELECT f.value FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flags_id = f.id WHERE pf.parameter_id = pa.id AND f.name = 'parameter_document' LIMIT 1), false) as document_parameter,
        COALESCE((SELECT f.value FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flags_id = f.id WHERE pf.parameter_id = pa.id AND f.name = 'parameter_persona' LIMIT 1), false) as persona_parameter,
        COALESCE((SELECT f.value FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flags_id = f.id WHERE pf.parameter_id = pa.id AND f.name = 'parameter_scenario' LIMIT 1), false) as scenario_parameter,
        COALESCE((SELECT f.value FROM parameter_flags_junction pf JOIN flags_resource f ON pf.flags_id = f.id WHERE pf.parameter_id = pa.id AND f.name = 'parameter_video' LIMIT 1), false) as video_parameter
    FROM params x
    JOIN parameter_artifact pa ON pa.id = x.parameter_id
),
-- Insert name INTO names_resource table
new_name_resource AS (
    INSERT INTO names_resource (name, created_at)
    SELECT name || ' Copy', NOW()
    FROM original_parameter
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as names_id
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
    INSERT INTO parameter_names_junction (parameter_id, names_id, created_at)
    SELECT np.parameter_id, nnr.names_id, NOW()
    FROM new_parameter np
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (parameter_id, names_id) DO NOTHING
),
-- Link parameter to existing description (no new resource created)
link_parameter_description AS (
    INSERT INTO parameter_descriptions_junction (parameter_id, descriptions_id, created_at)
    SELECT np.parameter_id, op.descriptions_id, NOW()
    FROM new_parameter np
    CROSS JOIN original_parameter op
    WHERE op.descriptions_id IS NOT NULL
    ON CONFLICT (parameter_id, descriptions_id) DO NOTHING
),
-- Link parameter active flag (set to false for duplicate)
link_parameter_active_flag AS (
    INSERT INTO parameter_flags_junction (parameter_id, flags_id, created_at) SELECT np.parameter_id,
        f.id,
        NOW()
    FROM new_parameter np
    CROSS JOIN flags_resource f
    WHERE f.name = 'parameter_active'
    ON CONFLICT (parameter_id, flags_id) DO NOTHING
),
-- Link parameter type flags (parameter_simulation, parameter_document, etc.)
link_parameter_type_flags AS (
    INSERT INTO parameter_flags_junction (parameter_id, flags_id, created_at)
    SELECT
        np.parameter_id,
        f.id,
        NOW()
    FROM new_parameter np
    CROSS JOIN original_parameter op
    CROSS JOIN flags_resource f
    WHERE f.name = 'parameter_simulation' AND op.simulation_parameter = TRUE
    ON CONFLICT (parameter_id, flags_id) DO NOTHING
),
link_parameter_document_flag AS (
    INSERT INTO parameter_flags_junction (parameter_id, flags_id, created_at)
    SELECT
        np.parameter_id,
        f.id,
        NOW()
    FROM new_parameter np
    CROSS JOIN original_parameter op
    CROSS JOIN flags_resource f
    WHERE f.name = 'parameter_document' AND op.document_parameter = TRUE
    ON CONFLICT (parameter_id, flags_id) DO NOTHING
),
link_parameter_persona_flag AS (
    INSERT INTO parameter_flags_junction (parameter_id, flags_id, created_at)
    SELECT
        np.parameter_id,
        f.id,
        NOW()
    FROM new_parameter np
    CROSS JOIN original_parameter op
    CROSS JOIN flags_resource f
    WHERE f.name = 'parameter_persona' AND op.persona_parameter = TRUE
    ON CONFLICT (parameter_id, flags_id) DO NOTHING
),
link_parameter_scenario_flag AS (
    INSERT INTO parameter_flags_junction (parameter_id, flags_id, created_at)
    SELECT
        np.parameter_id,
        f.id,
        NOW()
    FROM new_parameter np
    CROSS JOIN original_parameter op
    CROSS JOIN flags_resource f
    WHERE f.name = 'parameter_scenario' AND op.scenario_parameter = TRUE
    ON CONFLICT (parameter_id, flags_id) DO NOTHING
),
link_parameter_video_flag AS (
    INSERT INTO parameter_flags_junction (parameter_id, flags_id, created_at)
    SELECT
        np.parameter_id,
        f.id,
        NOW()
    FROM new_parameter np
    CROSS JOIN original_parameter op
    CROSS JOIN flags_resource f
    WHERE f.name = 'parameter_video' AND op.video_parameter = TRUE
    ON CONFLICT (parameter_id, flags_id) DO NOTHING
),
original_fields AS (
    SELECT
        f.id as original_field_id,
        (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.names_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        (SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.descriptions_id = d.id WHERE fd.field_id = f.id LIMIT 1)
    FROM params x
    JOIN parameter_fields_junction pfj ON pfj.parameter_id = x.parameter_id
    JOIN field_artifact f ON f.id = pfj.field_id
    WHERE EXISTS (SELECT 1 FROM field_flags_junction ff JOIN flags_resource fl ON ff.flags_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'field_active' AND fl.value = true)
),
original_field_departments AS (
    SELECT
        of.original_field_id,
        COALESCE(ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) FILTER (WHERE fd.department_id IS NOT NULL), NULL) as department_ids
    FROM original_fields of
    LEFT JOIN field_departments_junction fd ON fd.field_id = of.original_field_id AND fd.active = true
    GROUP BY of.original_field_id
),
-- Insert field names INTO names_resource table
field_names_resources AS (
    INSERT INTO names_resource (name, created_at)
    SELECT of.name, NOW()
    FROM original_fields of
    WHERE of.name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as names_id, name
),
-- Insert field descriptions INTO descriptions_resource table
field_descriptions_resources AS (
    INSERT INTO descriptions_resource (description, created_at)
    SELECT of.description, NOW()
    FROM original_fields of
    WHERE of.description IS NOT NULL AND of.description != ''
    ON CONFLICT (description) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as descriptions_id, description
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
    INSERT INTO field_names_junction (field_id, names_id, created_at)
    SELECT
        nf.field_id,
        fnr.names_id,
        NOW()
    FROM new_fields nf
    CROSS JOIN original_fields of
    JOIN field_names_resources fnr ON fnr.name = of.name
    ON CONFLICT (field_id, names_id) DO NOTHING
),
-- Link fields to descriptions
link_field_descriptions AS (
    INSERT INTO field_descriptions_junction (field_id, descriptions_id, created_at)
    SELECT
        nf.field_id,
        fdr.descriptions_id,
        NOW()
    FROM new_fields nf
    CROSS JOIN original_fields of
    JOIN field_descriptions_resources fdr ON fdr.description = of.description
    ON CONFLICT (field_id, descriptions_id) DO NOTHING
),
-- Link fields to parameter via parameter_fields_junction junction table
link_fields_to_parameter AS (
    INSERT INTO parameter_fields_junction (parameter_id, field_id, created_at)
    SELECT
        np.parameter_id,
        nf.field_id,
        NOW()
    FROM new_parameter np
    CROSS JOIN new_fields nf
    ON CONFLICT (parameter_id, field_id) DO NOTHING
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
    INSERT INTO field_departments_junction (field_id, departments_id, active, created_at)
    SELECT
        fwd.field_id,
        dept_id::uuid,
        true,
        NOW()
    FROM fields_with_depts fwd
    CROSS JOIN UNNEST(fwd.department_ids) as dept_id
    WHERE fwd.department_ids IS NOT NULL AND array_length(fwd.department_ids, 1) > 0
    ON CONFLICT (field_id, departments_id) DO UPDATE SET
        active = true
)
SELECT
    np.parameter_id,
    op.name::text as original_name,
    ap.actor_name::text as actor_name
FROM new_parameter np
CROSS JOIN original_parameter op
CROSS JOIN actor_profile ap
$$;
