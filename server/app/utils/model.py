import io
import os
from typing import Any

import httpx
import numpy as np
import soundfile as sf  # type: ignore
from dotenv import load_dotenv

load_dotenv()

_MODEL_URL = os.getenv("INTERNAL_MODELS_BASE")

print("Model URL: ", _MODEL_URL)

async def _post(path: str, **kw: Any) -> httpx.Response:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{_MODEL_URL}{path}", **kw)
        resp.raise_for_status()
        return resp
    

def pcm_to_wav_bytes(pcm: bytes, sr: int = 48_000) -> io.BytesIO:
    buf = io.BytesIO()
    sf.write(buf, np.frombuffer(pcm, np.int16), sr, format="WAV",
             subtype="PCM_16")
    buf.seek(0)
    return buf

async def remote_stt(buf: bytes) -> str:
    resp = await _post("/stt", files={"file": ("audio.wav", pcm_to_wav_bytes(buf), "audio/wav")})
    return str(resp.json()["text"])

async def remote_tts(text: str, voice: str = "af_bella") -> bytes:
    resp = await _post("/tts", json={"text": text, "voice": voice})
    return resp.content
