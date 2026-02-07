---
name: testing-guide
description: Testing structure and commands for this project, including unit, integration, and E2E tests. Use when asked to write or run tests or explain the test layout.
---

# Testing Guide

Test structure:
- Unit tests: `server/tests/unit/`
- Integration tests: `server/tests/integration/api/v4/[resource]/`
- Infrastructure tests: `server/tests/integration/infra/v4/[resource]/`
- E2E tests: `server/tests/e2e/`
- No client-side unit tests.

Write integration tests per endpoint in:
`server/tests/integration/api/v4/[resource]/test_[operation].py`

Write E2E tests in:
`server/tests/e2e/` (uses Playwright).

Commands:
```bash
make test-unit
make test-integration
make test
make test-cov
make test server/tests/integration/api/v4/personas/test_create.py
```

E2E workflow:
```bash
make run-test
make test-e2e
make test-e2e-headed
```

Default E2E profile ID: `965bd24f-dfae-4063-b370-e1373df46322`
