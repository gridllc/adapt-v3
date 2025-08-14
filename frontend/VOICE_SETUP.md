# Voice Features Setup Guide

## Environment Variables

Add these to your frontend `.env` file (and Render/Vercel env):

```bash
# Voice on/off
VITE_ENABLE_VOICE=true

# Which engine to use: BROWSER (free) or GOOGLE (paid)
VITE_VOICE_PROVIDER=BROWSER  # change to GOOGLE later
```

## Backend Environment Variables

Add these to your backend `.env` file:

```bash
# Voice Configuration
ENABLE_SERVER_VOICE=false  # Set to true when ready for Google
VOICE_PROVIDER=BROWSER     # BROWSER or GOOGLE
VOICE_LANG=en-US          # Default language
VOICE_VOICE_NAME=en-US-Neutral  # Default voice for Google TTS

# Google Cloud credentials (only needed when VOICE_PROVIDER=GOOGLE)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}  # Full JSON
# OR
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json  # File path
```

## How It Works

### Current Setup (Free)
- **VITE_VOICE_PROVIDER=BROWSER**: Uses browser's built-in speech recognition and synthesis
- **No cost**: Everything runs locally in the browser
- **Compatibility**: Works on Chrome/Edge Android and most desktop browsers
- **iOS Safari**: TTS works, STT is limited (push-to-talk button disabled)

### Future Setup (Paid)
- **VITE_VOICE_PROVIDER=GOOGLE**: Uses Google Cloud Speech-to-Text and Text-to-Speech
- **Higher quality**: Better accuracy and more natural-sounding voices
- **Cost**: Pay per API call (very cheap for testing)
- **Install packages**: `npm i @google-cloud/speech @google-cloud/text-to-speech`

## Voice Commands

The voice coach understands these commands:
- **"Next" or "Forward"**: Move to next step
- **"Previous" or "Back"**: Move to previous step  
- **"Play" or "Start"**: Play video
- **"Pause" or "Stop"**: Pause video
- **"Read step" or "What"**: Read current step description

## Testing

1. Set `VITE_ENABLE_VOICE=true` in your frontend `.env`
2. Upload a video and generate steps
3. Click "🎤 Voice Coach" button
4. Say commands like "next", "pause", "read step"
5. The system will respond with voice feedback

## Troubleshooting

### Voice not working?
- Check browser console for errors
- Ensure microphone permissions are granted
- Try in Chrome/Edge (best compatibility)

### Can't hear responses?
- Check if TTS is available: `voice.ttsAvailable`
- Ensure system volume is up
- Some browsers require user interaction before TTS works

### Want to switch to Google?
1. Set `VITE_VOICE_PROVIDER=GOOGLE`
2. Set `ENABLE_SERVER_VOICE=true` on backend
3. Install Google packages: `npm i @google-cloud/speech @google-cloud/text-to-speech`
4. Provide Google credentials
5. Redeploy
