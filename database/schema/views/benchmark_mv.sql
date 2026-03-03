-- Materialized View: benchmark_mv
-- Benchmark-entry-level denormalized context for the benchmark list/cards page.
--
-- Grain: One row per benchmark_entry.id
-- All resource IDs from connection tables, never direct FKs.
-- Benchmark = eval-level parameters (runtime config).
-- Bundle IDs aggregated UP from benchmark_bundle level.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'benchmark_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS benchmark_mv CASCADE;

CREATE MATERIALIZED VIEW benchmark_mv AS
WITH
-- benchmark_entry level connections
eval_agg AS (
    SELECT
        bec.benchmark_id,
        ARRAY_AGG(DISTINCT bec.evals_id ORDER BY bec.evals_id) AS eval_ids
    FROM benchmark_evals_connection bec
    WHERE bec.active = true
    GROUP BY bec.benchmark_id
),
profile_agg AS (
    SELECT
        bpc.benchmark_id,
        ARRAY_AGG(DISTINCT bpc.profiles_id ORDER BY bpc.profiles_id) AS profile_ids
    FROM benchmark_profiles_connection bpc
    WHERE bpc.active = true
    GROUP BY bpc.benchmark_id
),
department_agg AS (
    SELECT
        bdc.benchmark_id,
        ARRAY_AGG(DISTINCT bdc.departments_id ORDER BY bdc.departments_id) AS department_ids
    FROM benchmark_departments_connection bdc
    WHERE bdc.active = true
    GROUP BY bdc.benchmark_id
),
-- benchmark_bundle level (aggregated UP to benchmark_entry)
bundle_agg AS (
    SELECT
        bbe.benchmark_id,
        ARRAY_AGG(DISTINCT bbe.id ORDER BY bbe.id) AS invocation_entry_ids
    FROM invocation_entry bbe
    WHERE bbe.active = true
    GROUP BY bbe.benchmark_id
)
SELECT
    be.id AS benchmark_id,

    -- Filter flags
    be.use_groups,
    be.dynamic,

    -- benchmark_entry level connections
    COALESCE(ev.eval_ids, ARRAY[]::uuid[]) AS eval_ids,
    COALESCE(prof.profile_ids, ARRAY[]::uuid[]) AS profile_ids,
    COALESCE(dep.department_ids, ARRAY[]::uuid[]) AS department_ids,

    -- Aggregated UP from benchmark_bundle level
    COALESCE(bun.invocation_entry_ids, ARRAY[]::uuid[]) AS invocation_entry_ids,

    be.created_at,
    be.updated_at,
    be.active

FROM benchmark_entry be
LEFT JOIN eval_agg ev ON ev.benchmark_id = be.id
LEFT JOIN profile_agg prof ON prof.benchmark_id = be.id
LEFT JOIN department_agg dep ON dep.benchmark_id = be.id
LEFT JOIN bundle_agg bun ON bun.benchmark_id = be.id
WHERE be.active = true
WITH NO DATA;

CREATE UNIQUE INDEX benchmark_mv_pk
    ON benchmark_mv (benchmark_id);

CREATE INDEX benchmark_mv_use_groups_idx
    ON benchmark_mv (use_groups);

CREATE INDEX benchmark_mv_dynamic_idx
    ON benchmark_mv (dynamic);

CREATE INDEX benchmark_mv_eval_ids_gin_idx
    ON benchmark_mv USING GIN (eval_ids);

CREATE INDEX benchmark_mv_department_ids_gin_idx
    ON benchmark_mv USING GIN (department_ids);

CREATE INDEX benchmark_mv_profile_ids_gin_idx
    ON benchmark_mv USING GIN (profile_ids);

REFRESH MATERIALIZED VIEW benchmark_mv;

CREATE MATERIALIZED VIEW benchmark_mv AS
WITH
-- benchmark_entry level connections
eval_agg AS (
    SELECT
        bec.benchmark_id,
        ARRAY_AGG(DISTINCT bec.evals_id ORDER BY bec.evals_id) AS eval_ids
    FROM benchmark_evals_connection bec
    WHERE bec.active = true
    GROUP BY bec.benchmark_id
),
profile_agg AS (
    SELECT
        bpc.benchmark_id,
        ARRAY_AGG(DISTINCT bpc.profiles_id ORDER BY bpc.profiles_id) AS profile_ids
    FROM benchmark_profiles_connection bpc
    WHERE bpc.active = true
    GROUP BY bpc.benchmark_id
),
department_agg AS (
    SELECT
        bdc.benchmark_id,
        ARRAY_AGG(DISTINCT bdc.departments_id ORDER BY bdc.departments_id) AS department_ids
    FROM benchmark_departments_connection bdc
    WHERE bdc.active = true
    GROUP BY bdc.benchmark_id
),
-- benchmark_bundle level (aggregated UP to benchmark_entry)
bundle_agg AS (
    SELECT
        bbe.benchmark_id,
        ARRAY_AGG(DISTINCT bbe.id ORDER BY bbe.id) AS invocation_entry_ids
    FROM invocation_entry bbe
    WHERE bbe.active = true
    GROUP BY bbe.benchmark_id
)
SELECT
    be.id AS benchmark_id,

    -- Filter flags
    be.use_groups,
    be.dynamic,

    -- benchmark_entry level connections
    COALESCE(ev.eval_ids, ARRAY[]::uuid[]) AS eval_ids,
    COALESCE(prof.profile_ids, ARRAY[]::uuid[]) AS profile_ids,
    COALESCE(dep.department_ids, ARRAY[]::uuid[]) AS department_ids,

    -- Aggregated UP from benchmark_bundle level
    COALESCE(bun.invocation_entry_ids, ARRAY[]::uuid[]) AS invocation_entry_ids,

    be.created_at,
    be.updated_at,
    be.active

FROM benchmark_entry be
LEFT JOIN eval_agg ev ON ev.benchmark_id = be.id
LEFT JOIN profile_agg prof ON prof.benchmark_id = be.id
LEFT JOIN department_agg dep ON dep.benchmark_id = be.id
LEFT JOIN bundle_agg bun ON bun.benchmark_id = be.id
WHERE be.active = true
WITH NO DATA;
