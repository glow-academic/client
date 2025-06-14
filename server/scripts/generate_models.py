# server/scripts/generate_models.py
import os
import re
import subprocess
import sys

from dotenv import load_dotenv

load_dotenv()


def generate_sqlmodel_from_sql():
    """Generate SQLModel classes from SQL schema using sqlacodegen"""
    # Get the Python executable from the virtual environment
    python_executable = sys.executable

    # Get database connection parameters
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME")
    db_port = os.getenv("DB_PORT")
    db_host = os.getenv("DB_HOST")

    # Construct the database URL
    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    if not all([db_user, db_password, db_name, db_host, db_port]):
        print("Error: Database environment variables are not properly set")
        sys.exit(1)

    print(f"Using database URL: {db_url}")

    # Run sqlacodegen directly as a command-line tool
    cmd = [python_executable, "-m", "sqlacodegen", "--generator=sqlmodels", db_url]

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)

        # Process the generated code
        generated_code = result.stdout

        # Add necessary imports at the top
        import_lines = [
            "import uuid",
            "from datetime import datetime",
            "from typing import Any, List, Optional",
            "",
            "from sqlalchemy import (ARRAY, UUID, BigInteger, Boolean, Column, DateTime,",
            "                        Enum, ForeignKeyConstraint, Integer,",
            "                        PrimaryKeyConstraint, String, Text, Uuid, text)",
            "from sqlalchemy.dialects.postgresql import JSONB",
            "from sqlalchemy.orm import Mapped",
            "from sqlmodel import Field, Relationship, SQLModel",
        ]
        
        # Replace the existing imports with our custom imports
        import_section = "\n".join(import_lines)
        
        # Find where imports end and classes begin
        lines = generated_code.split('\n')
        class_start_idx = 0
        for i, line in enumerate(lines):
            if line.strip().startswith('class ') and 'SQLModel' in line:
                class_start_idx = i
                break
        
        # Keep only the class definitions part
        class_definitions = '\n'.join(lines[class_start_idx:])

        # Add the _Base class
        base_class = '\n\nclass _Base(SQLModel):\n    """Shared config so Pydantic will accept SQLAlchemy types."""\n    model_config = {"arbitrary_types_allowed": True}\n'

        # Find all model classes
        model_pattern = r"class (\w+)\(SQLModel, table=True\):"
        model_classes = re.findall(model_pattern, class_definitions)

        # Insert the _Base class before the first model class
        first_class_match = re.search(model_pattern, class_definitions)
        if first_class_match:
            insert_pos = first_class_match.start()
            class_definitions = (
                class_definitions[:insert_pos] + base_class + class_definitions[insert_pos:]
            )

        # Replace inheritance in all model classes
        for model_class in model_classes:
            class_definitions = class_definitions.replace(
                f"class {model_class}(SQLModel, table=True):",
                f"class {model_class}(_Base, table=True):",
            )

        # Fix inheritance issues - convert any class that inherits from another model to use composition instead
        inheritance_pattern = r"class (\w+)\((\w+), table=True\):"
        for match in re.finditer(inheritance_pattern, class_definitions):
            child_class = match.group(1)
            parent_class = match.group(2)
            if parent_class != "_Base" and parent_class != "SQLModel":
                # Replace inheritance with composition
                class_definitions = class_definitions.replace(
                    f"class {child_class}({parent_class}, table=True):",
                    f"class {child_class}(_Base, table=True):",
                )
                print(
                    f"Fixed inheritance: {child_class} now uses composition instead of inheriting from {parent_class}"
                )

        # Replace UUID[str] with Mapped[uuid.UUID] for primary key UUID fields
        # Pattern to match UUID primary key fields
        uuid_pk_pattern = r"(\w+): UUID\[str\] = Field\(sa_column=Column\('(\w+)', Uuid(?:\(as_uuid=True\))?, primary_key=True"
        class_definitions = re.sub(
            uuid_pk_pattern,
            r"\1: Mapped[uuid.UUID] = Field(sa_column=Column('\2', Uuid(as_uuid=True), primary_key=True",
            class_definitions
        )
        
        # Replace other UUID[str] fields with Mapped[uuid.UUID] where appropriate
        # This handles non-primary key UUID fields
        uuid_field_pattern = r"(\w+): UUID\[str\] = Field\(sa_column=Column\('(\w+)', Uuid\)\)"
        class_definitions = re.sub(
            uuid_field_pattern,
            r"\1: Mapped[uuid.UUID] = Field(sa_column=Column('\2', Uuid(as_uuid=True)))",
            class_definitions
        )
        
        # Handle Optional UUID fields
        optional_uuid_pattern = r"(\w+): Optional\[UUID\[str\]\] = Field\(default=None, sa_column=Column\('(\w+)', Uuid\)\)"
        class_definitions = re.sub(
            optional_uuid_pattern,
            r"\1: Optional[Mapped[uuid.UUID]] = Field(default=None, sa_column=Column('\2', Uuid(as_uuid=True)))",
            class_definitions
        )

        # Handle UUID arrays
        uuid_array_pattern = r"(\w+): list\[UUID\[str\]\] = Field\(sa_column=Column\('(\w+)', ARRAY\(Uuid\(\)\)"
        class_definitions = re.sub(
            uuid_array_pattern,
            r"\1: list[uuid.UUID] = Field(sa_column=Column('\2', ARRAY(Uuid(as_uuid=True))",
            class_definitions
        )
        
        # Handle Optional UUID arrays
        optional_uuid_array_pattern = r"(\w+): Optional\[list\[UUID\[str\]\]\] = Field\(default=None, sa_column=Column\('(\w+)', ARRAY\(Uuid\(\)\)\)"
        class_definitions = re.sub(
            optional_uuid_array_pattern,
            r"\1: Optional[list[uuid.UUID]] = Field(default=None, sa_column=Column('\2', ARRAY(Uuid(as_uuid=True))))",
            class_definitions
        )

        # Combine imports and class definitions
        final_code = import_section + class_definitions

        # Write the modified output to the models.py file
        output_path = "app/models.py"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        with open(output_path, "w") as f:
            f.write(final_code)

        print(f"SQLModel classes generated successfully and saved to {output_path}!")
        print("Applied UUID field transformations:")
        print("- UUID[str] primary keys → Mapped[uuid.UUID]")
        print("- UUID[str] fields → Mapped[uuid.UUID]")
        print("- Optional[UUID[str]] → Optional[Mapped[uuid.UUID]]")
        print("- list[UUID[str]] → list[uuid.UUID]")
        
    except subprocess.CalledProcessError as e:
        print(f"Error generating SQLModel classes: {e}")
        print(f"Error output: {e.stderr}")
        sys.exit(1)


if __name__ == "__main__":
    generate_sqlmodel_from_sql()
    generate_sqlmodel_from_sql()
