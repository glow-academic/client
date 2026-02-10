-- Provider ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches selected resource IDs, suggestions, and candidate agents.

DO $$
DECLARE
    r RECORD;
BEGIN
    DROP TYPE IF EXISTS provider_candidate_agent CASCADE;

    CREATE TYPE provider_candidate_agent AS (
        agent_id uuid,
        agent_name text,
        tool_resources text[],
        create_tool_ids uuid[],
        link_tool_ids uuid[],
        department_ids uuid[],
        updated_at timestamptz,
        is_mcp boolean
    );

    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_provider_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_provider_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_provider_ids_v4(
    profile_id uuid,
    provider_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    name_id uuid,
    description_id uuid,
    active_flag_id uuid,
    value_id uuid,
    endpoint_id uuid,
    key_id uuid,
    department_ids uuid[],
    providers_id uuid,
    endpoint_suggestion_ids uuid[],
    key_suggestion_ids uuid[],
    candidate_agents provider_candidate_agent[],
    names_has_tools boolean,
    descriptions_has_tools boolean,
    flags_has_tools boolean,
    departments_has_tools boolean,
    values_has_tools boolean,
    endpoints_has_tools boolean,
    keys_has_tools boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        provider_id AS provider_id,
        profile_id AS profile_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
provider_departments_data AS (
    SELECT
        CASE
            WHEN (SELECT provider_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (
                    SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at)
                    FROM provider_departments_junction pd
                    WHERE pd.provider_id = (SELECT provider_id FROM params) AND pd.active = true
                ),
                ARRAY[]::uuid[]
            )
        END AS department_ids
),
name_resource_data AS (
    SELECT
        (
            SELECT pn.name_id
            FROM provider_names_junction pn
            WHERE pn.provider_id = (SELECT provider_id FROM params) AND pn.active = true
            LIMIT 1
        ) AS name_id
),
description_resource_data AS (
    SELECT
        (
            SELECT pd.description_id
            FROM provider_descriptions_junction pd
            WHERE pd.provider_id = (SELECT provider_id FROM params) AND pd.active = true
            LIMIT 1
        ) AS description_id
),
flag_resource_data AS (
    SELECT
        (
            SELECT pf.flag_id
            FROM provider_flags_junction pf
            JOIN flags_resource f ON pf.flag_id = f.id
            WHERE pf.provider_id = (SELECT provider_id FROM params)
              AND f.name = 'provider_active'
              AND pf.value = true
              AND pf.active = true
            LIMIT 1
        ) AS active_flag_id
),
value_resource_data AS (
    SELECT
        (
            SELECT pv.values_id
            FROM provider_values_junction pv
            WHERE pv.provider_id = (SELECT provider_id FROM params) AND pv.active = true
            LIMIT 1
        ) AS value_id
),
endpoint_resource_data AS (
    SELECT
        (
            SELECT pe.endpoint_id
            FROM provider_endpoints_junction pe
            WHERE pe.provider_id = (SELECT provider_id FROM params) AND pe.active = true
            LIMIT 1
        ) AS endpoint_id
),
key_resource_data AS (
    SELECT
        (
            SELECT pk.key_id
            FROM provider_keys_junction pk
            WHERE pk.provider_id = (SELECT provider_id FROM params) AND pk.active = true
            LIMIT 1
        ) AS key_id
),
providers_resource_data AS (
    SELECT
        (
            SELECT ppj.providers_id
            FROM provider_providers_junction ppj
            WHERE ppj.provider_id = (SELECT provider_id FROM params)
            LIMIT 1
        ) AS providers_id
),
endpoint_suggestions_data AS (
    SELECT COALESCE(
        ARRAY_AGG(e.id ORDER BY e.id),
        ARRAY[]::uuid[]
    ) AS endpoint_suggestion_ids
    FROM endpoints_resource e
    WHERE e.active = true
),
key_suggestions_data AS (
    SELECT COALESCE(
        ARRAY_AGG(k.id ORDER BY k.id),
        ARRAY[]::uuid[]
    ) AS key_suggestion_ids
    FROM keys_resource k
    WHERE k.active = true
),
agent_resource_tools AS (
    SELECT
        a.id AS agent_id,
        rt.resource::text AS resource_name,
        ta.id AS tool_id,
        COALESCE(tf_create.value, true) AS is_creatable
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
agent_resource_tool_pairs AS (
    SELECT
        art.agent_id,
        art.resource_name,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = true))[1] AS create_tool_id,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = false))[1] AS link_tool_id
    FROM agent_resource_tools art
    GROUP BY art.agent_id, art.resource_name
),
agent_tool_arrays AS (
    SELECT
        agent_id,
        ARRAY_AGG(resource_name ORDER BY resource_name) AS tool_resources,
        ARRAY_AGG(create_tool_id ORDER BY resource_name) AS create_tool_ids,
        ARRAY_AGG(link_tool_id ORDER BY resource_name) AS link_tool_ids
    FROM agent_resource_tool_pairs
    GROUP BY agent_id
),
candidate_agents_data AS (
    SELECT
        a.id AS agent_id,
        n.name AS agent_name,
        COALESCE(ata.tool_resources, ARRAY[]::text[]) AS tool_resources,
        COALESCE(ata.create_tool_ids, ARRAY[]::uuid[]) AS create_tool_ids,
        COALESCE(ata.link_tool_ids, ARRAY[]::uuid[]) AS link_tool_ids,
        COALESCE(ARRAY_AGG(DISTINCT ad.department_id) FILTER (WHERE ad.department_id IS NOT NULL), ARRAY[]::uuid[]) AS department_ids,
        a.updated_at,
        COALESCE(af_mcp.value, false) AS is_mcp
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
tools_existence_check AS (
    SELECT
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'names'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) AS names_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'descriptions'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) AS descriptions_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'flags'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) AS flags_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'departments'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) AS departments_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'values'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) AS values_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'endpoints'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) AS endpoints_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'keys'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) AS keys_has_tools
)
SELECT
    (SELECT name_id FROM name_resource_data) AS name_id,
    (SELECT description_id FROM description_resource_data) AS description_id,
    (SELECT active_flag_id FROM flag_resource_data) AS active_flag_id,
    (SELECT value_id FROM value_resource_data) AS value_id,
    (SELECT endpoint_id FROM endpoint_resource_data) AS endpoint_id,
    (SELECT key_id FROM key_resource_data) AS key_id,
    (SELECT department_ids FROM provider_departments_data) AS department_ids,
    (SELECT providers_id FROM providers_resource_data) AS providers_id,
    (SELECT endpoint_suggestion_ids FROM endpoint_suggestions_data) AS endpoint_suggestion_ids,
    (SELECT key_suggestion_ids FROM key_suggestions_data) AS key_suggestion_ids,
    (
        SELECT COALESCE(
            ARRAY_AGG(
                ROW(
                    ca.agent_id,
                    ca.agent_name,
                    ca.tool_resources,
                    ca.create_tool_ids,
                    ca.link_tool_ids,
                    ca.department_ids,
                    ca.updated_at,
                    ca.is_mcp
                )::provider_candidate_agent
            ),
            ARRAY[]::provider_candidate_agent[]
        )
        FROM candidate_agents_data ca
    ) AS candidate_agents,
    tec.names_has_tools,
    tec.descriptions_has_tools,
    tec.flags_has_tools,
    tec.departments_has_tools,
    tec.values_has_tools,
    tec.endpoints_has_tools,
    tec.keys_has_tools
FROM params
CROSS JOIN tools_existence_check tec;
$$;
