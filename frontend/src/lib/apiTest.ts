// src/lib/apiTest.ts
// Simple API test utility to verify the new API helper is working correctly

import { apiFetch, apiUrl } from './api';

export async function testApiConnectivity() {
  console.log('🧪 [API TEST] Starting API connectivity test...');
  
  try {
    // Test 1: Check if we can reach the health endpoint
    console.log('🧪 [API TEST] Testing health endpoint...');
    const healthResponse = await apiFetch('/api/health');
    if (!healthResponse.ok) throw new Error(`health ${healthResponse.status}`);
    const healthData = await healthResponse.json();
    console.log('✅ [API TEST] Health endpoint working:', healthData);
    
    // Test 2: Check if we can reach the modules endpoint
    console.log('🧪 [API TEST] Testing modules endpoint...');
    const modulesResponse = await apiFetch('/api/modules');
    if (!modulesResponse.ok) throw new Error(`modules ${modulesResponse.status}`);
    const modulesData = await modulesResponse.json();
    console.log('✅ [API TEST] Modules endpoint working:', {
      success: modulesData?.success,
      moduleCount: modulesData?.modules?.length || 0
    });
    
    console.log('🎉 [API TEST] All API tests passed!');
    return true;
  } catch (error) {
    console.error('❌ [API TEST] API test failed:', error);
    return false;
  }
}

// Test URL construction
export function testUrlConstruction() {
  console.log('🧪 [URL TEST] Testing URL construction...');
  
  const testPaths = [
    '/api/health',
    'api/health',
    '/api/modules',
    'api/modules',
    '/api/modules/123',
    'api/modules/123'
  ];
  
  testPaths.forEach(path => {
    const url = apiUrl(path);
    console.log(`🔗 [URL TEST] ${path} -> ${url}`);
  });
}

// Run tests on import (only in browser)
if (typeof window !== 'undefined') {
  setTimeout(() => {
    console.log('🧪 [API TEST] Running API tests...');
    testUrlConstruction();
    testApiConnectivity();
  }, 2000); // Wait 2 seconds after app loads
}
