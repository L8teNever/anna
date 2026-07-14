/**
 * Gemeinsames Sound-Utility. Erzeugt Töne per Web Audio API statt fester
 * MP3-Dateien – dadurch gibt es keine zusätzlichen Binär-Assets, die
 * gecacht/ausgeliefert werden müssen, und jedes Spiel kann eigene Sounds
 * durch simple Frequenz/Dauer-Kombinationen zusammensetzen.
 * Respektiert die Sound-Einstellung aus storage.js.
 */
(function (root) {
  let ctx = null;

  function ensureContext() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function isEnabled() {
    return root.Storage ? root.Storage.getSettings().soundEnabled : true;
  }

  function tone({ freq = 440, duration = 0.12, type = "sine", volume = 0.2, delay = 0 }) {
    if (!isEnabled()) return;
    const audioCtx = ensureContext();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;

    const startAt = audioCtx.currentTime + delay;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(volume, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  }

  function noiseBurst({ duration = 0.6, volume = 0.5, delay = 0 }) {
    if (!isEnabled()) return;
    const audioCtx = ensureContext();
    if (!audioCtx) return;

    const startAt = audioCtx.currentTime + delay;
    const bufferSize = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, startAt);
    filter.frequency.exponentialRampToValueAtTime(80, startAt + duration);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    noise.connect(filter).connect(gain).connect(audioCtx.destination);
    noise.start(startAt);
    noise.stop(startAt + duration + 0.02);
  }

  root.Sound = {
    unlock() {
      ensureContext();
    },
    tick(pitch = 880) {
      tone({ freq: pitch, duration: 0.08, type: "square", volume: 0.15 });
    },
    beep(freq = 660, duration = 0.15) {
      tone({ freq, duration, type: "sine", volume: 0.2 });
    },
    success() {
      tone({ freq: 523.25, duration: 0.12, volume: 0.2 });
      tone({ freq: 659.25, duration: 0.12, volume: 0.2, delay: 0.1 });
      tone({ freq: 783.99, duration: 0.18, volume: 0.2, delay: 0.2 });
    },
    say(text) {
      if (!isEnabled() || !("speechSynthesis" in window)) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "de-DE";
      window.speechSynthesis.speak(utterance);
    },
    boom() {
      noiseBurst({ duration: 0.7, volume: 0.6 });
      tone({ freq: 90, duration: 0.5, type: "sawtooth", volume: 0.3 });
    },
  };
})(window);
