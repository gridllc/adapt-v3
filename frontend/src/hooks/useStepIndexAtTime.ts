import { useEffect, useRef, useState } from 'react';

export function useStepIndexAtTime(
  getIndexAt: (time: number) => number | null,
  getCurrentTime: () => number,
  enabled = true
) {
  const [index, setIndex] = useState<number | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    
    const loop = () => {
      const t = getCurrentTime();
      setIndex(getIndexAt(t));
      raf.current = requestAnimationFrame(loop);
    };
    
    raf.current = requestAnimationFrame(loop);
    
    return () => { 
      if (raf.current) cancelAnimationFrame(raf.current); 
    };
  }, [getIndexAt, getCurrentTime, enabled]);

  return index;
}
