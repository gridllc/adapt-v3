// src/lib/healthCheck.ts
// Simple health check that runs on app boot to verify backend connectivity

import { apiFetch } from './api';

export async function checkBackendHealth(): Promise<{ healthy: boolean; message: string }> {
  try {
    console.log('🔍 [HEALTH] Checking backend health...');
    const r = await apiFetch('/api/health');
    
    if (!r.ok) {
      throw new Error(`health ${r.status}`);
    }
    
    const response = await r.json();
    
    if (response?.ok === true) {
      console.log('✅ [HEALTH] Backend health check passed');
      return { healthy: true, message: 'Backend reachable' };
    } else {
      console.warn('⚠️ [HEALTH] Backend health check failed:', response);
      return { healthy: false, message: 'Backend unhealthy' };
    }
  } catch (error) {
    console.error('❌ [HEALTH] Backend health check failed:', error);
    return { 
      healthy: false, 
      message: `Backend unreachable: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

// Run health check on import
if (typeof window !== 'undefined') {
  // Only run in browser, not during SSR
  setTimeout(() => {
    checkBackendHealth().then(({ healthy, message }) => {
      if (healthy) {
        console.log('🚀 [HEALTH] Backend is healthy:', message);
      } else {
        console.warn('⚠️ [HEALTH] Backend issues detected:', message);
      }
    });
  }, 1000); // Wait 1 second after app loads
}
