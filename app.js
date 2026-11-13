const beatCells = [...document.querySelectorAll(".beat-cell")];
const beatHeadings = [...document.querySelectorAll(".beat-heading")];
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
let visualTimers = new Set();
let isPlaying = false;
let nextBeatTime = 0;
let beatIndex = 0;
let patternDeck = [];
let lastPatternKey;

const noteFigures = {
  quarter: '<svg class="note-figure" viewBox="0 0 28 34" aria-hidden="true"><ellipse cx="10" cy="26" rx="7" ry="5.1" transform="rotate(-20 10 26)"></ellipse><path d="M16 25V3h2v22z"></path></svg>',
  eighths: '<svg class="note-figure note-pair" viewBox="0 0 40 34" aria-hidden="true"><path d="M15 4h22v5H15z"></path><path d="M15 8h2v17h-2zM35 8h2v14h-2z"></path><ellipse cx="10" cy="26" rx="7" ry="5.1" transform="rotate(-20 10 26)"></ellipse><ellipse cx="30" cy="23" rx="7" ry="5.1" transform="rotate(-20 30 23)"></ellipse></svg>',
};

function createPattern() {
  if (patternDeck.length === 0) {
    patternDeck = [];
    for (const hihat of ["quarters", "eighths"]) {
      for (const firstKick of ["quarter", "eighths"]) {
        for (const secondKick of ["quarter", "eighths"]) {
          patternDeck.push({ hihat, kick: [firstKick, secondKick] });
        }
      }
    }

    for (let index = patternDeck.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [patternDeck[index], patternDeck[swapIndex]] = [patternDeck[swapIndex], patternDeck[index]];
    }

    if (patternDeck.at(-1) && getPatternKey(patternDeck.at(-1)) === lastPatternKey) {
      const swapIndex = Math.floor(Math.random() * (patternDeck.length - 1));
      [patternDeck[swapIndex], patternDeck[patternDeck.length - 1]] = [patternDeck[patternDeck.length - 1], patternDeck[swapIndex]];
    }
  }

  const nextPattern = patternDeck.pop();
  lastPatternKey = getPatternKey(nextPattern);
  return nextPattern;
}

function getPatternKey(rhythm) {
  return `${rhythm.hihat}:${rhythm.kick[0]}:${rhythm.kick[1]}`;
}

function renderPattern() {
  document.querySelectorAll('[data-instrument="hihat"]').forEach((element) => {
    const isEighths = pattern.hihat === "eighths";
    setNotation(element, isEighths ? "eighths" : "quarter", `Hi-hat: ${isEighths ? "dos corcheas" : "negra"}`);
  });

  document.querySelectorAll('[data-instrument="snare"]').forEach((element, index) => {
    const playsSnare = index === 1 || index === 3;
    setNotation(element, playsSnare ? "quarter" : null, playsSnare ? "Caja: negra" : "Caja: silencio");
  });

  document.querySelectorAll('[data-instrument="kick"]').forEach((element, index) => {
    const kickPattern = index === 0 ? pattern.kick[0] : index === 2 ? pattern.kick[1] : null;
    setNotation(element, kickPattern, kickPattern === "eighths" ? "Bombo: dos corcheas" : kickPattern ? "Bombo: negra" : "Bombo: silencio");
  });
}

function setNotation(element, figure, label) {
  element.innerHTML = figure
    ? noteFigures[figure]
    : '<span class="rest-mark" aria-hidden="true">—</span>';
  element.setAttribute("aria-label", label);
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
      ? "Nuevo ritmo"
      : "Ritmo en reproducción";
  measureCount.textContent = `${measure} / 4`;
  measureDots.forEach((dot, index) => {
    dot.classList.toggle("is-complete", index < measure);
    dot.classList.toggle("is-current", index === measure - 1 && measure < 4);
  });
}

function setActiveBeat(index, isFirstMeasure = false) {
  beatCells.forEach((cell) => {
    const isActive = Number(cell.dataset.beat) === index;
    cell.classList.toggle("is-active", isActive);
    cell.classList.toggle("is-first-measure", isActive && isFirstMeasure);
  });
  beatHeadings.forEach((heading) => {
    const isActive = Number(heading.dataset.beat) === index;
    heading.classList.toggle("is-active", isActive);
    heading.classList.toggle("is-first-measure", isActive && isFirstMeasure);
  });
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
    visualTimers.delete(timer);
    const measure = Math.floor((index % 16) / 4) + 1;
    setMeasure(measure);
    setActiveBeat(index % 4, measure === 1);
  }, delay);
  visualTimers.add(timer);
}

function scheduleBeats() {
  while (nextBeatTime < audioContext.currentTime + 0.1) {
    const index = beatIndex;
    if (index > 0 && index % 16 === 0) {
      pattern = createPattern();
      renderPattern();
    }
    const duration = 60 / Number(tempoSlider.value);
    const beatTime = nextBeatTime;
    playClick(beatTime, index % 4 === 0);
    scheduleDrums(index, duration);
    scheduleVisuals(index, beatTime);
    beatIndex += 1;
    nextBeatTime += duration;
  }
}

function stopPlayback() {
  isPlaying = false;
  window.clearInterval(schedulerId);
  visualTimers.forEach((timer) => window.clearTimeout(timer));
  visualTimers.clear();
  setActiveBeat(-1);
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
  visualTimers.clear();
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
