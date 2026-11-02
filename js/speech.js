// Read captions aloud (off by default) and the optional soft chime.
// Both fail silently: no voice offline, no audio, nothing happens.

function pickVoice() {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    const en = voices.filter((v) => /^en[-_]/i.test(v.lang) || v.lang === 'en');
    const local = (list) => list.filter((v) => v.localService !== false);
    return (
      local(en).find((v) => /^en[-_]AU/i.test(v.lang)) ||
      en.find((v) => /^en[-_]AU/i.test(v.lang)) ||
      local(en).find((v) => /^en[-_]GB/i.test(v.lang)) ||
      local(en)[0] || en[0] || null
    );
  } catch {
    return null;
  }
}

export function speak(text) {
  try {
    if (!text || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    const synth = window.speechSynthesis;
    const voice = pickVoice();
    if (!voice) return; // no English voice available (e.g. offline): stay quiet
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.9;
    u.onerror = () => {};
    synth.speak(u);
  } catch {
    /* fail silently */
  }
}

// Voices load asynchronously in some browsers.
try {
  if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
} catch { /* ignore */ }

let ctx;
export function chime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    [659.25, 987.77].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.12);
      o.stop(t + i * 0.12 + 1);
    });
  } catch {
    /* fail silently */
  }
}
