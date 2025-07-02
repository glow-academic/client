import abc
import asyncio
import logging
import os
import random
import uuid
import wave
from typing import Any, AsyncGenerator, AsyncIterator, Callable, Dict

import librosa
import litellm
import numpy as np
import torch
from agents import trace
from agents.voice.input import AudioInput, StreamedAudioInput
from agents.voice.model import (StreamedTranscriptionSession, STTModel,
                                STTModelSettings, TTSModel, TTSModelSettings)
from agents.voice.pipeline import VoicePipeline
from agents.voice.pipeline_config import VoicePipelineConfig
from agents.voice.utils import get_sentence_based_splitter
from agents.voice.workflow import VoiceWorkflowBase
from app.config import model_manager
from app.db import get_session
from app.extensions import AUDIO_FOLDER
from app.models import (Agents, Models, Providers, Scenarios, SimulationChats,
                        SimulationMessages)
from app.services.agents.collection.simulation import run_simulation_agent
from app.utils.audio import Modalities

# Removed custom logger import - using standard logging

logger = logging.getLogger(__name__)
from sqlmodel import Session, select

# Note: Server audio tracks are now passed directly to avoid global state dependencies

# Kokoro TTS will be loaded through model_manager


class SimulationSTTModel(STTModel):
    def __init__(self, chat_id: uuid.UUID, session: Session, model_id: uuid.UUID | None = None, generate_text: bool = True, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.generate_text = generate_text
        self.chat_id = chat_id
        self.model_id = model_id
        self.session = session
        
        if model_id is None:
            self.name = "whisper" # using open source model
            self.description = "whisper"
            return
        
        # get the model
        model = self.session.exec(select(Models).where(Models.id == model_id)).one()
        if not model:
            raise ValueError(f"Model not found: {model_id}")
        
        # get the provider
        provider = self.session.exec(select(Providers).where(Providers.id == model.provider_id)).one()
        if not provider:
            raise ValueError(f"Provider not found for model {model.id}")

        self.name = f"{provider.name}/{model.name}"
        self.description = model.description
        
                
    @property
    def model_name(self) -> str:
        """The name of the STT model."""
        return self.description

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
            if self.model_id is None:
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
            else:
                # Use LiteLLM with transcribe endpoint
                response = await litellm.atranscription(
                    model=self.name,
                    file=input.buffer,
                    prompt=settings.prompt,
                )
                return str(response.text)
        
            
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
    def __init__(self, chat_id: uuid.UUID, session: Session, model_id: uuid.UUID | None = None,  generate_audio: bool = True, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.generate_audio = generate_audio
        self.chat_id = chat_id
        self.session = session
        self.model_id = model_id

        if model_id is None:
            self.name = "kokoro" # using open source model
            self.description = "kokoro"
            return
        
        # get the model
        model = self.session.exec(select(Models).where(Models.id == model_id)).one()
        if not model:
            raise ValueError(f"Model not found: {model_id}")
        
        # get the provider
        provider = self.session.exec(select(Providers).where(Providers.id == model.provider_id)).one()
        if not provider:
            raise ValueError(f"Provider not found for model {model.id}")

        self.name = f"{provider.name}/{model.name}"
        self.description = model.description

    @property
    def model_name(self) -> str:
        """The name of the TTS model."""
        return self.description
    
    async def run(self, text: str, settings: TTSModelSettings) -> AsyncIterator[bytes]:
        """
        Streams audio frames **and**, once streaming is done,
        writes those frames to <AUDIO_FOLDER>/<message_id>.wav
        and updates the row that was just inserted.
        """
        from app.web.simulations import get_sio_instance
        sio_instance = get_sio_instance()
        
        assistant_message = SimulationMessages(
            chat_id=self.chat_id,
            type="response",
            content=text,
            completed=True,  # Mark as completed immediately since we have the full chunk
            audio=self.generate_audio
        )
        self.session.add(assistant_message)
        self.session.commit()
        self.session.refresh(assistant_message)

        await sio_instance.emit(
            "simulation_new_message",
            {
                "message_id": str(assistant_message.id),
                "chat_id": str(self.chat_id),
                "role": "assistant",
                "content": text,
                "completed": True,
                "audio": assistant_message.audio,
                "created_at": assistant_message.created_at.isoformat(),
            },
            room=f"simulation_{self.chat_id}",
        )
        
        if not self.generate_audio:
            return                      # text-only message finishes here

        wav_frames: list[bytes] = []    # <-- buffer we'll flush in finally{}

        try:                            # ↑ collect frames while streaming
            if self.model_id is None:
                # ---- Kokoro path ----
                kokoro_pipeline = model_manager.get_kokoro_pipeline()
                if kokoro_pipeline is None:
                    logger.error("Kokoro TTS not available.")
                    return

                voice = random.choice(model_manager.kokoro_voices)
                logger.info(f"Kokoro voice={voice}  text='{text[:40]}…'")

                for _, _, chunk24 in kokoro_pipeline(text, voice=voice):
                    # Guard against empty chunks
                    if chunk24.size == 0:
                        continue
                        
                    # 1. tensor → float32 numpy in [-1,1]
                    pcm24 = chunk24.cpu().numpy().astype(np.float32)
                    # 2. resample 24 kHz → 48 kHz (high-quality sinc)
                    pcm48 = librosa.resample(pcm24, orig_sr=24_000, target_sr=48_000)
                    # 3. clip & int16
                    int16 = np.rint(np.clip(pcm48, -1, 1) * 32767).astype(np.int16)
                    # 4. slice into 20 ms (960-sample) frames
                    for i in range(0, len(int16), 960):
                        frame = int16[i:i + 960]
                        if len(frame) < 960:                    # pad final partial frame
                            frame = np.pad(frame, (0, 960 - len(frame)))
                        frame_bytes = frame.tobytes()
                        yield frame_bytes
                        wav_frames.append(frame_bytes)

                logger.info(f"TTS completed for text length: {len(text)}")
            else:
                logger.info(f"TTS generating audio for text: {text[:50]}...")
                
                # Use LiteLLM with configured TTS model
                response = await litellm.aspeech(
                    model=self.name,
                    input=text,
                    instructions=settings.instructions,
                )
                
                # Stream the audio response
                # Note: LiteLLM may return the full audio at once, so we'll chunk it
                audio_data = response.content if hasattr(response, 'content') else b""
                
                # For external TTS, assume it's already in the correct format or resample if needed
                # This is a simplified approach - you may need to detect the actual sample rate
                chunk_size = 1920  # 960 samples * 2 bytes per sample for 20ms at 48kHz
                for i in range(0, len(audio_data), chunk_size):
                    tts_chunk = audio_data[i:i + chunk_size]
                    if tts_chunk:
                        yield tts_chunk
                        wav_frames.append(tts_chunk)
                        
                logger.info(f"TTS completed for text length: {len(text)}")
        except Exception as e:
            logger.error(f"TTS generation or resampling failed: {e}", exc_info=True)
            return

        finally:
            # 🔻 write .wav & update row once streaming is done
            if wav_frames:
                path = os.path.join(AUDIO_FOLDER, f"{assistant_message.id}.wav")
                with wave.open(path, "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(48_000)
                    wf.writeframes(b"".join(wav_frames))

                assistant_message.audio = True
                assistant_message.file_path = path
                self.session.add(assistant_message)
                self.session.commit()
                logger.info("Saved assistant audio ➜ %s", path)

class SimulationWorkflow(VoiceWorkflowBase):
    def __init__(self, chat_id: uuid.UUID, session: Session, mode: Modalities, original_message: str = "", profile_id: str | None = None, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.chat_id = chat_id
        self.session = session
        self.original_message = original_message
        self.mode = mode
        self.profile_id = profile_id  # NEW: Store profile_id for data-channel access

    async def run(self, transcription: str) -> AsyncIterator[str]:
        """
        Run the voice workflow. Receives transcription and yields text for TTS.
        """
        from app.web.simulations import get_sio_instance
        sio_instance = get_sio_instance()
        
        try:
            # 1. Process and save the user's message
            message_text = transcription.strip() if transcription.strip() else self.original_message

            if not message_text:
                logger.warning(f"No message text provided for chat {self.chat_id}")
                return
            
            user_message = SimulationMessages(
                chat_id=self.chat_id,
                type="query",
                content=message_text,
                completed=True,
                audio=self.mode == Modalities.AUDIO_AUDIO or self.mode == Modalities.AUDIO_TEXT
            )
            self.session.add(user_message)
            self.session.commit()
            self.session.refresh(user_message)
            
            logger.info(f"Created user message {user_message.id} for chat {self.chat_id}")

            async for token in run_simulation_agent(self.chat_id, self.session):
                yield token
                
        except Exception as e:
            logger.exception("Critical error in SimulationWorkflow")
            # Also yield the error to potentially be caught by the pipeline
            yield f"An error occurred: {str(e)}"


class SimulationPipeline:
    def __init__(self, chat_id: uuid.UUID, mode: Modalities, session: Session, original_message: str = "", profile_id: str | None = None) -> None:
        """
        Args:
            chat_id: The ID of the chat session.
            mode: The modality of the pipeline.
            session: The database session.
            original_message: Original text message (for TEXT_AUDIO mode).
            profile_id: The profile ID for data-channel access.
        """
        self.mode = mode
        self.chat_id = chat_id
        self.session = session
        self.original_message = original_message
        self.profile_id = profile_id

        # Find the chat first
        chat = self.session.exec(select(SimulationChats).where(SimulationChats.id == chat_id)).one()
        if not chat:
            raise ValueError(f"Chat not found for chat_id {chat_id}")

        # Find scenario for the chat
        scenario = self.session.exec(select(Scenarios).where(Scenarios.id == chat.scenario_id)).one()
        if not scenario:
            raise ValueError(f"Scenario not found for chat {chat.id}")
        
        # Find the agent for the scenario
        agent = self.session.exec(select(Agents).where(Agents.id == scenario.agent_id)).one()
        if not agent:
            raise ValueError(f"Agent not found for scenario {scenario.id}")
        
        self.agent_id = agent.id
        self.stt_model_id = agent.stt_model_id
        self.tts_model_id = agent.tts_model_id

    def get_pipeline(self, config: VoicePipelineConfig | None = None) -> VoicePipeline:
        """Get the appropriate voice pipeline based on modality."""
        if config is None:
            # no_split = lambda t: (t, "") # using the default split
            tts_settings = TTSModelSettings(
                instructions="Read exactly what you receive."
            )
            
            # getting stt settings
            stt_settings = STTModelSettings(
                prompt="Transcribe the following audio into text.",
            )
            config = VoicePipelineConfig(tts_settings=tts_settings, stt_settings=stt_settings)
            
        workflow = SimulationWorkflow(self.chat_id, self.session, self.mode, self.original_message, self.profile_id)
        
        if self.mode == Modalities.AUDIO_AUDIO:
            return VoicePipeline(
                workflow=workflow,
                stt_model=SimulationSTTModel(chat_id=self.chat_id, session=self.session, model_id=self.stt_model_id, generate_text=True),
                tts_model=SimulationTTSModel(chat_id=self.chat_id, session=self.session, model_id=self.tts_model_id, generate_audio=True),
                config=config,
            )
        elif self.mode == Modalities.AUDIO_TEXT:
            return VoicePipeline(
                workflow=workflow,
                stt_model=SimulationSTTModel(chat_id=self.chat_id, session=self.session, model_id=self.stt_model_id, generate_text=True),
                tts_model=SimulationTTSModel(chat_id=self.chat_id, session=self.session, model_id=self.tts_model_id, generate_audio=False),
                config=config,
            )
        elif self.mode == Modalities.TEXT_AUDIO:
            return VoicePipeline(
                workflow=workflow,
                stt_model=SimulationSTTModel(chat_id=self.chat_id, session=self.session, model_id=self.stt_model_id, generate_text=False),
                tts_model=SimulationTTSModel(chat_id=self.chat_id, session=self.session, model_id=self.tts_model_id, generate_audio=True),
                config=config,
            )
        else:
            raise ValueError(f"Invalid modality for pipeline: {self.mode}")

    async def process_and_stream(
        self, 
        audio_data: bytes | None = None,
        profile_id: str | None = None,
        server_audio_track: Any | None = None  # Add new parameter
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Processes audio/text through the pipeline. The workflow now handles all
        text-related events. This function's role is to run the pipeline for tracing
        and to handle any real audio output.
        """
        try:
            pipeline = self.get_pipeline()
            
            # Create the audio input for the pipeline
            if self.mode in [Modalities.AUDIO_AUDIO, Modalities.AUDIO_TEXT]:
                audio_np = np.frombuffer(audio_data or b"", dtype=np.int16)
                # Use a tiny silent buffer if audio is empty to prevent errors
                audio_input = AudioInput(buffer=audio_np if audio_np.size > 0 else np.zeros(1, dtype=np.int16))
            else:
                # Dummy audio for text-input modes
                audio_input = AudioInput(buffer=np.zeros(1, dtype=np.int16))
            
            # This call starts the SimulationWorkflow in the background
            result = await pipeline.run(audio_input)
            
            if not server_audio_track and self.mode in [Modalities.AUDIO_AUDIO, Modalities.TEXT_AUDIO]:
                logger.warning(f"No server_audio_track provided for profile {profile_id}, audio will be saved but not streamed")

            # This loop's ONLY job is to process the final audio stream, if one exists.
            # It will correctly ignore the dummy audio from test.wav.
            stream_frames: list[bytes] = []  # For WebRTC streaming (individual 20ms frames)

            async for event in result.stream():
                if hasattr(event, 'data') and isinstance(event.data, (bytes, np.ndarray)):
                    if self.mode in [Modalities.AUDIO_AUDIO, Modalities.TEXT_AUDIO]:
                        audio_chunk = event.data
                        if isinstance(audio_chunk, np.ndarray):
                            audio_chunk = audio_chunk.tobytes()
                        if audio_chunk:
                            # Separate tracking for streaming vs archival
                            stream_frames.append(audio_chunk)

                            # 👇 THE KEY CHANGE: Add the pre-chunked audio directly
                            if server_audio_track:
                                server_audio_track.add_chunk(audio_chunk)
                            
                            # This yield is for any potential future use, like live WebRTC audio playback
                            yield {"type": "audio", "data": audio_chunk}

            # SPEC CHANGE: DO NOT end the stream. It must be kept alive for future messages.
            # The persistent track will continue to be available for the next TTS response.
            if stream_frames:
                logger.info(f"Audio streaming completed for profile {profile_id}, track remains active")
            
            # We are done. The workflow has already sent all necessary WebSocket events.
            yield {"type": "complete", "data": "finished"}
            
        except Exception as e:
            logger.exception("Pipeline processing failed")
            from app.web.simulations import get_sio_instance
            sio_instance = get_sio_instance()
            await sio_instance.emit(
                "simulation_message_error",
                {"chat_id": str(self.chat_id), "error": str(e)},
                room=f"simulation_{self.chat_id}",
            )
            yield {"type": "error", "data": str(e)}