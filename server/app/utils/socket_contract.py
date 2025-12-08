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
        if first_param.name == "sid" and (
            first_param_type is str or str(first_param_type) == "str"
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
        is_optional = False

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
                        is_optional = True
                        non_none_args = [a for a in args if a is not type(None)]
                        if non_none_args:
                            annotation = non_none_args[0]

        # Check if field is required (Pydantic v2)
        if not field_info.is_required() and not is_optional:
            is_optional = True

        # Map to simple type strings
        if annotation is str or "str" in str(annotation):
            field_type = "string"
        elif (
            annotation in (int, float)
            or "int" in str(annotation)
            or "float" in str(annotation)
        ):
            field_type = "number"
        elif annotation is bool or "bool" in str(annotation):
            field_type = "boolean"
        else:
            field_type = "string"  # Default

        # Add |null for optional fields
        if is_optional:
            field_type = f"{field_type}|null"

        fields.append(f"{field_name}:{field_type}")

    return f"object{{{','.join(fields)}}}"


def _extract_simple_payload_schema(model: type[BaseModel]) -> dict[str, str]:
    """Extract simple type strings from Pydantic model fields.

    Optional fields are marked with a '?' prefix in the type string.
    """
    schema: dict[str, str] = {}
    for field_name, field_info in model.model_fields.items():
        annotation = field_info.annotation
        is_optional = False

        # Check if field is required using Pydantic's is_required() method
        # A field is optional if it's not required (has a default or is Optional)
        is_required = field_info.is_required()

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
                    # If it's a Union and one of the args is None, it's optional
                    if type(None) in args:
                        is_optional = True
                        non_none_args = [
                            a for a in args if a is not type(None) and a is not None
                        ]
                        if non_none_args:
                            annotation = non_none_args[0]  # type: ignore[assignment]

        # Mark as optional if field is not required (has a default value)
        if not is_required and not is_optional:
            is_optional = True

        # Handle dict types (dict[str, T], Dict[str, T], etc.)
        if annotation is not None:
            origin = get_origin(annotation)
            # Check for dict type (dict, Dict, collections.abc.Mapping)
            is_dict = (
                origin is dict
                or (
                    origin is not None
                    and hasattr(origin, "__name__")
                    and origin.__name__ in ("dict", "Dict", "Mapping")
                )
                or str(origin) in ("typing.Dict", "dict", "collections.abc.Mapping")
            )
            if is_dict:
                args = get_args(annotation)
                if args and len(args) >= 2:
                    # args[0] is key type, args[1] is value type
                    value_type = args[1]

                    # Handle nested dict (dict[str, dict[str, T]])
                    value_origin = (
                        get_origin(value_type) if value_type is not None else None
                    )
                    is_nested_dict = (
                        value_origin is dict
                        or (
                            value_origin is not None
                            and hasattr(value_origin, "__name__")
                            and value_origin.__name__ in ("dict", "Dict", "Mapping")
                        )
                        or (
                            value_origin is not None
                            and str(value_origin)
                            in ("typing.Dict", "dict", "collections.abc.Mapping")
                        )
                    )

                    if is_nested_dict:
                        # Extract nested dict value type
                        nested_args = get_args(value_type)
                        if nested_args and len(nested_args) >= 2:
                            nested_value_type = nested_args[1]
                            # Handle Optional in nested value
                            nested_value_origin = (
                                get_origin(nested_value_type)
                                if nested_value_type is not None
                                else None
                            )
                            is_nested_optional = False
                            if nested_value_origin is not None:
                                is_nested_union = (
                                    nested_value_origin is Union
                                    or str(nested_value_origin)
                                    in ("typing.Union", "types.UnionType")
                                    or (
                                        hasattr(nested_value_origin, "__name__")
                                        and nested_value_origin.__name__ == "UnionType"
                                    )
                                )
                                if is_nested_union:
                                    nested_union_args = get_args(nested_value_type)
                                    if type(None) in nested_union_args:
                                        is_nested_optional = True
                                        nested_non_none_args = [
                                            a
                                            for a in nested_union_args
                                            if a is not type(None)
                                        ]
                                        if nested_non_none_args:
                                            nested_value_type = nested_non_none_args[0]

                            # Build inline object type for nested dict value
                            # Check if nested value type is a Pydantic model
                            if isinstance(nested_value_type, type) and issubclass(
                                nested_value_type, BaseModel
                            ):
                                # Extract nested model schema (already includes object{...})
                                nested_schema = _extract_nested_model_schema(
                                    nested_value_type
                                )
                                # For dict[str, dict[str, Model]], use Record pattern
                                schema[field_name] = f"object{{string:{nested_schema}}}"
                            elif nested_value_type is str or (
                                nested_value_type is not None
                                and hasattr(nested_value_type, "__name__")
                                and nested_value_type.__name__ == "str"
                            ):
                                # dict[str, dict[str, str | None]] -> represent as object with optional string values
                                value_type_str = (
                                    "string|null" if is_nested_optional else "string"
                                )
                                schema[field_name] = (
                                    f"object{{string:{value_type_str}}}"
                                )
                            else:
                                schema[field_name] = "object"  # Fallback
                        else:
                            schema[field_name] = "object"  # Fallback
                    # Check if value type is a Pydantic model
                    elif isinstance(value_type, type) and issubclass(
                        value_type, BaseModel
                    ):
                        # Extract nested model schema (already includes object{...})
                        nested_schema = _extract_nested_model_schema(value_type)
                        # For dict[str, Model], use Record pattern: object{string:ModelSchema}
                        # This tells TypeScript generator to create Record<string, ModelType>
                        schema[field_name] = f"object{{string:{nested_schema}}}"
                    # Handle Optional value types (dict[str, str | None])
                    else:
                        # Check if value_type is Optional
                        value_origin = (
                            get_origin(value_type) if value_type is not None else None
                        )
                        is_value_optional = False
                        actual_value_type = value_type
                        if value_origin is not None:
                            is_value_union = (
                                value_origin is Union
                                or str(value_origin)
                                in ("typing.Union", "types.UnionType")
                                or (
                                    hasattr(value_origin, "__name__")
                                    and value_origin.__name__ == "UnionType"
                                )
                            )
                            if is_value_union:
                                value_union_args = get_args(value_type)
                                if type(None) in value_union_args:
                                    is_value_optional = True
                                    non_none_args = [
                                        a
                                        for a in value_union_args
                                        if a is not type(None)
                                    ]
                                    if non_none_args:
                                        actual_value_type = non_none_args[0]

                        # Handle primitive value types with Optional support
                        if actual_value_type is str or (
                            actual_value_type is not None
                            and hasattr(actual_value_type, "__name__")
                            and actual_value_type.__name__ == "str"
                        ):
                            value_type_str = (
                                "string|null" if is_value_optional else "string"
                            )
                            schema[field_name] = f"object{{string:{value_type_str}}}"
                        elif actual_value_type in (int, float) or (
                            actual_value_type is not None
                            and hasattr(actual_value_type, "__name__")
                            and actual_value_type.__name__ in ("int", "float")
                        ):
                            value_type_str = (
                                "number|null" if is_value_optional else "number"
                            )
                            schema[field_name] = f"object{{string:{value_type_str}}}"
                        elif actual_value_type is bool or (
                            actual_value_type is not None
                            and hasattr(actual_value_type, "__name__")
                            and actual_value_type.__name__ == "bool"
                        ):
                            value_type_str = (
                                "boolean|null" if is_value_optional else "boolean"
                            )
                            schema[field_name] = f"object{{string:{value_type_str}}}"
                        else:
                            schema[field_name] = "object"  # Default
                else:
                    schema[field_name] = "object"  # Default for dict without type args
                continue

        # Handle list types (list[str], List[str], etc.)
        if annotation is not None:
            origin = get_origin(annotation)

            # Check if annotation itself is untyped list (for Python 3.9+)
            # Only treat as untyped if it's literally `list` without type args
            if annotation is list:
                # Untyped list, treat as string[]
                type_str = "string[]"
                if is_optional:
                    type_str = f"?{type_str}"
                schema[field_name] = type_str
                continue
            # Check for list type (list, List, collections.abc.Sequence, etc.)
            # get_origin(list[T]) returns the list class itself
            is_list = (
                origin is list
                or (origin is not None and origin == list)
                or (origin is not None and str(origin) == "<class 'list'>")
                or (
                    origin is not None
                    and hasattr(origin, "__name__")
                    and origin.__name__ == "list"
                )
            )
            if is_list:
                args = get_args(annotation)
                if args:
                    element_type = args[0]
                    # Check if element type is a Pydantic model (nested object)
                    # Try multiple ways to detect BaseModel subclass
                    is_pydantic_model = False
                    if isinstance(element_type, type):
                        try:
                            is_pydantic_model = issubclass(element_type, BaseModel)
                        except TypeError:
                            # element_type might be a string forward reference or other non-type
                            pass

                    if is_pydantic_model:
                        # Extract nested model schema and create inline object type
                        nested_schema = _extract_nested_model_schema(element_type)
                        type_str = f"{nested_schema}[]"
                        # Prefix with '?' if field is optional
                        if is_optional:
                            type_str = f"?{type_str}"
                        schema[field_name] = type_str
                        continue
                    # Determine the element type string for primitives
                    elif element_type is str or (
                        hasattr(element_type, "__name__")
                        and element_type.__name__ == "str"
                    ):
                        type_str = "string[]"
                    elif element_type in (int, float) or (
                        hasattr(element_type, "__name__")
                        and element_type.__name__ in ("int", "float")
                    ):
                        type_str = "number[]"
                    elif element_type is bool or (
                        hasattr(element_type, "__name__")
                        and element_type.__name__ == "bool"
                    ):
                        type_str = "boolean[]"
                    else:
                        type_str = "string[]"  # Default to string[]

                    # Prefix with '?' if field is optional
                    if is_optional:
                        type_str = f"?{type_str}"
                    schema[field_name] = type_str
                    continue
                else:
                    type_str = "string[]"  # Default to string[] if no args
                    if is_optional:
                        type_str = f"?{type_str}"
                    schema[field_name] = type_str
                    continue

        # Map to simple type strings
        type_str = ""
        if annotation is str or "str" in str(annotation):
            type_str = "string"
        elif (
            annotation in (int, float)
            or "int" in str(annotation)
            or "float" in str(annotation)
        ):
            type_str = "number"
        elif annotation is bool or "bool" in str(annotation):
            type_str = "boolean"
        else:
            type_str = "string"  # Default to string

        # Prefix with '?' if field is optional
        if is_optional:
            type_str = f"?{type_str}"

        schema[field_name] = type_str
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
