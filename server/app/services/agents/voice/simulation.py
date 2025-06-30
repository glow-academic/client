import abc
import asyncio
import logging
import os
import random
import uuid
from typing import Any, AsyncGenerator, AsyncIterator, Callable

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

# Removed custom logger import - using standard logging

logger = logging.getLogger(__name__)
from sqlmodel import Session, select

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
                # In text-only mode, we stream a dummy .wav file to keep the pipeline
                # alive, but we will filter this output later so it's never sent to the client.
                dummy_audio_path = os.path.join(AUDIO_FOLDER, "test.wav")

                if not os.path.exists(dummy_audio_path):
                    logger.error(
                        f"Dummy audio file not found at {dummy_audio_path}. The voice pipeline might fail."
                    )
                    # Fallback to the previous 'always-on' method if the file is missing
                    try:
                        while True:
                            yield b""
                            await asyncio.sleep(0.2)
                    except asyncio.CancelledError:
                        return
                
                try:
                    logger.info(f"Streaming dummy audio from '{dummy_audio_path}' to keep pipeline alive.")
                    chunk_size = 1024  # Read in 1KB chunks
                    with open(dummy_audio_path, "rb") as f:
                        while True:
                            chunk = f.read(chunk_size)
                            if not chunk:
                                break  # End of file
                            yield chunk
                    logger.info("Finished streaming dummy audio file.")
                except Exception as e:
                    logger.error(f"Error streaming dummy audio file: {e}")
                finally:
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
    def __init__(self, chat_id: uuid.UUID, session: Session, original_message: str = "", *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.chat_id = chat_id
        self.session = session
        self.original_message = original_message
    
    async def run(self, transcription: str) -> AsyncIterator[str]:
        """
        Run the voice workflow. Receives transcription and yields text for TTS.
        """
        from app.web.simulations import get_sio_instance
        sio_instance = get_sio_instance()
        
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

            # Create assistant message placeholder
            assistant_message = SimulationMessages(
                chat_id=self.chat_id,
                type="response",
                content="",
                completed=False,
                audio=False
            )
            self.session.add(assistant_message)
            self.session.commit()
            self.session.refresh(assistant_message)
            
            logger.info(f"Created user message {user_message.id} for chat {self.chat_id}")

            # Stream the assistant response using the existing simulation agent
            accumulated_content = ""
            cancelled = False

            try:
                async for token in run_simulation_agent(self.chat_id, self.session):
                    # Regular content token
                    accumulated_content += token

                    # Update the database with accumulated content
                    assistant_message.content = accumulated_content
                    self.session.add(assistant_message)
                    self.session.commit()

                    # Emit token update to connected clients
                    logger.info(
                        f"Emitting token to room simulation_{self.chat_id}: {token[:20]}..."
                    )
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
            except Exception as e:
                if "cancelled" in str(e).lower() or "canceled" in str(e).lower():
                    # Handle cancellation gracefully
                    cancelled = True
                    logger.info(f"Simulation run for chat {self.chat_id} was cancelled")

                    # Update message content with cancellation notice
                    if not accumulated_content.strip():
                        accumulated_content = "[Simulation cancelled by user]"
                    else:
                        accumulated_content += "\n\n[Simulation cancelled by user]"

                    assistant_message.content = accumulated_content
                    self.session.add(assistant_message)
                    self.session.commit()

                    # Emit cancellation signal
                    logger.info(f"Emitting cancellation to room simulation_{self.chat_id}")
                    await sio_instance.emit(
                        "simulation_message_cancelled",
                        {
                            "message_id": str(assistant_message.id),
                            "chat_id": str(self.chat_id),
                            "final_content": accumulated_content,
                        },
                        room=f"simulation_{self.chat_id}",
                    )
                else:
                    # Re-raise other exceptions
                    raise e

            # 6. Mark as completed
            assistant_message.completed = True
            self.session.add(assistant_message)
            self.session.commit()

            # 7. Emit completion signal (only if not cancelled)
            if not cancelled:
                logger.info(f"Emitting completion to room simulation_{self.chat_id}")
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
            
        workflow = SimulationWorkflow(self.chat_id, self.session, self.original_message)
        
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
            
            # # Create assistant message placeholder
            # assistant_message = SimulationMessages(
            #     chat_id=self.chat_id,
            #     type="response",
            #     content="",
            #     completed=False,
            #     audio=self.mode in [Modalities.AUDIO_AUDIO, Modalities.TEXT_AUDIO]
            # )
            # self.session.add(assistant_message)
            # self.session.commit()
            # self.session.refresh(assistant_message)
            
            # # Emit assistant message placeholder
            # await sio_instance.emit(
            #     "simulation_new_message",
            #     {
            #         "message_id": str(assistant_message.id),
            #         "chat_id": str(self.chat_id),
            #         "role": "assistant",
            #         "content": "",
            #         "completed": False,
            #         "audio": assistant_message.audio,
            #         "created_at": assistant_message.created_at.isoformat(),
            #     },
            #     room=f"simulation_{self.chat_id}",
            # )

            # pull the latest assistant message from the database
            assistant_message = self.session.exec(select(SimulationMessages).where(SimulationMessages.chat_id == self.chat_id, SimulationMessages.type == "response", SimulationMessages.completed == True)).one()
            if not assistant_message:
                raise ValueError(f"Assistant message not found for chat {self.chat_id}")
            
            # In the SimulationPipeline class within your first provided file.
            # Replace the "async for event in result.stream()" loop with this corrected version.
            assistant_audio_chunks = []

            # Stream the results from the pipeline
            async for event in result.stream():
                if not hasattr(event, 'data'):
                    continue
                # 2. Handle AUDIO data from the TTS model
                elif isinstance(event.data, (bytes, np.ndarray)):
                    # --- MODIFIED LOGIC ---
                    # Only process audio chunks if the mode requires audio output.
                    # This check filters out the dummy stream from test.wav in AUDIO_TEXT mode.
                    if self.mode in [Modalities.AUDIO_AUDIO, Modalities.TEXT_AUDIO]:
                        audio_chunk = event.data
                        if isinstance(audio_chunk, np.ndarray):
                            audio_chunk = audio_chunk.tobytes()

                        if audio_chunk:
                            assistant_audio_chunks.append(audio_chunk)
                            # This yield is for any internal consumer or potential WebRTC audio streaming
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
                    "final_content": assistant_message.content,
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