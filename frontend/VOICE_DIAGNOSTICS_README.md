# Voice Diagnostics for Mobile Troubleshooting

This document explains how to use the new voice diagnostics features to troubleshoot microphone and voice recognition issues on mobile devices.

## 🧪 Mic Diagnostics Button

A new **"🧪 Mic Diagnostics"** button has been added to the Voice Coach Controls. This button runs comprehensive diagnostics and prints a detailed report to the console.

### How to Use:

1. **Open your app on the mobile device**
2. **Navigate to a page with Voice Coach Controls** (e.g., Training page)
3. **Tap the "🧪 Mic Diagnostics" button**
4. **Check the console** for detailed diagnostic information

### What the Diagnostics Check:

- **Environment**: Protocol, secure context, user agent
- **Permissions**: Microphone permission state (if supported)
- **Feature Detection**: SpeechRecognition and SpeechSynthesis availability
- **getUserMedia**: Audio capture capability and any errors
- **Speech Recognition**: Full recognition lifecycle (start, onstart, onend, onerror)
- **TTS**: Speech synthesis unlock test
- **Timing**: Event sequence and timing analysis

## 🔍 Runtime Debug Logging

The BrowserSpeechService now includes comprehensive debug logging that can be enabled at runtime.

### Enable Debug Logging:

```javascript
// Run this in the browser console
localStorage.setItem("VC_DEBUG", "1");
location.reload();
```

### What Gets Logged:

- **SR Creation**: Whether SpeechRecognition is available
- **Event Firing**: onstart, onend, onerror events
- **Method Calls**: startListening calls and their results
- **Error Details**: Specific error messages and codes
- **Timing Issues**: Missing onstart events (gesture/permission problems)

### View Logs:

```javascript
// View all voice coach logs
console.log(window.__vcLogs);

// Or check localStorage for persistent logs
localStorage.getItem("VC_DEBUG");
```

## 🎯 User Gesture Probe

The Voice Coach buttons now include gesture probes to detect if they're being called within a valid user gesture context.

### What It Does:

- **Tests SpeechRecognition**: Creates a minimal SR instance and calls start/stop
- **Detects Gesture Issues**: Identifies if the call is outside a valid user gesture
- **Logs Results**: Reports success/failure to console
- **Non-Blocking**: Still attempts to start voice coach even if probe fails

### When It Runs:

- **Voice Coach Toggle**: Before starting voice coach
- **Speak Button**: Before starting listening
- **Press-to-Talk**: Before starting listening

## 📱 Common Mobile Issues & Solutions

### 1. **NotAllowedError**
```
getUserMedia: error:NotAllowedError msg:Permission denied
```
**Solution**: User needs to grant microphone permission in browser settings

### 2. **Gesture Probe Fails**
```
[VC] gesture probe failed: InvalidStateError
```
**Solution**: Button click is not within a valid user gesture context

### 3. **onstart Never Fires**
```
recognition.watchdog: onstart not fired (likely user-gesture/permissions)
```
**Solution**: iOS Safari quirk - ensure button is tapped directly, not through JavaScript

### 4. **SpeechRecognition Unavailable**
```
SpeechRecognition.available: false
```
**Solution**: Device doesn't support Web Speech API - consider fallback to backend STT

## 🚀 Quick Debug Workflow

1. **Run Mic Diagnostics** on the problematic device
2. **Enable Debug Logging** with `localStorage.setItem("VC_DEBUG", "1")`
3. **Try Voice Coach** and watch console for detailed logs
4. **Check Gesture Probe** results in console
5. **Review Error Patterns** and apply appropriate fixes

## 🔧 Advanced Debugging

### Check Permission State:
```javascript
// Modern browsers
navigator.permissions.query({ name: 'microphone' }).then(result => {
  console.log('Permission state:', result.state);
});

// iOS Safari fallback
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(() => console.log('Permission granted'))
  .catch(err => console.log('Permission error:', err.name));
```

### Test SpeechRecognition Directly:
```javascript
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const rec = new SR();
  rec.lang = 'en-US';
  rec.onstart = () => console.log('SR started');
  rec.onerror = (e) => console.log('SR error:', e.error);
  rec.start();
  setTimeout(() => rec.stop(), 1000);
}
```

## 📋 Diagnostic Output Example

```
[VC DIAG]
[12:34:56.789] protocol: https:
[12:34:56.789] isSecureContext: true
[12:34:56.789] userAgent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)...
[12:34:56.789] permissions.microphone.state: unsupported
[12:34:56.789] SpeechRecognition.available: true
[12:34:56.789] speechSynthesis.available: true
[12:34:56.789] getUserMedia: error:NotAllowedError msg:The request is not allowed by the user agent or the platform in the current context
[12:34:56.789] recognition.start(): called
[12:34:56.789] recognition.watchdog: onstart not fired (likely user-gesture/permissions)
[12:34:56.789] recognition.summary: {"started":false,"ended":false,"errored":null}
[12:34:56.789] tts.onstart: fired
[12:34:56.789] tts.onend: fired
[12:34:56.789] tts.summary: spoke
```

This comprehensive diagnostic system should help identify exactly where voice recognition is failing on mobile devices!
