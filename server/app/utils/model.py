import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

_MODEL_URL = os.getenv("INTERNAL_MODELS_BASE")

async def _post(path: str, **kw: Any) -> httpx.Response:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{_MODEL_URL}{path}", **kw)
        resp.raise_for_status()
        return resp

async def remote_stt(buf: bytes) -> str:
    resp = await _post("/stt", files={"file": ("audio.wav", buf, "audio/wav")})
    return str(resp.json()["text"])

async def remote_tts(text: str, voice: str = "af_bella") -> bytes:
    resp = await _post("/tts", json={"text": text, "voice": voice})
    return resp.content
