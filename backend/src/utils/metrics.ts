// Simple metrics tracking for AI failures and fallback usage
export const metrics = {
  ai_failures: new Map<string, number>(),
  fallback_usage: new Map<string, number>(),
  total_requests: 0,
  successful_ai: 0,
  
  incFailure(reason: string) {
    this.ai_failures.set(reason, (this.ai_failures.get(reason) ?? 0) + 1);
  },
  
  incFallback(source: string) {
    this.fallback_usage.set(source, (this.fallback_usage.get(source) ?? 0) + 1);
  },
  
  incRequest() {
    this.total_requests++;
  },
  
  incSuccessfulAI() {
    this.successful_ai++;
  },
  
  getStats() {
    return {
      total_requests: this.total_requests,
      successful_ai: this.successful_ai,
      ai_failures: Object.fromEntries(this.ai_failures),
      fallback_usage: Object.fromEntries(this.fallback_usage),
      success_rate: this.total_requests > 0 ? (this.successful_ai / this.total_requests * 100).toFixed(1) + '%' : '0%',
    };
  },
  
  reset() {
    this.ai_failures.clear();
    this.fallback_usage.clear();
    this.total_requests = 0;
    this.successful_ai = 0;
  }
};
