# app/main.py
import contextlib
import logging
import os
import platform
import sys
from pathlib import Path

# actual resampling
import librosa  # ← NEW
import numpy as np
import onnxruntime as ort  # type: ignore
# only for IO
import soundfile as sf  # type: ignore
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from faster_whisper import WhisperModel  # type: ignore
from kokoro_onnx import Kokoro  # type: ignore

IN_DOCKER = os.getenv("DOCKER_ENV") == "1"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BASE_FOLDER = Path("/app") if IN_DOCKER else PROJECT_ROOT

MODEL_CACHE_DIR = BASE_FOLDER / "cache"
MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger(__name__)

load_dotenv()

# --------------------------------------------------------------------- lifespan

# Detect available providers for ONNX Runtime
available_providers = ort.get_available_providers()
logger.info(f"Available ONNX providers: {available_providers}")

# Use CUDA if available, otherwise CPU
use_cuda = "CUDAExecutionProvider" in available_providers
device = "cuda" if use_cuda else "cpu"
logger.info(f"Using device: {device}")

# Whisper settings based on device
compute_type = "int8" if device == "cpu" else "float16"

whisper_model: WhisperModel | None = None
kokoro_model: Kokoro | None = None

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """Load heavy models once, reuse for the whole process."""
    global whisper_model, kokoro_model

    # Load Whisper model (should be pre-downloaded)
    whisper_model = WhisperModel(
        "tiny",
        device=device,
        compute_type=compute_type,
        download_root=str(MODEL_CACHE_DIR)
    )

    logger.info("Loading Kokoro ONNX model...")
    
    # Define model paths
    kokoro_model_path = MODEL_CACHE_DIR / "kokoro-v1.0.onnx"
    voices_path = MODEL_CACHE_DIR / "voices-v1.0.bin"
    
    # Download models if they don't exist
    if not kokoro_model_path.exists() or not voices_path.exists():
        logger.info("Downloading Kokoro model files...")
        import urllib.request
        
        if not kokoro_model_path.exists():
            urllib.request.urlretrieve(
                "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx",
                kokoro_model_path
            )
        
        if not voices_path.exists():
            urllib.request.urlretrieve(
                "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin",
                voices_path
            )
    
    # Initialize Kokoro model
    kokoro_model = Kokoro(str(kokoro_model_path), str(voices_path))
    logger.info("Kokoro ONNX model loaded successfully")

    yield                           # ---- application runs here ----

    # Optional clean-up
    whisper_model = None
    kokoro_model = None

app = FastAPI(title="GLOW-Model API", lifespan=lifespan)


@app.post("/stt")
async def stt(file: UploadFile):
    audio = np.frombuffer(await file.read(), np.int16).astype(np.float32) / 32767
    if whisper_model is None:
        raise HTTPException(status_code=500, detail="Whisper model not initialized")
    txt = whisper_model.transcribe(audio, language="en")["text"].strip()
    return JSONResponse({"text": txt})

@app.post("/tts")
async def tts(payload: dict):
    """Streaming TTS endpoint that yields audio chunks as they're generated"""
    voice = payload.get("voice", "af_bella")
    text = payload["text"]
    speed = payload.get("speed", 1.0)
    lang = payload.get("lang", "en-us")
    
    if kokoro_model is None:
        raise HTTPException(status_code=500, detail="Kokoro model not initialized")
    
    async def _async_stream():
        try:
            # Create streaming generator
            stream = kokoro_model.create_stream(
                text,
                voice=voice,
                speed=speed,
                lang=lang
            )
            
            async for samples, sample_rate in stream:
                # Convert to the expected format and sample rate
                if sample_rate != 48000:
                    # Resample to 48kHz if needed
                    samples_48k = librosa.resample(samples, orig_sr=sample_rate, target_sr=48000)
                else:
                    samples_48k = samples
                
                # Convert to int16 and yield
                audio_int16 = (np.clip(samples_48k, -1, 1) * 32767).astype(np.int16)
                yield audio_int16.tobytes()
                
        except Exception as e:
            logger.error(f"Streaming TTS generation failed: {e}")
            raise HTTPException(status_code=500, detail=f"Streaming TTS generation failed: {e}")
    
    headers = {"Content-Type": "audio/L16; rate=48000; channels=1"}
    return StreamingResponse(_async_stream(), headers=headers)

# --------------------------------------------------------------------- misc routes

@app.get("/")
async def root_info():
    """Tiny landing page identical to the main server's `/`."""
    info = {
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "platform_release": platform.release(),
        "onnx_providers": available_providers,
        "using_cuda": use_cuda
    }
    return JSONResponse({"server_info": info})


@app.get("/health")
async def health_check():
    return JSONResponse({"status": "ok"})