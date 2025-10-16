#!/usr/bin/env python3
"""
Utility script to convert query files from named parameters to positional parameters.
Usage: python convert_queries.py <query_file>
"""

import re
import sys
from pathlib import Path


def convert_query_file(filepath: str) -> str:
    """Convert a query file from named params to positional params."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Step 1: Change return type in function signatures
    content = re.sub(
        r'-> Tuple\[str, Dict\[str, Any\]\]:',
        r'-> Tuple[str, List[Any]]:',
        content
    )
    
    # Step 2: Find all query methods and convert them
    def convert_method(match):
        method_content = match.group(0)
        
        # Find the query string
        query_match = re.search(r'query = """(.*?)"""', method_content, re.DOTALL)
        if not query_match:
            query_match = re.search(r'query = "(.*?)"', method_content, re.DOTALL)
        
        if not query_match:
            return method_content
        
        query = query_match.group(1)
        
        # Find all named parameters in the query (e.g., :param_name)
        named_params = re.findall(r':(\w+)', query)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_params = []
        for param in named_params:
            if param not in seen:
                seen.add(param)
                unique_params.append(param)
        
        # Replace named params with positional ($1, $2, etc.)
        new_query = query
        for i, param in enumerate(unique_params, 1):
            # Use word boundary to avoid partial matches
            new_query = re.sub(rf':({param})\b', f'${i}', new_query)
        
        # Update the query in the method
        method_content = re.sub(
            r'query = """.*?"""',
            f'query = """{new_query}"""',
            method_content,
            flags=re.DOTALL
        )
        method_content = re.sub(
            r'query = ".*?"',
            f'query = "{new_query}"',
            method_content,
            flags=re.DOTALL
        )
        
        # Convert params dict to list
        # Find params = {...}
        params_match = re.search(r'params = \{([^}]+)\}', method_content)
        if params_match and unique_params:
            # Build new params list based on the order we found
            param_values = []
            param_dict_str = params_match.group(1)
            
            for param_name in unique_params:
                # Look for "param_name": value
                value_match = re.search(rf'["\']?{param_name}["\']?\s*:\s*([^,}}]+)', param_dict_str)
                if value_match:
                    param_values.append(value_match.group(1).strip())
            
            if param_values:
                new_params = f"params = [{', '.join(param_values)}]"
                method_content = re.sub(r'params = \{[^}]+\}', new_params, method_content)
        elif 'params: Dict[str, Any] = {}' in method_content:
            # Empty dict for dynamic fills
            method_content = method_content.replace(
                'params: Dict[str, Any] = {}',
                'params: List[Any] = []'
            )
        
        return method_content
    
    # Process all methods
    # Match method definitions
    content = re.sub(
        r'(    def \w+\([^)]*\).*?(?=\n    def |\nclass |\Z))',
        convert_method,
        content,
        flags=re.DOTALL
    )
    
    return content


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python convert_queries.py <query_file>")
        sys.exit(1)
    
    filepath = sys.argv[1]
    converted = convert_query_file(filepath)
    
    # Write to output file
    output_path = filepath.replace('.py', '_converted.py')
    with open(output_path, 'w') as f:
        f.write(converted)
    
    print(f"Converted file written to: {output_path}")
    print("Please review the changes before replacing the original file.")

