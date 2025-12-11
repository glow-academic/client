#!/usr/bin/env python3
"""Script to generate WebSocket contract."""
import asyncio
import sys
from pathlib import Path

# Add server directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import fastapi_app, lifespan


async def main():
    """Generate WebSocket contract."""
    async with lifespan(fastapi_app):
        pass


if __name__ == "__main__":
    asyncio.run(main())
