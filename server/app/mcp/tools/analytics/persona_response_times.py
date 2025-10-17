# persona_response_times.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List

import asyncpg  # type: ignore


async def persona_response_times(conn: asyncpg.Connection, persona_id: str, window_days: int = 30) -> Dict[str, Any]:
    """
    Persona response time analysis
    Analyze response times for a specific persona.

    Input
      • conn - Database connection from asyncpg
      • persona_id - UUID of the persona
      • window_days - Analysis window in days (default: 30)

    Returns
      { "agent": {…}, "stats": {…}, "recent_responses": […] }

    Quick-start
      ask:  "How fast does persona X respond?"
      call: persona_response_times(conn, "uuid-here")

    See also persona_overview() for persona details.
    """
    try:
        persona_uuid = uuid.UUID(persona_id)
    except ValueError:
        return {"error": f"Invalid persona_id format: {persona_id}"}

    try:
        # Get persona details
        persona = await conn.fetchrow(
            """
            SELECT id, name, description
            FROM personas
            WHERE id = $1
            """,
            persona_uuid,
        )
        if not persona:
            return {"error": f"Persona not found: {persona_id}"}

        # Get scenarios for this persona via scenario_personas junction
        scenarios = await conn.fetch(
            """
            SELECT s.id, s.name
            FROM scenarios s
            JOIN scenario_personas sp ON s.id = sp.scenario_id
            WHERE sp.persona_id = $1 AND sp.active = true
            """,
            persona_uuid,
        )

        if not scenarios:
            return {
                "persona": {
                    "id": str(persona["id"]),
                    "name": persona["name"],
                    "description": persona["description"],
                },
                "stats": {"message": "No scenarios found for this persona"},
                "recent_responses": [],
            }

        # Get recent response times for this persona's scenarios
        cutoff_date = datetime.now() - timedelta(days=window_days)
        scenario_ids = [s["id"] for s in scenarios]

        # Single query to get all response time pairs
        response_data = await conn.fetch(
            """
            WITH message_pairs AS (
                SELECT 
                    sc.id as chat_id,
                    s.name as scenario_name,
                    sm1.created_at as query_time,
                    sm2.created_at as response_time,
                    sm2.created_at - sm1.created_at as response_interval,
                    LENGTH(sm1.content) as query_length,
                    LENGTH(sm2.content) as response_length,
                    ROW_NUMBER() OVER (
                        PARTITION BY sc.id 
                        ORDER BY sm1.created_at
                    ) as pair_num
                FROM simulation_chats sc
                JOIN scenarios s ON s.id = sc.scenario_id
                JOIN simulation_messages sm1 ON sm1.chat_id = sc.id
                JOIN simulation_messages sm2 ON sm2.chat_id = sc.id
                WHERE sc.scenario_id = ANY($1)
                  AND sc.created_at >= $2
                  AND sm1.type = 'query'
                  AND sm2.type = 'response'
                  AND sm2.created_at > sm1.created_at
                  AND NOT EXISTS (
                      SELECT 1 FROM simulation_messages sm_between
                      WHERE sm_between.chat_id = sc.id
                        AND sm_between.created_at > sm1.created_at
                        AND sm_between.created_at < sm2.created_at
                  )
            )
            SELECT 
                chat_id,
                scenario_name,
                query_time,
                response_time,
                EXTRACT(EPOCH FROM response_interval) as response_time_seconds,
                query_length,
                response_length
            FROM message_pairs
            ORDER BY response_time_seconds DESC
            """,
            scenario_ids,
            cutoff_date,
        )

        response_times: List[float] = []
        recent_responses: List[Dict[str, Any]] = []

        for row in response_data:
            response_time_seconds = float(row["response_time_seconds"])
            response_times.append(response_time_seconds)
            
            recent_responses.append({
                "chat_id": str(row["chat_id"]),
                "scenario_name": row["scenario_name"],
                "query_time": row["query_time"].isoformat(),
                "response_time": row["response_time"].isoformat(),
                "response_time_seconds": response_time_seconds,
                "query_length": row["query_length"],
                "response_length": row["response_length"],
            })

        # Calculate statistics
        if response_times:
            sorted_times = sorted(response_times)
            stats = {
                "total_responses": len(response_times),
                "avg_response_time": round(sum(response_times) / len(response_times), 2),
                "min_response_time": round(min(response_times), 2),
                "max_response_time": round(max(response_times), 2),
                "median_response_time": round(sorted_times[len(sorted_times) // 2], 2),
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

        return {
            "persona": {
                "id": str(persona["id"]),
                "name": persona["name"],
                "description": persona["description"],
                "scenario_count": len(scenarios),
            },
            "stats": stats,
            "recent_responses": recent_responses[:20],  # Limit to 20 most recent
        }

    except Exception as e:
        return {"error": f"Database error: {str(e)}"}
