-- Get simulation overview with rubric, cohorts, scenarios, and stats
-- Params: $1 = sim_id
WITH stats AS (
    SELECT 
        COUNT(DISTINCT sa.id) as total_attempts,
        COUNT(DISTINCT scg.id) as total_graded,
        SUM(CASE WHEN scg.passed = true THEN 1 ELSE 0 END) as total_passed
    FROM simulation_attempts sa
    LEFT JOIN attempt_chats ac ON ac.attempt_id = sa.id
    LEFT JOIN simulation_chats sc ON sc.id = ac.chat_id
    LEFT JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
    WHERE sa.simulation_id = $1
)
SELECT 
    s.id, s.title, s.active, 
    COALESCE(
        (SELECT SUM(stl.time_limit_seconds)
         FROM scenario_time_limits stl
         JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
         WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
        0
    ) as time_limit, 
    s.created_at,
    jsonb_build_object(
        'id', r.id, 
        'name', r.name, 
        'description', r.description,
        'points', r.points,
        'pass_points', r.pass_points
    ) as rubric,
    COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object(
            'id', c.id,
            'title', c.title,
            'active', c.active
        )) FILTER (WHERE c.id IS NOT NULL),
        '[]'::jsonb
    ) as cohorts,
    COALESCE(
        jsonb_agg(jsonb_build_object(
            'id', sc.id,
            'name', sc.name,
            'problem_statement', ps.problem_statement,
            'position', ss.position
        ) ORDER BY ss.position) FILTER (WHERE sc.id IS NOT NULL),
        '[]'::jsonb
    ) as scenarios,
    st.total_attempts, st.total_graded, st.total_passed
FROM simulations s
LEFT JOIN simulation_scenarios ss_rubric ON ss_rubric.simulation_id = s.id AND ss_rubric.active = true
LEFT JOIN rubrics r ON r.id = ss_rubric.rubric_id
LEFT JOIN cohort_simulations cs ON cs.simulation_id = s.id AND cs.active = true
LEFT JOIN cohorts c ON c.id = cs.cohort_id
LEFT JOIN simulation_scenarios ss ON ss.simulation_id = s.id
LEFT JOIN scenarios sc ON sc.id = ss.scenario_id
LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = sc.id AND sps.active = true
LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
CROSS JOIN stats st
WHERE s.id = $1
GROUP BY s.id, s.title, s.active, s.created_at, r.id, r.name, 
         r.description, r.points, r.pass_points, st.total_attempts, 
         st.total_graded, st.total_passed;

