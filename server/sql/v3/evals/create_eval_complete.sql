-- Create eval with runs junction table entries in a single transaction
-- Parameters: $1=name, $2=description, $3=rubric_id, $4=agent_id, $5=run_ids (uuid[]), $6=profile_id (uuid or "guest-profile-id")
-- Returns: eval_id
-- Note: Uses agent_id for both agent_id and eval_agent_id (agent being evaluated and agent performing evaluation)

WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $6::uuid AND sdg.active = true
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
            WHEN $6::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $6::text IS NULL OR $6::text = '' THEN NULL::uuid
            ELSE $6::uuid
        END as resolved_profile_id
),
new_eval AS (
    INSERT INTO evals (name, description, rubric_id, agent_id, eval_agent_id, created_at, updated_at)
    VALUES ($1, $2, $3::uuid, $4::uuid, $4::uuid, NOW(), NOW())
    RETURNING id::text as eval_id
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
    CROSS JOIN UNNEST($5::uuid[]) as mr_id
    WHERE COALESCE(array_length($5::uuid[], 1), 0) > 0
    ON CONFLICT (eval_id, run_id) DO UPDATE SET
        completed = false,
        updated_at = NOW()
)
SELECT eval_id FROM new_eval

