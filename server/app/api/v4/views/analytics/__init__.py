"""Analytics views — 4 core fact MVs for dashboard sections."""

from fastapi import APIRouter

from app.api.v4.views.analytics.profile_facts import router as profile_facts_router
from app.api.v4.views.analytics.rubric_facts import router as rubric_facts_router
from app.api.v4.views.analytics.scenario_facts import router as scenario_facts_router
from app.api.v4.views.analytics.simulation_facts import router as simulation_facts_router

router = APIRouter(prefix="/analytics", tags=["views", "analytics"])

router.include_router(profile_facts_router, prefix="/profile-facts", tags=["profile_facts"])
router.include_router(rubric_facts_router, prefix="/rubric-facts", tags=["rubric_facts"])
router.include_router(simulation_facts_router, prefix="/simulation-facts", tags=["simulation_facts"])
router.include_router(scenario_facts_router, prefix="/scenario-facts", tags=["scenario_facts"])
