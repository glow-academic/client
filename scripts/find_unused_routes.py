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


def find_client_references() -> Set[str]:
    """Find all API route references in client code."""
    references = set()
    
    # Patterns to search for:
    # 1. api.get("/resource/operation", ...) or api.post("/resource/operation", ...)
    # 2. InputOf<"/api/v3/resource/operation", "post">
    # 3. OutputOf<"/api/v3/resource/operation", "post">
    # 4. "/api/v3/resource/operation" in schema.ts
    
    for file_path in CLIENT_DIR.rglob("*"):
        if "node_modules" in str(file_path) or not file_path.is_file():
            continue
        if file_path.suffix not in (".ts", ".tsx"):
            continue
            
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                
            # Pattern 1: api.method("/path")
            matches = re.findall(r'api\.(get|post|put|patch|delete)\(["\']([^"\']+)["\']', content)
            for method, path in matches:
                # Convert short path to full path
                if not path.startswith("/api/"):
                    full_path = f"/api/v3{path}"
                else:
                    full_path = path
                references.add(full_path)
            
            # Pattern 2: InputOf/OutputOf types
            matches = re.findall(r'(InputOf|OutputOf)<["\'](/api/v3/[^"\']+)["\']', content)
            for _, path in matches:
                references.add(path)
            
            # Pattern 3: Direct "/api/v3/..." strings (for schema.ts)
            matches = re.findall(r'["\'](/api/v3/[^"\']+)["\']', content)
            for path in matches:
                # Only add if it looks like a route path (not part of a longer string)
                if re.match(r'^/api/v3/[^/]+/[^"\']+$', path):
                    references.add(path)
                
        except Exception as e:
            pass  # Skip files that can't be read
    
    return references


def find_sql_files(resource: str, route_path: str) -> List[Path]:
    """Find corresponding SQL files for a route."""
    sql_files = []
    
    # Extract operation from route path (e.g., "/api/v3/personas/create" -> "create")
    parts = route_path.split("/")
    if len(parts) >= 4:
        operation = parts[-1]
        
        # Common SQL file patterns
        sql_dir = SQL_DIR / resource
        if sql_dir.exists():
            # Try various naming patterns
            patterns = [
                f"{operation}_complete.sql",
                f"{operation}_{resource}_complete.sql",
                f"get_{operation}_complete.sql",
                f"create_{operation}_complete.sql",
                f"update_{operation}_complete.sql",
                f"delete_{operation}_complete.sql",
                f"{operation}.sql",
            ]
            
            # Also check for files that contain the operation name
            for sql_file in sql_dir.glob("*.sql"):
                if operation in sql_file.name.lower():
                    sql_files.append(sql_file)
    
    return list(set(sql_files))  # Remove duplicates


def main():
    print("Finding unused API routes...")
    print("=" * 60)
    
    # Extract registered routes
    print("\n1. Extracting registered routes from server...")
    all_routes = extract_registered_routes()
    print(f"   Found {len(all_routes)} registered routes")
    
    # Find client references
    print("\n2. Scanning client codebase for references...")
    client_refs = find_client_references()
    print(f"   Found {len(client_refs)} unique route references in client")
    
    # Find unused routes
    print("\n3. Identifying unused routes...")
    unused_routes = []
    
    for resource, route_path, file_path in all_routes:
        # Normalize route path for comparison
        normalized = route_path.rstrip("/")
        
        # Check if route is referenced
        is_used = False
        for ref in client_refs:
            ref_normalized = ref.rstrip("/")
            if normalized == ref_normalized:
                is_used = True
                break
        
        if not is_used:
            sql_files = find_sql_files(resource, route_path)
            unused_routes.append({
                "resource": resource,
                "route_path": route_path,
                "file_path": file_path,
                "sql_files": sql_files,
            })
    
    # Print results
    print(f"\n{'='*60}")
    print(f"Found {len(unused_routes)} unused routes:")
    print(f"{'='*60}\n")
    
    if unused_routes:
        for route in unused_routes:
            print(f"Route: {route['route_path']}")
            print(f"  File: {route['file_path']}")
            if route['sql_files']:
                print(f"  SQL files:")
                for sql_file in route['sql_files']:
                    print(f"    - {sql_file}")
            else:
                print(f"  SQL files: (none found)")
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
                    normalized = full_path.rstrip("/")
                    for ref in client_refs:
                        if normalized == ref.rstrip("/"):
                            is_referenced = True
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
        for route in unused_routes:
            f.write(f"Route: {route['route_path']}\n")
            f.write(f"  File: {route['file_path']}\n")
            if route['sql_files']:
                f.write(f"  SQL files:\n")
                for sql_file in route['sql_files']:
                    f.write(f"    - {sql_file}\n")
            f.write("\n")
        
        if orphaned_files:
            f.write("\nORPHANED FILES\n")
            f.write("=" * 60 + "\n\n")
            for orphan in orphaned_files:
                f.write(f"  - {orphan['file_path']}\n")
    
    print(f"\nResults written to {output_file}")


if __name__ == "__main__":
    main()
