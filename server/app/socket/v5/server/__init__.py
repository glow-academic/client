"""Server layer — the single gateway for ALL client-bound communication.

Every `sio.emit` in v5 lives here. Internal and client layers emit to the
internal bus; server handlers translate internal events into client events.
"""

from . import attempt, generate  # noqa: F401 — registers handlers on import
