/* audio.js — speech and sound effects, all synthesized. No audio files.
   Every entry point is failure-tolerant: if a browser lacks the API, the game
   simply goes quiet rather than breaking. */
window.Sound = (function () {
  'use strict';

  const PRAISE = ['Nice one!', 'Yes!', 'Great job!', 'You got it!', 'Awesome!',
                  'Well done!', 'Super!', 'Brilliant!'];
  const ENCOURAGEMENT = ['Try again!', 'Almost!', 'Have another go!', 'So close!'];

  let ctx = null;
  let muted = false;
  let voice = null;
  let lastPraise = -1;

  /* Mobile browsers only allow audio to start inside a user gesture, so this
     is called from the first tap on the Start button. */
  function unlock() {
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor && !ctx) ctx = new AudioCtor();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (err) {
      ctx = null;
    }
    pickVoice();
  }

  function pickVoice() {
    if (!window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return;
    /* Local voices only where there is a choice: some cloud voices post the
       utterance to a server, and this game promises to send nothing anywhere.
       The named favourites (Samantha, Karen, Zira) are all on-device. */
    const local = voices.filter(v => v.localService !== false);
    const usable = local.length ? local : voices;

    voice = usable.find(v => /en[-_]/i.test(v.lang) && /female|samantha|karen|zira/i.test(v.name))
         || usable.find(v => /en[-_]/i.test(v.lang))
         || usable[0];
  }

  /* Some embedded webviews expose a partial speechSynthesis stub. */
  try {
    if (window.speechSynthesis && window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
    }
  } catch (err) { /* no voices, no problem */ }

  /* ---- sound effects ----------------------------------------------------- */

  function tone(freq, startOffset, duration, type, peak) {
    if (!ctx || muted) return;
    try {
      const start = ctx.currentTime + startOffset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak || 0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch (err) {
      /* An exhausted or closed AudioContext should never break gameplay. */
    }
  }

  function correct() {
    tone(660, 0, 0.16, 'sine');
    tone(990, 0.09, 0.22, 'sine');
  }

  function wrong() {
    tone(240, 0, 0.16, 'triangle', 0.12);
  }

  function pop() {
    tone(520, 0, 0.08, 'square', 0.07);
  }

  function levelClear() {
    [523, 659, 784, 1047].forEach((freq, i) => tone(freq, i * 0.11, 0.4, 'sine', 0.16));
  }

  function regionClear() {
    [523, 659, 784, 1047, 1319].forEach((freq, i) => tone(freq, i * 0.1, 0.5, 'sine', 0.18));
    tone(392, 0.55, 0.9, 'triangle', 0.14);
  }

  /* ---- speech ------------------------------------------------------------ */

  function speak(text, opts) {
    if (muted || !text || !window.speechSynthesis) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      if (voice) utterance.voice = voice;
      utterance.rate = (opts && opts.rate) || 0.92;
      utterance.pitch = (opts && opts.pitch) || 1.15;
      utterance.volume = 1;
      if (!opts || opts.interrupt !== false) window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      /* Speech is a bonus, never a requirement. */
    }
  }

  /* Read an equation the way a person would, not the way it's punctuated. */
  function speakProblem(problem, game) {
    const spoken = problem.addends.join(' plus ');
    if (game === 'missing') {
      speak(`${problem.addends[0]} plus what makes ${problem.answer}?`);
    } else {
      speak(`${spoken}?`);
    }
  }

  function praise() {
    let index = Math.floor(Math.random() * PRAISE.length);
    if (index === lastPraise) index = (index + 1) % PRAISE.length;
    lastPraise = index;
    speak(PRAISE[index]);
  }

  function encourage() {
    speak(ENCOURAGEMENT[Math.floor(Math.random() * ENCOURAGEMENT.length)]);
  }

  /* ---- mute -------------------------------------------------------------- */

  function setMuted(value) {
    muted = !!value;
    if (muted && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (err) { /* ignore */ }
    }
    return muted;
  }

  function isMuted() { return muted; }

  return {
    unlock, setMuted, isMuted,
    correct, wrong, pop, levelClear, regionClear,
    speak, speakProblem, praise, encourage
  };
})();
