"""Utility to generate WebSocket contract from socket handler functions."""

from __future__ import annotations

import inspect
from collections.abc import Callable
from typing import Any, Union, get_args, get_origin, get_type_hints

from pydantic import BaseModel


def _get_pydantic_model_from_module(
    fn: Callable[..., object], model_name: str
) -> type[BaseModel] | None:
    """Look for a Pydantic model in the function's module by name."""
    module = inspect.getmodule(fn)
    if module is None:
        return None
    model = getattr(module, model_name, None)
    if isinstance(model, type) and issubclass(model, BaseModel):
        return model
    return None


def _get_first_pydantic_param(fn: Callable[..., object]) -> type[BaseModel] | None:
    """Extract the first Pydantic model parameter from a function signature.
    
    For Socket.IO handlers with pattern (sid: str, data: dict[str, Any]),
    looks for a Pydantic model in the module matching {FunctionName}Payload.
    """
    hints = get_type_hints(fn)
    sig = inspect.signature(fn)
    params = list(sig.parameters.values())
    
    # Check if this is a Socket.IO handler pattern: (sid: str, data: dict[str, Any])
    if len(params) >= 2:
        first_param = params[0]
        second_param = params[1]
        first_param_type = hints.get(first_param.name)
        
        # Check if first param is sid: str (Socket.IO pattern)
        if (
            first_param.name == "sid"
            and (first_param_type is str or str(first_param_type) == "str")
        ):
            # Look for Pydantic model in module with naming pattern: {FunctionName}Payload
            # Convert snake_case to PascalCase: join_chat -> JoinChatPayload
            fn_name = fn.__name__
            # Convert snake_case to PascalCase
            parts = fn_name.split("_")
            pascal_case = "".join(word.capitalize() for word in parts)
            model_name = f"{pascal_case}Payload"
            
            model = _get_pydantic_model_from_module(fn, model_name)
            if model is not None:
                return model
            
            # Also try with first letter capitalized: JoinChatPayload (already done above)
            # Try alternative: just capitalize first letter
            alt_model_name = f"{fn_name[0].upper()}{fn_name[1:]}Payload"
            if alt_model_name != model_name:
                model = _get_pydantic_model_from_module(fn, alt_model_name)
                if model is not None:
                    return model
    
    # Standard check: look for Pydantic model as any parameter
    for param in params:
        if param.name == "return":
            continue
        t = hints.get(param.name)
        if isinstance(t, type) and issubclass(t, BaseModel):
            return t
    return None


def _get_pydantic_return(fn: Callable[..., object]) -> type[BaseModel] | None:
    """Extract the return type Pydantic model from a function signature."""
    hints = get_type_hints(fn)
    ret = hints.get("return")
    if isinstance(ret, type) and issubclass(ret, BaseModel):
        return ret
    return None


def _get_return_type(fn: Callable[..., object]) -> object | None:
    """Extract the return type from a function signature (Pydantic model or primitive)."""
    hints = get_type_hints(fn)
    return hints.get("return")


def _extract_nested_model_schema(model: type[BaseModel]) -> str:
    """Extract schema from a nested Pydantic model and return as inline object type string.
    
    Returns a string like "object{idx:number,hint:string}" that can be parsed by TypeScript generator.
    """
    fields: list[str] = []
    for field_name, field_info in model.model_fields.items():
        annotation = field_info.annotation
        # Handle Optional types
        if annotation is not None:
            origin = get_origin(annotation)
            if origin is not None:
                is_union = (
                    origin is Union
                    or str(origin) in ("typing.Union", "types.UnionType")
                    or (hasattr(origin, "__name__") and origin.__name__ == "UnionType")
                )
                if is_union:
                    args = get_args(annotation)
                    if type(None) in args:
                        non_none_args = [a for a in args if a is not type(None)]
                        if non_none_args:
                            annotation = non_none_args[0]
        
        # Map to simple type strings
        if annotation is str or "str" in str(annotation):
            field_type = "string"
        elif annotation in (int, float) or "int" in str(annotation) or "float" in str(annotation):
            field_type = "number"
        elif annotation is bool or "bool" in str(annotation):
            field_type = "boolean"
        else:
            field_type = "string"  # Default
        
        fields.append(f"{field_name}:{field_type}")
    
    return f"object{{{','.join(fields)}}}"


def _extract_simple_payload_schema(model: type[BaseModel]) -> dict[str, str]:
    """Extract simple type strings from Pydantic model fields."""
    schema: dict[str, str] = {}
    for field_name, field_info in model.model_fields.items():
        annotation = field_info.annotation
        # Handle Optional types (Union with None)
        if annotation is not None:
            origin = get_origin(annotation)
            # Check if it's a Union type that includes None (Optional)
            # Union types can be represented as types.UnionType (Python 3.10+) or typing.Union
            if origin is not None:
                # Check if it's a Union type (either typing.Union or types.UnionType)
                is_union = (
                    origin is Union
                    or str(origin) in ("typing.Union", "types.UnionType")
                    or (hasattr(origin, "__name__") and origin.__name__ == "UnionType")
                )
                if is_union:
                    args = get_args(annotation)
                    # If it's a Union and one of the args is None, extract the non-None type
                    if type(None) in args:
                        non_none_args = [a for a in args if a is not type(None)]
                        if non_none_args:
                            annotation = non_none_args[0]
        
        # Handle list types (list[str], List[str], etc.)
        if annotation is not None:
            origin = get_origin(annotation)
            if origin is list:
                args = get_args(annotation)
                if args:
                    element_type = args[0]
                    # Check if element type is a Pydantic model (nested object)
                    if isinstance(element_type, type) and issubclass(element_type, BaseModel):
                        # Extract nested model schema and create inline object type
                        nested_schema = _extract_nested_model_schema(element_type)
                        schema[field_name] = f"{nested_schema}[]"
                    # Determine the element type string for primitives
                    elif element_type is str or (hasattr(element_type, "__name__") and element_type.__name__ == "str"):
                        schema[field_name] = "string[]"
                    elif element_type in (int, float) or (hasattr(element_type, "__name__") and element_type.__name__ in ("int", "float")):
                        schema[field_name] = "number[]"
                    elif element_type is bool or (hasattr(element_type, "__name__") and element_type.__name__ == "bool"):
                        schema[field_name] = "boolean[]"
                    else:
                        schema[field_name] = "string[]"  # Default to string[]
                else:
                    schema[field_name] = "string[]"  # Default to string[] if no args
                continue
        
        # Map to simple type strings
        if annotation is str or "str" in str(annotation):
            schema[field_name] = "string"
        elif (
            annotation in (int, float)
            or "int" in str(annotation)
            or "float" in str(annotation)
        ):
            schema[field_name] = "number"
        elif annotation is bool or "bool" in str(annotation):
            schema[field_name] = "boolean"
        else:
            schema[field_name] = "string"  # Default to string
    return schema


def _extract_return_type_schema(return_type: object) -> dict[str, str] | None:
    """Extract return type schema from a return type annotation.

    Returns None if the return type is None/void, otherwise returns a schema dict.
    For Pydantic models, extracts fields. For primitives, creates a simple schema.
    """
    if return_type is None or return_type is type(None):
        return None

    # Handle Pydantic models
    if isinstance(return_type, type) and issubclass(return_type, BaseModel):
        return _extract_simple_payload_schema(return_type)

    # Handle primitive types
    if return_type is bool:
        return {"value": "boolean"}
    elif return_type is int or return_type is float:
        return {"value": "number"}
    elif return_type is str:
        return {"value": "string"}

    # Handle type hints as strings (e.g., "bool", "int", etc.)
    return_type_str = str(return_type)
    if "bool" in return_type_str.lower():
        return {"value": "boolean"}
    elif "int" in return_type_str.lower() or "float" in return_type_str.lower():
        return {"value": "number"}
    elif "str" in return_type_str.lower():
        return {"value": "string"}

    # Default: unknown type, return as string
    return {"value": "string"}


def build_socket_contract(
    *,
    client_to_server: list[Callable[..., object]],
    server_to_client: list[Callable[..., object]],
) -> dict[str, object]:
    """
    Given two lists of functions, infer payload/result Pydantic models and
    return a JSON-serializable contract dict.

    Args:
        socket_path: The Socket.IO path (e.g., "/socket.io")
        client_to_server: List of @sio.event handler functions (first Pydantic param is payload)
        server_to_client: List of stub functions representing emit events (first Pydantic param is payload)

    Returns:
        Dictionary with socketPath, clientToServer, and serverToClient event definitions
    """
    contract: dict[str, Any] = {
        "clientToServer": {},
        "serverToClient": {},
    }

    # ----- client -> server -----
    for fn in client_to_server:
        event_name = fn.__name__
        payload_model = _get_first_pydantic_param(fn)
        if payload_model is None:
            continue  # nothing to export

        # Extract return type (can be Pydantic model or primitive)
        return_type = _get_return_type(fn)
        return_schema = (
            _extract_return_type_schema(return_type) if return_type else None
        )

        event_def: dict[str, Any] = {
            "payload": _extract_simple_payload_schema(payload_model),
        }

        # Only include return field if there's a return type
        if return_schema is not None:
            event_def["return"] = return_schema

        contract["clientToServer"][event_name] = event_def

    # ----- server -> client -----
    for fn in server_to_client:
        event_name = fn.__name__
        payload_model = _get_first_pydantic_param(fn)
        if payload_model is None:
            continue

        contract["serverToClient"][event_name] = {
            "payload": _extract_simple_payload_schema(payload_model),
        }

    return contract
