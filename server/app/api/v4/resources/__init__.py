"""Resources v4 API routes."""

from app.api.v4.resources.analyses import router as analyses_router
from app.api.v4.resources.colors import router as colors_router
from app.api.v4.resources.content import router as content_router
from app.api.v4.resources.conversations import router as conversations_router
from app.api.v4.resources.debug_info import router as debug_info_router
from app.api.v4.resources.descriptions import router as descriptions_router
from app.api.v4.resources.examples import router as examples_router
from app.api.v4.resources.feedbacks import router as feedbacks_router
from app.api.v4.resources.flags import router as flags_router
from app.api.v4.resources.hints import router as hints_router
from app.api.v4.resources.html import router as html_router
from app.api.v4.resources.icons import router as icons_router
from app.api.v4.resources.images import router as images_router
from app.api.v4.resources.improvements import router as improvements_router
from app.api.v4.resources.instructions import router as instructions_router
from app.api.v4.resources.names import router as names_router
from app.api.v4.resources.objectives import router as objectives_router
from app.api.v4.resources.options import router as options_router
from app.api.v4.resources.points import router as points_router
from app.api.v4.resources.problem_statements import router as problem_statements_router
from app.api.v4.resources.prompts import router as prompts_router
from app.api.v4.resources.questions import router as questions_router
from app.api.v4.resources.responses import router as responses_router
from app.api.v4.resources.schema_field_items import router as schema_field_items_router
from app.api.v4.resources.schema_fields import router as schema_fields_router
from app.api.v4.resources.schemas import router as schemas_router
from app.api.v4.resources.standard_groups import router as standard_groups_router
from app.api.v4.resources.strengths import router as strengths_router
from app.api.v4.resources.template_array_items import (
    router as template_array_items_router,
)
from app.api.v4.resources.template_values import router as template_values_router
from app.api.v4.resources.templates import router as templates_router
from app.api.v4.resources.thresholds import router as thresholds_router
from app.api.v4.resources.times import router as times_router
from app.api.v4.resources.videos import router as videos_router
from fastapi import APIRouter

router = APIRouter(prefix="/resources", tags=["resources"])

# Include endpoint routers
router.include_router(names_router)
router.include_router(colors_router)
router.include_router(flags_router)
router.include_router(descriptions_router)
router.include_router(examples_router)
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
