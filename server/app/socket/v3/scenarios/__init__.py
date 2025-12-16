"""Scenario WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.v3.scenarios.generate import generate_scenario  # noqa: F401
from app.socket.v3.scenarios.regenerate import \
    regenerate_scenario  # noqa: F401
# Import tool handlers
from app.socket.v3.scenarios.tools.document import \
    scenario_tool_document  # noqa: F401
from app.socket.v3.scenarios.tools.image import \
    scenario_tool_image  # noqa: F401
from app.socket.v3.scenarios.tools.objectives import \
    scenario_tool_objectives  # noqa: F401
from app.socket.v3.scenarios.tools.statement import \
    scenario_tool_problem_statement  # noqa: F401
