import abc
from typing import AsyncIterator

import numpy as np
from agents.voice.input import AudioInput, StreamedAudioInput
from agents.voice.model import (StreamedTranscriptionSession, STTModel,
                                STTModelSettings, TTSModel, TTSModelSettings)
from agents.voice.pipeline import VoicePipeline, VoicePipelineConfig
from agents.voice.workflow import VoiceWorkflowBase
from app.services.agents.collection.simulation import run_simulation_agent


class SimulationSTTModel(STTModel):
    def __init__(self, generate_text: bool = True, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.generate_text = generate_text

    @property
    def model_name(self) -> str:
        """The name of the STT model."""
        return "simulation"

    async def transcribe(
        self,
        input: AudioInput,
        settings: STTModelSettings,
        trace_include_sensitive_data: bool,
        trace_include_sensitive_audio_data: bool,
    ) -> str:
        """Given an audio input, produces a text transcription.

        Args:
            input: The audio input to transcribe.
            settings: The settings to use for the transcription.
            trace_include_sensitive_data: Whether to include sensitive data in traces.
            trace_include_sensitive_audio_data: Whether to include sensitive audio data in traces.

        Returns:
            The text transcription of the audio input.
        """
        # we will use whisper here to transcribe the audio
        return "Hello, how are you?"

    async def create_session(
        self,
        input: StreamedAudioInput,
        settings: STTModelSettings,
        trace_include_sensitive_data: bool,
        trace_include_sensitive_audio_data: bool,
    ) -> StreamedTranscriptionSession:
        """Creates a new transcription session, which you can push audio to, and receive a stream
        of text transcriptions.

        Args:
            input: The audio input to transcribe.
            settings: The settings to use for the transcription.
            trace_include_sensitive_data: Whether to include sensitive data in traces.
            trace_include_sensitive_audio_data: Whether to include sensitive audio data in traces.

        Returns:
            A new transcription session.
        """
        # use whisper again to transcribe this audio
        return "Hello, how are you?"

class SimulationTTSModel(TTSModel):
    def __init__(self, generate_audio: bool = True, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.generate_audio = generate_audio

    @property
    def model_name(self) -> str:
        """The name of the TTS model."""
        return "simulation"

    def run(self, text: str, settings: TTSModelSettings) -> AsyncIterator[bytes]:
        """Given a text string, produces a stream of audio bytes, in PCM format.

        Args:
            text: The text to convert to audio.

        Returns:
            An async iterator of audio bytes, in PCM format.
        """
        # call LiteLLM to generate the audio.

class SimulationWorkflow(VoiceWorkflowBase):
    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
    
    def run(self, transcription: str) -> AsyncIterator[str]:
        """
        Run the voice workflow. You will receive an input transcription, and must yield text that
        will be spoken to the user. You can run whatever logic you want here. In most cases, the
        final logic will involve calling `Runner.run_streamed()` and yielding any text events from
        the stream.
        """

        async for text in run_simulation_agent(transcription):
            yield text
        


class Modalities(Enum):
    AUDIO_AUDIO = "audio_audio" # GTA audio, AI audio
    AUDIO_TEXT = "audio_text" # GTA audio, AI text
    TEXT_AUDIO = "text_audio" # AI audio, GTA text
    # text text is not supported, since this handles audio workflows.

class SimulationPipeline():
    def __init__(self, mode: Modalities) -> None:
        self.mode = mode
    
    def get_pipeline(self, config: VoicePipelineConfig | None = None) -> VoicePipeline:
        if self.mode == Modalities.AUDIO_AUDIO:
            return VoicePipeline(
                workflow=SimulationWorkflow(),
                stt_model=SimulationSTTModel(),
                tts_model=SimulationTTSModel(),
                config=config,
            )
        elif self.mode == Modalities.AUDIO_TEXT:
            # we won't need to tts, since we just need text afterwards.
            return VoicePipeline(
                workflow=SimulationWorkflow(),
                stt_model=SimulationSTTModel(),
                tts_model=SimulationTTSModel(False), # we don't need to generate audio, since we just need text afterwards.
                config=config,
            )
        elif self.mode == Modalities.TEXT_AUDIO:
            return VoicePipeline(
                workflow=SimulationWorkflow(),
                stt_model=SimulationSTTModel(False), # we don't need to generate audio, since we just need text afterwards.
                tts_model=SimulationTTSModel(),
                config=config,
            )
        else:
            raise ValueError(f"Invalid modality: {self.mode}")