// Som de "nova mensagem" sintetizado via Web Audio API (sem arquivo de áudio).

const KEY = "vc_sound";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function isSoundEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(KEY) !== "off";
}

export function setSoundEnabled(on: boolean): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, on ? "on" : "off");
  if (on) unlockAudio();
}

/** Libera o áudio após um gesto do usuário (política de autoplay). */
export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

/** Toca um "pop" curto e suave de nova mensagem. */
export function playMessageSound(): void {
  if (!isSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});

  const now = c.currentTime;
  const notes = [
    { f: 880, t: 0 },
    { f: 1174, t: 0.08 },
  ];
  for (const n of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = n.f;
    gain.gain.setValueAtTime(0.0001, now + n.t);
    gain.gain.exponentialRampToValueAtTime(0.16, now + n.t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + 0.18);
    osc.connect(gain).connect(c.destination);
    osc.start(now + n.t);
    osc.stop(now + n.t + 0.2);
  }
}
