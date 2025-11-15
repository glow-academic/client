"""Simulation WebSocket event router."""

import importlib
import logging
from typing import Any

import socketio  # type: ignore

# Import continue module using importlib since 'continue' is a Python keyword
continue_module = importlib.import_module("app.web.simulations.continue")
handle_continue_simulation = continue_module.handle_continue_simulation

from app.web.simulations.send_message import handle_send_simulation_message
from app.web.simulations.start import handle_start_simulation
from app.web.simulations.stop import handle_stop_simulation

logger = logging.getLogger(__name__)


def register_simulation_events(sio: socketio.AsyncServer) -> None:
    """Register all simulation WebSocket event handlers"""

    logger.info("Starting registration of simulation WebSocket event handlers")

    @sio.event  # type: ignore
    async def start_simulation(sid: str, data: dict[str, Any]) -> None:
        """Start a new simulation attempt"""
        logger.info(
            f"start_simulation event triggered for sid={sid} with data keys: {list(data.keys())}"
        )
        await handle_start_simulation(sid, data)

    @sio.event  # type: ignore
    async def stop_simulation(sid: str, data: dict[str, Any]) -> None:
        """Stop an active simulation"""
        await handle_stop_simulation(sid, data)

    @sio.event  # type: ignore
    async def continue_simulation(sid: str, data: dict[str, Any]) -> None:
        """Continue to next chat in simulation"""
        await handle_continue_simulation(sid, data)

    @sio.event  # type: ignore
    async def send_simulation_message(sid: str, data: dict[str, Any]) -> None:
        """Send a message to the simulation"""
        await handle_send_simulation_message(sid, data)

    logger.info("Successfully registered simulation WebSocket event handlers")

