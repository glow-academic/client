# assistant_usage.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

from datetime import datetime, timedelta
from typing import Any, Dict

import asyncpg  # type: ignore


async def assistant_usage(conn: asyncpg.Connection, days: int = 7) -> Dict[str, Any]:
    """Show assistant chat usage over time period."""
    try:
        cutoff_date = datetime.now() - timedelta(days=days)

        # Get chats in the time window
        chats_query = """
            SELECT id, profile_id, created_at
            FROM assistant_chats
            WHERE created_at >= $1
        """
        chats_rows = await conn.fetch(chats_query, cutoff_date)

        # Get messages in the time window
        messages_query = """
            SELECT id, chat_id, completed, created_at
            FROM assistant_messages
            WHERE created_at >= $1
        """
        messages_rows = await conn.fetch(messages_query, cutoff_date)

        # Get tool calls in the time window
        tool_calls_query = """
            SELECT id, chat_id, tool_name, completed, created_at
            FROM assistant_tool_calls
            WHERE created_at >= $1
        """
        tool_calls_rows = await conn.fetch(tool_calls_query, cutoff_date)

        # Overall summary
        total_chats = len(chats_rows)
        total_messages = len(messages_rows)
        total_tool_calls = len(tool_calls_rows)

        # Count unique users
        unique_users = len(set(row["profile_id"] for row in chats_rows))

        # Count completed vs incomplete
        completed_chats = len(
            [
                chat_row
                for chat_row in chats_rows
                if any(msg_row["completed"] for msg_row in messages_rows if msg_row["chat_id"] == chat_row["id"])
            ]
        )

        completed_tool_calls = len([tc for tc in tool_calls_rows if tc["completed"]])

        # Daily breakdown
        daily_stats = []
        for i in range(days):
            day_start = cutoff_date + timedelta(days=i)
            day_end = day_start + timedelta(days=1)

            day_chats = [c for c in chats_rows if day_start <= c["created_at"] < day_end]
            day_messages = [m for m in messages_rows if day_start <= m["created_at"] < day_end]
            day_tool_calls = [
                tc for tc in tool_calls_rows if day_start <= tc["created_at"] < day_end
            ]

            daily_stats.append(
                {
                    "date": day_start.strftime("%Y-%m-%d"),
                    "chats": len(day_chats),
                    "messages": len(day_messages),
                    "tool_calls": len(day_tool_calls),
                    "unique_users": len(set(c["profile_id"] for c in day_chats)),
                }
            )

        # Top users by chat count
        user_chat_counts: Dict[Any, int] = {}
        for chat_row in chats_rows:
            if chat_row["profile_id"]:
                user_chat_counts[chat_row["profile_id"]] = (
                    user_chat_counts.get(chat_row["profile_id"], 0) + 1
                )

        # Get user details for top users
        top_users = []
        for profile_id, chat_count in sorted(
            user_chat_counts.items(), key=lambda x: x[1], reverse=True
        )[:10]:
            profile_query = """
                SELECT id, first_name, last_name, alias, role
                FROM profiles
                WHERE id = $1
            """
            profile_row = await conn.fetchrow(profile_query, profile_id)
            if profile_row:
                user_messages = len(
                    [
                        m
                        for m in messages_rows
                        if m["chat_id"]
                        in [c["id"] for c in chats_rows if c["profile_id"] == profile_id]
                    ]
                )
                user_tool_calls = len(
                    [
                        tc
                        for tc in tool_calls_rows
                        if tc["chat_id"]
                        in [c["id"] for c in chats_rows if c["profile_id"] == profile_id]
                    ]
                )

                name = f"{profile_row['first_name']} {profile_row['last_name']}".strip()
                if not name:
                    name = profile_row["alias"]

                top_users.append(
                    {
                        "user_id": str(profile_row["id"]),
                        "name": name,
                        "alias": profile_row["alias"],
                        "role": profile_row["role"],
                        "chat_count": chat_count,
                        "message_count": user_messages,
                        "tool_call_count": user_tool_calls,
                    }
                )

        # Tool usage breakdown
        tool_usage: Dict[str, int] = {}
        for tc_row in tool_calls_rows:
            tool_name = tc_row["tool_name"]
            tool_usage[tool_name] = tool_usage.get(tool_name, 0) + 1

        tool_usage_list = [
            {"tool_name": name, "usage_count": count}
            for name, count in sorted(
                tool_usage.items(), key=lambda x: x[1], reverse=True
            )
        ]

        summary = {
            "analysis_period": f"{cutoff_date.strftime('%Y-%m-%d')} to {datetime.now().strftime('%Y-%m-%d')}",
            "days": days,
            "total_chats": total_chats,
            "total_messages": total_messages,
            "total_tool_calls": total_tool_calls,
            "unique_users": unique_users,
            "completed_chats": completed_chats,
            "completed_tool_calls": completed_tool_calls,
            "avg_chats_per_day": round(total_chats / days, 1) if days > 0 else 0,
            "avg_messages_per_chat": round(total_messages / total_chats, 1)
            if total_chats > 0
            else 0,
            "avg_tool_calls_per_chat": round(total_tool_calls / total_chats, 1)
            if total_chats > 0
            else 0,
        }

        return {
            "summary": summary,
            "daily_stats": daily_stats,
            "top_users": top_users,
            "tool_usage": tool_usage_list,
        }

    except Exception as e:
        return {"error": f"Database error: {str(e)}"}
