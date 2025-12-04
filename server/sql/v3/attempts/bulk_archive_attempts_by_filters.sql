-- Bulk archive or unarchive simulation attempts based on filters
-- Parameters (in order):
-- $1: archived (bool) - the archive status to set
-- $2, $3: start_date (datetime), end_date (datetime)
-- $4: profile_id (uuid, optional)
-- $5: cohort_ids (uuid[])
-- $6: department_ids (uuid[])
-- $7: roles (profile_role[])
-- $8: simulationFilters (text[], optional) - ["general", "practice", "archived"]
-- $9: search (text, optional) - searches profile name, simulation name, persona names
-- $10: profileIds filter (uuid[], optional)
-- $11: simulationIds filter (uuid[], optional)
-- $12: scenarioIds filter (uuid[], optional)
-- $13: infiniteMode filter (bool, optional)
-- Returns: count of updated attempts

WITH 
-- Resolve guest-profile-id to actual profile ID
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $4::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND first_name = 'Default' ORDER BY created_at DESC LIMIT 1)
            WHEN $4::text IS NULL OR $4::text = '' THEN NULL::uuid
            ELSE $4::uuid
        END as resolved_profile_id
),
-- Cast roles parameter to help PostgreSQL determine type
roles_param AS (
    SELECT $7::profile_role[] as roles_array
),
-- Get the role of the profileId viewer (for role-based filtering)
history_viewer_role AS (
    SELECT 
        CASE 
            WHEN rpi.resolved_profile_id IS NULL THEN
                CASE 
                    WHEN 'superadmin'::profile_role = ANY($7::profile_role[]) THEN 'superadmin'::text
                    WHEN 'admin'::profile_role = ANY($7::profile_role[]) THEN 'admin'::text
                    WHEN 'instructional'::profile_role = ANY($7::profile_role[]) THEN 'instructional'::text
                    WHEN 'ta'::profile_role = ANY($7::profile_role[]) THEN 'ta'::text
                    ELSE 'guest'::text
                END
            ELSE COALESCE((SELECT role::text FROM profiles WHERE id = rpi.resolved_profile_id), 'guest'::text)
        END::profile_role as role
    FROM resolve_profile_id rpi
),
-- Expanded cohort list: union of provided cohortIds + profileId cohorts
expanded_history_cohort_ids AS (
    SELECT DISTINCT cohort_id
    FROM (
        SELECT unnest($5::uuid[]) as cohort_id
        WHERE cardinality($5::uuid[]) > 0
        UNION
        SELECT cp.cohort_id
        FROM cohort_profiles cp
        JOIN resolve_profile_id rpi ON cp.profile_id = rpi.resolved_profile_id
        WHERE rpi.resolved_profile_id IS NOT NULL
    ) combined
),
-- Filter attempts by date, profile, cohorts, departments, and role hierarchy
history_attempts AS (
    SELECT DISTINCT
        sa.id AS attempt_id,
        sa.simulation_id,
        sa.created_at AS attempt_date,
        sa.archived AS is_archived,
        sa.infinite_mode,
        ap.profile_id,
        sim.title AS simulation_name,
        sim.practice_simulation,
        COALESCE(sdd.department_ids, NULL) as department_ids
    FROM simulation_attempts sa
    JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = TRUE
    JOIN simulations sim ON sim.id = sa.simulation_id
    JOIN profiles p_attempt ON p_attempt.id = ap.profile_id
    CROSS JOIN history_viewer_role hvr
    LEFT JOIN (
        SELECT 
            sd.simulation_id,
            ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
        FROM simulation_departments sd
        WHERE sd.active = true
        GROUP BY sd.simulation_id
    ) sdd ON sdd.simulation_id = sim.id
    WHERE sa.created_at >= $2
      AND sa.created_at <= $3
      -- Simulation type filtering
      AND (
        ($8::text[] IS NULL OR cardinality($8::text[]) = 0) AND sim.practice_simulation = FALSE
        OR
        ($8::text[] IS NOT NULL AND cardinality($8::text[]) > 0 AND (
          ('general' = ANY($8::text[]) AND sim.practice_simulation = FALSE) OR
          ('practice' = ANY($8::text[]) AND sim.practice_simulation = TRUE) OR
          ('archived' = ANY($8::text[]) AND sa.archived = TRUE)
        ))
      )
      -- Exclude archived attempts unless 'archived' is explicitly in the filter list
      AND (
        $8::text[] IS NULL OR cardinality($8::text[]) = 0 OR 'archived' = ANY($8::text[]) OR sa.archived = FALSE
      )
      -- Only filter by profileId if provided
      AND (($4::text IS NULL OR $4::text = '' OR $4::text = 'guest-profile-id') OR ap.profile_id = CASE WHEN $4::text = 'guest-profile-id' THEN (SELECT id::uuid FROM profiles WHERE role = 'guest' AND first_name = 'Default' ORDER BY created_at DESC LIMIT 1) ELSE $4::uuid END)
      AND (cardinality($6::uuid[]) = 0 OR sdd.department_ids IS NULL OR sdd.department_ids && $6::uuid[]::text[])
      -- Role hierarchy filtering
      AND (
        hvr.role = 'superadmin' OR
        (hvr.role = 'admin' AND p_attempt.role IN ('admin', 'instructional', 'ta', 'guest')) OR
        (hvr.role = 'instructional' AND p_attempt.role IN ('instructional', 'ta', 'guest')) OR
        (hvr.role = 'ta' AND p_attempt.role IN ('ta', 'guest')) OR
        (hvr.role = 'guest' AND p_attempt.role = 'guest')
      )
),
-- Get cohorts for each attempt's profile
history_attempt_cohorts AS (
    SELECT
        ha.attempt_id,
        COALESCE(ARRAY_AGG(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL AND cs.simulation_id = ha.simulation_id), ARRAY[]::uuid[]) AS cohort_ids
    FROM history_attempts ha
    LEFT JOIN cohort_profiles cp ON cp.profile_id = ha.profile_id
    LEFT JOIN cohorts c ON c.id = cp.cohort_id AND c.active = TRUE
    LEFT JOIN cohort_simulations cs ON cs.cohort_id = c.id
    WHERE (
        (SELECT COUNT(*) FROM expanded_history_cohort_ids) = 0
        OR c.id IN (SELECT cohort_id FROM expanded_history_cohort_ids)
    )
    GROUP BY ha.attempt_id
),
-- Filter attempts by cohort membership
history_attempts_filtered AS (
    SELECT ha.*
    FROM history_attempts ha
    JOIN history_attempt_cohorts hac ON hac.attempt_id = ha.attempt_id
    WHERE (
        (SELECT COUNT(*) FROM expanded_history_cohort_ids) = 0
        OR cardinality(hac.cohort_ids) > 0
    )
),
-- Apply additional filters (profileIds, simulationIds, scenarioIds, infiniteMode)
history_attempts_with_filters AS (
    SELECT haf.*
    FROM history_attempts_filtered haf
    WHERE 
        (cardinality($10::uuid[]) = 0 OR haf.profile_id = ANY($10::uuid[]))
        AND (cardinality($11::uuid[]) = 0 OR haf.simulation_id = ANY($11::uuid[]))
        AND ($13::bool IS NULL OR haf.infinite_mode = $13::bool)
),
-- Get scenario IDs for each attempt (for scenario filtering)
attempt_scenario_ids AS (
    SELECT DISTINCT
        ac.attempt_id,
        ARRAY_AGG(DISTINCT sc.scenario_id) FILTER (WHERE sc.scenario_id IS NOT NULL) AS scenario_ids
    FROM attempt_chats ac
    JOIN chats sc ON sc.id = ac.chat_id
    WHERE ac.attempt_id IN (SELECT attempt_id FROM history_attempts_with_filters)
    GROUP BY ac.attempt_id
),
-- Apply scenario filter
history_attempts_final AS (
    SELECT haf.*
    FROM history_attempts_with_filters haf
    LEFT JOIN attempt_scenario_ids asi ON asi.attempt_id = haf.attempt_id
    WHERE 
        (cardinality($12::uuid[]) = 0 OR asi.scenario_ids IS NULL OR asi.scenario_ids && $12::uuid[])
),
-- Get personas for search filtering
history_personas AS (
    SELECT
        ac.attempt_id,
        array_agg(DISTINCT sp.persona_id) FILTER (WHERE sp.persona_id IS NOT NULL) AS persona_ids
    FROM attempt_chats ac
    JOIN chats sc ON sc.id = ac.chat_id
    JOIN scenarios scn ON scn.id = sc.scenario_id
    LEFT JOIN scenario_personas sp ON sp.scenario_id = scn.id AND sp.active = TRUE
    WHERE ac.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    GROUP BY ac.attempt_id
),
-- Apply search filter (searches profile name, simulation name, persona names)
final_filtered_attempts AS (
    SELECT haf.attempt_id
    FROM history_attempts_final haf
    LEFT JOIN profiles p ON p.id = haf.profile_id
    LEFT JOIN history_personas hp ON hp.attempt_id = haf.attempt_id
    WHERE 
        ($9::text IS NULL OR $9::text = '' OR
         LOWER(p.first_name || ' ' || p.last_name) LIKE '%' || LOWER($9::text) || '%' OR
         LOWER(haf.simulation_name) LIKE '%' || LOWER($9::text) || '%' OR
         EXISTS (
             SELECT 1
             FROM unnest(hp.persona_ids) AS pid
             JOIN personas per ON per.id = pid
             WHERE LOWER(per.name) LIKE '%' || LOWER($9::text) || '%'
         ))
),
-- Update attempts matching all filters
-- Only update attempts that need to be changed:
-- - When archiving ($1 = true), only update attempts where archived = false
-- - When unarchiving ($1 = false), only update attempts where archived = true
update_attempts AS (
    UPDATE simulation_attempts
    SET archived = $1
    WHERE id IN (SELECT attempt_id FROM final_filtered_attempts)
      AND archived != $1  -- Only update attempts that need to be changed
    RETURNING id
)
SELECT COUNT(*)::int as updated_count
FROM update_attempts

