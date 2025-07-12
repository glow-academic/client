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
            "from datetime import datetime, timezone",
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
        
        lines = generated_code.split('\n')
        class_start_idx = 0
        for i, line in enumerate(lines):
            if 'SQLModel' in line and line.strip().startswith('class '):
                class_start_idx = i
                break
        
        class_definitions = '\n'.join(lines[class_start_idx:])

        base_class = '\nclass _Base(SQLModel):\n    """Shared config so Pydantic will accept SQLAlchemy types."""\n    model_config = {"arbitrary_types_allowed": True}\n'
        class_definitions = base_class + class_definitions
        class_definitions = re.sub(
            r"class (\w+)\(SQLModel, table=True\):",
            r"class \1(_Base, table=True):",
            class_definitions
        )

        print("Applying type transformations...")

        # ❌ REMOVE ALL the old re.sub and loop logic for default values.
        # ✅ REPLACE it with this new, cleaner block.

        # --- Convert Postgres-specific defaults to portable Python equivalents ---
        # This new method directly transforms the sqlacodegen output to the final, correct format.
        
        # Handle datetime defaults like now()
        class_definitions = re.sub(
            r"sa_column=Column\((.*?), server_default=text\('now\(\)'\)(.*?)\)",
            r"default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(\1\2)",
            class_definitions,
        )
        # Handle UUID defaults like gen_random_uuid()
        class_definitions = re.sub(
            r"sa_column=Column\((.*?), server_default=text\('gen_random_uuid\(\)'\)(.*?)\)",
            r"default_factory=uuid.uuid4, sa_column=Column(\1\2)",
            class_definitions,
        )
        # Handle JSONB defaults
        class_definitions = re.sub(
            r"sa_column=Column\((.*?), server_default=text\(\"'{}'::jsonb\"\)(.*?)\)",
            r"default_factory=dict, sa_column=Column(\1\2)",
            class_definitions,
        )
        # Handle array defaults
        class_definitions = re.sub(
            r"sa_column=Column\((.*?), server_default=text\('ARRAY\[\]::uuid\[\]'\)(.*?)\)",
            r"default_factory=list, sa_column=Column(\1\2)",
            class_definitions,
        )
        # Handle simple boolean/number/enum text defaults
        class_definitions = re.sub(r"server_default=text\('false'\)", "default=False", class_definitions)
        class_definitions = re.sub(r"server_default=text\('true'\)", "default=True", class_definitions)
        class_definitions = re.sub(r"server_default=text\('([\d\.]+)'\)", r"default=\1", class_definitions)
        class_definitions = re.sub(r"server_default=text\(\"'([\w\s]+)'::[\w\s]+\"\)", r"default=r'\1'", class_definitions)

        # Correct type hints and other formatting
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