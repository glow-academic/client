import abc
import asyncio
import logging
import os
import random
import uuid
import wave
from typing import Any, AsyncGenerator, AsyncIterator, Callable, Dict

import litellm
import numpy as np
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
        """Given a text string, produces a stream of audio bytes, in PCM format."""
        # MODIFIED: Change the behavior for the generate_audio=False case
        if not self.generate_audio:
            return
        
        try:
            if self.model_id is None:
                # Use Kokoro TTS for open source inference
                # Kokoro is a lightweight 82M parameter TTS model with high quality output
                # It supports multiple voices and languages with CPU inference
                
                # Get Kokoro pipeline from model manager
                kokoro_pipeline = model_manager.get_kokoro_pipeline()
                if kokoro_pipeline is None:
                    logger.error("Kokoro TTS not available, returning empty audio")
                    yield b""
                    return
                
                # Randomly select between male and female voices
                selected_voice = random.choice(model_manager.kokoro_voices)
                
                logger.info(f"TTS generating audio with Kokoro using voice: {selected_voice} for text: {text[:50]}...")
                
                try:
                    # Generate audio using Kokoro pipeline from model manager
                    generator = kokoro_pipeline(text, voice=selected_voice)
                    
                    # Process the generator results
                    audio_chunks_generated = 0
                    for i, (gs, ps, audio) in enumerate(generator):
                        logger.info(f"Kokoro TTS chunk {i}: graphemes={len(gs)}, phonemes={len(ps)}, audio_shape={audio.shape if hasattr(audio, 'shape') else 'unknown'}")
                        
                        # Convert numpy array or torch tensor to bytes if needed
                        if isinstance(audio, np.ndarray) and audio.size > 0:
                            audio_np = audio
                        elif hasattr(audio, 'detach') and hasattr(audio, 'cpu') and hasattr(audio, 'numpy'):
                            # Handle PyTorch tensors
                            audio_np = audio.detach().cpu().numpy()
                        else:
                            audio_np = None
                        
                        if audio_np is not None and audio_np.size > 0:
                            # Kokoro outputs float32 audio at 24kHz, convert to int16 PCM
                            if audio_np.dtype == np.float32:
                                # Clip to [-1, 1] range and convert to int16
                                audio_int16 = (np.clip(audio_np, -1.0, 1.0) * 32767).astype(np.int16)
                            elif audio_np.dtype == np.int16:
                                audio_int16 = audio_np
                            else:
                                # Convert other types to int16
                                audio_normalized = audio_np.astype(np.float32)
                                if np.max(np.abs(audio_normalized)) > 1.0:
                                    audio_normalized = audio_normalized / np.max(np.abs(audio_normalized))
                                audio_int16 = (audio_normalized * 32767).astype(np.int16)
                            
                            # Convert to bytes
                            audio_bytes = audio_int16.tobytes()
                            
                            # Stream in chunks for better real-time performance
                            chunk_size = 16384  # 16KB chunks
                            for j in range(0, len(audio_bytes), chunk_size):
                                chunk = audio_bytes[j:j + chunk_size]
                                if chunk:
                                    audio_chunks_generated += 1
                                    yield chunk
                        elif isinstance(audio, bytes) and len(audio) > 0:
                            # If audio is already bytes, stream it directly
                            audio_chunks_generated += 1
                            yield audio
                        else:
                            logger.info(f"Skipping empty or invalid audio chunk {i}")
                    
                    if audio_chunks_generated == 0:
                        logger.error("No audio chunks were generated by Kokoro TTS")
                        yield b""
                    
                    logger.info(f"Kokoro TTS completed for text length: {len(text)}")
                    
                except Exception as kokoro_error:
                    logger.error(f"Kokoro TTS generation failed: {kokoro_error}")
                    yield b""
                    
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
            pts = 0  # Presentation timestamp starts at 0
            sample_rate = 24000  # Your TTS model's sample rate

            async for event in result.stream():
                if hasattr(event, 'data') and isinstance(event.data, (bytes, np.ndarray)):
                    if self.mode in [Modalities.AUDIO_AUDIO, Modalities.TEXT_AUDIO]:
                        audio_chunk = event.data
                        if isinstance(audio_chunk, np.ndarray):
                            audio_chunk = audio_chunk.tobytes()
                        if audio_chunk:
                            assistant_audio_chunks.append(audio_chunk)

                            # 👇 THE KEY CHANGE: Create and queue an AudioFrame
                            if server_audio_track:
                                new_frame = AudioFrame(format='s16', layout='mono', samples=len(audio_chunk) // 2)
                                new_frame.planes[0].update(audio_chunk)
                                new_frame.sample_rate = sample_rate
                                new_frame.pts = pts
                                pts += new_frame.samples  # Increment timestamp
                                server_audio_track.add_frame(new_frame)
                            
                            # This yield is for any potential future use, like live WebRTC audio playback
                            yield {"type": "audio", "data": audio_chunk}

            # Signal end of audio stream if we were streaming
            if server_audio_track and assistant_audio_chunks:
                server_audio_track.end_stream()
                logger.info(f"Signaled end of audio stream for profile {profile_id}")

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