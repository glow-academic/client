# server/scripts/generate_models.py

import os
import re
import subprocess
import sys


def generate_sqlmodel_from_sql():
    """Generate SQLModel classes from SQL schema using sqlacodegen"""
    python_executable = sys.executable
    db_user, db_password, db_name, db_port, db_host = (
        os.getenv("DB_USER"),
        os.getenv("DB_PASSWORD"),
        os.getenv("DB_NAME"),
        os.getenv("DB_PORT"),
        os.getenv("DB_HOST"),
    )
    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    if not all([db_user, db_password, db_name, db_host, db_port]):
        print("Error: Database environment variables are not properly set")
        sys.exit(1)

    print(f"Using database URL: {db_url}")

    cmd = [python_executable, "-m", "sqlacodegen", "--generator=sqlmodels", db_url]

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        generated_code = result.stdout

        import_lines = [
            "import uuid",
            "from datetime import datetime",
            "from typing import Any, Dict, List, Optional",
            "",
            "from sqlalchemy import (ARRAY, BigInteger, Boolean, Column, DateTime,",
            "                        Enum, ForeignKeyConstraint, Integer,",
            "                        PrimaryKeyConstraint, String, Text, Uuid, text, Double)",
            "from sqlalchemy.dialects.postgresql import JSONB",
            "from sqlmodel import Field, Relationship, SQLModel",
            "from sqlalchemy.orm import Mapped",
        ]
        
        import_section = "\n".join(import_lines)
        
        # Isolate class definitions from the generated code
        class_definitions = generated_code.split('from __future__ import annotations')[1]

        # Add custom _Base class
        base_class = '\n\nclass _Base(SQLModel):\n    """Shared config so Pydantic will accept SQLAlchemy types."""\n    model_config = {"arbitrary_types_allowed": True}\n'
        class_definitions = base_class + class_definitions.lstrip()

        # Update all models to inherit from _Base
        class_definitions = re.sub(
            r"class (\w+)\(SQLModel, table=True\):",
            r"class \1(_Base, table=True):",
            class_definitions
        )

        print("Applying type transformations...")
        
        # --- Convert all Postgres-specific server_default to portable Python equivalents ---
        # Each regex finds and replaces the text() construct with a Python equivalent.
        class_definitions = re.sub(r"server_default=text\('gen_random_uuid\(\)'\)", "default_factory=uuid.uuid4", class_definitions)
        class_definitions = re.sub(r"server_default=text\('now\(\)'\)", "default_factory=datetime.utcnow", class_definitions)
        class_definitions = re.sub(r"server_default=text\(\"'{}'::jsonb\"\)", "default_factory=dict", class_definitions)
        class_definitions = re.sub(r"server_default=text\('ARRAY\[\]::uuid\[\]'\)", "default_factory=list", class_definitions)
        class_definitions = re.sub(r"server_default=text\(\"'(\w+)'::\w+\"\)", r"default='\1'", class_definitions)
        class_definitions = re.sub(r"server_default=text\('false'\)", "default=False", class_definitions)
        class_definitions = re.sub(r"server_default=text\('true'\)", "default=True", class_definitions)
        class_definitions = re.sub(r"server_default=text\('([\d\.]+)'\)", r"default=\1", class_definitions)

        # --- Correct type hints and SQLModel Field definitions ---
        # Move `default` and `default_factory` from Column() to be direct arguments of Field()
        class_definitions = re.sub(
            r"(sa_column=Column\([^)]*?),\s*(default(?:_factory)?=[\w\.'()]+)([^)]*\))",
            r"\1\3, \2",
            class_definitions
        )
        # Correct all type hints
        class_definitions = re.sub(r": uuid\.UUID", r": Mapped[uuid.UUID]", class_definitions)
        class_definitions = re.sub(r": UUID", r": Mapped[uuid.UUID]", class_definitions)
        class_definitions = re.sub(r": Optional\[UUID\]", r": Optional[uuid.UUID]", class_definitions)
        class_definitions = re.sub(r": list", r": List[uuid.UUID]", class_definitions)
        class_definitions = re.sub(r": Optional\[list\]", r": Optional[List[uuid.UUID]]", class_definitions)
        class_definitions = re.sub(r": dict", r": Dict[str, Any]", class_definitions)
        class_definitions = re.sub(r": Optional\[dict\]", r": Optional[Dict[str, Any]]", class_definitions)
        class_definitions = class_definitions.replace("ARRAY(Uuid())", "ARRAY(Uuid(as_uuid=True))")
        class_definitions = class_definitions.replace(", Uuid)", ", Uuid(as_uuid=True))")


        final_code = import_section + class_definitions

        output_path = "app/models.py"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w") as f:
            f.write(final_code)

        print(f"SQLModel classes generated successfully and saved to {output_path}!")
        print("Applied transformations:")
        print("- Made default values database-agnostic")
        print("- Corrected type hints and Field definitions")
        
    except subprocess.CalledProcessError as e:
        print(f"Error generating SQLModel classes: {e}")
        print(f"Error output: {e.stderr}")
        sys.exit(1)

if __name__ == "__main__":
    generate_sqlmodel_from_sql()