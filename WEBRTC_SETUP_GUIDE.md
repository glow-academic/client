# WebRTC Setup Guide

This guide will help you set up WebRTC audio streaming with proper TURN server configuration for optimal performance and connectivity.

## Quick Setup (Recommended)

### 1. Set up TURN Server

The fastest way to get reliable WebRTC connectivity:

```bash
# Navigate to server directory
cd server

# Run the TURN server setup script
./setup-turn-server.sh
```

This will:
- Start a coturn TURN server using Docker
- Auto-detect your public IP
- Generate the required environment variables

### 2. Configure Environment Variables

After running the setup script, add the environment variables to your shell:

```bash
# Add to your ~/.bashrc, ~/.zshrc, or export directly
export TURN_PUBLIC_IP=your.public.ip
export TURN_USERNAME=webrtc
export TURN_PASS=changeMe
export TURN_REALM=example.com
```

### 3. Restart FastAPI Server

```bash
# In server directory
make run
```

### 4. Test the Setup

1. Open your browser to the client application
2. Navigate to a simulation attempt
3. Click the microphone button
4. Audio should start streaming within 1-2 seconds

## Manual TURN Server Setup

If you prefer to set up your own TURN server:

### Using Docker

```bash
docker run -d \
  --name coturn \
  --restart unless-stopped \
  -p 3478:3478 \
  -p 3478:3478/udp \
  -p 5349:5349 \
  -p 5349:5349/udp \
  -p 49152-65535:49152-65535/udp \
  instrumentisto/coturn \
  -n \
  --log-file=stdout \
  --realm=example.com \
  --user=webrtc:changeMe \
  --lt-cred-mech \
  --external-ip=YOUR_PUBLIC_IP \
  --listening-port=3478 \
  --tls-listening-port=5349 \
  --min-port=49152 \
  --max-port=65535 \
  --verbose
```

### Using System Package

On Ubuntu/Debian:

```bash
sudo apt-get install coturn
```

Edit `/etc/turnserver.conf`:

```
listening-port=3478
tls-listening-port=5349
external-ip=YOUR_PUBLIC_IP
realm=example.com
user=webrtc:changeMe
lt-cred-mech
log-file=/var/log/turn.log
verbose
```

## Troubleshooting

### Slow Audio Startup

**Symptoms:** Audio takes 4-5 seconds to start, or never connects

**Solutions:**
1. Ensure TURN server is running and accessible
2. Check that environment variables are set correctly
3. Verify firewall allows UDP traffic on ports 3478 and 49152-65535
4. For remote testing, ensure the page is served over HTTPS

### Connection Failures

**Symptoms:** WebRTC connection fails or drops frequently

**Solutions:**
1. Check browser console for WebRTC errors
2. Use `chrome://webrtc-internals` to debug connection details
3. Verify TURN server logs: `docker logs -f coturn`
4. Ensure your public IP is correctly configured

### Audio Quality Issues

**Symptoms:** Poor audio quality or choppy transcription

**Solutions:**
1. Check microphone permissions in browser
2. Verify audio constraints in `rtc.ts` (sample rate, etc.)
3. Monitor server logs for Whisper processing errors
4. Consider adjusting buffer duration in `AudioProcessor`

## Development vs Production

### Development (localhost)

- HTTP is acceptable for localhost testing
- Google STUN servers usually sufficient on LAN
- TURN server recommended but not always required

### Production (remote access)

- **HTTPS is required** for `getUserMedia()` to work
- TURN server is **essential** for reliable connectivity
- Consider using a CDN or proper SSL certificates

## Network Requirements

### Ports to Open

- **3478 UDP/TCP**: STUN/TURN server
- **5349 UDP/TCP**: TURN over TLS (optional)
- **49152-65535 UDP**: TURN relay ports

### Firewall Configuration

```bash
# Example iptables rules
iptables -A INPUT -p udp --dport 3478 -j ACCEPT
iptables -A INPUT -p tcp --dport 3478 -j ACCEPT
iptables -A INPUT -p udp --dport 49152:65535 -j ACCEPT
```

## Testing Your Setup

### 1. Check ICE Configuration

```bash
curl http://localhost:8000/rtc/ice
```

Should return:
```json
{
  "urls": [
    "stun:your.ip:3478",
    "turn:your.ip:3478?transport=udp",
    "turn:your.ip:3478?transport=tcp"
  ],
  "username": "webrtc",
  "credential": "changeMe"
}
```

### 2. Verify TURN Server

```bash
# Check if TURN server is running
docker ps | grep coturn

# Check TURN server logs
docker logs coturn
```

### 3. Browser Testing

1. Open Chrome DevTools
2. Go to `chrome://webrtc-internals`
3. Start audio streaming in your app
4. Check for successful TURN candidate gathering

## Performance Optimizations

The implemented fixes include:

1. **Parallel WebSocket Connection**: Signaling WebSocket connects before `getUserMedia()` for faster startup
2. **Reduced Buffer Duration**: Audio processing every 0.5s instead of 1s
3. **ICE Candidate Pool**: Pre-gathering candidates for faster connection
4. **Proper TURN Configuration**: Reliable connectivity across networks
5. **Enhanced Logging**: Better debugging information

## Common Issues

### "Permission denied" for microphone

- Ensure page is served over HTTPS (for remote access)
- Check browser microphone permissions
- Try refreshing the page and allowing permission

### "WebSocket connection failed"

- Verify WebSocket URL is correct (ws:// for HTTP, wss:// for HTTPS)
- Check if FastAPI server is running
- Ensure no firewall blocking WebSocket connections

### "No audio detected"

- Check microphone is working in other applications
- Verify audio constraints in browser
- Monitor server logs for Whisper processing

## Support

If you continue to experience issues:

1. Check the browser console for errors
2. Review server logs for WebRTC and Whisper errors
3. Use `chrome://webrtc-internals` for detailed connection analysis
4. Ensure all environment variables are properly set 