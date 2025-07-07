# list_schema.py
# 
# @AshokSaravanan222 & @siladiea
# 07/07/2025



from app.db import engine
from sqlalchemy import text


def list_schema() -> str:
    """
    🔎 Database schema overview
    ---------------------------
    Lists all tables and columns in the public schema.
    
    Quick-start
      ask:  "What tables are in the DB?"
      call: list_schema()
    """
    sql = """
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    """
    with engine.connect() as conn:
        rows = conn.execute(text(sql))
        return "\n".join(f"{t}.{c} {d}" for t, c, d in rows)