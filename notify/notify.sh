#!/bin/bash
# Notify service - triggers Keycloak sync and periodic health/metrics logging

set -euo pipefail

# Configuration with defaults
SERVER_URL="${SERVER_URL:-http://localhost:8000}"
APP_PREFIX="${APP_PREFIX:-}"
INTERVAL="${INTERVAL:-60}"
SYNC_RETRIES="${SYNC_RETRIES:-15}"
SYNC_INITIAL_DELAY="${SYNC_INITIAL_DELAY:-10}"
HEALTH_RETRIES="${HEALTH_RETRIES:-3}"
METRICS_RETRIES="${METRICS_RETRIES:-3}"
WAIT_MAX_RETRIES="${WAIT_MAX_RETRIES:-30}"
WAIT_DELAY="${WAIT_DELAY:-2}"

# Build URLs
HEALTH_URL="${SERVER_URL}${APP_PREFIX}/health"
SYNC_URL="${SERVER_URL}${APP_PREFIX}/api/v3/auth/sync"
METRICS_URL="${SERVER_URL}${APP_PREFIX}/metrics/snapshot"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[NOTIFY]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[NOTIFY]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[NOTIFY]${NC} $*"
}

log_error() {
    echo -e "${RED}[NOTIFY]${NC} $*"
}

# Wait for server to be ready
wait_for_server() {
    log_info "Waiting for server to be ready..."
    local retries=0
    while [ $retries -lt $WAIT_MAX_RETRIES ]; do
        if curl -sf "${HEALTH_URL}" > /dev/null 2>&1; then
            log_success "Server is ready"
            return 0
        fi
        retries=$((retries + 1))
        sleep $WAIT_DELAY
    done
    log_error "Server did not become ready after ${WAIT_MAX_RETRIES} retries"
    return 1
}

# Wait for Keycloak to be ready (check via health endpoint)
wait_for_keycloak() {
    log_info "Waiting for Keycloak to be ready..."
    local retries=0
    local max_retries=30
    while [ $retries -lt $max_retries ]; do
        # Check if Keycloak is healthy via server health endpoint
        local health_response=$(curl -sf "${HEALTH_URL}" 2>/dev/null || echo "")
        if [ -n "$health_response" ]; then
            local keycloak_ok=false
            # Try jq first (more reliable for nested JSON)
            if command -v jq >/dev/null 2>&1; then
                keycloak_ok=$(echo "$health_response" | jq -r '.services.keycloak.ok // false' 2>/dev/null || echo "false")
                if [ "$keycloak_ok" = "true" ]; then
                    log_success "Keycloak is ready"
                    return 0
                fi
            else
                # Fallback to grep pattern matching for nested JSON structure
                # Pattern matches: "services": { ... "keycloak": { ... "ok": true ... } ... }
                if echo "$health_response" | grep -qE '"services"[^}]*"keycloak"[^}]*"ok"[[:space:]]*:[[:space:]]*true' 2>/dev/null; then
                    log_success "Keycloak is ready"
                    return 0
                fi
            fi
        fi
        retries=$((retries + 1))
        if [ $retries -lt $max_retries ]; then
            sleep 2
        fi
    done
    log_warning "Keycloak health check timeout after ${max_retries} attempts (60s), proceeding with sync anyway..."
    return 0  # Don't fail, just proceed
}

# Trigger Keycloak sync with retries and exponential backoff
trigger_sync() {
    log_info "Triggering Keycloak sync..."
    local retries=0
    local delay=2
    while [ $retries -lt $SYNC_RETRIES ]; do
        # Check response status and body
        # Get response with http_code appended as last line
        local response=$(curl -sfX POST "${SYNC_URL}" \
            -H "Content-Type: application/json" \
            -d '{}' \
            -w "\n%{http_code}" 2>/dev/null || echo -e "\n000")
        
        # Extract http_code (last line) and body (all lines except last)
        # Count total lines first
        local line_count=$(echo "$response" | wc -l | tr -d ' ')
        if [ "$line_count" -gt 1 ]; then
            # Multiple lines: http_code is last line, body is everything else
            local http_code=$(echo "$response" | tail -n1 | tr -d '\n\r')
            # Get all lines except last, then join them (in case body has multiple lines)
            local body=$(echo "$response" | head -n $((line_count - 1)) | tr '\n' ' ' | sed 's/[[:space:]]*$//')
        else
            # Only one line: assume it's the http_code, body is empty
            local http_code=$(echo "$response" | tr -d '\n\r')
            local body=""
        fi
        
        # Check if request succeeded (200 OK)
        if [ "$http_code" = "200" ]; then
            # Parse response body to check success status
            # Use jq if available for reliable JSON parsing
            local success_status=""
            if command -v jq >/dev/null 2>&1; then
                success_status=$(echo "$body" | jq -r '.success // false' 2>/dev/null || echo "false")
            else
                # Fallback to grep
                if echo "$body" | grep -qE '"success"[[:space:]]*:[[:space:]]*true' 2>/dev/null; then
                    success_status="true"
                else
                    success_status="false"
                fi
            fi
            
            if [ "$success_status" = "true" ]; then
                # Extract message if available
                local message=""
                if command -v jq >/dev/null 2>&1; then
                    message=$(echo "$body" | jq -r '.message // ""' 2>/dev/null || echo "")
                fi
                if [ -n "$message" ]; then
                    log_success "Keycloak sync completed: $message"
                else
                    log_success "Keycloak sync completed successfully"
                fi
                return 0
            else
                # Sync endpoint returned but sync failed - extract error message
                local error_msg=""
                if command -v jq >/dev/null 2>&1; then
                    error_msg=$(echo "$body" | jq -r '.error // .message // "unknown error"' 2>/dev/null || echo "unknown error")
                else
                    error_msg=$(echo "$body" | grep -oE '"error"[[:space:]]*:[[:space:]]*"[^"]*"' 2>/dev/null | head -1 | sed 's/.*"error"[^"]*"\([^"]*\)".*/\1/' || echo "unknown error")
                fi
                log_warning "Keycloak sync failed: ${error_msg}"
                # Continue retrying
            fi
        elif [ "$http_code" = "500" ]; then
            # Server error - sync failed
            local error_msg=$(echo "$body" | grep -oE '"detail"[[:space:]]*:[[:space:]]*"[^"]*"' 2>/dev/null | head -1 || echo "$body")
            log_warning "Keycloak sync failed (HTTP 500): ${error_msg}"
        fi
        
        retries=$((retries + 1))
        if [ $retries -lt $SYNC_RETRIES ]; then
            log_warning "Sync attempt $retries/$SYNC_RETRIES failed (HTTP $http_code), retrying in ${delay}s..."
            sleep $delay
            # Exponential backoff: 2s, 4s, 8s, 16s, then cap at 20s
            delay=$((delay * 2))
            if [ $delay -gt 20 ]; then
                delay=20
            fi
        fi
    done
    log_error "Failed to trigger Keycloak sync after ${SYNC_RETRIES} retries"
    return 1
}

# Trigger health check logging
trigger_health() {
    local retries=0
    while [ $retries -lt $HEALTH_RETRIES ]; do
        if curl -sf "${HEALTH_URL}" > /dev/null 2>&1; then
            return 0
        fi
        retries=$((retries + 1))
        if [ $retries -lt $HEALTH_RETRIES ]; then
            sleep 1
        fi
    done
    log_warning "Failed to trigger health check logging"
    return 1
}

# Trigger metrics snapshot
trigger_metrics() {
    local retries=0
    while [ $retries -lt $METRICS_RETRIES ]; do
        if curl -sfX POST "${METRICS_URL}" \
            -H "Content-Type: application/json" > /dev/null 2>&1; then
            return 0
        fi
        retries=$((retries + 1))
        if [ $retries -lt $METRICS_RETRIES ]; then
            sleep 1
        fi
    done
    log_warning "Failed to trigger metrics snapshot"
    return 1
}

# Handle shutdown signals
cleanup() {
    log_info "Shutting down notify service..."
    exit 0
}

trap cleanup SIGTERM SIGINT

# Main execution
main() {
    log_info "Starting notify service..."
    log_info "Server URL: ${SERVER_URL}"
    log_info "Health URL: ${HEALTH_URL}"
    log_info "Sync URL: ${SYNC_URL}"
    log_info "Metrics URL: ${METRICS_URL}"
    log_info "Interval: ${INTERVAL}s"
    log_info "Sync retries: ${SYNC_RETRIES} (with exponential backoff)"
    log_info "Initial Keycloak wait: ${SYNC_INITIAL_DELAY}s"

    # Wait for server to be ready
    if ! wait_for_server; then
        log_error "Exiting: server not ready"
        exit 1
    fi

    # Wait additional time for Keycloak to initialize (if starting fresh)
    log_info "Waiting ${SYNC_INITIAL_DELAY}s for Keycloak to initialize..."
    sleep $SYNC_INITIAL_DELAY

    # Trigger initial Keycloak sync with retries
    # The sync endpoint itself has retry logic and will wait for Keycloak to be ready
    # So we don't need to check Keycloak health here - just trigger sync and let it handle retries
    # The sync endpoint performs the sync synchronously and returns success/failure, so we get immediate feedback
    if ! trigger_sync; then
        log_warning "Initial sync failed after ${SYNC_RETRIES} retries, continuing anyway..."
    fi

    # Periodic loop
    log_info "Starting periodic tasks (every ${INTERVAL}s)..."
    while true; do
        sleep $INTERVAL

        # Trigger health check logging
        trigger_health || log_warning "Health check logging failed"

        # Trigger metrics snapshot
        trigger_metrics || log_warning "Metrics snapshot failed"
    done
}

# Run main function
main

