# AI Services - Modular Architecture

This directory contains the refactored, modular AI services that have been extracted from the monolithic `aiService.ts`. Each module has a single responsibility and can be tested, debugged, and upgraded independently.

## 🏗️ Architecture Overview

The new architecture follows a pipeline pattern where each service handles one specific concern:

```
aiPipeline.ts (Orchestrator)
├── videoDownloader.ts (Download)
├── audioProcessor.ts (Audio/Video Processing)
├── transcriber.ts (Speech-to-Text)
├── stepGenerator.ts (AI Analysis)
├── stepSaver.ts (File Management)
├── keyFrameExtractor.ts (Frame Extraction)
└── transcriptParser.ts (Text Parsing)
```

## 📁 Module Details

### `aiPipeline.ts` 🔁
**Purpose**: Main orchestration layer that coordinates all processing steps

**Key Features**:
- ✅ **Module Status Updates**: Integrates with `ModuleService` for real-time progress tracking
- ✅ **Conditional Processing**: Handles both URL and local file inputs
- ✅ **Development Limits**: Configurable video length limits (currently 90s)
- ✅ **Comprehensive Error Handling**: Graceful fallbacks and detailed error logging
- ✅ **Module Tracing**: All logs include moduleId for production debugging

**Usage**:
```typescript
import { generateStepsFromVideo } from './services/ai/index.js'
const result = await generateStepsFromVideo(videoUrl, moduleId)
```

### `videoDownloader.ts` 📥
**Purpose**: Downloads videos from URLs (S3 presigned URLs, HTTP, etc.)

**Key Features**:
- ✅ **Module Tracing**: All logs include moduleId for traceability
- ✅ **Robust Error Handling**: Comprehensive error logging with stack traces
- ✅ **Stream Processing**: Efficient streaming download with proper cleanup
- ✅ **S3 Compatibility**: Handles presigned URLs and content-type headers

**Usage**:
```typescript
import { downloadVideoFromUrl } from './videoDownloader.js'
const localPath = await downloadVideoFromUrl(videoUrl, moduleId)
```

### `audioProcessor.ts` 🎵
**Purpose**: Handles video-to-audio conversion and video metadata extraction

**Key Features**:
- ✅ **Module Tracing**: All logs include moduleId for traceability
- ✅ **Configurable Parameters**: Environment-based audio settings (sample rate, channels)
- ✅ **Command Logging**: Logs exact FFmpeg/FFprobe commands for debugging
- ✅ **Error Cleanup**: Removes partial files on failure
- ✅ **Video Truncation**: Development-friendly video length limiting

**Environment Variables**:
- `AUDIO_SAMPLE_RATE` (default: 44100)
- `AUDIO_CHANNELS` (default: 2)

**Usage**:
```typescript
import { extractAudioFromVideo, getVideoMetadata, truncateVideo } from './audioProcessor.js'
const audioPath = await extractAudioFromVideo(videoPath, moduleId)
const metadata = await getVideoMetadata(videoPath, moduleId)
```

### `transcriber.ts` 🧠
**Purpose**: Converts audio to text using Whisper with fallback strategies

**Key Features**:
- ✅ **Module Tracing**: All logs include moduleId for traceability
- ✅ **Dual Output**: Attempts JSON (with segments) first, falls back to text-only
- ✅ **Configurable Models**: Environment-based Whisper model selection
- ✅ **Temporary File Cleanup**: Removes transcript files after processing
- ✅ **Error Visibility**: Logs raw AI responses for debugging

**Environment Variables**:
- `WHISPER_MODEL` (default: 'base')

**Usage**:
```typescript
import { transcribeAudio } from './transcriber.js'
const result = await transcribeAudio(audioPath, moduleId)
// Returns: { text: string, segments: Array<{start, end, text}> }
```

### `stepGenerator.ts` ✍️
**Purpose**: Uses AI (Gemini/OpenAI) to generate structured steps from transcripts

**Key Features**:
- ✅ **Module Tracing**: All logs include moduleId for traceability
- ✅ **Dual AI Support**: Gemini primary, OpenAI fallback
- ✅ **Raw Response Logging**: Logs full AI responses for debugging
- ✅ **Result Validation**: Validates AI output structure before returning
- ✅ **Configurable Models**: Environment-based model selection

**Future Enhancement**: 
- 🔮 **Provider Architecture**: `generateWithGemini()` and `generateWithOpenAI()` can be moved to a `providers/` directory
- 🔮 **Easy Extension**: Simple to add Claude, Perplexity, or Mistral support

**Environment Variables**:
- `GEMINI_API_KEY` (required for Gemini)
- `OPENAI_API_KEY` (required for OpenAI fallback)
- `GEMINI_MODEL` (default: 'gemini-pro')
- `OPENAI_MODEL` (default: 'gpt-4')

**Usage**:
```typescript
import { generateVideoSteps } from './stepGenerator.js'
const result = await generateVideoSteps(transcript, segments, metadata, moduleId)
```

### `stepSaver.ts` 💾
**Purpose**: Saves analysis results to files and manages cleanup

**Key Features**:
- ✅ **Module Tracing**: All logs include moduleId for traceability
- ✅ **Predictable Filenames**: Includes moduleId in filenames for debugging
- ✅ **S3 Ready**: Includes `uploadToS3()` stub function for future migration
- ✅ **Comprehensive Cleanup**: Handles temporary file removal
- ✅ **Error Recovery**: Continues cleanup even if individual files fail

**Usage**:
```typescript
import { saveVideoAnalysis, cleanupTempFiles, uploadToS3 } from './stepSaver.js'
const paths = await saveVideoAnalysis(result, 'data', moduleId)
await cleanupTempFiles(filePaths)

// Future S3 usage (when implemented)
// const urls = await uploadToS3(result, 'my-bucket', 'videos/', moduleId)
```

### `keyFrameExtractor.ts` 🖼️
**Purpose**: Extracts key frames from video at regular intervals

**Key Features**:
- ✅ **Module Tracing**: All logs include moduleId for traceability
- ✅ **Command Logging**: Logs exact FFmpeg commands for debugging
- ✅ **FFmpeg Detection**: Helpful error messages if FFmpeg is missing
- ✅ **Robust Cleanup**: Uses `fs.rm` with recursive/force options
- ✅ **Configurable Intervals**: Adjustable frame extraction timing

**Usage**:
```typescript
import { extractKeyFrames, cleanupKeyFrames } from './keyFrameExtractor.js'
const frames = await extractKeyFrames(videoPath, duration, 10, moduleId)
await cleanupKeyFrames(frames, moduleId)
```

### `transcriptParser.ts` 📝
**Purpose**: Parses raw transcript text into structured steps

**Key Features**:
- ✅ **Module Tracing**: All logs include moduleId for traceability
- ✅ **Shared Types**: Exports `ParsedStep` interface for consistency
- ✅ **Dual Methods**: Segment-based (preferred) and line-based (fallback)
- ✅ **Clear Warnings**: Indicates when using approximation methods
- ✅ **Type Safety**: Full TypeScript support with proper interfaces

**Usage**:
```typescript
import { parseTranscriptToSteps, createStepsFromSegments, ParsedStep } from './transcriptParser.js'
// Preferred method (when segments available)
const steps = createStepsFromSegments(segments, moduleId)
// Fallback method (text-only)
const fallbackSteps = parseTranscriptToSteps(transcript, moduleId)
```

## 🔄 Execution Flow

1. **Video Input** → `aiPipeline.ts` receives video URL or local path
2. **Download** → `videoDownloader.ts` fetches remote videos
3. **Audio Extraction** → `audioProcessor.ts` converts video to WAV
4. **Transcription** → `transcriber.ts` runs Whisper for speech-to-text
5. **AI Analysis** → `stepGenerator.ts` uses Gemini/OpenAI for step generation
6. **File Management** → `stepSaver.ts` saves results and cleans up
7. **Progress Updates** → `ModuleService` receives real-time status updates

## 🚀 Benefits of New Architecture

### ✅ **Testability**
- Each module can be unit tested independently
- Mock external dependencies (FFmpeg, AI APIs) easily
- Isolated failure scenarios for better debugging

### ✅ **Maintainability**
- Single responsibility principle
- Clear interfaces between modules
- Easy to add new features or replace implementations

### ✅ **Scalability**
- Modules can be upgraded independently
- Easy to add caching, retries, or queuing
- Simple to swap AI providers or transcription engines

### ✅ **Production Readiness**
- Comprehensive module tracing with moduleId
- Detailed error logging and validation
- Graceful fallbacks and error recovery
- Environment-based configuration

## 🔧 Configuration

### **Type System**
All shared types are centralized in `types.ts` to reduce circular dependencies:
```typescript
import type { 
  Step, 
  VideoAnalysisResult, 
  TranscriptionResult 
} from './services/ai/types.js'
```

### **ModuleService Integration**
The AI pipeline integrates with `ModuleService` for database operations:
```typescript
import { ModuleService } from './moduleService.js'

// Save AI-generated steps to database
await ModuleService.saveStepsToModule(moduleId, result.steps)

// Update module status with progress
await ModuleService.updateModuleStatus(moduleId, 'processing', 50, 'AI analysis in progress...')

// Get module details
const { module } = await ModuleService.getModuleById(moduleId, true)
```

**Key Methods**:
- `saveStepsToModule()` - Stores AI-generated steps with type safety
- `updateModuleStatus()` - Updates progress and handles orphaned detection
- `getModuleById()` - Retrieves module with optional relations
- `getModuleSteps()` - Gets all steps for a module
- `deleteModule()` - Removes module and related data

### **Required Environment Variables**
```bash
# AI Services
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key

# Optional Overrides
WHISPER_MODEL=base
GEMINI_MODEL=gemini-pro
OPENAI_MODEL=gpt-4
AUDIO_SAMPLE_RATE=44100
AUDIO_CHANNELS=2
```

### AWS Configuration
All AWS-related environment variables use the `AWS_` prefix:
```bash
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
```

## 📊 Current Status

### ✅ **Completed Improvements**
- [x] **Module Tracing**: All functions now accept optional `moduleId` parameter
- [x] **Comprehensive Logging**: Every operation includes module context
- [x] **Error Handling**: Robust error recovery with detailed logging
- [x] **Type Safety**: Full TypeScript interfaces and validation
- [x] **Configuration**: Environment-based settings for all major components
- [x] **S3 Readiness**: Placeholder functions for future cloud migration
- [x] **Validation**: Input/output validation at every critical step
- [x] **Cleanup**: Proper temporary file management and cleanup

### 🔄 **Pipeline Integration**
- [x] **Module Status Updates**: Real-time progress tracking via `ModuleService`
- [x] **Database Integration**: Steps are automatically saved to modules
- [x] **Error Propagation**: Failures are properly logged and handled
- [x] **Resource Management**: Temporary files are cleaned up on success/failure

### 🎯 **Production Features**
- [x] **Concurrent Processing**: Multiple modules can be processed simultaneously
- [x] **Traceability**: Every log entry includes module context
- [x] **Fallback Strategies**: Multiple AI providers and transcription methods
- [x] **Performance Monitoring**: Detailed timing and progress information
- [x] **Resource Cleanup**: Guaranteed cleanup even on failures

## 🚀 Next Steps

### **Immediate (Ready Now)**
- ✅ All modules are production-ready with comprehensive logging
- ✅ Full integration with existing `ModuleService` and database
- ✅ Complete error handling and validation
- ✅ Environment-based configuration

### **ModuleService Enhancements** 🔧
- ✅ **Type Safety**: Updated `saveStepsToModule()` to use proper TypeScript types
- ✅ **Orphaned Detection**: Extracted orphaned check logic into reusable private method
- ✅ **Enhanced Returns**: `saveStepsToModule()` now returns created steps data
- ✅ **New Methods**: Added `getModuleById()`, `deleteModule()`, and `getModuleSteps()`
- ✅ **Documentation**: Improved JSDoc with explicit return types and parameter descriptions

### **Future Enhancements**
- [ ] **S3 Integration**: Replace local file storage with cloud storage
  - ✅ **Ready**: `uploadToS3()` stub function already exists in `stepSaver.ts`
  - 🔧 **Next**: Implement actual S3 upload logic
- [ ] **Caching**: Add Redis-based caching for repeated transcriptions
- [ ] **Queue System**: Implement job queuing for high-volume processing
- [ ] **Monitoring**: Add metrics collection and alerting
- [ ] **Retry Logic**: Implement exponential backoff for transient failures
- [ ] **Provider Architecture**: Move AI providers to `providers/` directory for easy extension
- [ ] **Database Schema**: Extend Prisma Step model to support AI metadata (aliases, notes, aiGeneratedId)

## 🔍 Debugging & Monitoring

### **Module Tracing**
Every log entry now includes the module ID, making it easy to trace individual video processing jobs:
```
🤖 [StepGenerator] Module abc123: Starting AI analysis...
📝 [Transcriber] Module abc123: Transcribing audio for module abc123: /temp/audio.wav
💾 [StepSaver] Module abc123: Saving video analysis...
```

### **Progress Tracking**
Real-time progress updates are sent to the database:
- 10%: Downloading video
- 20%: Extracting audio
- 25%: Analyzing metadata
- 30%: Transcribing audio
- 40%: Extracting key frames
- 50%: AI analysis
- 80%: Saving results
- 100%: Complete

### **Error Investigation**
Comprehensive error logging includes:
- Module context
- Raw AI responses
- FFmpeg command details
- Stack traces
- Cleanup status

This modular architecture provides a solid foundation for scaling video processing while maintaining excellent observability and debugging capabilities.

## 🧪 Testing Strategy

To ensure reliability and future scalability, we recommend:

### **Unit Testing**
Each module can be tested independently with mocked dependencies:

```typescript
// Example: transcriber.spec.ts
import { transcribeAudio } from './transcriber.js'
import { exec } from 'child_process'

jest.mock('child_process')
jest.mock('fs')

describe('transcriber', () => {
  it('should transcribe audio successfully', async () => {
    // Mock Whisper output
    const mockExec = exec as jest.MockedFunction<typeof exec>
    mockExec.mockImplementation((cmd, callback) => {
      callback?.(null, 'transcript text', '')
      return {} as any
    })
    
    const result = await transcribeAudio('/test/audio.wav', 'test-module')
    expect(result.text).toBe('transcript text')
  })
})
```

### **Integration Testing**
Test the full pipeline with a short video clip:

```typescript
// Example: aiPipeline.integration.spec.ts
import { generateStepsFromVideo } from './aiPipeline.js'

describe('aiPipeline integration', () => {
  it('should process a 5-second test video', async () => {
    const result = await generateStepsFromVideo('./test/short-video.mp4', 'test-module')
    
    expect(result.steps).toHaveLength(1)
    expect(result.transcript).toBeTruthy()
    expect(result.totalDuration).toBe(5)
  })
})
```

### **Mock Strategy**
- **External APIs**: Mock Gemini, OpenAI, and Whisper responses
- **File System**: Mock fs operations for predictable testing
- **FFmpeg**: Mock child_process.exec for command validation
- **Network**: Mock axios for download testing

### **Mock Suggestions**
- **Whisper**: Mock stdout output or bypass transcription entirely
- **Gemini/OpenAI**: Return sample JSON responses via mock
- **S3**: Use [aws-sdk-client-mock](https://github.com/m-radzikowski/aws-sdk-client-mock) for cloud storage testing

### **Test Folders**
- **Unit Tests**: Place specs in `/__tests__/services/ai/` or colocated `*.spec.ts` files
- **Integration Tests**: Use dedicated integration test files for full pipeline testing
- **Test Data**: Store short test videos in `/test/videos/` for consistent testing

### **Test Data**
- Use 5-10 second test videos for fast iteration
- Mock AI responses with realistic JSON structures
- Test both success and failure scenarios
- Validate error handling and cleanup
