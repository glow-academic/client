"""Resources v4 API routes."""

from fastapi import APIRouter

router = APIRouter(prefix="/resources", tags=["resources"])

# Include all resource routers
# NOTE: agents removed - non-creatable, sync via artifact save (migration 328)
# NOTE: analyses removed - converted to entry table (migration 305)
from app.api.v4.resources.args.create import router as args_router
from app.api.v4.resources.args.get import router as args_get_router

router.include_router(args_router)
router.include_router(args_get_router)
from app.api.v4.resources.args_outputs.create import router as args_outputs_router
from app.api.v4.resources.args_outputs.get import router as args_outputs_get_router

router.include_router(args_outputs_router)
router.include_router(args_outputs_get_router)
# NOTE: audios removed - converted to audios_entry (migration 328)
# NOTE: auths removed - non-creatable, sync via artifact save (migration 328)
# NOTE: cohorts removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for profile context two-pass architecture
from app.api.v4.resources.cohorts.get import router as cohorts_get_router

router.include_router(cohorts_get_router)
from app.api.v4.resources.colors.create import router as colors_router
from app.api.v4.resources.colors.get import router as colors_get_router
from app.api.v4.resources.colors.search import router as colors_search_router

router.include_router(colors_router)
router.include_router(colors_get_router)
router.include_router(colors_search_router)
# NOTE: contents removed - converted to entry table (migration 305)
# NOTE: conversations removed - converted to entry table (migration 305)
# NOTE: departments removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for personas two-pass architecture
from app.api.v4.resources.departments.get import router as departments_get_router
from app.api.v4.resources.departments.search import router as departments_search_router

router.include_router(departments_get_router)
router.include_router(departments_search_router)
from app.api.v4.resources.descriptions.create import router as descriptions_router
from app.api.v4.resources.descriptions.get import router as descriptions_get_router
from app.api.v4.resources.descriptions.search import (
    router as descriptions_search_router,
)

router.include_router(descriptions_router)
router.include_router(descriptions_get_router)
router.include_router(descriptions_search_router)
# NOTE: documents removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for scenarios two-pass architecture
from app.api.v4.resources.documents.get import router as documents_get_router

router.include_router(documents_get_router)
from app.api.v4.resources.emails.create import router as emails_router
from app.api.v4.resources.emails.get import router as emails_get_router

router.include_router(emails_router)
router.include_router(emails_get_router)
from app.api.v4.resources.endpoints.create import router as endpoints_router
from app.api.v4.resources.endpoints.get import router as endpoints_get_router

router.include_router(endpoints_router)
router.include_router(endpoints_get_router)
# NOTE: evals removed - non-creatable, sync via artifact save (migration 328)
from app.api.v4.resources.examples.create import router as examples_router
from app.api.v4.resources.examples.get import router as examples_get_router
from app.api.v4.resources.examples.search import router as examples_search_router

router.include_router(examples_router)
router.include_router(examples_get_router)
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
from app.api.v4.resources.parameter_fields.search import (
    router as parameter_fields_search_router,
)

router.include_router(parameter_fields_create_router)
router.include_router(parameter_fields_get_router)
router.include_router(parameter_fields_search_router)
# NOTE: persona_fields removed - non-creatable (migration 328)
# NOTE: document_fields removed - non-creatable (migration 328)
# NOTE: flags removed - non-creatable (migration 328)
# GET endpoint available for personas two-pass architecture
from app.api.v4.resources.flags.get import router as flags_get_router
from app.api.v4.resources.flags.search import router as flags_search_router

router.include_router(flags_get_router)
router.include_router(flags_search_router)
from app.api.v4.resources.group_positions.create import router as group_positions_router
from app.api.v4.resources.group_positions.get import (
    router as group_positions_get_router,
)

router.include_router(group_positions_router)
router.include_router(group_positions_get_router)
from app.api.v4.resources.group_rubrics.create import router as group_rubrics_router
from app.api.v4.resources.group_rubrics.get import router as group_rubrics_get_router

router.include_router(group_rubrics_router)
router.include_router(group_rubrics_get_router)
# NOTE: groups removed - non-creatable (migration 328)
# NOTE: hints removed - converted to entry table (migration 305)
# NOTE: icons removed - non-creatable (migration 328)
# GET endpoint available for personas two-pass architecture
from app.api.v4.resources.icons.get import router as icons_get_router
from app.api.v4.resources.icons.search import router as icons_search_router

router.include_router(icons_get_router)
router.include_router(icons_search_router)
from app.api.v4.resources.images.create import router as images_router
from app.api.v4.resources.images.get import router as images_get_router

router.include_router(images_router)
router.include_router(images_get_router)
# NOTE: improvements removed - converted to entry table (migration 305)
from app.api.v4.resources.instructions.create import router as instructions_router
from app.api.v4.resources.instructions.get import router as instructions_get_router
from app.api.v4.resources.instructions.search import (
    router as instructions_search_router,
)

router.include_router(instructions_router)
router.include_router(instructions_get_router)
router.include_router(instructions_search_router)
from app.api.v4.resources.items.create import router as items_router
from app.api.v4.resources.items.get import router as items_get_router

router.include_router(items_router)
router.include_router(items_get_router)
from app.api.v4.resources.keys.create import router as keys_router
from app.api.v4.resources.keys.decrypt import router as keys_decrypt_router
from app.api.v4.resources.keys.get import router as keys_get_router

router.include_router(keys_router)
router.include_router(keys_decrypt_router)
router.include_router(keys_get_router)
# NOTE: modalities removed - non-creatable (migration 328)
# NOTE: models removed - non-creatable, sync via artifact save (migration 328)
from app.api.v4.resources.names.create import router as names_router
from app.api.v4.resources.names.get import router as names_get_router
from app.api.v4.resources.names.search import router as names_search_router

router.include_router(names_router)
router.include_router(names_get_router)
router.include_router(names_search_router)
from app.api.v4.resources.objectives.create import router as objectives_router
from app.api.v4.resources.objectives.get import router as objectives_get_router

router.include_router(objectives_router)
router.include_router(objectives_get_router)
from app.api.v4.resources.options.create import router as options_router
from app.api.v4.resources.options.get import router as options_get_router

router.include_router(options_router)
router.include_router(options_get_router)
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
from app.api.v4.resources.points.create import router as points_router
from app.api.v4.resources.points.get import router as points_get_router

router.include_router(points_router)
router.include_router(points_get_router)
from app.api.v4.resources.pricing.create import router as pricing_router
from app.api.v4.resources.pricing.get import router as pricing_get_router

router.include_router(pricing_router)
router.include_router(pricing_get_router)
from app.api.v4.resources.problem_statements.create import (
    router as problem_statements_router,
)
from app.api.v4.resources.problem_statements.get import (
    router as problem_statements_get_router,
)

router.include_router(problem_statements_router)
router.include_router(problem_statements_get_router)
# NOTE: profiles removed - non-creatable, sync via artifact save (migration 328)
from app.api.v4.resources.prompts.create import router as prompts_router
from app.api.v4.resources.prompts.get import router as prompts_get_router

router.include_router(prompts_router)
router.include_router(prompts_get_router)
from app.api.v4.resources.protocols.create import router as protocols_router
from app.api.v4.resources.protocols.get import router as protocols_get_router

router.include_router(protocols_router)
router.include_router(protocols_get_router)
# NOTE: providers removed - non-creatable, sync via artifact save (migration 328)
# NOTE: qualities removed - non-creatable (migration 328)
from app.api.v4.resources.questions.create import router as questions_router
from app.api.v4.resources.questions.get import router as questions_get_router

router.include_router(questions_router)
router.include_router(questions_get_router)
# NOTE: reasoning_levels removed - non-creatable (migration 328)
from app.api.v4.resources.request_limits.create import router as request_limits_router
from app.api.v4.resources.request_limits.get import router as request_limits_get_router

router.include_router(request_limits_router)
router.include_router(request_limits_get_router)
# NOTE: responses removed - converted to entry table (migration 305)
# NOTE: roles removed - non-creatable (migration 328)
# GET endpoint available for profile context two-pass architecture
from app.api.v4.resources.roles.get import router as roles_get_router

router.include_router(roles_get_router)
# NOTE: rubrics removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for simulations two-pass architecture
from app.api.v4.resources.rubrics.get import router as rubrics_get_router

router.include_router(rubrics_get_router)
from app.api.v4.resources.run_positions.create import router as run_positions_router
from app.api.v4.resources.run_positions.get import router as run_positions_get_router

router.include_router(run_positions_router)
router.include_router(run_positions_get_router)
from app.api.v4.resources.run_rubrics.create import router as run_rubrics_router
from app.api.v4.resources.run_rubrics.get import router as run_rubrics_get_router

router.include_router(run_rubrics_router)
router.include_router(run_rubrics_get_router)
# NOTE: runs removed - non-creatable (migration 328)
# NOTE: scenario_flags removed - non-creatable (migration 328)
# GET/Search endpoints available for simulations two-pass architecture
from app.api.v4.resources.scenario_flags.get import router as scenario_flags_get_router
from app.api.v4.resources.scenario_flags.search import (
    router as scenario_flags_search_router,
)

router.include_router(scenario_flags_get_router)
router.include_router(scenario_flags_search_router)
from app.api.v4.resources.setting_role_routes.create import (
    router as setting_role_routes_router,
)

router.include_router(setting_role_routes_router)
from app.api.v4.resources.scenario_personas.create import (
    router as scenario_personas_router,
)
from app.api.v4.resources.scenario_personas.get import (
    router as scenario_personas_get_router,
)
from app.api.v4.resources.scenario_personas.search import (
    router as scenario_personas_search_router,
)

router.include_router(scenario_personas_router)
router.include_router(scenario_personas_get_router)
router.include_router(scenario_personas_search_router)
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
# NOTE: scenarios removed - non-creatable, sync via artifact save (migration 328)
# GET/Search endpoints available for simulations two-pass architecture
from app.api.v4.resources.scenarios import router as scenarios_router

router.include_router(scenarios_router)
# NOTE: settings removed - non-creatable, sync via artifact save (migration 328)
# GET endpoint available for profile context two-pass architecture
from app.api.v4.resources.settings.get import router as settings_get_router

router.include_router(settings_get_router)
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
# NOTE: simulations removed - non-creatable, sync via artifact save (migration 328)
# GET/Search endpoints available for cohorts two-pass architecture
from app.api.v4.resources.simulations.get import router as simulations_get_router
from app.api.v4.resources.simulations.search import router as simulations_search_router

router.include_router(simulations_get_router)
router.include_router(simulations_search_router)
from app.api.v4.resources.slugs.create import router as slugs_router
from app.api.v4.resources.slugs.get import router as slugs_get_router

router.include_router(slugs_router)
router.include_router(slugs_get_router)
from app.api.v4.resources.standard_groups.create import router as standard_groups_router

router.include_router(standard_groups_router)
# NOTE: standards removed - non-creatable (migration 328)
# NOTE: strengths removed - converted to entry table (migration 305)
# NOTE: temperature_levels removed - non-creatable (migration 328)
from app.api.v4.resources.templates.create import router as templates_router
from app.api.v4.resources.templates.get import router as templates_get_router
from app.api.v4.resources.templates.html import router as templates_html_router
from app.api.v4.resources.templates.search import router as templates_search_router

router.include_router(templates_router)
router.include_router(templates_get_router)
router.include_router(templates_html_router)
router.include_router(templates_search_router)
# NOTE: thresholds removed - non-creatable (migration 328)
# NOTE: times removed - converted to entry table (migration 305)
# NOTE: tools removed - non-creatable, sync via artifact save (migration 328)
from app.api.v4.resources.values.create import router as values_router
from app.api.v4.resources.values.get import router as values_get_router

router.include_router(values_router)
router.include_router(values_get_router)
from app.api.v4.resources.videos.create import router as videos_router
from app.api.v4.resources.videos.get import router as videos_get_router

router.include_router(videos_router)
router.include_router(videos_get_router)
from app.api.v4.resources.voices.create import router as voices_router
from app.api.v4.resources.voices.get import router as voices_get_router

router.include_router(voices_router)
router.include_router(voices_get_router)
from app.api.v4.resources.uploads.create import router as uploads_router
from app.api.v4.resources.uploads.download import router as uploads_download_router
from app.api.v4.resources.uploads.get import router as uploads_get_router
from app.api.v4.resources.uploads.upload import router as uploads_upload_router

router.include_router(uploads_router)
router.include_router(uploads_download_router)
router.include_router(uploads_get_router)
router.include_router(uploads_upload_router)
