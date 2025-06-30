# config.py
import gc
import logging
import os
import threading
import time
from typing import Any

import torch
import whisper  # type: ignore
from app.extensions import MODEL_CACHE_DIR

# Get logger
logger = logging.getLogger(__name__)

# Global model registry - single source of truth
MODEL_REGISTRY: dict[str, Any] = {
    "whisper_model": None, 
    "whisper_initialized": False,
    "kokoro_pipeline": None,
    "kokoro_initialized": False
}

# Add a lock for thread safety
MODEL_LOCK = threading.RLock()


class ModelManager:
    def __init__(self) -> None:
        # Whisper model settings
        self.cache_dir = str(MODEL_CACHE_DIR)
        self.whisper_cache_dir = os.path.join(self.cache_dir, "whisper_models")
        # Convert string paths to Path objects if MODEL_CACHE_DIR is a Path
        if (
            hasattr(MODEL_CACHE_DIR, "__class__")
            and MODEL_CACHE_DIR.__class__.__name__ == "Path"
        ):
            self.cache_dir = str(MODEL_CACHE_DIR)
            self.whisper_cache_dir = str(MODEL_CACHE_DIR / "whisper_models")

        # Create cache directories if they don't exist
        os.makedirs(self.cache_dir, exist_ok=True)
        os.makedirs(self.whisper_cache_dir, exist_ok=True)

        # Whisper configuration - default to tiny.en model
        self.whisper_model_size = "tiny.en"
        
        # Kokoro configuration
        self.kokoro_lang_code = 'a'  # American English
        self.kokoro_voices = ['af_bella', 'am_michael']  # Available voices

    def _get_gpu_memory(self) -> float:
        """Get available GPU memory in GB"""
        try:
            # Use the global torch module
            if not torch.cuda.is_available():
                return 0

            free_memory = torch.cuda.get_device_properties(
                0
            ).total_memory - torch.cuda.memory_allocated(0)
            return free_memory / 1024**3  # Convert to GB
        except Exception as e:
            logger.error(f"Error getting GPU memory: {e}")
            return 0

    def initialize_whisper_model(self) -> whisper.Whisper:
        """Initialize a single Whisper model"""
        global MODEL_REGISTRY

        # Use lock for thread safety
        with MODEL_LOCK:
            # If model is already loaded in registry, return it
            if MODEL_REGISTRY["whisper_initialized"]:
                logger.info("Using already initialized Whisper model")
                return MODEL_REGISTRY["whisper_model"]

            has_gpu = torch.cuda.is_available()
            device = "cuda" if has_gpu else "cpu"

            # Import whisper here to avoid loading it unnecessarily
            import whisper  # type: ignore

            logger.info(
                f"Initializing Whisper {self.whisper_model_size} model on {device}..."
            )
            start_time = time.time()

            # Force garbage collection before loading model
            gc.collect()
            if has_gpu:
                torch.cuda.empty_cache()
                available_memory = self._get_gpu_memory()
                logger.info(f"Available GPU memory: {available_memory:.2f} GB")

            # Load the model
            whisper_model = whisper.load_model(
                self.whisper_model_size, download_root=self.whisper_cache_dir
            ).to(device)

            # Set model to evaluation mode
            whisper_model.eval()

            load_time = time.time() - start_time
            logger.info(f"Whisper model loaded in {load_time:.2f} seconds")

            # Store in global registry
            MODEL_REGISTRY["whisper_model"] = whisper_model
            MODEL_REGISTRY["whisper_initialized"] = True

            return whisper_model

    def get_whisper_model(self) -> whisper.Whisper:
        """Get the global Whisper model instance"""
        with MODEL_LOCK:
            if not MODEL_REGISTRY["whisper_initialized"]:
                return self.initialize_whisper_model()

            model = MODEL_REGISTRY["whisper_model"]
            if not model:
                raise RuntimeError("No Whisper model available")

            # Ensure model is in eval mode
            model.eval()

            # Check if model is on the expected device
            device = "cuda" if torch.cuda.is_available() else "cpu"
            if next(model.parameters()).device.type != device:
                logger.warning(
                    f"Model was on {next(model.parameters()).device.type}, moving to {device}"
                )
                model = model.to(device)
                MODEL_REGISTRY["whisper_model"] = model

            return model

    def initialize_kokoro_pipeline(self) -> Any:
        """Initialize Kokoro TTS pipeline"""
        global MODEL_REGISTRY
        
        # Use lock for thread safety
        with MODEL_LOCK:
            # If pipeline is already loaded in registry, return it
            if MODEL_REGISTRY["kokoro_initialized"]:
                logger.info("Using already initialized Kokoro pipeline")
                return MODEL_REGISTRY["kokoro_pipeline"]
            
            try:
                # Import Kokoro here to avoid loading it unnecessarily
                from kokoro import KPipeline  # type: ignore
                
                logger.info(f"Initializing Kokoro TTS pipeline with language code '{self.kokoro_lang_code}'...")
                start_time = time.time()
                
                # Force garbage collection before loading model
                gc.collect()
                
                # Initialize the Kokoro pipeline - this will download models on first run
                kokoro_pipeline = KPipeline(lang_code=self.kokoro_lang_code)
                
                load_time = time.time() - start_time
                logger.info(f"Kokoro pipeline loaded in {load_time:.2f} seconds")
                
                # Store in global registry
                MODEL_REGISTRY["kokoro_pipeline"] = kokoro_pipeline
                MODEL_REGISTRY["kokoro_initialized"] = True
                
                return kokoro_pipeline
                
            except ImportError as e:
                logger.error(f"Kokoro TTS library not available: {e}")
                MODEL_REGISTRY["kokoro_pipeline"] = None
                MODEL_REGISTRY["kokoro_initialized"] = False
                return None
            except Exception as e:
                logger.error(f"Failed to initialize Kokoro pipeline: {e}")
                MODEL_REGISTRY["kokoro_pipeline"] = None
                MODEL_REGISTRY["kokoro_initialized"] = False
                return None

    def get_kokoro_pipeline(self) -> Any:
        """Get the global Kokoro pipeline instance"""
        with MODEL_LOCK:
            if not MODEL_REGISTRY["kokoro_initialized"]:
                return self.initialize_kokoro_pipeline()
            
            pipeline = MODEL_REGISTRY["kokoro_pipeline"]
            if pipeline is None:
                logger.warning("No Kokoro pipeline available")
                return None
            
            return pipeline

    def is_kokoro_available(self) -> bool:
        """Check if Kokoro TTS is available"""
        try:
            import kokoro
            return True
        except ImportError:
            return False


# Initialize model manager
model_manager = ModelManager()
