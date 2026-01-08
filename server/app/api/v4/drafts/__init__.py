"""Drafts v4 API routes."""

from app.api.v4.drafts.analyses import router as analyses_router
from app.api.v4.drafts.colors import router as colors_router
from app.api.v4.drafts.content import router as content_router
from app.api.v4.drafts.conversations import router as conversations_router
from app.api.v4.drafts.create import router as create_router
from app.api.v4.drafts.debug_info import router as debug_info_router
from app.api.v4.drafts.descriptions import router as descriptions_router
from app.api.v4.drafts.feedbacks import router as feedbacks_router
from app.api.v4.drafts.flags import router as flags_router
from app.api.v4.drafts.get import router as get_router
from app.api.v4.drafts.hints import router as hints_router
from app.api.v4.drafts.html import router as html_router
from app.api.v4.drafts.icons import router as icons_router
from app.api.v4.drafts.images import router as images_router
from app.api.v4.drafts.improvements import router as improvements_router
from app.api.v4.drafts.instructions import router as instructions_router
from app.api.v4.drafts.names import router as names_router
from app.api.v4.drafts.objectives import router as objectives_router
from app.api.v4.drafts.options import router as options_router
from app.api.v4.drafts.points import router as points_router
from app.api.v4.drafts.problem_statements import \
    router as problem_statements_router
from app.api.v4.drafts.prompts import router as prompts_router
from app.api.v4.drafts.questions import router as questions_router
from app.api.v4.drafts.responses import router as responses_router
from app.api.v4.drafts.schema_field_items import \
    router as schema_field_items_router
from app.api.v4.drafts.schema_fields import router as schema_fields_router
from app.api.v4.drafts.schemas import router as schemas_router
from app.api.v4.drafts.standard_groups import router as standard_groups_router
from app.api.v4.drafts.strengths import router as strengths_router
from app.api.v4.drafts.template_array_items import \
    router as template_array_items_router
from app.api.v4.drafts.template_values import router as template_values_router
from app.api.v4.drafts.templates import router as templates_router
from app.api.v4.drafts.thresholds import router as thresholds_router
from app.api.v4.drafts.times import router as times_router
from app.api.v4.drafts.videos import router as videos_router
from fastapi import APIRouter

router = APIRouter(prefix="/drafts", tags=["drafts"])

# Include endpoint routers
router.include_router(create_router)
router.include_router(get_router)
router.include_router(names_router)
router.include_router(colors_router)
router.include_router(flags_router)
router.include_router(descriptions_router)
router.include_router(icons_router)
router.include_router(points_router)
router.include_router(thresholds_router)
router.include_router(content_router)
router.include_router(html_router)
router.include_router(hints_router)
router.include_router(images_router)
router.include_router(videos_router)
router.include_router(objectives_router)
router.include_router(options_router)
router.include_router(problem_statements_router)
router.include_router(prompts_router)
router.include_router(questions_router)
router.include_router(responses_router)
router.include_router(analyses_router)
router.include_router(instructions_router)
router.include_router(improvements_router)
router.include_router(strengths_router)
router.include_router(feedbacks_router)
router.include_router(conversations_router)
router.include_router(debug_info_router)
router.include_router(schemas_router)
router.include_router(schema_fields_router)
router.include_router(schema_field_items_router)
router.include_router(templates_router)
router.include_router(template_array_items_router)
router.include_router(template_values_router)
router.include_router(standard_groups_router)
router.include_router(times_router)
