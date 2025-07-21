# server.py — Clean MCP server wrapper that imports all individual tools
# Import analytics tools
from typing import Any, Dict, List

from app.services.mcp.tools.analytics.agent_response_times import agent_response_times
from app.services.mcp.tools.analytics.cohort_pass_matrix import cohort_pass_matrix
from app.services.mcp.tools.analytics.simulation_attempts import simulation_attempts
from app.services.mcp.tools.analytics.student_sim_report import student_sim_report

# Import log tools
from app.services.mcp.tools.log.assistant_usage import assistant_usage
from app.services.mcp.tools.log.export_csv import export_csv
from app.services.mcp.tools.log.recent_app_logs import recent_app_logs

# Import lookup tools
from app.services.mcp.tools.lookup.agent_overview import agent_overview
from app.services.mcp.tools.lookup.cohort_overview import cohort_overview
from app.services.mcp.tools.lookup.profile_overview import profile_overview
from app.services.mcp.tools.lookup.scenario_overview import scenario_overview
from app.services.mcp.tools.lookup.simulation_overview import simulation_overview

# Import schema tools
from app.services.mcp.tools.schema.list_schema import list_schema
from app.services.mcp.tools.schema.query_data import query_data
from app.services.mcp.tools.search.find_agents import find_agents

# Import search tools
from app.services.mcp.tools.search.find_cohorts import find_cohorts
from app.services.mcp.tools.search.find_profiles import find_profiles
from app.services.mcp.tools.search.find_scenarios import find_scenarios
from app.services.mcp.tools.search.find_simulations import find_simulations
from mcp.server.fastmcp import FastMCP

# ─────────────────────────────────────────────────────────────────────────────
# Configure MCP server for stateless HTTP transport
server = FastMCP("Domain-API", stateless_http=True)

# ─────────────────────────────────────────────────────────────────────────────
# ✱ Schema / Meta Tools (2 tools)
# ─────────────────────────────────────────────────────────────────────────────


@server.tool()
def _list_schema() -> str:
    return list_schema()


@server.tool()
def _query_data(sql: str) -> str:
    return query_data(sql)


# ─────────────────────────────────────────────────────────────────────────────
# ✱ Quick Look-ups (6 tools)
# ─────────────────────────────────────────────────────────────────────────────


@server.tool()
def _profile_overview(profile_id: str) -> Dict[str, Any]:
    return profile_overview(profile_id)


@server.tool()
def _cohort_overview(cohort_id: str) -> Dict[str, Any]:
    return cohort_overview(cohort_id)


@server.tool()
def _simulation_overview(sim_id: str) -> Dict[str, Any]:
    return simulation_overview(sim_id)


@server.tool()
def _scenario_overview(scenario_id: str) -> Dict[str, Any]:
    return scenario_overview(scenario_id)


@server.tool()
def _agent_overview(agent_id: str) -> Dict[str, Any]:
    return agent_overview(agent_id)


# ─────────────────────────────────────────────────────────────────────────────
# ✱ Search / Helper Tools (6 tools)
# ─────────────────────────────────────────────────────────────────────────────


@server.tool()
def _find_profiles(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    return find_profiles(query, limit)


@server.tool()
def _find_simulations(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    return find_simulations(query, limit)


@server.tool()
def _find_agents(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    return find_agents(query, limit)


@server.tool()
def _find_cohorts(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    return find_cohorts(query, limit)


@server.tool()
def _find_scenarios(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    return find_scenarios(query, limit)


# ─────────────────────────────────────────────────────────────────────────────
# ✱ Reports / Analytics Tools (5 tools)
# ─────────────────────────────────────────────────────────────────────────────


@server.tool()
def _student_sim_report(profile_id: str, recent: int = 50) -> Dict[str, Any]:
    return student_sim_report(profile_id, recent)



@server.tool()
def _cohort_pass_matrix(cohort_id: str) -> Dict[str, Any]:
    return cohort_pass_matrix(cohort_id)


@server.tool()
def _simulation_attempts(sim_id: str, limit: int = 200) -> List[Dict[str, Any]]:
    return simulation_attempts(sim_id, limit)


@server.tool()
def _agent_response_times(agent_id: str, window_days: int = 30) -> Dict[str, Any]:
    return agent_response_times(agent_id, window_days)


# ─────────────────────────────────────────────────────────────────────────────
# ✱ Log / Audit Tools (3 tools)
# ─────────────────────────────────────────────────────────────────────────────


@server.tool()
def _recent_app_logs(level: str = "error", limit: int = 100) -> List[Dict[str, Any]]:
    return recent_app_logs(level, limit)


@server.tool()
def _export_csv(sql: str) -> str:
    return export_csv(sql)


@server.tool()
def _assistant_usage(days: int = 7) -> Dict[str, Any]:
    return assistant_usage(days)


# ─────────────────────────────────────────────────────────────────────────────
# Server is ready - all 19 tools are implemented and registered
# Complete MCP analytics suite with modular architecture
# ─────────────────────────────────────────────────────────────────────────────
