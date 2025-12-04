-- Duplicate rubric with departments, standard groups, and standards in a single transaction
-- Parameters: $1=originalRubricId, $2=profile_id (uuid or "guest-profile-id")
-- Returns: rubric_id
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND first_name = 'Default' ORDER BY created_at DESC LIMIT 1)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
original_rubric AS (
    -- Get original rubric data
    SELECT 
        id,
        name,
        description,
        points,
        pass_points
    FROM rubrics
    WHERE id = $1::uuid
),
original_departments AS (
    -- Get original department links
    SELECT department_id
    FROM rubric_departments
    WHERE rubric_id = $1::uuid AND active = true
),
original_groups AS (
    -- Get original standard groups
    SELECT 
        id,
        name,
        short_name,
        description,
        points,
        pass_points,
        ROW_NUMBER() OVER (ORDER BY name) as group_order
    FROM standard_groups
    WHERE rubric_id = $1::uuid
),
original_standards AS (
    -- Get original standards with their group IDs
    SELECT 
        s.id,
        s.standard_group_id,
        s.name,
        s.description,
        s.points,
        og.group_order
    FROM standards s
    JOIN original_groups og ON s.standard_group_id = og.id
    ORDER BY og.group_order, s.name
),
new_rubric AS (
    -- Create duplicate rubric
    INSERT INTO rubrics (
        name,
        description,
        active,
        points,
        pass_points
    )
    SELECT 
        name || ' Copy',
        description,
        false,
        points,
        pass_points
    FROM original_rubric
    RETURNING id::text as rubric_id
),
link_departments AS (
    -- Copy department links if they existed
    INSERT INTO rubric_departments (rubric_id, department_id, active, created_at, updated_at)
    SELECT 
        nr.rubric_id::uuid,
        od.department_id,
        true,
        NOW(),
        NOW()
    FROM new_rubric nr
    CROSS JOIN original_departments od
    WHERE EXISTS (SELECT 1 FROM original_departments)
    ON CONFLICT (rubric_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
new_standard_groups AS (
    -- Create duplicate standard groups
    INSERT INTO standard_groups (
        rubric_id,
        name,
        short_name,
        description,
        points,
        pass_points
    )
    SELECT 
        nr.rubric_id::uuid,
        og.name,
        og.short_name,
        og.description,
        og.points,
        og.pass_points
    FROM new_rubric nr
    CROSS JOIN original_groups og
    RETURNING id, rubric_id, name, short_name, description, points, pass_points
),
new_groups_with_order AS (
    -- Add group_order back to new groups for matching
    SELECT 
        nsg.*,
        og.group_order
    FROM new_standard_groups nsg
    JOIN original_groups og ON 
        og.name = nsg.name
        AND COALESCE(og.short_name, '') = COALESCE(nsg.short_name, '')
        AND COALESCE(og.description, '') = COALESCE(nsg.description, '')
        AND og.points = nsg.points
        AND og.pass_points = nsg.pass_points
),
groups_mapping AS (
    -- Map old group IDs to new group IDs using all attributes
    SELECT DISTINCT ON (og.id)
        og.id as old_group_id,
        ngwo.id as new_group_id
    FROM original_groups og
    JOIN new_groups_with_order ngwo ON 
        ngwo.name = og.name
        AND ngwo.rubric_id = (SELECT rubric_id::uuid FROM new_rubric)
        AND COALESCE(ngwo.short_name, '') = COALESCE(og.short_name, '')
        AND COALESCE(ngwo.description, '') = COALESCE(og.description, '')
        AND ngwo.points = og.points
        AND ngwo.pass_points = og.pass_points
        AND ngwo.group_order = og.group_order
    ORDER BY og.id, ngwo.id
),
new_standards AS (
    -- Create duplicate standards
    INSERT INTO standards (
        standard_group_id,
        name,
        description,
        points
    )
    SELECT 
        gm.new_group_id,
        os.name,
        os.description,
        os.points
    FROM original_standards os
    JOIN groups_mapping gm ON os.standard_group_id = gm.old_group_id
    RETURNING id
)
SELECT rubric_id FROM new_rubric

