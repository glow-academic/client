"""Generate RESOURCE_MODALITIES from convention + exceptions."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.registry.manual import MODALITY_EXCEPTIONS


def generate_resource_modalities(resource_keys: list[str]) -> dict[str, list[str]]:
    """Generate RESOURCE_MODALITIES — convention-based defaults + exceptions.

    All resources default to {"call"}, except those in MODALITY_EXCEPTIONS
    which get an additional modality (e.g. documents → {"call", "document"}).

    Only resources listed in resource_keys are included.
    """
    result: dict[str, list[str]] = {}
    for key in sorted(resource_keys):
        modalities = ["call"]
        if key in MODALITY_EXCEPTIONS:
            modalities.append(MODALITY_EXCEPTIONS[key])
        result[key] = sorted(modalities)

    return result
