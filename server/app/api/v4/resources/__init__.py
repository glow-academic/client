"""Resources v4 API routes."""

from fastapi import APIRouter

router = APIRouter(prefix="/resources", tags=["resources"])

# Include all resource routers
from app.api.v4.resources.agents.create import router as agents_router

router.include_router(agents_router)
# NOTE: analyses removed - converted to entry table (migration 305)
from app.api.v4.resources.args.create import router as args_router

router.include_router(args_router)
from app.api.v4.resources.args_outputs.create import \
    router as args_outputs_router

router.include_router(args_outputs_router)
from app.api.v4.resources.audios.create import router as audios_router

router.include_router(audios_router)
from app.api.v4.resources.auths.create import router as auths_router

router.include_router(auths_router)
from app.api.v4.resources.cohorts.create import router as cohorts_router

router.include_router(cohorts_router)
from app.api.v4.resources.colors.create import router as colors_router

router.include_router(colors_router)
# NOTE: contents removed - converted to entry table (migration 305)
# NOTE: conversations removed - converted to entry table (migration 305)
from app.api.v4.resources.departments.create import \
    router as departments_router

router.include_router(departments_router)
from app.api.v4.resources.descriptions.create import \
    router as descriptions_router

router.include_router(descriptions_router)
from app.api.v4.resources.documents.create import router as documents_router

router.include_router(documents_router)
from app.api.v4.resources.emails.create import router as emails_router

router.include_router(emails_router)
from app.api.v4.resources.endpoints.create import router as endpoints_router

router.include_router(endpoints_router)
from app.api.v4.resources.evals.create import router as evals_router

router.include_router(evals_router)
from app.api.v4.resources.examples.create import router as examples_router

router.include_router(examples_router)
# NOTE: feedbacks removed - converted to entry table (migration 305)
from app.api.v4.resources.fields.create import router as fields_router

router.include_router(fields_router)
from app.api.v4.resources.persona_fields.create import \
    router as persona_fields_router

router.include_router(persona_fields_router)
from app.api.v4.resources.document_fields.create import \
    router as document_fields_router

router.include_router(document_fields_router)
from app.api.v4.resources.parameter_fields.create import \
    router as parameter_fields_router

router.include_router(parameter_fields_router)
from app.api.v4.resources.flags.create import router as flags_router

router.include_router(flags_router)
from app.api.v4.resources.group_positions.create import \
    router as group_positions_router

router.include_router(group_positions_router)
from app.api.v4.resources.group_rubrics.create import \
    router as group_rubrics_router

router.include_router(group_rubrics_router)
from app.api.v4.resources.groups.create import router as groups_router

router.include_router(groups_router)
# NOTE: hints removed - converted to entry table (migration 305)
from app.api.v4.resources.icons.create import router as icons_router

router.include_router(icons_router)
from app.api.v4.resources.images.create import router as images_router

router.include_router(images_router)
# NOTE: improvements removed - converted to entry table (migration 305)
from app.api.v4.resources.instructions.create import \
    router as instructions_router

router.include_router(instructions_router)
from app.api.v4.resources.items.create import router as items_router

router.include_router(items_router)
from app.api.v4.resources.keys.create import router as keys_router

router.include_router(keys_router)
from app.api.v4.resources.modalities.create import router as modalities_router

router.include_router(modalities_router)
from app.api.v4.resources.models.create import router as models_router

router.include_router(models_router)
from app.api.v4.resources.names.create import router as names_router

router.include_router(names_router)
from app.api.v4.resources.objectives.create import router as objectives_router

router.include_router(objectives_router)
from app.api.v4.resources.options.create import router as options_router

router.include_router(options_router)
from app.api.v4.resources.parameters.create import router as parameters_router

router.include_router(parameters_router)
from app.api.v4.resources.personas.create import router as personas_router

router.include_router(personas_router)
from app.api.v4.resources.points.create import router as points_router

router.include_router(points_router)
from app.api.v4.resources.pricing.create import router as pricing_router

router.include_router(pricing_router)
from app.api.v4.resources.problem_statements.create import \
    router as problem_statements_router

router.include_router(problem_statements_router)
from app.api.v4.resources.profiles.create import router as profiles_router

router.include_router(profiles_router)
from app.api.v4.resources.prompts.create import router as prompts_router

router.include_router(prompts_router)
from app.api.v4.resources.protocols.create import router as protocols_router

router.include_router(protocols_router)
from app.api.v4.resources.providers.create import router as providers_router

router.include_router(providers_router)
from app.api.v4.resources.qualities.create import router as qualities_router

router.include_router(qualities_router)
from app.api.v4.resources.questions.create import router as questions_router

router.include_router(questions_router)
from app.api.v4.resources.reasoning_levels.create import \
    router as reasoning_levels_router

router.include_router(reasoning_levels_router)
from app.api.v4.resources.request_limits.create import \
    router as request_limits_router

router.include_router(request_limits_router)
# NOTE: responses removed - converted to entry table (migration 305)
from app.api.v4.resources.rubrics.create import router as rubrics_router

router.include_router(rubrics_router)
from app.api.v4.resources.run_positions.create import \
    router as run_positions_router

router.include_router(run_positions_router)
from app.api.v4.resources.run_rubrics.create import \
    router as run_rubrics_router

router.include_router(run_rubrics_router)
from app.api.v4.resources.runs.create import router as runs_router

router.include_router(runs_router)

from app.api.v4.resources.scenario_flags.create import \
    router as scenario_flags_router

router.include_router(scenario_flags_router)
from app.api.v4.resources.setting_role_routes.create import \
    router as setting_role_routes_router

router.include_router(setting_role_routes_router)
from app.api.v4.resources.scenario_positions.create import \
    router as scenario_positions_router

router.include_router(scenario_positions_router)
from app.api.v4.resources.scenario_rubrics.create import \
    router as scenario_rubrics_router

router.include_router(scenario_rubrics_router)
from app.api.v4.resources.scenario_time_limits.create import \
    router as scenario_time_limits_router

router.include_router(scenario_time_limits_router)
from app.api.v4.resources.scenarios.create import router as scenarios_router

router.include_router(scenarios_router)
from app.api.v4.resources.settings.create import router as settings_router

router.include_router(settings_router)
from app.api.v4.resources.simulation_positions.create import \
    router as simulation_positions_router

router.include_router(simulation_positions_router)
from app.api.v4.resources.simulations.create import \
    router as simulations_router

router.include_router(simulations_router)
from app.api.v4.resources.slugs.create import router as slugs_router

router.include_router(slugs_router)
from app.api.v4.resources.standard_groups.create import \
    router as standard_groups_router

router.include_router(standard_groups_router)
from app.api.v4.resources.standards.create import router as standards_router

router.include_router(standards_router)
# NOTE: strengths removed - converted to entry table (migration 305)
from app.api.v4.resources.temperature_levels.create import \
    router as temperature_levels_router

router.include_router(temperature_levels_router)
from app.api.v4.resources.templates.create import router as templates_router

router.include_router(templates_router)
from app.api.v4.resources.thresholds.create import router as thresholds_router

router.include_router(thresholds_router)
# NOTE: times removed - converted to entry table (migration 305)
from app.api.v4.resources.tools.create import router as tools_router

router.include_router(tools_router)
from app.api.v4.resources.values.create import router as values_router

router.include_router(values_router)
from app.api.v4.resources.videos.create import router as videos_router

router.include_router(videos_router)
from app.api.v4.resources.voices.create import router as voices_router

router.include_router(voices_router)
from app.api.v4.resources.uploads.create import router as uploads_router

router.include_router(uploads_router)
