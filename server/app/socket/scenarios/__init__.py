"""Scenario WebSocket event handlers."""

# Import handlers so they register themselves via @sio.event decorators
from app.socket.scenarios.generate import generate_scenario  # noqa: F401
from app.socket.scenarios.regenerate import regenerate_scenario  # noqa: F401

# Import tool handlers
from app.socket.scenarios.tools.document import scenario_tool_document  # noqa: F401
from app.socket.scenarios.tools.image import scenario_tool_image  # noqa: F401
from app.socket.scenarios.tools.objectives import scenario_tool_objectives  # noqa: F401
from app.socket.scenarios.tools.statement import scenario_tool_problem_statement  # noqa: F401
