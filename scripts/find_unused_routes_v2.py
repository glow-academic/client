#!/usr/bin/env python3
"""Find unused API routes by checking client-side references - improved version."""

import re
from pathlib import Path
from typing import List, Set, Tuple

# Base paths
SERVER_API_DIR = Path("server/app/api/v3")
CLIENT_DIR = Path("client")
SQL_DIR = Path("server/sql/v3")


def extract_route_from_file(file_path: Path) -> List[Tuple[str, str]]:
    """Extract (method, path) tuples from a route file."""
    routes = []
    try:
        with open(file_path, "r") as f:
            content = f.read()
            # Find @router.get, @router.post, etc. decorators
            pattern = r'@router\.(get|post|put|patch|delete)\(["\']([^"\']+)["\']'
            matches = re.findall(pattern, content)
            for method, path in matches:
                routes.append((method, path))
    except Exception:
        pass
    return routes


def find_all_registered_routes() -> List[Tuple[str, Path, str, str]]:
    """
    Find all registered routes by parsing __init__.py files recursively.
    Returns: List of (full_route_path, file_path, method, route_path) tuples
    """
    all_routes = []
    
    def parse_init_file(init_file: Path, base_prefix: str = "") -> None:
        """Recursively parse __init__.py files to find registered routes."""
        if not init_file.exists():
            return
            
        try:
            with open(init_file, "r") as f:
                content = f.read()
            
            # Find router prefix
            prefix_match = re.search(r'APIRouter\(prefix=["\']([^"\']+)["\']', content)
            current_prefix = prefix_match.group(1) if prefix_match else ""
            full_prefix = f"{base_prefix}{current_prefix}" if base_prefix else current_prefix
            
            # Find all imports ending with _router
            router_files = {}
            for match in re.finditer(
                r'from\s+([^\s]+)\s+import\s+\w+\s+as\s+(\w+_router)',
                content
            ):
                module_path = match.group(1)
                router_name = match.group(2)
                
                # Convert module path to file path
                if module_path.startswith("app.api.v3"):
                    # Absolute import
                    parts = module_path.split(".")
                    if len(parts) >= 4:
                        # Find the file
                        relative_parts = parts[3:]  # Skip app.api.v3
                        route_file = SERVER_API_DIR
                        for part in relative_parts:
                            route_file = route_file / part
                        route_file = route_file.with_suffix(".py")
                        
                        if route_file.exists():
                            router_files[router_name] = route_file
                        elif (route_file.parent / "__init__.py").exists():
                            # It's a subdirectory router
                            router_files[router_name] = route_file.parent / "__init__.py"
                elif module_path.startswith("."):
                    # Relative import
                    init_dir = init_file.parent
                    if module_path == ".":
                        # Same directory
                        route_name = router_name.replace("_router", "")
                        route_file = init_dir / f"{route_name}.py"
                        if route_file.exists():
                            router_files[router_name] = route_file
                    else:
                        # Subdirectory
                        subdir_name = module_path.lstrip(".")
                        subdir_init = init_dir / subdir_name / "__init__.py"
                        if subdir_init.exists():
                            router_files[router_name] = subdir_init
            
            # Find which routers are included
            included_routers = set()
            for match in re.finditer(r'router\.include_router\((\w+)\)', content):
                included_routers.add(match.group(1))
            
            # Process included routers
            for router_name, router_file in router_files.items():
                if router_name in included_routers:
                    if router_file.name == "__init__.py":
                        # Recursive: it's a subdirectory router
                        parse_init_file(router_file, full_prefix)
                    else:
                        # It's a route file
                        route_paths = extract_route_from_file(router_file)
                        for method, route_path in route_paths:
                            full_route = f"/api/v3{full_prefix}{route_path}"
                            all_routes.append((full_route, router_file, method, route_path))
                            
        except Exception as e:
            print(f"Error parsing {init_file}: {e}")
    
    # Start from main router
    main_init = SERVER_API_DIR / "__init__.py"
    if main_init.exists():
        # Parse all resource __init__.py files
        for resource_dir in SERVER_API_DIR.iterdir():
            if resource_dir.is_dir() and not resource_dir.name.startswith("__"):
                resource_init = resource_dir / "__init__.py"
                if resource_init.exists():
                    parse_init_file(resource_init)
    
    return all_routes


def find_client_references() -> Set[str]:
    """Find all API route references in client code."""
    references = set()
    
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
                if not path.startswith("/api/"):
                    full_path = f"/api/v3{path}"
                else:
                    full_path = path
                references.add(full_path)
            
            # Pattern 2: InputOf/OutputOf types
            matches = re.findall(r'(InputOf|OutputOf)<["\'](/api/v3/[^"\']+)["\']', content)
            for _, path in matches:
                references.add(path)
            
            # Pattern 3: Direct "/api/v3/..." strings in schema
            if "schema.ts" in str(file_path):
                matches = re.findall(r'["\'](/api/v3/[^"\']+)["\']:\s*\{', content)
                for path in matches:
                    references.add(path)
                
        except Exception:
            pass
    
    return references


def find_sql_files(resource: str, route_path: str) -> List[Path]:
    """Find corresponding SQL files for a route."""
    sql_files = []
    
    # Extract operation from route path
    parts = route_path.rstrip("/").split("/")
    if len(parts) >= 4:
        operation = parts[-1]
        
        sql_dir = SQL_DIR / resource
        if sql_dir.exists():
            # Try various patterns
            for sql_file in sql_dir.rglob("*.sql"):
                if operation in sql_file.stem.lower():
                    sql_files.append(sql_file)
    
    return list(set(sql_files))


def main():
    print("Finding unused API routes (v2)...")
    print("=" * 60)
    
    # Extract registered routes
    print("\n1. Extracting registered routes from server...")
    all_routes = find_all_registered_routes()
    print(f"   Found {len(all_routes)} registered routes")
    
    # Find client references
    print("\n2. Scanning client codebase for references...")
    client_refs = find_client_references()
    print(f"   Found {len(client_refs)} unique route references in client")
    
    # Find unused routes
    print("\n3. Identifying unused routes...")
    unused_routes = []
    
    for full_route, file_path, method, route_path in all_routes:
        normalized = full_route.rstrip("/")
        
        # Check if route is referenced
        is_used = normalized in client_refs
        
        if not is_used:
            # Extract resource name
            parts = normalized.split("/")
            resource = parts[3] if len(parts) > 3 else "unknown"
            
            sql_files = find_sql_files(resource, normalized)
            unused_routes.append({
                "route_path": normalized,
                "file_path": file_path,
                "method": method,
                "sql_files": sql_files,
            })
    
    # Print results
    print(f"\n{'='*60}")
    print(f"Found {len(unused_routes)} unused routes:")
    print(f"{'='*60}\n")
    
    if unused_routes:
        for route in unused_routes:
            print(f"Route: {route['route_path']} ({route['method'].upper()})")
            print(f"  File: {route['file_path']}")
            if route['sql_files']:
                print(f"  SQL files:")
                for sql_file in route['sql_files']:
                    print(f"    - {sql_file}")
            print()
    else:
        print("No unused routes found!")
    
    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Total registered routes: {len(all_routes)}")
    print(f"Unused routes: {len(unused_routes)}")
    print(f"{'='*60}")
    
    # Write results to file
    output_file = Path("unused_routes_v2.txt")
    with open(output_file, "w") as f:
        f.write("UNUSED API ROUTES\n")
        f.write("=" * 60 + "\n\n")
        for route in unused_routes:
            f.write(f"Route: {route['route_path']} ({route['method'].upper()})\n")
            f.write(f"  File: {route['file_path']}\n")
            if route['sql_files']:
                f.write(f"  SQL files:\n")
                for sql_file in route['sql_files']:
                    f.write(f"    - {sql_file}\n")
            f.write("\n")
    
    print(f"\nResults written to {output_file}")


if __name__ == "__main__":
    main()

