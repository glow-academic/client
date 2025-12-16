#!/usr/bin/env python3
"""Find unused API routes by checking client-side references."""

import os
import re
from pathlib import Path
from typing import Dict, List, Set, Tuple

# Base paths
SERVER_API_DIR = Path("server/app/api/v3")
CLIENT_DIR = Path("client")
SQL_DIR = Path("server/sql/v3")
BFF_DIR = Path("client/app/api")
SCHEMA_FILE = Path("client/lib/api/schema.ts")


def extract_route_paths_from_file(file_path: Path) -> List[str]:
    """Extract route paths from a Python route file."""
    routes = []
    try:
        with open(file_path, "r") as f:
            content = f.read()
            # Find @router.get, @router.post, etc. decorators
            pattern = r'@router\.(get|post|put|patch|delete)\(["\']([^"\']+)["\']'
            matches = re.findall(pattern, content)
            for method, path in matches:
                routes.append(path)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
    return routes


def extract_registered_routes() -> List[Tuple[str, str, Path]]:
    """
    Extract all registered routes from __init__.py files.
    Returns: List of (resource_name, route_path, file_path) tuples
    """
    all_routes = []
    
    # Find all __init__.py files in v3 API directory (excluding root)
    for init_file in SERVER_API_DIR.rglob("__init__.py"):
        if init_file.parent == SERVER_API_DIR:
            continue
            
        resource_name = init_file.parent.name
        
        try:
            with open(init_file, "r") as f:
                content = f.read()
            
            # Find router prefix (e.g., prefix="/documents")
            prefix_match = re.search(r'APIRouter\(prefix=["\']([^"\']+)["\']', content)
            if not prefix_match:
                continue
            router_prefix = prefix_match.group(1)
            
            # Find all imports that end with _router
            router_imports = {}
            for match in re.finditer(r'from\s+([^\s]+)\s+import\s+(\w+)\s+as\s+(\w+_router)', content):
                module_path = match.group(1)
                router_name = match.group(3)
                # Extract the route file name from module path
                if module_path.startswith("app.api.v3"):
                    parts = module_path.split(".")
                    if len(parts) >= 4:
                        route_file_name = parts[-1]
                        route_file = init_file.parent / f"{route_file_name}.py"
                        # Check subdirectories too (e.g., profile/staff)
                        if not route_file.exists():
                            for subdir in init_file.parent.iterdir():
                                if subdir.is_dir() and (subdir / f"{route_file_name}.py").exists():
                                    route_file = subdir / f"{route_file_name}.py"
                                    break
                        if route_file.exists():
                            router_imports[router_name] = route_file
            
            # Find all router.include_router calls
            registered_routers = set()
            for match in re.finditer(r'router\.include_router\((\w+)\)', content):
                registered_routers.add(match.group(1))
            
            # Extract routes from registered routers only
            for router_name, route_file in router_imports.items():
                if router_name in registered_routers:
                    route_paths = extract_route_paths_from_file(route_file)
                    for route_path in route_paths:
                        full_path = f"/api/v3{router_prefix}{route_path}"
                        all_routes.append((resource_name, full_path, route_file))
                        
        except Exception as e:
            print(f"Error parsing {init_file}: {e}")
    
    return all_routes


def find_client_references() -> Tuple[Set[str], Dict[str, List[str]]]:
    """
    Find all API route references in client code.
    Returns: (references_set, bff_references_dict) where bff_references_dict maps
             route paths to list of BFF files that reference them.
    """
    references: Set[str] = set()
    bff_references: Dict[str, List[str]] = {}  # Map route path -> list of BFF files
    
    # Patterns to search for:
    # 1. api.get("/resource/operation", ...) or api.post("/resource/operation", ...)
    # 2. InputOf<"/api/v3/resource/operation", "post">
    # 3. OutputOf<"/api/v3/resource/operation", "post">
    # 4. Direct fetch calls to "/api/v3/..." in BFF routes
    
    for file_path in CLIENT_DIR.rglob("*"):
        if "node_modules" in str(file_path) or not file_path.is_file():
            continue
        if file_path.suffix not in (".ts", ".tsx"):
            continue
        
        # Skip schema.ts as it's auto-generated and contains all routes
        if file_path == SCHEMA_FILE:
            continue
            
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            
            is_bff_file = BFF_DIR in file_path.parents or str(file_path).startswith(str(BFF_DIR))
            found_routes_in_file = set()
                
            # Pattern 1: api.method("/path")
            matches = re.findall(r'api\.(get|post|put|patch|delete)\(["\']([^"\']+)["\']', content)
            for method, path in matches:
                # Convert short path to full path
                if not path.startswith("/api/"):
                    full_path = f"/api/v3{path}"
                else:
                    full_path = path
                references.add(full_path)
                found_routes_in_file.add(full_path)
            
            # Pattern 2: InputOf/OutputOf types
            matches = re.findall(r'(InputOf|OutputOf)<["\'](/api/v3/[^"\']+)["\']', content)
            for _, path in matches:
                references.add(path)
                found_routes_in_file.add(path)
            
            # Pattern 3: Direct "/api/v3/..." strings in fetch calls or URL construction
            # Check for fetch calls with INTERNAL_HTTP_BASE or direct URLs
            # Pattern: fetch(`${INTERNAL_HTTP_BASE}/api/v3/...`)
            fetch_matches = re.findall(
                r'fetch\([^)]*[`"\'](/api/v3/[^`"\']+)[`"\']', 
                content
            )
            for path in fetch_matches:
                # Normalize path (remove query params, fragments, etc.)
                normalized_path = path.split('?')[0].split('#')[0].rstrip('/')
                if re.match(r'^/api/v3/[^/]+/.+', normalized_path):  # Must have resource and operation
                    references.add(normalized_path)
                    found_routes_in_file.add(normalized_path)
            
            # Pattern 4: Template literals with /api/v3/ (e.g., `${INTERNAL_HTTP_BASE}/api/v3/...`)
            template_matches = re.findall(
                r'`[^`]*\/api\/v3\/([^`\?]+)', 
                content
            )
            for match in template_matches:
                path = f"/api/v3/{match.rstrip('/')}"
                if re.match(r'^/api/v3/[^/]+/.+', path):
                    references.add(path)
                    found_routes_in_file.add(path)
            
            # Pattern 5: toFull() calls with short paths (e.g., toFull(API_VERSION, "/resource/operation"))
            tofull_matches = re.findall(
                r'toFull\([^,]+,\s*["\']([^"\']+)["\']', 
                content
            )
            for path in tofull_matches:
                if path.startswith("/") and not path.startswith("/api/"):
                    full_path = f"/api/v3{path}"
                    references.add(full_path)
                    found_routes_in_file.add(full_path)
            
            # Pattern 6: Direct "/api/v3/..." string references (but exclude schema-like patterns)
            # Only match if it looks like a route path (has resource and operation)
            direct_matches = re.findall(r'["\'](/api/v3/[^"\']+)["\']', content)
            for path in direct_matches:
                # Normalize and validate
                normalized_path = path.split('?')[0].split('#')[0].rstrip('/')
                # Must have at least resource/operation structure
                if re.match(r'^/api/v3/[^/]+/[^"\']+$', normalized_path):
                    references.add(normalized_path)
                    found_routes_in_file.add(normalized_path)
            
            # Track BFF file references
            if is_bff_file and found_routes_in_file:
                for route in found_routes_in_file:
                    if route not in bff_references:
                        bff_references[route] = []
                    bff_references[route].append(str(file_path.relative_to(CLIENT_DIR)))
                
        except Exception as e:
            pass  # Skip files that can't be read
    
    return references, bff_references


def find_sql_files(resource: str, route_path: str) -> List[Path]:
    """Find corresponding SQL files for a route."""
    sql_files: List[Path] = []
    
    # Extract operation from route path (e.g., "/api/v3/personas/create" -> "create")
    parts = route_path.split("/")
    if len(parts) < 4:
        return sql_files
    
    operation = parts[-1]
    
    # Handle nested routes (e.g., "/api/v3/uploads/upload/{upload_id}/finalize" -> "finalize")
    # But also check parent operation (e.g., "upload" for uploads routes)
    operations_to_check = [operation]
    
    # For nested routes, also check parent operation
    if len(parts) > 4:
        parent_operation = parts[-2]
        operations_to_check.append(parent_operation)
    
    # Common SQL file patterns
    sql_dir = SQL_DIR / resource
    if not sql_dir.exists():
        return sql_files
    
    # Try various naming patterns for each operation
    for op in operations_to_check:
        patterns = [
            f"{op}_complete.sql",
            f"{op}_{resource}_complete.sql",
            f"get_{op}_complete.sql",
            f"create_{op}_complete.sql",
            f"update_{op}_complete.sql",
            f"delete_{op}_complete.sql",
            f"{op}.sql",
        ]
        
        for pattern in patterns:
            sql_file = sql_dir / pattern
            if sql_file.exists() and sql_file not in sql_files:
                sql_files.append(sql_file)
    
    # Also check for files that contain the operation name (but be more selective)
    for sql_file in sql_dir.glob("*.sql"):
        file_lower = sql_file.name.lower()
        # Only add if operation appears as a whole word or at start/end
        for op in operations_to_check:
            op_lower = op.lower()
            if (op_lower in file_lower and 
                (file_lower.startswith(op_lower) or 
                 file_lower.endswith(op_lower) or
                 f"_{op_lower}_" in file_lower or
                 f"_{op_lower}." in file_lower) and
                sql_file not in sql_files):
                sql_files.append(sql_file)
    
    return sql_files


def normalize_route_path(path: str) -> str:
    """Normalize route path for comparison (remove trailing slash, handle path params)."""
    # Remove trailing slash
    normalized = path.rstrip("/")
    # Handle path parameters - normalize {param} and :param to a generic pattern
    # But keep the structure for matching
    return normalized


def check_route_match(route_path: str, reference: str) -> bool:
    """
    Check if a reference matches a route path.
    Handles path parameters and normalization.
    """
    route_norm = normalize_route_path(route_path)
    ref_norm = normalize_route_path(reference)
    
    # Exact match
    if route_norm == ref_norm:
        return True
    
    # Handle path parameters: /api/v3/resource/{id} should match /api/v3/resource/123
    # Replace {param} and :param with regex pattern
    route_pattern = re.escape(route_norm)
    route_pattern = re.sub(r'\\\{[^}]+\}', r'[^/]+', route_pattern)  # {param} -> [^/]+
    route_pattern = re.sub(r'\\:[^/]+', r'[^/]+', route_pattern)  # :param -> [^/]+
    
    if re.match(f'^{route_pattern}$', ref_norm):
        return True
    
    return False


def main() -> None:
    print("Finding unused API routes...")
    print("=" * 60)
    
    # Extract registered routes
    print("\n1. Extracting registered routes from server...")
    all_routes = extract_registered_routes()
    print(f"   Found {len(all_routes)} registered routes")
    
    # Find client references
    print("\n2. Scanning client codebase for references...")
    print("   (Excluding lib/api/schema.ts as it's auto-generated)")
    client_refs, bff_references = find_client_references()
    print(f"   Found {len(client_refs)} unique route references in client")
    print(f"   Found {len(bff_references)} routes referenced in BFF files")
    
    # Find unused routes
    print("\n3. Identifying unused routes...")
    unused_routes = []
    
    for resource, route_path, file_path in all_routes:
        # Check if route is referenced
        is_used = False
        matching_refs = []
        
        for ref in client_refs:
            if check_route_match(route_path, ref):
                is_used = True
                matching_refs.append(ref)
                break
        
        # Determine confidence level
        confidence = "high"
        bff_files = []
        
        if not is_used:
            # Check if it's only in schema.ts (would be medium confidence)
            # But we already excluded schema.ts, so if not found, it's high confidence
            confidence = "high"
            
            # Check BFF references
            normalized_route = normalize_route_path(route_path)
            for bff_route, files in bff_references.items():
                if check_route_match(route_path, bff_route):
                    bff_files.extend(files)
                    # If found in BFF, it's actually used
                    is_used = True
                    confidence = "high"
                    break
        else:
            # Check if also referenced in BFF
            normalized_route = normalize_route_path(route_path)
            for bff_route, files in bff_references.items():
                if check_route_match(route_path, bff_route):
                    bff_files.extend(files)
        
        if not is_used:
            sql_files = find_sql_files(resource, route_path)
            unused_routes.append({
                "resource": resource,
                "route_path": route_path,
                "file_path": file_path,
                "sql_files": sql_files,
                "confidence": confidence,
                "bff_files": bff_files,
            })
    
    # Print results
    print(f"\n{'='*60}")
    print(f"Found {len(unused_routes)} unused routes:")
    print(f"{'='*60}\n")
    
    if unused_routes:
        for route in unused_routes:
            print(f"Route: {route['route_path']}")
            print(f"  File: {route['file_path']}")
            print(f"  Confidence: {route['confidence']}")
            sql_files_list = route['sql_files']
            if sql_files_list:
                print(f"  SQL files:")
                for sql_file in sql_files_list:  # type: ignore[attr-defined]
                    print(f"    - {sql_file}")
            else:
                print(f"  SQL files: (none found)")
            bff_files_list = route.get('bff_files')
            if bff_files_list:
                print(f"  Note: Found in BFF files (but marked unused - may need review):")
                for bff_file in bff_files_list:  # type: ignore[attr-defined]
                    print(f"    - {bff_file}")
            print()
    else:
        print("No unused routes found!")
    
    # Also check for orphaned files (files that exist but aren't registered)
    print(f"\n{'='*60}")
    print("Checking for orphaned route files (not registered)...")
    print(f"{'='*60}\n")
    
    registered_files = {route['file_path'] for route in unused_routes}
    registered_files.update({file_path for _, _, file_path in all_routes})
    
    orphaned_files = []
    for resource_dir in SERVER_API_DIR.iterdir():
        if not resource_dir.is_dir() or resource_dir.name.startswith("__"):
            continue
        
        resource = resource_dir.name
        for route_file in resource_dir.rglob("*.py"):
            if route_file.name == "__init__.py":
                continue
            
            if route_file not in registered_files:
                # Check if it's referenced anywhere
                route_paths = extract_route_paths_from_file(route_file)
                is_referenced = False
                for route_path in route_paths:
                    # Try to construct full path
                    # Need to find the resource prefix
                    full_path = f"/api/v3/{resource}{route_path}"
                    # Check client references
                    for ref in client_refs:
                        if check_route_match(full_path, ref):
                            is_referenced = True
                            break
                    if is_referenced:
                        break
                    # Check BFF references
                    for bff_route in bff_references.keys():
                        if check_route_match(full_path, bff_route):
                            is_referenced = True
                            break
                    if is_referenced:
                        break
                
                if not is_referenced:
                    orphaned_files.append({
                        "file_path": route_file,
                        "resource": resource,
                    })
    
    if orphaned_files:
        print(f"Found {len(orphaned_files)} orphaned route files:")
        for orphan in orphaned_files:
            print(f"  - {orphan['file_path']}")
    else:
        print("No orphaned route files found!")
    
    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Total registered routes: {len(all_routes)}")
    print(f"Unused routes: {len(unused_routes)}")
    print(f"Orphaned files: {len(orphaned_files)}")
    print(f"{'='*60}")
    
    # Write results to file for easy review
    output_file = Path("unused_routes.txt")
    with open(output_file, "w") as f:
        f.write("UNUSED API ROUTES\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"Total registered routes: {len(all_routes)}\n")
        f.write(f"Unused routes: {len(unused_routes)}\n")
        f.write(f"Orphaned files: {len(orphaned_files)}\n")
        f.write("\n")
        f.write("=" * 60 + "\n\n")
        
        for route in unused_routes:
            f.write(f"Route: {route['route_path']}\n")
            f.write(f"  File: {route['file_path']}\n")
            f.write(f"  Confidence: {route['confidence']}\n")
            sql_files_list = route['sql_files']
            if sql_files_list:
                f.write(f"  SQL files:\n")
                for sql_file in sql_files_list:  # type: ignore[attr-defined]
                    f.write(f"    - {sql_file}\n")
            else:
                f.write(f"  SQL files: (none found)\n")
            bff_files_list = route.get('bff_files')
            if bff_files_list:
                f.write(f"  Note: Found in BFF files (but marked unused - may need review):\n")
                for bff_file in bff_files_list:  # type: ignore[attr-defined]
                    f.write(f"    - {bff_file}\n")
            f.write("\n")
        
        if orphaned_files:
            f.write("\nORPHANED FILES\n")
            f.write("=" * 60 + "\n\n")
            for orphan in orphaned_files:
                f.write(f"  - {orphan['file_path']}\n")
    
    print(f"\nResults written to {output_file}")


if __name__ == "__main__":
    main()
