# find_classes.py
# 
# @AshokSaravanan222 & @siladiea
# 07/07/2025

from typing import Any, Dict, List

from app.db import get_session
from app.models import Classes
from sqlalchemy import func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select


def find_classes(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    🔎 Find classes by name/code
    ----------------------------
    Fuzzy class code/name search.
    
    Input
      • query – Class code or name to search for
      • limit – Max results (default: 10)
    
    Returns
      [ { "id": "…", "class_code": "…", "name": "…", … }, … ]
    
    Quick-start
      ask:  "Search for 'BIOL-1102'"
      call: find_classes("BIOL-1102")
    
    See also 👉 class_overview() for detailed class data.
    """
    session = next(get_session())
    try:
        search_pattern = f"%{query.lower()}%"
        stmt = select(Classes).where(
            or_(
                func.lower(Classes.class_code).like(search_pattern),
                func.lower(Classes.name).like(search_pattern)
            )
        ).limit(limit)
        
        classes = session.exec(stmt).all()
        
        results = [
            {
                "id": str(cls.id),
                "class_code": cls.class_code,
                "name": cls.name,
                "year": cls.year,
                "term": cls.term,
                "description": cls.description
            }
            for cls in classes
        ]
        
        return results
        
    except SQLAlchemyError as e:
        return [{"error": f"Database error: {str(e)}"}]
    finally:
        session.close()