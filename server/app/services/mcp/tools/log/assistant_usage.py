# assistant_usage.py
# 
# @AshokSaravanan222 & @siladiea
# 07/07/2025

from datetime import datetime, timedelta
from typing import Any, Dict, List

from app.db import get_session
from app.models import (AssistantChats, AssistantMessages, AssistantToolCalls,
                        Profiles)
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def assistant_usage(days: int = 7) -> Dict[str, Any]:
    """
    📊 Assistant usage statistics
    -----------------------------
    Show assistant chat usage over time period.
    
    Input
      • days – Analysis window in days (default: 7)
    
    Returns
      { "summary": {…}, "daily_stats": […], "top_users": […] }
    
    Quick-start
      ask:  "Show assistant usage last 7 days"
      call: assistant_usage(7)
    
    See also 👉 recent_app_logs() for system logs.
    """
    session = next(get_session())
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Get chats in the time window
        chats_stmt = select(AssistantChats).where(
            AssistantChats.created_at >= cutoff_date
        )
        chats = session.exec(chats_stmt).all()
        
        # Get messages in the time window
        messages_stmt = select(AssistantMessages).where(
            AssistantMessages.created_at >= cutoff_date
        )
        messages = session.exec(messages_stmt).all()
        
        # Get tool calls in the time window
        tool_calls_stmt = select(AssistantToolCalls).where(
            AssistantToolCalls.created_at >= cutoff_date
        )
        tool_calls = session.exec(tool_calls_stmt).all()
        
        # Overall summary
        total_chats = len(chats)
        total_messages = len(messages)
        total_tool_calls = len(tool_calls)
        
        # Count unique users
        unique_users = len(set(chat.profile_id for chat in chats))
        
        # Count completed vs incomplete
        completed_chats = len([chat for chat in chats if any(
            msg.completed for msg in messages if msg.chat_id == chat.id
        )])
        
        completed_tool_calls = len([tc for tc in tool_calls if tc.completed])
        
        # Daily breakdown
        daily_stats = []
        for i in range(days):
            day_start = cutoff_date + timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            
            day_chats = [c for c in chats if day_start <= c.created_at < day_end]
            day_messages = [m for m in messages if day_start <= m.created_at < day_end]
            day_tool_calls = [tc for tc in tool_calls if day_start <= tc.created_at < day_end]
            
            daily_stats.append({
                "date": day_start.strftime('%Y-%m-%d'),
                "chats": len(day_chats),
                "messages": len(day_messages),
                "tool_calls": len(day_tool_calls),
                "unique_users": len(set(c.profile_id for c in day_chats))
            })
        
        # Top users by chat count
        user_chat_counts: Dict[Any, int] = {}
        for chat in chats:
            if chat.profile_id:
                user_chat_counts[chat.profile_id] = user_chat_counts.get(chat.profile_id, 0) + 1
        
        # Get user details for top users
        top_users = []
        for profile_id, chat_count in sorted(user_chat_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            profile = session.get(Profiles, profile_id)
            if profile:
                user_messages = len([m for m in messages if m.chat_id in [c.id for c in chats if c.profile_id == profile_id]])
                user_tool_calls = len([tc for tc in tool_calls if tc.chat_id in [c.id for c in chats if c.profile_id == profile_id]])
                
                name = f"{profile.first_name} {profile.last_name}".strip()
                if not name:
                    name = profile.alias
                
                top_users.append({
                    "user_id": str(profile.id),
                    "name": name,
                    "alias": profile.alias,
                    "role": profile.role,
                    "chat_count": chat_count,
                    "message_count": user_messages,
                    "tool_call_count": user_tool_calls
                })
        
        # Tool usage breakdown
        tool_usage: Dict[str, int] = {}
        for tc in tool_calls:
            tool_name = tc.tool_name
            tool_usage[tool_name] = tool_usage.get(tool_name, 0) + 1
        
        tool_usage_list = [
            {"tool_name": name, "usage_count": count}
            for name, count in sorted(tool_usage.items(), key=lambda x: x[1], reverse=True)
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
            "avg_messages_per_chat": round(total_messages / total_chats, 1) if total_chats > 0 else 0,
            "avg_tool_calls_per_chat": round(total_tool_calls / total_chats, 1) if total_chats > 0 else 0
        }
        
        return {
            "summary": summary,
            "daily_stats": daily_stats,
            "top_users": top_users,
            "tool_usage": tool_usage_list
        }
        
    except SQLAlchemyError as e:
        return {"error": f"Database error: {str(e)}"}
    finally:
        session.close()