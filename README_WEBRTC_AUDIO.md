# WebRTC Audio Transcription Implementation

## Overview

This implementation provides real-time audio transcription using WebRTC and OpenAI Whisper. When a user speaks into their microphone during a simulation chat, the audio is streamed to the server, transcribed using Whisper, and then processed as if the user had typed the message.

## Architecture

### Client Side (`client/utils/rtc.ts` & `client/components/common/chat/Attempt.tsx`)

1. **WebRTC Setup**: Establishes peer connection with ICE servers for NAT traversal
2. **Audio Capture**: Captures user's microphone input with optimized settings
3. **Signaling**: Uses WebSocket for ICE candidate exchange
4. **UI Feedback**: Shows transcription status and results

### Server Side (`server/app/routes/rtc.py`)

1. **Peer Connection**: Handles WebRTC offers and creates answers
2. **Audio Processing**: `AudioProcessor` class processes incoming audio streams
3. **Whisper Integration**: Transcribes audio using OpenAI Whisper model
4. **Message Processing**: Sends transcribed text through the normal chat pipeline

## Key Features

### Audio Processing Pipeline

1. **Audio Buffering**: Collects 2 seconds of audio before processing
2. **Silence Detection**: Skips processing if audio appears to be silence (RMS < 0.01)
3. **Format Conversion**: Converts audio to proper format for Whisper (16kHz, mono, float32)
4. **Transcription**: Uses Whisper "tiny.en" model for fast English transcription
5. **Message Injection**: Sends transcribed text as a simulation message

### WebSocket Events

- `webrtc_audio_transcribed`: Emitted when audio is successfully transcribed
- Shows transcription in UI before sending as message
- Provides real-time feedback to user

### UI Enhancements

- **Microphone Button**: 
  - Shows recording state (red when active)
  - Shows processing state (animated dots when transcribing)
  - Displays last transcription in tooltip
- **Toast Notifications**: Real-time feedback for connection and transcription status
- **Visual Indicators**: Pulse animation during processing

## Configuration

### Audio Settings

```typescript
// Client-side audio constraints
{
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 16000,
    channelCount: 1,
  }
}
```

### Server Settings

```python
# AudioProcessor configuration
buffer_duration = 2.0  # Process every 2 seconds
sample_rate = 16000    # 16kHz for Whisper
silence_threshold = 0.01  # RMS threshold for silence detection
min_audio_length = 1.0    # Minimum 1 second before processing
```

## Testing

### 1. Start the Services

```bash
# Terminal 1 - Database
cd database && docker-compose up

# Terminal 2 - Server  
cd server && make dev

# Terminal 3 - Client
cd client && yarn dev
```

### 2. Test WebRTC Audio

1. Navigate to a simulation attempt
2. Click the microphone button (should turn red)
3. Speak clearly for 2+ seconds
4. Stop recording (button shows processing animation)
5. Watch for transcription toast notification
6. Verify transcribed text appears as a message

### 3. Debug Logging

Check server logs for:
- `🎤 AudioProcessor initialized for chat {chat_id}`
- `🔊 Processing audio buffer with {n} frames`
- `🎯 Starting Whisper transcription`
- `✅ Whisper transcription completed: '{text}'`

### 4. Common Issues

**No audio processing:**
- Check microphone permissions in browser
- Verify WebRTC connection establishment
- Look for ICE connection state logs

**Transcription fails:**
- Check Whisper model is loaded (`make test-whisper`)
- Verify audio format conversion logs
- Check for silence detection (RMS too low)

**Message not sent:**
- Verify WebSocket connection to simulation room
- Check `process_simulation_message_websocket` execution
- Look for WebSocket event emissions

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support  
- **Safari**: Limited WebRTC support, may require additional configuration

## Performance

- **Whisper Model**: Uses "tiny.en" for fast transcription (~100ms)
- **Audio Buffering**: 2-second chunks balance latency vs accuracy
- **Memory Usage**: Buffers are cleared after processing
- **CPU Usage**: Whisper processing is CPU-intensive but brief

## Security

- **TURN Server**: Required for NAT traversal in production
- **Audio Privacy**: Audio is processed server-side and not permanently stored
- **WebSocket Security**: Uses same authentication as chat system

## Future Enhancements

1. **Voice Activity Detection**: More sophisticated silence detection
2. **Multiple Languages**: Support for non-English transcription
3. **Speaker Diarization**: Identify different speakers
4. **Real-time Streaming**: Process audio as it's spoken (streaming ASR)
5. **Audio Compression**: Reduce bandwidth usage 