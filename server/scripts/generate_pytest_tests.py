#!/usr/bin/env python3
"""
Automated pytest test generator for FastAPI routes and services.
This version intelligently appends missing tests without overwriting existing ones.
"""

import ast
from pathlib import Path
from typing import List

# (analyze_route_file and analyze_service_file functions remain the same)
def analyze_route_file(file_path: str) -> List[str]:
    """Extract route function names from a Python file."""
    try:
        with open(file_path, "r") as f:
            content = f.read()

        tree = ast.parse(content)
        routes = []

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for decorator in node.decorator_list:
                    if isinstance(decorator, ast.Call):
                        if (
                            isinstance(decorator.func, ast.Attribute)
                            and isinstance(decorator.func.value, ast.Name)
                            and decorator.func.value.id == "router"
                        ):
                            routes.append(node.name)
                            break
                    elif isinstance(decorator, ast.Attribute):
                        if (
                            isinstance(decorator.value, ast.Name)
                            and decorator.value.id == "router"
                        ):
                            routes.append(node.name)
                            break
        return routes
    except Exception as e:
        print(f"Error analyzing {file_path}: {e}")
        return []

def analyze_service_file(file_path: str) -> List[str]:
    """Extract function names from a service file."""
    try:
        with open(file_path, "r") as f:
            content = f.read()
        tree = ast.parse(content)
        functions = []
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if not node.name.startswith("_"):
                    functions.append(node.name)
        return functions
    except Exception as e:
        print(f"Error analyzing {file_path}: {e}")
        return []

def analyze_test_file(file_path: str) -> List[str]:
    """Extract test class names from an existing test file."""
    if not Path(file_path).exists():
        return []
    try:
        with open(file_path, "r") as f:
            content = f.read()
        tree = ast.parse(content)
        classes = [node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]
        return classes
    except Exception as e:
        print(f"Error analyzing existing test file {file_path}: {e}")
        return []

# --- Test Generation for Individual Functions ---

def generate_single_route_test_class(func_name: str) -> str:
    """Generates the test class skeleton for a single route function."""
    return f'''
import pytest

@pytest.mark.skip(reason="TODO: implement tests for `{func_name}`")
class Test{func_name.title()}:
    """Tests for {func_name} endpoint."""

    def test_{func_name}_success(self, client):
        """Test successful {func_name} request."""
        # TODO: Implement test for {func_name}
        assert False, "IMPLEMENT: Test for {func_name}"

    def test_{func_name}_error(self, client):
        """Test {func_name} error handling."""
        # TODO: Implement error test for {func_name}
        assert False, "IMPLEMENT: Error test for {func_name}"
'''

def generate_single_service_test_class(func_name: str) -> str:
    """Generates the test class skeleton for a single service function."""
    return f'''

import pytest

@pytest.mark.skip(reason="TODO: implement tests for `{func_name}`")
class Test{func_name.title()}:
    """Tests for {func_name} function."""

    def test_{func_name}_success(self):
        """Test successful {func_name} execution."""
        # TODO: Implement test for {func_name}
        assert False, "IMPLEMENT: Test for {func_name}"

    def test_{func_name}_error(self):
        """Test {func_name} error handling."""
        # TODO: Implement error test for {func_name}
        assert False, "IMPLEMENT: Error test for {func_name}"
'''

# --- Full File Generation (for new files) ---

def generate_route_test(module_name: str, functions: List[str]) -> str:
    """Generate test content for a brand new route module."""
    test_content = f'''"""
Tests for app.routes.{module_name}
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from sqlmodel import Session
from uuid import uuid4
from app.routes.{module_name} import router

@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    from app.main import app
    return TestClient(app)

@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)
'''
    for func_name in functions:
        test_content += generate_single_route_test_class(func_name)
    return test_content + "\n"

def generate_service_test(module_path: str, functions: List[str]) -> str:
    """Generate test content for a brand new service module."""
    import_path = module_path.replace("/", ".")
    test_content = f'''"""
Tests for app.{import_path}
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from sqlmodel import Session
from uuid import uuid4
from app.{import_path} import *

@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)
'''
    for func_name in functions:
        test_content += generate_single_service_test_class(func_name)
    return test_content + "\n"

# (generate_conftest remains the same)
def generate_conftest():
    """Generate conftest.py for pytest configuration."""
    return f'''"""
Pytest configuration and shared fixtures.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, create_engine, SQLModel
from sqlmodel.pool import StaticPool
from unittest.mock import MagicMock
import os

from app.main import app
from app.db import get_session

@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine("sqlite:///:memory:", connect_args={{"check_same_thread": False}}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    return engine

@pytest.fixture
def test_session(test_engine):
    with Session(test_engine) as session:
        yield session

@pytest.fixture
def client(test_session):
    def get_test_session():
        return test_session
    app.dependency_overrides[get_session] = get_test_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def mock_session():
    return MagicMock(spec=Session)

@pytest.fixture
def sample_uuid():
    from uuid import uuid4
    return str(uuid4())

def pytest_configure(config):
    config.addinivalue_line("markers", "asyncio: mark test as async")
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line("markers", "unit: mark test as unit test")
'''

# --- Main Function with Updated Logic ---

def main():
    """Main function to generate/update tests and remove orphans."""
    app_dir = Path("app")
    tests_dir = Path("tests")
    print("🚀 Generating pytest tests for FastAPI application...")
    print(f"📁 Working directory: {Path.cwd()}")

    tests_dir.mkdir(exist_ok=True)
    (tests_dir / "routes").mkdir(exist_ok=True)
    (tests_dir / "services").mkdir(exist_ok=True)

    stats = {"routes": 0, "services": 0, "created": 0, "updated": 0, "deleted": 0}
    expected_test_files = set()

    # --- Process Routes ---
    routes_dir = app_dir / "routes"
    if routes_dir.exists():
        print("\n📁 Processing routes...")
        for py_file in routes_dir.glob("*.py"):
            if py_file.name.startswith("__"):
                continue

            test_file = tests_dir / "routes" / f"test_{py_file.stem}.py"
            expected_test_files.add(test_file.resolve())
            print(f"  📄 Syncing tests for {py_file.name}...")
            
            source_functions = analyze_route_file(str(py_file))
            if not source_functions:
                continue

            if not test_file.exists():
                test_content = generate_route_test(py_file.stem, source_functions)
                test_file.write_text(test_content)
                stats["created"] += 1
                print(f"    ✨ Created new test file: {test_file}")
            else:
                existing_classes = analyze_test_file(str(test_file))
                missing_functions = [
                    f for f in source_functions if f"Test{f.title()}" not in existing_classes
                ]
                if missing_functions:
                    content_to_append = ""
                    for func_name in missing_functions:
                        content_to_append += generate_single_route_test_class(func_name)
                    
                    with test_file.open("a") as f:
                        f.write(content_to_append + "\n")
                    stats["updated"] += 1
                    print(f"    🔄 Appended {len(missing_functions)} missing test class(es) to {test_file}")
                else:
                    print("    ✅ All tests are present.")
            stats["routes"] += 1

    # --- Process Services ---
    services_dir = app_dir / "services"
    if services_dir.exists():
        print("\n📁 Processing services...")
        for py_file in services_dir.rglob("*.py"):
            if py_file.name.startswith("__"):
                continue
            
            rel_path = py_file.relative_to(services_dir)
            test_dir = tests_dir / "services" / rel_path.parent
            # Make the test filename unique to avoid import conflicts
            test_filename = f"test_{rel_path.parent.name.lower()}_{rel_path.stem}.py" if rel_path.parent.name else f"test_{rel_path.stem}.py"
            test_file = test_dir / test_filename
            expected_test_files.add(test_file.resolve())
            
            print(f"  📄 Syncing tests for {rel_path}...")
            source_functions = analyze_service_file(str(py_file))
            if not source_functions:
                continue

            test_dir.mkdir(parents=True, exist_ok=True)
            if not test_file.exists():
                module_path = str(rel_path.with_suffix("")).replace("/", ".")
                test_content = generate_service_test(f"services.{module_path}", source_functions)
                test_file.write_text(test_content)
                stats["created"] += 1
                print(f"    ✨ Created new test file: {test_file}")
            else:
                existing_classes = analyze_test_file(str(test_file))
                missing_functions = [
                    f for f in source_functions if f"Test{f.title()}" not in existing_classes
                ]
                if missing_functions:
                    content_to_append = ""
                    for func_name in missing_functions:
                        content_to_append += generate_single_service_test_class(func_name)

                    with test_file.open("a") as f:
                        f.write(content_to_append + "\n")
                    stats["updated"] += 1
                    print(f"    🔄 Appended {len(missing_functions)} missing test class(es) to {test_file}")
                else:
                    print("    ✅ All tests are present.")
            stats["services"] += 1

    # --- Clean up orphan test files ---
    print("\n🗑️  Cleaning up orphan test files...")
    test_search_paths = [tests_dir / "routes", tests_dir / "services"]
    for path in test_search_paths:
        if path.exists():
            for test_file in path.rglob("test_*.py"):
                if test_file.resolve() not in expected_test_files:
                    try:
                        test_file.unlink()
                        stats["deleted"] += 1
                        print(f"  🔥 Deleted orphan: {test_file.relative_to(tests_dir)}")
                    except OSError as e:
                        print(f"  ❌ Error deleting {test_file}: {e}")

    # --- Generate conftest.py ---
    conftest_file = tests_dir / "conftest.py"
    if not conftest_file.exists():
        conftest_file.write_text(generate_conftest())
        print("\n📝 Generated conftest.py")

    # --- Summary ---
    print("\n📊 Summary:")
    print(f"  Processed: {stats['routes']} routes, {stats['services']} services")
    print(f"  ✨ Created: {stats['created']} | 🔄 Updated: {stats['updated']} | 🔥 Deleted: {stats['deleted']}")
    print("\n✅ Pytest test generation complete!")

if __name__ == "__main__":
    main()