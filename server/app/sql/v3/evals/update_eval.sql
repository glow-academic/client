-- Update eval with optional runs and departments changes
-- Parameters: $1=eval_id, $2=name, $3=description, $4=rubric_id, $5=agent_id (nullable uuid), $6=eval_agent_id (nullable uuid), $7=run_ids (uuid[] | NULL - if provided, replaces all), $8=department_ids (uuid[] | NULL - if provided, replaces all), $9=active (boolean | NULL), $10=dynamic (boolean | NULL), $11=profile_id (uuid)
-- Returns: eval_id, eval_name, actor_name

WITH user_profile AS (
    SELECT
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $11::uuid
),
object_current_departments AS (
    -- Get eval's current active department links
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM eval_departments
    WHERE eval_id = $1::uuid AND active = true
),
user_departments AS (
    -- Get user's departments
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM profile_departments
    WHERE profile_id = $11::uuid AND active = true
),
validate_update_permissions AS (
    -- Validate department permissions for update operation
    SELECT validate_department_update_permissions(
        up.role,
        ocd.department_ids,
        ud.department_ids
    ) as validation_passed
    FROM user_profile up
    CROSS JOIN object_current_departments ocd
    CROSS JOIN user_departments ud
),
actor_profile AS (
    SELECT
        $11::uuid as profile_id,
        up.actor_name
    FROM user_profile up
),
update_eval AS (
    UPDATE evals SET
        name = $2,
        description = $3,
        rubric_id = $4::uuid,
        agent_id = COALESCE($5::uuid, agent_id),
        eval_agent_id = COALESCE($6::uuid, eval_agent_id),
        active = COALESCE($9, active),
        dynamic = COALESCE($10, dynamic),
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as eval_id, name as eval_name
),
-- If department_ids provided, replace all existing department links
remove_existing_dept_links AS (
    DELETE FROM eval_departments
    WHERE eval_id = $1::uuid
    AND $8::uuid[] IS NOT NULL
    AND COALESCE(array_length($8::uuid[], 1), 0) > 0
),
add_new_dept_links AS (
    INSERT INTO eval_departments (eval_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        d_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($8::uuid[]) as d_id
    WHERE $8::uuid[] IS NOT NULL
    AND COALESCE(array_length($8::uuid[], 1), 0) > 0
    ON CONFLICT (eval_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
-- If run_ids provided, replace all existing run links
remove_existing_links AS (
    DELETE FROM eval_runs
    WHERE eval_id = $1::uuid
    AND $7::uuid[] IS NOT NULL
    AND COALESCE(array_length($7::uuid[], 1), 0) > 0
),
add_new_links AS (
    INSERT INTO eval_runs (eval_id, run_id, completed, created_at, updated_at)
    SELECT 
        $1::uuid,
        r_id::uuid,
        false,
        NOW(),
        NOW()
    FROM UNNEST($7::uuid[]) as r_id
    WHERE $7::uuid[] IS NOT NULL
    AND COALESCE(array_length($7::uuid[], 1), 0) > 0
    ON CONFLICT (eval_id, run_id) DO UPDATE SET
        updated_at = NOW()
)
SELECT ue.eval_id, ue.eval_name, ap.actor_name
FROM update_eval ue
CROSS JOIN actor_profile ap

