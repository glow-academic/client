# app/utils/csv.py
import csv
import hashlib
import io
import uuid
from typing import List, Dict, Any
from sqlmodel import Session
from app.models import Users

def process_csv_file(file_path: str, session: Session) -> Dict[str, Any]:
    """
    Process a CSV file containing user data and insert users into the database.
    
    Expected CSV format:
    name,username,password
    John Doe,john_doe,password123
    Jane Smith,jane_smith,password456
    
    Args:
        file_path: Path to the CSV file
        session: Database session
        
    Returns:
        Dictionary with processing results
    """
    try:
        users_created = []
        users_skipped = []
        errors = []
        
        with open(file_path, 'r', encoding='utf-8') as file:
            # Read the CSV content
            csv_content = file.read()
            
            # Use StringIO to create a file-like object
            csv_file = io.StringIO(csv_content)
            
            # Create CSV reader
            csv_reader = csv.DictReader(csv_file)
            
            # Validate headers
            expected_headers = {'name', 'username', 'password'}
            actual_headers = set(csv_reader.fieldnames or [])
            
            if not expected_headers.issubset(actual_headers):
                missing_headers = expected_headers - actual_headers
                return {
                    "success": False,
                    "error": f"Missing required headers: {', '.join(missing_headers)}",
                    "users_created": 0,
                    "users_skipped": 0
                }
            
            # Process each row
            for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 because row 1 is headers
                try:
                    # Extract and validate data
                    name = row.get('name', '').strip()
                    username = row.get('username', '').strip()
                    password = row.get('password', '').strip()
                    
                    if not name or not username or not password:
                        errors.append(f"Row {row_num}: Missing required fields (name, username, or password)")
                        continue
                    
                    # Check if user already exists
                    existing_user = session.query(Users).filter(Users.username == username).first()
                    if existing_user:
                        users_skipped.append({
                            "username": username,
                            "reason": "User already exists"
                        })
                        continue
                    
                    # Hash the password
                    hashed_password = hashlib.sha256(password.encode('utf-8')).hexdigest()
                    
                    # Create new user
                    new_user = Users(
                        id=uuid.uuid4(),
                        name=name,
                        username=username,
                        password=hashed_password,
                        admin=False,
                        viewed_intro=False,
                        classes=[]  # Empty array as specified
                    )
                    
                    session.add(new_user)
                    users_created.append({
                        "name": name,
                        "username": username
                    })
                    
                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")
                    continue
            
            # Commit all changes
            session.commit()
            
            return {
                "success": True,
                "users_created": len(users_created),
                "users_skipped": len(users_skipped),
                "errors": errors,
                "created_users": users_created,
                "skipped_users": users_skipped
            }
            
    except Exception as e:
        session.rollback()
        return {
            "success": False,
            "error": f"Failed to process CSV file: {str(e)}",
            "users_created": 0,
            "users_skipped": 0
        }

def validate_csv_format(file_path: str) -> Dict[str, Any]:
    """
    Validate CSV file format without processing it.
    
    Args:
        file_path: Path to the CSV file
        
    Returns:
        Dictionary with validation results
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            csv_content = file.read()
            csv_file = io.StringIO(csv_content)
            csv_reader = csv.DictReader(csv_file)
            
            # Check headers
            expected_headers = {'name', 'username', 'password'}
            actual_headers = set(csv_reader.fieldnames or [])
            
            if not expected_headers.issubset(actual_headers):
                missing_headers = expected_headers - actual_headers
                return {
                    "valid": False,
                    "error": f"Missing required headers: {', '.join(missing_headers)}",
                    "expected_headers": list(expected_headers),
                    "actual_headers": list(actual_headers)
                }
            
            # Count rows
            row_count = sum(1 for _ in csv_reader)
            
            return {
                "valid": True,
                "row_count": row_count,
                "headers": list(actual_headers)
            }
            
    except Exception as e:
        return {
            "valid": False,
            "error": f"Failed to validate CSV file: {str(e)}"
        }