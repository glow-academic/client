"""Resource event dispatcher - routes internal_sio events to per-resource handlers.

Registers listeners on generate_call_complete, generate_call_start, generate_call_progress,
and generate_call_error. Routes to the appropriate per-resource handler based on resource_type.

All four event types (start, progress, complete, error) are routed through per-resource
handler files for architectural consistency and strong typing.
"""

from collections.abc import Awaitable, Callable
from typing import Any

from app.main import get_internal_sio
from app.socket.v4.resources.agents.complete import (
    handle_complete as agents_complete,
)
from app.socket.v4.resources.agents.error import handle_error as agents_error
from app.socket.v4.resources.agents.progress import (
    handle_progress as agents_progress,
)
from app.socket.v4.resources.agents.start import handle_start as agents_start
from app.socket.v4.resources.arg_positions.complete import (
    handle_complete as arg_positions_complete,
)
from app.socket.v4.resources.arg_positions.error import handle_error as arg_positions_error
from app.socket.v4.resources.arg_positions.progress import (
    handle_progress as arg_positions_progress,
)
from app.socket.v4.resources.arg_positions.start import handle_start as arg_positions_start
from app.socket.v4.resources.args.complete import (
    handle_complete as args_complete,
)
from app.socket.v4.resources.args.error import handle_error as args_error
from app.socket.v4.resources.args.progress import (
    handle_progress as args_progress,
)
from app.socket.v4.resources.args.start import handle_start as args_start
from app.socket.v4.resources.args_outputs.complete import (
    handle_complete as args_outputs_complete,
)
from app.socket.v4.resources.args_outputs.error import handle_error as args_outputs_error
from app.socket.v4.resources.args_outputs.progress import (
    handle_progress as args_outputs_progress,
)
from app.socket.v4.resources.args_outputs.start import handle_start as args_outputs_start
from app.socket.v4.resources.auth_item_keys.complete import (
    handle_complete as auth_item_keys_complete,
)
from app.socket.v4.resources.auth_item_keys.error import handle_error as auth_item_keys_error
from app.socket.v4.resources.auth_item_keys.progress import (
    handle_progress as auth_item_keys_progress,
)
from app.socket.v4.resources.auth_item_keys.start import handle_start as auth_item_keys_start
from app.socket.v4.resources.auths.complete import (
    handle_complete as auths_complete,
)
from app.socket.v4.resources.auths.error import handle_error as auths_error
from app.socket.v4.resources.auths.progress import (
    handle_progress as auths_progress,
)
from app.socket.v4.resources.auths.start import handle_start as auths_start
from app.socket.v4.resources.bindings.complete import (
    handle_complete as bindings_complete,
)
from app.socket.v4.resources.bindings.error import handle_error as bindings_error
from app.socket.v4.resources.bindings.progress import (
    handle_progress as bindings_progress,
)
from app.socket.v4.resources.bindings.start import handle_start as bindings_start
from app.socket.v4.resources.cohorts.complete import (
    handle_complete as cohorts_complete,
)
from app.socket.v4.resources.cohorts.error import handle_error as cohorts_error
from app.socket.v4.resources.cohorts.progress import (
    handle_progress as cohorts_progress,
)
from app.socket.v4.resources.cohorts.start import handle_start as cohorts_start
from app.socket.v4.resources.colors.complete import (
    handle_complete as colors_complete,
)
from app.socket.v4.resources.colors.error import handle_error as colors_error
from app.socket.v4.resources.colors.progress import (
    handle_progress as colors_progress,
)
from app.socket.v4.resources.colors.start import handle_start as colors_start
from app.socket.v4.resources.conditional_parameters.complete import (
    handle_complete as conditional_parameters_complete,
)
from app.socket.v4.resources.conditional_parameters.error import handle_error as conditional_parameters_error
from app.socket.v4.resources.conditional_parameters.progress import (
    handle_progress as conditional_parameters_progress,
)
from app.socket.v4.resources.conditional_parameters.start import handle_start as conditional_parameters_start
from app.socket.v4.resources.departments.complete import (
    handle_complete as departments_complete,
)
from app.socket.v4.resources.departments.error import handle_error as departments_error
from app.socket.v4.resources.departments.progress import (
    handle_progress as departments_progress,
)
from app.socket.v4.resources.departments.start import handle_start as departments_start
from app.socket.v4.resources.descriptions.complete import (
    handle_complete as descriptions_complete,
)
from app.socket.v4.resources.descriptions.error import handle_error as descriptions_error
from app.socket.v4.resources.descriptions.progress import (
    handle_progress as descriptions_progress,
)
from app.socket.v4.resources.descriptions.start import handle_start as descriptions_start
from app.socket.v4.resources.documents.complete import (
    handle_complete as documents_complete,
)
from app.socket.v4.resources.documents.error import handle_error as documents_error
from app.socket.v4.resources.documents.progress import (
    handle_progress as documents_progress,
)
from app.socket.v4.resources.documents.start import handle_start as documents_start
from app.socket.v4.resources.domains.complete import (
    handle_complete as domains_complete,
)
from app.socket.v4.resources.domains.error import handle_error as domains_error
from app.socket.v4.resources.domains.progress import (
    handle_progress as domains_progress,
)
from app.socket.v4.resources.domains.start import handle_start as domains_start
from app.socket.v4.resources.emails.complete import (
    handle_complete as emails_complete,
)
from app.socket.v4.resources.emails.error import handle_error as emails_error
from app.socket.v4.resources.emails.progress import (
    handle_progress as emails_progress,
)
from app.socket.v4.resources.emails.start import handle_start as emails_start
from app.socket.v4.resources.endpoints.complete import (
    handle_complete as endpoints_complete,
)
from app.socket.v4.resources.endpoints.error import handle_error as endpoints_error
from app.socket.v4.resources.endpoints.progress import (
    handle_progress as endpoints_progress,
)
from app.socket.v4.resources.endpoints.start import handle_start as endpoints_start
from app.socket.v4.resources.evals.complete import (
    handle_complete as evals_complete,
)
from app.socket.v4.resources.evals.error import handle_error as evals_error
from app.socket.v4.resources.evals.progress import (
    handle_progress as evals_progress,
)
from app.socket.v4.resources.evals.start import handle_start as evals_start
from app.socket.v4.resources.examples.complete import (
    handle_complete as examples_complete,
)
from app.socket.v4.resources.examples.error import handle_error as examples_error
from app.socket.v4.resources.examples.progress import (
    handle_progress as examples_progress,
)
from app.socket.v4.resources.examples.start import handle_start as examples_start
from app.socket.v4.resources.flags.complete import (
    handle_complete as flags_complete,
)
from app.socket.v4.resources.flags.error import handle_error as flags_error
from app.socket.v4.resources.flags.progress import (
    handle_progress as flags_progress,
)
from app.socket.v4.resources.flags.start import handle_start as flags_start
from app.socket.v4.resources.group_positions.complete import (
    handle_complete as group_positions_complete,
)
from app.socket.v4.resources.group_positions.error import handle_error as group_positions_error
from app.socket.v4.resources.group_positions.progress import (
    handle_progress as group_positions_progress,
)
from app.socket.v4.resources.group_positions.start import handle_start as group_positions_start
from app.socket.v4.resources.group_rubrics.complete import (
    handle_complete as group_rubrics_complete,
)
from app.socket.v4.resources.group_rubrics.error import handle_error as group_rubrics_error
from app.socket.v4.resources.group_rubrics.progress import (
    handle_progress as group_rubrics_progress,
)
from app.socket.v4.resources.group_rubrics.start import handle_start as group_rubrics_start
from app.socket.v4.resources.groups.complete import (
    handle_complete as groups_complete,
)
from app.socket.v4.resources.groups.error import handle_error as groups_error
from app.socket.v4.resources.groups.progress import (
    handle_progress as groups_progress,
)
from app.socket.v4.resources.groups.start import handle_start as groups_start
from app.socket.v4.resources.icons.complete import (
    handle_complete as icons_complete,
)
from app.socket.v4.resources.icons.error import handle_error as icons_error
from app.socket.v4.resources.icons.progress import (
    handle_progress as icons_progress,
)
from app.socket.v4.resources.icons.start import handle_start as icons_start
from app.socket.v4.resources.images.complete import (
    handle_complete as images_complete,
)
from app.socket.v4.resources.images.error import handle_error as images_error
from app.socket.v4.resources.images.progress import (
    handle_progress as images_progress,
)
from app.socket.v4.resources.images.start import handle_start as images_start
from app.socket.v4.resources.instructions.complete import (
    handle_complete as instructions_complete,
)
from app.socket.v4.resources.instructions.error import handle_error as instructions_error
from app.socket.v4.resources.instructions.progress import (
    handle_progress as instructions_progress,
)
from app.socket.v4.resources.instructions.start import handle_start as instructions_start
from app.socket.v4.resources.items.complete import (
    handle_complete as items_complete,
)
from app.socket.v4.resources.items.error import handle_error as items_error
from app.socket.v4.resources.items.progress import (
    handle_progress as items_progress,
)
from app.socket.v4.resources.items.start import handle_start as items_start
from app.socket.v4.resources.keys.complete import (
    handle_complete as keys_complete,
)
from app.socket.v4.resources.keys.error import handle_error as keys_error
from app.socket.v4.resources.keys.progress import (
    handle_progress as keys_progress,
)
from app.socket.v4.resources.keys.start import handle_start as keys_start
from app.socket.v4.resources.modalities.complete import (
    handle_complete as modalities_complete,
)
from app.socket.v4.resources.modalities.error import handle_error as modalities_error
from app.socket.v4.resources.modalities.progress import (
    handle_progress as modalities_progress,
)
from app.socket.v4.resources.modalities.start import handle_start as modalities_start
from app.socket.v4.resources.models.complete import (
    handle_complete as models_complete,
)
from app.socket.v4.resources.models.error import handle_error as models_error
from app.socket.v4.resources.models.progress import (
    handle_progress as models_progress,
)
from app.socket.v4.resources.models.start import handle_start as models_start
from app.socket.v4.resources.names.complete import (
    handle_complete as names_complete,
)
from app.socket.v4.resources.names.error import handle_error as names_error
from app.socket.v4.resources.names.progress import (
    handle_progress as names_progress,
)
from app.socket.v4.resources.names.start import handle_start as names_start
from app.socket.v4.resources.objectives.complete import (
    handle_complete as objectives_complete,
)
from app.socket.v4.resources.objectives.error import handle_error as objectives_error
from app.socket.v4.resources.objectives.progress import (
    handle_progress as objectives_progress,
)
from app.socket.v4.resources.objectives.start import handle_start as objectives_start
from app.socket.v4.resources.options.complete import (
    handle_complete as options_complete,
)
from app.socket.v4.resources.options.error import handle_error as options_error
from app.socket.v4.resources.options.progress import (
    handle_progress as options_progress,
)
from app.socket.v4.resources.options.start import handle_start as options_start
from app.socket.v4.resources.parameter_fields.complete import (
    handle_complete as parameter_fields_complete,
)
from app.socket.v4.resources.parameter_fields.error import handle_error as parameter_fields_error
from app.socket.v4.resources.parameter_fields.progress import (
    handle_progress as parameter_fields_progress,
)
from app.socket.v4.resources.parameter_fields.start import handle_start as parameter_fields_start
from app.socket.v4.resources.parameters.complete import (
    handle_complete as parameters_complete,
)
from app.socket.v4.resources.parameters.error import handle_error as parameters_error
from app.socket.v4.resources.parameters.progress import (
    handle_progress as parameters_progress,
)
from app.socket.v4.resources.parameters.start import handle_start as parameters_start
from app.socket.v4.resources.personas.complete import (
    handle_complete as personas_complete,
)
from app.socket.v4.resources.personas.error import handle_error as personas_error
from app.socket.v4.resources.personas.progress import (
    handle_progress as personas_progress,
)
from app.socket.v4.resources.personas.start import handle_start as personas_start
from app.socket.v4.resources.points.complete import (
    handle_complete as points_complete,
)
from app.socket.v4.resources.points.error import handle_error as points_error
from app.socket.v4.resources.points.progress import (
    handle_progress as points_progress,
)
from app.socket.v4.resources.points.start import handle_start as points_start
from app.socket.v4.resources.pricing.complete import (
    handle_complete as pricing_complete,
)
from app.socket.v4.resources.pricing.error import handle_error as pricing_error
from app.socket.v4.resources.pricing.progress import (
    handle_progress as pricing_progress,
)
from app.socket.v4.resources.pricing.start import handle_start as pricing_start
from app.socket.v4.resources.problem_statements.complete import (
    handle_complete as problem_statements_complete,
)
from app.socket.v4.resources.problem_statements.error import handle_error as problem_statements_error
from app.socket.v4.resources.problem_statements.progress import (
    handle_progress as problem_statements_progress,
)
from app.socket.v4.resources.problem_statements.start import handle_start as problem_statements_start
from app.socket.v4.resources.profiles.complete import (
    handle_complete as profiles_complete,
)
from app.socket.v4.resources.profiles.error import handle_error as profiles_error
from app.socket.v4.resources.profiles.progress import (
    handle_progress as profiles_progress,
)
from app.socket.v4.resources.profiles.start import handle_start as profiles_start
from app.socket.v4.resources.prompts.complete import (
    handle_complete as prompts_complete,
)
from app.socket.v4.resources.prompts.error import handle_error as prompts_error
from app.socket.v4.resources.prompts.progress import (
    handle_progress as prompts_progress,
)
from app.socket.v4.resources.prompts.start import handle_start as prompts_start
from app.socket.v4.resources.protocols.complete import (
    handle_complete as protocols_complete,
)
from app.socket.v4.resources.protocols.error import handle_error as protocols_error
from app.socket.v4.resources.protocols.progress import (
    handle_progress as protocols_progress,
)
from app.socket.v4.resources.protocols.start import handle_start as protocols_start
from app.socket.v4.resources.provider_keys.complete import (
    handle_complete as provider_keys_complete,
)
from app.socket.v4.resources.provider_keys.error import handle_error as provider_keys_error
from app.socket.v4.resources.provider_keys.progress import (
    handle_progress as provider_keys_progress,
)
from app.socket.v4.resources.provider_keys.start import handle_start as provider_keys_start
from app.socket.v4.resources.providers.complete import (
    handle_complete as providers_complete,
)
from app.socket.v4.resources.providers.error import handle_error as providers_error
from app.socket.v4.resources.providers.progress import (
    handle_progress as providers_progress,
)
from app.socket.v4.resources.providers.start import handle_start as providers_start
from app.socket.v4.resources.qualities.complete import (
    handle_complete as qualities_complete,
)
from app.socket.v4.resources.qualities.error import handle_error as qualities_error
from app.socket.v4.resources.qualities.progress import (
    handle_progress as qualities_progress,
)
from app.socket.v4.resources.qualities.start import handle_start as qualities_start
from app.socket.v4.resources.questions.complete import (
    handle_complete as questions_complete,
)
from app.socket.v4.resources.questions.error import handle_error as questions_error
from app.socket.v4.resources.questions.progress import (
    handle_progress as questions_progress,
)
from app.socket.v4.resources.questions.start import handle_start as questions_start
from app.socket.v4.resources.reasoning_levels.complete import (
    handle_complete as reasoning_levels_complete,
)
from app.socket.v4.resources.reasoning_levels.error import handle_error as reasoning_levels_error
from app.socket.v4.resources.reasoning_levels.progress import (
    handle_progress as reasoning_levels_progress,
)
from app.socket.v4.resources.reasoning_levels.start import handle_start as reasoning_levels_start
from app.socket.v4.resources.request_limits.complete import (
    handle_complete as request_limits_complete,
)
from app.socket.v4.resources.request_limits.error import handle_error as request_limits_error
from app.socket.v4.resources.request_limits.progress import (
    handle_progress as request_limits_progress,
)
from app.socket.v4.resources.request_limits.start import handle_start as request_limits_start
from app.socket.v4.resources.role_routes.complete import (
    handle_complete as role_routes_complete,
)
from app.socket.v4.resources.role_routes.error import handle_error as role_routes_error
from app.socket.v4.resources.role_routes.progress import (
    handle_progress as role_routes_progress,
)
from app.socket.v4.resources.role_routes.start import handle_start as role_routes_start
from app.socket.v4.resources.roles.complete import (
    handle_complete as roles_complete,
)
from app.socket.v4.resources.roles.error import handle_error as roles_error
from app.socket.v4.resources.roles.progress import (
    handle_progress as roles_progress,
)
from app.socket.v4.resources.roles.start import handle_start as roles_start
from app.socket.v4.resources.routes.complete import (
    handle_complete as routes_complete,
)
from app.socket.v4.resources.routes.error import handle_error as routes_error
from app.socket.v4.resources.routes.progress import (
    handle_progress as routes_progress,
)
from app.socket.v4.resources.routes.start import handle_start as routes_start
from app.socket.v4.resources.rubrics.complete import (
    handle_complete as rubrics_complete,
)
from app.socket.v4.resources.rubrics.error import handle_error as rubrics_error
from app.socket.v4.resources.rubrics.progress import (
    handle_progress as rubrics_progress,
)
from app.socket.v4.resources.rubrics.start import handle_start as rubrics_start
from app.socket.v4.resources.run_positions.complete import (
    handle_complete as run_positions_complete,
)
from app.socket.v4.resources.run_positions.error import handle_error as run_positions_error
from app.socket.v4.resources.run_positions.progress import (
    handle_progress as run_positions_progress,
)
from app.socket.v4.resources.run_positions.start import handle_start as run_positions_start
from app.socket.v4.resources.run_rubrics.complete import (
    handle_complete as run_rubrics_complete,
)
from app.socket.v4.resources.run_rubrics.error import handle_error as run_rubrics_error
from app.socket.v4.resources.run_rubrics.progress import (
    handle_progress as run_rubrics_progress,
)
from app.socket.v4.resources.run_rubrics.start import handle_start as run_rubrics_start
from app.socket.v4.resources.scenario_flags.complete import (
    handle_complete as scenario_flags_complete,
)
from app.socket.v4.resources.scenario_flags.error import handle_error as scenario_flags_error
from app.socket.v4.resources.scenario_flags.progress import (
    handle_progress as scenario_flags_progress,
)
from app.socket.v4.resources.scenario_flags.start import handle_start as scenario_flags_start
from app.socket.v4.resources.scenario_personas.complete import (
    handle_complete as scenario_personas_complete,
)
from app.socket.v4.resources.scenario_personas.error import handle_error as scenario_personas_error
from app.socket.v4.resources.scenario_personas.progress import (
    handle_progress as scenario_personas_progress,
)
from app.socket.v4.resources.scenario_personas.start import handle_start as scenario_personas_start
from app.socket.v4.resources.scenario_positions.complete import (
    handle_complete as scenario_positions_complete,
)
from app.socket.v4.resources.scenario_positions.error import handle_error as scenario_positions_error
from app.socket.v4.resources.scenario_positions.progress import (
    handle_progress as scenario_positions_progress,
)
from app.socket.v4.resources.scenario_positions.start import handle_start as scenario_positions_start
from app.socket.v4.resources.scenario_rubrics.complete import (
    handle_complete as scenario_rubrics_complete,
)
from app.socket.v4.resources.scenario_rubrics.error import handle_error as scenario_rubrics_error
from app.socket.v4.resources.scenario_rubrics.progress import (
    handle_progress as scenario_rubrics_progress,
)
from app.socket.v4.resources.scenario_rubrics.start import handle_start as scenario_rubrics_start
from app.socket.v4.resources.scenario_time_limits.complete import (
    handle_complete as scenario_time_limits_complete,
)
from app.socket.v4.resources.scenario_time_limits.error import handle_error as scenario_time_limits_error
from app.socket.v4.resources.scenario_time_limits.progress import (
    handle_progress as scenario_time_limits_progress,
)
from app.socket.v4.resources.scenario_time_limits.start import handle_start as scenario_time_limits_start
from app.socket.v4.resources.scenarios.complete import (
    handle_complete as scenarios_complete,
)
from app.socket.v4.resources.scenarios.error import handle_error as scenarios_error
from app.socket.v4.resources.scenarios.progress import (
    handle_progress as scenarios_progress,
)
from app.socket.v4.resources.scenarios.start import handle_start as scenarios_start
from app.socket.v4.resources.settings.complete import (
    handle_complete as settings_complete,
)
from app.socket.v4.resources.settings.error import handle_error as settings_error
from app.socket.v4.resources.settings.progress import (
    handle_progress as settings_progress,
)
from app.socket.v4.resources.settings.start import handle_start as settings_start
from app.socket.v4.resources.simulation_positions.complete import (
    handle_complete as simulation_positions_complete,
)
from app.socket.v4.resources.simulation_positions.error import handle_error as simulation_positions_error
from app.socket.v4.resources.simulation_positions.progress import (
    handle_progress as simulation_positions_progress,
)
from app.socket.v4.resources.simulation_positions.start import handle_start as simulation_positions_start
from app.socket.v4.resources.simulations.complete import (
    handle_complete as simulations_complete,
)
from app.socket.v4.resources.simulations.error import handle_error as simulations_error
from app.socket.v4.resources.simulations.progress import (
    handle_progress as simulations_progress,
)
from app.socket.v4.resources.simulations.start import handle_start as simulations_start
from app.socket.v4.resources.slugs.complete import (
    handle_complete as slugs_complete,
)
from app.socket.v4.resources.slugs.error import handle_error as slugs_error
from app.socket.v4.resources.slugs.progress import (
    handle_progress as slugs_progress,
)
from app.socket.v4.resources.slugs.start import handle_start as slugs_start
from app.socket.v4.resources.standard_groups.complete import (
    handle_complete as standard_groups_complete,
)
from app.socket.v4.resources.standard_groups.error import handle_error as standard_groups_error
from app.socket.v4.resources.standard_groups.progress import (
    handle_progress as standard_groups_progress,
)
from app.socket.v4.resources.standard_groups.start import handle_start as standard_groups_start
from app.socket.v4.resources.standards.complete import (
    handle_complete as standards_complete,
)
from app.socket.v4.resources.standards.error import handle_error as standards_error
from app.socket.v4.resources.standards.progress import (
    handle_progress as standards_progress,
)
from app.socket.v4.resources.standards.start import handle_start as standards_start
from app.socket.v4.resources.temperature_levels.complete import (
    handle_complete as temperature_levels_complete,
)
from app.socket.v4.resources.temperature_levels.error import handle_error as temperature_levels_error
from app.socket.v4.resources.temperature_levels.progress import (
    handle_progress as temperature_levels_progress,
)
from app.socket.v4.resources.temperature_levels.start import handle_start as temperature_levels_start
from app.socket.v4.resources.texts.complete import (
    handle_complete as texts_complete,
)
from app.socket.v4.resources.texts.error import handle_error as texts_error
from app.socket.v4.resources.texts.progress import (
    handle_progress as texts_progress,
)
from app.socket.v4.resources.texts.start import handle_start as texts_start
from app.socket.v4.resources.thresholds.complete import (
    handle_complete as thresholds_complete,
)
from app.socket.v4.resources.thresholds.error import handle_error as thresholds_error
from app.socket.v4.resources.thresholds.progress import (
    handle_progress as thresholds_progress,
)
from app.socket.v4.resources.thresholds.start import handle_start as thresholds_start
from app.socket.v4.resources.tools.complete import (
    handle_complete as tools_complete,
)
from app.socket.v4.resources.tools.error import handle_error as tools_error
from app.socket.v4.resources.tools.progress import (
    handle_progress as tools_progress,
)
from app.socket.v4.resources.tools.start import handle_start as tools_start
from app.socket.v4.resources.uploads.complete import (
    handle_complete as uploads_complete,
)
from app.socket.v4.resources.uploads.error import handle_error as uploads_error
from app.socket.v4.resources.uploads.progress import (
    handle_progress as uploads_progress,
)
from app.socket.v4.resources.uploads.start import handle_start as uploads_start
from app.socket.v4.resources.values.complete import (
    handle_complete as values_complete,
)
from app.socket.v4.resources.values.error import handle_error as values_error
from app.socket.v4.resources.values.progress import (
    handle_progress as values_progress,
)
from app.socket.v4.resources.values.start import handle_start as values_start
from app.socket.v4.resources.videos.complete import (
    handle_complete as videos_complete,
)
from app.socket.v4.resources.videos.error import handle_error as videos_error
from app.socket.v4.resources.videos.progress import (
    handle_progress as videos_progress,
)
from app.socket.v4.resources.videos.start import handle_start as videos_start
from app.socket.v4.resources.voices.complete import (
    handle_complete as voices_complete,
)
from app.socket.v4.resources.voices.error import handle_error as voices_error
from app.socket.v4.resources.voices.progress import (
    handle_progress as voices_progress,
)
from app.socket.v4.resources.voices.start import handle_start as voices_start
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

# Type alias for handler functions
Handler = Callable[[dict[str, Any]], Awaitable[None]]

# Per-resource handler dicts
COMPLETE_HANDLERS: dict[str, Handler] = {
    "agents": agents_complete,
    "arg_positions": arg_positions_complete,
    "args": args_complete,
    "args_outputs": args_outputs_complete,
    "auth_item_keys": auth_item_keys_complete,
    "auths": auths_complete,
    "bindings": bindings_complete,
    "cohorts": cohorts_complete,
    "colors": colors_complete,
    "conditional_parameters": conditional_parameters_complete,
    "departments": departments_complete,
    "descriptions": descriptions_complete,
    "documents": documents_complete,
    "domains": domains_complete,
    "emails": emails_complete,
    "endpoints": endpoints_complete,
    "evals": evals_complete,
    "examples": examples_complete,
    "flags": flags_complete,
    "group_positions": group_positions_complete,
    "group_rubrics": group_rubrics_complete,
    "groups": groups_complete,
    "icons": icons_complete,
    "images": images_complete,
    "instructions": instructions_complete,
    "items": items_complete,
    "keys": keys_complete,
    "modalities": modalities_complete,
    "models": models_complete,
    "names": names_complete,
    "objectives": objectives_complete,
    "options": options_complete,
    "parameter_fields": parameter_fields_complete,
    "parameters": parameters_complete,
    "personas": personas_complete,
    "points": points_complete,
    "pricing": pricing_complete,
    "problem_statements": problem_statements_complete,
    "profiles": profiles_complete,
    "prompts": prompts_complete,
    "protocols": protocols_complete,
    "provider_keys": provider_keys_complete,
    "providers": providers_complete,
    "qualities": qualities_complete,
    "questions": questions_complete,
    "reasoning_levels": reasoning_levels_complete,
    "request_limits": request_limits_complete,
    "role_routes": role_routes_complete,
    "roles": roles_complete,
    "routes": routes_complete,
    "rubrics": rubrics_complete,
    "run_positions": run_positions_complete,
    "run_rubrics": run_rubrics_complete,
    "scenario_flags": scenario_flags_complete,
    "scenario_personas": scenario_personas_complete,
    "scenario_positions": scenario_positions_complete,
    "scenario_rubrics": scenario_rubrics_complete,
    "scenario_time_limits": scenario_time_limits_complete,
    "scenarios": scenarios_complete,
    "settings": settings_complete,
    "simulation_positions": simulation_positions_complete,
    "simulations": simulations_complete,
    "slugs": slugs_complete,
    "standard_groups": standard_groups_complete,
    "standards": standards_complete,
    "temperature_levels": temperature_levels_complete,
    "texts": texts_complete,
    "thresholds": thresholds_complete,
    "tools": tools_complete,
    "uploads": uploads_complete,
    "values": values_complete,
    "videos": videos_complete,
    "voices": voices_complete,
}

START_HANDLERS: dict[str, Handler] = {
    "agents": agents_start,
    "arg_positions": arg_positions_start,
    "args": args_start,
    "args_outputs": args_outputs_start,
    "auth_item_keys": auth_item_keys_start,
    "auths": auths_start,
    "bindings": bindings_start,
    "cohorts": cohorts_start,
    "colors": colors_start,
    "conditional_parameters": conditional_parameters_start,
    "departments": departments_start,
    "descriptions": descriptions_start,
    "documents": documents_start,
    "domains": domains_start,
    "emails": emails_start,
    "endpoints": endpoints_start,
    "evals": evals_start,
    "examples": examples_start,
    "flags": flags_start,
    "group_positions": group_positions_start,
    "group_rubrics": group_rubrics_start,
    "groups": groups_start,
    "icons": icons_start,
    "images": images_start,
    "instructions": instructions_start,
    "items": items_start,
    "keys": keys_start,
    "modalities": modalities_start,
    "models": models_start,
    "names": names_start,
    "objectives": objectives_start,
    "options": options_start,
    "parameter_fields": parameter_fields_start,
    "parameters": parameters_start,
    "personas": personas_start,
    "points": points_start,
    "pricing": pricing_start,
    "problem_statements": problem_statements_start,
    "profiles": profiles_start,
    "prompts": prompts_start,
    "protocols": protocols_start,
    "provider_keys": provider_keys_start,
    "providers": providers_start,
    "qualities": qualities_start,
    "questions": questions_start,
    "reasoning_levels": reasoning_levels_start,
    "request_limits": request_limits_start,
    "role_routes": role_routes_start,
    "roles": roles_start,
    "routes": routes_start,
    "rubrics": rubrics_start,
    "run_positions": run_positions_start,
    "run_rubrics": run_rubrics_start,
    "scenario_flags": scenario_flags_start,
    "scenario_personas": scenario_personas_start,
    "scenario_positions": scenario_positions_start,
    "scenario_rubrics": scenario_rubrics_start,
    "scenario_time_limits": scenario_time_limits_start,
    "scenarios": scenarios_start,
    "settings": settings_start,
    "simulation_positions": simulation_positions_start,
    "simulations": simulations_start,
    "slugs": slugs_start,
    "standard_groups": standard_groups_start,
    "standards": standards_start,
    "temperature_levels": temperature_levels_start,
    "texts": texts_start,
    "thresholds": thresholds_start,
    "tools": tools_start,
    "uploads": uploads_start,
    "values": values_start,
    "videos": videos_start,
    "voices": voices_start,
}

PROGRESS_HANDLERS: dict[str, Handler] = {
    "agents": agents_progress,
    "arg_positions": arg_positions_progress,
    "args": args_progress,
    "args_outputs": args_outputs_progress,
    "auth_item_keys": auth_item_keys_progress,
    "auths": auths_progress,
    "bindings": bindings_progress,
    "cohorts": cohorts_progress,
    "colors": colors_progress,
    "conditional_parameters": conditional_parameters_progress,
    "departments": departments_progress,
    "descriptions": descriptions_progress,
    "documents": documents_progress,
    "domains": domains_progress,
    "emails": emails_progress,
    "endpoints": endpoints_progress,
    "evals": evals_progress,
    "examples": examples_progress,
    "flags": flags_progress,
    "group_positions": group_positions_progress,
    "group_rubrics": group_rubrics_progress,
    "groups": groups_progress,
    "icons": icons_progress,
    "images": images_progress,
    "instructions": instructions_progress,
    "items": items_progress,
    "keys": keys_progress,
    "modalities": modalities_progress,
    "models": models_progress,
    "names": names_progress,
    "objectives": objectives_progress,
    "options": options_progress,
    "parameter_fields": parameter_fields_progress,
    "parameters": parameters_progress,
    "personas": personas_progress,
    "points": points_progress,
    "pricing": pricing_progress,
    "problem_statements": problem_statements_progress,
    "profiles": profiles_progress,
    "prompts": prompts_progress,
    "protocols": protocols_progress,
    "provider_keys": provider_keys_progress,
    "providers": providers_progress,
    "qualities": qualities_progress,
    "questions": questions_progress,
    "reasoning_levels": reasoning_levels_progress,
    "request_limits": request_limits_progress,
    "role_routes": role_routes_progress,
    "roles": roles_progress,
    "routes": routes_progress,
    "rubrics": rubrics_progress,
    "run_positions": run_positions_progress,
    "run_rubrics": run_rubrics_progress,
    "scenario_flags": scenario_flags_progress,
    "scenario_personas": scenario_personas_progress,
    "scenario_positions": scenario_positions_progress,
    "scenario_rubrics": scenario_rubrics_progress,
    "scenario_time_limits": scenario_time_limits_progress,
    "scenarios": scenarios_progress,
    "settings": settings_progress,
    "simulation_positions": simulation_positions_progress,
    "simulations": simulations_progress,
    "slugs": slugs_progress,
    "standard_groups": standard_groups_progress,
    "standards": standards_progress,
    "temperature_levels": temperature_levels_progress,
    "texts": texts_progress,
    "thresholds": thresholds_progress,
    "tools": tools_progress,
    "uploads": uploads_progress,
    "values": values_progress,
    "videos": videos_progress,
    "voices": voices_progress,
}

ERROR_HANDLERS: dict[str, Handler] = {
    "agents": agents_error,
    "arg_positions": arg_positions_error,
    "args": args_error,
    "args_outputs": args_outputs_error,
    "auth_item_keys": auth_item_keys_error,
    "auths": auths_error,
    "bindings": bindings_error,
    "cohorts": cohorts_error,
    "colors": colors_error,
    "conditional_parameters": conditional_parameters_error,
    "departments": departments_error,
    "descriptions": descriptions_error,
    "documents": documents_error,
    "domains": domains_error,
    "emails": emails_error,
    "endpoints": endpoints_error,
    "evals": evals_error,
    "examples": examples_error,
    "flags": flags_error,
    "group_positions": group_positions_error,
    "group_rubrics": group_rubrics_error,
    "groups": groups_error,
    "icons": icons_error,
    "images": images_error,
    "instructions": instructions_error,
    "items": items_error,
    "keys": keys_error,
    "modalities": modalities_error,
    "models": models_error,
    "names": names_error,
    "objectives": objectives_error,
    "options": options_error,
    "parameter_fields": parameter_fields_error,
    "parameters": parameters_error,
    "personas": personas_error,
    "points": points_error,
    "pricing": pricing_error,
    "problem_statements": problem_statements_error,
    "profiles": profiles_error,
    "prompts": prompts_error,
    "protocols": protocols_error,
    "provider_keys": provider_keys_error,
    "providers": providers_error,
    "qualities": qualities_error,
    "questions": questions_error,
    "reasoning_levels": reasoning_levels_error,
    "request_limits": request_limits_error,
    "role_routes": role_routes_error,
    "roles": roles_error,
    "routes": routes_error,
    "rubrics": rubrics_error,
    "run_positions": run_positions_error,
    "run_rubrics": run_rubrics_error,
    "scenario_flags": scenario_flags_error,
    "scenario_personas": scenario_personas_error,
    "scenario_positions": scenario_positions_error,
    "scenario_rubrics": scenario_rubrics_error,
    "scenario_time_limits": scenario_time_limits_error,
    "scenarios": scenarios_error,
    "settings": settings_error,
    "simulation_positions": simulation_positions_error,
    "simulations": simulations_error,
    "slugs": slugs_error,
    "standard_groups": standard_groups_error,
    "standards": standards_error,
    "temperature_levels": temperature_levels_error,
    "texts": texts_error,
    "thresholds": thresholds_error,
    "tools": tools_error,
    "uploads": uploads_error,
    "values": values_error,
    "videos": videos_error,
    "voices": voices_error,
}

# Alias: "fields" -> "parameter_fields"
RESOURCE_TYPE_ALIASES: dict[str, str] = {
    "fields": "parameter_fields",
}


def _resolve_resource_type(data: dict[str, Any]) -> str | None:
    """Extract resource_type from event data.

    Checks result.resource_type first (set by tool_executor), then
    falls back to the top-level resource_type from the payload.
    Applies aliases (e.g., "fields" -> "parameter_fields").
    """
    result = data.get("result") or {}
    resource_type = result.get("resource_type") or data.get("resource_type")
    if resource_type:
        resource_type = RESOURCE_TYPE_ALIASES.get(resource_type, resource_type)
    return resource_type


# =============================================================================
# Internal SIO listeners
# =============================================================================


@internal_sio.on("generate_call_complete")  # type: ignore
async def dispatch_call_complete(data: dict[str, Any]) -> None:
    """Route tool_call_complete/tool_result events to per-resource complete handlers."""
    event_type = data.get("event_type")
    if event_type not in ("tool_call_complete", "tool_result"):
        return

    resource_type = _resolve_resource_type(data)
    if not resource_type:
        return

    # Only dispatch tool_result (has actual result data for hydration)
    if event_type == "tool_result":
        handler = COMPLETE_HANDLERS.get(resource_type)
        if handler:
            await handler(data)


@internal_sio.on("generate_call_start")  # type: ignore
async def dispatch_call_start(data: dict[str, Any]) -> None:
    """Route tool_call_start events to per-resource start handlers."""
    event_type = data.get("event_type")
    if event_type != "tool_call_start":
        return

    resource_type = _resolve_resource_type(data)
    if not resource_type:
        return

    handler = START_HANDLERS.get(resource_type)
    if handler:
        await handler(data)


@internal_sio.on("generate_call_progress")  # type: ignore
async def dispatch_call_progress(data: dict[str, Any]) -> None:
    """Route tool_call_delta events to per-resource progress handlers."""
    event_type = data.get("event_type")
    if event_type != "tool_call_delta":
        return

    resource_type = _resolve_resource_type(data)
    if not resource_type:
        return

    handler = PROGRESS_HANDLERS.get(resource_type)
    if handler:
        await handler(data)


@internal_sio.on("generate_call_error")  # type: ignore
async def dispatch_call_error(data: dict[str, Any]) -> None:
    """Route error events to per-resource error handlers."""
    resource_type = _resolve_resource_type(data)
    if not resource_type:
        return

    handler = ERROR_HANDLERS.get(resource_type)
    if handler:
        await handler(data)
