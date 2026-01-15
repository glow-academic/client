"""Resources v4 API routes."""

from app.api.v4.resources.args import router as args_router
from app.api.v4.resources.args_outputs import router as args_outputs_router
from app.api.v4.resources.agents import router as agents_router
from app.api.v4.resources.analyses import router as analyses_router
from app.api.v4.resources.auths import router as auths_router
from app.api.v4.resources.audios import router as audios_router
from app.api.v4.resources.cohorts import router as cohorts_router
from app.api.v4.resources.colors import router as colors_router
from app.api.v4.resources.conditional_parameters import (
    router as conditional_parameters_router,
)
from app.api.v4.resources.contents import router as contents_router
from app.api.v4.resources.conversations import router as conversations_router
from app.api.v4.resources.debug_info import router as debug_info_router
from app.api.v4.resources.departments import router as departments_router
from app.api.v4.resources.descriptions import router as descriptions_router
from app.api.v4.resources.documents import router as documents_router
from app.api.v4.resources.emails import router as emails_router
from app.api.v4.resources.endpoints import router as endpoints_router
from app.api.v4.resources.evals import router as evals_router
from app.api.v4.resources.examples import router as examples_router
from app.api.v4.resources.fields import router as fields_router
from app.api.v4.resources.feedbacks import router as feedbacks_router
from app.api.v4.resources.flags import router as flags_router
from app.api.v4.resources.group_positions import router as group_positions_router
from app.api.v4.resources.groups import router as groups_router
from app.api.v4.resources.groups_rubric_grade_agents import (
    router as groups_rubric_grade_agents_router,
)
from app.api.v4.resources.hints import router as hints_router
from app.api.v4.resources.html import router as html_router
from app.api.v4.resources.icons import router as icons_router
from app.api.v4.resources.images import router as images_router
from app.api.v4.resources.improvements import router as improvements_router
from app.api.v4.resources.items import router as items_router
from app.api.v4.resources.instructions import router as instructions_router
from app.api.v4.resources.keys import router as keys_router
from app.api.v4.resources.models import router as models_router
from app.api.v4.resources.modalities import router as modalities_router
from app.api.v4.resources.names import router as names_router
from app.api.v4.resources.objectives import router as objectives_router
from app.api.v4.resources.options import router as options_router
from app.api.v4.resources.parameters import router as parameters_router
from app.api.v4.resources.personas import router as personas_router
from app.api.v4.resources.points import router as points_router
from app.api.v4.resources.pricing import router as pricing_router
from app.api.v4.resources.problem_statements import router as problem_statements_router
from app.api.v4.resources.profiles import router as profiles_router
from app.api.v4.resources.protocols import router as protocols_router
from app.api.v4.resources.providers import router as providers_router
from app.api.v4.resources.prompts import router as prompts_router
from app.api.v4.resources.qualities import router as qualities_router
from app.api.v4.resources.questions import router as questions_router
from app.api.v4.resources.reasoning_levels import router as reasoning_levels_router
from app.api.v4.resources.request_limits import router as request_limits_router
from app.api.v4.resources.responses import router as responses_router
from app.api.v4.resources.rubrics import router as rubrics_router
from app.api.v4.resources.run_positions import router as run_positions_router
from app.api.v4.resources.runs import router as runs_router
from app.api.v4.resources.runs_rubric_grade_agents import (
    router as runs_rubric_grade_agents_router,
)
from app.api.v4.resources.schema_field_items import router as schema_field_items_router
from app.api.v4.resources.schema_fields import router as schema_fields_router
from app.api.v4.resources.schemas import router as schemas_router
from app.api.v4.resources.scenario_flags import router as scenario_flags_router
from app.api.v4.resources.scenario_positions import router as scenario_positions_router
from app.api.v4.resources.scenario_rubric_grade_agents import (
    router as scenario_rubric_grade_agents_router,
)
from app.api.v4.resources.scenarios import router as scenarios_router
from app.api.v4.resources.slugs import router as slugs_router
from app.api.v4.resources.settings import router as settings_router
from app.api.v4.resources.simulation_scenario_flags import (
    router as simulation_scenario_flags_router,
)
from app.api.v4.resources.simulations import router as simulations_router
from app.api.v4.resources.standard_groups import router as standard_groups_router
from app.api.v4.resources.strengths import router as strengths_router
from app.api.v4.resources.template_array_items import (
    router as template_array_items_router,
)
from app.api.v4.resources.template_values import router as template_values_router
from app.api.v4.resources.templates import router as templates_router
from app.api.v4.resources.temperature_levels import router as temperature_levels_router
from app.api.v4.resources.texts import router as texts_router
from app.api.v4.resources.thresholds import router as thresholds_router
from app.api.v4.resources.times import router as times_router
from app.api.v4.resources.tools import router as tools_router
from app.api.v4.resources.values import router as values_router
from app.api.v4.resources.videos import router as videos_router
from app.api.v4.resources.voices import router as voices_router
from fastapi import APIRouter

router = APIRouter(prefix="/resources", tags=["resources"])

# Include endpoint routers
router.include_router(args_router)
router.include_router(args_outputs_router)
router.include_router(agents_router)
router.include_router(analyses_router)
router.include_router(auths_router)
router.include_router(audios_router)
router.include_router(cohorts_router)
router.include_router(evals_router)
router.include_router(keys_router)
router.include_router(models_router)
router.include_router(parameters_router)
router.include_router(personas_router)
router.include_router(profiles_router)
router.include_router(rubrics_router)
router.include_router(scenario_positions_router)
router.include_router(scenario_rubric_grade_agents_router)
router.include_router(scenarios_router)
router.include_router(settings_router)
router.include_router(simulation_scenario_flags_router)
router.include_router(simulations_router)
router.include_router(names_router)
router.include_router(colors_router)
router.include_router(conditional_parameters_router)
router.include_router(contents_router)
router.include_router(conversations_router)
router.include_router(debug_info_router)
router.include_router(departments_router)
router.include_router(descriptions_router)
router.include_router(documents_router)
router.include_router(emails_router)
router.include_router(endpoints_router)
router.include_router(evals_router)
router.include_router(examples_router)
router.include_router(feedbacks_router)
router.include_router(fields_router)
router.include_router(flags_router)
router.include_router(group_positions_router)
router.include_router(groups_router)
router.include_router(groups_rubric_grade_agents_router)
router.include_router(hints_router)
router.include_router(html_router)
router.include_router(icons_router)
router.include_router(thresholds_router)
router.include_router(contents_router)
router.include_router(html_router)
router.include_router(hints_router)
router.include_router(images_router)
router.include_router(improvements_router)
router.include_router(instructions_router)
router.include_router(items_router)
router.include_router(keys_router)
router.include_router(models_router)
router.include_router(modalities_router)
router.include_router(names_router)
router.include_router(objectives_router)
router.include_router(options_router)
router.include_router(parameters_router)
router.include_router(personas_router)
router.include_router(points_router)
router.include_router(pricing_router)
router.include_router(problem_statements_router)
router.include_router(profiles_router)
router.include_router(prompts_router)
router.include_router(protocols_router)
router.include_router(providers_router)
router.include_router(qualities_router)
router.include_router(questions_router)
router.include_router(reasoning_levels_router)
router.include_router(request_limits_router)
router.include_router(responses_router)
router.include_router(rubrics_router)
router.include_router(run_positions_router)
router.include_router(runs_router)
router.include_router(runs_rubric_grade_agents_router)
router.include_router(scenario_flags_router)
router.include_router(scenario_positions_router)
router.include_router(scenario_rubric_grade_agents_router)
router.include_router(scenarios_router)
router.include_router(schema_field_items_router)
router.include_router(schema_fields_router)
router.include_router(schemas_router)
router.include_router(settings_router)
router.include_router(simulation_scenario_flags_router)
router.include_router(simulations_router)
router.include_router(slugs_router)
router.include_router(standard_groups_router)
router.include_router(strengths_router)
router.include_router(feedbacks_router)
router.include_router(template_array_items_router)
router.include_router(template_values_router)
router.include_router(templates_router)
router.include_router(temperature_levels_router)
router.include_router(texts_router)
router.include_router(thresholds_router)
router.include_router(times_router)
router.include_router(tools_router)
router.include_router(values_router)
router.include_router(videos_router)
router.include_router(voices_router)
router.include_router(schema_fields_router)
router.include_router(schema_field_items_router)
router.include_router(templates_router)
router.include_router(template_array_items_router)
router.include_router(template_values_router)
router.include_router(standard_groups_router)
router.include_router(times_router)
