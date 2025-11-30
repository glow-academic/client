#!/usr/bin/env python3
"""Migration 37 helper script: Rename UUID files and move uploads directory.

This script:
1. Moves files from server/uploads/ to root uploads/ (if not already there)
2. Renames 2 UUID-named files to their database names
3. Removes server/uploads/ directory after migration
"""

import os
import shutil
from pathlib import Path

# Get project root (assuming script is in database/migrate/)
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
SERVER_UPLOADS = PROJECT_ROOT / "server" / "uploads"
ROOT_UPLOADS = PROJECT_ROOT / "uploads"

# Files to rename: UUID -> database name
FILES_TO_RENAME = {
    "57d963bc-f6f9-4fd4-b7b5-cdb822f4778.pdf": "CS253-PSO6.pdf",
    "edfab767-8ff1-4418-ad8f-22cec348b76.pdf": "hw5_pdf.pdf",
}


def main():
    """Main migration script."""
    print("Migration 37: Starting file operations...")

    # Step 1: Ensure root uploads directory exists
    ROOT_UPLOADS.mkdir(parents=True, exist_ok=True)
    print(f"✓ Root uploads directory ready: {ROOT_UPLOADS}")

    # Step 2: Move files from server/uploads to root uploads (if server/uploads exists)
    if SERVER_UPLOADS.exists() and SERVER_UPLOADS.is_dir():
        print(f"✓ Found server/uploads directory: {SERVER_UPLOADS}")
        
        # Move all files except tus_uploads subdirectory
        moved_count = 0
        for item in SERVER_UPLOADS.iterdir():
            if item.name == "tus_uploads":
                # Move tus_uploads directory
                tus_source = item
                tus_dest = ROOT_UPLOADS / "tus_uploads"
                if tus_dest.exists():
                    print(f"  ⚠ tus_uploads already exists in root, skipping")
                else:
                    shutil.move(str(tus_source), str(tus_dest))
                    print(f"  ✓ Moved tus_uploads directory")
                continue
            
            if item.is_file():
                dest_file = ROOT_UPLOADS / item.name
                if dest_file.exists():
                    print(f"  ⚠ File {item.name} already exists in root, skipping")
                else:
                    shutil.move(str(item), str(dest_file))
                    moved_count += 1
                    print(f"  ✓ Moved {item.name}")
        
        print(f"✓ Moved {moved_count} files from server/uploads to root uploads")
    else:
        print(f"⚠ server/uploads directory does not exist, skipping move")

    # Step 3: Rename UUID files to their database names
    renamed_count = 0
    for uuid_name, db_name in FILES_TO_RENAME.items():
        source_file = ROOT_UPLOADS / uuid_name
        
        # Also check server/uploads in case file wasn't moved yet
        if not source_file.exists():
            server_source = SERVER_UPLOADS / uuid_name
            if server_source.exists():
                source_file = server_source
        
        if source_file.exists():
            dest_file = ROOT_UPLOADS / db_name
            if dest_file.exists():
                print(f"  ⚠ Target file {db_name} already exists, skipping rename")
            else:
                shutil.move(str(source_file), str(dest_file))
                renamed_count += 1
                print(f"  ✓ Renamed {uuid_name} -> {db_name}")
        else:
            print(f"  ⚠ Source file {uuid_name} not found, skipping")

    print(f"✓ Renamed {renamed_count} UUID files")

    # Step 4: Remove server/uploads directory if empty or only contains tus_uploads
    if SERVER_UPLOADS.exists():
        remaining_items = [item for item in SERVER_UPLOADS.iterdir() if item.name != "tus_uploads"]
        if not remaining_items:
            # Check if tus_uploads was moved
            if not (SERVER_UPLOADS / "tus_uploads").exists():
                try:
                    SERVER_UPLOADS.rmdir()
                    print(f"✓ Removed empty server/uploads directory")
                except OSError as e:
                    print(f"  ⚠ Could not remove server/uploads: {e}")
            else:
                print(f"  ⚠ server/uploads still contains tus_uploads, keeping directory")
        else:
            print(f"  ⚠ server/uploads still contains {len(remaining_items)} items, keeping directory")

    print("Migration 37: File operations completed successfully!")


if __name__ == "__main__":
    main()

