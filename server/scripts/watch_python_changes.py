#!/usr/bin/env python3
"""
Watch for changes in Python files and automatically regenerate tests.
"""

import os
import json
import hashlib
from pathlib import Path
from typing import Dict, Set


class PythonFileWatcher:
    """Watches Python files for changes and triggers test regeneration."""

    def __init__(self, cache_file: str = ".pytest_cache.json"):
        self.cache_file = Path(cache_file)
        self.app_dir = Path("app")
        self.routes_dir = self.app_dir / "routes"
        self.services_dir = self.app_dir / "services"
        self.cache = self._load_cache()

    def _load_cache(self) -> Dict[str, str]:
        """Load the file modification cache."""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, "r") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading cache: {e}")
        return {}

    def _save_cache(self):
        """Save the file modification cache."""
        try:
            with open(self.cache_file, "w") as f:
                json.dump(self.cache, f, indent=2)
        except Exception as e:
            print(f"Error saving cache: {e}")

    def _get_file_hash(self, file_path: Path) -> str:
        """Get MD5 hash of file content."""
        try:
            with open(file_path, "rb") as f:
                return hashlib.md5(f.read()).hexdigest()
        except Exception:
            return ""

    def _scan_directory(self, directory: Path) -> Dict[str, str]:
        """Scan directory for Python files and their hashes."""
        files = {}
        if directory.exists():
            for py_file in directory.rglob("*.py"):
                if not py_file.name.startswith("__"):
                    rel_path = str(py_file.relative_to(Path.cwd()))
                    files[rel_path] = self._get_file_hash(py_file)
        return files

    def check_for_changes(self) -> Dict[str, Set[str]]:
        """Check for changes in Python files."""
        current_files = {}
        current_files.update(self._scan_directory(self.routes_dir))
        current_files.update(self._scan_directory(self.services_dir))

        changes = {"added": set(), "modified": set(), "removed": set()}

        # Check for added and modified files
        for file_path, file_hash in current_files.items():
            if file_path not in self.cache:
                changes["added"].add(file_path)
            elif self.cache[file_path] != file_hash:
                changes["modified"].add(file_path)

        # Check for removed files
        for file_path in self.cache:
            if file_path not in current_files:
                changes["removed"].add(file_path)

        # Update cache
        self.cache = current_files

        return changes

    def update_cache(self):
        """Update the cache with current file states."""
        current_files = {}
        current_files.update(self._scan_directory(self.routes_dir))
        current_files.update(self._scan_directory(self.services_dir))

        self.cache = current_files
        self._save_cache()

    def remove_orphaned_tests(self, removed_files: Set[str]):
        """Remove test files for deleted source files."""
        tests_dir = Path("tests")

        for file_path in removed_files:
            # Convert source file path to test file path
            path_obj = Path(file_path)

            if path_obj.parts[1] == "routes":
                test_file = tests_dir / "routes" / f"test_{path_obj.stem}.py"
            elif path_obj.parts[1] == "services":
                rel_path = path_obj.relative_to(Path("app/services"))
                test_file = (
                    tests_dir
                    / "services"
                    / rel_path.parent
                    / f"test_{rel_path.stem}.py"
                )
            else:
                continue

            if test_file.exists():
                test_file.unlink()
                print(f"🗑️  Removed orphaned test: {test_file}")


def main():
    """Main function for the watch script."""
    import sys

    watcher = PythonFileWatcher()

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "check":
            # Check for changes without updating cache
            changes = watcher.check_for_changes()

            if any(changes.values()):
                print("📝 Changes detected:")
                if changes["added"]:
                    print(f"  ➕ Added: {', '.join(changes['added'])}")
                if changes["modified"]:
                    print(f"  📝 Modified: {', '.join(changes['modified'])}")
                if changes["removed"]:
                    print(f"  ➖ Removed: {', '.join(changes['removed'])}")

                # Remove orphaned tests
                if changes["removed"]:
                    watcher.remove_orphaned_tests(changes["removed"])

                # Save updated cache
                watcher._save_cache()

                # Exit with code 1 to indicate changes
                sys.exit(1)
            else:
                print("✅ No changes detected")
                sys.exit(0)

        elif command == "update":
            # Update cache with current state
            watcher.update_cache()
            print("✅ Cache updated")
            sys.exit(0)

        elif command == "force":
            # Force regeneration by clearing cache
            if watcher.cache_file.exists():
                watcher.cache_file.unlink()
            print("🔄 Cache cleared - tests will be regenerated")
            sys.exit(0)

        else:
            print(f"Unknown command: {command}")
            print("Usage: python watch_python_changes.py [check|update|force]")
            sys.exit(1)

    else:
        # Default: check for changes
        changes = watcher.check_for_changes()

        if any(changes.values()):
            print("📝 Changes detected - regenerating tests...")

            # Remove orphaned tests
            if changes["removed"]:
                watcher.remove_orphaned_tests(changes["removed"])

            # Save updated cache
            watcher._save_cache()

            # Run test generation
            os.system("python scripts/generate_pytest_tests.py")
        else:
            print("✅ No changes detected")


if __name__ == "__main__":
    main()
 