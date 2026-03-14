"""Persona WebSocket events.

Input:  persona.get, persona.create, persona.update, persona.delete,
        persona.duplicate, persona.draft, persona.search, persona.drafts,
        persona.docs, persona.export

Output: persona.{op}.started, persona.{op}.progress,
        persona.{op}.completed, persona.{op}.failed
"""

from . import input, output  # noqa: F401
