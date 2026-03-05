-- Agent ID Fetching (Query 2 of Two-Pass Architecture)
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
        WHERE proname = 'api_get_agent_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_agent_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

DROP TYPE IF EXISTS agent_candidate_agent CASCADE;

-- Create function
CREATE OR REPLACE FUNCTION api_get_agent_ids_v4(
    profile_id uuid,
    agent_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or agent junction)
    name_id uuid,
    description_id uuid,
    model_id uuid,
    active_flag_id uuid,
    temperature_level_id uuid,
    reasoning_level_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    tool_ids uuid[],
    voice_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        agent_id AS agent_id,
        draft_id AS draft_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Single-select resource IDs
name_resource_data AS (
    SELECT
        COALESCE(
            (SELECT dn.names_id FROM agent_drafts_names_connection dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT an.name_id FROM agent_names_junction an WHERE an.agent_id = (SELECT agent_id FROM params) LIMIT 1),
            NULL::uuid
        ) as name_id
    FROM params
),
description_resource_data AS (
    SELECT
        COALESCE(
            (SELECT dd.descriptions_id FROM agent_drafts_descriptions_connection dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT ad.description_id FROM agent_descriptions_junction ad WHERE ad.agent_id = (SELECT agent_id FROM params) LIMIT 1),
            NULL::uuid
        ) as description_id
    FROM params
),
model_resource_data AS (
    SELECT
        COALESCE(
            (SELECT ar.model_id
             FROM agents_resource ar
             WHERE ar.id = (SELECT agent_id FROM params)
               AND ar.model_id IS NOT NULL
             LIMIT 1),
            NULL::uuid
        ) as model_id
    FROM params
),
flag_resource_data AS (
    SELECT
        COALESCE(
            (SELECT df.flags_id
             FROM agent_drafts_flags_connection df
             WHERE df.draft_id = (SELECT draft_id FROM params)
             LIMIT 1),
            (SELECT af.flag_id
             FROM agent_flags_junction af
             JOIN flags_resource f ON af.flag_id = f.id
             WHERE af.agent_id = (SELECT agent_id FROM params)
               AND f.name = 'agent_active'
               AND f.value = true
             LIMIT 1),
            NULL::uuid
        ) as active_flag_id
    FROM params
),
temperature_level_resource_data AS (
    SELECT
        COALESCE(
            (SELECT tl.id
             FROM agents_resource ar
             JOIN temperature_levels_resource tl ON tl.temperature = ar.temperature AND tl.active = true
             WHERE ar.id = (SELECT agent_id FROM params)
             LIMIT 1),
            NULL::uuid
        ) as temperature_level_id
    FROM params
),
reasoning_level_resource_data AS (
    SELECT
        COALESCE(
            (SELECT rl.id
             FROM agents_resource ar
             JOIN reasoning_levels_resource rl ON rl.reasoning_level::text = ar.reasoning AND rl.active = true
             WHERE ar.id = (SELECT agent_id FROM params)
             LIMIT 1),
            NULL::uuid
        ) as reasoning_level_id
    FROM params
),
-- Multi-select resource IDs
department_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(dd.departments_id ORDER BY dd.created_at)
             FROM agent_drafts_departments_connection dd
             WHERE dd.draft_id = (SELECT draft_id FROM params)
               AND dd.active = true),
            (SELECT ARRAY_AGG(ad.department_id ORDER BY ad.created_at)
             FROM agent_departments_junction ad
             WHERE ad.agent_id = (SELECT agent_id FROM params)
               AND ad.active = true),
            ARRAY[]::uuid[]
        ) as department_ids
    FROM params
    LIMIT 1
),
tool_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(ttj.tool_id ORDER BY at.created_at)
             FROM agent_tools_junction at
             JOIN tools_resource tr ON tr.id = at.tool_id
             JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
             JOIN tool_artifact t ON t.id = ttj.tool_id
             WHERE at.agent_id = (SELECT agent_id FROM params)
               AND at.active = true
               AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND f.value = true)),
            ARRAY[]::uuid[]
        ) as tool_ids
    FROM params
    LIMIT 1
),
voice_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(v.id ORDER BY v.id)
             FROM agents_resource ar
             JOIN voices_resource v ON v.voice = ANY(ar.voices) AND v.active = true
             WHERE ar.id = (SELECT agent_id FROM params)
               AND ar.voices IS NOT NULL),
            ARRAY[]::uuid[]
        ) as voice_ids
    FROM params
    LIMIT 1
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT model_id FROM model_resource_data) as model_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    (SELECT temperature_level_id FROM temperature_level_resource_data) as temperature_level_id,
    (SELECT reasoning_level_id FROM reasoning_level_resource_data) as reasoning_level_id,

    -- Multi-select resource IDs
    (SELECT department_ids FROM department_ids_data) as department_ids,
    (SELECT tool_ids FROM tool_ids_data) as tool_ids,
    (SELECT voice_ids FROM voice_ids_data) as voice_ids;
$$;
