# Voice Coach System

## Environment Variable Control

The voice coach components are controlled by the `VITE_ENABLE_VOICE_COACH` environment variable:

```bash
# Disable voice coach (default - safe stubs)
VITE_ENABLE_VOICE_COACH=false

# Enable voice coach (actual components)
VITE_ENABLE_VOICE_COACH=true
```

## Usage Pattern

Always gate voice coach imports and renders with the environment variable:

```tsx
// ✅ CORRECT: Check flag before importing/rendering
const VC_ENABLED = import.meta.env.VITE_ENABLE_VOICE_COACH === "true";

// Only render when enabled
{VC_ENABLED ? <VoiceCoachControls ... /> : null}

// Only import when needed
{VC_ENABLED && <VoiceCoachOverlay ... />}
```

## Current State

- **Default (VITE_ENABLE_VOICE_COACH=false)**: Safe stubs that return `null`
- **Enabled (VITE_ENABLE_VOICE_COACH=true)**: Will load actual voice components (future implementation)

## Console Output

- **Disabled**: `[VC-STUB] voice/VoiceCoachControls disabled by VITE_ENABLE_VOICE_COACH flag`
- **Enabled**: `[VC-STUB] voice/VoiceCoachControls stub loaded`

## Import Paths

All voice coach imports are aliased to the safe components:
- `@/components/voice/VoiceCoachControls`
- `@/components/VoiceCoachControls` 
- `@/voice/VoiceCoachControls`
- `@/voice/VoiceCoachOverlay`

## Future Implementation

When `VITE_ENABLE_VOICE_COACH=true`, these stubs will be replaced with actual voice coach functionality.
