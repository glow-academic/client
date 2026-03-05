-- Model ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_model_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_model_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

DROP TYPE IF EXISTS model_candidate_agent CASCADE;

-- Create function
CREATE OR REPLACE FUNCTION api_get_model_ids_v4(
    profile_id uuid,
    model_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or model junction)
    name_id uuid,
    description_id uuid,
    value_id uuid,
    provider_id uuid,

    -- Flag IDs
    active_flag_id uuid,
    modalities_enabled_flag_id uuid,
    temperature_enabled_flag_id uuid,
    pricing_enabled_flag_id uuid,
    voices_enabled_flag_id uuid,
    reasoning_levels_enabled_flag_id uuid,
    qualities_enabled_flag_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    modality_ids uuid[],
    temperature_level_ids uuid[],
    pricing_ids uuid[],
    reasoning_level_ids uuid[],
    quality_ids uuid[],
    voice_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        model_id AS model_id,
        profile_id AS profile_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Single-select resource IDs (canonical only).
name_resource_data AS (
    SELECT
        (SELECT mn.name_id FROM model_names_junction mn WHERE mn.model_id = (SELECT model_id FROM params) LIMIT 1) as name_id
    FROM params
),
description_resource_data AS (
    SELECT
        (SELECT md.description_id FROM model_descriptions_junction md WHERE md.model_id = (SELECT model_id FROM params) LIMIT 1) as description_id
    FROM params
),
value_resource_data AS (
    SELECT
        (SELECT mv.value_id FROM model_values_junction mv WHERE mv.model_id = (SELECT model_id FROM params) LIMIT 1) as value_id
    FROM params
),
provider_resource_data AS (
    SELECT
        (SELECT mpj.providers_id
         FROM model_providers_junction mpj
         WHERE mpj.model_id = (SELECT model_id FROM params) AND mpj.active = true
         LIMIT 1) as provider_id
    FROM params
),
-- Flag IDs
flag_active_data AS (
    SELECT
        (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.name = 'model_active' AND f.value = TRUE LIMIT 1) as active_flag_id
    FROM params
),
flag_modalities_enabled_data AS (
    SELECT
        (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'modalities_enabled'::flag_type AND f.value = TRUE LIMIT 1) as modalities_enabled_flag_id
    FROM params
),
flag_temperature_enabled_data AS (
    SELECT
        (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'temperature_enabled'::flag_type AND f.value = TRUE LIMIT 1) as temperature_enabled_flag_id
    FROM params
),
flag_pricing_enabled_data AS (
    SELECT
        (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'pricing_enabled'::flag_type AND f.value = TRUE LIMIT 1) as pricing_enabled_flag_id
    FROM params
),
flag_voices_enabled_data AS (
    SELECT
        (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'voices_enabled'::flag_type AND f.value = TRUE LIMIT 1) as voices_enabled_flag_id
    FROM params
),
flag_reasoning_levels_enabled_data AS (
    SELECT
        (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'reasoning_levels_enabled'::flag_type AND f.value = TRUE LIMIT 1) as reasoning_levels_enabled_flag_id
    FROM params
),
flag_qualities_enabled_data AS (
    SELECT
        (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'qualities_enabled'::flag_type AND f.value = TRUE LIMIT 1) as qualities_enabled_flag_id
    FROM params
),
-- Multi-select resource IDs
model_departments_data AS (
    SELECT
        CASE
            WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(md.department_id ORDER BY md.created_at)
                 FROM model_departments_junction md
                 WHERE md.model_id = (SELECT model_id FROM params) AND md.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
modality_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(mm.modality_id ORDER BY mr.modality::text)
                 FROM model_modalities_junction mm
                 JOIN modalities_resource mr ON mr.id = mm.modality_id
                 WHERE mm.model_id = (SELECT model_id FROM params)
                 AND mm.active = true AND mr.active = true),
                ARRAY[]::uuid[]
            )
        END as modality_ids
    FROM params
    LIMIT 1
),
temperature_level_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(tl.id ORDER BY tl.temperature)
                 FROM model_temperature_levels_junction mtl
                 JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id
                 WHERE mtl.model_id = (SELECT model_id FROM params)
                 AND mtl.active = true AND tl.active = true),
                ARRAY[]::uuid[]
            )
        END as temperature_level_ids
    FROM params
    LIMIT 1
),
pricing_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pr.id ORDER BY pr.pricing_type, pr.id)
                 FROM model_pricing_junction mp
                 JOIN pricing_resource pr ON pr.id = mp.pricing_id
                 WHERE mp.model_id = (SELECT model_id FROM params)
                 AND mp.active = true AND pr.active = true),
                ARRAY[]::uuid[]
            )
        END as pricing_ids
    FROM params
    LIMIT 1
),
reasoning_level_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(rl.id ORDER BY
                    CASE rl.reasoning_level
                        WHEN 'none' THEN 1
                        WHEN 'minimal' THEN 2
                        WHEN 'low' THEN 3
                        WHEN 'medium' THEN 4
                        WHEN 'high' THEN 5
                    END
                )
                 FROM model_reasoning_levels_junction mrl
                 JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id
                 WHERE mrl.model_id = (SELECT model_id FROM params)
                 AND mrl.active = true AND rl.active = true),
                ARRAY[]::uuid[]
            )
        END as reasoning_level_ids
    FROM params
    LIMIT 1
),
quality_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(qr.id ORDER BY
                    CASE qr.quality
                        WHEN 'low' THEN 1
                        WHEN 'medium' THEN 2
                        WHEN 'high' THEN 3
                    END
                )
                 FROM model_qualities_junction mq
                 JOIN qualities_resource qr ON qr.id = mq.quality_id
                 WHERE mq.model_id = (SELECT model_id FROM params)
                 AND mq.active = true AND qr.active = true),
                ARRAY[]::uuid[]
            )
        END as quality_ids
    FROM params
    LIMIT 1
),
voice_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT model_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(v.id ORDER BY v.voice::text)
                 FROM model_voices_junction mv
                 JOIN voices_resource v ON v.id = mv.voice_id
                 WHERE mv.model_id = (SELECT model_id FROM params)
                 AND v.active = true),
                ARRAY[]::uuid[]
            )
        END as voice_ids
    FROM params
    LIMIT 1
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT value_id FROM value_resource_data) as value_id,
    (SELECT provider_id FROM provider_resource_data) as provider_id,

    -- Flag IDs
    (SELECT active_flag_id FROM flag_active_data) as active_flag_id,
    (SELECT modalities_enabled_flag_id FROM flag_modalities_enabled_data) as modalities_enabled_flag_id,
    (SELECT temperature_enabled_flag_id FROM flag_temperature_enabled_data) as temperature_enabled_flag_id,
    (SELECT pricing_enabled_flag_id FROM flag_pricing_enabled_data) as pricing_enabled_flag_id,
    (SELECT voices_enabled_flag_id FROM flag_voices_enabled_data) as voices_enabled_flag_id,
    (SELECT reasoning_levels_enabled_flag_id FROM flag_reasoning_levels_enabled_data) as reasoning_levels_enabled_flag_id,
    (SELECT qualities_enabled_flag_id FROM flag_qualities_enabled_data) as qualities_enabled_flag_id,

    -- Multi-select resource IDs
    (SELECT department_ids FROM model_departments_data) as department_ids,
    (SELECT modality_ids FROM modality_ids_data) as modality_ids,
    (SELECT temperature_level_ids FROM temperature_level_ids_data) as temperature_level_ids,
    (SELECT pricing_ids FROM pricing_ids_data) as pricing_ids,
    (SELECT reasoning_level_ids FROM reasoning_level_ids_data) as reasoning_level_ids,
    (SELECT quality_ids FROM quality_ids_data) as quality_ids,
    (SELECT voice_ids FROM voice_ids_data) as voice_ids;
$$;
