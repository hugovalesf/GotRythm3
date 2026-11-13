const beatCards = [...document.querySelectorAll(".beat-card")];
const measureDots = [...document.querySelectorAll(".progress-dot")];
const tempoSlider = document.querySelector("#tempo");
const tempoValue = document.querySelector("#tempo-value");
const measureLabel = document.querySelector("#measure-label");
const measureCount = document.querySelector("#measure-count");
const startButton = document.querySelector("#start-button");
const newPatternButton = document.querySelector("#new-pattern");
const exercise = document.querySelector(".exercise");

let pattern;
let audioContext;
let noiseBuffer;
let schedulerId;
let completionId;
let visualTimers = [];
let isPlaying = false;
let nextBeatTime = 0;
let beatIndex = 0;

function randomChoice(options) {
  return options[Math.floor(Math.random() * options.length)];
}

function createPattern() {
  return {
    hihat: randomChoice(["quarters", "eighths"]),
    kick: [randomChoice(["quarter", "eighths"]), randomChoice(["quarter", "eighths"])],
  };
}

function renderPattern() {
  document.querySelectorAll('[data-instrument="hihat"]').forEach((element) => {
    element.textContent = pattern.hihat === "quarters" ? "♩" : "♪♪";
    element.classList.remove("is-rest");
  });

  document.querySelectorAll('[data-instrument="snare"]').forEach((element, index) => {
    const playsSnare = index === 1 || index === 3;
    element.textContent = playsSnare ? "♩" : "—";
    element.classList.toggle("is-rest", !playsSnare);
  });

  document.querySelectorAll('[data-instrument="kick"]').forEach((element, index) => {
    const kickPattern = index === 0 ? pattern.kick[0] : index === 2 ? pattern.kick[1] : null;
    element.textContent = kickPattern === "quarter" ? "♩" : kickPattern === "eighths" ? "♪♪" : "—";
    element.classList.toggle("is-rest", !kickPattern);
  });
}

function updateTempo() {
  const tempo = Number(tempoSlider.value);
  tempoValue.innerHTML = `${tempo} <span>BPM</span>`;
  const progress = ((tempo - Number(tempoSlider.min)) / (Number(tempoSlider.max) - Number(tempoSlider.min))) * 100;
  tempoSlider.style.background = `linear-gradient(to right, #a9dc61 0%, #a9dc61 ${progress}%, #e5e9e0 ${progress}%, #e5e9e0 100%)`;
}

function setMeasure(measure) {
  measureLabel.textContent = measure === 0
    ? "Listo para empezar"
    : measure === 1
      ? "Escucha el ritmo"
      : measure < 4
        ? "Repite el ritmo"
        : "Ejercicio completado";
  measureCount.textContent = `${measure} / 4`;
  measureDots.forEach((dot, index) => {
    dot.classList.toggle("is-complete", index < measure);
    dot.classList.toggle("is-current", index === measure - 1 && measure < 4);
  });
}

function setActiveBeat(index) {
  beatCards.forEach((card, beat) => card.classList.toggle("is-active", beat === index));
}

function getNoiseBuffer() {
  if (!noiseBuffer) {
    const bufferSize = audioContext.sampleRate;
    noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let index = 0; index < bufferSize; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

function playClick(time, accented) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(accented ? 1320 : 930, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(accented ? 0.17 : 0.105, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.05);
}

function playKick(time) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(145, time);
  oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.12);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.85, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.19);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.2);
}

function playNoise(time, duration, cutoff, volume) {
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  source.buffer = getNoiseBuffer();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(cutoff, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  source.start(time);
  source.stop(time + duration);
}

function playSnare(time) {
  playNoise(time, 0.14, 1500, 0.34);
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(185, time);
  gain.gain.setValueAtTime(0.14, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.1);
}

function playHiHat(time) {
  playNoise(time, 0.045, 7600, 0.19);
}

function scheduleDrums(index, beatDuration) {
  const beatInMeasure = index % 4;
  const isFirstMeasure = index < 4;

  if (!isFirstMeasure) return;

  if (pattern.hihat === "quarters") {
    playHiHat(nextBeatTime);
  } else {
    playHiHat(nextBeatTime);
    playHiHat(nextBeatTime + beatDuration / 2);
  }

  if (beatInMeasure === 1 || beatInMeasure === 3) {
    playSnare(nextBeatTime);
  }

  if (beatInMeasure === 0 || beatInMeasure === 2) {
    const kickPattern = pattern.kick[beatInMeasure === 0 ? 0 : 1];
    if (kickPattern === "quarter") {
      playKick(nextBeatTime);
    } else {
      playKick(nextBeatTime);
      playKick(nextBeatTime + beatDuration / 2);
    }
  }
}

function scheduleVisuals(index, time) {
  const delay = Math.max(0, (time - audioContext.currentTime) * 1000);
  const timer = window.setTimeout(() => {
    const measure = Math.floor(index / 4);
    setMeasure(measure + 1);
    setActiveBeat(index % 4);
  }, delay);
  visualTimers.push(timer);
}

function scheduleBeats() {
  while (beatIndex < 16 && nextBeatTime < audioContext.currentTime + 0.1) {
    const index = beatIndex;
    const duration = 60 / Number(tempoSlider.value);
    const beatTime = nextBeatTime;
    playClick(beatTime, index % 4 === 0);
    scheduleDrums(index, duration);
    scheduleVisuals(index, beatTime);
    beatIndex += 1;
    nextBeatTime += duration;

    if (beatIndex === 16) {
      completionId = window.setTimeout(finishPlayback, Math.max(0, (nextBeatTime - audioContext.currentTime) * 1000));
    }
  }

  if (beatIndex === 16) {
    window.clearInterval(schedulerId);
  }
}

function finishPlayback() {
  stopPlayback();
  setMeasure(4);
  setActiveBeat(-1);
}

function stopPlayback() {
  isPlaying = false;
  window.clearInterval(schedulerId);
  window.clearTimeout(completionId);
  visualTimers.forEach((timer) => window.clearTimeout(timer));
  visualTimers = [];
  beatCards.forEach((card) => card.classList.remove("is-active"));
  exercise.classList.remove("is-playing");
  startButton.innerHTML = '<span class="play-icon" aria-hidden="true"></span> Empezar';
  newPatternButton.disabled = false;
}

async function startPlayback() {
  if (isPlaying) {
    stopPlayback();
    setMeasure(0);
    return;
  }

  try {
    audioContext ??= new window.AudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
  } catch (error) {
    measureLabel.textContent = "No se pudo iniciar el audio";
    console.error("No se pudo iniciar el audio del ejercicio.", error);
    return;
  }

  isPlaying = true;
  beatIndex = 0;
  visualTimers = [];
  exercise.classList.add("is-playing");
  startButton.innerHTML = '<span class="stop-icon" aria-hidden="true"></span> Detener';
  newPatternButton.disabled = true;
  setMeasure(0);
  nextBeatTime = audioContext.currentTime + 0.08;
  scheduleBeats();
  schedulerId = window.setInterval(scheduleBeats, 25);
}

newPatternButton.addEventListener("click", () => {
  pattern = createPattern();
  renderPattern();
  setMeasure(0);
  setActiveBeat(-1);
});

startButton.addEventListener("click", startPlayback);
tempoSlider.addEventListener("input", updateTempo);

pattern = createPattern();
renderPattern();
updateTempo();
