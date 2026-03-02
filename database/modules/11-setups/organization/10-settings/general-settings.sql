-- Module: Organization Settings
-- Category: setting (organization)
-- Description: Organization Settings setting
-- ============================================================


-- Resource rows
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-3119-7fdf-908e-6a6b9430f085', 'clientId', 'Google Client ID', true, 2, true, '2025-11-23T03:58:01.111026+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.keys_resource (id, key_id, created_at, active, generated, mcp, key, name, description) VALUES ('019b3be4-3321-7f30-989b-3076ba1aa712', '019b3be4-3321-7f30-989b-3076ba1aa712', '2026-02-15T02:02:12.274648+00:00', true, false, false, 'dummy-key-value', 'Google Client ID', '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.auth_item_keys_resource (id, auth_id, key_id, created_at, updated_at, active, generated, mcp, item_id) VALUES ('019c48f5-3ea1-73cf-bfec-bc6f7debc741', '019bb25e-e5e2-73eb-9313-57d774b30875', '019b3be4-3321-7f30-989b-3076ba1aa712', '2026-01-16T00:38:22.970333+00:00', '2026-01-16T00:38:22.970333+00:00', true, false, false, '019b3be4-3119-7fdf-908e-6a6b9430f085') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-3119-7fae-9dea-08a64aff6240', 'clientSecret', 'Google Client Secret', true, 1, true, '2025-11-23T03:58:01.111026+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.keys_resource (id, key_id, created_at, active, generated, mcp, key, name, description) VALUES ('019b3be4-3321-7f34-b17e-9daa65547748', '019b3be4-3321-7f34-b17e-9daa65547748', '2026-02-15T02:02:12.274798+00:00', true, false, false, 'dummy-key-value', 'Google Client Secret', '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.auth_item_keys_resource (id, auth_id, key_id, created_at, updated_at, active, generated, mcp, item_id) VALUES ('019c48f5-3ea1-73dd-a18f-9ca7c72e1a7f', '019bb25e-e5e2-73eb-9313-57d774b30875', '019b3be4-3321-7f34-b17e-9daa65547748', '2026-01-16T00:38:22.970333+00:00', '2026-01-16T00:38:22.970333+00:00', true, false, false, '019b3be4-3119-7fae-9dea-08a64aff6240') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-3119-7ff4-a277-aa213eac5632', 'tenantId', 'Microsoft Tenant ID', false, 3, true, '2025-11-23T04:23:30.295517+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-3119-7ff8-9a20-27a9c8e586d5', 'userInfoUrl', 'Microsoft UserInfo Endpoint', false, 4, true, '2025-11-23T04:41:11.809003+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-7004-bc8a-cd80f62b310e', 'discoveryUrl', 'Microsoft Discovery URL', false, 5, true, '2025-11-23T04:41:11.809003+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-7008-8bba-868f8b70fe13', 'clientAuthMethod', 'Microsoft Client Auth Method', false, 6, true, '2025-11-23T04:41:11.809003+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-700d-8fc0-9ba72a9bd318', 'authorizationUrl', 'Microsoft Authorization Endpoint', false, 7, true, '2025-11-23T04:41:11.809003+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-7014-96a8-573949e45256', 'tokenUrl', 'Microsoft Token Endpoint', false, 8, true, '2025-11-23T04:41:11.809003+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c5801-d003-75de-80fa-9515249c9c6b', 'Settings for the Organization department', '2026-02-13T17:17:19.747282+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c5801-d002-7d04-9dc2-9105beb0a88f', 'Organization Settings', '2026-02-13T17:17:19.746492+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.keys_resource (id, key_id, created_at, active, generated, mcp, key, name, description) VALUES ('019bbdcb-6d52-7889-8484-ed84e9180139', '019bbdcb-6d52-7889-8484-ed84e9180139', '2026-02-15T02:02:12.273323+00:00', true, false, false, 'dummy-key-value', 'OPENAI_API_KEY', 'OPENAI_API_KEY') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.provider_keys_resource (id, provider_id, key_id, created_at, active, generated, mcp, key, name, description) VALUES ('019c441a-0eb9-7665-a01c-a6fec156d716', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '019bbdcb-6d52-7889-8484-ed84e9180139', '2025-12-07T20:37:05.145538+00:00', true, false, false, 'dummy-provider-key-value', 'OPENAI_API_KEY', 'OPENAI_API_KEY') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.keys_resource (id, key_id, created_at, active, generated, mcp, key, name, description) VALUES ('019bbdcb-6d52-7d32-803f-3f5c8c2a9af7', '019bbdcb-6d52-7d32-803f-3f5c8c2a9af7', '2026-02-15T02:02:12.274466+00:00', true, false, false, 'dummy-key-value', 'GEMINI_API_KEY', 'GEMINI_API_KEY') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.provider_keys_resource (id, provider_id, key_id, created_at, active, generated, mcp, key, name, description) VALUES ('019c441a-0eb9-7938-8d65-ccfc25d92856', '019bb2af-b2a8-7035-bbfd-664ba627bd44', '019bbdcb-6d52-7d32-803f-3f5c8c2a9af7', '2025-12-07T20:37:05.145538+00:00', true, false, false, 'dummy-provider-key-value', 'GEMINI_API_KEY', 'GEMINI_API_KEY') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.settings_resource (created_at, active, generated, mcp, id, name, description, department_ids, system_ids, provider_key_ids, auth_ids) VALUES ('2026-02-12T12:11:20.750426+00:00', true, false, false, '019c51c3-5130-734a-b5f4-c7e48130cc99', 'Organization Settings', 'Settings for the Organization department', '{}', '{}', '{}', '{019bb25e-e5e2-73eb-9313-57d774b30875}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- setting_artifact
INSERT INTO public.setting_artifact (created_at, id, updated_at, generated, mcp) VALUES ('2026-02-08T23:18:33.077464+00:00', '019c3f8c-b97c-7fa5-b369-7d7418bedbcf', '2026-02-08T23:18:33.077464+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- setting_auth_item_keys_junction
INSERT INTO public.setting_auth_item_keys_junction (active, created_at, generated, mcp, setting_id, auth_item_keys_id) VALUES (true, '2026-02-13T19:50:33.702587+00:00', false, false, '019c3f8c-b97c-7fa5-b369-7d7418bedbcf', '019c48f5-3ea1-73cf-bfec-bc6f7debc741') ON CONFLICT (setting_id, auth_item_keys_id) DO NOTHING;
INSERT INTO public.setting_auth_item_keys_junction (active, created_at, generated, mcp, setting_id, auth_item_keys_id) VALUES (true, '2026-02-13T19:50:33.702587+00:00', false, false, '019c3f8c-b97c-7fa5-b369-7d7418bedbcf', '019c48f5-3ea1-73dd-a18f-9ca7c72e1a7f') ON CONFLICT (setting_id, auth_item_keys_id) DO NOTHING;
-- setting_auth_values_junction
INSERT INTO public.setting_auth_values_junction (value, created_at, auth_id, auth_item_id, settings_id, generated, mcp, active) VALUES ('common', '2026-02-15T01:21:57.277595+00:00', '019b3be4-3117-7afc-8d1d-a2815d70f294', '019b3be4-3119-7ff4-a277-aa213eac5632', '019c3f8c-b97c-7fa5-b369-7d7418bedbcf', false, false, true) ON CONFLICT (settings_id, auth_id, auth_item_id) DO NOTHING;
INSERT INTO public.setting_auth_values_junction (value, created_at, auth_id, auth_item_id, settings_id, generated, mcp, active) VALUES ('https://graph.microsoft.com/oidc/userinfo', '2026-02-15T01:21:57.277595+00:00', '019b3be4-3117-7afc-8d1d-a2815d70f294', '019b3be4-3119-7ff8-9a20-27a9c8e586d5', '019c3f8c-b97c-7fa5-b369-7d7418bedbcf', false, false, true) ON CONFLICT (settings_id, auth_id, auth_item_id) DO NOTHING;
INSERT INTO public.setting_auth_values_junction (value, created_at, auth_id, auth_item_id, settings_id, generated, mcp, active) VALUES ('https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration', '2026-02-15T01:21:57.277595+00:00', '019b3be4-3117-7afc-8d1d-a2815d70f294', '019b3be4-311a-7004-bc8a-cd80f62b310e', '019c3f8c-b97c-7fa5-b369-7d7418bedbcf', false, false, true) ON CONFLICT (settings_id, auth_id, auth_item_id) DO NOTHING;
INSERT INTO public.setting_auth_values_junction (value, created_at, auth_id, auth_item_id, settings_id, generated, mcp, active) VALUES ('client_secret_post', '2026-02-15T01:21:57.277595+00:00', '019b3be4-3117-7afc-8d1d-a2815d70f294', '019b3be4-311a-7008-8bba-868f8b70fe13', '019c3f8c-b97c-7fa5-b369-7d7418bedbcf', false, false, true) ON CONFLICT (settings_id, auth_id, auth_item_id) DO NOTHING;
INSERT INTO public.setting_auth_values_junction (value, created_at, auth_id, auth_item_id, settings_id, generated, mcp, active) VALUES ('https://login.microsoftonline.com/common/oauth2/v2.0/authorize', '2026-02-15T01:21:57.277595+00:00', '019b3be4-3117-7afc-8d1d-a2815d70f294', '019b3be4-311a-700d-8fc0-9ba72a9bd318', '019c3f8c-b97c-7fa5-b369-7d7418bedbcf', false, false, true) ON CONFLICT (settings_id, auth_id, auth_item_id) DO NOTHING;
INSERT INTO public.setting_auth_values_junction (value, created_at, auth_id, auth_item_id, settings_id, generated, mcp, active) VALUES ('https://login.microsoftonline.com/common/oauth2/v2.0/token', '2026-02-15T01:21:57.277595+00:00', '019b3be4-3117-7afc-8d1d-a2815d70f294', '019b3be4-311a-7014-96a8-573949e45256', '019c3f8c-b97c-7fa5-b369-7d7418bedbcf', false, false, true) ON CONFLICT (settings_id, auth_id, auth_item_id) DO NOTHING;
-- setting_auths_junction
INSERT INTO public.setting_auths_junction (active, created_at, auth_id, settings_id, generated, mcp) VALUES (true, '2026-02-08T23:18:33.077464+00:00', '019bb25e-e5e2-73eb-9313-57d774b30875', '019c3f8c-b97c-7fa5-b369-7d7418bedbcf', false, false) ON CONFLICT (settings_id, auth_id) DO NOTHING;
-- setting_departments_junction
INSERT INTO public.setting_departments_junction (setting_id, department_id, active, created_at, generated, mcp) VALUES ('019c3f8c-b97c-7fa5-b369-7d7418bedbcf', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', true, '2026-02-13T17:17:19.748438+00:00', false, false) ON CONFLICT (setting_id, department_id) DO NOTHING;
-- setting_descriptions_junction
INSERT INTO public.setting_descriptions_junction (setting_id, description_id, created_at, generated, mcp, active) VALUES ('019c3f8c-b97c-7fa5-b369-7d7418bedbcf', '019c5801-d003-75de-80fa-9515249c9c6b', '2026-02-13T17:17:19.748107+00:00', false, false, true) ON CONFLICT (setting_id, description_id) DO NOTHING;
-- setting_flags_junction
INSERT INTO public.setting_flags_junction (setting_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c3f8c-b97c-7fa5-b369-7d7418bedbcf', '019be334-bfc6-717e-9377-b63fc43ae0c6', true, '2026-02-08T23:18:33.077464+00:00', false, false, true) ON CONFLICT (setting_id, flag_id) DO NOTHING;
INSERT INTO public.setting_flags_junction (setting_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c3f8c-b97c-7fa5-b369-7d7418bedbcf', '019b995a-86ef-78fc-adec-fc4db3a87c0d', true, '2026-02-08T23:18:33.077464+00:00', false, false, true) ON CONFLICT (setting_id, flag_id) DO NOTHING;
INSERT INTO public.setting_flags_junction (setting_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c3f8c-b97c-7fa5-b369-7d7418bedbcf', '019bcc4d-d9c6-7a09-b99a-919d8f85cab1', false, '2026-02-08T23:18:33.077464+00:00', false, false, true) ON CONFLICT (setting_id, flag_id) DO NOTHING;
-- setting_names_junction
INSERT INTO public.setting_names_junction (setting_id, name_id, created_at, generated, mcp, active) VALUES ('019c3f8c-b97c-7fa5-b369-7d7418bedbcf', '019c5801-d002-7d04-9dc2-9105beb0a88f', '2026-02-13T17:17:19.747661+00:00', false, false, true) ON CONFLICT (setting_id, name_id) DO NOTHING;
-- setting_provider_keys_junction
INSERT INTO public.setting_provider_keys_junction (setting_id, provider_key_id, created_at, active, generated, mcp) VALUES ('019c3f8c-b97c-7fa5-b369-7d7418bedbcf', '019c441a-0eb9-7665-a01c-a6fec156d716', '2026-02-13T19:50:33.702587+00:00', true, false, false) ON CONFLICT (setting_id, provider_key_id) DO NOTHING;
INSERT INTO public.setting_provider_keys_junction (setting_id, provider_key_id, created_at, active, generated, mcp) VALUES ('019c3f8c-b97c-7fa5-b369-7d7418bedbcf', '019c441a-0eb9-7938-8d65-ccfc25d92856', '2026-02-13T19:50:33.702587+00:00', true, false, false) ON CONFLICT (setting_id, provider_key_id) DO NOTHING;
-- setting_settings_junction
INSERT INTO public.setting_settings_junction (setting_id, settings_id, active, created_at, generated, mcp) VALUES ('019c3f8c-b97c-7fa5-b369-7d7418bedbcf', '019c51c3-5130-734a-b5f4-c7e48130cc99', true, '2026-02-12T12:11:20.750426+00:00', false, false) ON CONFLICT (setting_id, settings_id) DO NOTHING;
-- department_settings_junction (moved from department file — needs settings_resource to exist)
INSERT INTO public.department_settings_junction (active, created_at, department_id, settings_id, generated, mcp) VALUES (true, '2026-02-25T22:07:55.636235+00:00', '019c3f8c-b97b-7350-8d77-632e29b1c3f9', '019c51c3-5130-734a-b5f4-c7e48130cc99', false, false) ON CONFLICT (department_id, settings_id) DO NOTHING;

-- systems_resource + system junctions (1 system per agent, except attempt-chat has text+audio agents)
WITH setting_scope AS (
    SELECT '019c3f8c-b97c-7fa5-b369-7d7418bedbcf'::uuid AS setting_id
),
active_agents AS (
    SELECT DISTINCT
        aaj.agents_id,
        ar.name AS agent_name
    FROM public.agent_agents_junction aaj
    JOIN public.agents_resource ar ON ar.id = aaj.agents_id
    WHERE aaj.active = true
      AND ar.active = true
),
system_mapping AS (
    SELECT
        ss.setting_id,
        aa.agents_id,
        aa.agent_name,
        CASE
            WHEN aa.agent_name IN ('Attempt Chat', 'Attempt Chat Audio') THEN 'attempt-chat'
            ELSE regexp_replace(lower(regexp_replace(aa.agent_name, '[^a-zA-Z0-9]+', '-', 'g')), '(^-|-$)', '', 'g')
        END AS system_key
    FROM setting_scope ss
    CROSS JOIN active_agents aa
),
systems_to_seed AS (
    SELECT
        sm.setting_id,
        sm.system_key,
        (
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 1, 8) || '-' ||
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 9, 4) || '-' ||
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 13, 4) || '-' ||
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 17, 4) || '-' ||
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 21, 12)
        )::uuid AS system_id,
        initcap(replace(sm.system_key, '-', ' ')) || ' System' AS system_name,
        'Seeded system for ' || sm.system_key || ' agents' AS system_description,
        ARRAY_AGG(DISTINCT sm.agents_id ORDER BY sm.agents_id) AS agent_ids
    FROM system_mapping sm
    GROUP BY sm.setting_id, sm.system_key
)
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, department_ids, agent_ids)
SELECT
    sts.system_id,
    NOW(),
    true,
    false,
    false,
    sts.system_name,
    sts.system_description,
    ARRAY[]::uuid[],
    sts.agent_ids
FROM systems_to_seed sts
ON CONFLICT (id) DO NOTHING;

WITH setting_scope AS (
    SELECT '019c3f8c-b97c-7fa5-b369-7d7418bedbcf'::uuid AS setting_id
),
active_agents AS (
    SELECT DISTINCT
        aaj.agents_id,
        ar.name AS agent_name
    FROM public.agent_agents_junction aaj
    JOIN public.agents_resource ar ON ar.id = aaj.agents_id
    WHERE aaj.active = true
      AND ar.active = true
),
system_mapping AS (
    SELECT
        ss.setting_id,
        aa.agents_id,
        CASE
            WHEN aa.agent_name IN ('Attempt Chat', 'Attempt Chat Audio') THEN 'attempt-chat'
            ELSE regexp_replace(lower(regexp_replace(aa.agent_name, '[^a-zA-Z0-9]+', '-', 'g')), '(^-|-$)', '', 'g')
        END AS system_key
    FROM setting_scope ss
    CROSS JOIN active_agents aa
),
systems_to_seed AS (
    SELECT
        sm.setting_id,
        (
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 1, 8) || '-' ||
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 9, 4) || '-' ||
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 13, 4) || '-' ||
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 17, 4) || '-' ||
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 21, 12)
        )::uuid AS system_id,
        ARRAY_AGG(DISTINCT sm.agents_id ORDER BY sm.agents_id) AS agent_ids
    FROM system_mapping sm
    GROUP BY sm.setting_id, sm.system_key
)
INSERT INTO public.setting_systems_junction (setting_id, systems_id, created_at, active, generated, mcp)
SELECT
    sts.setting_id,
    sts.system_id,
    NOW(),
    true,
    false,
    false
FROM systems_to_seed sts
ON CONFLICT (setting_id, systems_id) DO NOTHING;

WITH setting_scope AS (
    SELECT '019c3f8c-b97c-7fa5-b369-7d7418bedbcf'::uuid AS setting_id
),
active_agents AS (
    SELECT DISTINCT
        aaj.agents_id,
        ar.name AS agent_name
    FROM public.agent_agents_junction aaj
    JOIN public.agents_resource ar ON ar.id = aaj.agents_id
    WHERE aaj.active = true
      AND ar.active = true
),
system_mapping AS (
    SELECT
        ss.setting_id,
        aa.agents_id,
        CASE
            WHEN aa.agent_name IN ('Attempt Chat', 'Attempt Chat Audio') THEN 'attempt-chat'
            ELSE regexp_replace(lower(regexp_replace(aa.agent_name, '[^a-zA-Z0-9]+', '-', 'g')), '(^-|-$)', '', 'g')
        END AS system_key
    FROM setting_scope ss
    CROSS JOIN active_agents aa
),
systems_to_seed AS (
    SELECT
        (
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 1, 8) || '-' ||
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 9, 4) || '-' ||
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 13, 4) || '-' ||
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 17, 4) || '-' ||
            substr(md5(sm.setting_id::text || ':system:' || sm.system_key), 21, 12)
        )::uuid AS system_id,
        ARRAY_AGG(DISTINCT sm.agents_id ORDER BY sm.agents_id) AS agent_ids
    FROM system_mapping sm
    GROUP BY sm.setting_id, sm.system_key
)
INSERT INTO public.system_agents_junction (system_id, agents_id, created_at, active, generated, mcp)
SELECT
    sts.system_id,
    agent_id,
    NOW(),
    true,
    false,
    false
FROM systems_to_seed sts
CROSS JOIN LATERAL unnest(sts.agent_ids) AS agent_id
ON CONFLICT (system_id, agents_id) DO NOTHING;
