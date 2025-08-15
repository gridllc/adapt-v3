// src/lib/micPrime.ts
export async function primeMicOnce(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    stream.getTracks().forEach(t => t.stop()); // close immediately
    localStorage.setItem("mic_ok", "1");
    return true;
  } catch {
    localStorage.removeItem("mic_ok");
    return false;
  }
}
