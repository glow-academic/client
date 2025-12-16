-- Create eval with runs junction table entries and departments in a single transaction
-- Parameters: $1=name, $2=description, $3=rubric_id, $4=agent_id (agent being evaluated), $5=eval_agent_id (agent performing evaluation), $6=run_ids (uuid[]), $7=department_ids (uuid[] | NULL), $8=active (boolean), $9=profile_id (uuid or "guest-profile-id")
-- Returns: eval_id, actor_name

WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $9::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $9::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $9::text IS NULL OR $9::text = '' THEN NULL::uuid
            ELSE $9::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        rpi.resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
new_eval AS (
    INSERT INTO evals (name, description, rubric_id, agent_id, eval_agent_id, active, created_at, updated_at)
    VALUES ($1, $2, $3::uuid, $4::uuid, $5::uuid, COALESCE($8, true), NOW(), NOW())
    RETURNING id::text as eval_id
),
link_departments AS (
    -- Link departments if provided (array may be empty)
    INSERT INTO eval_departments (eval_id, department_id, active, created_at, updated_at)
    SELECT 
        ne.eval_id::uuid,
        d_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_eval ne
    CROSS JOIN UNNEST($7::uuid[]) as d_id
    WHERE $7::uuid[] IS NOT NULL AND COALESCE(array_length($7::uuid[], 1), 0) > 0
    ON CONFLICT (eval_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_runs AS (
    -- Link runs if provided (array may be empty)
    INSERT INTO eval_runs (eval_id, run_id, completed, created_at, updated_at)
    SELECT 
        ne.eval_id::uuid,
        r_id::uuid,
        false,  -- Initially not completed
        NOW(),
        NOW()
    FROM new_eval ne
    CROSS JOIN UNNEST($6::uuid[]) as r_id
    WHERE $6::uuid[] IS NOT NULL AND COALESCE(array_length($6::uuid[], 1), 0) > 0
    ON CONFLICT (eval_id, run_id) DO UPDATE SET
        completed = false,
        updated_at = NOW()
)
SELECT 
    ne.eval_id,
    ap.actor_name
FROM new_eval ne
CROSS JOIN actor_profile ap

