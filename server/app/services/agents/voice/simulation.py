import abc
import asyncio
import logging
import os
import random
import uuid
import wave
from typing import Any, AsyncGenerator, AsyncIterator, Callable, Dict

import httpx
import litellm
import numpy as np
from agents import trace
from agents.voice.input import AudioInput, StreamedAudioInput
from agents.voice.model import (StreamedTranscriptionSession, STTModel,
                                STTModelSettings, TTSModel, TTSModelSettings)
from agents.voice.pipeline import VoicePipeline
from agents.voice.pipeline_config import VoicePipelineConfig
from agents.voice.utils import get_sentence_based_splitter
from agents.voice.workflow import VoiceWorkflowBase
from app.db import get_session
from app.extensions import AUDIO_FOLDER
from app.models import (Agents, Models, Providers, Scenarios, SimulationChats,
                        SimulationMessages)
from app.services.agents.collection.simulation import run_simulation_agent
from app.utils.audio import Modalities
from app.utils.model import remote_stt
from app.utils.model import remote_tts

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
                # Forward raw PCM-16 data to the model service
                transcribed_text = (await remote_stt(input.buffer.tobytes())).strip()
                
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
    def __init__(self, chat_id: uuid.UUID, session: Session, model_id: uuid.UUID | None = None, generate_audio: bool = True, profile_id: str | None = None, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.generate_audio = generate_audio
        self.chat_id = chat_id
        self.session = session
        self.model_id = model_id
        self.profile_id = profile_id  # NEW: Store profile_id for data-channel access

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
        Streams audio frames **and** handles data channel text streaming.
        This method now pairs text token streaming with audio generation using drip logic.
        """
        import math

        from app.web.simulations import get_sio_instance
        sio_instance = get_sio_instance()

        # ✂︎ Word timing tracking variables
        FRAME_SEC = 0.02  # 960 samples @48 kHz ⇒ 20 ms
        word_timings: list[dict[str, Any]] = []  # [{word,start,end}, …]
        current_time = 0.0  # seconds since first frame
        
        # NEW: Track silence detection and actual audio start
        silence_threshold = 0.01  # Amplitude threshold for detecting silence
        audio_started = False
        audio_start_time = 0.0
        pre_audio_frames = 0  # Count frames before actual audio starts

        # 1. Create the assistant message first, empty & in-flight
        assistant_message = SimulationMessages(
            chat_id=self.chat_id,
            type="response",
            content="",          # will be filled incrementally
            completed=False,
            audio=self.generate_audio
        )
        self.session.add(assistant_message)
        self.session.commit()
        self.session.refresh(assistant_message)

        if not self.generate_audio:
            # For text-only mode, just send the complete message immediately
            assistant_message.content = text
            assistant_message.completed = True
            self.session.add(assistant_message)
            self.session.commit()
            
            complete_payload = {
                "type": "complete",
                "chat_id": str(self.chat_id),
                "message_id": str(assistant_message.id),
                "final_content": text,
                "audio": assistant_message.audio,
            }

            sent = False
            if self.profile_id:
                from app.main import send_text_dc
                sent = await send_text_dc(self.profile_id, complete_payload)

            if not sent:
                await sio_instance.emit(
                    "simulation_message_complete",
                    complete_payload,
                    room=f"simulation_{self.chat_id}",
                )
            return

        # 2. Pre-compute the "token schedule" - but we'll adjust this based on actual audio timing
        words = text.split()
        total_words = len(words)
        next_word_index = 0
        accum = ""
        
        # NEW: Track actual audio duration for better word timing distribution
        actual_audio_frames = 0
        total_audio_duration = 0.0

        # 3. Helper to push a token batch through the data-channel (fallback → WS)
        async def push_tokens(batch: list[str], timing_offset: float = 0.0) -> None:
            nonlocal accum, next_word_index

            if not batch:
                return

            accum += (" " if accum else "") + " ".join(batch)
            
            # ➜ Calculate timing for each word in the batch based on actual audio progress
            words_in_batch = len(batch)
            if words_in_batch > 0 and total_audio_duration > 0:
                # Distribute words evenly across the current audio segment
                time_per_word = (current_time - timing_offset) / words_in_batch if words_in_batch > 1 else 0.0
                
                for i, w in enumerate(batch):
                    word_start_time = timing_offset + (i * time_per_word)
                    # Adjust for silence at the beginning
                    adjusted_start_time = max(0, word_start_time - audio_start_time)
                    word_timings.append({"word": w, "start": adjusted_start_time})
            else:
                # Fallback to simple timing if no audio duration calculated yet
                for w in batch:
                    adjusted_start_time = max(0, current_time - audio_start_time)
                    word_timings.append({"word": w, "start": adjusted_start_time})
            
            next_word_index += len(batch)

            payload = {
                "type": "token",
                "chat_id": str(self.chat_id),
                "message_id": str(assistant_message.id),
                "token": " ".join(batch),
                "accumulated_content": accum,
            }

            pushed = False
            if self.profile_id:
                from app.main import send_text_dc
                pushed = await send_text_dc(self.profile_id, payload)

            if not pushed:
                await sio_instance.emit(
                    "simulation_message_token",
                    payload,
                    room=f"simulation_{self.chat_id}",
                )

            # Light DB touch so the page reload is always consistent
            assistant_message.content = accum
            self.session.add(assistant_message)
            self.session.commit()

        wav_frames: list[bytes] = []

        try:
            if self.model_id is None:
                # --- Use streaming TTS with kokoro-onnx for real-time audio generation ---
                logger.info(f"Starting streaming TTS for text: {text[:50]}...")
                
                frame_size = 960  # 20 ms @48 kHz
                frames_sent = 0
                accumulated_audio = []  # Store all audio for duration calculation
                
                # Stream audio chunks from kokoro-onnx
                audio_buffer = b""  # Buffer to handle incomplete chunks
                async for audio_chunk in remote_tts(text, voice="af_bella", speed=1.0, lang="en-us"):
                    # Add chunk to buffer
                    audio_buffer += audio_chunk
                    
                    # Process complete int16 samples (2 bytes each)
                    bytes_per_sample = 2
                    complete_samples = len(audio_buffer) // bytes_per_sample
                    
                    if complete_samples > 0:
                        # Extract complete samples
                        complete_bytes = complete_samples * bytes_per_sample
                        complete_buffer = audio_buffer[:complete_bytes]
                        audio_buffer = audio_buffer[complete_bytes:]  # Keep remainder
                        
                        # Convert to numpy array for processing
                        audio_np = np.frombuffer(complete_buffer, dtype=np.int16)
                        accumulated_audio.append(audio_np)
                        
                        # Process the chunk in 20ms frames
                        for i in range(0, len(audio_np), frame_size):
                            frame = audio_np[i:i + frame_size]
                            if len(frame) < frame_size:  # pad final partial frame
                                frame = np.pad(frame, (0, frame_size - len(frame)))
                            frame_bytes = frame.tobytes()
                            
                            # AUDIO FIRST: yield the frame immediately
                            yield frame_bytes
                            wav_frames.append(frame_bytes)
                            frames_sent += 1
                            
                            # Update current time
                            current_time = frames_sent * FRAME_SEC
                            
                            # Detect audio start for better word timing
                            if not audio_started and len(frame) > 0:
                                # Calculate RMS amplitude for silence detection
                                rms = np.sqrt(np.mean(frame.astype(np.float32) ** 2)) / 32767.0
                                
                                if rms > silence_threshold:
                                    audio_started = True
                                    audio_start_time = current_time
                                    logger.info(f"Audio starts at {audio_start_time:.3f}s")
                            
                            # Calculate audio progress (excluding silence)
                            audio_progress = max(0, current_time - audio_start_time) if audio_started else 0
                            
                            # Progressive word timing distribution
                            if audio_started and total_words > 0:
                                # Estimate total duration based on current progress and text length
                                # This is a rough estimate that will be refined as we get more audio
                                estimated_duration = max(1.0, len(text) * 0.05)  # ~50ms per character
                                progress_ratio = min(audio_progress / estimated_duration, 1.0)
                                target_words = min(int(progress_ratio * total_words), total_words)
                                
                                if target_words > next_word_index and next_word_index < total_words:
                                    words_to_send = words[next_word_index:target_words]
                                    await push_tokens(words_to_send, audio_progress)
                                    logger.info(f"TOKEN sent words {next_word_index}-{target_words-1} at {current_time:.3f}s")
                            
                            # Add small delay to maintain real-time pacing
                            await asyncio.sleep(0.001)
                
                # Process any remaining bytes in the buffer
                if audio_buffer:
                    # Pad to complete sample if needed
                    if len(audio_buffer) % 2 == 1:
                        audio_buffer += b'\x00'  # Pad with zero byte
                    
                    if len(audio_buffer) >= 2:
                        audio_np = np.frombuffer(audio_buffer, dtype=np.int16)
                        accumulated_audio.append(audio_np)
                        
                        # Process final frames
                        for i in range(0, len(audio_np), frame_size):
                            frame = audio_np[i:i + frame_size]
                            if len(frame) < frame_size:
                                frame = np.pad(frame, (0, frame_size - len(frame)))
                            frame_bytes = frame.tobytes()
                            
                            yield frame_bytes
                            wav_frames.append(frame_bytes)
                            frames_sent += 1
                
                # Calculate final audio duration
                if accumulated_audio:
                    total_audio_np = np.concatenate(accumulated_audio)
                    total_audio_duration = len(total_audio_np) / 48_000.0
                else:
                    total_audio_duration = current_time

                logger.info(f"Streaming TTS completed for text length: {len(text)}, duration: {total_audio_duration:.2f}s")
            else:
                # LiteLLM path - similar improvements
                logger.info(f"TTS generating audio for text: {text[:50]}...")
                
                response = await litellm.aspeech(
                    model=self.name,
                    input=text,
                    instructions=settings.instructions,
                )
                
                audio_data = response.content if hasattr(response, 'content') else b""
                
                # Convert to numpy for silence detection
                audio_np = np.frombuffer(audio_data, dtype=np.int16)
                total_samples = len(audio_np)
                total_audio_duration = total_samples / 48000.0
                
                # Detect silence at the beginning
                frame_size = 960
                for frame_idx in range(0, len(audio_np), frame_size):
                    frame_data = audio_np[frame_idx:frame_idx + frame_size]
                    if len(frame_data) == 0:
                        continue
                        
                    rms = np.sqrt(np.mean(frame_data.astype(np.float32) ** 2)) / 32767.0
                    
                    if not audio_started and rms > silence_threshold:
                        audio_started = True
                        audio_start_time = frame_idx / 48000.0
                        pre_audio_frames = frame_idx // frame_size
                        logger.info(f"Audio starts at {audio_start_time:.3f}s (frame {pre_audio_frames})")
                        break
                
                if not audio_started:
                    audio_start_time = 0.0
                    pre_audio_frames = 0
                
                # Stream the audio with proper timing
                chunk_size = 1920  # 960 samples * 2 bytes per sample for 20ms at 48kHz
                frames_sent = 0
                
                for i in range(0, len(audio_data), chunk_size):
                    tts_chunk = audio_data[i:i + chunk_size]
                    if tts_chunk:
                        yield tts_chunk
                        wav_frames.append(tts_chunk)
                        frames_sent += 1
                        
                        current_time = frames_sent * FRAME_SEC
                        audio_progress = max(0, current_time - audio_start_time)
                        
                        if audio_started and total_audio_duration > 0:
                            progress_ratio = audio_progress / (total_audio_duration - audio_start_time)
                            target_words = min(int(progress_ratio * total_words), total_words)
                            
                            if target_words > next_word_index and next_word_index < total_words:
                                batch_start_time = (next_word_index / total_words) * (total_audio_duration - audio_start_time)
                                words_to_send = words[next_word_index:target_words]
                                await push_tokens(words_to_send, batch_start_time)
                                logger.info(f"TOKEN sent words {next_word_index}-{target_words-1} at {current_time:.3f}s")
                        
                        await asyncio.sleep(0.001)
                
                logger.info(f"TTS completed for text length: {len(text)}")

            # 6. Flush any remaining words
            if next_word_index < total_words:
                remaining_words = words[next_word_index:]
                final_timing_offset = max(0, total_audio_duration - audio_start_time) if audio_started else total_audio_duration
                await push_tokens(remaining_words, final_timing_offset)

            # ── Calculate final word end times based on actual audio duration ──
            actual_audio_duration = max(0, total_audio_duration - audio_start_time) if audio_started else total_audio_duration
            
            if word_timings and actual_audio_duration > 0:
                # Redistribute word timings more evenly across the actual audio duration
                for i, timing in enumerate(word_timings):
                    # Calculate proportional position within the audio
                    word_position = i / len(word_timings) if len(word_timings) > 1 else 0
                    
                    # Adjust start time to be proportional to actual audio duration
                    timing["start"] = word_position * actual_audio_duration
                    
                    # Calculate end time (start of next word or end of audio)
                    if i + 1 < len(word_timings):
                        next_position = (i + 1) / len(word_timings)
                        timing["end"] = next_position * actual_audio_duration
                    else:
                        timing["end"] = actual_audio_duration
                
                logger.info(f"Adjusted {len(word_timings)} word timings for {actual_audio_duration:.2f}s audio duration")

            # send the timings blob once per message
            timings_payload = {
                "type": "word_timings",
                "chat_id": str(self.chat_id),
                "message_id": str(assistant_message.id),
                "timings": word_timings,
            }
            sent = False
            if self.profile_id:
                from app.main import send_text_dc
                sent = await send_text_dc(self.profile_id, timings_payload)

            if not sent:
                await sio_instance.emit("simulation_word_timings", timings_payload,
                                        room=f"simulation_{self.chat_id}")

            assistant_message.content = text
            assistant_message.completed = True
            self.session.add(assistant_message)
            self.session.commit()

            complete_payload = {
                "type": "complete",
                "chat_id": str(self.chat_id),
                "message_id": str(assistant_message.id),
                "final_content": text,
                "audio": assistant_message.audio,
            }

            sent = False
            if self.profile_id:
                from app.main import send_text_dc
                sent = await send_text_dc(self.profile_id, complete_payload)

            if not sent:
                await sio_instance.emit(
                    "simulation_message_complete",
                    complete_payload,
                    room=f"simulation_{self.chat_id}",
                )

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

                # Validate audio file duration against our timing calculations
                actual_file_duration = len(wav_frames) * FRAME_SEC
                logger.info(f"Audio file stats: frames={len(wav_frames)}, duration={actual_file_duration:.2f}s")
                
                if word_timings:
                    max_timing_end = max(t["end"] for t in word_timings)
                    timing_duration_diff = abs(actual_file_duration - max_timing_end)
                    
                    if timing_duration_diff > 0.1:  # More than 100ms difference
                        logger.warning(f"Timing mismatch: file_duration={actual_file_duration:.2f}s, max_timing={max_timing_end:.2f}s, diff={timing_duration_diff:.2f}s")
                    else:
                        logger.info(f"Timing validation passed: file_duration={actual_file_duration:.2f}s, max_timing={max_timing_end:.2f}s")

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
        Note: Text token streaming is now handled in the TTS model to pair with audio.
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
                tts_model=SimulationTTSModel(chat_id=self.chat_id, session=self.session, model_id=self.tts_model_id, generate_audio=True, profile_id=self.profile_id),
                config=config,
            )
        elif self.mode == Modalities.AUDIO_TEXT:
            return VoicePipeline(
                workflow=workflow,
                stt_model=SimulationSTTModel(chat_id=self.chat_id, session=self.session, model_id=self.stt_model_id, generate_text=True),
                tts_model=SimulationTTSModel(chat_id=self.chat_id, session=self.session, model_id=self.tts_model_id, generate_audio=False, profile_id=self.profile_id),
                config=config,
            )
        elif self.mode == Modalities.TEXT_AUDIO:
            return VoicePipeline(
                workflow=workflow,
                stt_model=SimulationSTTModel(chat_id=self.chat_id, session=self.session, model_id=self.stt_model_id, generate_text=False),
                tts_model=SimulationTTSModel(chat_id=self.chat_id, session=self.session, model_id=self.tts_model_id, generate_audio=True, profile_id=self.profile_id),
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