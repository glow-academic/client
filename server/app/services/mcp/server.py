# server.py  – minimal FastMCP server
from app.db import get_session
from app.models import Cohorts, Profiles
from mcp.server.fastmcp import FastMCP
from sqlmodel import Session, select

mcp = FastMCP("Demo")               # name that shows up in the LLM UI


# what are some use cases for the model?
# 1. CRUD of a class, and all info with it, like topics, schedules, events, e.t.c
# 2. Read of an agent
# 3. CRUD of a scenaio/simulation


# so I think we should either give full access to the model, or just allow read access in some cases

# To start small, lets just try general dashboard and asking questions. This seems like the most useful use case.

@mcp.tool()
def get_cohorts() -> list[Cohorts]:
    """Gets the cohorts"""
    session = next(get_session())
    cohorts = session.exec(select(Cohorts)).all()
    return list(cohorts)



@mcp.tool()
def get_tas(cohort_id: str | None = None) -> list[Profiles]:
    """Gets the profile information of all the teaching assistants, given a cohort. If None, we will get all cohorts"""
    session = next(get_session())
    if cohort_id:
        # find all the profiles in the cohort
        cohort = session.exec(select(Cohorts).where(Cohorts.id == cohort_id)).one_or_none()
        if not cohort:
            return []
        profiles = session.exec(select(Profiles).where(Profiles.id.in_(cohort.profile_ids))).all()
    else:
        profiles = session.exec(select(Profiles)).all()
    return list(profiles)




if __name__ == "__main__":
    mcp.run(transport="http")      # or "sse" / "http"
