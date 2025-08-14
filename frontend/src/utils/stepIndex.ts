export function createStepIndexFinder(steps: { start: number; end: number }[]) {
  const starts = steps.map(s => s.start);
  
  return (t: number) => {
    if (!starts.length) return null;
    
    let lo = 0, hi = starts.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (starts[mid] <= t) { 
        ans = mid; 
        lo = mid + 1; 
      } else { 
        hi = mid - 1; 
      }
    }
    
    if (ans < 0) return null;
    return t < steps[ans].end ? ans : null;
  };
}
