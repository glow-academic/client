"""Resources v4 API routes."""

from fastapi import APIRouter

router = APIRouter(prefix="/resources", tags=["resources"])

# Include all resource routers
# NOTE: agents removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for agent two-pass architecture
from app.api.v4.resources.agents.get import router as agents_get_router

router.include_router(agents_get_router)
from app.api.v4.resources.agents.search import router as agents_search_router

router.include_router(agents_search_router)
# NOTE: analyses removed - converted to entry table (migration 305)
from app.api.v4.resources.args.create import router as args_router
from app.api.v4.resources.args.get import router as args_get_router

router.include_router(args_router)
router.include_router(args_get_router)
from app.api.v4.resources.args.search import router as args_search_router

router.include_router(args_search_router)
from app.api.v4.resources.arg_positions.create import router as arg_positions_router
from app.api.v4.resources.arg_positions.get import router as arg_positions_get_router
from app.api.v4.resources.arg_positions.search import (
    router as arg_positions_search_router,
)

router.include_router(arg_positions_router)
router.include_router(arg_positions_get_router)
router.include_router(arg_positions_search_router)
from app.api.v4.resources.args_outputs.create import router as args_outputs_router
from app.api.v4.resources.args_outputs.get import router as args_outputs_get_router
from app.api.v4.resources.args_outputs.search import (
    router as args_outputs_search_router,
)

router.include_router(args_outputs_router)
router.include_router(args_outputs_get_router)
router.include_router(args_outputs_search_router)
from app.api.v4.resources.auth_item_keys.create import router as auth_item_keys_router
from app.api.v4.resources.auth_item_keys.get import router as auth_item_keys_get_router
from app.api.v4.resources.auth_item_keys.search import (
    router as auth_item_keys_search_router,
)

router.include_router(auth_item_keys_router)
router.include_router(auth_item_keys_get_router)
router.include_router(auth_item_keys_search_router)
# NOTE: audios removed - converted to audios_entry (migration 328)
# NOTE: auths removed - non-creatable, sync via artifact save (migration 328)
# GET/Search endpoints available for two-pass architecture
from app.api.v4.resources.auths.get import router as auths_get_router
from app.api.v4.resources.auths.search import router as auths_search_router

router.include_router(auths_get_router)
router.include_router(auths_search_router)
# NOTE: bindings removed - non-creatable (migration 328)
# GET/Search endpoints available for two-pass architecture
from app.api.v4.resources.bindings.get import router as bindings_get_router
from app.api.v4.resources.bindings.search import router as bindings_search_router

router.include_router(bindings_get_router)
router.include_router(bindings_search_router)
# NOTE: cohorts removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for profile context two-pass architecture
from app.api.v4.resources.cohorts.get import router as cohorts_get_router
from app.api.v4.resources.cohorts.search import router as cohorts_search_router

router.include_router(cohorts_get_router)
router.include_router(cohorts_search_router)
from app.api.v4.resources.colors.create import router as colors_router
from app.api.v4.resources.colors.get import router as colors_get_router
from app.api.v4.resources.colors.link import router as colors_link_router
from app.api.v4.resources.colors.search import router as colors_search_router

router.include_router(colors_router)
router.include_router(colors_get_router)
router.include_router(colors_link_router)
router.include_router(colors_search_router)
# NOTE: conditional_parameters removed - non-creatable (migration 328)
# GET/Search endpoints available for two-pass architecture
from app.api.v4.resources.conditional_parameters.get import (
    router as conditional_parameters_get_router,
)
from app.api.v4.resources.conditional_parameters.search import (
    router as conditional_parameters_search_router,
)

router.include_router(conditional_parameters_get_router)
router.include_router(conditional_parameters_search_router)
# NOTE: contents removed - converted to entry table (migration 305)
# NOTE: conversations removed - converted to entry table (migration 305)
# NOTE: departments removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for personas two-pass architecture
from app.api.v4.resources.departments.get import router as departments_get_router
from app.api.v4.resources.departments.link import router as departments_link_router
from app.api.v4.resources.departments.search import router as departments_search_router

router.include_router(departments_get_router)
router.include_router(departments_link_router)
router.include_router(departments_search_router)
from app.api.v4.resources.descriptions.create import router as descriptions_router
from app.api.v4.resources.descriptions.get import router as descriptions_get_router
from app.api.v4.resources.descriptions.link import router as descriptions_link_router
from app.api.v4.resources.descriptions.search import (
    router as descriptions_search_router,
)

router.include_router(descriptions_router)
router.include_router(descriptions_get_router)
router.include_router(descriptions_link_router)
router.include_router(descriptions_search_router)
# NOTE: domains removed - non-creatable (migration 328)
# GET/Search endpoints available for two-pass architecture
from app.api.v4.resources.domains.get import router as domains_get_router
from app.api.v4.resources.domains.search import router as domains_search_router

router.include_router(domains_get_router)
router.include_router(domains_search_router)
# NOTE: documents removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for scenarios two-pass architecture
from app.api.v4.resources.documents.get import router as documents_get_router

router.include_router(documents_get_router)
from app.api.v4.resources.documents.search import router as documents_search_router

router.include_router(documents_search_router)
from app.api.v4.resources.emails.create import router as emails_router
from app.api.v4.resources.emails.get import router as emails_get_router
from app.api.v4.resources.emails.search import router as emails_search_router

router.include_router(emails_router)
router.include_router(emails_get_router)
router.include_router(emails_search_router)
from app.api.v4.resources.endpoints.create import router as endpoints_router
from app.api.v4.resources.endpoints.get import router as endpoints_get_router

router.include_router(endpoints_router)
router.include_router(endpoints_get_router)
from app.api.v4.resources.endpoints.search import router as endpoints_search_router

router.include_router(endpoints_search_router)
# NOTE: evals removed - non-creatable, sync via artifact save (migration 328)
# GET/Search endpoints available for two-pass architecture
from app.api.v4.resources.evals.get import router as evals_get_router
from app.api.v4.resources.evals.search import router as evals_search_router

router.include_router(evals_get_router)
router.include_router(evals_search_router)
from app.api.v4.resources.examples.create import router as examples_router
from app.api.v4.resources.examples.get import router as examples_get_router
from app.api.v4.resources.examples.link import router as examples_link_router
from app.api.v4.resources.examples.search import router as examples_search_router

router.include_router(examples_router)
router.include_router(examples_get_router)
router.include_router(examples_link_router)
router.include_router(examples_search_router)
# NOTE: feedbacks removed - converted to entry table (migration 305)
# NOTE: fields removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for personas two-pass architecture
from app.api.v4.resources.fields.get import router as fields_get_router
from app.api.v4.resources.fields.search import router as fields_search_router

router.include_router(fields_get_router)
router.include_router(fields_search_router)
# Parameter fields endpoints for personas two-pass architecture
from app.api.v4.resources.parameter_fields.create import (
    router as parameter_fields_create_router,
)
from app.api.v4.resources.parameter_fields.get import (
    router as parameter_fields_get_router,
)
from app.api.v4.resources.parameter_fields.link import (
    router as parameter_fields_link_router,
)
from app.api.v4.resources.parameter_fields.search import (
    router as parameter_fields_search_router,
)

router.include_router(parameter_fields_create_router)
router.include_router(parameter_fields_get_router)
router.include_router(parameter_fields_link_router)
router.include_router(parameter_fields_search_router)
# NOTE: persona_fields removed - non-creatable (migration 328)
# NOTE: document_fields removed - non-creatable (migration 328)
# NOTE: flags removed - non-creatable (migration 328)
# GET endpoint available for personas two-pass architecture
from app.api.v4.resources.flags.get import router as flags_get_router
from app.api.v4.resources.flags.link import router as flags_link_router
from app.api.v4.resources.flags.search import router as flags_search_router

router.include_router(flags_get_router)
router.include_router(flags_link_router)
router.include_router(flags_search_router)
from app.api.v4.resources.group_positions.create import router as group_positions_router
from app.api.v4.resources.group_positions.get import (
    router as group_positions_get_router,
)

router.include_router(group_positions_router)
router.include_router(group_positions_get_router)
from app.api.v4.resources.group_positions.search import (
    router as group_positions_search_router,
)

router.include_router(group_positions_search_router)
from app.api.v4.resources.group_rubrics.create import router as group_rubrics_router
from app.api.v4.resources.group_rubrics.get import router as group_rubrics_get_router

router.include_router(group_rubrics_router)
router.include_router(group_rubrics_get_router)
from app.api.v4.resources.group_rubrics.search import (
    router as group_rubrics_search_router,
)

router.include_router(group_rubrics_search_router)
# NOTE: groups removed - non-creatable (migration 328)
# GET/Search endpoints available for two-pass architecture
from app.api.v4.resources.groups.get import router as groups_get_router
from app.api.v4.resources.groups.search import router as groups_search_router

router.include_router(groups_get_router)
router.include_router(groups_search_router)
# NOTE: hints removed - converted to entry table (migration 305)
# NOTE: icons removed - non-creatable (migration 328)
# GET endpoint available for personas two-pass architecture
from app.api.v4.resources.icons.get import router as icons_get_router
from app.api.v4.resources.icons.link import router as icons_link_router
from app.api.v4.resources.icons.search import router as icons_search_router

router.include_router(icons_get_router)
router.include_router(icons_link_router)
router.include_router(icons_search_router)
from app.api.v4.resources.images.create import router as images_router
from app.api.v4.resources.images.get import router as images_get_router

router.include_router(images_router)
router.include_router(images_get_router)
from app.api.v4.resources.images.search import router as images_search_router

router.include_router(images_search_router)
# NOTE: improvements removed - converted to entry table (migration 305)
from app.api.v4.resources.instructions.create import router as instructions_router
from app.api.v4.resources.instructions.get import router as instructions_get_router
from app.api.v4.resources.instructions.link import router as instructions_link_router
from app.api.v4.resources.instructions.search import (
    router as instructions_search_router,
)

router.include_router(instructions_router)
router.include_router(instructions_get_router)
router.include_router(instructions_link_router)
router.include_router(instructions_search_router)
from app.api.v4.resources.items.create import router as items_router
from app.api.v4.resources.items.get import router as items_get_router

router.include_router(items_router)
router.include_router(items_get_router)
from app.api.v4.resources.items.search import router as items_search_router

router.include_router(items_search_router)
from app.api.v4.resources.keys.create import router as keys_router
from app.api.v4.resources.keys.get import router as keys_get_router

router.include_router(keys_router)
# NOTE: decrypt moved to auth/ (not available to MCP)
router.include_router(keys_get_router)
from app.api.v4.resources.keys.search import router as keys_search_router

router.include_router(keys_search_router)
from app.api.v4.resources.provider_keys.create import router as provider_keys_router
from app.api.v4.resources.provider_keys.get import router as provider_keys_get_router
from app.api.v4.resources.provider_keys.search import (
    router as provider_keys_search_router,
)

router.include_router(provider_keys_router)
router.include_router(provider_keys_get_router)
router.include_router(provider_keys_search_router)
# NOTE: modalities removed - non-creatable (migration 328)
# GET/Search endpoints available for model two-pass architecture
from app.api.v4.resources.modalities.get import (
    router as modalities_get_router,
)
from app.api.v4.resources.modalities.search import (
    router as modalities_search_router,
)

router.include_router(modalities_get_router)
router.include_router(modalities_search_router)
# NOTE: models removed - non-creatable, sync via artifact save (migration 328)
# GET/Search endpoints available for agent two-pass architecture
from app.api.v4.resources.models.get import router as models_get_router
from app.api.v4.resources.models.search import router as models_search_router

router.include_router(models_get_router)
router.include_router(models_search_router)
from app.api.v4.resources.names.create import router as names_router
from app.api.v4.resources.names.get import router as names_get_router
from app.api.v4.resources.names.link import router as names_link_router
from app.api.v4.resources.names.search import router as names_search_router

router.include_router(names_router)
router.include_router(names_get_router)
router.include_router(names_link_router)
router.include_router(names_search_router)
from app.api.v4.resources.objectives.create import router as objectives_router
from app.api.v4.resources.objectives.get import router as objectives_get_router

router.include_router(objectives_router)
router.include_router(objectives_get_router)
from app.api.v4.resources.objectives.search import router as objectives_search_router

router.include_router(objectives_search_router)
from app.api.v4.resources.options.create import router as options_router
from app.api.v4.resources.options.get import router as options_get_router

router.include_router(options_router)
router.include_router(options_get_router)
from app.api.v4.resources.options.search import router as options_search_router

router.include_router(options_search_router)
# NOTE: parameters removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for personas two-pass architecture
from app.api.v4.resources.parameters.get import router as parameters_get_router
from app.api.v4.resources.parameters.search import router as parameters_search_router

router.include_router(parameters_get_router)
router.include_router(parameters_search_router)
# NOTE: personas removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for scenarios two-pass architecture
from app.api.v4.resources.personas.get import router as personas_get_router

router.include_router(personas_get_router)
from app.api.v4.resources.personas.search import router as personas_search_router

router.include_router(personas_search_router)
from app.api.v4.resources.points.create import router as points_router
from app.api.v4.resources.points.get import router as points_get_router

router.include_router(points_router)
router.include_router(points_get_router)
from app.api.v4.resources.points.search import router as points_search_router

router.include_router(points_search_router)
from app.api.v4.resources.pricing.create import router as pricing_router
from app.api.v4.resources.pricing.get import router as pricing_get_router

router.include_router(pricing_router)
router.include_router(pricing_get_router)
from app.api.v4.resources.pricing.search import router as pricing_search_router

router.include_router(pricing_search_router)
from app.api.v4.resources.problem_statements.create import (
    router as problem_statements_router,
)
from app.api.v4.resources.problem_statements.get import (
    router as problem_statements_get_router,
)

router.include_router(problem_statements_router)
router.include_router(problem_statements_get_router)
# NOTE: profiles removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for profile context two-pass architecture
from app.api.v4.resources.profiles.get import router as profiles_get_router
from app.api.v4.resources.profiles.search import router as profiles_search_router

router.include_router(profiles_get_router)
router.include_router(profiles_search_router)
from app.api.v4.resources.profiles.link import router as profiles_link_router

router.include_router(profiles_link_router)
from app.api.v4.resources.prompts.create import router as prompts_router
from app.api.v4.resources.prompts.get import router as prompts_get_router

router.include_router(prompts_router)
router.include_router(prompts_get_router)
from app.api.v4.resources.prompts.search import router as prompts_search_router

router.include_router(prompts_search_router)
from app.api.v4.resources.protocols.create import router as protocols_router
from app.api.v4.resources.protocols.get import router as protocols_get_router
from app.api.v4.resources.protocols.search import router as protocols_search_router

router.include_router(protocols_router)
router.include_router(protocols_get_router)
router.include_router(protocols_search_router)
# NOTE: providers removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for provider two-pass architecture
from app.api.v4.resources.providers.get import router as providers_get_router

router.include_router(providers_get_router)
from app.api.v4.resources.providers.search import router as providers_search_router

router.include_router(providers_search_router)
# NOTE: regenerates removed entirely (migration 442)
# NOTE: qualities removed - non-creatable (migration 328)
# GET/Search endpoints available for model two-pass architecture
from app.api.v4.resources.qualities.get import (
    router as qualities_get_router,
)
from app.api.v4.resources.qualities.search import (
    router as qualities_search_router,
)

router.include_router(qualities_get_router)
router.include_router(qualities_search_router)
from app.api.v4.resources.questions.create import router as questions_router
from app.api.v4.resources.questions.get import router as questions_get_router

router.include_router(questions_router)
router.include_router(questions_get_router)
# NOTE: reasoning_levels removed - non-creatable (migration 328)
# GET/Search endpoints available for agent two-pass architecture
from app.api.v4.resources.reasoning_levels.get import (
    router as reasoning_levels_get_router,
)
from app.api.v4.resources.reasoning_levels.search import (
    router as reasoning_levels_search_router,
)

router.include_router(reasoning_levels_get_router)
router.include_router(reasoning_levels_search_router)
from app.api.v4.resources.request_limits.create import router as request_limits_router
from app.api.v4.resources.request_limits.get import router as request_limits_get_router
from app.api.v4.resources.request_limits.search import (
    router as request_limits_search_router,
)

router.include_router(request_limits_router)
router.include_router(request_limits_get_router)
router.include_router(request_limits_search_router)
# NOTE: responses removed - converted to entry table (migration 305)
# NOTE: roles removed - non-creatable (migration 328)
# GET endpoint available for profile context two-pass architecture
from app.api.v4.resources.roles.get import router as roles_get_router

router.include_router(roles_get_router)
from app.api.v4.resources.roles.search import router as roles_search_router

router.include_router(roles_search_router)
# NOTE: routes removed - dropped (migration 328+)
# NOTE: rubrics removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for simulations two-pass architecture
from app.api.v4.resources.rubrics.get import router as rubrics_get_router

router.include_router(rubrics_get_router)
from app.api.v4.resources.rubrics.search import router as rubrics_search_router

router.include_router(rubrics_search_router)
from app.api.v4.resources.run_positions.create import router as run_positions_router
from app.api.v4.resources.run_positions.get import router as run_positions_get_router

router.include_router(run_positions_router)
router.include_router(run_positions_get_router)
from app.api.v4.resources.run_positions.search import (
    router as run_positions_search_router,
)

router.include_router(run_positions_search_router)
from app.api.v4.resources.run_rubrics.create import router as run_rubrics_router
from app.api.v4.resources.run_rubrics.get import router as run_rubrics_get_router

router.include_router(run_rubrics_router)
router.include_router(run_rubrics_get_router)
from app.api.v4.resources.run_rubrics.search import (
    router as run_rubrics_search_router,
)

router.include_router(run_rubrics_search_router)
# NOTE: runs removed - non-creatable (migration 328)
# GET/Search endpoints available for two-pass architecture
from app.api.v4.resources.runs.get import router as runs_get_router
from app.api.v4.resources.runs.search import router as runs_search_router

router.include_router(runs_get_router)
router.include_router(runs_search_router)
# NOTE: scenario_flags removed - non-creatable (migration 328)
# GET/Search endpoints available for simulations two-pass architecture
from app.api.v4.resources.scenario_flags.get import router as scenario_flags_get_router
from app.api.v4.resources.scenario_flags.search import (
    router as scenario_flags_search_router,
)

router.include_router(scenario_flags_get_router)
router.include_router(scenario_flags_search_router)
from app.api.v4.resources.scenario_flags.link import (
    router as scenario_flags_link_router,
)

router.include_router(scenario_flags_link_router)
# NOTE: scenario_personas removed - replaced by profile_personas on cohort (migration 500)
from app.api.v4.resources.profile_personas.create import (
    router as profile_personas_router,
)
from app.api.v4.resources.profile_personas.get import (
    router as profile_personas_get_router,
)
from app.api.v4.resources.profile_personas.search import (
    router as profile_personas_search_router,
)

router.include_router(profile_personas_router)
router.include_router(profile_personas_get_router)
router.include_router(profile_personas_search_router)
from app.api.v4.resources.profile_personas.link import (
    router as profile_personas_link_router,
)

router.include_router(profile_personas_link_router)
from app.api.v4.resources.scenario_positions.create import (
    router as scenario_positions_router,
)
from app.api.v4.resources.scenario_positions.get import (
    router as scenario_positions_get_router,
)
from app.api.v4.resources.scenario_positions.search import (
    router as scenario_positions_search_router,
)

router.include_router(scenario_positions_router)
router.include_router(scenario_positions_get_router)
router.include_router(scenario_positions_search_router)
from app.api.v4.resources.scenario_positions.link import (
    router as scenario_positions_link_router,
)

router.include_router(scenario_positions_link_router)
from app.api.v4.resources.scenario_rubrics.create import (
    router as scenario_rubrics_router,
)
from app.api.v4.resources.scenario_rubrics.get import (
    router as scenario_rubrics_get_router,
)
from app.api.v4.resources.scenario_rubrics.search import (
    router as scenario_rubrics_search_router,
)

router.include_router(scenario_rubrics_router)
router.include_router(scenario_rubrics_get_router)
router.include_router(scenario_rubrics_search_router)
from app.api.v4.resources.scenario_rubrics.link import (
    router as scenario_rubrics_link_router,
)

router.include_router(scenario_rubrics_link_router)
from app.api.v4.resources.scenario_time_limits.create import (
    router as scenario_time_limits_router,
)
from app.api.v4.resources.scenario_time_limits.get import (
    router as scenario_time_limits_get_router,
)
from app.api.v4.resources.scenario_time_limits.search import (
    router as scenario_time_limits_search_router,
)

router.include_router(scenario_time_limits_router)
router.include_router(scenario_time_limits_get_router)
router.include_router(scenario_time_limits_search_router)
from app.api.v4.resources.scenario_time_limits.link import (
    router as scenario_time_limits_link_router,
)

router.include_router(scenario_time_limits_link_router)
# NOTE: scenarios removed - non-creatable, sync via artifact save (migration 328)
# GET/Search endpoints available for simulations two-pass architecture
from app.api.v4.resources.scenarios import router as scenarios_router
from app.api.v4.resources.scenarios.link import router as scenarios_link_router

router.include_router(scenarios_router)
router.include_router(scenarios_link_router)
# NOTE: settings removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for profile context two-pass architecture
from app.api.v4.resources.settings.get import router as settings_get_router

router.include_router(settings_get_router)
from app.api.v4.resources.settings.search import router as settings_search_router

router.include_router(settings_search_router)
from app.api.v4.resources.simulation_positions.create import (
    router as simulation_positions_router,
)
from app.api.v4.resources.simulation_positions.get import (
    router as simulation_positions_get_router,
)
from app.api.v4.resources.simulation_positions.search import (
    router as simulation_positions_search_router,
)

router.include_router(simulation_positions_router)
router.include_router(simulation_positions_get_router)
router.include_router(simulation_positions_search_router)
from app.api.v4.resources.simulation_positions.link import (
    router as simulation_positions_link_router,
)

router.include_router(simulation_positions_link_router)
from app.api.v4.resources.simulation_availability.create import (
    router as simulation_availability_router,
)
from app.api.v4.resources.simulation_availability.get import (
    router as simulation_availability_get_router,
)
from app.api.v4.resources.simulation_availability.search import (
    router as simulation_availability_search_router,
)

router.include_router(simulation_availability_router)
router.include_router(simulation_availability_get_router)
router.include_router(simulation_availability_search_router)
from app.api.v4.resources.simulation_availability.link import (
    router as simulation_availability_link_router,
)

router.include_router(simulation_availability_link_router)
# NOTE: simulations removed - non-creatable, sync via artifact save (migration 328)
# GET/Search endpoints available for cohorts two-pass architecture
from app.api.v4.resources.simulations.get import router as simulations_get_router
from app.api.v4.resources.simulations.search import router as simulations_search_router

router.include_router(simulations_get_router)
router.include_router(simulations_search_router)
from app.api.v4.resources.simulations.link import router as simulations_link_router

router.include_router(simulations_link_router)
from app.api.v4.resources.slugs.create import router as slugs_router
from app.api.v4.resources.slugs.get import router as slugs_get_router
from app.api.v4.resources.slugs.search import router as slugs_search_router

router.include_router(slugs_router)
router.include_router(slugs_get_router)
router.include_router(slugs_search_router)
from app.api.v4.resources.standard_groups.create import router as standard_groups_router
from app.api.v4.resources.standard_groups.get import (
    router as standard_groups_get_router,
)

router.include_router(standard_groups_router)
router.include_router(standard_groups_get_router)
from app.api.v4.resources.standard_groups.search import (
    router as standard_groups_search_router,
)

router.include_router(standard_groups_search_router)
# NOTE: standards removed - non-creatable (migration 328)
# GET endpoint available for simulations two-pass architecture
from app.api.v4.resources.standards.get import router as standards_get_router

router.include_router(standards_get_router)
from app.api.v4.resources.standards.search import router as standards_search_router

router.include_router(standards_search_router)
# NOTE: strengths removed - converted to entry table (migration 305)
# NOTE: temperature_levels removed - non-creatable (migration 328)
# GET/Search endpoints available for agent two-pass architecture
from app.api.v4.resources.temperature_levels.get import (
    router as temperature_levels_get_router,
)
from app.api.v4.resources.temperature_levels.search import (
    router as temperature_levels_search_router,
)

router.include_router(temperature_levels_get_router)
router.include_router(temperature_levels_search_router)
# NOTE: templates removed - consolidated into documents (migration 444)
# NOTE: thresholds removed - non-creatable (migration 328)
# GET/Search endpoints available for two-pass architecture
from app.api.v4.resources.thresholds.get import router as thresholds_get_router
from app.api.v4.resources.thresholds.search import router as thresholds_search_router

router.include_router(thresholds_get_router)
router.include_router(thresholds_search_router)
# NOTE: times removed - converted to entry table (migration 305)
# NOTE: tools removed - non-creatable, sync via artifact save (migration 328)
# GET/Search endpoints available for agent two-pass architecture
from app.api.v4.resources.tools.get import router as tools_get_router
from app.api.v4.resources.tools.search import router as tools_search_router

router.include_router(tools_get_router)
router.include_router(tools_search_router)
from app.api.v4.resources.values.create import router as values_router
from app.api.v4.resources.values.get import router as values_get_router
from app.api.v4.resources.values.search import router as values_search_router

router.include_router(values_router)
router.include_router(values_get_router)
router.include_router(values_search_router)
from app.api.v4.resources.videos.create import router as videos_router
from app.api.v4.resources.videos.get import router as videos_get_router

router.include_router(videos_router)
router.include_router(videos_get_router)
from app.api.v4.resources.voices.create import router as voices_router
from app.api.v4.resources.voices.get import router as voices_get_router
from app.api.v4.resources.voices.link import router as voices_link_router

router.include_router(voices_router)
router.include_router(voices_get_router)
router.include_router(voices_link_router)
from app.api.v4.resources.voices.search import router as voices_search_router

router.include_router(voices_search_router)
from app.api.v4.resources.texts.create import router as texts_router
from app.api.v4.resources.texts.get import router as texts_get_router
from app.api.v4.resources.texts.search import router as texts_search_router

router.include_router(texts_router)
router.include_router(texts_get_router)
router.include_router(texts_search_router)
from app.api.v4.resources.uploads.create import router as uploads_router
from app.api.v4.resources.uploads.download import router as uploads_download_router
from app.api.v4.resources.uploads.get import router as uploads_get_router
from app.api.v4.resources.uploads.search import router as uploads_search_router
from app.api.v4.resources.uploads.upload import router as uploads_upload_router

router.include_router(uploads_router)
router.include_router(uploads_download_router)
router.include_router(uploads_get_router)
router.include_router(uploads_search_router)
router.include_router(uploads_upload_router)
