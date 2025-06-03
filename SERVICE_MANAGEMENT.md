# GLOW Service Management & Testing Guide

This guide explains how to manage services and run tests for the GLOW application with complete control over the development environment.

## Quick Start

### Stop All Services and Run Tests (Recommended)
```bash
cd client
npm run test:clean
```

This single command will:
1. Stop all running services on ports 3000, 8000
2. Restart all services cleanly
3. Run all Cypress tests in headless mode
4. Report results

### Other Quick Commands
```bash
# Stop all services
npm run services:stop

# Restart all services
npm run services:restart

# Run tests with clean restart
npm run test:clean --category auth    # Only auth tests
npm run test:clean --spec auth.cy.ts  # Specific test file
npm run test:clean --interactive      # Interactive mode
```

## Available Scripts

### Service Management Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **Stop Services** | `npm run services:stop` | Stops all services on ports 3000, 8000 |
| **Restart Services** | `npm run services:restart` | Stops and restarts all services cleanly |
| **Clean Test** | `npm run test:clean` | Complete restart + run tests |

### Test Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **Interactive Tests** | `npm run test:e2e` | Opens Cypress Test Runner |
| **Headless Tests** | `npm run test:e2e:headless` | Runs all tests in headless mode |
| **Clean Tests** | `npm run test:clean` | Restart services + run tests |

## Detailed Usage

### 1. Service Management

#### Stop All Services
```bash
npm run services:stop
```

This script will:
- Kill processes on ports 3000 (Frontend) and 8000 (Backend)
- Stop Node.js processes (Next.js, Cypress)
- Stop Python processes (FastAPI, uvicorn)
- Clean up orphaned processes (webpack, esbuild)
- Show final port status

#### Restart All Services
```bash
npm run services:restart
```

This script will:
1. Stop all existing services
2. Start database (if not running)
3. Start backend server
4. Start frontend development server
5. Verify all services are responding
6. Show service URLs and status

### 2. Clean Testing

#### Run All Tests with Clean Restart
```bash
npm run test:clean
```

#### Run Specific Test Categories
```bash
npm run test:clean --category auth     # Authentication tests
npm run test:clean --category quiz     # Quiz functionality tests
npm run test:clean --category chat     # Chat functionality tests
npm run test:clean --category ui       # UI and navigation tests
npm run test:clean --category login    # Basic login tests
```

#### Run Specific Test Files
```bash
npm run test:clean --spec auth.cy.ts
npm run test:clean --spec quiz.cy.ts
npm run test:clean --spec chat.cy.ts
npm run test:clean --spec ui-navigation.cy.ts
```

#### Interactive Mode
```bash
npm run test:clean --interactive
```

### 3. Manual Testing (Without Service Restart)

If services are already running and you just want to run tests:

```bash
# All tests
npm run test:e2e:headless

# Specific category
./cypress/scripts/run-tests.sh --category auth --headless

# Specific file
./cypress/scripts/run-tests.sh --spec auth.cy.ts --headless

# Interactive mode
npm run test:e2e
```

## Service Ports

| Service | Port | URL | Status Check |
|---------|------|-----|--------------|
| **Frontend** | 3000 | http://localhost:3000 | `curl -s http://localhost:3000` |
| **Backend** | 8000 | http://localhost:8000 | `curl -s http://localhost:8000` |
| **Database** | 5432 | localhost:5432 | `lsof -Pi :5432` |

## Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Check what's using a port
lsof -i :3000
lsof -i :8000

# Stop all services
npm run services:stop
```

#### 2. Services Won't Start
```bash
# Clean restart
npm run services:restart

# Check logs for errors
# Frontend logs: Check terminal where npm run dev is running
# Backend logs: Check terminal where make run is running
```

#### 3. Tests Failing Due to Service Issues
```bash
# Complete clean restart and test
npm run test:clean

# Check service status
curl -s http://localhost:3000 && echo "Frontend OK"
curl -s http://localhost:8000 && echo "Backend OK"
```

#### 4. Database Connection Issues
```bash
# Restart database
cd ../database
bash run.sh --clean

# Or restart all services
cd ../client
npm run services:restart
```

### Manual Service Management

If you need to manage services manually:

#### Start Services Individually
```bash
# Database
cd database && bash run.sh --clean &

# Backend
cd server && make run &

# Frontend
cd client && npm run dev &
```

#### Check Service Status
```bash
# Check ports
lsof -i :3000  # Frontend
lsof -i :8000  # Backend
lsof -i :5432  # Database

# Check service health
curl -s http://localhost:3000 >/dev/null && echo "Frontend: OK" || echo "Frontend: FAIL"
curl -s http://localhost:8000 >/dev/null && echo "Backend: OK" || echo "Backend: FAIL"
```

## Script Locations

All service management scripts are located in `client/cypress/scripts/`:

- `stop-services.sh` - Stops all services
- `restart-services.sh` - Restarts all services
- `clean-test.sh` - Clean restart + run tests
- `run-tests.sh` - Run tests (existing script)

## Best Practices

### For Development
1. Use `npm run services:restart` when switching branches
2. Use `npm run services:stop` when done for the day
3. Use `npm run test:clean` for reliable test runs

### For Testing
1. Always use `npm run test:clean` for CI/CD or important test runs
2. Use specific categories (`--category auth`) to speed up development
3. Use interactive mode (`--interactive`) for debugging tests

### For Debugging
1. Check service status with the restart script
2. Use manual service management for detailed debugging
3. Check individual service logs in their respective terminals

## Environment Requirements

- **Node.js** v18+ (for frontend)
- **Python** 3.8+ (for backend)
- **PostgreSQL** (for database)
- **Make** (for backend build)
- **Bash** (for scripts)

## Exit Codes

Scripts return meaningful exit codes:
- `0` - Success
- `1` - General error
- `6` - Cypress test failures
- `7` - Service connection timeout

Use these for automation and CI/CD pipelines. 