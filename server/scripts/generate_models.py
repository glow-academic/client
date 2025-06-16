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
            "from typing import Any, Dict, List, Optional",
            "",
            "from sqlalchemy import (ARRAY, BigInteger, Boolean, Column, DateTime,",
            "                        Enum, ForeignKeyConstraint, Integer,",
            "                        PrimaryKeyConstraint, Sequence, String, Text, Uuid, text)",
            "from sqlalchemy.dialects.postgresql import JSONB",
            "from sqlmodel import Field, Relationship, SQLModel",
            "from sqlalchemy.orm import Mapped",
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

        # Apply type transformations
        print("Applying type transformations...")
        
        # 1. Replace ALL uuid.UUID fields with Mapped[uuid.UUID] - comprehensive approach
        # This will catch all patterns: primary keys, regular fields, with/without server_default
        class_definitions = re.sub(
            r"(\w+): uuid\.UUID = Field\(",
            r"\1: Mapped[uuid.UUID] = Field(",
            class_definitions
        )
        
        # 2. Replace bare UUID with Mapped[uuid.UUID] (for any remaining cases)
        class_definitions = re.sub(
            r"(\w+): UUID = Field\(",
            r"\1: Mapped[uuid.UUID] = Field(",
            class_definitions
        )
        
        # 3. Replace Optional[UUID] with Optional[uuid.UUID]
        class_definitions = re.sub(
            r"(\w+): Optional\[UUID\] = Field\(default=None, sa_column=Column\('(\w+)', Uuid\)\)",
            r"\1: Optional[uuid.UUID] = Field(default=None, sa_column=Column('\2', Uuid(as_uuid=True)))",
            class_definitions
        )
        
        # 4. Replace bare list with List[uuid.UUID] for UUID arrays - FIXED REGEX
        class_definitions = re.sub(
            r"(\w+): list = Field\(sa_column=Column\('(\w+)', ARRAY\(Uuid\(\)\)\)\)",
            r"\1: List[uuid.UUID] = Field(sa_column=Column('\2', ARRAY(Uuid(as_uuid=True))))",
            class_definitions
        )
        
        # 5. Handle list fields with server_default (more comprehensive pattern)
        class_definitions = re.sub(
            r"(\w+): list = Field\(sa_column=Column\('(\w+)', ARRAY\(Uuid\(as_uuid=True\)\), server_default=text\('([^']+)'\)\)\)",
            r"\1: List[uuid.UUID] = Field(sa_column=Column('\2', ARRAY(Uuid(as_uuid=True)), server_default=text('\3')))",
            class_definitions
        )
        
        # 6. Handle list fields with server_default (before Uuid transformation)
        class_definitions = re.sub(
            r"(\w+): list = Field\(sa_column=Column\('(\w+)', ARRAY\(Uuid\(\)\), server_default=text\('([^']+)'\)\)\)",
            r"\1: List[uuid.UUID] = Field(sa_column=Column('\2', ARRAY(Uuid(as_uuid=True)), server_default=text('\3')))",
            class_definitions
        )
        
        # 7. Replace Optional[list] with Optional[List[uuid.UUID]] for optional UUID arrays - FIXED REGEX
        class_definitions = re.sub(
            r"(\w+): Optional\[list\] = Field\(default=None, sa_column=Column\('(\w+)', ARRAY\(Uuid\(\)\)\)\)",
            r"\1: Optional[List[uuid.UUID]] = Field(default=None, sa_column=Column('\2', ARRAY(Uuid(as_uuid=True))))",
            class_definitions
        )
        
        # 8. Replace bare dict with Dict[str, Any]
        class_definitions = re.sub(
            r"(\w+): Optional\[dict\] = Field\(default=None, sa_column=Column\('(\w+)', JSONB\)\)",
            r"\1: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column('\2', JSONB))",
            class_definitions
        )
        
        # 9. Fix any remaining Uuid() to Uuid(as_uuid=True) in ARRAY contexts
        class_definitions = re.sub(
            r"ARRAY\(Uuid\(\)\)",
            r"ARRAY(Uuid(as_uuid=True))",
            class_definitions
        )
        
        # 10. Fix any remaining bare Uuid() to Uuid(as_uuid=True) in Column contexts
        class_definitions = re.sub(
            r"Column\('(\w+)', Uuid\)",
            r"Column('\1', Uuid(as_uuid=True))",
            class_definitions
        )
        
        # 7. Remove duplicate relationship definitions (fix the duplicate 'standard' issue)
        lines = class_definitions.split('\n')
        cleaned_lines = []
        seen_relationships = {}
        current_class = None
        
        for line in lines:
            # Track current class
            if line.strip().startswith('class ') and '(_Base, table=True):' in line:
                current_class = line.split('class ')[1].split('(')[0]
                seen_relationships[current_class] = set()
                cleaned_lines.append(line)
            elif current_class and ': ' in line and 'Relationship(' in line:
                # Extract relationship name (handle both Optional and List types)
                rel_name = line.split(':')[0].strip()
                if rel_name not in seen_relationships[current_class]:
                    seen_relationships[current_class].add(rel_name)
                    cleaned_lines.append(line)
                # Skip duplicate relationships
            else:
                cleaned_lines.append(line)
        
        class_definitions = '\n'.join(cleaned_lines)

        # Combine imports and class definitions
        final_code = import_section + class_definitions

        # Write the modified output to the models.py file
        output_path = "app/models.py"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        with open(output_path, "w") as f:
            f.write(final_code)

        print(f"SQLModel classes generated successfully and saved to {output_path}!")
        print("Applied transformations:")
        print("- UUID → Mapped[uuid.UUID] with Uuid(as_uuid=True)")
        print("- Optional[UUID] → Optional[uuid.UUID]")
        print("- list → List[uuid.UUID] for UUID arrays")
        print("- dict → Dict[str, Any]")
        print("- Removed duplicate relationships")
        print("- Fixed parentheses in ARRAY field definitions")
        
    except subprocess.CalledProcessError as e:
        print(f"Error generating SQLModel classes: {e}")
        print(f"Error output: {e.stderr}")
        sys.exit(1)


if __name__ == "__main__":
    generate_sqlmodel_from_sql()
