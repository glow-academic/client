import abc
import logging
import os
import uuid
from typing import Any, AsyncGenerator, AsyncIterator

import litellm
import numpy as np
from agents.voice.input import AudioInput, StreamedAudioInput
from agents.voice.model import (StreamedTranscriptionSession, STTModel,
                                STTModelSettings, TTSModel, TTSModelSettings)
from agents.voice.pipeline import VoicePipeline
from agents.voice.pipeline_config import VoicePipelineConfig
from agents.voice.workflow import VoiceWorkflowBase
from app.config import model_manager
from app.db import get_session
from app.extensions import AUDIO_FOLDER
from app.models import SimulationMessages
from app.services.agents.collection.simulation import run_simulation_agent
from app.utils.audio import Modalities

logger = logging.getLogger(__name__)
from sqlmodel import Session

from dotenv import load_dotenv
load_dotenv()


class SimulationSTTModel(STTModel):
    def __init__(self, generate_text: bool = True, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.generate_text = generate_text

    @property
    def model_name(self) -> str:
        """The name of the STT model."""
        return "simulation-whisper"

    async def transcribe(
        self,
        input: AudioInput,
        settings: STTModelSettings,
        trace_include_sensitive_data: bool,
        trace_include_sensitive_audio_data: bool,
    ) -> str:
        """Given an audio input, produces a text transcription."""
        if not self.generate_text:
            # Return empty string for dummy STT
            return ""
        
        try:
            # Convert AudioInput buffer to numpy array for Whisper
            audio_np = input.buffer
            if audio_np.dtype == np.float32:
                # Whisper expects float32 in range [-1, 1]
                audio_np = np.clip(audio_np, -1.0, 1.0)
            elif audio_np.dtype == np.int16:
                # Convert int16 to float32
                audio_np = audio_np.astype(np.float32) / 32767.0
            
            # Use Whisper model for transcription
            whisper_model = model_manager.get_whisper_model()
            result = whisper_model.transcribe(audio_np, language="en")
            transcribed_text = str(result["text"]).strip()
            
            logger.info(f"STT transcribed: {transcribed_text}")
            return transcribed_text
            
        except Exception as e:
            logger.error(f"STT transcription failed: {e}")
            return ""

    async def create_session(
        self,
        input: StreamedAudioInput,
        settings: STTModelSettings,
        trace_include_sensitive_data: bool,
        trace_include_sensitive_audio_data: bool,
    ) -> StreamedTranscriptionSession:
        """Creates a new transcription session for streaming audio."""
        # For now, return a dummy session - this would need proper implementation for streaming
        raise NotImplementedError("Streaming STT not yet implemented")


class SimulationTTSModel(TTSModel):
    def __init__(self, generate_audio: bool = True, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.generate_audio = generate_audio

    @property
    def model_name(self) -> str:
        """The name of the TTS model."""
        return "simulation-gemini-tts"

    async def run(self, text: str, settings: TTSModelSettings) -> AsyncIterator[bytes]:
        """Given a text string, produces a stream of audio bytes, in PCM format."""
        if not self.generate_audio:
            # Return empty bytes for dummy TTS
            yield b""
            return
        
        try:
            logger.info(f"TTS generating audio for text: {text[:50]}...")
            
            # Use LiteLLM with Gemini TTS
            response = await litellm.aspeech(
                model="gemini/gemini-2.5-flash-preview-tts",
                input=text,
                api_key=os.getenv("GEMINI_API_KEY"),
                voice="Orus"  # Default voice
            )
            
            # Stream the audio response
            # Note: LiteLLM may return the full audio at once, so we'll chunk it
            audio_data = response.content if hasattr(response, 'content') else b""
            
            # Chunk the audio data for streaming (16KB chunks)
            chunk_size = 16384
            for i in range(0, len(audio_data), chunk_size):
                chunk = audio_data[i:i + chunk_size]
                if chunk:
                    yield chunk
                    
            logger.info(f"TTS completed for text length: {len(text)}")
            
        except Exception as e:
            logger.error(f"TTS generation failed: {e}")
            yield b""


class SimulationWorkflow(VoiceWorkflowBase):
    def __init__(self, chat_id: uuid.UUID, session: Session, original_message: str = "", *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.chat_id = chat_id
        self.session = session
        self.original_message = original_message
    
    async def run(self, transcription: str) -> AsyncIterator[str]:
        """
        Run the voice workflow. Receives transcription and yields text for TTS.
        """
        try:
            # Use transcription if available, otherwise fall back to original message
            message_text = transcription.strip() if transcription.strip() else self.original_message
            
            # Insert the user message into the chat
            user_message = SimulationMessages(
                chat_id=self.chat_id,
                type="query",
                content=message_text,
                completed=True,
                audio=bool(transcription.strip())  # Audio if we got transcription
            )
            self.session.add(user_message)
            self.session.commit()
            self.session.refresh(user_message)
            
            logger.info(f"Created user message {user_message.id} for chat {self.chat_id}")

            # Stream the assistant response using the existing simulation agent
            async for text_chunk in run_simulation_agent(self.chat_id, self.session):
                yield text_chunk
                
        except Exception as e:
            logger.error(f"Simulation workflow failed: {e}")
            yield f"I apologize, but I encountered an error: {str(e)}"


class SimulationPipeline:
    def __init__(self, chat_id: uuid.UUID, mode: Modalities, session: Session, original_message: str = "") -> None:
        """
        Args:
            chat_id: The ID of the chat session.
            mode: The modality of the pipeline.
            session: The database session.
            original_message: Original text message (for TEXT_AUDIO mode).
        """
        self.mode = mode
        self.chat_id = chat_id
        self.session = session
        self.original_message = original_message
    
    def get_pipeline(self, config: VoicePipelineConfig | None = None) -> VoicePipeline:
        """Get the appropriate voice pipeline based on modality."""
        if config is None:
            config = VoicePipelineConfig()
            
        workflow = SimulationWorkflow(self.chat_id, self.session, self.original_message)
        
        if self.mode == Modalities.AUDIO_AUDIO:
            return VoicePipeline(
                workflow=workflow,
                stt_model=SimulationSTTModel(generate_text=True),
                tts_model=SimulationTTSModel(generate_audio=True),
                config=config,
            )
        elif self.mode == Modalities.AUDIO_TEXT:
            return VoicePipeline(
                workflow=workflow,
                stt_model=SimulationSTTModel(generate_text=True),
                tts_model=SimulationTTSModel(generate_audio=False),
                config=config,
            )
        elif self.mode == Modalities.TEXT_AUDIO:
            return VoicePipeline(
                workflow=workflow,
                stt_model=SimulationSTTModel(generate_text=False),
                tts_model=SimulationTTSModel(generate_audio=True),
                config=config,
            )
        else:
            raise ValueError(f"Invalid modality for pipeline: {self.mode}")

    async def process_and_stream(
        self, 
        audio_data: bytes | None = None,
        profile_id: str | None = None
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Process audio/text through the pipeline and stream results via WebSocket.
        """
        try:
            pipeline = self.get_pipeline()
            
            # Create appropriate input based on modality
            if self.mode in [Modalities.AUDIO_AUDIO, Modalities.AUDIO_TEXT]:
                if not audio_data:
                    audio_data = b""  # Empty bytes for dummy audio
                
                # Convert bytes to numpy array for AudioInput
                audio_np = np.frombuffer(audio_data, dtype=np.int16)
                if len(audio_np) == 0:
                    audio_np = np.zeros(1000, dtype=np.int16)  # Dummy audio
                    
                audio_input = AudioInput(buffer=audio_np)
            else:
                # For TEXT_AUDIO, create dummy audio input
                audio_np = np.zeros(1000, dtype=np.int16)
                audio_input = AudioInput(buffer=audio_np)
            
            # Save user audio file if we have real audio data
            user_message_id = None
            if self.mode in [Modalities.AUDIO_AUDIO, Modalities.AUDIO_TEXT] and audio_data and len(audio_data) > 0:
                user_message_id = str(uuid.uuid4())  # Temporary ID, will be updated by workflow
                user_audio_path: str | None = os.path.join(AUDIO_FOLDER, f"{user_message_id}.wav")
                try:
                    if user_audio_path is None:
                        raise ValueError("User audio path is None")
                    
                    with open(user_audio_path, "wb") as f:
                        f.write(audio_data)
                    logger.info(f"Saved user audio to {user_audio_path}")
                except Exception as e:
                    logger.error(f"Failed to save user audio: {e}")
                    user_audio_path = None
            
            # Run the pipeline
            result = await pipeline.run(audio_input)
            
            # Get socket instance for WebSocket emissions
            from app.web.simulations import get_sio_instance
            sio_instance = get_sio_instance()
            
            # Create assistant message placeholder
            assistant_message = SimulationMessages(
                chat_id=self.chat_id,
                type="response",
                content="",
                completed=False,
                audio=self.mode in [Modalities.AUDIO_AUDIO, Modalities.TEXT_AUDIO]
            )
            self.session.add(assistant_message)
            self.session.commit()
            self.session.refresh(assistant_message)
            
            # Emit assistant message placeholder
            await sio_instance.emit(
                "simulation_new_message",
                {
                    "message_id": str(assistant_message.id),
                    "chat_id": str(self.chat_id),
                    "role": "assistant",
                    "content": "",
                    "completed": False,
                    "audio": assistant_message.audio,
                    "created_at": assistant_message.created_at.isoformat(),
                },
                room=f"simulation_{self.chat_id}",
            )
            
            accumulated_content = ""
            assistant_audio_chunks = []
            
            # Stream the results
            async for event in result.stream():
                if hasattr(event, 'data') and hasattr(event.data, 'decode'):
                    # Text event
                    text_chunk = event.data.decode() if isinstance(event.data, bytes) else str(event.data)
                    accumulated_content += text_chunk
                    
                    # Update database
                    assistant_message.content = accumulated_content
                    self.session.add(assistant_message)
                    self.session.commit()
                    
                    # Emit text token
                    await sio_instance.emit(
                        "simulation_message_token",
                        {
                            "message_id": str(assistant_message.id),
                            "chat_id": str(self.chat_id),
                            "token": text_chunk,
                            "accumulated_content": accumulated_content,
                        },
                        room=f"simulation_{self.chat_id}",
                    )
                    
                    yield {"type": "text", "data": text_chunk}
                    
                elif hasattr(event, 'data') and isinstance(event.data, (bytes, np.ndarray)):
                    # Audio event
                    audio_chunk = event.data
                    if isinstance(audio_chunk, np.ndarray):
                        audio_chunk = audio_chunk.tobytes()
                    
                    assistant_audio_chunks.append(audio_chunk)
                    
                    # Stream audio via WebSocket (for fallback) or WebRTC
                    yield {"type": "audio", "data": audio_chunk}
            
            # Save assistant audio file if we generated audio
            if assistant_audio_chunks and self.mode in [Modalities.AUDIO_AUDIO, Modalities.TEXT_AUDIO]:
                assistant_audio_path = os.path.join(AUDIO_FOLDER, f"{assistant_message.id}.wav")
                try:
                    full_audio = b"".join(assistant_audio_chunks)
                    with open(assistant_audio_path, "wb") as f:
                        f.write(full_audio)
                    assistant_message.file_path = assistant_audio_path
                    logger.info(f"Saved assistant audio to {assistant_audio_path}")
                except Exception as e:
                    logger.error(f"Failed to save assistant audio: {e}")
                    # Keep audio=True but file_path=None to show mismatch in frontend
            
            # Mark as completed
            assistant_message.completed = True
            self.session.add(assistant_message)
            self.session.commit()
            
            # Emit completion
            await sio_instance.emit(
                "simulation_message_complete",
                {
                    "message_id": str(assistant_message.id),
                    "chat_id": str(self.chat_id),
                    "final_content": accumulated_content,
                    "audio": assistant_message.audio,
                },
                room=f"simulation_{self.chat_id}",
            )
            
            yield {"type": "complete", "data": "finished"}
            
        except Exception as e:
            logger.error(f"Pipeline processing failed: {e}")
            # Emit error
            from app.web.simulations import get_sio_instance
            sio_instance = get_sio_instance()
            await sio_instance.emit(
                "simulation_message_error",
                {"chat_id": str(self.chat_id), "error": str(e)},
                room=f"simulation_{self.chat_id}",
            )
            yield {"type": "error", "data": str(e)}