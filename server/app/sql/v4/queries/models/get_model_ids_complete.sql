-- Model ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Drop and recreate composite type for candidate agents to add tool ID fields
DO $$
BEGIN
    -- Drop the type if it exists (CASCADE will drop dependent functions)
    DROP TYPE IF EXISTS model_candidate_agent CASCADE;

    -- Recreate with new fields for create/link tool IDs
    CREATE TYPE model_candidate_agent AS (
        agent_id uuid,
        agent_name text,
        tool_resources text[],
        create_tool_ids uuid[],
        link_tool_ids uuid[],
        department_ids uuid[],
        updated_at timestamptz,
        is_mcp boolean
    );
END $$;

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
    voice_ids uuid[],

    -- Candidate agents (for Python-side agent scoring)
    candidate_agents model_candidate_agent[],

    -- Tools existence (for Python to compute show_* flags)
    names_has_tools boolean,
    values_has_tools boolean,
    departments_has_tools boolean,
    modalities_has_tools boolean,
    temperature_levels_has_tools boolean,
    pricing_has_tools boolean,
    reasoning_levels_has_tools boolean,
    qualities_has_tools boolean,
    voices_has_tools boolean,

    -- Domain IDs (for domain-based generation)
    name_domain_id uuid,
    description_domain_id uuid,
    value_domain_id uuid,
    provider_domain_id uuid,
    flag_domain_id uuid,
    departments_domain_id uuid,
    modalities_domain_id uuid,
    temperature_levels_domain_id uuid,
    pricing_domain_id uuid,
    reasoning_levels_domain_id uuid,
    qualities_domain_id uuid,
    voices_domain_id uuid
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
        (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.name = 'model_active' AND mf.value = TRUE LIMIT 1) as active_flag_id
    FROM params
),
flag_modalities_enabled_data AS (
    SELECT
        (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'modalities_enabled'::flag_type AND mf.value = TRUE LIMIT 1) as modalities_enabled_flag_id
    FROM params
),
flag_temperature_enabled_data AS (
    SELECT
        (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'temperature_enabled'::flag_type AND mf.value = TRUE LIMIT 1) as temperature_enabled_flag_id
    FROM params
),
flag_pricing_enabled_data AS (
    SELECT
        (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'pricing_enabled'::flag_type AND mf.value = TRUE LIMIT 1) as pricing_enabled_flag_id
    FROM params
),
flag_voices_enabled_data AS (
    SELECT
        (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'voices_enabled'::flag_type AND mf.value = TRUE LIMIT 1) as voices_enabled_flag_id
    FROM params
),
flag_reasoning_levels_enabled_data AS (
    SELECT
        (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'reasoning_levels_enabled'::flag_type AND mf.value = TRUE LIMIT 1) as reasoning_levels_enabled_flag_id
    FROM params
),
flag_qualities_enabled_data AS (
    SELECT
        (SELECT mf.flag_id FROM model_flags_junction mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = (SELECT model_id FROM params) AND f.type = 'qualities_enabled'::flag_type AND mf.value = TRUE LIMIT 1) as qualities_enabled_flag_id
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
                (SELECT ARRAY_AGG(pr.id ORDER BY pr.pricing_type, u.name)
                 FROM model_pricing_junction mp
                 JOIN pricing_resource pr ON pr.id = mp.pricing_id
                 JOIN artifact_units_relation u ON u.id = pr.unit_id
                 WHERE mp.model_id = (SELECT model_id FROM params)
                 AND mp.active = true AND pr.active = true AND u.active = true),
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
),
-- Candidate agents data (for Python-side agent scoring)
-- First get per-agent, per-resource tool IDs with creatable flag
agent_resource_tools AS (
    SELECT
        a.id as agent_id,
        rt.resource::text as resource_name,
        ta.id as tool_id,
        COALESCE(tf_create.value, true) as is_creatable  -- Default true if flag not set
    FROM agent_artifact a
    JOIN agent_tools_junction at ON at.agent_id = a.id AND at.active = true
    JOIN tools_resource tr ON tr.id = at.tool_id
    JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    JOIN tool_artifact ta ON ta.id = ttj.tool_id
    JOIN resource_tools_relation rt ON rt.tool_id = ta.id
    LEFT JOIN tool_flags_junction tf_active ON tf_active.tool_id = ta.id
    LEFT JOIN flags_resource f_active ON f_active.id = tf_active.flag_id AND f_active.name = 'tool_active'
    LEFT JOIN tool_flags_junction tf_create ON tf_create.tool_id = ta.id
    LEFT JOIN flags_resource f_create ON f_create.id = tf_create.flag_id AND f_create.name = 'tool_creatable'
    LEFT JOIN agent_flags_junction af_agent ON af_agent.agent_id = a.id
    LEFT JOIN flags_resource f_agent ON f_agent.id = af_agent.flag_id AND f_agent.name = 'agent_active'
    WHERE COALESCE(af_agent.value, false) = true
      AND (tf_active.tool_id IS NULL OR COALESCE(f_active.id, NULL) IS NULL OR COALESCE(tf_active.value, false) = true)
),
-- Step 1: Pick one create and one link tool per (agent, resource)
agent_resource_tool_pairs AS (
    SELECT
        art.agent_id,
        art.resource_name,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = true))[1] as create_tool_id,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = false))[1] as link_tool_id
    FROM agent_resource_tools art
    GROUP BY art.agent_id, art.resource_name
),
-- Step 2: Aggregate into aligned arrays (all same length, same order)
agent_tool_arrays AS (
    SELECT
        agent_id,
        ARRAY_AGG(resource_name ORDER BY resource_name) as tool_resources,
        ARRAY_AGG(create_tool_id ORDER BY resource_name) as create_tool_ids,
        ARRAY_AGG(link_tool_id ORDER BY resource_name) as link_tool_ids
    FROM agent_resource_tool_pairs
    GROUP BY agent_id
),
candidate_agents_data AS (
    SELECT
        a.id as agent_id,
        n.name as agent_name,
        COALESCE(ata.tool_resources, ARRAY[]::text[]) as tool_resources,
        COALESCE(ata.create_tool_ids, ARRAY[]::uuid[]) as create_tool_ids,
        COALESCE(ata.link_tool_ids, ARRAY[]::uuid[]) as link_tool_ids,
        COALESCE(ARRAY_AGG(DISTINCT ad.department_id) FILTER (WHERE ad.department_id IS NOT NULL), ARRAY[]::uuid[]) as department_ids,
        a.updated_at,
        COALESCE(af_mcp.value, false) as is_mcp
    FROM agent_artifact a
    JOIN agent_names_junction anj ON anj.agent_id = a.id
    JOIN names_resource n ON n.id = anj.name_id
    LEFT JOIN agent_tool_arrays ata ON ata.agent_id = a.id
    LEFT JOIN agent_departments_junction ad ON ad.agent_id = a.id AND ad.active = true
    LEFT JOIN agent_flags_junction af_active ON af_active.agent_id = a.id
    LEFT JOIN flags_resource f_active ON f_active.id = af_active.flag_id AND f_active.name = 'agent_active'
    LEFT JOIN agent_flags_junction af_mcp ON af_mcp.agent_id = a.id
    LEFT JOIN flags_resource f_mcp ON f_mcp.id = af_mcp.flag_id AND f_mcp.name = 'mcp'
    WHERE COALESCE(af_active.value, false) = true
      AND (
          NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
          OR EXISTS (SELECT 1 FROM agent_departments_junction ad3 WHERE ad3.agent_id = a.id AND ad3.active = true AND ad3.department_id = ANY(user_department_ids))
      )
    GROUP BY a.id, n.name, a.updated_at, af_mcp.value, ata.tool_resources, ata.create_tool_ids, ata.link_tool_ids
),
-- Tools existence check
tools_existence_check AS (
    SELECT
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'names'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as names_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'values'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as values_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'departments'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as departments_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'modalities'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as modalities_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'temperature_levels'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as temperature_levels_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'pricing'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as pricing_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'reasoning_levels'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as reasoning_levels_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'qualities'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as qualities_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'voices'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as voices_has_tools
    FROM params x
),
-- Domain IDs from domains_resource table
domain_ids_data AS (
    SELECT
        (SELECT id FROM domains_resource WHERE resource = 'names'::resource_type AND active = true LIMIT 1) as name_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'descriptions'::resource_type AND active = true LIMIT 1) as description_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'values'::resource_type AND active = true LIMIT 1) as value_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'providers'::resource_type AND active = true LIMIT 1) as provider_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'flags'::resource_type AND active = true LIMIT 1) as flag_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'departments'::resource_type AND active = true LIMIT 1) as departments_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'modalities'::resource_type AND active = true LIMIT 1) as modalities_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'temperature_levels'::resource_type AND active = true LIMIT 1) as temperature_levels_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'pricing'::resource_type AND active = true LIMIT 1) as pricing_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'reasoning_levels'::resource_type AND active = true LIMIT 1) as reasoning_levels_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'qualities'::resource_type AND active = true LIMIT 1) as qualities_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'voices'::resource_type AND active = true LIMIT 1) as voices_domain_id
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
    (SELECT voice_ids FROM voice_ids_data) as voice_ids,

    -- Candidate agents (for Python-side agent scoring)
    (SELECT COALESCE(
        ARRAY_AGG(ROW(ca.agent_id, ca.agent_name, ca.tool_resources, ca.create_tool_ids, ca.link_tool_ids, ca.department_ids, ca.updated_at, ca.is_mcp)::model_candidate_agent),
        ARRAY[]::model_candidate_agent[]
    ) FROM candidate_agents_data ca) as candidate_agents,

    -- Tools existence
    tec.names_has_tools,
    tec.values_has_tools,
    tec.departments_has_tools,
    tec.modalities_has_tools,
    tec.temperature_levels_has_tools,
    tec.pricing_has_tools,
    tec.reasoning_levels_has_tools,
    tec.qualities_has_tools,
    tec.voices_has_tools,

    -- Domain IDs
    did.name_domain_id,
    did.description_domain_id,
    did.value_domain_id,
    did.provider_domain_id,
    did.flag_domain_id,
    did.departments_domain_id,
    did.modalities_domain_id,
    did.temperature_levels_domain_id,
    did.pricing_domain_id,
    did.reasoning_levels_domain_id,
    did.qualities_domain_id,
    did.voices_domain_id
FROM params x
CROSS JOIN tools_existence_check tec
CROSS JOIN domain_ids_data did;
$$;
