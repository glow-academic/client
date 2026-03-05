"""Entries API router - CRUD layer on top of entry tables via MVs."""

from fastapi import APIRouter

from app.routes.v5.api.entries.activity import router as activity_router
from app.routes.v5.api.entries.agent_drafts import router as agent_drafts_router
from app.routes.v5.api.entries.attempt import router as attempt_router
from app.routes.v5.api.entries.attempt_analysis import router as attempt_analysis_router
from app.routes.v5.api.entries.attempt_archive import router as attempt_archive_router
from app.routes.v5.api.entries.attempt_chat import router as attempt_chat_router
from app.routes.v5.api.entries.attempt_chat_bridge import (
    router as attempt_chat_bridge_router,
)
from app.routes.v5.api.entries.attempt_completion import (
    router as attempt_completion_router,
)
from app.routes.v5.api.entries.attempt_content import router as attempt_content_router
from app.routes.v5.api.entries.attempt_feedback import router as attempt_feedback_router
from app.routes.v5.api.entries.attempt_grade import router as attempt_grade_router
from app.routes.v5.api.entries.attempt_highlight import (
    router as attempt_highlight_router,
)
from app.routes.v5.api.entries.attempt_hint import router as attempt_hint_router
from app.routes.v5.api.entries.attempt_home import router as attempt_home_router
from app.routes.v5.api.entries.attempt_improvement import (
    router as attempt_improvement_router,
)
from app.routes.v5.api.entries.attempt_message import router as attempt_message_router
from app.routes.v5.api.entries.attempt_message_tree import (
    router as attempt_message_tree_router,
)
from app.routes.v5.api.entries.attempt_practice import router as attempt_practice_router
from app.routes.v5.api.entries.attempt_replacement import (
    router as attempt_replacement_router,
)
from app.routes.v5.api.entries.attempt_strength import router as attempt_strength_router
from app.routes.v5.api.entries.audios import router as audios_router
from app.routes.v5.api.entries.auth_drafts import router as auth_drafts_router
from app.routes.v5.api.entries.benchmark import router as benchmark_router
from app.routes.v5.api.entries.calls import router as calls_router
from app.routes.v5.api.entries.cohort_drafts import router as cohort_drafts_router
from app.routes.v5.api.entries.attempt_conversations import (
    router as attempt_conversations_router,
)
from app.routes.v5.api.entries.attempt_conversation_completions import (
    router as attempt_conversation_completions_router,
)
from app.routes.v5.api.entries.debug_info import router as debug_info_router
from app.routes.v5.api.entries.department_drafts import (
    router as department_drafts_router,
)
from app.routes.v5.api.entries.document_drafts import router as document_drafts_router
from app.routes.v5.api.entries.emulations import router as emulations_router
from app.routes.v5.api.entries.eval_drafts import router as eval_drafts_router
from app.routes.v5.api.entries.field_drafts import router as field_drafts_router
from app.routes.v5.api.entries.files import router as files_router
from app.routes.v5.api.entries.grants import router as grants_router
from app.routes.v5.api.entries.groups import router as groups_router
from app.routes.v5.api.entries.health import router as health_router
from app.routes.v5.api.entries.home import router as home_router
from app.routes.v5.api.entries.home_chat import router as home_chat_router
from app.routes.v5.api.entries.images import router as images_router
from app.routes.v5.api.entries.logins import router as logins_router
from app.routes.v5.api.entries.messages import router as messages_router
from app.routes.v5.api.entries.messages_completions import (
    router as messages_completions_router,
)
from app.routes.v5.api.entries.metrics import router as metrics_router
from app.routes.v5.api.entries.model_drafts import router as model_drafts_router
from app.routes.v5.api.entries.attempt_mutes import router as attempt_mutes_router
from app.routes.v5.api.entries.parameter_drafts import router as parameter_drafts_router
from app.routes.v5.api.entries.persona import router as persona_router
from app.routes.v5.api.entries.persona_drafts import router as persona_drafts_router
from app.routes.v5.api.entries.practice import router as practice_router
from app.routes.v5.api.entries.practice_chat import router as practice_chat_router
from app.routes.v5.api.entries.problems import router as problems_router
from app.routes.v5.api.entries.profile_drafts import router as profile_drafts_router
from app.routes.v5.api.entries.provider_drafts import router as provider_drafts_router
from app.routes.v5.api.entries.resolves import router as resolves_router
from app.routes.v5.api.entries.attempt_responses import router as attempt_responses_router
from app.routes.v5.api.entries.rubric_drafts import router as rubric_drafts_router
from app.routes.v5.api.entries.run_pricing import router as run_pricing_router
from app.routes.v5.api.entries.runs import router as runs_router
from app.routes.v5.api.entries.scenario_drafts import router as scenario_drafts_router
from app.routes.v5.api.entries.sessions import router as sessions_router
from app.routes.v5.api.entries.setting_drafts import router as setting_drafts_router
from app.routes.v5.api.entries.simulation_drafts import (
    router as simulation_drafts_router,
)
from app.routes.v5.api.entries.test import router as test_router
from app.routes.v5.api.entries.test_archive import router as test_archive_router
from app.routes.v5.api.entries.test_completion import router as test_completion_router
from app.routes.v5.api.entries.test_feedback import router as test_feedback_router
from app.routes.v5.api.entries.test_grade import router as test_grade_router
from app.routes.v5.api.entries.test_invocation import router as test_invocation_router
from app.routes.v5.api.entries.test_stop import router as test_stop_router
from app.routes.v5.api.entries.texts import router as texts_router
from app.routes.v5.api.entries.tokens import router as tokens_router
from app.routes.v5.api.entries.tool_drafts import router as tool_drafts_router
from app.routes.v5.api.entries.uploads import router as uploads_router
from app.routes.v5.api.entries.uploads_completions import (
    router as uploads_completions_router,
)
from app.routes.v5.api.entries.videos import router as videos_router

router = APIRouter(prefix="/entries", tags=["entries"])

router.include_router(activity_router)
router.include_router(agent_drafts_router)
router.include_router(attempt_router)
router.include_router(attempt_analysis_router)
router.include_router(attempt_archive_router)
router.include_router(attempt_chat_router)
router.include_router(attempt_chat_bridge_router)
router.include_router(attempt_home_router)
router.include_router(attempt_completion_router)
router.include_router(attempt_content_router)
router.include_router(attempt_feedback_router)
router.include_router(attempt_grade_router)
router.include_router(attempt_highlight_router)
router.include_router(attempt_hint_router)
router.include_router(attempt_improvement_router)
router.include_router(attempt_message_router)
router.include_router(attempt_practice_router)
router.include_router(attempt_message_tree_router)
router.include_router(attempt_replacement_router)
router.include_router(attempt_strength_router)
router.include_router(audios_router)
router.include_router(auth_drafts_router)
router.include_router(benchmark_router)
router.include_router(calls_router)
router.include_router(cohort_drafts_router)
router.include_router(attempt_conversations_router)
router.include_router(attempt_conversation_completions_router)
router.include_router(debug_info_router)
router.include_router(department_drafts_router)
router.include_router(document_drafts_router)
router.include_router(emulations_router)
router.include_router(eval_drafts_router)
router.include_router(field_drafts_router)
router.include_router(files_router)
router.include_router(grants_router)
router.include_router(groups_router)
router.include_router(health_router)
router.include_router(home_router)
router.include_router(home_chat_router)
router.include_router(images_router)
router.include_router(logins_router)
router.include_router(messages_router)
router.include_router(messages_completions_router)
router.include_router(metrics_router)
router.include_router(model_drafts_router)
router.include_router(attempt_mutes_router)
router.include_router(parameter_drafts_router)
router.include_router(persona_router)
router.include_router(persona_drafts_router)
router.include_router(practice_router)
router.include_router(practice_chat_router)
router.include_router(problems_router)
router.include_router(profile_drafts_router)
router.include_router(provider_drafts_router)
router.include_router(resolves_router)
router.include_router(attempt_responses_router)
router.include_router(rubric_drafts_router)
router.include_router(run_pricing_router)
router.include_router(runs_router)
router.include_router(scenario_drafts_router)
router.include_router(sessions_router)
router.include_router(setting_drafts_router)
router.include_router(simulation_drafts_router)
router.include_router(test_router)
router.include_router(test_archive_router)
router.include_router(test_completion_router)
router.include_router(test_feedback_router)
router.include_router(test_grade_router)
router.include_router(test_invocation_router)
router.include_router(test_stop_router)
router.include_router(texts_router)
router.include_router(tokens_router)
router.include_router(tool_drafts_router)
router.include_router(uploads_router)
router.include_router(uploads_completions_router)
router.include_router(videos_router)
