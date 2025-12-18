-- Update rubric with departments, standard groups, and standards in a single transaction
-- Parameters: $1=rubricId, $2=name, $3=description (nullable), $4=active, $5=points, $6=passPoints, $7=department_ids (nullable text array), $8=standard_groups (JSONB array), $9=profile_id (uuid)
-- Returns: rubric_id, rubric_name, actor_name
WITH actor_profile AS (
    SELECT
        $9::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $9::uuid
),
update_rubric AS (
    UPDATE rubrics SET
        name = $2,
        description = COALESCE($3, ''),
        active = $4,
        points = $5,
        pass_points = $6,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as rubric_id, name as rubric_name
),
replace_departments AS (
    -- Deactivate all existing department links
    UPDATE rubric_departments 
    SET active = false, updated_at = NOW()
    WHERE rubric_id = $1::uuid AND active = true
),
link_departments AS (
    -- Insert new department links if provided (array is never NULL, but may be empty)
    INSERT INTO rubric_departments (rubric_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($7::text[]) as dept_id
    WHERE COALESCE(array_length($7::text[], 1), 0) > 0
    ON CONFLICT (rubric_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
delete_standard_groups AS (
    -- Delete old standard groups (cascade deletes standards)
    DELETE FROM standard_groups WHERE rubric_id = $1::uuid
),
standard_groups_data AS (
    -- Unnest standard groups from JSONB array with ordinality to preserve order
    SELECT 
        $1::uuid as rubric_id,
        (group_data.value->>'name')::text as name,
        NULLIF(group_data.value->>'short_name', '')::text as short_name,
        NULLIF(group_data.value->>'description', '')::text as description,
        (group_data.value->>'points')::int as points,
        (group_data.value->>'passPoints')::int as pass_points,
        COALESCE((group_data.value->>'position')::int, group_data.ordinality) as position,
        COALESCE((group_data.value->>'active')::boolean, true) as active,
        COALESCE(group_data.value->'standards', '[]'::jsonb) as standards_json,
        group_data.ordinality as group_order
    FROM jsonb_array_elements($8::jsonb) WITH ORDINALITY as group_data
    WHERE COALESCE(jsonb_array_length($8::jsonb), 0) > 0
),
new_standard_groups AS (
    -- Create standard groups and return with all attributes for matching
    INSERT INTO standard_groups (
        rubric_id,
        name,
        short_name,
        description,
        points,
        pass_points,
        position,
        active
    )
    SELECT 
        rubric_id,
        name,
        short_name,
        description,
        points,
        pass_points,
        position,
        active
    FROM standard_groups_data
    RETURNING id, rubric_id, name, short_name, description, points, pass_points, position, active
),
standard_groups_with_order AS (
    -- Match created groups back to their standards_json using all attributes
    SELECT DISTINCT ON (nsg.id)
        nsg.id as standard_group_id,
        sgd.standards_json
    FROM new_standard_groups nsg
    JOIN standard_groups_data sgd ON 
        sgd.name = nsg.name 
        AND sgd.rubric_id = nsg.rubric_id
        AND COALESCE(sgd.short_name, '') = COALESCE(nsg.short_name, '')
        AND COALESCE(sgd.description, '') = COALESCE(nsg.description, '')
        AND sgd.points = nsg.points
        AND sgd.pass_points = nsg.pass_points
    ORDER BY nsg.id, sgd.group_order
),
standards_data AS (
    -- Unnest standards from each group's standards array
    SELECT 
        sgwo.standard_group_id,
        (standard_data.value->>'name')::text as name,
        NULLIF(standard_data.value->>'description', '')::text as description,
        (standard_data.value->>'points')::int as points
    FROM standard_groups_with_order sgwo
    CROSS JOIN jsonb_array_elements(sgwo.standards_json) WITH ORDINALITY as standard_data
    WHERE COALESCE(jsonb_array_length(sgwo.standards_json), 0) > 0
),
new_standards AS (
    -- Create standards
    INSERT INTO standards (
        standard_group_id,
        name,
        description,
        points
    )
    SELECT 
        standard_group_id,
        name,
        description,
        points
    FROM standards_data
    RETURNING id
)
SELECT ur.rubric_id, ur.rubric_name, ap.actor_name
FROM update_rubric ur
CROSS JOIN actor_profile ap

