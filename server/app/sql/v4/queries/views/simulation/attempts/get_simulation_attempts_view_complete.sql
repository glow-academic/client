-- ============================================================================
-- Query: get_simulation_attempts_view
-- Purpose: Fetch attempt-level data from mv_simulation_attempts with resource JOINs
-- Section: VIEWS/SIMULATION/ATTEMPTS
-- ============================================================================

-- ============================================================================
-- Step 1: Drop existing function
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_simulation_attempts_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_attempts_view_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop existing composite types
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_simulation_attempts_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_simulation_attempts_view_v4_item AS (
    -- Primary key
    attempt_id uuid,

    -- Resource IDs
    simulation_id uuid,
    profile_id uuid,
    cohort_id uuid,
    department_id uuid,

    -- Resource metadata (JOINed)
    simulation_name text,
    profile_name text,
    cohort_name text,
    department_name text,

    -- Practice flag
    practice boolean,

    -- Timestamps
    attempt_created_at timestamptz,

    -- Flags
    infinite_mode boolean,

    -- Aggregates
    total_chats int,
    completed_chats int,
    total_score float,
    all_passed boolean,
    elapsed_seconds int,
    rubric_total_points int,
    rubric_pass_points int,

    -- Array IDs with metadata
    scenario_ids uuid[],
    persona_ids uuid[]
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_simulation_attempts_view_v4(
    attempt_ids uuid[],
    practice_filter boolean DEFAULT NULL,
    profile_id_filter uuid DEFAULT NULL
)
RETURNS TABLE (
    items types.q_get_simulation_attempts_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Parameter normalization
    params AS (
        SELECT
            COALESCE(attempt_ids, ARRAY[]::uuid[]) AS attempt_ids,
            practice_filter AS practice_filter,
            profile_id_filter AS profile_id_filter
    ),
    -- Fetch from MV with filters
    mv_data AS (
        SELECT mv.*
        FROM mv_simulation_attempts mv, params p
        WHERE mv.attempt_id = ANY(p.attempt_ids)
          AND (p.practice_filter IS NULL OR mv.practice = p.practice_filter)
          AND (p.profile_id_filter IS NULL OR mv.profile_id = p.profile_id_filter)
    ),
    -- JOIN resource metadata
    with_resources AS (
        SELECT
            mv.attempt_id,
            mv.simulation_id,
            mv.profile_id,
            mv.cohort_id,
            mv.department_id,
            -- Resource names
            sim.name AS simulation_name,
            prof.name AS profile_name,
            coh.name AS cohort_name,
            dept.name AS department_name,
            -- Flags
            mv.practice,
            mv.attempt_created_at,
            mv.infinite_mode,
            -- Aggregates
            mv.total_chats,
            mv.completed_chats,
            mv.total_score,
            mv.all_passed,
            mv.elapsed_seconds,
            mv.rubric_total_points,
            mv.rubric_pass_points,
            -- Arrays
            mv.scenario_ids,
            mv.persona_ids
        FROM mv_data mv
        LEFT JOIN simulations_resource sim ON sim.id = mv.simulation_id AND sim.active = TRUE
        LEFT JOIN profiles_resource prof ON prof.id = mv.profile_id AND prof.active = TRUE
        LEFT JOIN cohorts_resource coh ON coh.id = mv.cohort_id AND coh.active = TRUE
        LEFT JOIN departments_resource dept ON dept.id = mv.department_id AND dept.active = TRUE
    ),
    -- Aggregate into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    attempt_id,
                    simulation_id,
                    profile_id,
                    cohort_id,
                    department_id,
                    simulation_name,
                    profile_name,
                    cohort_name,
                    department_name,
                    practice,
                    attempt_created_at,
                    infinite_mode,
                    total_chats,
                    completed_chats,
                    total_score,
                    all_passed,
                    elapsed_seconds,
                    rubric_total_points,
                    rubric_pass_points,
                    scenario_ids,
                    persona_ids
                )::types.q_get_simulation_attempts_view_v4_item
                ORDER BY attempt_created_at DESC
            ),
            ARRAY[]::types.q_get_simulation_attempts_view_v4_item[]
        ) AS items
        FROM with_resources
    )
    SELECT items FROM items_agg;
$$;
