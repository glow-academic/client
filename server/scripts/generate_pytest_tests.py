#!/usr/bin/env python3
"""
Automated pytest test generator for FastAPI routes and services.
"""

import ast
from pathlib import Path
from typing import List
from datetime import datetime


def analyze_route_file(file_path: str) -> List[str]:
    """Extract route function names from a Python file."""
    try:
        with open(file_path, "r") as f:
            content = f.read()

        tree = ast.parse(content)
        routes = []

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # Check if function has router decorators
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
                if not node.name.startswith("_"):  # Skip private functions
                    functions.append(node.name)

        return functions
    except Exception as e:
        print(f"Error analyzing {file_path}: {e}")
        return []


def generate_route_test(module_name: str, functions: List[str]) -> str:
    """Generate test content for a route module."""
    test_content = f'''"""
Tests for app.routes.{module_name}


"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from sqlmodel import Session
from uuid import uuid4

# Import the router being tested
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
        test_content += f'''
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

    return test_content


def generate_service_test(module_path: str, functions: List[str]) -> str:
    """Generate test content for a service module."""
    import_path = module_path.replace("/", ".")

    test_content = f'''"""
Tests for app.{import_path}


"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from sqlmodel import Session
from uuid import uuid4

# Import the module being tested
from app.{import_path} import *

@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)

'''

    for func_name in functions:
        test_content += f'''
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

    return test_content


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
import tempfile
import os

# Import your app
from app.main import app
from app.db import get_session


@pytest.fixture(scope="session")
def test_engine():
    """Create a test database engine."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={{"check_same_thread": False}},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def test_session(test_engine):
    """Create a test database session."""
    with Session(test_engine) as session:
        yield session


@pytest.fixture
def client(test_session):
    """Create a test client with database session override."""
    def get_test_session():
        return test_session
    
    app.dependency_overrides[get_session] = get_test_session
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


@pytest.fixture
def sample_uuid():
    """Generate a sample UUID for testing."""
    from uuid import uuid4
    return str(uuid4())


# Pytest configuration
def pytest_configure(config):
    """Configure pytest."""
    config.addinivalue_line("markers", "asyncio: mark test as async")
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line("markers", "unit: mark test as unit test")
'''


def main():
    """Main function to generate all tests."""
    app_dir = Path("app")
    tests_dir = Path("tests")

    print("🚀 Generating pytest tests for FastAPI application...")
    print(f"📁 Working directory: {Path.cwd()}")
    print(f"📁 App directory exists: {app_dir.exists()}")

    # Create tests directory structure
    tests_dir.mkdir(exist_ok=True)
    (tests_dir / "routes").mkdir(exist_ok=True)
    (tests_dir / "services").mkdir(exist_ok=True)

    stats = {"routes": 0, "services": 0, "tests_created": 0}

    # Generate route tests
    routes_dir = app_dir / "routes"
    if routes_dir.exists():
        print("\n📁 Processing routes...")
        for py_file in routes_dir.glob("*.py"):
            if py_file.name.startswith("__"):
                continue

            print(f"  📄 Analyzing {py_file.name}...")
            functions = analyze_route_file(str(py_file))

            if functions:
                test_content = generate_route_test(py_file.stem, functions)
                test_file = tests_dir / "routes" / f"test_{py_file.stem}.py"

                # Only create if doesn't exist or contains failing tests
                should_create = True
                if test_file.exists():
                    existing = test_file.read_text()
                    if 'assert False, "IMPLEMENT:' not in existing:
                        should_create = False
                        print("    ⏭️  Skipped (already implemented)")

                if should_create:
                    test_file.write_text(test_content)
                    stats["tests_created"] += 1
                    print(f"    ✨ Created test_{py_file.stem}.py")

                stats["routes"] += 1

    # Generate service tests
    services_dir = app_dir / "services"
    if services_dir.exists():
        print("\n📁 Processing services...")
        for py_file in services_dir.rglob("*.py"):
            if py_file.name.startswith("__"):
                continue

            rel_path = py_file.relative_to(services_dir)
            print(f"  📄 Analyzing {rel_path}...")
            functions = analyze_service_file(str(py_file))

            if functions:
                # Create test directory structure
                test_dir = tests_dir / "services" / rel_path.parent
                test_dir.mkdir(parents=True, exist_ok=True)

                module_path = str(rel_path.with_suffix("")).replace("/", ".")
                test_content = generate_service_test(
                    f"services.{module_path}", functions
                )
                test_file = test_dir / f"test_{rel_path.stem}.py"

                # Only create if doesn't exist or contains failing tests
                should_create = True
                if test_file.exists():
                    existing = test_file.read_text()
                    if 'assert False, "IMPLEMENT:' not in existing:
                        should_create = False
                        print("    ⏭️  Skipped (already implemented)")

                if should_create:
                    test_file.write_text(test_content)
                    stats["tests_created"] += 1
                    print(f"    ✨ Created {test_file.relative_to(tests_dir)}")

                stats["services"] += 1

    # Generate conftest.py
    conftest_file = tests_dir / "conftest.py"
    if not conftest_file.exists():
        conftest_file.write_text(generate_conftest())
        print("\n📝 Generated conftest.py")

    print("\n📊 Summary:")
    print(f"  📁 Routes processed: {stats['routes']}")
    print(f"  📁 Services processed: {stats['services']}")
    print(f"  ✨ Tests created/updated: {stats['tests_created']}")

    print("\n✅ Pytest test generation complete!")
    print("💡 Run 'make test' to execute all tests")


if __name__ == "__main__":
    main()
