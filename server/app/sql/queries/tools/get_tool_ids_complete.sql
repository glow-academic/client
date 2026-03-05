-- Tool ID Fetching (Query 2 of Two-Pass Architecture)
-- Returns all resource IDs for parallel resource fetching
-- Agent/tool resolution moved to settings layer in Python

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_tool_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_tool_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop legacy composite type (no longer needed)
DROP TYPE IF EXISTS tool_candidate_agent CASCADE;

-- Create function
CREATE OR REPLACE FUNCTION api_get_tool_ids_v4(
    profile_id uuid,
    tool_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    names_id uuid,
    descriptions_id uuid,
    active_flag_id uuid,

    args_ids uuid[],
    arg_position_ids uuid[],
    args_outputs_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        tool_id AS tool_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
name_resource_data AS (
    SELECT
        COALESCE(
            (SELECT nd.names_id FROM tool_drafts_names_connection nd WHERE nd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT tn.names_id FROM tool_names_junction tn WHERE tn.tool_id = (SELECT tool_id FROM params) AND tn.active = true LIMIT 1)
        ) as names_id
    FROM params
),
description_resource_data AS (
    SELECT
        COALESCE(
            (SELECT dd.descriptions_id FROM tool_drafts_descriptions_connection dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT td.descriptions_id FROM tool_descriptions_junction td WHERE td.tool_id = (SELECT tool_id FROM params) AND td.active = true LIMIT 1)
        ) as descriptions_id
    FROM params
),
flag_resource_data AS (
    SELECT
        COALESCE(
            (SELECT fd.flag_id FROM tool_drafts_flags_connection fd WHERE fd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT tf.flag_id
             FROM tool_flags_junction tf
             JOIN flags_resource f ON tf.flag_id = f.id
             WHERE tf.tool_id = (SELECT tool_id FROM params)
               AND tf.active = true
               AND f.name = 'tool_active'
               AND f.value = TRUE
             LIMIT 1)
        ) as active_flag_id
    FROM params
),
args_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN COALESCE(
                (SELECT ARRAY_AGG(ad.args_id ORDER BY ad.created_at)
                 FROM tool_drafts_args_connection ad
                 WHERE ad.draft_id = (SELECT draft_id FROM params)
                   AND ad.active = true),
                ARRAY[]::uuid[]
            )
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ta.args_id ORDER BY ta.created_at)
                 FROM tool_args_junction ta
                 WHERE ta.tool_id = (SELECT tool_id FROM params)),
                ARRAY[]::uuid[]
            )
        END as args_ids
    FROM params
    LIMIT 1
),
arg_position_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN COALESCE(
                (SELECT ARRAY_AGG(apd.arg_positions_id ORDER BY apd.created_at)
                 FROM tool_drafts_arg_positions_connection apd
                 WHERE apd.draft_id = (SELECT draft_id FROM params)
                   AND apd.active = true),
                ARRAY[]::uuid[]
            )
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(tap.arg_positions_id ORDER BY tap.created_at)
                 FROM tool_arg_positions_junction tap
                 WHERE tap.tool_id = (SELECT tool_id FROM params)
                   AND tap.active = true),
                ARRAY[]::uuid[]
            )
        END as arg_position_ids
    FROM params
    LIMIT 1
),
args_outputs_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN COALESCE(
                (SELECT ARRAY_AGG(dao.args_outputs_id ORDER BY dao.created_at)
                 FROM tool_drafts_args_outputs_connection dao
                 WHERE dao.draft_id = (SELECT draft_id FROM params)
                   AND dao.active = true),
                ARRAY[]::uuid[]
            )
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(tao.args_outputs_id ORDER BY tao.created_at)
                 FROM tool_args_outputs_junction tao
                 WHERE tao.tool_id = (SELECT tool_id FROM params)),
                ARRAY[]::uuid[]
            )
        END as args_outputs_ids
    FROM params
    LIMIT 1
)
SELECT
    (SELECT names_id FROM name_resource_data) as names_id,
    (SELECT descriptions_id FROM description_resource_data) as descriptions_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    (SELECT args_ids FROM args_ids_data) as args_ids,
    (SELECT arg_position_ids FROM arg_position_ids_data) as arg_position_ids,
    (SELECT args_outputs_ids FROM args_outputs_ids_data) as args_outputs_ids
FROM params x;
$$;
