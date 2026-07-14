// Web Audio API Synthesizer - 100% offline, zero dependencies, no loaded assets.

let audioCtx = null;
let soundEnabled = true;

/**
 * Initializes the AudioContext on first user interaction.
 */
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume context if suspended (common browser security behavior)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * Procedural woodblock/ticking metronome beep
 */
function playTick(pitch = 1000) {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  // Pitch envelope (fast pitch sweep creates a click/woodblock sound)
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(pitch, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.04);

  // Volume envelope
  gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.06);
}

/**
 * Synthesizes a massive explosion using white noise, low-pass sweep, and decay
 */
function playExplosion() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  // Create a 1.5s white noise buffer
  const bufferSize = audioCtx.sampleRate * 1.5;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  // Lowpass sweep from 1200Hz down to 50Hz for rumble effect
  filter.frequency.setValueAtTime(1200, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 1.2);

  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.4);

  noiseSource.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  // Add a low-frequency synth thump underneath the explosion
  const synthOsc = audioCtx.createOscillator();
  const synthGain = audioCtx.createGain();
  synthOsc.type = 'sine';
  synthOsc.frequency.setValueAtTime(150, audioCtx.currentTime);
  synthOsc.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + 0.5);
  
  synthGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
  synthGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

  synthOsc.connect(synthGain);
  synthGain.connect(audioCtx.destination);

  noiseSource.start(audioCtx.currentTime);
  noiseSource.stop(audioCtx.currentTime + 1.5);
  
  synthOsc.start(audioCtx.currentTime);
  synthOsc.stop(audioCtx.currentTime + 0.6);
}

/**
 * Dissonant dual-oscillator buzzer alarm
 */
function playBuzzer() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'sawtooth';
  
  // Dissonant pairing to sound alarming (180Hz and 183Hz creates beating)
  osc1.frequency.setValueAtTime(180, audioCtx.currentTime);
  osc2.frequency.setValueAtTime(183, audioCtx.currentTime);

  gainNode.gain.setValueAtTime(0.6, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0.6, audioCtx.currentTime + 0.1);
  // Pulsing volume effect
  gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime + 0.25);
  gainNode.gain.setValueAtTime(0.6, audioCtx.currentTime + 0.35);
  gainNode.gain.setValueAtTime(0.6, audioCtx.currentTime + 0.45);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.85);

  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc1.start(audioCtx.currentTime);
  osc2.start(audioCtx.currentTime);
  
  osc1.stop(audioCtx.currentTime + 0.9);
  osc2.stop(audioCtx.currentTime + 0.9);
}

/**
 * Toggle sound setting
 */
function toggleSound(enabled) {
  soundEnabled = enabled;
  localStorage.setItem('settings_sound_enabled', enabled);
  return soundEnabled;
}

// Load initial setting
if (localStorage.getItem('settings_sound_enabled') !== null) {
  soundEnabled = localStorage.getItem('settings_sound_enabled') === 'true';
}

window.AudioSynth = {
  init: initAudio,
  playTick: playTick,
  playExplosion: playExplosion,
  playBuzzer: playBuzzer,
  toggleSound: toggleSound,
  isEnabled: () => soundEnabled
};
