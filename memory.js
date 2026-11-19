const figures = [
  {
    id: "quarter",
    name: "Negra",
    color: "#f5a942",
    svg: '<svg viewBox="0 0 100 120" aria-hidden="true"><ellipse cx="32" cy="93" rx="24" ry="17" transform="rotate(-20 32 93)"></ellipse><path d="M53 88V15h8v73z"></path></svg>',
  },
  {
    id: "eighth",
    name: "Corchea",
    color: "#9673d6",
    svg: '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M48 18h59v12H48z"></path><path d="M48 26h7v58h-7zM100 26h7v48h-7z"></path><ellipse cx="31" cy="94" rx="23" ry="16" transform="rotate(-20 31 94)"></ellipse><ellipse cx="83" cy="81" rx="23" ry="16" transform="rotate(-20 83 81)"></ellipse></svg>',
  },
  {
    id: "sixteenth",
    name: "Semicorchea",
    color: "#56a9d8",
    svg: '<svg viewBox="0 0 140 120" aria-hidden="true"><path d="M27 17h103v11H27zM27 37h103v11H27z"></path><path d="M27 24h7v58h-7zM58 24h7v47h-7zM89 24h7v36h-7zM120 24h7v25h-7z"></path><ellipse cx="15" cy="93" rx="18" ry="14" transform="rotate(-20 15 93)"></ellipse><ellipse cx="46" cy="80" rx="18" ry="14" transform="rotate(-20 46 80)"></ellipse><ellipse cx="77" cy="69" rx="18" ry="14" transform="rotate(-20 77 69)"></ellipse><ellipse cx="108" cy="58" rx="18" ry="14" transform="rotate(-20 108 58)"></ellipse></svg>',
  },
  {
    id: "rest",
    name: "Silencio",
    color: "#e879a8",
    svg: '<svg viewBox="0 0 100 120" aria-hidden="true"><path d="M27 27h50v12H42l28 30c6 7 9 14 9 22 0 15-12 25-29 25-14 0-25-6-33-16l12-10c6 8 13 12 22 12 9 0 15-5 15-12 0-5-3-10-8-16L27 43z"></path></svg>',
  },
  {
    id: "half",
    name: "Blanca",
    color: "#e5b832",
    svg: '<svg viewBox="0 0 100 120" aria-hidden="true"><ellipse cx="32" cy="93" rx="23" ry="16" transform="rotate(-20 32 93)" fill="none" stroke-width="9"></ellipse><path d="M53 88V15h8v73z"></path></svg>',
  },
];

const board = document.querySelector("#board");
const attemptCount = document.querySelector("#attempt-count");
const pairCount = document.querySelector("#pair-count");
const gameMessage = document.querySelector("#game-message");
const restartButton = document.querySelector("#restart-button");

const beatDuration = 0.48;
let audioContext;
let noiseBuffer;
let selection = [];
let attempts = 0;
let matchedPairs = 0;
let locked = false;
let finished = false;
let finaleTimers = [];
let mismatchTimer;

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function createCard(item, index) {
  const card = document.createElement("button");
  card.className = "memory-card";
  card.type = "button";
  card.dataset.figure = item.id;
  card.dataset.index = String(index);
  card.setAttribute("aria-label", `Carta ${index + 1}, boca abajo`);
  card.innerHTML = `
    <span class="card-inner">
      <span class="card-face card-back" aria-hidden="true"><span>♪</span><span>♫</span></span>
      <span class="card-face card-front figure-card" style="color:${item.color}" aria-hidden="true">${item.svg}</span>
      <span class="card-face card-front name-card" style="color:${item.color}" aria-hidden="true">${item.name}</span>
    </span>`;
  card.addEventListener("click", () => selectCard(card));
  return card;
}

function startNewGame() {
  window.clearTimeout(mismatchTimer);
  finaleTimers.forEach((timer) => window.clearTimeout(timer));
  finaleTimers = [];
  selection = [];
  attempts = 0;
  matchedPairs = 0;
  locked = false;
  finished = false;
  attemptCount.textContent = "0";
  pairCount.textContent = "0";
  gameMessage.textContent = "¡Busca las cinco parejas!";
  gameMessage.classList.remove("is-win");
  board.replaceChildren();

  const cards = shuffle(figures.flatMap((figure) => [
    { ...figure, side: "figure" },
    { ...figure, side: "name" },
  ]));
  cards.forEach((item, index) => {
    const card = createCard(item, index);
    card.dataset.side = item.side;
    if (item.side === "name") {
      card.querySelector(".figure-card").remove();
    } else {
      card.querySelector(".name-card").remove();
    }
    board.append(card);
  });
}

function getAudioContext() {
  audioContext ??= new window.AudioContext();
  return audioContext;
}

function getNoiseBuffer(context) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== context.sampleRate) {
    noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

function playTambourine(time, context = getAudioContext(), volume = 0.24) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = getNoiseBuffer(context);
  filter.type = "highpass";
  filter.frequency.setValueAtTime(3600, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(time);
  source.stop(time + 0.14);

  for (const [frequency, level] of [[4200, 0.12], [6100, 0.08], [7900, 0.06]]) {
    const oscillator = context.createOscillator();
    const ring = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, time);
    ring.gain.setValueAtTime(level * volume, time);
    ring.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    oscillator.connect(ring);
    ring.connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.13);
  }
}

function playFigure(figureId, startTime, context = getAudioContext(), speed = beatDuration) {
  if (figureId === "quarter") {
    playTambourine(startTime, context);
  } else if (figureId === "eighth") {
    playTambourine(startTime, context);
    playTambourine(startTime + speed / 2, context);
  } else if (figureId === "sixteenth") {
    for (let hit = 0; hit < 4; hit += 1) {
      playTambourine(startTime + (speed * hit) / 4, context);
    }
  } else if (figureId === "half") {
    for (let hit = 0; hit < 8; hit += 1) {
      playTambourine(startTime + (speed * hit) / 4, context, 0.2);
    }
  }
}

async function playCardSound(figureId) {
  try {
    const context = getAudioContext();
    if (context.state === "suspended") {
      await context.resume();
    }
    playFigure(figureId, context.currentTime + 0.02);
  } catch (error) {
    gameMessage.textContent = "No se pudo iniciar el sonido. Comprueba el audio del dispositivo.";
    console.error("No se pudo reproducir el sonido de la figura.", error);
  }
}

function revealCard(card) {
  card.classList.add("is-open");
  const label = card.dataset.side === "figure"
    ? `Figura ${figures.find((figure) => figure.id === card.dataset.figure).name}`
    : figures.find((figure) => figure.id === card.dataset.figure).name;
  card.setAttribute("aria-label", label);
}

function selectCard(card) {
  if (locked || finished || card.classList.contains("is-open") || card.classList.contains("is-matched")) {
    return;
  }

  revealCard(card);
  void playCardSound(card.dataset.figure);
  selection.push(card);

  if (selection.length < 2) {
    return;
  }

  attempts += 1;
  attemptCount.textContent = String(attempts);
  const [first, second] = selection;
  if (first.dataset.figure === second.dataset.figure && first.dataset.side !== second.dataset.side) {
    first.classList.add("is-matched");
    second.classList.add("is-matched");
    first.setAttribute("aria-label", `Pareja encontrada: ${figures.find((figure) => figure.id === first.dataset.figure).name}`);
    second.setAttribute("aria-label", `Pareja encontrada: ${figures.find((figure) => figure.id === second.dataset.figure).name}`);
    selection = [];
    matchedPairs += 1;
    pairCount.textContent = String(matchedPairs);
    gameMessage.textContent = "¡Muy bien! ¡Has encontrado una pareja!";
    if (matchedPairs === figures.length) {
      finishGame();
    }
    return;
  }

  locked = true;
  first.classList.add("is-wrong");
  second.classList.add("is-wrong");
  gameMessage.textContent = "¡Uy! Esas cartas no son pareja. ¡Prueba otra vez!";
  mismatchTimer = window.setTimeout(() => {
    for (const selected of selection) {
      selected.classList.remove("is-open", "is-wrong");
      selected.setAttribute("aria-label", `Carta ${Number(selected.dataset.index) + 1}, boca abajo`);
    }
    selection = [];
    locked = false;
    if (!finished) {
      gameMessage.textContent = "¡Sigue buscando las parejas!";
    }
    mismatchTimer = undefined;
  }, 900);
}

function finishGame() {
  finished = true;
  locked = true;
  gameMessage.textContent = `¡Lo has conseguido en ${attempts} intentos! ¡A bailar!`;
  gameMessage.classList.add("is-win");
  const cards = [...board.querySelectorAll(".memory-card")];
  const context = getAudioContext();
  const startTime = context.currentTime + 0.08;
  const fastBeat = 0.22;
  const rhythm = ["quarter", "eighth", "sixteenth", "rest", "half"];

  for (let cycle = 0; cycle < 3; cycle += 1) {
    let beat = 0;
    for (const figure of rhythm) {
      const time = startTime + (cycle * 6 + beat) * fastBeat;
      playFigure(figure, time, context, fastBeat);
      beat += figure === "half" ? 2 : 1;
    }
  }

  const flipInterval = 110;
  const flipCount = Math.ceil(((3 * 6 * fastBeat) + 0.5) * 1000 / flipInterval);
  for (let turn = 0; turn < flipCount; turn += 1) {
    finaleTimers.push(window.setTimeout(() => {
      const card = cards[Math.floor(Math.random() * cards.length)];
      card.classList.toggle("is-finale-flipped");
    }, turn * flipInterval));
  }
  finaleTimers.push(window.setTimeout(() => {
    cards.forEach((card) => card.classList.remove("is-finale-flipped"));
  }, flipCount * flipInterval));
}

restartButton.addEventListener("click", startNewGame);
startNewGame();
