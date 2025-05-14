# server/scripts/generate_models.py
# WIP, still does not work all the way
import subprocess
import sys

def generate_sqlmodel_from_sql():
    """Generate SQLModel classes from SQL schema using sqlacodegen"""
    # Make sure sqlacodegen is installed
    # pip install sqlacodegen
    
    # Database connection string
    db_url = "postgresql://myuser:mypassword@localhost:5432/mydb"
    
    # Run sqlacodegen to generate models
    cmd = f"sqlacodegen --generator sqlmodel {db_url} > server/app/models.py"
    
    try:
        subprocess.run(cmd, shell=True, check=True)
        print("SQLModel classes generated successfully!")
    except subprocess.CalledProcessError as e:
        print(f"Error generating SQLModel classes: {e}")
        sys.exit(1)

if __name__ == "__main__":
    generate_sqlmodel_from_sql() 