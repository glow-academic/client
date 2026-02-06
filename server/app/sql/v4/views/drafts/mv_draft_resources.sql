-- Materialized View: mv_draft_resources
-- One row per draft with denormalized draft-linked resource IDs and per-resource group IDs.
--
-- Notes:
-- - Each `{resource}_group_id` is the groups_resource.id resolved from draft_domains_entry
--   via domains_domains_connection -> domains_resource (filtered by resource type) -> groups_groups_connection.
--   The "latest" group is selected by ordering on draft_domains_entry.created_at DESC.
-- - `resource_types`/`resource_ids` include all active links from *_drafts_connection tables.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_draft_resources'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_draft_resources CASCADE;

CREATE MATERIALIZED VIEW mv_draft_resources AS
WITH draft_links AS (
    SELECT draft_id, 'agents'::resource_type AS resource_type, agents_id::uuid AS resource_id FROM agents_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'args'::resource_type AS resource_type, args_id::uuid AS resource_id FROM args_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'args_outputs'::resource_type AS resource_type, args_outputs_id::uuid AS resource_id FROM args_outputs_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'audios'::resource_type AS resource_type, audios_id::uuid AS resource_id FROM audios_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'auths'::resource_type AS resource_type, auths_id::uuid AS resource_id FROM auths_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'bindings'::resource_type AS resource_type, bindings_id::uuid AS resource_id FROM bindings_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'cohorts'::resource_type AS resource_type, cohorts_id::uuid AS resource_id FROM cohorts_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'colors'::resource_type AS resource_type, colors_id::uuid AS resource_id FROM colors_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'departments'::resource_type AS resource_type, departments_id::uuid AS resource_id FROM departments_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'descriptions'::resource_type AS resource_type, descriptions_id::uuid AS resource_id FROM descriptions_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'documents'::resource_type AS resource_type, documents_id::uuid AS resource_id FROM documents_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'domains'::resource_type AS resource_type, domains_id::uuid AS resource_id FROM domains_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'emails'::resource_type AS resource_type, emails_id::uuid AS resource_id FROM emails_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'endpoints'::resource_type AS resource_type, endpoints_id::uuid AS resource_id FROM endpoints_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'evals'::resource_type AS resource_type, evals_id::uuid AS resource_id FROM evals_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'examples'::resource_type AS resource_type, examples_id::uuid AS resource_id FROM examples_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'fields'::resource_type AS resource_type, fields_id::uuid AS resource_id FROM fields_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'flags'::resource_type AS resource_type, flags_id::uuid AS resource_id FROM flags_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'group_positions'::resource_type AS resource_type, group_positions_id::uuid AS resource_id FROM group_positions_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'groups'::resource_type AS resource_type, groups_id::uuid AS resource_id FROM groups_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'icons'::resource_type AS resource_type, icons_id::uuid AS resource_id FROM icons_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'images'::resource_type AS resource_type, images_id::uuid AS resource_id FROM images_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'instructions'::resource_type AS resource_type, instructions_id::uuid AS resource_id FROM instructions_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'items'::resource_type AS resource_type, items_id::uuid AS resource_id FROM items_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'keys'::resource_type AS resource_type, keys_id::uuid AS resource_id FROM keys_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'modalities'::resource_type AS resource_type, modalities_id::uuid AS resource_id FROM modalities_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'models'::resource_type AS resource_type, models_id::uuid AS resource_id FROM models_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'names'::resource_type AS resource_type, names_id::uuid AS resource_id FROM names_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'objectives'::resource_type AS resource_type, objectives_id::uuid AS resource_id FROM objectives_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'options'::resource_type AS resource_type, options_id::uuid AS resource_id FROM options_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'parameter_fields'::resource_type AS resource_type, parameter_fields_id::uuid AS resource_id FROM parameter_fields_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'parameters'::resource_type AS resource_type, parameters_id::uuid AS resource_id FROM parameters_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'personas'::resource_type AS resource_type, personas_id::uuid AS resource_id FROM personas_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'points'::resource_type AS resource_type, points_id::uuid AS resource_id FROM points_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'pricing'::resource_type AS resource_type, pricing_id::uuid AS resource_id FROM pricing_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'problem_statements'::resource_type AS resource_type, problem_statements_id::uuid AS resource_id FROM problem_statements_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'profiles'::resource_type AS resource_type, profiles_id::uuid AS resource_id FROM profiles_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'prompts'::resource_type AS resource_type, prompts_id::uuid AS resource_id FROM prompts_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'protocols'::resource_type AS resource_type, protocols_id::uuid AS resource_id FROM protocols_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'providers'::resource_type AS resource_type, providers_id::uuid AS resource_id FROM providers_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'qualities'::resource_type AS resource_type, qualities_id::uuid AS resource_id FROM qualities_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'questions'::resource_type AS resource_type, questions_id::uuid AS resource_id FROM questions_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'reasoning_levels'::resource_type AS resource_type, reasoning_levels_id::uuid AS resource_id FROM reasoning_levels_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'request_limits'::resource_type AS resource_type, request_limits_id::uuid AS resource_id FROM request_limits_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'role_routes'::resource_type AS resource_type, role_routes_id::uuid AS resource_id FROM role_routes_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'roles'::resource_type AS resource_type, roles_id::uuid AS resource_id FROM roles_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'routes'::resource_type AS resource_type, routes_id::uuid AS resource_id FROM routes_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'rubrics'::resource_type AS resource_type, rubrics_id::uuid AS resource_id FROM rubrics_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'run_positions'::resource_type AS resource_type, run_positions_id::uuid AS resource_id FROM run_positions_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'runs'::resource_type AS resource_type, runs_id::uuid AS resource_id FROM runs_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenario_flags'::resource_type AS resource_type, scenario_flags_id::uuid AS resource_id FROM scenario_flags_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenario_positions'::resource_type AS resource_type, scenario_positions_id::uuid AS resource_id FROM scenario_positions_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenario_rubrics'::resource_type AS resource_type, scenario_rubrics_id::uuid AS resource_id FROM scenario_rubrics_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenario_time_limits'::resource_type AS resource_type, scenario_time_limits_id::uuid AS resource_id FROM scenario_time_limits_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'scenarios'::resource_type AS resource_type, scenarios_id::uuid AS resource_id FROM scenarios_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'settings'::resource_type AS resource_type, settings_id::uuid AS resource_id FROM settings_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'simulation_positions'::resource_type AS resource_type, simulation_positions_id::uuid AS resource_id FROM simulation_positions_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'simulations'::resource_type AS resource_type, simulations_id::uuid AS resource_id FROM simulations_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'slugs'::resource_type AS resource_type, slugs_id::uuid AS resource_id FROM slugs_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'standard_groups'::resource_type AS resource_type, standard_groups_id::uuid AS resource_id FROM standard_groups_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'standards'::resource_type AS resource_type, standards_id::uuid AS resource_id FROM standards_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'temperature_levels'::resource_type AS resource_type, temperature_levels_id::uuid AS resource_id FROM temperature_levels_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'templates'::resource_type AS resource_type, templates_id::uuid AS resource_id FROM templates_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'thresholds'::resource_type AS resource_type, thresholds_id::uuid AS resource_id FROM thresholds_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'texts'::resource_type AS resource_type, texts_id::uuid AS resource_id FROM texts_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'tools'::resource_type AS resource_type, tools_id::uuid AS resource_id FROM tools_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'run_rubrics'::resource_type AS resource_type, run_rubrics_id::uuid AS resource_id FROM run_rubrics_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'group_rubrics'::resource_type AS resource_type, group_rubrics_id::uuid AS resource_id FROM group_rubrics_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'conditional_parameters'::resource_type AS resource_type, conditional_parameters_id::uuid AS resource_id FROM conditional_parameters_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'uploads'::resource_type AS resource_type, uploads_id::uuid AS resource_id FROM uploads_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'values'::resource_type AS resource_type, values_id::uuid AS resource_id FROM values_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'videos'::resource_type AS resource_type, videos_id::uuid AS resource_id FROM videos_drafts_connection WHERE active = true
    UNION ALL SELECT draft_id, 'voices'::resource_type AS resource_type, voices_id::uuid AS resource_id FROM voices_drafts_connection WHERE active = true
)
SELECT
    d.id AS draft_id,
    d.created_at,
    d.updated_at,
    d.version,
    d.generated,
    d.mcp,
    d.active,

    -- Per-resource group IDs (latest group that contributed each resource type)
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'names'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS names_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'descriptions'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS descriptions_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'flags'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS flags_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'colors'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS colors_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'icons'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS icons_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'auths'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS auths_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'tools'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS tools_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'instructions'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS instructions_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'documents'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS documents_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'departments'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS departments_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'parameters'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS parameters_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'parameter_fields'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS parameter_fields_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'fields'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS fields_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'examples'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS examples_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'questions'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS questions_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'templates'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS templates_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'texts'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS texts_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'run_rubrics'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS run_rubrics_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'group_rubrics'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS group_rubrics_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'bindings'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS bindings_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'conditional_parameters'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS conditional_parameters_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'personas'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS personas_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'scenarios'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS scenarios_group_id,
    (
        SELECT ggc2.groups_id
        FROM draft_domains_entry dde2
        JOIN domains_domains_connection ddc2 ON ddc2.domain_id = dde2.domain_id AND ddc2.active = true
        JOIN domains_resource dr2 ON dr2.id = ddc2.domains_id AND dr2.resource = 'simulations'::resource_type AND dr2.active = true
        JOIN groups_groups_connection ggc2 ON ggc2.group_id = dde2.group_id AND ggc2.active = true
        WHERE dde2.draft_id = d.id AND dde2.active = true
        ORDER BY dde2.created_at DESC
        LIMIT 1
    ) AS simulations_group_id,

    -- Aggregated resource arrays
    COALESCE(array_agg(DISTINCT l.resource_type) FILTER (WHERE l.resource_type IS NOT NULL), ARRAY[]::resource_type[]) AS resource_types,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_id IS NOT NULL), ARRAY[]::uuid[]) AS resource_ids,

    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'names'::resource_type), ARRAY[]::uuid[]) AS name_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'descriptions'::resource_type), ARRAY[]::uuid[]) AS description_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'flags'::resource_type), ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'colors'::resource_type), ARRAY[]::uuid[]) AS color_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'icons'::resource_type), ARRAY[]::uuid[]) AS icon_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'auths'::resource_type), ARRAY[]::uuid[]) AS auth_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'tools'::resource_type), ARRAY[]::uuid[]) AS tool_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'instructions'::resource_type), ARRAY[]::uuid[]) AS instruction_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'documents'::resource_type), ARRAY[]::uuid[]) AS document_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'departments'::resource_type), ARRAY[]::uuid[]) AS department_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'parameters'::resource_type), ARRAY[]::uuid[]) AS parameter_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'parameter_fields'::resource_type), ARRAY[]::uuid[]) AS parameter_field_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'fields'::resource_type), ARRAY[]::uuid[]) AS field_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'examples'::resource_type), ARRAY[]::uuid[]) AS example_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'questions'::resource_type), ARRAY[]::uuid[]) AS question_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'templates'::resource_type), ARRAY[]::uuid[]) AS template_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'texts'::resource_type), ARRAY[]::uuid[]) AS text_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'run_rubrics'::resource_type), ARRAY[]::uuid[]) AS run_rubric_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'group_rubrics'::resource_type), ARRAY[]::uuid[]) AS group_rubric_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'bindings'::resource_type), ARRAY[]::uuid[]) AS binding_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'conditional_parameters'::resource_type), ARRAY[]::uuid[]) AS conditional_parameter_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'personas'::resource_type), ARRAY[]::uuid[]) AS persona_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'scenarios'::resource_type), ARRAY[]::uuid[]) AS scenario_ids,
    COALESCE(array_agg(DISTINCT l.resource_id) FILTER (WHERE l.resource_type = 'simulations'::resource_type), ARRAY[]::uuid[]) AS simulation_ids
FROM drafts_entry d
LEFT JOIN draft_links l ON l.draft_id = d.id
GROUP BY d.id, d.created_at, d.updated_at, d.version, d.generated, d.mcp, d.active
WITH NO DATA;

CREATE UNIQUE INDEX mv_draft_resources_pk
    ON mv_draft_resources (draft_id);

CREATE INDEX mv_draft_resources_resource_types_gin
    ON mv_draft_resources USING gin (resource_types);

CREATE INDEX mv_draft_resources_resource_ids_gin
    ON mv_draft_resources USING gin (resource_ids);

REFRESH MATERIALIZED VIEW mv_draft_resources;
