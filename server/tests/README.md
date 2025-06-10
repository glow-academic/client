# FastAPI Pytest Testing System

This directory contains an automated pytest testing system for the FastAPI server that mirrors the structure of your `app/routes` and `app/services` directories.

## Overview

The testing system automatically:
- 🔍 **Scans** all Python files in `app/routes` and `app/services`
- 📝 **Generates** comprehensive test files with failing assertions
- 🔄 **Monitors** file changes and updates tests automatically
- 📊 **Provides** coverage reporting and test analytics
- 🚀 **Integrates** with the `make run` command for seamless development

## Generated Test Structure

```
tests/
├── conftest.py              # Pytest configuration and fixtures
├── routes/                  # Tests for FastAPI route handlers
│   ├── test_attempt.py      # Tests for app/routes/attempt.py
│   ├── test_documents.py    # Tests for app/routes/documents.py
│   └── test_report.py       # Tests for app/routes/report.py
└── services/                # Tests for service modules
    └── agents/              # Tests for agent services
        ├── test_classify.py
        ├── test_course.py
        ├── test_evaluate.py
        ├── test_generic.py
        └── test_scenario.py
```

## Available Commands

### Basic Testing
```bash
# Run all tests
make test

# Run tests with coverage report
make test-cov

# Run specific test file
make test-file FILE=tests/routes/test_documents.py

# Run tests matching a pattern
pytest tests/ -k "test_upload"
```

### Test Generation
```bash
# Generate/update all test files
make generate-tests

# Force regenerate all tests (clears cache)
make force-tests

# Check for changes in Python files
make check-tests

# Watch for changes and auto-regenerate
make watch-tests
```

### Advanced Testing
```bash
# Run tests with verbose output
pytest tests/ -v

# Run only failing tests
pytest tests/ --lf

# Run tests in parallel
pytest tests/ -n auto

# Run with coverage and HTML report
pytest tests/ --cov=app --cov-report=html

# Run specific test class
pytest tests/routes/test_documents.py::TestUploadDocument

# Run with markers
pytest tests/ -m "unit"
pytest tests/ -m "integration"
```

## Test File Structure

Each generated test file contains:

### Route Tests
```python
class TestEndpointName:
    """Tests for endpoint_name endpoint."""
    
    def test_endpoint_name_success(self, client):
        """Test successful endpoint_name request."""
        # TODO: Implement test
        assert False, "IMPLEMENT: Test for endpoint_name"
    
    def test_endpoint_name_error(self, client):
        """Test endpoint_name error handling."""
        # TODO: Implement error test
        assert False, "IMPLEMENT: Error test for endpoint_name"
```

### Service Tests
```python
class TestFunctionName:
    """Tests for function_name function."""
    
    def test_function_name_success(self):
        """Test successful function_name execution."""
        # TODO: Implement test
        assert False, "IMPLEMENT: Test for function_name"
    
    def test_function_name_error(self):
        """Test function_name error handling."""
        # TODO: Implement error test
        assert False, "IMPLEMENT: Error test for function_name"
```

## Implementation Guide

### 1. Replace Failing Assertions

All generated tests include failing assertions by design:
```python
assert False, "IMPLEMENT: Test for function_name"
```

Replace these with actual test logic:
```python
def test_upload_document_success(self, client):
    """Test successful document upload."""
    files = {"files": ("test.txt", "test content", "text/plain")}
    data = {"class_id": "test-class-id"}
    
    response = client.post("/documents/upload", files=files, data=data)
    
    assert response.status_code == 200
    assert response.json()["message"] == "Successfully uploaded 1 document(s)"
```

### 2. Use Available Fixtures

The system provides several fixtures:

#### Test Client
```python
def test_endpoint(self, client):
    """Test using the FastAPI test client."""
    response = client.get("/api/endpoint")
    assert response.status_code == 200
```

#### Database Session
```python
def test_with_database(self, test_session):
    """Test with real database session."""
    # Use test_session for database operations
    pass

def test_with_mock_session(self, mock_session):
    """Test with mocked database session."""
    mock_session.exec.return_value = mock_data
    # Test logic here
```

#### Sample Data
```python
def test_with_sample_data(self, sample_uuid):
    """Test using generated sample UUID."""
    assert len(sample_uuid) == 36  # UUID length
```

### 3. Mock External Dependencies

```python
@patch('app.routes.documents.run_classify_agent')
def test_classify_documents(self, mock_classify, client):
    """Test document classification with mocked agent."""
    mock_classify.return_value = {"success": True, "message": "Classified"}
    
    response = client.post("/documents/classify", data={"class_id": "test"})
    
    assert response.status_code == 200
    mock_classify.assert_called_once()
```

### 4. Test Async Functions

```python
@pytest.mark.asyncio
async def test_async_function():
    """Test async service function."""
    result = await async_service_function("test_input")
    assert result is not None
```

### 5. Test Error Scenarios

```python
def test_upload_invalid_file(self, client):
    """Test upload with invalid file."""
    response = client.post("/documents/upload", data={"class_id": "test"})
    assert response.status_code == 400
    assert "No files provided" in response.json()["detail"]

def test_database_error(self, mock_session, client):
    """Test database error handling."""
    mock_session.exec.side_effect = Exception("Database error")
    
    response = client.get("/api/endpoint")
    assert response.status_code == 500
```

## Automated Integration

The testing system integrates with your development workflow:

### 1. Server Startup
When you run `make run`, the system:
1. Checks for changes in Python files
2. Regenerates tests if needed
3. Starts the FastAPI server

### 2. File Watching
The watch system monitors:
- `app/routes/*.py` - Route handler files
- `app/services/**/*.py` - Service module files

### 3. Cache Management
- File changes are tracked using MD5 hashes
- Cache stored in `.pytest_cache.json`
- Orphaned tests are automatically removed

## Configuration

### Pytest Configuration (`pytest.ini`)
```ini
[tool:pytest]
testpaths = tests
python_files = test_*.py
addopts = -v --strict-markers --tb=short
markers =
    unit: Unit tests
    integration: Integration tests
    asyncio: Async tests
```

### Coverage Configuration
```ini
[coverage:run]
source = app
omit = */tests/*, */__pycache__/*

[coverage:report]
exclude_lines = pragma: no cover, def __repr__
```

## Best Practices

### 1. Test Organization
- **Unit tests**: Test individual functions in isolation
- **Integration tests**: Test API endpoints end-to-end
- **Mock external services**: Database, file system, APIs

### 2. Test Data
- Use fixtures for reusable test data
- Create realistic test scenarios
- Test edge cases and error conditions

### 3. Assertions
- Use descriptive assertion messages
- Test both success and failure paths
- Verify response structure and content

### 4. Performance
- Use `pytest-xdist` for parallel test execution
- Mock expensive operations
- Use appropriate test markers

## Troubleshooting

### Common Issues

1. **Import Errors**
   ```bash
   # Ensure you're in the server directory
   cd server
   pytest tests/
   ```

2. **Database Errors**
   ```python
   # Use test fixtures instead of real database
   def test_function(self, test_session):  # Not get_session()
   ```

3. **Async Test Issues**
   ```python
   # Add asyncio marker
   @pytest.mark.asyncio
   async def test_async_function():
   ```

### Debug Mode
```bash
# Run with verbose output and no capture
pytest tests/ -v -s

# Run single test with debugging
pytest tests/routes/test_documents.py::TestUploadDocument::test_upload_success -v -s
```

## Contributing

When adding new routes or services:
1. The testing system will automatically detect them
2. Run `make generate-tests` to create test files
3. Implement the failing test cases
4. Ensure all tests pass before committing

## Continuous Integration

For CI/CD pipelines:
```yaml
- name: Install dependencies
  run: pip install -r requirements.txt

- name: Generate tests
  run: python scripts/generate_pytest_tests.py

- name: Run tests
  run: pytest tests/ --cov=app --cov-report=xml

- name: Upload coverage
  uses: codecov/codecov-action@v1
```

---

**Happy Testing! 🧪**

The automated testing system ensures every route and service has corresponding tests, helping maintain code quality and catch issues early in development. 