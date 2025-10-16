# app/utils/csv.py
import csv
import io
import uuid
from typing import Any, Dict

import asyncpg  # type: ignore


async def process_csv_file(file_path: str, conn: asyncpg.Connection) -> Dict[str, Any]:
    """
    Process a CSV file containing user data and insert users into the database.

    Expected CSV format:
    name,username
    John Doe,john_doe
    Jane Smith,jane_smith

    Args:
        file_path: Path to the CSV file
        conn: Database connection

    Returns:
        Dictionary with processing results
    """
    try:
        users_created = []
        users_skipped = []
        errors = []

        with open(file_path, "r", encoding="utf-8") as file:
            # Read the CSV content
            csv_content = file.read()

            # Use StringIO to create a file-like object
            csv_file = io.StringIO(csv_content)

            # Create CSV reader
            csv_reader = csv.DictReader(csv_file)

            # Validate headers
            expected_headers = {"name", "username"}
            actual_headers = set(csv_reader.fieldnames or [])

            if not expected_headers.issubset(actual_headers):
                missing_headers = expected_headers - actual_headers
                return {
                    "success": False,
                    "error": f"Missing required headers: {', '.join(missing_headers)}",
                    "users_created": 0,
                    "users_skipped": 0,
                }

            # Start a transaction
            async with conn.transaction():
                # Process each row
                for row_num, row in enumerate(
                    csv_reader, start=2
                ):  # Start at 2 because row 1 is headers
                    try:
                        # Extract and validate data
                        name = row.get("name", "").strip()
                        username = row.get("username", "").strip()

                        if not name or not username:
                            errors.append(
                                f"Row {row_num}: Missing required fields (name, username)"
                            )
                            continue

                        # Check if user already exists
                        existing_user = await conn.fetchrow(
                            "SELECT id FROM profiles WHERE alias = $1",
                            username
                        )
                        if existing_user:
                            users_skipped.append(
                                {"username": username, "reason": "User already exists"}
                            )
                            continue

                        # Create new user
                        user_id = uuid.uuid4()
                        await conn.execute("""
                            INSERT INTO profiles (id, first_name, alias, role, viewed_intro)
                            VALUES ($1, $2, $3, $4, $5)
                        """, user_id, name, username, "ta", False)

                        users_created.append({"name": name, "username": username})

                    except Exception as e:
                        errors.append(f"Row {row_num}: {str(e)}")
                        continue

            return {
                "success": True,
                "users_created": len(users_created),
                "users_skipped": len(users_skipped),
                "errors": errors,
                "created_users": users_created,
                "skipped_users": users_skipped,
            }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to process CSV file: {str(e)}",
            "users_created": 0,
            "users_skipped": 0,
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
        with open(file_path, "r", encoding="utf-8") as file:
            csv_content = file.read()
            csv_file = io.StringIO(csv_content)
            csv_reader = csv.DictReader(csv_file)

            # Check headers
            expected_headers = {"name", "username"}
            actual_headers = set(csv_reader.fieldnames or [])

            if not expected_headers.issubset(actual_headers):
                missing_headers = expected_headers - actual_headers
                return {
                    "valid": False,
                    "error": f"Missing required headers: {', '.join(missing_headers)}",
                    "expected_headers": list(expected_headers),
                    "actual_headers": list(actual_headers),
                }

            # Count rows
            row_count = sum(1 for _ in csv_reader)

            return {
                "valid": True,
                "row_count": row_count,
                "headers": list(actual_headers),
            }

    except Exception as e:
        return {"valid": False, "error": f"Failed to validate CSV file: {str(e)}"}
