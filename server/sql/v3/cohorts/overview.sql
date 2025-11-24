-- Get cohort overview with roster and simulations
-- Params: $1 = cohort_id
SELECT 
    c.id, c.title, c.description, c.active, c.created_at,
    -- Profiles array (json_agg with ordering)
    COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object(
            'id', p.id,
            'first_name', p.first_name,
            'last_name', p.last_name,
            'emails', COALESCE((SELECT ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) FROM profile_emails pe WHERE pe.profile_id = p.id), ARRAY[]::text[]),
            'primaryEmail', (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1),
            'role', p.role
        ) ORDER BY p.last_name, p.first_name) FILTER (WHERE p.id IS NOT NULL),
        '[]'::jsonb
    ) as roster,
    -- Simulations array (json_agg with filtering)
    COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object(
            'id', s.id,
            'title', s.title,
            'active', s.active,
            'time_limit', COALESCE(
                (SELECT SUM(stl.time_limit_seconds)
                 FROM scenario_time_limits stl
                 JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
                 WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
                0
            )
        )) FILTER (WHERE s.id IS NOT NULL),
        '[]'::jsonb
    ) as simulations
FROM cohorts c
LEFT JOIN cohort_profiles cp ON cp.cohort_id = c.id AND cp.active = true
LEFT JOIN profiles p ON p.id = cp.profile_id
LEFT JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.active = true
LEFT JOIN simulations s ON s.id = cs.simulation_id AND s.active = true
WHERE c.id = $1
GROUP BY c.id, c.title, c.description, c.active, c.created_at;

