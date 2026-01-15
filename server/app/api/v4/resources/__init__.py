"""Resources v4 API routes."""

from fastapi import APIRouter

router = APIRouter(prefix="/resources", tags=["resources"])

# Include all resource routers
from app.api.v4.resources.agents.create import router as agents_router

router.include_router(agents_router)
from app.api.v4.resources.analyses.create import router as analyses_router

router.include_router(analyses_router)
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
from app.api.v4.resources.conditional_parameters.create import \
    router as conditional_parameters_router

router.include_router(conditional_parameters_router)
from app.api.v4.resources.contents.create import router as contents_router

router.include_router(contents_router)
from app.api.v4.resources.conversations.create import \
    router as conversations_router

router.include_router(conversations_router)
from app.api.v4.resources.debug_info.create import router as debug_info_router

router.include_router(debug_info_router)
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
from app.api.v4.resources.feedbacks.create import router as feedbacks_router

router.include_router(feedbacks_router)
from app.api.v4.resources.fields.create import router as fields_router

router.include_router(fields_router)
from app.api.v4.resources.flags.create import router as flags_router

router.include_router(flags_router)
from app.api.v4.resources.group_positions.create import \
    router as group_positions_router

router.include_router(group_positions_router)
from app.api.v4.resources.groups.create import router as groups_router

router.include_router(groups_router)
from app.api.v4.resources.groups_rubric_grade_agents.create import \
    router as groups_rubric_grade_agents_router

router.include_router(groups_rubric_grade_agents_router)
from app.api.v4.resources.hints.create import router as hints_router

router.include_router(hints_router)
from app.api.v4.resources.html.create import router as html_router

router.include_router(html_router)
from app.api.v4.resources.icons.create import router as icons_router

router.include_router(icons_router)
from app.api.v4.resources.images.create import router as images_router

router.include_router(images_router)
from app.api.v4.resources.improvements.create import \
    router as improvements_router

router.include_router(improvements_router)
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
from app.api.v4.resources.responses.create import router as responses_router

router.include_router(responses_router)
from app.api.v4.resources.rubrics.create import router as rubrics_router

router.include_router(rubrics_router)
from app.api.v4.resources.run_positions.create import \
    router as run_positions_router

router.include_router(run_positions_router)
from app.api.v4.resources.runs.create import router as runs_router

router.include_router(runs_router)
from app.api.v4.resources.runs_rubric_grade_agents.create import \
    router as runs_rubric_grade_agents_router

router.include_router(runs_rubric_grade_agents_router)
from app.api.v4.resources.ranges.create import router as ranges_router

router.include_router(ranges_router)
from app.api.v4.resources.scenario_flags.create import \
    router as scenario_flags_router

router.include_router(scenario_flags_router)
from app.api.v4.resources.scenario_positions.create import \
    router as scenario_positions_router

router.include_router(scenario_positions_router)
from app.api.v4.resources.scenario_rubric_grade_agents.create import \
    router as scenario_rubric_grade_agents_router

router.include_router(scenario_rubric_grade_agents_router)
from app.api.v4.resources.scenarios.create import router as scenarios_router

router.include_router(scenarios_router)
from app.api.v4.resources.schema_field_items.create import \
    router as schema_field_items_router

router.include_router(schema_field_items_router)
from app.api.v4.resources.schema_fields.create import \
    router as schema_fields_router

router.include_router(schema_fields_router)
from app.api.v4.resources.schemas.create import router as schemas_router

router.include_router(schemas_router)
from app.api.v4.resources.settings.create import router as settings_router

router.include_router(settings_router)
from app.api.v4.resources.simulation_scenario_flags.create import \
    router as simulation_scenario_flags_router

router.include_router(simulation_scenario_flags_router)
from app.api.v4.resources.simulations.create import \
    router as simulations_router

router.include_router(simulations_router)
from app.api.v4.resources.slugs.create import router as slugs_router

router.include_router(slugs_router)
from app.api.v4.resources.standard_groups.create import \
    router as standard_groups_router

router.include_router(standard_groups_router)
from app.api.v4.resources.strengths.create import router as strengths_router

router.include_router(strengths_router)
from app.api.v4.resources.temperature_levels.create import \
    router as temperature_levels_router

router.include_router(temperature_levels_router)
from app.api.v4.resources.template_array_items.create import \
    router as template_array_items_router

router.include_router(template_array_items_router)
from app.api.v4.resources.template_values.create import \
    router as template_values_router

router.include_router(template_values_router)
from app.api.v4.resources.templates.create import router as templates_router

router.include_router(templates_router)
from app.api.v4.resources.texts.create import router as texts_router

router.include_router(texts_router)
from app.api.v4.resources.thresholds.create import router as thresholds_router

router.include_router(thresholds_router)
from app.api.v4.resources.times.create import router as times_router

router.include_router(times_router)
from app.api.v4.resources.tools.create import router as tools_router

router.include_router(tools_router)
from app.api.v4.resources.values.create import router as values_router

router.include_router(values_router)
from app.api.v4.resources.videos.create import router as videos_router

router.include_router(videos_router)
from app.api.v4.resources.voices.create import router as voices_router

router.include_router(voices_router)
