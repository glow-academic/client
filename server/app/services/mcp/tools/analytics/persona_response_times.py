# persona_response_times.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List

from app.db import get_session
from app.models import Personas, Scenarios, SimulationChats, SimulationMessages
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def persona_response_times(persona_id: str, window_days: int = 30) -> Dict[str, Any]:
    """
    Persona response time analysis
    Analyze response times for a specific persona.

    Input
      • persona_id - UUID of the persona
      • window_days - Analysis window in days (default: 30)

    Returns
      { "agent": {…}, "stats": {…}, "recent_responses": […] }

    Quick-start
      ask:  "How fast does persona X respond?"
      call: persona_response_times("uuid-here")

    See also persona_overview() for persona details.
    """
    try:
        persona_uuid = uuid.UUID(persona_id)
    except ValueError:
        return {"error": f"Invalid persona_id format: {persona_id}"}

    session = next(get_session())
    try:
        # Get persona details
        persona = session.get(Personas, persona_uuid)
        if not persona:
            return {"error": f"Persona not found: {persona_id}"}

        # Get scenarios for this persona
        scenarios_stmt = select(Scenarios).where(Scenarios.persona_id == persona_uuid)
        scenarios = session.exec(scenarios_stmt).all()

        if not scenarios:
            return {
                "persona": {
                    "id": str(persona.id),
                    "name": persona.name,
                    "description": persona.description,
                },
                "stats": {"message": "No scenarios found for this persona"},
                "recent_responses": [],
            }

        # Get recent simulation chats involving this agent's scenarios
        cutoff_date = datetime.now() - timedelta(days=window_days)

        response_times: List[float] = []
        recent_responses: List[Dict[str, Any]] = []

        for scenario in scenarios:
            # Get simulation chats for this scenario
            chats_stmt = select(SimulationChats).where(
                SimulationChats.scenario_id == scenario.id,
                SimulationChats.created_at >= cutoff_date,
            )
            chats = session.exec(chats_stmt).all()

            for chat in chats:
                # Get messages for this chat
                messages_stmt = select(SimulationMessages).where(
                    SimulationMessages.chat_id == chat.id
                )
                messages = list(session.exec(messages_stmt).all())

                # sort messages by created_at
                messages.sort(key=lambda x: x.created_at)

                # Calculate response times between query and response pairs
                for i in range(len(messages) - 1):
                    current_msg = messages[i]
                    next_msg = messages[i + 1]

                    # Look for query -> response pairs
                    if current_msg.type == "query" and next_msg.type == "response":
                        if current_msg.created_at and next_msg.created_at:
                            response_time = (
                                next_msg.created_at - current_msg.created_at
                            ).total_seconds()
                            response_times.append(response_time)

                            recent_responses.append(
                                {
                                    "chat_id": str(chat.id),
                                    "scenario_name": scenario.name,
                                    "query_time": current_msg.created_at.isoformat(),
                                    "response_time": next_msg.created_at.isoformat(),
                                    "response_time_seconds": response_time,
                                    "query_length": len(current_msg.content),
                                    "response_length": len(next_msg.content),
                                }
                            )

        # Calculate statistics
        if response_times:
            stats = {
                "total_responses": len(response_times),
                "avg_response_time": round(
                    sum(response_times) / len(response_times), 2
                ),
                "min_response_time": round(min(response_times), 2),
                "max_response_time": round(max(response_times), 2),
                "median_response_time": round(
                    sorted(response_times)[len(response_times) // 2], 2
                ),
                "responses_under_5s": len([t for t in response_times if t < 5]),
                "responses_under_10s": len([t for t in response_times if t < 10]),
                "responses_over_30s": len([t for t in response_times if t > 30]),
                "window_days": window_days,
                "analysis_period": f"{cutoff_date.strftime('%Y-%m-%d')} to {datetime.now().strftime('%Y-%m-%d')}",
            }
        else:
            stats = {
                "message": f"No response data found in the last {window_days} days",
                "window_days": window_days,
                "analysis_period": f"{cutoff_date.strftime('%Y-%m-%d')} to {datetime.now().strftime('%Y-%m-%d')}",
            }

        # Sort recent responses by response time (slowest first)
        recent_responses.sort(key=lambda x: x["response_time_seconds"], reverse=True)

        return {
            "persona": {
                "id": str(persona.id),
                "name": persona.name,
                "description": persona.description,
                "scenario_count": len(scenarios),
            },
            "stats": stats,
            "recent_responses": recent_responses[:20],  # Limit to 20 most recent
        }

    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}
    finally:
        session.close()
