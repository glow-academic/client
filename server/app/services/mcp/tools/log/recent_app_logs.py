# recent_app_logs.py
# 
# @AshokSaravanan222 & @siladiea
# 07/07/2025

from typing import Any, Dict, List

from app.db import get_session
from app.models import AppLogs
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def recent_app_logs(level: str = 'error', limit: int = 100) -> List[Dict[str, Any]]:
    """
    🔎 Fetch recent ERROR/WARN app logs
    -----------------------------------
    Recent application logs filtered by level.
    
    Input
      • level – Log level filter ('error', 'warn', 'info', 'debug')
      • limit – Max results (default: 100)
    
    Returns
      [ { "id": …, "level": "…", "message": "…", … }, … ]
    
    Quick-start
      ask:  "Any critical errors today?"
      call: recent_app_logs("error")
    
    See also 👉 assistant_usage() for assistant-specific logs.
    """
    session = next(get_session())
    try:
        # Build query based on level filter
        stmt = select(AppLogs)
        
        if level.lower() != 'all':
            stmt = stmt.where(func.lower(AppLogs.level).like(f"%{level.lower()}%"))
        
        # Sort by most recent first and limit results
        logs = session.exec(stmt).all()
        logs = list(logs)
        logs = sorted(logs, key=lambda x: x.created_at or 0, reverse=True)[:limit]
        
        results = [
            {
                "id": log.id,
                "level": log.level,
                "message": log.message,
                "context": log.context,
                "created_at": log.created_at.isoformat() if log.created_at else None
            }
            for log in logs
        ]
        
        return results
        
    except SQLAlchemyError as e:
        return [{"error": f"Database error: {str(e)}"}]
    finally:
        session.close()