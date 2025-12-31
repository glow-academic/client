-- Duplicate rubric with departments, standard groups, and standards in a single transaction
-- Converted to function
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_duplicate_rubric_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_rubric_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_duplicate_rubric_v4(
    original_rubric_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    rubric_id uuid,
    original_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT original_rubric_id AS original_rubric_id, profile_id AS profile_id
),
actor_profile AS (
    SELECT
        x.profile_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
original_rubric AS (
    SELECT 
        id,
        name,
        description,
        points,
        pass_points
    FROM rubrics
    WHERE id = (SELECT original_rubric_id FROM params)
),
original_departments AS (
    SELECT department_id
    FROM rubric_departments
    WHERE rubric_id = (SELECT original_rubric_id FROM params) AND active = true
),
original_groups AS (
    SELECT 
        sg.id,
        sg.name,
        sg.short_name,
        sg.description,
        sg.points,
        sg.pass_points,
        ROW_NUMBER() OVER (ORDER BY rsg.position, sg.name) as group_order
    FROM rubric_standard_groups rsg
    JOIN standard_groups sg ON sg.id = rsg.standard_group_id
    WHERE rsg.rubric_id = (SELECT original_rubric_id FROM params)
      AND rsg.active = true
),
original_standards AS (
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
    RETURNING id as rubric_id
),
link_departments AS (
    INSERT INTO rubric_departments (rubric_id, department_id, active, created_at, updated_at)
    SELECT 
        nr.rubric_id,
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
    INSERT INTO standard_groups (
        name,
        short_name,
        description,
        points,
        pass_points
    )
    SELECT 
        og.name,
        og.short_name,
        og.description,
        og.points,
        og.pass_points
    FROM original_groups og
    RETURNING id, name, short_name, description, points, pass_points
),
link_standard_groups AS (
    INSERT INTO rubric_standard_groups (rubric_id, standard_group_id, position, active, created_at, updated_at)
    SELECT 
        nr.rubric_id,
        nsg.id,
        og.group_order,
        true,
        NOW(),
        NOW()
    FROM new_rubric nr
    CROSS JOIN new_standard_groups nsg
    JOIN original_groups og ON 
        og.name = nsg.name
        AND COALESCE(og.short_name, '') = COALESCE(nsg.short_name, '')
        AND COALESCE(og.description, '') = COALESCE(nsg.description, '')
        AND og.points = nsg.points
        AND og.pass_points = nsg.pass_points
),
new_groups_with_order AS (
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
    SELECT DISTINCT ON (og.id)
        og.id as old_group_id,
        ngwo.id as new_group_id
    FROM original_groups og
    JOIN new_groups_with_order ngwo ON 
        ngwo.name = og.name
        AND COALESCE(ngwo.short_name, '') = COALESCE(og.short_name, '')
        AND COALESCE(ngwo.description, '') = COALESCE(og.description, '')
        AND ngwo.points = og.points
        AND ngwo.pass_points = og.pass_points
        AND ngwo.group_order = og.group_order
    ORDER BY og.id, ngwo.id
),
new_standards AS (
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
SELECT 
    nr.rubric_id,
    or_r.name as original_name,
    ap.actor_name
FROM new_rubric nr
CROSS JOIN original_rubric or_r
CROSS JOIN actor_profile ap
$$;

COMMIT;
