-- Duplicate rubric with departments, standard view_groups_entry, and standards in a single transaction
-- Converted to function
-- Uses safe drop/recreate pattern: drop function first, then recreate
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
        COALESCE(COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
original_rubric AS (
    SELECT 
        r.id,
        (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1) as name,
        (SELECT d.description FROM rubric_descriptions_junction rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1) as description,
        (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'total'::point_type LIMIT 1) as points,
        (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'pass'::point_type LIMIT 1) as pass_points
    FROM rubric_artifact r
    WHERE r.id = (SELECT original_rubric_id FROM params)
),
original_departments AS (
    SELECT department_id
    FROM rubric_departments_junction
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
    FROM rubric_standard_groups_junction rsg
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id
    WHERE rsg.rubric_id = (SELECT original_rubric_id FROM params)
      AND rsg.active = true
),
original_standards AS (
    SELECT 
        s.id,
        s.standard_group_id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
        (SELECT (SELECT d.description FROM document_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1),
        s.points,
        og.group_order
    FROM standards_resource s
    JOIN original_groups og ON s.standard_group_id = og.id
    ORDER BY og.group_order, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1)
),
-- Insert name INTO names_resource table
new_name_resource AS (
    INSERT INTO names_resource (name, created_at)
    SELECT name || ' Copy', NOW()
    FROM original_rubric
    WHERE name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as name_id
),
-- Insert description INTO descriptions_resource table
new_description_resource AS (
    INSERT INTO descriptions_resource (description, created_at)
    SELECT description, NOW()
    FROM original_rubric
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as description_id
),
-- Get or create points (points table may not have unique constraint on value)
existing_points AS (
    SELECT p.id as points_id, or_r.points as points_value
    FROM original_rubric or_r
    LEFT JOIN points_resource p ON p.value = or_r.points
    WHERE or_r.points IS NOT NULL
),
new_points_insert AS (
    INSERT INTO points_resource (value, created_at)
    SELECT points_value, NOW()
    FROM existing_points
    WHERE points_id IS NULL
    RETURNING id as points_id, value as points_value
),
all_points AS (
    SELECT points_id, points_value FROM existing_points WHERE points_id IS NOT NULL
    UNION ALL
    SELECT points_id, points_value FROM new_points_insert
),
-- Get or create pass_points
existing_pass_points AS (
    SELECT p.id as pass_points_id, or_r.pass_points as pass_points_value
    FROM original_rubric or_r
    LEFT JOIN points_resource p ON p.value = or_r.pass_points
    WHERE or_r.pass_points IS NOT NULL
),
new_pass_points_insert AS (
    INSERT INTO points_resource (value, created_at)
    SELECT pass_points_value, NOW()
    FROM existing_pass_points
    WHERE pass_points_id IS NULL
    RETURNING id as pass_points_id, value as pass_points_value
),
all_pass_points AS (
    SELECT pass_points_id, pass_points_value FROM existing_pass_points WHERE pass_points_id IS NOT NULL
    UNION ALL
    SELECT pass_points_id, pass_points_value FROM new_pass_points_insert
),
new_rubric AS (
    -- Insert rubric without name/description/active/points/pass_points columns
    INSERT INTO rubric_artifact (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM original_rubric
    RETURNING id as rubric_id
),
-- Link rubric to name
link_rubric_name AS (
    INSERT INTO rubric_names_junction (rubric_id, name_id, created_at)
    SELECT nr.rubric_id, nnr.name_id, NOW()
    FROM new_rubric nr
    CROSS JOIN new_name_resource nnr
    ON CONFLICT (rubric_id, name_id) DO NOTHING
),
-- Link rubric to description
link_rubric_description AS (
    INSERT INTO rubric_descriptions_junction (rubric_id, description_id, created_at)
    SELECT nr.rubric_id, ndr.description_id, NOW()
    FROM new_rubric nr
    CROSS JOIN new_description_resource ndr
    ON CONFLICT (rubric_id, description_id) DO NOTHING
),
-- Link rubric active flag (set to false for duplicate)
link_rubric_active_flag AS (
    INSERT INTO rubric_flags_junction (rubric_id, flag_id, value, created_at) SELECT nr.rubric_id,
        f.id,
        FALSE,
        NOW()
    FROM new_rubric nr
    CROSS JOIN flags_resource f
    WHERE f.name = 'rubric_active'
    ON CONFLICT (rubric_id, flag_id) DO UPDATE SET 
        value = FALSE
),
-- Link rubric points
link_rubric_points AS (
    INSERT INTO rubric_points_junction (rubric_id, point_id, type, created_at)
    SELECT nr.rubric_id, ap.points_id, 'total'::point_type, NOW()
    FROM new_rubric nr
    CROSS JOIN all_points ap
    ON CONFLICT (rubric_id, point_id, type) DO NOTHING
),
-- Link rubric pass_points
link_rubric_pass_points AS (
    INSERT INTO rubric_points_junction (rubric_id, point_id, type, created_at)
    SELECT nr.rubric_id, app.pass_points_id, 'pass'::point_type, NOW()
    FROM new_rubric nr
    CROSS JOIN all_pass_points app
    ON CONFLICT (rubric_id, point_id, type) DO NOTHING
),
link_departments AS (
    INSERT INTO rubric_departments_junction (rubric_id, department_id, active, created_at)
    SELECT 
        nr.rubric_id,
        od.department_id,
        true,
        NOW()
    FROM new_rubric nr
    CROSS JOIN original_departments od
    WHERE EXISTS (SELECT 1 FROM original_departments)
    ON CONFLICT (rubric_id, department_id) DO UPDATE SET
        active = true
),
new_standard_groups AS (
    INSERT INTO standard_groups_resource (
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
    INSERT INTO rubric_standard_groups_junction (rubric_id, standard_group_id, position, active, created_at)
    SELECT 
        nr.rubric_id,
        nsg.id,
        og.group_order,
        true,
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
standard_call_context AS (
    SELECT tcj.tool_id, 1 as priority
    FROM view_calls_entry c
    JOIN tool_calls_junction tcj ON tcj.call_id = c.id
    JOIN tool_names_junction tn ON tn.tool_id = tcj.tool_id
    JOIN names_resource n ON tn.name_id = n.id
    WHERE n.name = 'create_standard_group'
    UNION ALL
    SELECT tcj.tool_id, 2 as priority
    FROM view_calls_entry c
    JOIN tool_calls_junction tcj ON tcj.call_id = c.id
    JOIN tool_names_junction tn ON tn.tool_id = tcj.tool_id
    JOIN names_resource n ON tn.name_id = n.id
    WHERE n.name = 'create_rubrics'
    UNION ALL
    SELECT tcj.tool_id, 3 as priority
    FROM view_calls_entry c
    JOIN tool_calls_junction tcj ON tcj.call_id = c.id
),
standard_call_params AS (
    SELECT tool_id
    FROM standard_call_context
    ORDER BY priority
    LIMIT 1
),
standard_calls AS (
    SELECT
        os.id as standard_id,
        uuidv7() as call_id,
        scp.tool_id
    FROM original_standards os
    CROSS JOIN standard_call_params scp
),
insert_standard_calls AS (
    INSERT INTO calls_entry (
        id,
        external_call_id,
        arguments_raw,
        completed,
        created_at,
        updated_at
    )
    SELECT
        sc.call_id,
        'standard_resource_' || sc.standard_id::text || '_' || sc.call_id::text,
        jsonb_build_object(
            'standard_id', sc.standard_id::text,
            'standard_group_id', os.standard_group_id::text
        )::text,
        true,
        NOW(),
        NOW()
    FROM standard_calls sc
    JOIN original_standards os ON os.id = sc.standard_id
    RETURNING id
),
insert_standard_call_tool_junctions AS (
    INSERT INTO tool_calls_junction (tool_id, call_id)
    SELECT sc.tool_id, sc.call_id
    FROM standard_calls sc
    JOIN insert_standard_calls isc ON isc.id = sc.call_id
),
new_standards AS (
    INSERT INTO standards_resource (
        standard_group_id,
        name,
        description,
        points,
        created_at,
        active,
        generated,
        mcp
    )
    SELECT
        gm.new_group_id,
        os.name,
        os.description,
        os.points,
        NOW(),
        true,
        false,
        false
    FROM original_standards os
    JOIN groups_mapping gm ON os.standard_group_id = gm.old_group_id
    JOIN standard_calls sc ON sc.standard_id = os.id
    JOIN insert_standard_calls isc ON isc.id = sc.call_id
    RETURNING id
),
link_standards_calls AS (
    INSERT INTO standards_calls_connection (standards_id, call_id, active, created_at)
    SELECT ns.id, sc.call_id, true, NOW()
    FROM new_standards ns
    JOIN standard_calls sc ON true
    ON CONFLICT (standards_id, call_id) DO NOTHING
)
SELECT 
    nr.rubric_id,
    or_r.name as original_name,
    ap.actor_name
FROM new_rubric nr
CROSS JOIN original_rubric or_r
CROSS JOIN actor_profile ap
$$;
