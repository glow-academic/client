#!/bin/bash

# Export script for Glow codebase deployment
# This script packages and transfers the codebase to another machine via SCP
#
# Usage:
#   Interactive mode: ./export.sh
#   Non-interactive:  ./export.sh --env alpha --destination user@host:/path [--yes]
#
# Options:
#   -e, --env ENV          Environment (alpha, beta, or prod)
#   -d, --destination DEST  SCP destination (user@host:/path or alias:/path)
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
            echo "  -e, --env ENV          Environment (alpha, beta, or prod)"
            echo "  -d, --destination DEST SCP destination (user@host:/path or alias:/path)"
            echo "  -y, --yes              Skip confirmation prompt"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Interactive mode"
            echo "  $0 -e alpha -d ai:/path/to/folder    # Non-interactive mode"
            echo "  $0 -e prod -d user@host:/path -y     # Non-interactive with auto-confirm"
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
    read -p "Enter choice (1-3): " env_choice
    
    case $env_choice in
        1) ENV="alpha" ;;
        2) ENV="beta" ;;
        3) ENV="prod" ;;
        *)
            error "Invalid choice. Must be 1, 2, or 3"
            exit 1
            ;;
    esac
else
    # Validate environment from argument
    if [[ ! "$ENV" =~ ^(alpha|beta|prod)$ ]]; then
        error "Invalid environment: $ENV. Must be alpha, beta, or prod"
        exit 1
    fi
fi

# Validate environment file exists
ENV_FILE=".env.$ENV"
if [ ! -f "$ENV_FILE" ]; then
    error "Environment file $ENV_FILE not found"
    exit 1
fi

success "Selected environment: $ENV"

# Get SCP destination (interactive or from args)
if [ -z "$SCP_DEST" ]; then
    # Interactive prompt for SCP destination
    echo ""
    read -p "Enter SCP destination (user@host:/path/to/folder or alias:/path/to/folder): " scp_dest
    
    if [ -z "$scp_dest" ]; then
        error "SCP destination cannot be empty"
        exit 1
    fi
else
    scp_dest="$SCP_DEST"
fi

# Validate SCP format - supports both user@host:/path and alias:/path formats
# Must contain a colon with non-empty content before and after
if [[ ! "$scp_dest" =~ ^[^:]+:.+$ ]]; then
    error "Invalid SCP format. Expected: user@host:/path/to/folder or alias:/path/to/folder"
    exit 1
fi

success "SCP destination: $scp_dest"

# Extract host/alias and path from SCP destination
SCP_USER_HOST=$(echo "$scp_dest" | cut -d: -f1)
SCP_PATH=$(echo "$scp_dest" | cut -d: -f2)

# Validate extracted components
if [ -z "$SCP_USER_HOST" ] || [ -z "$SCP_PATH" ]; then
    error "Failed to parse SCP destination"
    exit 1
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
command -v scp >/dev/null 2>&1 || { error "scp is required but not installed"; exit 1; }
command -v ssh >/dev/null 2>&1 || { error "ssh is required but not installed"; exit 1; }

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
    warning "Ready to transfer to $scp_dest"
    read -p "Continue with SCP transfer? (y/N): " confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        info "Transfer cancelled by user"
        exit 0
    fi
fi

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
info "Destination: $scp_dest/"

# Verify directory exists one more time before SCP
info "Verifying destination directory exists before transfer..."
if ! ssh "$SCP_USER_HOST" "test -d $ESCAPED_PATH" 2>/dev/null; then
    error "Destination directory does not exist: $SCP_PATH"
    error "Directory creation may have failed. Please check SSH connection and permissions."
    exit 1
fi

# Transfer with error capture
info "Starting SCP transfer..."
SCP_OUTPUT=$(scp "$ZIP_PATH" "$scp_dest/" 2>&1)
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
# Verify remote path exists and create if needed, then extract directly into destination
# Check if unzip is available on remote machine
# Full rewrite: remove directories and root files that will be replaced
# Handle permission errors gracefully (e.g., web/generated files created by docker-gen)
# Escape the path for safe use in SSH command
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
    error "Archive is available at: $scp_dest/$ZIP_NAME"
    error "You can manually extract it with: unzip $ZIP_NAME"
    warning "Note: The zip file was transferred but extraction failed"
    exit 1
fi

success "Archive extracted successfully on remote machine"

echo ""
success "Export completed successfully!"
info "Files are available at: $scp_dest"

