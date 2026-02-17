-- Materialized View: suite_mv
-- Benchmark-bundle-level denormalized context for bundle customization page.
--
-- Grain: One row per suite_entry.id
-- All resource IDs from suite_*_connection tables (12 resources).

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'suite_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS suite_mv CASCADE;

CREATE MATERIALIZED VIEW suite_mv AS
WITH
department_agg AS (
    SELECT
        bbdc.suite_id,
        ARRAY_AGG(DISTINCT bbdc.departments_id ORDER BY bbdc.departments_id) AS department_ids
    FROM suite_departments_connection bbdc
    WHERE bbdc.active = true
    GROUP BY bbdc.suite_id
),
model_agg AS (
    SELECT
        bbmc.suite_id,
        ARRAY_AGG(DISTINCT bbmc.models_id ORDER BY bbmc.models_id) AS model_ids
    FROM suite_models_connection bbmc
    WHERE bbmc.active = true
    GROUP BY bbmc.suite_id
),
prompt_agg AS (
    SELECT
        bbpc.suite_id,
        ARRAY_AGG(DISTINCT bbpc.prompts_id ORDER BY bbpc.prompts_id) AS prompt_ids
    FROM suite_prompts_connection bbpc
    WHERE bbpc.active = true
    GROUP BY bbpc.suite_id
),
instruction_agg AS (
    SELECT
        bbic.suite_id,
        ARRAY_AGG(DISTINCT bbic.instructions_id ORDER BY bbic.instructions_id) AS instruction_ids
    FROM suite_instructions_connection bbic
    WHERE bbic.active = true
    GROUP BY bbic.suite_id
),
voice_agg AS (
    SELECT
        bbvc.suite_id,
        ARRAY_AGG(DISTINCT bbvc.voices_id ORDER BY bbvc.voices_id) AS voice_ids
    FROM suite_voices_connection bbvc
    WHERE bbvc.active = true
    GROUP BY bbvc.suite_id
),
temperature_level_agg AS (
    SELECT
        bbtlc.suite_id,
        ARRAY_AGG(DISTINCT bbtlc.temperature_levels_id ORDER BY bbtlc.temperature_levels_id) AS temperature_level_ids
    FROM suite_temperature_levels_connection bbtlc
    WHERE bbtlc.active = true
    GROUP BY bbtlc.suite_id
),
reasoning_level_agg AS (
    SELECT
        bbrlc.suite_id,
        ARRAY_AGG(DISTINCT bbrlc.reasoning_levels_id ORDER BY bbrlc.reasoning_levels_id) AS reasoning_level_ids
    FROM suite_reasoning_levels_connection bbrlc
    WHERE bbrlc.active = true
    GROUP BY bbrlc.suite_id
),
tool_agg AS (
    SELECT
        bbtc.suite_id,
        ARRAY_AGG(DISTINCT bbtc.tools_id ORDER BY bbtc.tools_id) AS tool_ids
    FROM suite_tools_connection bbtc
    WHERE bbtc.active = true
    GROUP BY bbtc.suite_id
),
key_agg AS (
    SELECT
        bbkc.suite_id,
        ARRAY_AGG(DISTINCT bbkc.keys_id ORDER BY bbkc.keys_id) AS key_ids
    FROM suite_keys_connection bbkc
    WHERE bbkc.active = true
    GROUP BY bbkc.suite_id
),
flag_agg AS (
    SELECT
        bbfc.suite_id,
        ARRAY_AGG(DISTINCT bbfc.flags_id ORDER BY bbfc.flags_id) AS flag_ids
    FROM suite_flags_connection bbfc
    WHERE bbfc.active = true
    GROUP BY bbfc.suite_id
),
name_agg AS (
    SELECT
        bbnc.suite_id,
        ARRAY_AGG(DISTINCT bbnc.names_id ORDER BY bbnc.names_id) AS name_ids
    FROM suite_names_connection bbnc
    WHERE bbnc.active = true
    GROUP BY bbnc.suite_id
),
description_agg AS (
    SELECT
        bbdc2.suite_id,
        ARRAY_AGG(DISTINCT bbdc2.descriptions_id ORDER BY bbdc2.descriptions_id) AS description_ids
    FROM suite_descriptions_connection bbdc2
    WHERE bbdc2.active = true
    GROUP BY bbdc2.suite_id
)
SELECT
    bbe.id AS suite_entry_id,
    bbe.benchmark_id,

    -- Bundle-level resource ID arrays (12 resources)
    COALESCE(dep.department_ids, ARRAY[]::uuid[]) AS department_ids,
    COALESCE(mdl.model_ids, ARRAY[]::uuid[]) AS model_ids,
    COALESCE(pmt.prompt_ids, ARRAY[]::uuid[]) AS prompt_ids,
    COALESCE(ins.instruction_ids, ARRAY[]::uuid[]) AS instruction_ids,
    COALESCE(vce.voice_ids, ARRAY[]::uuid[]) AS voice_ids,
    COALESCE(tmp.temperature_level_ids, ARRAY[]::uuid[]) AS temperature_level_ids,
    COALESCE(rsn.reasoning_level_ids, ARRAY[]::uuid[]) AS reasoning_level_ids,
    COALESCE(tol.tool_ids, ARRAY[]::uuid[]) AS tool_ids,
    COALESCE(ky.key_ids, ARRAY[]::uuid[]) AS key_ids,
    COALESCE(flg.flag_ids, ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(nm.name_ids, ARRAY[]::uuid[]) AS name_ids,
    COALESCE(dsc.description_ids, ARRAY[]::uuid[]) AS description_ids,

    bbe.created_at,
    bbe.updated_at,
    bbe.active

FROM suite_entry bbe
LEFT JOIN department_agg dep ON dep.suite_id = bbe.id
LEFT JOIN model_agg mdl ON mdl.suite_id = bbe.id
LEFT JOIN prompt_agg pmt ON pmt.suite_id = bbe.id
LEFT JOIN instruction_agg ins ON ins.suite_id = bbe.id
LEFT JOIN voice_agg vce ON vce.suite_id = bbe.id
LEFT JOIN temperature_level_agg tmp ON tmp.suite_id = bbe.id
LEFT JOIN reasoning_level_agg rsn ON rsn.suite_id = bbe.id
LEFT JOIN tool_agg tol ON tol.suite_id = bbe.id
LEFT JOIN key_agg ky ON ky.suite_id = bbe.id
LEFT JOIN flag_agg flg ON flg.suite_id = bbe.id
LEFT JOIN name_agg nm ON nm.suite_id = bbe.id
LEFT JOIN description_agg dsc ON dsc.suite_id = bbe.id
WHERE bbe.active = true
WITH NO DATA;

CREATE UNIQUE INDEX suite_mv_pk
    ON suite_mv (suite_entry_id);

CREATE INDEX suite_mv_benchmark_id_idx
    ON suite_mv (benchmark_id);

CREATE INDEX suite_mv_department_ids_gin_idx
    ON suite_mv USING GIN (department_ids);

REFRESH MATERIALIZED VIEW suite_mv;
