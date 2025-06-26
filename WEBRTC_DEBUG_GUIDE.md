# WebRTC Audio Streaming Debug Guide

## Overview

This guide helps debug the WebRTC audio streaming implementation that transcribes audio to text using Whisper and processes it through the simulation chat system.

## Architecture

```
Client (Browser) → WebRTC → Server (FastAPI) → Whisper → Simulation Chat → WebSocket → Client
```

## Key Components

### 1. Client-Side (`client/utils/rtc.ts`)
- **WebRTC Peer Connection**: Handles audio streaming
- **ICE Signaling**: WebSocket for candidate exchange
- **Audio Capture**: getUserMedia for microphone access

### 2. Server-Side (`server/app/routes/rtc.py`)
- **AudioProcessor**: Processes incoming audio frames
- **Whisper Integration**: Transcribes audio to text
- **Simulation Integration**: Sends transcribed text to chat

### 3. WebSocket Signaling (`/rtc/signaling/{chat_id}`)
- **ICE Candidate Exchange**: Establishes WebRTC connection
- **Connection Management**: Handles peer connection lifecycle

## Common Issues and Fixes

### 1. RTCIceCandidate Constructor Error

**Error**: `RTCIceCandidate.__init__() got an unexpected keyword argument 'candidate'`

**Fix**: Use positional arguments instead of keyword arguments:
```python
# ❌ Wrong
candidate = RTCIceCandidate(
    candidate=candidate_data.get("candidate"),
    sdpMid=candidate_data.get("sdpMid"),
    sdpMLineIndex=candidate_data.get("sdpMLineIndex")
)

# ✅ Correct
candidate = RTCIceCandidate(
    candidate_data.get("candidate"),
    candidate_data.get("sdpMid"),
    candidate_data.get("sdpMLineIndex")
)
```

### 2. WebSocket Signaling Timing Issues

**Problem**: WebSocket connects before peer connection is ready

**Fix**: Added waiting mechanism in signaling endpoint:
```python
# Wait for peer connection to be created
pc = None
for _ in range(50):  # Wait up to 5 seconds
    pc = peer_connections.get(chat_id)
    if pc:
        break
    await asyncio.sleep(0.1)
```

### 3. Audio Processing Not Working

**Problem**: Audio frames not being processed correctly

**Checks**:
1. Verify `AudioProcessor` is receiving frames
2. Check audio buffer accumulation
3. Ensure Whisper model is loaded
4. Verify temporary file creation/cleanup

### 4. Connection State Issues

**Problem**: WebRTC connection fails or disconnects immediately

**Debug Steps**:
1. Check ICE server configuration
2. Verify TURN server credentials
3. Monitor connection state changes
4. Check browser console for errors

## Debug Tools

### 1. Test Script (`client/scripts/test-webrtc-debug.js`)

Run the debug test:
```bash
cd client
node scripts/test-webrtc-debug.js
```

### 2. Debug Utilities (`client/utils/rtc-debug.ts`)

Functions for debugging WebRTC connections:
- `testWebRTCCompatibility()`: Check browser support
- `getWebRTCDebugInfo()`: Get connection state info
- `createWebRTCDiagnosticReport()`: Generate comprehensive report

### 3. Server Logs

Monitor server logs for:
```
INFO: WebSocket signaling connected for chat {chat_id}
INFO: Received audio track for chat {chat_id}
INFO: Processing audio buffer with {n} frames
INFO: Transcription successful: {text}
```

## Testing Flow

### 1. Basic Connection Test

1. Start the application
2. Navigate to a simulation chat
3. Click the microphone button
4. Check browser console for WebRTC logs
5. Verify server logs show connection establishment

### 2. Audio Processing Test

1. Establish WebRTC connection
2. Speak into microphone for 3+ seconds
3. Check server logs for audio processing
4. Verify transcription appears in chat

### 3. End-to-End Test

1. Start WebRTC audio
2. Speak a message
3. Verify transcription in chat
4. Check simulation response
5. Stop WebRTC audio

## Troubleshooting Steps

### Step 1: Check Browser Support
```javascript
// In browser console
console.log('RTCPeerConnection:', typeof RTCPeerConnection !== 'undefined');
console.log('getUserMedia:', !!navigator.mediaDevices?.getUserMedia);
console.log('WebSocket:', typeof WebSocket !== 'undefined');
```

### Step 2: Verify ICE Configuration
```bash
curl http://localhost:8000/rtc/ice
```

### Step 3: Test WebSocket Signaling
```javascript
// In browser console
const ws = new WebSocket('ws://localhost:8000/rtc/signaling/test-chat-id');
ws.onopen = () => console.log('WebSocket connected');
ws.onerror = (error) => console.error('WebSocket error:', error);
```

### Step 4: Check Audio Permissions
```javascript
// In browser console
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    console.log('Audio permission granted');
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(error => console.error('Audio permission denied:', error));
```

### Step 5: Monitor WebRTC Stats
```javascript
// In browser console (after connection established)
pc.getStats().then(stats => {
  stats.forEach(report => {
    if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
      console.log('Audio stats:', report);
    }
  });
});
```

## Environment Variables

Ensure these are set correctly:

```env
# TURN server configuration
TURN_PUBLIC_IP=localhost
TURN_REALM=example.com
TURN_USERNAME=webrtc
TURN_PASS=changeMe
```

## Common Log Patterns

### Successful Connection
```
INFO: WebSocket signaling connected for chat dd034172-0eb1-49c6-b9ba-9acd63def1b0
INFO: Found peer connection for chat dd034172-0eb1-49c6-b9ba-9acd63def1b0
INFO: Received audio track for chat dd034172-0eb1-49c6-b9ba-9acd63def1b0
INFO: Created audio processor for chat dd034172-0eb1-49c6-b9ba-9acd63def1b0
INFO: Connection state changed to connected
```

### Audio Processing
```
INFO: Processing audio buffer with 100 frames after 3.02s
INFO: Processing 32000 bytes of audio data
INFO: Saved audio to temporary file: /tmp/tmpXXXXXX.wav
INFO: Transcription successful: Hello, this is a test message...
INFO: Processed WebRTC transcription for chat dd034172-0eb1-49c6-b9ba-9acd63def1b0
```

### Error Patterns
```
ERROR: Error in WebSocket signaling: RTCIceCandidate.__init__() got an unexpected keyword argument 'candidate'
ERROR: No peer connection found for chat dd034172-0eb1-49c6-b9ba-9acd63def1b0 after waiting
ERROR: Error processing audio buffer: [specific error]
ERROR: Whisper transcription failed: [specific error]
```

## Performance Considerations

1. **Audio Buffer Size**: Currently set to 1 second intervals
2. **Whisper Model**: Uses base model for balance of speed/accuracy
3. **Memory Usage**: Temporary files are cleaned up after processing
4. **Connection Cleanup**: Peer connections are properly closed

## Next Steps

If issues persist:

1. Check nginx configuration for WebSocket proxying
2. Verify TURN server is running and accessible
3. Test with different browsers
4. Check network connectivity and firewall settings
5. Review Docker container logs if using containerized deployment

## Useful Commands

```bash
# Check if services are running
docker-compose ps

# View server logs
docker-compose logs -f server

# View client logs  
docker-compose logs -f client

# Restart specific service
docker-compose restart server

# Test WebRTC debug script
cd client && node scripts/test-webrtc-debug.js
``` 