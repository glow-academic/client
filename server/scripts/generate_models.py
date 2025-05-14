# server/scripts/generate_models.py
import subprocess
import sys
import os
from dotenv import load_dotenv
import re

load_dotenv()

def generate_sqlmodel_from_sql():
    """Generate SQLModel classes from SQL schema using sqlacodegen"""
    # Get the Python executable from the virtual environment
    python_executable = sys.executable
    
    # Database connection string
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        print("Error: DATABASE_URL environment variable is not set")
        sys.exit(1)
    
    # Install sqlacodegen if not already installed
    try:
        subprocess.run([python_executable, "-m", "pip", "install", "sqlacodegen"], check=True)
        print("Installed sqlacodegen successfully")
    except subprocess.CalledProcessError as e:
        print(f"Error installing sqlacodegen: {e}")
        sys.exit(1)
    
    # Run sqlacodegen directly as a command-line tool
    cmd = [
        python_executable, 
        "-m", 
        "pip", 
        "show", 
        "sqlacodegen"
    ]
    
    try:
        # First check if we can find the package info
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("Found sqlacodegen package")
        
        # Now run the actual command
        cmd = [
            python_executable,
            "-m",
            "sqlacodegen",
            "--generator=sqlmodels",
            db_url
        ]
        
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        
        # Process the generated code
        generated_code = result.stdout
        
        # Add pydantic ConfigDict import if not present
        if "from pydantic import ConfigDict" not in generated_code:
            generated_code = generated_code.replace(
                "from sqlmodel import Field, Relationship, SQLModel",
                "from sqlmodel import Field, Relationship, SQLModel\nfrom pydantic import ConfigDict"
            )
        
        # Add the _Base class
        base_class = "\n\nclass _Base(SQLModel):\n    \"\"\"Shared config so Pydantic will accept SQLAlchemy types.\"\"\"\n    model_config = ConfigDict(arbitrary_types_allowed=True)\n"
        
        # Find all model classes
        model_pattern = r"class (\w+)\(SQLModel, table=True\):"
        model_classes = re.findall(model_pattern, generated_code)
        
        # Insert the _Base class before the first model class
        first_class_match = re.search(model_pattern, generated_code)
        if first_class_match:
            insert_pos = first_class_match.start()
            generated_code = generated_code[:insert_pos] + base_class + generated_code[insert_pos:]
        
        # Replace inheritance in all model classes
        for model_class in model_classes:
            generated_code = generated_code.replace(
                f"class {model_class}(SQLModel, table=True):",
                f"class {model_class}(_Base, table=True):"
            )
        
        # Write the modified output to the models.py file
        output_path = "app/models.py"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, "w") as f:
            f.write(generated_code)
            
        print(f"SQLModel classes generated successfully and saved to {output_path}!")
    except subprocess.CalledProcessError as e:
        print(f"Error generating SQLModel classes: {e}")
        print(f"Error output: {e.stderr}")
        sys.exit(1)

if __name__ == "__main__":
    generate_sqlmodel_from_sql()