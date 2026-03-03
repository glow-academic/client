-- Provider ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches selected resource IDs, suggestions, and candidate agents.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_provider_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_provider_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

DROP TYPE IF EXISTS provider_candidate_agent CASCADE;

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
    key_suggestion_ids uuid[]
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
    (SELECT key_suggestion_ids FROM key_suggestions_data) AS key_suggestion_ids;
$$;
