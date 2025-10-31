#!/bin/bash
set -euo pipefail

# Script to fix UUIDs across all database files
# Generates proper lowercase UUIDs and replaces hardcoded ones consistently
# 
# Usage: ./fix-uuids.sh [--generate-new]
#   --generate-new: Generate completely new UUIDs (will break existing data)
#   (default): Use existing UUIDs but ensure they're consistent and lowercase

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DB_DIR="$PROJECT_ROOT/database"
UUID_CONFIG="$DB_DIR/.uuid-config"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[UUID-FIX]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[UUID-FIX]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[UUID-FIX]${NC} $1"
}

log_error() {
  echo -e "${RED}[UUID-FIX]${NC} $1"
}

# Function to generate lowercase UUID
generate_uuid() {
  uuidgen | tr '[:upper:]' '[:lower:]'
}

# Check if we should generate new UUIDs
GENERATE_NEW=false
if [[ "${1:-}" == "--generate-new" ]]; then
  GENERATE_NEW=true
  log_warning "⚠️  Generating NEW UUIDs - this will break existing data!"
  read -p "Are you sure? This should only be done on a fresh database. (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Aborted."
    exit 0
  fi
fi

# Load or generate UUIDs
if [[ "$GENERATE_NEW" == true ]] || [[ ! -f "$UUID_CONFIG" ]]; then
  log_info "🔧 Generating UUIDs for key entities..."
  
  # Generate UUIDs for departments
  DEPT_CS=$(generate_uuid)
  DEPT_BIOL=$(generate_uuid)
  DEPT_CHEM=$(generate_uuid)
  DEPT_EAPS=$(generate_uuid)
  DEPT_MA=$(generate_uuid)
  DEPT_PHYS=$(generate_uuid)
  DEPT_STAT=$(generate_uuid)
  
  # Generate UUIDs for default profiles
  PROFILE_GUEST=$(generate_uuid)
  PROFILE_TA=$(generate_uuid)
  PROFILE_INSTRUCTIONAL=$(generate_uuid)
  PROFILE_ADMIN=$(generate_uuid)
  PROFILE_SUPERADMIN=$(generate_uuid)
  
  # Generate UUID for model (referenced in personas)
  MODEL_ID=$(generate_uuid)
  
  # Save to config file
  cat > "$UUID_CONFIG" <<EOF
# UUID Configuration File
# Generated: $(date)
# DO NOT EDIT MANUALLY - run fix-uuids.sh to regenerate

DEPT_CS=$DEPT_CS
DEPT_BIOL=$DEPT_BIOL
DEPT_CHEM=$DEPT_CHEM
DEPT_EAPS=$DEPT_EAPS
DEPT_MA=$DEPT_MA
DEPT_PHYS=$DEPT_PHYS
DEPT_STAT=$DEPT_STAT
PROFILE_GUEST=$PROFILE_GUEST
PROFILE_TA=$PROFILE_TA
PROFILE_INSTRUCTIONAL=$PROFILE_INSTRUCTIONAL
PROFILE_ADMIN=$PROFILE_ADMIN
PROFILE_SUPERADMIN=$PROFILE_SUPERADMIN
MODEL_ID=$MODEL_ID
EOF
  log_success "✅ UUIDs saved to $UUID_CONFIG"
else
  log_info "📋 Loading UUIDs from $UUID_CONFIG"
  source "$UUID_CONFIG"
fi

log_info "📝 Using UUIDs:"
log_info "  CS Department:       $DEPT_CS"
log_info "  Biology Department:   $DEPT_BIOL"
log_info "  Chemistry Department: $DEPT_CHEM"
log_info "  EAPS Department:      $DEPT_EAPS"
log_info "  Mathematics Dept:     $DEPT_MA"
log_info "  Physics Department:   $DEPT_PHYS"
log_info "  Statistics Dept:      $DEPT_STAT"
log_info "  Guest Profile:        $PROFILE_GUEST"
log_info "  TA Profile:           $PROFILE_TA"
log_info "  Instructional Profile: $PROFILE_INSTRUCTIONAL"
log_info "  Admin Profile:        $PROFILE_ADMIN"
log_info "  Superadmin Profile:   $PROFILE_SUPERADMIN"
log_info "  Model ID:             $MODEL_ID"

# Function to replace UUID in file using sed
replace_uuid() {
  local file="$1"
  local old_uuid="$2"
  local new_uuid="$3"
  
  if [[ -f "$file" ]]; then
    # Escape special characters for sed
    local old_escaped=$(printf '%s\n' "$old_uuid" | sed 's/[[\.*^$()+?{|]/\\&/g')
    local new_escaped=$(printf '%s\n' "$new_uuid" | sed 's/[[\.*^$()+?{|]/\\&/g')
    
    # Use sed to replace UUID (case-insensitive)
    # Replace with single quotes
    sed -i.bak "s/'$old_escaped'/'$new_escaped'/gi" "$file"
    # Replace with double quotes
    sed -i.bak "s/\"$old_escaped\"/\"$new_escaped\"/gi" "$file"
    # Replace without quotes (word boundary)
    sed -i.bak "s/\b$old_escaped\b/$new_escaped/gi" "$file"
    
    # Remove backup file (macOS sed creates .bak)
    rm -f "$file.bak"
    return 0
  else
    return 1
  fi
}

log_info "🔄 Replacing UUIDs in files..."

# Replace department UUIDs
log_info "  Updating CS department UUID..."
replace_uuid "$PROJECT_ROOT/migration_add_departments.sql" "33333333-3333-3333-3333-333333333333" "$DEPT_CS"
replace_uuid "$DB_DIR/seed/cs/departments.sql" "33333333-3333-3333-3333-333333333333" "$DEPT_CS"
replace_uuid "$DB_DIR/seed/init.sql" "33333333-3333-3333-3333-333333333333" "$DEPT_CS"

log_info "  Updating Biology department UUID..."
replace_uuid "$PROJECT_ROOT/migration_add_departments.sql" "11111111-1111-1111-1111-111111111111" "$DEPT_BIOL"
replace_uuid "$DB_DIR/seed/biol/departments.sql" "11111111-1111-1111-1111-111111111111" "$DEPT_BIOL"

log_info "  Updating Chemistry department UUID..."
replace_uuid "$PROJECT_ROOT/migration_add_departments.sql" "22222222-2222-2222-2222-222222222222" "$DEPT_CHEM"
replace_uuid "$DB_DIR/seed/chem/departments.sql" "22222222-2222-2222-2222-222222222222" "$DEPT_CHEM"

log_info "  Updating EAPS department UUID..."
replace_uuid "$PROJECT_ROOT/migration_add_departments.sql" "44444444-4444-4444-4444-444444444444" "$DEPT_EAPS"
replace_uuid "$DB_DIR/seed/eaps/departments.sql" "44444444-4444-4444-4444-444444444444" "$DEPT_EAPS"

log_info "  Updating Mathematics department UUID..."
replace_uuid "$PROJECT_ROOT/migration_add_departments.sql" "55555555-5555-5555-5555-555555555555" "$DEPT_MA"
replace_uuid "$DB_DIR/seed/ma/departments.sql" "55555555-5555-5555-5555-555555555555" "$DEPT_MA"

log_info "  Updating Physics department UUID..."
replace_uuid "$PROJECT_ROOT/migration_add_departments.sql" "66666666-6666-6666-6666-666666666666" "$DEPT_PHYS"
replace_uuid "$DB_DIR/seed/phys/departments.sql" "66666666-6666-6666-6666-666666666666" "$DEPT_PHYS"

log_info "  Updating Statistics department UUID..."
replace_uuid "$PROJECT_ROOT/migration_add_departments.sql" "77777777-7777-7777-7777-777777777777" "$DEPT_STAT"
replace_uuid "$DB_DIR/seed/stat/departments.sql" "77777777-7777-7777-7777-777777777777" "$DEPT_STAT"

# Replace default profile UUIDs
log_info "  Updating default profile UUIDs..."
replace_uuid "$PROJECT_ROOT/migration_add_departments.sql" "00000000-0000-0000-0000-000000000001" "$PROFILE_GUEST"
replace_uuid "$PROJECT_ROOT/migration_add_departments.sql" "00000000-0000-0000-0000-000000000002" "$PROFILE_TA"
replace_uuid "$PROJECT_ROOT/migration_add_departments.sql" "00000000-0000-0000-0000-000000000003" "$PROFILE_INSTRUCTIONAL"
replace_uuid "$PROJECT_ROOT/migration_add_departments.sql" "00000000-0000-0000-0000-000000000004" "$PROFILE_ADMIN"
replace_uuid "$PROJECT_ROOT/migration_add_departments.sql" "00000000-0000-0000-0000-000000000005" "$PROFILE_SUPERADMIN"

# Replace model UUID in persona generation scripts
log_info "  Updating model UUID in persona scripts..."
for dept in cs biol chem eaps ma phys stat; do
  if [[ -f "$DB_DIR/seed/$dept/generate-persona-sql.sh" ]]; then
    replace_uuid "$DB_DIR/seed/$dept/generate-persona-sql.sh" "33333333-cccc-cccc-cccc-333333333333" "$MODEL_ID"
  fi
done

# Now update all seed files that reference department UUIDs
log_info "  Updating department references in seed files..."

# CS department references
find "$DB_DIR/seed" -type f \( -name "*.sql" -o -name "*.sh" \) | while read -r file; do
  if grep -qi "33333333-3333-3333-3333-333333333333" "$file" 2>/dev/null; then
    replace_uuid "$file" "33333333-3333-3333-3333-333333333333" "$DEPT_CS"
  fi
done

# Biology department references
find "$DB_DIR/seed" -type f \( -name "*.sql" -o -name "*.sh" \) | while read -r file; do
  if grep -qi "11111111-1111-1111-1111-111111111111" "$file" 2>/dev/null; then
    replace_uuid "$file" "11111111-1111-1111-1111-111111111111" "$DEPT_BIOL"
  fi
done

# Chemistry department references
find "$DB_DIR/seed" -type f \( -name "*.sql" -o -name "*.sh" \) | while read -r file; do
  if grep -qi "22222222-2222-2222-2222-222222222222" "$file" 2>/dev/null; then
    replace_uuid "$file" "22222222-2222-2222-2222-222222222222" "$DEPT_CHEM"
  fi
done

# EAPS department references
find "$DB_DIR/seed" -type f \( -name "*.sql" -o -name "*.sh" \) | while read -r file; do
  if grep -qi "44444444-4444-4444-4444-444444444444" "$file" 2>/dev/null; then
    replace_uuid "$file" "44444444-4444-4444-4444-444444444444" "$DEPT_EAPS"
  fi
done

# Mathematics department references
find "$DB_DIR/seed" -type f \( -name "*.sql" -o -name "*.sh" \) | while read -r file; do
  if grep -qi "55555555-5555-5555-5555-555555555555" "$file" 2>/dev/null; then
    replace_uuid "$file" "55555555-5555-5555-5555-555555555555" "$DEPT_MA"
  fi
done

# Physics department references
find "$DB_DIR/seed" -type f \( -name "*.sql" -o -name "*.sh" \) | while read -r file; do
  if grep -qi "66666666-6666-6666-6666-666666666666" "$file" 2>/dev/null; then
    replace_uuid "$file" "66666666-6666-6666-6666-666666666666" "$DEPT_PHYS"
  fi
done

# Statistics department references
find "$DB_DIR/seed" -type f \( -name "*.sql" -o -name "*.sh" \) | while read -r file; do
  if grep -qi "77777777-7777-7777-7777-777777777777" "$file" 2>/dev/null; then
    replace_uuid "$file" "77777777-7777-7777-7777-777777777777" "$DEPT_STAT"
  fi
done

log_success "✅ UUID replacement completed!"
log_info "📋 Summary of changes:"
log_info "  - Department UUIDs updated across all seed files"
log_info "  - Migration file updated"
log_info "  - Default profile UUIDs updated"
log_info "  - Model UUID updated in persona scripts"
log_info ""
log_info "💡 Next steps:"
log_info "  1. Review the changes in git diff"
log_info "  2. Test with: make fresh-db"
log_info "  3. Commit the changes"

