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
from agents.voice.workflow import VoiceWorkflowBase
from app.config import model_manager
from app.db import get_session
from app.extensions import AUDIO_FOLDER
from app.models import (Agents, Models, Providers, Scenarios, SimulationChats,
                        SimulationMessages)
from app.services.agents.collection.simulation import run_simulation_agent
from app.utils.audio import Modalities
from av import AudioFrame

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
        if not self.generate_audio:
            return

        try:

            if self.model_id is None:
                kokoro_pipeline = model_manager.get_kokoro_pipeline()
                if not kokoro_pipeline:
                    logger.error("Kokoro TTS not available.")
                    return
                
                selected_voice = random.choice(model_manager.kokoro_voices)
                logger.info(f"TTS generating with Kokoro voice: {selected_voice} for text: '{text[:30]}...'")

                # 1. Generate the full audio clip in memory
                audio_chunks_24k = [chunk.cpu() for _, _, chunk in kokoro_pipeline(text, voice=selected_voice)]
                if not audio_chunks_24k:
                    logger.warning("TTS model produced no audio chunks.")
                    return
                raw_pcm_24k = torch.cat(audio_chunks_24k, dim=-1).numpy().flatten()

                # 2. Normalize to float32 in range [-1.0, 1.0] for high-quality resampling
                audio_float = raw_pcm_24k.astype(np.float32)
                if np.max(np.abs(audio_float)) > 1.0:
                    audio_float_normalized = audio_float / 32767.0
                else:
                    audio_float_normalized = audio_float
                
                # 3. Resample from 24kHz to the required 48kHz
                logger.info(f"Resampling audio from 24kHz to 48kHz...")
                pcm_48k = librosa.resample(y=audio_float_normalized, orig_sr=24000, target_sr=48000)
                logger.info(f"Resampling complete.")

                # 4. Convert back to 16-bit PCM for transmission
                audio_int16 = (pcm_48k * 32767).astype(np.int16)

                # 5. *** THIS IS THE CRITICAL FIX ***
                #    Chunk the final audio into properly sized 20ms frames and yield each one.
                frame_size = 960  # 960 samples = 20ms at 48kHz
                total_frames = 0
                
                for i in range(0, len(audio_int16), frame_size):
                    chunk = audio_int16[i:i + frame_size]
                    
                    # Pad the final chunk with silence if it's too short
                    if len(chunk) < frame_size:
                        chunk = np.pad(chunk, (0, frame_size - len(chunk)), 'constant')

                    # Yield the raw bytes of the 20ms chunk
                    yield chunk.tobytes()
                    total_frames += 1

                logger.info(f"TTS completed: yielded {total_frames} frames of 20ms each.")
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
                        
                logger.info(f"TTS completed for text length: {len(text)}")

        except Exception as e:
            logger.error(f"TTS generation or resampling failed: {e}", exc_info=True)
            return

class SimulationWorkflow(VoiceWorkflowBase):
    def __init__(self, chat_id: uuid.UUID, session: Session, mode: Modalities, original_message: str = "", *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.chat_id = chat_id
        self.session = session
        self.original_message = original_message
        self.mode = mode

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

            # 2. Create the assistant message placeholder IN THE DATABASE
            assistant_message = SimulationMessages(
                chat_id=self.chat_id,
                type="response",
                content="",
                completed=False,
                audio=self.mode == Modalities.AUDIO_AUDIO or self.mode == Modalities.TEXT_AUDIO
            )
            self.session.add(assistant_message)
            self.session.commit()
            self.session.refresh(assistant_message)

            # 3. Emit the placeholder to the client
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

            # 4. Run the agent and stream the response
            accumulated_content = ""
            async for token in run_simulation_agent(self.chat_id, self.session):
                if token:
                    accumulated_content += token
                    # A. Emit the token to the client
                    await sio_instance.emit(
                        "simulation_message_token",
                        {
                            "message_id": str(assistant_message.id),
                            "chat_id": str(self.chat_id),
                            "token": token,
                            "accumulated_content": accumulated_content,
                        },
                        room=f"simulation_{self.chat_id}",
                    )
                    # B. YIELD the token to the VoicePipeline to keep it running
                    yield token

            # 5. Finalize the message in the DB and emit completion
            assistant_message.content = accumulated_content
            assistant_message.completed = True
            self.session.add(assistant_message)
            self.session.commit()

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
                
        except Exception as e:
            logger.exception("Critical error in SimulationWorkflow")
            # Also yield the error to potentially be caught by the pipeline
            yield f"An error occurred: {str(e)}"


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
                instructions="Read exactly what you receive.",
            )
            
            # getting stt settings
            stt_settings = STTModelSettings(
                prompt="Transcribe the following audio into text.",
            )
            config = VoicePipelineConfig(tts_settings=tts_settings, stt_settings=stt_settings)
            
        workflow = SimulationWorkflow(self.chat_id, self.session, self.mode, self.original_message)
        
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
            assistant_audio_chunks = []

            async for event in result.stream():
                if hasattr(event, 'data') and isinstance(event.data, (bytes, np.ndarray)):
                    if self.mode in [Modalities.AUDIO_AUDIO, Modalities.TEXT_AUDIO]:
                        audio_chunk = event.data
                        if isinstance(audio_chunk, np.ndarray):
                            audio_chunk = audio_chunk.tobytes()
                        if audio_chunk:
                            assistant_audio_chunks.append(audio_chunk)

                            # 👇 THE KEY CHANGE: Add the pre-chunked audio directly
                            if server_audio_track:
                                server_audio_track.add_chunk(audio_chunk)
                            
                            # This yield is for any potential future use, like live WebRTC audio playback
                            yield {"type": "audio", "data": audio_chunk}

            # SPEC CHANGE: DO NOT end the stream. It must be kept alive for future messages.
            # The persistent track will continue to be available for the next TTS response.
            if assistant_audio_chunks:
                logger.info(f"Audio streaming completed for profile {profile_id}, track remains active")

            # If real audio was generated, find the message the workflow created and save the file.
            if assistant_audio_chunks:
                logger.info("Real TTS audio was generated. Saving to file.")
                
                # --- THIS IS THE MODIFIED BLOCK ---
                # Find the message the workflow just created using a manual sort.
                assistant_messages = self.session.exec(
                    select(SimulationMessages)
                    .where(SimulationMessages.chat_id == self.chat_id, SimulationMessages.type == "response")
                ).all()

                if assistant_messages:
                    # Sort the messages by creation date in descending order
                    sorted_messages = sorted(assistant_messages, key=lambda x: x.created_at, reverse=True)
                    # The most recent message is the first one
                    assistant_message = sorted_messages[0]

                    # Update the message with the audio file details
                    assistant_message.audio = True # Correct the audio flag as the workflow assumes False
                    path = os.path.join(AUDIO_FOLDER, f"{assistant_message.id}.wav")

                    # --- 👇 THIS IS THE FIX 👇 ---
                    # Replace the simple `open()` with the `wave` module to write a proper WAV file
                    
                    full_audio_data = b"".join(assistant_audio_chunks)
                    
                    with wave.open(path, 'wb') as wf:
                        wf.setnchannels(1)  # Mono audio
                        wf.setsampwidth(2)  # 16-bit PCM --> 2 bytes per sample
                        wf.setframerate(24000) # The sample rate of your Kokoro TTS model
                        wf.writeframes(full_audio_data)
                    # ------------------------------------

                    assistant_message.file_path = path
                    self.session.add(assistant_message)
                    self.session.commit()
                    logger.info(f"Saved assistant audio to {path}")
                else:
                    logger.error(f"Could not find assistant message for chat {self.chat_id} to attach audio file.")
            
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