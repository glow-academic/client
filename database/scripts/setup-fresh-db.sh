#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
database_dir="$(cd "$script_dir/.." && pwd)"
root_dir="$(cd "$database_dir/.." && pwd)"

# --- LOAD .env -------------------------------------------------------
ENV_FILE="${root_dir}/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# --- CONFIG ----------------------------------------------------------
DB_USER=${DB_USER:-myuser}
DB_PASSWORD=${DB_PASSWORD:-mypassword}
DB_NAME=${DB_NAME:-mydb}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

# --- HELPER FUNCTIONS -----------------------------------------------

log_info() {
  echo -e "${CYAN}[SETUP]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SETUP]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[SETUP]${NC} $1"
}

log_error() {
  echo -e "${RED}[SETUP]${NC} $1"
}

prompt_with_default() {
  local prompt_text=$1
  local env_var=$2
  local default_value=$3
  local current_value=${!env_var:-$default_value}
  
  printf "${CYAN}$prompt_text${NC} [${current_value}]: " >&2
  read value < /dev/tty
  echo "${value:-$current_value}"
}

prompt_required() {
  local prompt_text=$1
  local env_var=$2
  local current_value=${!env_var:-}
  
  while true; do
    if [[ -n "$current_value" ]]; then
      printf "${CYAN}$prompt_text${NC} [${current_value}]: " >&2
      read value < /dev/tty
      value="${value:-$current_value}"
    else
      printf "${CYAN}$prompt_text${NC}: " >&2
      read value < /dev/tty
    fi
    
    if [[ -n "$value" ]]; then
      echo "$value"
      return
    else
      log_error "This field is required. Please enter a value."
    fi
  done
}

prompt_choice() {
  local prompt_text=$1
  shift
  local options=("$@")
  
  echo ""
  echo -e "${CYAN}$prompt_text${NC}" >&2
  for i in "${!options[@]}"; do
    echo -e "  ${GREEN}$((i+1)))${NC} ${options[$i]}" >&2
  done
  
  while true; do
    printf "${CYAN}Choose${NC} [1-${#options[@]}]: " >&2
    read choice < /dev/tty
    if [[ "$choice" =~ ^[0-9]+$ ]] && [[ "$choice" -ge 1 ]] && [[ "$choice" -le "${#options[@]}" ]]; then
      local selected="${options[$((choice-1))]}"
      echo -e "${GREEN}✓ Selected: $selected${NC}" >&2
      echo "$selected"
      return
    else
      log_error "Invalid choice. Please enter a number between 1 and ${#options[@]}."
    fi
  done
}

prompt_multiselect() {
  local prompt_text=$1
  shift
  local options=("$@")
  local selected=()
  
  echo ""
  echo -e "${CYAN}$prompt_text${NC}" >&2
  echo -e "  ${YELLOW}(Enter numbers separated by spaces, e.g., '1 3' for options 1 and 3)${NC}" >&2
  for i in "${!options[@]}"; do
    echo -e "  ${GREEN}$((i+1)))${NC} ${options[$i]}" >&2
  done
  
  while true; do
    printf "${CYAN}Enter choices${NC} (space-separated): " >&2
    read choices < /dev/tty
    if [[ -z "$choices" ]]; then
      log_error "Please select at least one option."
      continue
    fi
    
    for choice in $choices; do
      if [[ "$choice" =~ ^[0-9]+$ ]] && [[ "$choice" -ge 1 ]] && [[ "$choice" -le "${#options[@]}" ]]; then
        selected+=("${options[$((choice-1))]}")
      else
        log_error "Invalid choice: $choice"
        selected=()
        break
      fi
    done
    
    if [[ ${#selected[@]} -gt 0 ]]; then
      printf '%s\n' "${selected[@]}"
      return
    fi
  done
}

# --- COLOR SCHEME PRESETS --------------------------------------------

get_color_scheme() {
  local preset=$1
  case "$preset" in
    default)
      echo "#171717 #f5f5f5 #ffffff #ffffff #009e34 #ea8100 #e7000b #fafafa #171717 #000000 #404040 #808080 #b0b0b0 #e0e0e0"
      ;;
    purdue)
      echo "#000000 #CEB888 #FFFFFF #F5F5F5 #22C55E #F59E0B #EF4444 #FAFAFA #000000 #CEB888 #000000 #B8860B #D4AF37 #F5DEB3"
      ;;
    yale)
      echo "#00356B #FFFFFF #FFFFFF #F5F5F5 #22C55E #F59E0B #EF4444 #FAFAFA #00356B #00356B #004C99 #0066CC #0077E6 #3399FF"
      ;;
    princeton)
      echo "#FF8F00 #000000 #FFFFFF #F5F5F5 #22C55E #F59E0B #EF4444 #FAFAFA #FF8F00 #FF8F00 #FFA500 #FFB84D #FFC966 #FFD699"
      ;;
    northwestern)
      echo "#4E2A84 #FFFFFF #FFFFFF #F5F5F5 #22C55E #F59E0B #EF4444 #FAFAFA #4E2A84 #4E2A84 #6B3FA0 #8B5FBF #A67FD9 #C19FED"
      ;;
    *)
      echo "#171717 #f5f5f5 #ffffff #ffffff #009e34 #ea8100 #e7000b #fafafa #171717 #000000 #404040 #808080 #b0b0b0 #e0e0e0"
      ;;
  esac
}

# --- ENCRYPTION HELPER -----------------------------------------------

encrypt_value() {
  local value=$1
  local encrypt_script="${script_dir}/encrypt-keys.js"
  
  if [[ ! -f "$encrypt_script" ]]; then
    log_error "Encryption script not found at $encrypt_script"
    exit 1
  fi
  
  if [[ -z "$SECRET_KEY" ]]; then
    log_error "SECRET_KEY environment variable is not set"
    exit 1
  fi
  
  local encrypted=$(node "$encrypt_script" "$value" 2>/dev/null)
  if [[ -z "$encrypted" ]]; then
    log_error "Failed to encrypt value"
    exit 1
  fi
  
  echo "$encrypted"
}

# --- GENERATE UUIDs -------------------------------------------------

generate_uuid() {
  # Generate a deterministic UUID based on input (for consistency)
  local input=$1
  local hash=$(echo -n "$input" | shasum -a 256 | cut -d' ' -f1)
  # Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  echo "${hash:0:8}-${hash:8:4}-${hash:12:4}-${hash:16:4}-${hash:20:12}"
}

# --- MAIN SETUP FLOW -----------------------------------------------

log_info "🌱 Starting interactive database setup..."

# 1. CONFIG Questions
echo ""
log_info "=== CONFIGURATION ==="
echo ""

NODE_ENV=$(prompt_choice "1. Is this local or production setup?" "local" "production" | tr -d '\n')
PORT=$(prompt_with_default "2. What port do you want to deploy on?" "PORT" "3000" | tr -d '\n')
ORIGIN=$(prompt_with_default "3. What is the origin of the website?" "ORIGIN" "http://localhost:3000" | tr -d '\n')
APP_PREFIX=$(prompt_with_default "4. Do you want to deploy under a prefix? (leave empty for none)" "APP_PREFIX" "" | tr -d '\n')

# 2. BASIC Setup
echo ""
log_info "=== BASIC SETUP ==="

INSTITUTION_TYPE=$(prompt_choice "5. Do you want an organization or university setup?" "organization" "university" | tr -d '\n')

# 3. SETTINGS Configuration
echo ""
log_info "=== SETTINGS CONFIGURATION ==="

COLOR_SCHEME=$(prompt_choice "6. What color scheme would you like?" "default" "purdue" "yale" "princeton" "northwestern" "custom")

if [[ "$COLOR_SCHEME" = "custom" ]]; then
  log_info "Enter custom color values (hex format):"
  PRIMARY_COLOR=$(prompt_required "  Primary color" "PRIMARY_COLOR")
  ACCENT=$(prompt_required "  Accent color" "ACCENT")
  BACKGROUND=$(prompt_required "  Background color" "BACKGROUND")
  SURFACE=$(prompt_required "  Surface color" "SURFACE")
  SUCCESS=$(prompt_required "  Success color" "SUCCESS")
  WARNING=$(prompt_required "  Warning color" "WARNING")
  ERROR=$(prompt_required "  Error color" "ERROR")
  SIDEBAR_BACKGROUND=$(prompt_required "  Sidebar background color" "SIDEBAR_BACKGROUND")
  SIDEBAR_PRIMARY=$(prompt_required "  Sidebar primary color" "SIDEBAR_PRIMARY")
  CHART1=$(prompt_required "  Chart color 1" "CHART1")
  CHART2=$(prompt_required "  Chart color 2" "CHART2")
  CHART3=$(prompt_required "  Chart color 3" "CHART3")
  CHART4=$(prompt_required "  Chart color 4" "CHART4")
  CHART5=$(prompt_required "  Chart color 5" "CHART5")
else
  IFS=' ' read -ra COLORS <<< "$(get_color_scheme "$COLOR_SCHEME")"
  PRIMARY_COLOR="${COLORS[0]}"
  ACCENT="${COLORS[1]}"
  BACKGROUND="${COLORS[2]}"
  SURFACE="${COLORS[3]}"
  SUCCESS="${COLORS[4]}"
  WARNING="${COLORS[5]}"
  ERROR="${COLORS[6]}"
  SIDEBAR_BACKGROUND="${COLORS[7]}"
  SIDEBAR_PRIMARY="${COLORS[8]}"
  CHART1="${COLORS[9]}"
  CHART2="${COLORS[10]}"
  CHART3="${COLORS[11]}"
  CHART4="${COLORS[12]}"
  CHART5="${COLORS[13]}"
fi

# 4. AUTH Providers
echo ""
log_info "=== AUTH PROVIDERS ==="

AUTH_PROVIDERS=$(prompt_multiselect "7. What login providers would you like?" "Google" "Microsoft")

# Store auth configs in arrays (provider_slug|client_id|client_secret)
AUTH_PROVIDER_SLUGS=()
AUTH_CLIENT_IDS=()
AUTH_CLIENT_SECRETS=()

for provider in $AUTH_PROVIDERS; do
  echo ""
  log_info "Configuring $provider auth provider..."
  
  if [[ "$provider" = "Google" ]]; then
    CLIENT_ID=$(prompt_required "  Google Client ID" "AUTH_GOOGLE_CLIENT_ID")
    CLIENT_SECRET=$(prompt_required "  Google Client Secret" "AUTH_GOOGLE_CLIENT_SECRET")
    AUTH_PROVIDER_SLUGS+=("google")
    AUTH_CLIENT_IDS+=("$CLIENT_ID")
    AUTH_CLIENT_SECRETS+=("$CLIENT_SECRET")
  elif [[ "$provider" = "Microsoft" ]]; then
    CLIENT_ID=$(prompt_required "  Microsoft Client ID" "AUTH_MICROSOFT_ENTRA_ID_ID")
    CLIENT_SECRET=$(prompt_required "  Microsoft Client Secret" "AUTH_MICROSOFT_ENTRA_ID_SECRET")
    AUTH_PROVIDER_SLUGS+=("microsoft")
    AUTH_CLIENT_IDS+=("$CLIENT_ID")
    AUTH_CLIENT_SECRETS+=("$CLIENT_SECRET")
  fi
done

# 5. AI Providers
echo ""
log_info "=== AI PROVIDERS ==="

AI_PROVIDERS=$(prompt_multiselect "9. What AI providers would you like?" "OpenAI" "Gemini")

# Store AI configs in arrays (provider_slug|api_key)
AI_PROVIDER_SLUGS=()
AI_API_KEYS=()

for provider in $AI_PROVIDERS; do
  if [[ "$provider" = "OpenAI" ]]; then
    API_KEY=$(prompt_required "  OpenAI API Key" "OPENAI_API_KEY")
    AI_PROVIDER_SLUGS+=("openai")
    AI_API_KEYS+=("$API_KEY")
  elif [[ "$provider" = "Gemini" ]]; then
    API_KEY=$(prompt_required "  Gemini API Key" "GEMINI_API_KEY")
    AI_PROVIDER_SLUGS+=("gemini")
    AI_API_KEYS+=("$API_KEY")
  fi
done

# --- CHECK FOR REQUIRED SQL FILES -------------------------------------

log_info "Checking for required SQL files..."

# Check if SQL files exist (in root or database directory)
SCHEMA_EXISTS=false
BASE_EXISTS=false
INSTITUTION_EXISTS=false

if [[ -f "${root_dir}/schema.sql" ]] || [[ -f "${database_dir}/schema.sql" ]]; then
  SCHEMA_EXISTS=true
fi

if [[ -f "${root_dir}/base.sql" ]] || [[ -f "${database_dir}/base.sql" ]]; then
  BASE_EXISTS=true
fi

if [[ -f "${root_dir}/${INSTITUTION_TYPE}.sql" ]] || [[ -f "${database_dir}/${INSTITUTION_TYPE}.sql" ]]; then
  INSTITUTION_EXISTS=true
fi

if [[ "$SCHEMA_EXISTS" = false ]] || [[ "$BASE_EXISTS" = false ]] || [[ "$INSTITUTION_EXISTS" = false ]]; then
  echo ""
  log_warning "⚠️  Some required SQL files are missing:"
  [[ "$SCHEMA_EXISTS" = false ]] && log_warning "  - schema.sql (run: make export-db schema)"
  [[ "$BASE_EXISTS" = false ]] && log_warning "  - base.sql (run: make export-db base)"
  [[ "$INSTITUTION_EXISTS" = false ]] && log_warning "  - ${INSTITUTION_TYPE}.sql (run: make export-db ${INSTITUTION_TYPE})"
  echo ""
  read -p "Continue anyway? (y/N): " < /dev/tty
  if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    log_info "Exiting. Please export the required SQL files first."
    exit 1
  fi
fi

# --- GENERATE SQL INSERT STATEMENTS --------------------------------

log_info "Generating SQL INSERT statements..."

# Create seeds directory if it doesn't exist
SEEDS_DIR="${database_dir}/seeds"
mkdir -p "$SEEDS_DIR"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SEED_FILE="${SEEDS_DIR}/seed_${TIMESTAMP}.sql"

# Start building the combined seed file
cat > "$SEED_FILE" << EOF
-- Combined Seed File
-- Generated: $(date)
-- Institution Type: ${INSTITUTION_TYPE}
-- Color Scheme: ${COLOR_SCHEME}

-- ============================================================================
-- SCHEMA
-- ============================================================================

EOF

# Combine schema.sql if it exists (check both root and database directories)
SCHEMA_FILE=""
if [[ -f "${root_dir}/schema.sql" ]]; then
  SCHEMA_FILE="${root_dir}/schema.sql"
elif [[ -f "${database_dir}/schema.sql" ]]; then
  SCHEMA_FILE="${database_dir}/schema.sql"
fi

if [[ -n "$SCHEMA_FILE" ]]; then
  log_info "Including schema.sql from $(basename $(dirname "$SCHEMA_FILE"))..."
  cat "$SCHEMA_FILE" >> "$SEED_FILE"
  echo "" >> "$SEED_FILE"
else
  log_warning "schema.sql not found in root or database/ directory"
  log_warning "Run 'make export-db schema' first to generate it"
fi

cat >> "$SEED_FILE" << EOF
-- ============================================================================
-- BASE SEED DATA
-- ============================================================================

EOF

# Combine base.sql if it exists (check both root and database directories)
BASE_FILE=""
if [[ -f "${root_dir}/base.sql" ]]; then
  BASE_FILE="${root_dir}/base.sql"
elif [[ -f "${database_dir}/base.sql" ]]; then
  BASE_FILE="${database_dir}/base.sql"
fi

if [[ -n "$BASE_FILE" ]]; then
  log_info "Including base.sql from $(basename $(dirname "$BASE_FILE"))..."
  cat "$BASE_FILE" >> "$SEED_FILE"
  echo "" >> "$SEED_FILE"
else
  log_warning "base.sql not found in root or database/ directory"
  log_warning "Run 'make export-db base' first to generate it"
fi

cat >> "$SEED_FILE" << EOF
-- ============================================================================
-- INSTITUTION SEED DATA (${INSTITUTION_TYPE})
-- ============================================================================

EOF

# Combine institution seed file if it exists (check both root and database directories)
INSTITUTION_FILE=""
if [[ -f "${root_dir}/${INSTITUTION_TYPE}.sql" ]]; then
  INSTITUTION_FILE="${root_dir}/${INSTITUTION_TYPE}.sql"
elif [[ -f "${database_dir}/${INSTITUTION_TYPE}.sql" ]]; then
  INSTITUTION_FILE="${database_dir}/${INSTITUTION_TYPE}.sql"
fi

if [[ -n "$INSTITUTION_FILE" ]]; then
  log_info "Including ${INSTITUTION_TYPE}.sql from $(basename $(dirname "$INSTITUTION_FILE"))..."
  cat "$INSTITUTION_FILE" >> "$SEED_FILE"
  echo "" >> "$SEED_FILE"
else
  log_warning "${INSTITUTION_TYPE}.sql not found in root or database/ directory"
  log_warning "Run 'make export-db ${INSTITUTION_TYPE}' first to generate it"
fi

cat >> "$SEED_FILE" << EOF
-- ============================================================================
-- SETTINGS CONFIGURATION
-- ============================================================================

EOF

# Generate settings INSERT
SETTINGS_ID=$(generate_uuid "settings_${TIMESTAMP}")
cat >> "$SEED_FILE" << EOF
INSERT INTO settings (
    id,
    created_at,
    active,
    name,
    description,
    primary_color,
    accent,
    background,
    surface,
    success,
    warning,
    error,
    sidebar_background,
    sidebar_primary,
    chart1,
    chart2,
    chart3,
    chart4,
    chart5,
    guest_login_enabled,
    success_threshold,
    warning_threshold,
    danger_threshold
) VALUES (
    '$SETTINGS_ID',
    NOW(),
    true,
    'Default Settings',
    'Default settings configuration',
    '$PRIMARY_COLOR',
    '$ACCENT',
    '$BACKGROUND',
    '$SURFACE',
    '$SUCCESS',
    '$WARNING',
    '$ERROR',
    '$SIDEBAR_BACKGROUND',
    '$SIDEBAR_PRIMARY',
    '$CHART1',
    '$CHART2',
    '$CHART3',
    '$CHART4',
    '$CHART5',
    true,
    85,
    80,
    70
);

EOF

# Generate auth provider INSERTs
log_info "Generating auth provider configuration..."

for i in "${!AUTH_PROVIDER_SLUGS[@]}"; do
  provider="${AUTH_PROVIDER_SLUGS[$i]}"
  CLIENT_ID="${AUTH_CLIENT_IDS[$i]}"
  CLIENT_SECRET="${AUTH_CLIENT_SECRETS[$i]}"
  
  # Encrypt values
  ENCRYPTED_CLIENT_ID=$(encrypt_value "$CLIENT_ID")
  ENCRYPTED_CLIENT_SECRET=$(encrypt_value "$CLIENT_SECRET")
  
  # Generate UUIDs
  AUTH_ID=$(generate_uuid "auth_${provider}")
  CLIENT_ID_ITEM_ID=$(generate_uuid "auth_item_${provider}_client_id")
  CLIENT_SECRET_ITEM_ID=$(generate_uuid "auth_item_${provider}_client_secret")
  
  # Determine auth item names based on provider
  if [[ "$provider" = "google" ]]; then
    CLIENT_ID_NAME="clientId"
    CLIENT_SECRET_NAME="clientSecret"
    AUTH_NAME="Google"
    AUTH_DESC="Google Workspace OAuth configuration"
    AUTH_SLUG="google"
    AUTH_TYPE="google"
    ICON_URL="https://authjs.dev/img/providers/google.svg"
  else
    CLIENT_ID_NAME="client_id"
    CLIENT_SECRET_NAME="client_secret"
    AUTH_NAME="Microsoft"
    AUTH_DESC="Microsoft Entra ID OAuth configuration"
    AUTH_SLUG="microsoft"
    AUTH_TYPE="oidc"
    ICON_URL="https://authjs.dev/img/providers/microsoft-entra-id.svg"
  fi
  
  cat >> "$SEED_FILE" << EOF
-- ${AUTH_NAME} Auth Provider
INSERT INTO auth (id, created_at, updated_at, name, description, auth_type, slug, icon_url, active) VALUES 
('$AUTH_ID', NOW(), NOW(), '$AUTH_NAME', '$AUTH_DESC', '$AUTH_TYPE', '$AUTH_SLUG', '$ICON_URL', true);

INSERT INTO auth_items (id, created_at, updated_at, auth_id, name, description, value, encrypted, position, active) VALUES 
('$CLIENT_ID_ITEM_ID', NOW(), NOW(), '$AUTH_ID', '$CLIENT_ID_NAME', '${AUTH_NAME} ${CLIENT_ID_NAME}', '$ENCRYPTED_CLIENT_ID', true, 1, true),
('$CLIENT_SECRET_ITEM_ID', NOW(), NOW(), '$AUTH_ID', '$CLIENT_SECRET_NAME', '${AUTH_NAME} ${CLIENT_SECRET_NAME}', '$ENCRYPTED_CLIENT_SECRET', true, 2, true);

-- Link auth provider to settings
INSERT INTO setting_auths (settings_id, auth_id, active, created_at, updated_at) VALUES 
('$SETTINGS_ID', '$AUTH_ID', true, NOW(), NOW());

EOF
done

# Generate AI provider INSERTs
log_info "Generating AI provider configuration..."

for i in "${!AI_PROVIDER_SLUGS[@]}"; do
  provider="${AI_PROVIDER_SLUGS[$i]}"
  API_KEY="${AI_API_KEYS[$i]}"
  
  # Encrypt API key
  ENCRYPTED_API_KEY=$(encrypt_value "$API_KEY")
  
  # Generate UUIDs
  PROVIDER_ID=$(generate_uuid "provider_${provider}")
  KEY_ID=$(generate_uuid "key_${provider}")
  
  # Determine provider details
  if [[ "$provider" = "openai" ]]; then
    PROVIDER_NAME="OpenAI"
    PROVIDER_DESC="OpenAI language models"
    PROVIDER_VALUE="openai"
    KEY_NAME="OPENAI_API_KEY"
  else
    PROVIDER_NAME="Gemini"
    PROVIDER_DESC="Google Gemini language models"
    PROVIDER_VALUE="gemini"
    KEY_NAME="GEMINI_API_KEY"
  fi
  
  cat >> "$SEED_FILE" << EOF
-- ${PROVIDER_NAME} AI Provider
INSERT INTO providers (id, created_at, updated_at, name, description, value, active) VALUES 
('$PROVIDER_ID', NOW(), NOW(), '$PROVIDER_NAME', '$PROVIDER_DESC', '$PROVIDER_VALUE', true);

INSERT INTO keys (id, created_at, updated_at, name, key, type, active) VALUES 
('$KEY_ID', NOW(), NOW(), '$KEY_NAME', '$ENCRYPTED_API_KEY', 'api', true);

-- Link provider to settings
INSERT INTO setting_providers (settings_id, provider_id, active, created_at, updated_at) VALUES 
('$SETTINGS_ID', '$PROVIDER_ID', true, NOW(), NOW());

-- Link key to provider for settings
INSERT INTO setting_provider_keys (settings_id, provider_id, key_id, active, created_at, updated_at) VALUES 
('$SETTINGS_ID', '$PROVIDER_ID', '$KEY_ID', true, NOW(), NOW());

EOF
done

log_success "✅ Generated seed file: $SEED_FILE"

# --- UPDATE .env FILE -----------------------------------------------

log_info "Updating .env file..."

# Create or update .env file
{
  echo "# Database Configuration"
  echo "NODE_ENV=$NODE_ENV"
  echo "PORT=$PORT"
  echo "ORIGIN=$ORIGIN"
  if [[ -n "$APP_PREFIX" ]]; then
    echo "APP_PREFIX=$APP_PREFIX"
  else
    echo "# APP_PREFIX="
  fi
  echo ""
  echo "# Auth Provider Configuration"
  for i in "${!AUTH_PROVIDER_SLUGS[@]}"; do
    provider="${AUTH_PROVIDER_SLUGS[$i]}"
    CLIENT_ID="${AUTH_CLIENT_IDS[$i]}"
    CLIENT_SECRET="${AUTH_CLIENT_SECRETS[$i]}"
    if [[ "$provider" = "google" ]]; then
      echo "AUTH_GOOGLE_CLIENT_ID=$CLIENT_ID"
      echo "AUTH_GOOGLE_CLIENT_SECRET=$CLIENT_SECRET"
    elif [[ "$provider" = "microsoft" ]]; then
      echo "AUTH_MICROSOFT_ENTRA_ID_ID=$CLIENT_ID"
      echo "AUTH_MICROSOFT_ENTRA_ID_SECRET=$CLIENT_SECRET"
    fi
  done
  echo ""
  echo "# AI Provider Configuration"
  for i in "${!AI_PROVIDER_SLUGS[@]}"; do
    provider="${AI_PROVIDER_SLUGS[$i]}"
    API_KEY="${AI_API_KEYS[$i]}"
    if [[ "$provider" = "openai" ]]; then
      echo "OPENAI_API_KEY=$API_KEY"
    elif [[ "$provider" = "gemini" ]]; then
      echo "GEMINI_API_KEY=$API_KEY"
    fi
  done
  echo ""
  echo "# Database Configuration"
  echo "DB_USER=$DB_USER"
  echo "DB_PASSWORD=$DB_PASSWORD"
  echo "DB_NAME=$DB_NAME"
  echo "DB_HOST=$DB_HOST"
  echo "DB_PORT=$DB_PORT"
} > "$ENV_FILE"

log_success "✅ Updated .env file: $ENV_FILE"

# --- SUMMARY ---------------------------------------------------------

echo ""
log_success "🎉 Setup completed successfully!"
echo ""
log_info "Summary:"
echo "  - Seed file: $SEED_FILE"
echo "  - Institution type: $INSTITUTION_TYPE"
echo "  - Color scheme: $COLOR_SCHEME"
echo "  - Auth providers: ${AUTH_PROVIDER_SLUGS[*]}"
echo "  - AI providers: ${AI_PROVIDER_SLUGS[*]}"
echo ""
log_info "Next steps:"
echo "  1. If SQL files don't exist, export them first:"
echo "     make export-db schema"
echo "     make export-db base"
echo "     make export-db ${INSTITUTION_TYPE}"
echo "  2. Load the seed file into database:"
echo "     cd database && SEED_FILE=$SEED_FILE yarn start:clean"
echo "  3. To clean up old seed files, remove them from database/seeds/ directory"

