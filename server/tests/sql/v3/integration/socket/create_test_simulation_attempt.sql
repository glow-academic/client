-- Create a test simulation attempt with all required dependencies
-- Parameters: $1 = profile_id (UUID), $2 = department_id (UUID, optional), $3 = simulation_id (UUID, optional)
-- Returns: attempt_id (UUID), simulation_id (UUID), chat_id (UUID), scenario_id (UUID)
WITH dept AS (
    SELECT COALESCE($2::uuid, (SELECT id FROM departments WHERE active = true LIMIT 1)) AS id
),
rubric AS (
    INSERT INTO rubrics(name, description, points, pass_points, active)
    VALUES ('Test Rubric', 'Test Description', 100, 70, true)
    RETURNING id
),
sim AS (
    INSERT INTO simulations(
        title,
        description,
        active,
        practice_simulation
    )
    SELECT 
        'Test Simulation',
        'Test Description',
        true,
        false
    WHERE $3::uuid IS NULL
    RETURNING id
),
existing_sim AS (
    SELECT $3::uuid as id WHERE $3::uuid IS NOT NULL
),
all_sims AS (
    SELECT id FROM sim
    UNION ALL
    SELECT id FROM existing_sim
),
sim_dept AS (
    INSERT INTO simulation_departments_junction(simulation_id, department_id, active)
    SELECT s.id, d.id, true
    FROM all_sims s, dept d
    WHERE NOT EXISTS (
        SELECT 1 FROM simulation_departments_junction sd 
        WHERE sd.simulation_id = s.id AND sd.department_id = d.id
    )
),
scenario AS (
    INSERT INTO scenarios(name, active)
    VALUES ('Test Scenario', true)
    RETURNING id
),
scenario_tree_entry AS (
    INSERT INTO scenario_tree_entry(parent_id, child_id, active)
    SELECT s.id, s.id, true
    FROM scenario s
),
scenario_dept AS (
    INSERT INTO scenario_departments_junction(scenario_id, department_id, active)
    SELECT s.id, d.id, true
    FROM scenario s, dept d
),
attempt AS (
    INSERT INTO attempts_entry(simulation_id, archived)
    SELECT s.id, false
    FROM all_sims s
    RETURNING id
),
attempt_profile AS (
    INSERT INTO attempt_profiles(attempt_id, profile_id, active)
    SELECT a.id, $1::uuid, true
    FROM attempt a
),
chat AS (
    INSERT INTO chats_entry(title, scenario_id, completed)
    SELECT 'Test Chat', s.id, false
    FROM scenario s
    RETURNING id
),
create_group AS (
    INSERT INTO groups_entry (created_at, updated_at, trace_id)
    VALUES (NOW(), NOW(), 'test-trace-id')
    RETURNING id as group_id
),
link_chat_group AS (
    INSERT INTO chat_groups (chat_id, group_id, created_at, updated_at)
    SELECT c.id, cg.group_id, NOW(), NOW()
    FROM chat c
    CROSS JOIN create_group cg
    RETURNING chat_id
),
link_chat AS (
    INSERT INTO attempt_chats(attempt_id, chat_id)
    SELECT a.id, c.id
    FROM attempt a, chat c
)
SELECT 
    (SELECT id::text FROM attempt LIMIT 1) as attempt_id,
    (SELECT id::text FROM all_sims LIMIT 1) as simulation_id,
    (SELECT id::text FROM chat LIMIT 1) as chat_id,
    (SELECT id::text FROM scenario LIMIT 1) as scenario_id;

