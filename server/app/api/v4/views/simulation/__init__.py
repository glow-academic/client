"""Simulation views router.

Provides access to granular simulation MVs:
- messages: Message-level data (flat, no composites)
- message_tree: Recursive branch paths for messages
- contents: Content entries per message
- strengths: Strength entries per message
- highlights: Highlight entries per strength
- improvements: Improvement entries per message
- replacements: Replacement entries per improvement
- hints: Hint entries per message
- feedbacks: Feedback entries per grade
- analyses: Analysis entries per grade
- responses: Response entries per chat
- grades: Latest grade per chat
- test_feedback: Benchmark feedback entries per grade
"""

from fastapi import APIRouter

from app.api.v4.views.simulation.analyses import router as analyses_router

# from app.api.v4.views.simulation.test_feedback import (
#     router as test_feedback_router,
# )
from app.api.v4.views.simulation.contents import router as contents_router
from app.api.v4.views.simulation.feedbacks import router as feedbacks_router
from app.api.v4.views.simulation.grades import router as grades_router
from app.api.v4.views.simulation.highlights import router as highlights_router
from app.api.v4.views.simulation.hints import router as hints_router
from app.api.v4.views.simulation.improvements import router as improvements_router
from app.api.v4.views.simulation.message_tree import router as message_tree_router
from app.api.v4.views.simulation.messages import router as messages_router
from app.api.v4.views.simulation.replacements import router as replacements_router
from app.api.v4.views.simulation.responses import router as responses_router
from app.api.v4.views.simulation.strengths import router as strengths_router

router = APIRouter(prefix="/simulation", tags=["views", "simulation"])

router.include_router(messages_router)
router.include_router(message_tree_router)
router.include_router(contents_router)
router.include_router(strengths_router)
router.include_router(highlights_router)
router.include_router(improvements_router)
router.include_router(replacements_router)
router.include_router(hints_router)
router.include_router(feedbacks_router)
router.include_router(analyses_router)
router.include_router(responses_router)
router.include_router(grades_router)
# router.include_router(test_feedback_router)
