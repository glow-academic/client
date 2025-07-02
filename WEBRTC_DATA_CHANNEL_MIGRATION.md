# WebRTC Data Channel Migration Implementation

This document outlines the implementation of WebRTC data channels for high-frequency text streaming, moving token-level communication off WebSocket and onto a dedicated data channel while preserving WebSocket for control events.

## Architecture Overview

**WebSocket = "meta" events** (start/stop, new-row, completed, errors)  
**Data-channel = high-rate payload** (tokens / word batches in both directions)

## Implementation Details

### 1. Server-Side Changes

#### `server/app/main.py`
- ✅ Added persistent "text" data channel creation in `create_webrtc_peer_connection()`
- ✅ Added `send_text_dc()` helper function with WebSocket fallback
- ✅ Added `handle_text_dc_message()` for incoming client messages
- ✅ Updated profile management to store `text_channel` reference

#### `server/app/services/agents/voice/simulation.py`
- ✅ Modified `SimulationWorkflow` to accept `profile_id` parameter
- ✅ Updated token streaming to use data channel with WebSocket fallback
- ✅ Added completion message sending via data channel
- ✅ Updated `SimulationPipeline` to pass `profile_id` to workflow

#### `server/app/web/simulations.py`
- ✅ Updated `process_simulation_message_websocket()` to pass `profile_id` to pipeline
- ✅ Added data channel support to TEXT_TEXT mode with fallback logic

### 2. Client-Side Changes

#### `client/contexts/websocket-context.tsx`
- ✅ Added `ondatachannel` handler to receive server-created channels
- ✅ Updated `sendWebRTCMessage()` to prefer persistent "text" channel
- ✅ Added message routing for incoming data channel messages
- ✅ Maintained backward compatibility with existing channel approach

#### `client/contexts/simulation-context.tsx`
- ✅ Added custom event listeners for data channel messages
- ✅ Updated React Query cache handling for token and completion events
- ✅ Imported `SimulationMessage` type for proper typing

## Message Flow

### Outgoing (Client → Server)
1. Client calls `sendWebRTCMessage(chatId, message, audioEnabled)`
2. Function tries persistent "text" data channel first
3. Falls back to per-chat channels if unavailable
4. Falls back to WebSocket if no data channels available
5. Server receives via `handle_text_dc_message()` and routes appropriately

### Incoming (Server → Client)
1. Server streams tokens via `send_text_dc()` with WebSocket fallback
2. Client receives on persistent "text" data channel
3. Messages dispatched as custom DOM events
4. React Query cache updated via existing event handlers
5. UI updates normally through existing React components

## Payload Formats

### Token Message
```json
{
  "type": "token",
  "chat_id": "uuid",
  "message_id": "uuid", 
  "token": "word or phrase",
  "accumulated_content": "full message so far"
}
```

### Completion Message
```json
{
  "type": "complete",
  "chat_id": "uuid",
  "message_id": "uuid",
  "final_content": "complete message",
  "audio": boolean
}
```

### User Message
```json
{
  "chat_id": "uuid",
  "content": "user message text",
  "assistant_audio_enabled": boolean
}
```

## Testing Checklist

### ✅ Basic Functionality
1. **Data Channel Creation**: Verify "text" channel appears in browser dev tools
2. **Token Streaming**: Confirm tokens arrive via data channel (check Network tab)
3. **Fallback Logic**: Disable WebRTC and verify WebSocket fallback works
4. **Message Ordering**: Test large responses (≥5kB) for proper token sequence

### ✅ Browser Compatibility
1. **Chrome/Edge**: Primary WebRTC support
2. **Firefox**: Secondary WebRTC support  
3. **Safari**: WebRTC with potential limitations
4. **Mobile**: iOS Safari and Android Chrome

### ✅ Network Conditions
1. **Fast Connection**: Data channel should handle high-frequency tokens
2. **Slow Connection**: Graceful degradation to WebSocket
3. **Intermittent**: Automatic reconnection and fallback

### ✅ Development Workflow
1. **Hot Reload**: Server data channel persists through client reloads
2. **Server Restart**: Client reconnects and re-establishes data channel
3. **Error Handling**: Proper logging and fallback on channel failures

## Performance Benefits

### Before (WebSocket Only)
- All tokens sent as individual WebSocket messages
- Higher latency due to HTTP/2 framing overhead
- Potential message queuing under high load
- Mixed control and data traffic

### After (Data Channel + WebSocket)
- High-frequency tokens via dedicated UDP-based data channel
- Lower latency for real-time streaming
- WebSocket reserved for control events only
- Better separation of concerns

## Monitoring & Debugging

### Browser Dev Tools
```javascript
// Check data channel status
console.log(window.webRTCDataChannels?.get("text")?.readyState);

// Monitor data channel traffic
window.addEventListener("simulationMessageToken", (e) => {
  console.log("Token via data channel:", e.detail);
});
```

### Server Logs
```bash
# Enable debug logging for data channels
export LOG_LEVEL=DEBUG

# Watch for data channel messages
tail -f server.log | grep "data-channel"
```

## Rollback Strategy

If issues arise, the implementation provides automatic fallback:

1. **Data Channel Unavailable**: Automatically uses WebSocket
2. **WebRTC Connection Failed**: Falls back to WebSocket-only mode
3. **Browser Incompatibility**: Graceful degradation to existing flow

## Future Enhancements

1. **Compression**: Add gzip compression for large token payloads
2. **Batching**: Group multiple tokens into single data channel messages
3. **Priority**: Implement message prioritization for different content types
4. **Metrics**: Add performance monitoring for data channel vs WebSocket usage

## Configuration

### Environment Variables
```bash
# Enable data channel debugging
WEBRTC_DEBUG=true

# Adjust data channel buffer sizes
WEBRTC_BUFFER_SIZE=65536
```

### Client-Side Toggles
```typescript
// Disable data channels for testing
const USE_DATA_CHANNELS = process.env.NODE_ENV !== 'test';
```

This implementation maintains full backward compatibility while providing significant performance improvements for real-time text streaming. The automatic fallback ensures reliability across all deployment environments. 