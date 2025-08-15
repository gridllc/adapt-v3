export async function primeMicOnce(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return false;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false
  });
    // stop immediately; we only wanted the permission
    stream.getTracks().forEach(t => t.stop());
    localStorage.setItem("mic_ok", "1");      // remember for later pages
    return true;
  } catch (e) {
    localStorage.removeItem("mic_ok");
    return false;
  }
}
