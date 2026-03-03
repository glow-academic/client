-- Materialized View: attempt_mv
-- Attempt-level data for attempt detail views.
--
-- Grain: One row per attempt
-- Filter: archived = FALSE only (practice is a column, not a filter)
--
-- Purpose: Provides attempt-level aggregates for parallel fetching
-- Section: ATTEMPT (unified view - both home and practice)
--
-- Dependencies: Only uses _entry and _connection tables

CREATE MATERIALIZED VIEW attempt_mv AS
-- Simple attempt-level data only
-- All aggregates (total_chats, scores, etc.) derived in service layer from chats
WITH
-- Collect scenario_ids per attempt from chats → attempt_chat scenarios
attempt_scenarios AS (
    SELECT
        ac.attempt_id,
        COALESCE(
            ARRAY_AGG(DISTINCT csc.scenarios_id ORDER BY csc.scenarios_id)
            FILTER (WHERE csc.scenarios_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS scenario_ids
    FROM attempt_chat_entry c
    JOIN attempt_chat_bridge_entry ac ON ac.attempt_chat_id = c.id
    JOIN attempt_entry a2 ON a2.id = ac.attempt_id AND a2.active = TRUE
    LEFT JOIN chat_scenarios_connection csc
        ON csc.chat_id = c.chat_id AND csc.active = TRUE
    WHERE c.active = TRUE
    GROUP BY ac.attempt_id
)
SELECT
    -- Primary key
    a.id AS attempt_id,

    -- Resource IDs (derived from parent home/practice connections)
    COALESCE(home_sim.simulations_id, prac_sim.simulations_id) AS simulation_id,
    apc.profiles_id AS profile_id,
    a.user_persona_id,
    apper.personas_id AS personas_id,
    COALESCE(home_coh.cohorts_id, prac_coh.cohorts_id) AS cohort_id,
    COALESCE(home_dep.departments_id, prac_dep.departments_id) AS department_id,

    -- Practice flag (derived from which bridge table has a row)
    (ape.attempt_id IS NOT NULL) AS practice,

    -- Attempt timestamps and flags
    a.created_at AS attempt_created_at,
    COALESCE(a.infinite_mode, FALSE) AS infinite_mode,
    COALESCE(a.num_chats, 1) AS num_chats,

    -- Archived flag (for filtering archived attempts)
    COALESCE(sa_archive.archived, FALSE) AS is_archived,

    -- Scenario IDs (for filtering and display)
    COALESCE(ascn.scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,

    -- Training context (for socket handlers — replaces inline SQL_ATTEMPT_CONTEXT)
    training_ctx.chat_entry_id,
    training_ctx.attempt_chat_id

FROM attempt_entry a
-- Profile (via attempt_profiles_connection)
JOIN attempt_profiles_connection apc ON apc.attempt_id = a.id AND apc.active = true
-- Persona (via personas_entry → personas_personas_connection)
LEFT JOIN personas_personas_connection apper ON apper.personas_entry_id = a.user_persona_id AND apper.active = true
-- Parent bridges
LEFT JOIN attempt_home_entry ahe ON ahe.attempt_id = a.id AND ahe.active = true
LEFT JOIN attempt_practice_entry ape ON ape.attempt_id = a.id AND ape.active = true
-- Derive simulation/cohort/department from parent home/practice connections
LEFT JOIN home_simulations_connection home_sim ON home_sim.home_id = ahe.home_id AND home_sim.active = true
LEFT JOIN practice_simulations_connection prac_sim ON prac_sim.practice_id = ape.practice_id AND prac_sim.active = true
LEFT JOIN home_cohorts_connection home_coh ON home_coh.home_id = ahe.home_id AND home_coh.active = true
LEFT JOIN practice_cohorts_connection prac_coh ON prac_coh.practice_id = ape.practice_id AND prac_coh.active = true
LEFT JOIN home_departments_connection home_dep ON home_dep.home_id = ahe.home_id AND home_dep.active = true
LEFT JOIN practice_departments_connection prac_dep ON prac_dep.practice_id = ape.practice_id AND prac_dep.active = true
-- Scenario IDs (optional)
LEFT JOIN attempt_scenarios ascn ON ascn.attempt_id = a.id
-- Training context: resolve chat_entry_id + attempt_chat_id (LATERAL for 1:1)
LEFT JOIN LATERAL (
    SELECT
        COALESCE(pte.chat_id, hte.chat_id) AS chat_entry_id,
        cr.id AS attempt_chat_id
    FROM (SELECT 1) _dummy
    LEFT JOIN practice_chat_entry pte ON pte.practice_id = ape.practice_id AND pte.active = true
    LEFT JOIN home_chat_entry hte ON hte.home_id = ahe.home_id AND hte.active = true
    LEFT JOIN attempt_chat_bridge_entry ac_ctx ON ac_ctx.attempt_id = a.id
    LEFT JOIN attempt_chat_entry cr ON cr.id = ac_ctx.attempt_chat_id AND cr.active = true
    LIMIT 1
) training_ctx ON true
-- Latest archive state (append-only)
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE a.active = TRUE
WITH NO DATA;
