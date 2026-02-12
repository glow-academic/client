-- Eval ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Drop and recreate composite type for candidate agents
DO $$
BEGIN
    DROP TYPE IF EXISTS eval_candidate_agent CASCADE;

    CREATE TYPE eval_candidate_agent AS (
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

-- Drop and recreate composite types for rubric mappings
DO $$
BEGIN
    DROP TYPE IF EXISTS eval_run_rubric_mapping CASCADE;
    CREATE TYPE eval_run_rubric_mapping AS (
        run_id uuid,
        rubric_ids uuid[]
    );

    DROP TYPE IF EXISTS eval_group_rubric_mapping CASCADE;
    CREATE TYPE eval_group_rubric_mapping AS (
        group_id uuid,
        rubric_ids uuid[]
    );
END $$;

-- Drop function if exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_eval_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_eval_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_eval_ids_v4(
    profile_id uuid,
    eval_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs
    name_id uuid,
    description_id uuid,
    active_flag_id uuid,
    dynamic_flag_id uuid,
    groups_flag_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    rubric_ids uuid[],
    model_run_ids uuid[],
    group_ids uuid[],

    -- Suggestion IDs
    name_suggestions uuid[],
    description_suggestions uuid[],
    department_suggestions uuid[],
    rubric_suggestions uuid[],

    -- Cross-reference mappings
    run_rubrics eval_run_rubric_mapping[],
    group_rubrics eval_group_rubric_mapping[],

    -- Candidate agents (for Python-side agent scoring)
    candidate_agents eval_candidate_agent[],

    -- Tools existence
    names_has_tools boolean,
    descriptions_has_tools boolean,
    flags_has_tools boolean,
    departments_has_tools boolean,
    rubrics_has_tools boolean,

    -- Domain IDs
    name_domain_id uuid,
    description_domain_id uuid,
    flag_domain_id uuid,
    departments_domain_id uuid,
    rubrics_domain_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        eval_id AS eval_id,
        profile_id AS profile_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Single-select: name (draft priority)
name_id_data AS (
    SELECT
        COALESCE(
            (SELECT dn.names_id FROM names_drafts_connection dn WHERE dn.draft_id = (SELECT draft_id FROM (SELECT api_get_eval_ids_v4.draft_id) x) LIMIT 1),
            (SELECT en.name_id FROM eval_names_junction en WHERE en.eval_id = (SELECT eval_id FROM params) LIMIT 1)
        ) as name_id
    FROM params
    LIMIT 1
),
-- Single-select: description (draft priority)
description_id_data AS (
    SELECT
        COALESCE(
            (SELECT dd.descriptions_id FROM descriptions_drafts_connection dd WHERE dd.draft_id = (SELECT draft_id FROM (SELECT api_get_eval_ids_v4.draft_id) x) LIMIT 1),
            (SELECT ed.description_id FROM eval_descriptions_junction ed WHERE ed.eval_id = (SELECT eval_id FROM params) LIMIT 1)
        ) as description_id
    FROM params
    LIMIT 1
),
-- Single-select: active flag (draft priority)
active_flag_id_data AS (
    SELECT
        COALESCE(
            (SELECT df.flags_id FROM flags_drafts_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM (SELECT api_get_eval_ids_v4.draft_id) x) AND f.name = 'active' LIMIT 1),
            (SELECT ef.flag_id FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = 'eval_active' AND ef.value = TRUE LIMIT 1)
        ) as active_flag_id
    FROM params
    LIMIT 1
),
-- Single-select: dynamic flag (draft priority)
dynamic_flag_id_data AS (
    SELECT
        COALESCE(
            (SELECT df.flags_id FROM flags_drafts_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM (SELECT api_get_eval_ids_v4.draft_id) x) AND f.name = 'dynamic' LIMIT 1),
            (SELECT ef.flag_id FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = 'dynamic' AND ef.value = TRUE LIMIT 1)
        ) as dynamic_flag_id
    FROM params
    LIMIT 1
),
-- Single-select: groups flag (draft priority)
groups_flag_id_data AS (
    SELECT
        COALESCE(
            (SELECT df.flags_id FROM flags_drafts_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM (SELECT api_get_eval_ids_v4.draft_id) x) AND f.name = '' LIMIT 1),
            (SELECT ef.flag_id FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = (SELECT eval_id FROM params) AND f.name = '' AND ef.value = TRUE LIMIT 1)
        ) as groups_flag_id
    FROM params
    LIMIT 1
),
-- Multi-select: department IDs
eval_department_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT eval_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ed.department_id ORDER BY ed.created_at)
                 FROM eval_departments_junction ed
                 WHERE ed.eval_id = (SELECT eval_id FROM params) AND ed.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
-- Multi-select: rubric IDs
eval_rubric_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT eval_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(DISTINCT rubric_id)
                 FROM (
                     SELECT rr.rubric_id, err.created_at
                     FROM eval_runs_rubrics_junction err
                     JOIN run_rubrics_resource rr ON rr.id = err.run_rubric_id
                     WHERE err.eval_id = (SELECT eval_id FROM params) AND err.active = true
                     UNION
                     SELECT gr.rubric_id, egr.created_at
                     FROM eval_groups_rubrics_junction egr
                     JOIN group_rubrics_resource gr ON gr.id = egr.group_rubric_id
                     WHERE egr.eval_id = (SELECT eval_id FROM params) AND egr.active = true
                     ORDER BY created_at
                 ) combined),
                ARRAY[]::uuid[]
            )
        END as rubric_ids
    FROM params
    LIMIT 1
),
-- Multi-select: model run IDs (from eval junction or draft)
eval_run_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT eval_id FROM params) IS NULL THEN
                COALESCE(
                    (SELECT ARRAY_AGG(dr.runs_id ORDER BY dr.created_at)
                     FROM runs_drafts_connection dr
                     WHERE dr.draft_id = (SELECT draft_id FROM (SELECT api_get_eval_ids_v4.draft_id) x)),
                    ARRAY[]::uuid[]
                )
            ELSE COALESCE(
                (SELECT ARRAY_AGG(er.run_id ORDER BY er.created_at)
                 FROM eval_runs_junction er
                 WHERE er.eval_id = (SELECT eval_id FROM params) AND er.active = true),
                ARRAY[]::uuid[]
            )
        END as run_ids
    FROM params
    LIMIT 1
),
-- Multi-select: group IDs (from eval junction or draft)
eval_group_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT eval_id FROM params) IS NULL THEN
                COALESCE(
                    (SELECT ARRAY_AGG(dg.groups_id ORDER BY dg.created_at)
                     FROM groups_drafts_connection dg
                     WHERE dg.draft_id = (SELECT draft_id FROM (SELECT api_get_eval_ids_v4.draft_id) x)),
                    ARRAY[]::uuid[]
                )
            ELSE COALESCE(
                (SELECT ARRAY_AGG(eg.group_id ORDER BY eg.created_at)
                 FROM eval_groups_junction eg
                 WHERE eg.eval_id = (SELECT eval_id FROM params) AND eg.active = true),
                ARRAY[]::uuid[]
            )
        END as group_ids
    FROM params
    LIMIT 1
),
-- Name suggestions
name_suggestions_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(en.name_id ORDER BY en.created_at DESC)
             FROM (
                 SELECT DISTINCT en.name_id, MAX(en.created_at) as created_at
                 FROM eval_names_junction en
                 JOIN names_resource n ON n.id = en.name_id
                 WHERE en.name_id IS NOT NULL AND n.name IS NOT NULL AND n.name != ''
                 GROUP BY en.name_id
                 ORDER BY MAX(en.created_at) DESC
                 LIMIT 20
             ) en),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    LIMIT 1
),
-- Description suggestions
description_suggestions_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(ed.description_id ORDER BY ed.created_at DESC)
             FROM (
                 SELECT DISTINCT ed.description_id, MAX(ed.created_at) as created_at
                 FROM eval_descriptions_junction ed
                 JOIN descriptions_resource d ON d.id = ed.description_id
                 WHERE ed.description_id IS NOT NULL AND d.description IS NOT NULL AND d.description != ''
                 GROUP BY ed.description_id
                 ORDER BY MAX(ed.created_at) DESC
                 LIMIT 20
             ) ed),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    LIMIT 1
),
-- Department suggestions
department_suggestions_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(ed.department_id ORDER BY ed.created_at DESC)
             FROM (
                 SELECT DISTINCT ed.department_id, MAX(ed.created_at) as created_at
                 FROM eval_departments_junction ed
                 JOIN departments_resource d ON d.id = ed.department_id
                 WHERE ed.department_id IS NOT NULL AND ed.active = true
                 GROUP BY ed.department_id
                 ORDER BY MAX(ed.created_at) DESC
                 LIMIT 20
             ) ed),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    LIMIT 1
),
-- Rubric suggestions (all valid rubrics)
rubric_suggestions_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(r.id)
             FROM rubrics_resource r
             WHERE EXISTS (
                 SELECT 1 FROM rubric_flags_junction rf JOIN flags_resource f ON rf.flag_id = f.id
                 WHERE rf.rubric_id = r.id AND f.name = 'rubric_active' AND rf.value = true
             )
             AND (
                 EXISTS (
                     SELECT 1 FROM rubric_departments_junction rd
                     WHERE rd.rubric_id = r.id AND rd.active = true
                     AND rd.department_id = ANY(api_get_eval_ids_v4.user_department_ids)
                 )
                 OR NOT EXISTS (
                     SELECT 1 FROM rubric_departments_junction rd2
                     WHERE rd2.rubric_id = r.id AND rd2.active = true
                 )
             )),
            ARRAY[]::uuid[]
        ) as rubric_suggestions
    FROM params
    LIMIT 1
),
-- Run rubric mappings
eval_run_rubrics_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG((sub.runs_id, sub.rubric_ids)::eval_run_rubric_mapping),
            '{}'::eval_run_rubric_mapping[]
        ) as run_rubrics
    FROM (
        SELECT
            rr.runs_id,
            ARRAY_AGG(rr.rubric_id ORDER BY err.created_at) as rubric_ids
        FROM eval_runs_rubrics_junction err
        JOIN run_rubrics_resource rr ON rr.id = err.run_rubric_id
        WHERE err.eval_id = (SELECT eval_id FROM params) AND err.active = true
        GROUP BY rr.runs_id
    ) sub
),
-- Group rubric mappings
eval_group_rubrics_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG((sub.groups_id, sub.rubric_ids)::eval_group_rubric_mapping),
            '{}'::eval_group_rubric_mapping[]
        ) as group_rubrics
    FROM (
        SELECT
            gr.groups_id,
            ARRAY_AGG(gr.rubric_id ORDER BY egr.created_at) as rubric_ids
        FROM eval_groups_rubrics_junction egr
        JOIN group_rubrics_resource gr ON gr.id = egr.group_rubric_id
        WHERE egr.eval_id = (SELECT eval_id FROM params) AND egr.active = true
        GROUP BY gr.groups_id
    ) sub
),
-- Candidate agents: Step 1 - per-agent, per-resource tool IDs with creatable flag
agent_resource_tools AS (
    SELECT
        a.id as agent_id,
        rt.resource::text as resource_name,
        ta.id as tool_id,
        COALESCE(tf_create.value, true) as is_creatable
    FROM agent_artifact a
    JOIN agent_tools_junction atj ON atj.agent_id = a.id AND atj.active = true
    JOIN tools_resource tr ON tr.id = atj.tool_id
    JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    JOIN tool_artifact ta ON ta.id = ttj.tool_id
    JOIN resource_tools_relation rt ON rt.tool_id = ta.id
    JOIN artifact_resources_relation ar ON ar.resource = rt.resource AND ar.artifact = 'eval'::artifact_type
    LEFT JOIN tool_flags_junction tf_active ON tf_active.tool_id = ta.id
    LEFT JOIN flags_resource f_active ON f_active.id = tf_active.flag_id AND f_active.name = 'tool_active'
    LEFT JOIN tool_flags_junction tf_create ON tf_create.tool_id = ta.id
    LEFT JOIN flags_resource f_create ON f_create.id = tf_create.flag_id AND f_create.name = 'tool_creatable'
    LEFT JOIN agent_flags_junction af_agent ON af_agent.agent_id = a.id
    LEFT JOIN flags_resource f_agent ON f_agent.id = af_agent.flag_id AND f_agent.name = 'agent_active'
    WHERE COALESCE(af_agent.value, false) = true
      AND (tf_active.tool_id IS NULL OR COALESCE(f_active.id, NULL) IS NULL OR COALESCE(tf_active.value, false) = true)
),
-- Step 2: Pick one create and one link tool per (agent, resource)
agent_resource_tool_pairs AS (
    SELECT
        art.agent_id,
        art.resource_name,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = true))[1] as create_tool_id,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = false))[1] as link_tool_id
    FROM agent_resource_tools art
    GROUP BY art.agent_id, art.resource_name
),
-- Step 3: Aggregate into aligned arrays
agent_tool_arrays AS (
    SELECT
        agent_id,
        ARRAY_AGG(resource_name ORDER BY resource_name) as tool_resources,
        ARRAY_AGG(create_tool_id ORDER BY resource_name) as create_tool_ids,
        ARRAY_AGG(link_tool_id ORDER BY resource_name) as link_tool_ids
    FROM agent_resource_tool_pairs
    GROUP BY agent_id
),
-- Step 4: Pre-aggregate agent departments
agent_dept_arrays AS (
    SELECT
        ad.agent_id,
        COALESCE(ARRAY_AGG(DISTINCT ad.department_id) FILTER (WHERE ad.department_id IS NOT NULL), ARRAY[]::uuid[]) as department_ids
    FROM agent_departments_junction ad
    WHERE ad.active = true
    GROUP BY ad.agent_id
),
-- Step 5: Build candidate agents
candidate_agents_rows AS (
    SELECT
        a.id as agent_id,
        n.name as agent_name,
        COALESCE(ata.tool_resources, ARRAY[]::text[]) as tool_resources,
        COALESCE(ata.create_tool_ids, ARRAY[]::uuid[]) as create_tool_ids,
        COALESCE(ata.link_tool_ids, ARRAY[]::uuid[]) as link_tool_ids,
        COALESCE(ada.department_ids, ARRAY[]::uuid[]) as department_ids,
        a.updated_at,
        COALESCE(af_mcp.value, false) as is_mcp
    FROM agent_artifact a
    JOIN agent_names_junction anj ON anj.agent_id = a.id
    JOIN names_resource n ON n.id = anj.name_id
    LEFT JOIN agent_tool_arrays ata ON ata.agent_id = a.id
    LEFT JOIN agent_dept_arrays ada ON ada.agent_id = a.id
    LEFT JOIN agent_flags_junction af_active ON af_active.agent_id = a.id
    LEFT JOIN flags_resource f_active ON f_active.id = af_active.flag_id AND f_active.name = 'agent_active'
    LEFT JOIN agent_flags_junction af_mcp ON af_mcp.agent_id = a.id
    LEFT JOIN flags_resource f_mcp ON f_mcp.id = af_mcp.flag_id AND f_mcp.name = 'mcp'
    WHERE COALESCE(af_active.value, false) = true
      AND ata.agent_id IS NOT NULL
      AND (
          NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
          OR EXISTS (SELECT 1 FROM agent_departments_junction ad3 WHERE ad3.agent_id = a.id AND ad3.active = true AND ad3.department_id = ANY(api_get_eval_ids_v4.user_department_ids))
      )
    GROUP BY a.id, n.name, a.updated_at, af_mcp.value, ata.tool_resources, ata.create_tool_ids, ata.link_tool_ids, ada.department_ids
),
candidate_agents_data AS (
    SELECT COALESCE(
        ARRAY_AGG(
            ROW(car.agent_id, car.agent_name, car.tool_resources, car.create_tool_ids, car.link_tool_ids, car.department_ids, car.updated_at, car.is_mcp)::eval_candidate_agent
        ),
        '{}'::eval_candidate_agent[]
    ) as candidate_agents
    FROM candidate_agents_rows car
),
-- Tools existence checks
tools_existence_data AS (
    SELECT
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resource_type
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'descriptions'::resource_type
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'flags'::resource_type
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as flags_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resource_type
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'rubrics'::resource_type
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as rubrics_has_tools
),
-- Domain IDs (from domains_resource table)
domain_ids_data AS (
    SELECT
        (SELECT id FROM domains_resource WHERE resource = 'names'::resource_type AND active = true LIMIT 1) as name_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'descriptions'::resource_type AND active = true LIMIT 1) as description_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'flags'::resource_type AND active = true LIMIT 1) as flag_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'departments'::resource_type AND active = true LIMIT 1) as departments_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'rubrics'::resource_type AND active = true LIMIT 1) as rubrics_domain_id
)
SELECT
    -- Single-select IDs
    (SELECT name_id FROM name_id_data) as name_id,
    (SELECT description_id FROM description_id_data) as description_id,
    (SELECT active_flag_id FROM active_flag_id_data) as active_flag_id,
    (SELECT dynamic_flag_id FROM dynamic_flag_id_data) as dynamic_flag_id,
    (SELECT groups_flag_id FROM groups_flag_id_data) as groups_flag_id,

    -- Multi-select IDs
    COALESCE((SELECT department_ids FROM eval_department_ids_data), ARRAY[]::uuid[]) as department_ids,
    COALESCE((SELECT rubric_ids FROM eval_rubric_ids_data), ARRAY[]::uuid[]) as rubric_ids,
    COALESCE((SELECT run_ids FROM eval_run_ids_data), ARRAY[]::uuid[]) as model_run_ids,
    COALESCE((SELECT group_ids FROM eval_group_ids_data), ARRAY[]::uuid[]) as group_ids,

    -- Suggestion IDs
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE((SELECT department_suggestions FROM department_suggestions_data), ARRAY[]::uuid[]) as department_suggestions,
    COALESCE((SELECT rubric_suggestions FROM rubric_suggestions_data), ARRAY[]::uuid[]) as rubric_suggestions,

    -- Cross-reference mappings
    COALESCE((SELECT run_rubrics FROM eval_run_rubrics_data), '{}'::eval_run_rubric_mapping[]) as run_rubrics,
    COALESCE((SELECT group_rubrics FROM eval_group_rubrics_data), '{}'::eval_group_rubric_mapping[]) as group_rubrics,

    -- Candidate agents
    (SELECT candidate_agents FROM candidate_agents_data) as candidate_agents,

    -- Tools existence
    ted.names_has_tools,
    ted.descriptions_has_tools,
    ted.flags_has_tools,
    ted.departments_has_tools,
    ted.rubrics_has_tools,

    -- Domain IDs
    did.name_domain_id,
    did.description_domain_id,
    did.flag_domain_id,
    did.departments_domain_id,
    did.rubrics_domain_id
FROM params x
CROSS JOIN tools_existence_data ted
CROSS JOIN domain_ids_data did;
$$;
