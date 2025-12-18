-- Duplicate parameter with items and department links in a single transaction
-- Parameters: $1=original_parameterId, $2=profile_id (uuid)
WITH actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
original_parameter AS (
    SELECT 
        name,
        description,
        COALESCE(simulation_parameter, false) as simulation_parameter,
        COALESCE(document_parameter, false) as document_parameter,
        COALESCE(persona_parameter, false) as persona_parameter,
        COALESCE(scenario_parameter, false) as scenario_parameter,
        COALESCE(video_parameter, false) as video_parameter
    FROM parameters
    WHERE id = $1::uuid
),
new_parameter AS (
    INSERT INTO parameters (
        name,
        description,
        active,
        simulation_parameter,
        document_parameter,
        persona_parameter,
        scenario_parameter,
        video_parameter
    )
    SELECT 
        op.name || ' Copy',
        op.description,
        false,  -- Duplicated parameters are inactive by default
        op.simulation_parameter,
        op.document_parameter,
        op.persona_parameter,
        op.scenario_parameter,
        op.video_parameter
    FROM original_parameter op
    RETURNING id::text as parameter_id
),
original_fields AS (
    SELECT 
        f.id as original_field_id,
        f.name,
        f.description,
        f.value
    FROM parameter_fields fp
    JOIN fields f ON f.id = fp.field_id
    WHERE fp.parameter_id = $1::uuid AND fp.active = true
),
original_field_departments AS (
    SELECT 
        of.original_field_id,
        COALESCE(ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) FILTER (WHERE fd.department_id IS NOT NULL), NULL) as department_ids
    FROM original_fields of
    LEFT JOIN field_departments fd ON fd.field_id = of.original_field_id AND fd.active = true
    GROUP BY of.original_field_id
),
new_fields AS (
    -- Create all fields (duplicates of original fields)
    INSERT INTO fields (
        name,
        description,
        value
    )
    SELECT 
        of.name,
        of.description,
        of.value
    FROM original_fields of
    RETURNING id::text as field_id, name as field_name
),
new_fields_with_order AS (
    -- Add row numbers to new fields for matching
    SELECT 
        field_id,
        field_name,
        ROW_NUMBER() OVER (ORDER BY field_name) as field_row_num
    FROM new_fields
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
link_fields_to_parameter AS (
    -- Link new fields to new parameter via parameter_fields junction
    INSERT INTO parameter_fields (field_id, parameter_id, active, created_at, updated_at)
    SELECT 
        fwd.field_id::uuid,
        np.parameter_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_parameter np
    CROSS JOIN fields_with_depts fwd
    ON CONFLICT (field_id, parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_departments AS (
    -- Link departments to fields if they existed on original (only if dept_ids exist)
    INSERT INTO field_departments (field_id, department_id, active, created_at, updated_at)
    SELECT 
        fwd.field_id::uuid,
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
    op.name as original_name,
    ap.actor_name
FROM new_parameter np
CROSS JOIN original_parameter op
CROSS JOIN actor_profile ap

