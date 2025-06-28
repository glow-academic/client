import logging
from enum import Enum
from typing import AsyncGenerator

import av
import webrtcvad
from av.audio.stream import MediaStreamTrack

logger = logging.getLogger(__name__)


class Modalities(Enum):
    AUDIO_AUDIO = "audio_audio" # GTA audio, AI audio
    AUDIO_TEXT = "audio_text" # GTA audio, AI text
    TEXT_AUDIO = "text_audio" # AI audio, GTA text
    TEXT_TEXT = "text_text" # AI text, AI text



# -- Audio Processing Constants & Helpers --
TARGET_SR = 16_000
FRAME_MS = 30  # VAD supports 10, 20, or 30 ms frames
TARGET_SAMPLES_PER_FRAME = TARGET_SR * FRAME_MS // 1000
TARGET_BYTES_PER_FRAME = TARGET_SAMPLES_PER_FRAME * 2  # 16-bit PCM

async def resample_and_chunk_audio(track: MediaStreamTrack) -> AsyncGenerator[bytes, None]:
    """
    Convert the incoming WebRTC audio (whatever rate/format) to 16-kHz mono
    16-bit PCM and yield it in 30-ms chunks (960 bytes) suitable for webrtc-vad.
    """
    resampler = av.AudioResampler(format="s16", layout="mono", rate=TARGET_SR)

    buffer = b""
    try:
        while True:
            frame = await track.recv()      # ← pull next frame

            # make sure frame is an AudioFrame
            if not isinstance(frame, av.AudioFrame):
                logger.warning(f"Received non-audio frame: {type(frame)}")
                continue

            for fr in resampler.resample(frame):      # PyAV objects
                buffer += fr.to_ndarray().tobytes()

            # Emit as many complete VAD frames as we have
            while len(buffer) >= TARGET_BYTES_PER_FRAME:
                yield buffer[:TARGET_BYTES_PER_FRAME]
                buffer = buffer[TARGET_BYTES_PER_FRAME:]

    except av.error.EOFError:
        pass        # peer closed the track
    finally:
        if buffer:  # flush tail, padding to full frame
            yield buffer.ljust(TARGET_BYTES_PER_FRAME, b"\0")


class VadDetector:
    """A class to detect speech in an audio stream."""

    def __init__(self, sample_rate: int, frame_duration_ms: int, vad_level: int):
        self.vad = webrtcvad.Vad(vad_level)
        self.sample_rate = sample_rate
        self.frame_duration_ms = frame_duration_ms
        self.frame_size = int(sample_rate * (frame_duration_ms / 1000.0))
        self.buffer = bytearray()

    def is_speech(self, frame: bytes) -> bool:
        return self.vad.is_speech(frame, self.sample_rate)  # type: ignore
