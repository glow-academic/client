-- Delete rubric with existence and usage checks in a single transaction
-- Parameters: $1=rubricId, $2=profile_id (uuid or "guest-profile-id")
-- Returns: rubric_id, name, usage_count (or no rows if rubric doesn't exist)
-- If usage_count > 0, rubric is not deleted (caller should raise 400 error)
-- If no rows returned, rubric doesn't exist (caller should raise 404 error)
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $2::uuid AND sdg.active = true
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
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
rubric_info AS (
    -- Check if rubric exists and get usage count
    SELECT 
        r.id,
        r.name,
        (SELECT COUNT(DISTINCT ss.simulation_id) FROM simulation_scenarios ss WHERE ss.rubric_id = r.id AND ss.active = true) as usage_count
    FROM rubrics r
    WHERE r.id = $1::uuid
),
delete_rubric AS (
    -- Delete rubric only if it exists and is not in use (cascade deletes standard_groups and standards)
    DELETE FROM rubrics
    WHERE id IN (
        SELECT id FROM rubric_info WHERE usage_count = 0
    )
    RETURNING id::text as rubric_id
)
-- Return rubric info and usage count (even if not deleted, so caller can determine error)
SELECT 
    ri.id::text as rubric_id,
    ri.name,
    ri.usage_count,
    CASE WHEN dr.rubric_id IS NOT NULL THEN true ELSE false END as deleted
FROM rubric_info ri
LEFT JOIN delete_rubric dr ON dr.rubric_id = ri.id::text

