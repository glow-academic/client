#!/bin/bash

# Export script for Glow codebase deployment
# This script packages and transfers the codebase to another machine via SCP or locally
#
# Usage:
#   Interactive mode: ./export.sh
#   Remote:  ./export.sh --env alpha --destination user@host:/path [--yes]
#   Local:   ./export.sh --env alpha --destination /path/to/folder [--yes]
#
# Options:
#   -e, --env ENV          Environment (alpha, beta, prod, or local)
#   -d, --destination DEST Destination path (user@host:/path for remote, /path/to/folder for local)
#   -y, --yes              Skip confirmation prompt
#   -h, --help             Show this help message

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to cleanup on exit
cleanup() {
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        info "Cleaning up temporary directory..."
        rm -rf "$TEMP_DIR"
    fi
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Get script directory (root of project)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Validate we're in the right directory
if [ ! -f "Makefile" ] || [ ! -f "docker-compose.yml" ]; then
    error "Must run from project root directory"
    exit 1
fi

# Parse command-line arguments
ENV=""
SCP_DEST=""
SKIP_CONFIRM=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENV="$2"
            shift 2
            ;;
        -d|--destination)
            SCP_DEST="$2"
            shift 2
            ;;
        -y|--yes)
            SKIP_CONFIRM=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -e, --env ENV          Environment (alpha, beta, prod, or local)"
            echo "  -d, --destination DEST Destination path (user@host:/path for remote, /path/to/folder for local)"
            echo "  -y, --yes              Skip confirmation prompt"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Interactive mode"
            echo "  $0 -e alpha -d ai:/path/to/folder    # Remote (SCP)"
            echo "  $0 -e alpha -d ./exports              # Local directory"
            echo "  $0 -e local -d ./exports             # Use local .env file"
            echo "  $0 -e prod -d user@host:/path -y     # Remote with auto-confirm"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            error "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Get environment (interactive or from args)
if [ -z "$ENV" ]; then
    # Interactive prompt for environment
    echo ""
    info "Select environment:"
    echo "  1) alpha"
    echo "  2) beta"
    echo "  3) prod"
    echo "  4) local"
    read -p "Enter choice (1-4): " env_choice
    
    case $env_choice in
        1) ENV="alpha" ;;
        2) ENV="beta" ;;
        3) ENV="prod" ;;
        4) ENV="local" ;;
        *)
            error "Invalid choice. Must be 1, 2, 3, or 4"
            exit 1
            ;;
    esac
else
    # Validate environment from argument
    if [[ ! "$ENV" =~ ^(alpha|beta|prod|local)$ ]]; then
        error "Invalid environment: $ENV. Must be alpha, beta, prod, or local"
        exit 1
    fi
fi

# Determine environment file based on environment
if [ "$ENV" = "local" ]; then
    ENV_FILE=".env"
else
    ENV_FILE=".env.$ENV"
fi

# Validate environment file exists
if [ ! -f "$ENV_FILE" ]; then
    error "Environment file $ENV_FILE not found"
    exit 1
fi

success "Selected environment: $ENV"

# Get destination (interactive or from args)
if [ -z "$SCP_DEST" ]; then
    # Interactive prompt for destination
    echo ""
    read -p "Enter destination (user@host:/path for remote, or /path/to/folder for local): " dest_input
    
    if [ -z "$dest_input" ]; then
        error "Destination cannot be empty"
        exit 1
    fi
else
    dest_input="$SCP_DEST"
fi

# Detect if destination is remote (SCP) or local
# Remote format: user@host:/path or alias:/path (contains colon and @ before colon, or known SSH alias)
# Local format: any path without colon, or path with colon but no @ before it
IS_REMOTE=false
LOCAL_DEST=""
SCP_USER_HOST=""
SCP_PATH=""

if [[ "$dest_input" =~ ^[^:]+:.+$ ]]; then
    # Contains colon - check if it's SSH format (user@host:path)
    SCP_USER_HOST=$(echo "$dest_input" | cut -d: -f1)
    SCP_PATH=$(echo "$dest_input" | cut -d: -f2)
    
    # Check if it's user@host format (definitely remote)
    if [[ "$SCP_USER_HOST" =~ @ ]]; then
        IS_REMOTE=true
        success "Remote destination detected (user@host format): $dest_input"
    # Check if it's a known SSH alias (check SSH config, but only if ssh is available)
    elif command -v ssh >/dev/null 2>&1 && ssh -G "$SCP_USER_HOST" >/dev/null 2>&1; then
        IS_REMOTE=true
        success "Remote destination detected (SSH alias): $dest_input"
    else
        # Contains colon but not SSH format - treat as local (might be Windows path or special case)
        IS_REMOTE=false
        LOCAL_DEST="$dest_input"
        warning "Destination contains colon but doesn't appear to be SSH. Treating as local path."
        success "Local destination: $LOCAL_DEST"
    fi
else
    # No colon - definitely local
    IS_REMOTE=false
    LOCAL_DEST="$dest_input"
    success "Local destination: $LOCAL_DEST"
fi

# Validate remote destination components
if [ "$IS_REMOTE" = true ]; then
    if [ -z "$SCP_USER_HOST" ] || [ -z "$SCP_PATH" ]; then
        error "Failed to parse remote destination"
        exit 1
    fi
fi

# Create temporary export directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEMP_DIR=$(mktemp -d -t glow-export-XXXXXX)
EXPORT_DIR="$TEMP_DIR/glow-export"

info "Creating export directory: $EXPORT_DIR"
mkdir -p "$EXPORT_DIR"

# Function to copy directory with gitignore exclusions
copy_with_gitignore() {
    local src_dir=$1
    local dest_dir=$2
    
    if [ ! -d "$src_dir" ]; then
        warning "Directory $src_dir does not exist, skipping..."
        return
    fi
    
    info "Copying $src_dir (respecting .gitignore)..."
    
    # Create destination directory
    mkdir -p "$dest_dir"
    
    # Use git ls-files to get tracked files (respects .gitignore automatically)
    # Also include untracked files that aren't ignored by .gitignore
    # This is the most reliable way to respect .gitignore while including all relevant files
    if git rev-parse --git-dir > /dev/null 2>&1; then
        # Combine tracked and untracked files, sort and remove duplicates
        # Use process substitution to avoid subshell issues
        {
            git ls-files "$src_dir"
            git ls-files --others --exclude-standard "$src_dir"
        } | sort -u | while IFS= read -r file; do
            # Skip .git directory (but keep .gitignore files as they're needed)
            if [[ "$file" == *"/.git/"* ]] || [[ "$file" == ".git/"* ]] || \
               [[ "$file" == *"/.git" ]] || [[ "$file" == ".git" ]]; then
                continue
            fi
            
            if [ -f "$file" ]; then
                # Calculate relative path from src_dir
                # Remove src_dir prefix (with trailing slash if present)
                rel_path="${file#${src_dir}/}"
                # Handle edge case where file is at root of src_dir
                if [ "$rel_path" = "$file" ]; then
                    rel_path="${file#$src_dir}"
                fi
                # Skip if still matches (shouldn't happen, but safety check)
                if [ "$rel_path" = "$file" ]; then
                    continue
                fi
                # Create directory structure if needed
                dest_file="$dest_dir/$rel_path"
                mkdir -p "$(dirname "$dest_file")"
                # Copy file
                cp "$file" "$dest_file"
            fi
        done
    else
        # Fallback: use rsync with common exclusions if not a git repo
        warning "Not a git repository, using rsync with common exclusions..."
        rsync -av \
            --exclude='.git/' \
            --exclude='.git' \
            --exclude='node_modules' \
            --exclude='.next' \
            --exclude='__pycache__' \
            --exclude='*.pyc' \
            --exclude='.venv' \
            --exclude='.pytest_cache' \
            --exclude='.mypy_cache' \
            --exclude='.ruff_cache' \
            --exclude='htmlcov' \
            --exclude='.coverage' \
            --exclude='*.tsbuildinfo' \
            --exclude='.DS_Store' \
            --exclude='*.log' \
            "$src_dir/" "$dest_dir/" || {
            error "Failed to copy $src_dir"
            exit 1
        }
    fi
}

# Copy client directory
copy_with_gitignore "client" "$EXPORT_DIR/client"

# Copy server directory
copy_with_gitignore "server" "$EXPORT_DIR/server"

# Copy database directory
copy_with_gitignore "database" "$EXPORT_DIR/database"

# Copy web directory
copy_with_gitignore "web" "$EXPORT_DIR/web"

# Copy notify directory
copy_with_gitignore "notify" "$EXPORT_DIR/notify"

# Copy uploads directory selectively
info "Copying uploads directory (selective)..."
if [ -d "uploads" ]; then
    mkdir -p "$EXPORT_DIR/uploads"
    
    # Copy root files in uploads
    find uploads -maxdepth 1 -type f -exec cp {} "$EXPORT_DIR/uploads/" \; 2>/dev/null || true
    
    # Copy image subfolder
    if [ -d "uploads/image" ]; then
        mkdir -p "$EXPORT_DIR/uploads/image"
        rsync -av "uploads/image/" "$EXPORT_DIR/uploads/image/" || true
    fi
    
    # Copy video subfolder
    if [ -d "uploads/video" ]; then
        mkdir -p "$EXPORT_DIR/uploads/video"
        rsync -av "uploads/video/" "$EXPORT_DIR/uploads/video/" || true
    fi
    
    # Copy audio subfolder
    if [ -d "uploads/audio" ]; then
        mkdir -p "$EXPORT_DIR/uploads/audio"
        rsync -av "uploads/audio/" "$EXPORT_DIR/uploads/audio/" || true
    fi
    
    # Copy themes subfolder
    if [ -d "uploads/themes" ]; then
        mkdir -p "$EXPORT_DIR/uploads/themes"
        rsync -av "uploads/themes/" "$EXPORT_DIR/uploads/themes/" || true
    fi
else
    warning "uploads directory does not exist, skipping..."
fi

# Copy latest history file
info "Finding latest history file..."
if [ -d "history" ]; then
    mkdir -p "$EXPORT_DIR/history"
    
    # Find file with highest restore number
    # Handle both restore_N_*.sql.gz and restore__*.sql.gz patterns
    LATEST_HISTORY=$(ls -1 history/restore_*.sql.gz 2>/dev/null | \
        sed -E 's/.*restore_([0-9]+)_.*/\1/' | \
        grep -E '^[0-9]+$' | \
        sort -n | \
        tail -1)
    
    if [ -n "$LATEST_HISTORY" ] && [ "$LATEST_HISTORY" != "" ]; then
        # Find the actual file with this number
        LATEST_FILE=$(ls -1t history/restore_${LATEST_HISTORY}_*.sql.gz 2>/dev/null | head -1)
        if [ -n "$LATEST_FILE" ] && [ -f "$LATEST_FILE" ]; then
            cp "$LATEST_FILE" "$EXPORT_DIR/history/"
            success "Copied latest history file: $(basename "$LATEST_FILE")"
        else
            warning "Could not find history file with number $LATEST_HISTORY"
        fi
    else
        # Fallback: get the most recently modified file
        LATEST_FILE=$(ls -1t history/restore_*.sql.gz 2>/dev/null | head -1)
        if [ -n "$LATEST_FILE" ] && [ -f "$LATEST_FILE" ]; then
            cp "$LATEST_FILE" "$EXPORT_DIR/history/"
            success "Copied latest history file (by mtime): $(basename "$LATEST_FILE")"
        else
            warning "No history files found matching pattern restore_*.sql.gz"
        fi
    fi
else
    warning "history directory does not exist, skipping..."
fi

# Copy root files (all tracked and untracked files at root level)
info "Copying root files..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    # Get all tracked and untracked files at root level, remove duplicates
    {
        git ls-files | grep -E '^[^/]+$'
        git ls-files --others --exclude-standard | grep -E '^[^/]+$'
    } | sort -u | while IFS= read -r file; do
        if [ -f "$file" ]; then
            cp "$file" "$EXPORT_DIR/"
            success "Copied $file"
        fi
    done
    
    # Also copy .cursorignore if it exists (it's gitignored but may be needed)
    if [ -f ".cursorignore" ]; then
        cp ".cursorignore" "$EXPORT_DIR/"
        success "Copied .cursorignore"
    fi
else
    # Fallback: copy common root files if not a git repo
    warning "Not a git repository, copying common root files..."
    ROOT_FILES=(".gitignore" ".cursorignore" "AGENTS.md" "Makefile" "docker-compose.yml" "pyproject.toml" "README.md" ".env.example")
    for file in "${ROOT_FILES[@]}"; do
        if [ -f "$file" ]; then
            cp "$file" "$EXPORT_DIR/"
            success "Copied $file"
        fi
    done
fi

# Create .env file from selected environment
info "Creating .env file from $ENV_FILE..."
if [ ! -f "$ENV_FILE" ]; then
    error "Environment file $ENV_FILE not found"
    exit 1
fi
cp "$ENV_FILE" "$EXPORT_DIR/.env"
success "Created .env file"

# Validate export directory has content
if [ ! -d "$EXPORT_DIR" ] || [ -z "$(ls -A "$EXPORT_DIR" 2>/dev/null)" ]; then
    error "Export directory is empty or does not exist"
    exit 1
fi

info "Export directory contains:"
ls -1 "$EXPORT_DIR" | sed 's/^/  - /'

# Check for required tools
command -v zip >/dev/null 2>&1 || { error "zip is required but not installed"; exit 1; }

# Only check SSH tools if remote destination
if [ "$IS_REMOTE" = true ]; then
    command -v scp >/dev/null 2>&1 || { error "scp is required but not installed"; exit 1; }
    command -v ssh >/dev/null 2>&1 || { error "ssh is required but not installed"; exit 1; }
fi

# Create zip archive
ZIP_NAME="glow-export-${ENV}-${TIMESTAMP}.zip"
ZIP_PATH="$TEMP_DIR/$ZIP_NAME"

info "Creating zip archive: $ZIP_NAME"
# Zip the contents of glow-export directly (not the directory itself)
# This way when extracted, files go directly into the destination folder
cd "$EXPORT_DIR"
if ! zip -r "$ZIP_PATH" . > /dev/null 2>&1; then
    error "Failed to create zip archive"
    exit 1
fi
cd "$SCRIPT_DIR"

success "Created zip archive: $ZIP_NAME"
info "Archive size: $(du -h "$ZIP_PATH" | cut -f1)"

# Confirm before transfer (unless --yes flag is set)
if [ "$SKIP_CONFIRM" = false ]; then
    echo ""
    if [ "$IS_REMOTE" = true ]; then
        warning "Ready to transfer to $dest_input"
        read -p "Continue with SCP transfer? (y/N): " confirm
    else
        warning "Ready to copy to $LOCAL_DEST"
        read -p "Continue? (y/N): " confirm
    fi
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        info "Transfer cancelled by user"
        exit 0
    fi
fi

# Handle remote or local destination
if [ "$IS_REMOTE" = true ]; then
    # REMOTE DESTINATION (SCP)
    
    # Test SSH connection before transfer (works with both user@host and aliases)
    info "Testing SSH connection..."
    if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "$SCP_USER_HOST" "echo 'Connection test'" > /dev/null 2>&1; then
        warning "SSH connection test failed, but continuing anyway..."
        warning "You may be prompted for password/authentication"
        warning "Note: If using an SSH alias, make sure it's configured in ~/.ssh/config"
    fi

    # Create destination directory on remote machine if it doesn't exist
    info "Ensuring destination directory exists on remote machine..."
    info "Creating directory: $SCP_PATH on $SCP_USER_HOST"

    # Escape the path properly for SSH command
    ESCAPED_PATH=$(printf '%q' "$SCP_PATH")

    # Check if directory already exists
    if ssh "$SCP_USER_HOST" "test -d $ESCAPED_PATH" 2>/dev/null; then
        info "Directory already exists: $SCP_PATH"
    else
        # Create directory with proper error handling
        info "Creating directory..."
        CREATE_OUTPUT=$(ssh "$SCP_USER_HOST" "mkdir -p $ESCAPED_PATH && echo 'Directory created successfully'" 2>&1)
        CREATE_EXIT_CODE=$?
        
        if [ $CREATE_EXIT_CODE -ne 0 ]; then
            error "Failed to create destination directory on remote machine"
            error "Path: $SCP_PATH"
            error "Host: $SCP_USER_HOST"
            error "SSH output: $CREATE_OUTPUT"
            error "Exit code: $CREATE_EXIT_CODE"
            error ""
            error "Troubleshooting:"
            error "  1. Test SSH connection: ssh $SCP_USER_HOST 'echo test'"
            error "  2. Check parent directory exists: ssh $SCP_USER_HOST 'ls -ld $(dirname $ESCAPED_PATH)'"
            error "  3. Check write permissions: ssh $SCP_USER_HOST 'test -w $(dirname $ESCAPED_PATH) && echo writable || echo not writable'"
            exit 1
        fi
        
        info "Directory creation output: $CREATE_OUTPUT"
    fi

    # Verify the directory was actually created
    info "Verifying directory exists..."
    VERIFY_OUTPUT=$(ssh "$SCP_USER_HOST" "test -d $ESCAPED_PATH && ls -ld $ESCAPED_PATH" 2>&1)
    VERIFY_EXIT_CODE=$?

    if [ $VERIFY_EXIT_CODE -ne 0 ]; then
        error "Directory creation verification failed - directory may not exist"
        error "Path: $SCP_PATH"
        error "Verification output: $VERIFY_OUTPUT"
        error "Exit code: $VERIFY_EXIT_CODE"
        exit 1
    fi

    info "Directory verified: $VERIFY_OUTPUT"
    success "Destination directory ready: $SCP_PATH"

    # Transfer via SCP
    info "Transferring archive via SCP..."
    info "Source: $ZIP_PATH"
    info "Destination: $dest_input/"

    # Verify directory exists one more time before SCP
    info "Verifying destination directory exists before transfer..."
    if ! ssh "$SCP_USER_HOST" "test -d $ESCAPED_PATH" 2>/dev/null; then
        error "Destination directory does not exist: $SCP_PATH"
        error "Directory creation may have failed. Please check SSH connection and permissions."
        exit 1
    fi

    # Transfer with error capture
    info "Starting SCP transfer..."
    SCP_OUTPUT=$(scp "$ZIP_PATH" "$dest_input/" 2>&1)
    SCP_EXIT_CODE=$?

    if [ $SCP_EXIT_CODE -ne 0 ]; then
        error "SCP transfer failed with exit code: $SCP_EXIT_CODE"
        if [ -n "$SCP_OUTPUT" ]; then
            error "SCP error output:"
            echo "$SCP_OUTPUT" | while IFS= read -r line; do
                error "  $line"
            done
        fi
        error ""
        error "Troubleshooting:"
        error "  1. Verify SSH connection works: ssh $SCP_USER_HOST"
        error "  2. Verify directory exists: ssh $SCP_USER_HOST 'ls -ld $ESCAPED_PATH'"
        error "  3. Verify write permissions: ssh $SCP_USER_HOST 'test -w $ESCAPED_PATH && echo writable || echo not writable'"
        error "  4. Check disk space: ssh $SCP_USER_HOST 'df -h $(dirname $ESCAPED_PATH)'"
        exit 1
    fi

    success "Archive transferred successfully"

    # Extract on remote machine
    info "Extracting archive on remote machine..."
    ESCAPED_PATH=$(printf '%q' "$SCP_PATH")
    EXTRACT_CMD="mkdir -p $ESCAPED_PATH && \
        cd $ESCAPED_PATH && \
        if ! command -v unzip >/dev/null 2>&1; then \
            echo 'Error: unzip not found on remote machine'; \
            exit 1; \
        fi && \
        rm -rf client server database web notify 2>/dev/null || true && \
        rm -rf uploads history 2>/dev/null || true && \
        rm -f .gitignore .cursorignore AGENTS.md Makefile docker-compose.yml pyproject.toml README.md .env.example export.sh 2>/dev/null || true && \
        unzip -q -o \"$ZIP_NAME\" && \
        rm \"$ZIP_NAME\" && \
        echo 'Extraction complete'"

    if ! ssh "$SCP_USER_HOST" "$EXTRACT_CMD"; then
        error "Failed to extract archive on remote machine"
        error "Archive is available at: $dest_input/$ZIP_NAME"
        error "You can manually extract it with: unzip $ZIP_NAME"
        warning "Note: The zip file was transferred but extraction failed"
        exit 1
    fi

    success "Archive extracted successfully on remote machine"
    FINAL_DEST="$dest_input"
else
    # LOCAL DESTINATION
    
    # Convert to absolute path
    LOCAL_DEST_ABS=$(cd "$(dirname "$LOCAL_DEST")" 2>/dev/null && pwd)/$(basename "$LOCAL_DEST") || {
        # If parent doesn't exist, use relative to current directory
        LOCAL_DEST_ABS="$SCRIPT_DIR/$LOCAL_DEST"
    }
    
    # Create destination directory
    info "Creating destination directory: $LOCAL_DEST_ABS"
    mkdir -p "$LOCAL_DEST_ABS"
    
    # Copy zip archive to destination
    info "Copying zip archive to destination..."
    FINAL_ZIP_PATH="$LOCAL_DEST_ABS/$ZIP_NAME"
    cp "$ZIP_PATH" "$FINAL_ZIP_PATH"
    success "Archive copied successfully"
    info "Archive location: $FINAL_ZIP_PATH"
    
    # Extract archive locally (matching remote behavior - extract directly into destination)
    info "Extracting archive locally..."
    cd "$LOCAL_DEST_ABS"
    
    # Remove existing directories/files that will be replaced (matching remote behavior)
    rm -rf client server database web notify 2>/dev/null || true
    rm -rf uploads history 2>/dev/null || true
    rm -f .gitignore .cursorignore AGENTS.md Makefile docker-compose.yml pyproject.toml README.md .env.example export.sh 2>/dev/null || true
    
    if ! unzip -q -o "$FINAL_ZIP_PATH"; then
        error "Failed to extract archive"
        exit 1
    fi
    
    # Remove zip file after extraction (matching remote behavior)
    rm "$FINAL_ZIP_PATH"
    
    cd "$SCRIPT_DIR"
    success "Archive extracted successfully"
    FINAL_DEST="$LOCAL_DEST_ABS"
fi

echo ""
success "Export completed successfully!"
info "Files are available at: $FINAL_DEST"

