"""Utility to generate WebSocket contract from socket handler functions."""

from __future__ import annotations

import inspect
from collections.abc import Callable
from typing import Any, get_type_hints

from pydantic import BaseModel


def _get_first_pydantic_param(fn: Callable[..., object]) -> type[BaseModel] | None:
    """Extract the first Pydantic model parameter from a function signature."""
    hints = get_type_hints(fn)
    sig = inspect.signature(fn)
    for param in sig.parameters.values():
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


def _extract_simple_payload_schema(model: type[BaseModel]) -> dict[str, str]:
    """Extract simple type strings from Pydantic model fields."""
    schema: dict[str, str] = {}
    for field_name, field_info in model.model_fields.items():
        annotation = field_info.annotation
        # Handle Optional types
        if annotation is not None and hasattr(annotation, "__origin__"):
            origin = getattr(annotation, "__origin__", None)
            if origin is type(None) or (
                origin is not None
                and hasattr(origin, "__args__")
                and type(None) in getattr(annotation, "__args__", [])
            ):
                args = [
                    a
                    for a in getattr(annotation, "__args__", [])
                    if a is not type(None)
                ]
                if args:
                    annotation = args[0]
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
