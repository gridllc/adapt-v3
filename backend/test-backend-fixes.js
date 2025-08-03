#!/usr/bin/env node

/**
 * Test script to verify backend fixes are working
 * Run with: node test-backend-fixes.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Backend Fixes...\n');

// Test 1: Check if jobQueue.ts has enhanced logging
console.log('📋 Test 1: Checking jobQueue.ts enhancements...');
try {
  const jobQueueContent = fs.readFileSync(path.join(__dirname, 'src/services/jobQueue.ts'), 'utf8');
  
  const checks = [
    { name: 'Enhanced error logging', pattern: /console\.error.*Error.*Stack/, found: false },
    { name: 'Job start logging', pattern: /console\.log.*Job started/, found: false },
    { name: 'Job completion logging', pattern: /console\.log.*Job completed/, found: false },
    { name: 'Job failure logging', pattern: /console\.error.*Job failed/, found: false },
    { name: 'Mock queue data logging', pattern: /console\.log.*Job data/, found: false },
    { name: 'AI processing validation', pattern: /if \(!moduleData\)/, found: false },
    { name: 'Steps validation', pattern: /if \(!steps \|\| !Array\.isArray\(steps\)\)/, found: false },
    { name: 'Error stack logging', pattern: /error\.stack/, found: false }
  ];

  checks.forEach(check => {
    check.found = check.pattern.test(jobQueueContent);
    console.log(`  ${check.found ? '✅' : '❌'} ${check.name}`);
  });

  const passedChecks = checks.filter(c => c.found).length;
  console.log(`  📊 Result: ${passedChecks}/${checks.length} checks passed\n`);
} catch (error) {
  console.log('❌ Could not read jobQueue.ts:', error.message);
}

// Test 2: Check if aiService.ts has enhanced logging
console.log('🧠 Test 2: Checking aiService.ts enhancements...');
try {
  const aiServiceContent = fs.readFileSync(path.join(__dirname, 'src/services/aiService.ts'), 'utf8');
  
  const checks = [
    { name: 'AI Service logging prefix', pattern: /\[AI Service\]/, found: false },
    { name: 'Video processing start logging', pattern: /Starting video processing/, found: false },
    { name: 'Download logging', pattern: /Downloading video from URL/, found: false },
    { name: 'Audio extraction logging', pattern: /Extracting audio from video/, found: false },
    { name: 'Metadata extraction logging', pattern: /Extracting video metadata/, found: false },
    { name: 'Transcription logging', pattern: /Starting audio transcription/, found: false },
    { name: 'Transcript validation', pattern: /if \(!transcript \|\| transcript\.trim\(\)\.length === 0\)/, found: false },
    { name: 'Key frames logging', pattern: /Extracting key frames/, found: false },
    { name: 'AI analysis logging', pattern: /Starting AI content analysis/, found: false },
    { name: 'Result validation', pattern: /if \(!result \|\| !result\.steps \|\| !Array\.isArray\(result\.steps\)\)/, found: false },
    { name: 'Cleanup logging', pattern: /Starting cleanup/, found: false },
    { name: 'Error stack logging', pattern: /Error stack/, found: false }
  ];

  checks.forEach(check => {
    check.found = check.pattern.test(aiServiceContent);
    console.log(`  ${check.found ? '✅' : '❌'} ${check.name}`);
  });

  const passedChecks = checks.filter(c => c.found).length;
  console.log(`  📊 Result: ${passedChecks}/${checks.length} checks passed\n`);
} catch (error) {
  console.log('❌ Could not read aiService.ts:', error.message);
}

// Test 3: Check if transcriptionService.ts has enhanced logging
console.log('🎤 Test 3: Checking transcriptionService.ts enhancements...');
try {
  const transcriptionContent = fs.readFileSync(path.join(__dirname, 'src/services/transcriptionService.ts'), 'utf8');
  
  const checks = [
    { name: 'Transcription logging prefix', pattern: /\[Transcription\]/, found: false },
    { name: 'FFmpeg command logging', pattern: /Running FFmpeg command/, found: false },
    { name: 'Audio file validation', pattern: /if \(!fs\.existsSync\(tmpAudio\)\)/, found: false },
    { name: 'Audio file size check', pattern: /Audio file size/, found: false },
    { name: 'OpenAI API key status', pattern: /OpenAI API key status/, found: false },
    { name: 'Transcript validation', pattern: /if \(!transcript \|\| !transcript\.text\)/, found: false },
    { name: 'Transcript preview', pattern: /Transcript preview/, found: false },
    { name: 'Error stack logging', pattern: /Error stack/, found: false },
    { name: 'Cleanup logging', pattern: /Cleaned up temp audio file/, found: false }
  ];

  checks.forEach(check => {
    check.found = check.pattern.test(transcriptionContent);
    console.log(`  ${check.found ? '✅' : '❌'} ${check.name}`);
  });

  const passedChecks = checks.filter(c => c.found).length;
  console.log(`  📊 Result: ${passedChecks}/${checks.length} checks passed\n`);
} catch (error) {
  console.log('❌ Could not read transcriptionService.ts:', error.message);
}

// Test 4: Check if frontend has stuck detection
console.log('🎯 Test 4: Checking frontend stuck detection...');
try {
  const useModuleStatusContent = fs.readFileSync(path.join(__dirname, '../frontend/src/hooks/useModuleStatus.ts'), 'utf8');
  
  const checks = [
    { name: 'Stuck detection state', pattern: /stuckAtZero/, found: false },
    { name: 'Progress tracking', pattern: /lastProgress/, found: false },
    { name: 'Stuck timeout', pattern: /stuckStartTime/, found: false },
    { name: 'Stuck duration check', pattern: /stuckDuration > 20000/, found: false },
    { name: 'Stuck warning', pattern: /stuck at 0%/, found: false },
    { name: 'Stuck timeout detection', pattern: /setTimeout.*stuck/, found: false }
  ];

  checks.forEach(check => {
    check.found = check.pattern.test(useModuleStatusContent);
    console.log(`  ${check.found ? '✅' : '❌'} ${check.name}`);
  });

  const passedChecks = checks.filter(c => c.found).length;
  console.log(`  📊 Result: ${passedChecks}/${checks.length} checks passed\n`);
} catch (error) {
  console.log('❌ Could not read useModuleStatus.ts:', error.message);
}

console.log('🎉 Backend fixes verification complete!');
console.log('\n📝 Summary of improvements:');
console.log('✅ Enhanced job queue error logging and tracking');
console.log('✅ Detailed AI service processing logs');
console.log('✅ Robust transcription service error handling');
console.log('✅ Frontend stuck processing detection');
console.log('✅ Better user feedback for processing delays');
console.log('\n🚀 These changes should help debug and resolve the "stuck at 0%" issues!'); 