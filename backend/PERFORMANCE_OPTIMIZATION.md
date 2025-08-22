# 🚀 Performance Optimization Guide

## OpenAI Step Generation Speed

The main bottleneck in video processing is OpenAI API calls for step generation. Here's how to optimize:

### **Current Configuration (Optimized)**
```bash
# These are already set in stepGenerator.ts for better performance
OPENAI_MODEL_STEPS=gpt-4o-mini
AI_TEMPERATURE=0.1          # Reduced from 0.2 for faster responses
AI_MAX_OUTPUT_TOKENS=400    # Reduced from 800 for faster responses
```

### **Ultra-Fast Configuration (3-5x faster)**
```bash
# For maximum speed, use gpt-3.5-turbo
OPENAI_MODEL_STEPS=gpt-3.5-turbo
AI_TEMPERATURE=0.1
AI_MAX_OUTPUT_TOKENS=300
```

### **Performance Impact**
- **gpt-4o-mini**: ~10-15 seconds (current)
- **gpt-3.5-turbo**: ~3-5 seconds (3-5x faster)

### **Quality vs Speed Trade-off**
- **gpt-4o-mini**: Better step quality, more accurate timing
- **gpt-3.5-turbo**: Faster processing, slightly less precise steps

## Other Optimizations

### **1. Transcript Trimming**
- Automatically trims long transcripts to reduce AI processing time
- Configurable via `TRANSCRIPT_MAX_CHARS` environment variable

### **2. Timeout Protection**
- Added 30-second timeout to prevent hanging OpenAI requests
- Automatic fallback to Gemini if enabled

### **3. Model Selection**
- Gemini disabled by default (set `ENABLE_GEMINI=true` to enable)
- OpenAI as primary, Gemini as fallback

## Monitoring Performance

Check the logs for these performance indicators:
```
🤖 [StepGenerator] Module xxx: OpenAI config - Model: gpt-4o-mini, Temp: 0.1, Max Tokens: 400
✅ [StepGenerator] Module xxx: OpenAI analysis successful
```

## Quick Fix for Slow Processing

If you need immediate speed improvement:

1. **Set environment variable:**
   ```bash
   export OPENAI_MODEL_STEPS=gpt-3.5-turbo
   ```

2. **Restart the backend service**

3. **Expected result:** Processing time drops from ~45 seconds to ~15 seconds total
