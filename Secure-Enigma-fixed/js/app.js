// app.js — wires the UI to the Enigma engine

// ============ ACCESS CODE GATE ============
// Shared secret both laptops must know. Change this before you deploy, and
// make sure the SAME value is inside your Firestore rules (see the "pin"
// field check) — otherwise the client will let people in but Firestore will
// still reject their reads/writes.
const ACCESS_CODE = "2604";
const UNLOCK_KEY = "enigma_unlocked";

const lockOverlay = document.getElementById("lockOverlay");
const lockInput = document.getElementById("lockInput");
const lockSubmit = document.getElementById("lockSubmit");
const lockError = document.getElementById("lockError");

function tryUnlock() {
  if (lockInput.value === ACCESS_CODE) {
    localStorage.setItem(UNLOCK_KEY, "true");
    lockOverlay.classList.add("hidden");
    lockError.textContent = "";
  } else {
    lockError.textContent = "Wrong code — ask your partner for the current access code.";
    lockInput.value = "";
  }
}

if (localStorage.getItem(UNLOCK_KEY) === "true") {
  lockOverlay.classList.add("hidden");
}
lockSubmit.addEventListener("click", tryUnlock);
lockInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryUnlock();
});

const YOUR_NAME_KEY = "enigma_your_name";

const state = {
  rotorSelection: ["I", "II", "III"],
  ringSettings: ["A", "A", "A"],
  positions: ["C", "M", "R"],
  reflector: "B",
  plugPairs: [],
  yourName: localStorage.getItem(YOUR_NAME_KEY) || "",
  cloudDocs: [],  // raw message docs from Firestore, updated live
  history: [],    // {type, detail, time} — local activity log
};

let liveMachine = buildMachine();

function buildMachine() {
  return new EnigmaMachine(
    state.rotorSelection,
    state.ringSettings,
    state.positions,
    state.reflector,
    state.plugPairs
  );
}

function rebuildLiveMachine() {
  liveMachine = buildMachine();
  updateSystemInfo();
  updateRotorDials();
}

function logHistory(type, detail) {
  state.history.unshift({
    type,
    detail,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  });
  renderHistory();
}

// ============ YOUR IDENTITY ============
const yourNameInput = document.getElementById("yourNameInput");
yourNameInput.value = state.yourName;
yourNameInput.addEventListener("input", () => {
  state.yourName = yourNameInput.value.trim();
  localStorage.setItem(YOUR_NAME_KEY, state.yourName);
  renderInbox();
});

// ============ VIEW NAVIGATION ============
const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.view;
    navItems.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    views.forEach((v) => v.classList.toggle("active", v.id === `view-${target}`));
  });
});

// ============ LAMPBOARD ============
const LAMP_ROWS = ["ABCDEFGHIJKLM", "NOPQRSTUVWXYZ"];
const lampboardEl = document.getElementById("lampboard");
const lamps = {};

LAMP_ROWS.forEach((row) => {
  row.split("").forEach((letter) => {
    const lamp = document.createElement("div");
    lamp.className = "lamp";
    lamp.textContent = letter;
    lamp.id = `lamp-${letter}`;
    lampboardEl.appendChild(lamp);
    lamps[letter] = lamp;
  });
});

function flashLamp(letter) {
  Object.values(lamps).forEach((l) => l.classList.remove("lit"));
  const lamp = lamps[letter];
  if (!lamp) return;
  lamp.classList.add("lit");
  setTimeout(() => lamp.classList.remove("lit"), 350);
}

// ============ ROTOR DIALS ============
const rotorBay = document.getElementById("rotorBay");

function updateRotorDials() {
  rotorBay.innerHTML = "";
  liveMachine.rotors.forEach((rotor, i) => {
    const unit = document.createElement("div");
    unit.className = "rotor-unit";
    unit.innerHTML = `
      <div class="rotor-index">${state.rotorSelection[i]}</div>
      <div class="rotor-dial">${ALPHABET[rotor.position]}</div>
    `;
    rotorBay.appendChild(unit);
  });
}

// ============ KEYBOARD (with spacebar) ============
const KB_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const keyboardEl = document.getElementById("keyboard");

KB_ROWS.forEach((row) => {
  const rowEl = document.createElement("div");
  rowEl.className = "kb-row";
  row.split("").forEach((letter) => {
    const key = document.createElement("button");
    key.className = "key";
    key.textContent = letter;
    key.addEventListener("click", () => pressKey(letter));
    rowEl.appendChild(key);
  });
  keyboardEl.appendChild(rowEl);
});

// Bottom row: Backspace, Space, Enter
const spaceRow = document.createElement("div");
spaceRow.className = "kb-row";

const backspaceKey = document.createElement("button");
backspaceKey.className = "key backspace";
backspaceKey.textContent = "⌫ BACKSPACE";
backspaceKey.addEventListener("click", doBackspace);
spaceRow.appendChild(backspaceKey);

const spaceKey = document.createElement("button");
spaceKey.className = "key space";
spaceKey.textContent = "SPACE";
spaceKey.addEventListener("click", () => pressKey(" "));
spaceRow.appendChild(spaceKey);

const enterKey = document.createElement("button");
enterKey.className = "key enter";
enterKey.textContent = "ENTER ⏎";
enterKey.addEventListener("click", sendBufferToEncryption);
spaceRow.appendChild(enterKey);

keyboardEl.appendChild(spaceRow);

// Typed buffer — the message being composed on the dashboard, independent
// of the live lamp demo, so Backspace/Enter have something real to work on.
let typedBuffer = "";
const typedBufferEl = document.getElementById("typedBuffer");

function renderTypedBuffer() {
  typedBufferEl.innerHTML = typedBuffer
    ? typedBuffer + '<span class="blink">|</span>'
    : '<span class="placeholder">TYPE SOMETHING…</span>';
}

function pressKey(letter) {
  typedBuffer += letter;
  renderTypedBuffer();

  if (letter === " ") {
    flashSpace();
  } else {
    const output = liveMachine.encryptChar(letter);
    flashLamp(output);
  }
  updateRotorDials();
}

function doBackspace() {
  typedBuffer = typedBuffer.slice(0, -1);
  renderTypedBuffer();
  backspaceKey.classList.add("pressed");
  setTimeout(() => backspaceKey.classList.remove("pressed"), 150);
}

function sendBufferToEncryption() {
  if (!typedBuffer.trim()) return;
  document.getElementById("plaintext").value = typedBuffer;
  document.getElementById("ciphertext").value = "";
  document.getElementById("sendStatus").textContent = "";

  navItems.forEach((b) => b.classList.remove("active"));
  const encBtn = [...navItems].find((b) => b.dataset.view === "encryption");
  encBtn.classList.add("active");
  views.forEach((v) => v.classList.toggle("active", v.id === "view-encryption"));

  enterKey.classList.add("pressed");
  setTimeout(() => enterKey.classList.remove("pressed"), 150);
}

function flashSpace() {
  spaceKey.classList.add("pressed");
  setTimeout(() => spaceKey.classList.remove("pressed"), 150);
}

document.addEventListener("keydown", (e) => {
  if (document.activeElement.tagName === "TEXTAREA" || document.activeElement.tagName === "INPUT") return;
  if (!document.getElementById("view-dashboard").classList.contains("active")) return;

  if (e.key === " ") {
    e.preventDefault();
    pressKey(" ");
    return;
  }
  if (e.key === "Backspace") {
    e.preventDefault();
    doBackspace();
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    sendBufferToEncryption();
    return;
  }
  const letter = e.key.toUpperCase();
  if (ALPHABET.includes(letter)) {
    pressKey(letter);
    const keyEl = [...keyboardEl.querySelectorAll(".key")].find((k) => k.textContent === letter);
    if (keyEl) {
      keyEl.classList.add("pressed");
      setTimeout(() => keyEl.classList.remove("pressed"), 150);
    }
  }
});

// ============ ROTOR SELECTION ============
const rotorSelectEl = document.getElementById("rotorSelect");

function renderRotorSelect() {
  rotorSelectEl.querySelectorAll("button").forEach((btn) => {
    const name = btn.dataset.rotor;
    const order = state.rotorSelection.indexOf(name);
    btn.classList.toggle("selected", order !== -1);
    btn.classList.remove("order-1", "order-2", "order-3");
    if (order !== -1) btn.classList.add(`order-${order + 1}`);
  });
}

rotorSelectEl.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const name = btn.dataset.rotor;
    const idx = state.rotorSelection.indexOf(name);
    if (idx !== -1) {
      state.rotorSelection.splice(idx, 1);
    } else {
      if (state.rotorSelection.length >= 3) state.rotorSelection.shift();
      state.rotorSelection.push(name);
    }
    renderRotorSelect();
    if (state.rotorSelection.length === 3) rebuildLiveMachine();
  });
});

// ============ RING SETTINGS & INITIAL POSITIONS ============
const ringSettingsEl = document.getElementById("ringSettings");
const initialPositionsEl = document.getElementById("initialPositions");

function renderSelectsAndInputs() {
  ringSettingsEl.innerHTML = "";
  initialPositionsEl.innerHTML = "";

  for (let i = 0; i < 3; i++) {
    const sel = document.createElement("select");
    ALPHABET.split("").forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l;
      opt.textContent = l;
      if (l === state.ringSettings[i]) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => {
      state.ringSettings[i] = sel.value;
      rebuildLiveMachine();
    });
    ringSettingsEl.appendChild(sel);

    const input = document.createElement("input");
    input.maxLength = 1;
    input.value = state.positions[i];
    input.addEventListener("input", () => {
      const val = input.value.toUpperCase().replace(/[^A-Z]/g, "");
      input.value = val;
      if (val) {
        state.positions[i] = val;
        rebuildLiveMachine();
      }
    });
    initialPositionsEl.appendChild(input);
  }
}

// ============ PLUGBOARD (rendered in both Dashboard machine view + Configuration view) ============
const plugInput = document.getElementById("plugInput");
const addPlugBtn = document.getElementById("addPlugBtn");
const clearPlugsBtn = document.getElementById("clearPlugsBtn");
const plugboardVisual = document.getElementById("plugboardVisual");
const plugboardVisualConfig = document.getElementById("plugboardVisualConfig");
const plugPairCount = document.getElementById("plugPairCount");

function renderPlugboardInto(container) {
  container.innerHTML = "";
  if (state.plugPairs.length === 0) {
    container.innerHTML = `<span class="plug-empty">No pairs configured</span>`;
    return;
  }
  state.plugPairs.forEach(([a, b], i) => {
    const badge = document.createElement("div");
    badge.className = "plug-pair";
    badge.innerHTML = `${a}↔${b} <button data-i="${i}">✕</button>`;
    badge.querySelector("button").addEventListener("click", () => {
      liveMachine.plugboard.removePair(a, b);
      state.plugPairs.splice(i, 1);
      renderPlugboard();
      updateSystemInfo();
    });
    container.appendChild(badge);
  });
}

function renderPlugboard() {
  renderPlugboardInto(plugboardVisual);
  renderPlugboardInto(plugboardVisualConfig);
  plugPairCount.textContent = `(${state.plugPairs.length} pairs)`;
}

addPlugBtn.addEventListener("click", () => {
  const val = plugInput.value.toUpperCase().replace(/[^A-Z]/g, "");
  if (val.length !== 2) return alert("Enter exactly two letters, e.g. AB");
  const [a, b] = val.split("");
  if (liveMachine.plugboard.addPair(a, b)) {
    state.plugPairs.push([a, b]);
    plugInput.value = "";
    renderPlugboard();
    updateSystemInfo();
  } else {
    alert("Invalid or already-used pair (max 10 pairs, no letter twice).");
  }
});

clearPlugsBtn.addEventListener("click", () => {
  state.plugPairs = [];
  rebuildLiveMachine();
  renderPlugboard();
});

// ============ MESSAGE CENTER (Encryption view) ============
const plaintextBox = document.getElementById("plaintext");
const ciphertextBox = document.getElementById("ciphertext");
const recipientInput = document.getElementById("recipientInput");
const sendStatus = document.getElementById("sendStatus");

// ============ WRONG-KEY DETECTION ============
// Real English text has roughly 38-40% vowels and rarely strings together
// more than 3-4 consonants in a row. If a "decrypted" result looks nothing
// like that, the two machines probably aren't on the same Daily Key.
function looksGarbled(text) {
  const letters = text.toUpperCase().replace(/[^A-Z]/g, "");
  if (letters.length < 6) return false; // too short to judge

  const vowels = (letters.match(/[AEIOU]/g) || []).length;
  const vowelRatio = vowels / letters.length;

  let longestConsonantRun = 0;
  let run = 0;
  for (const ch of letters) {
    if ("AEIOU".includes(ch)) {
      run = 0;
    } else {
      run++;
      longestConsonantRun = Math.max(longestConsonantRun, run);
    }
  }

  return vowelRatio < 0.25 || longestConsonantRun >= 5;
}

const keyHint = document.getElementById("keyHint");

document.getElementById("encryptBtn").addEventListener("click", () => {
  const machine = buildMachine(); // fresh machine at configured initial state
  keyHint.textContent = "";
  keyHint.classList.remove("warn");

  if (plaintextBox.value.trim() !== "") {
    ciphertextBox.value = machine.encryptText(plaintextBox.value);
    logHistory("Encrypt", `"${plaintextBox.value}" → "${ciphertextBox.value}"`);
  } else if (ciphertextBox.value.trim() !== "") {
    plaintextBox.value = machine.encryptText(ciphertextBox.value);
    logHistory("Decrypt", `"${ciphertextBox.value}" → "${plaintextBox.value}"`);

    if (looksGarbled(plaintextBox.value)) {
      keyHint.classList.add("warn");
      keyHint.textContent = "⚠ This doesn't look like readable text — your Daily Key (rotors, ring settings, positions, or plugboard) probably doesn't match the sender's.";
    }
  }
});

document.getElementById("clearBtn").addEventListener("click", () => {
  plaintextBox.value = "";
  ciphertextBox.value = "";
  sendStatus.textContent = "";
  keyHint.textContent = "";
  keyHint.classList.remove("warn");
});

document.getElementById("resetMachineBtn").addEventListener("click", () => {
  rebuildLiveMachine();
  plaintextBox.value = "";
  ciphertextBox.value = "";
  sendStatus.textContent = "";
  keyHint.textContent = "";
  keyHint.classList.remove("warn");
  Object.values(lamps).forEach((l) => l.classList.remove("lit"));
  typedBuffer = "";
  renderTypedBuffer();
});

document.getElementById("sendBtn").addEventListener("click", async () => {
  if (!ciphertextBox.value.trim()) {
    sendStatus.style.color = "var(--red)";
    sendStatus.textContent = "Nothing to send — encrypt a message first.";
    return;
  }
  if (!state.yourName) {
    sendStatus.style.color = "var(--red)";
    sendStatus.textContent = "Set \"Your Name\" in Configuration first, so your partner knows who sent this.";
    return;
  }
  if (!window.EnigmaCloud) {
    sendStatus.style.color = "var(--red)";
    sendStatus.textContent = "Cloud sync isn't ready yet — wait a second and try again.";
    return;
  }

  const to = recipientInput.value.trim() || "Partner";
  sendStatus.style.color = "var(--text-mid)";
  sendStatus.textContent = "Sending…";

  try {
    await window.EnigmaCloud.sendMessage({
      from: state.yourName,
      to,
      text: ciphertextBox.value,
      pin: ACCESS_CODE,
    });
    logHistory("Send", `To ${to}: "${ciphertextBox.value}"`);
    sendStatus.style.color = "var(--green-bright)";
    sendStatus.textContent = `Sent to ${to} — it'll appear on their laptop's Inbox in real time.`;
  } catch (err) {
    console.error(err);
    sendStatus.style.color = "var(--red)";
    sendStatus.textContent = "Send failed — check your internet connection and Firestore rules.";
  }
});

// ============ SOUND TOGGLE ============
const SOUND_KEY = "enigma_sound_on";
const soundToggle = document.getElementById("soundToggle");
soundToggle.checked = localStorage.getItem(SOUND_KEY) !== "off";
soundToggle.addEventListener("change", () => {
  localStorage.setItem(SOUND_KEY, soundToggle.checked ? "on" : "off");
});

// Vintage teletype-style double beep, synthesized — no audio file needed.
let audioCtx = null;
function playIncomingBeep() {
  if (!soundToggle.checked) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    [0, 0.12].forEach((delay, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.value = i === 0 ? 880 : 1046.5;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.15, now + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.09);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.1);
    });
  } catch (e) {
    console.warn("Audio playback failed:", e);
  }
}

// ============ INBOX (live from Firestore) ============
const inboxList = document.getElementById("inboxList");
const inboxBadge = document.getElementById("inboxBadge");
const clearInboxBtn = document.getElementById("clearInboxBtn");

clearInboxBtn.addEventListener("click", async () => {
  if (!state.yourName) {
    alert('Set "Your Name" in Configuration first.');
    return;
  }
  if (!window.EnigmaCloud) return;
  if (!confirm("Delete every message you've sent or received? This can't be undone.")) return;

  clearInboxBtn.disabled = true;
  clearInboxBtn.textContent = "CLEARING…";
  try {
    await window.EnigmaCloud.clearMyMessages(state.yourName, ACCESS_CODE);
  } catch (err) {
    console.error(err);
    alert("Couldn't clear messages — check your internet connection.");
  }
  clearInboxBtn.disabled = false;
  clearInboxBtn.textContent = "CLEAR MY MESSAGES";
});

function renderInbox() {
  if (!state.yourName) {
    inboxBadge.textContent = "0";
    inboxList.innerHTML = `<div class="inbox-empty">Set "Your Name" in Configuration to see your messages here.</div>`;
    return;
  }

  const mine = state.cloudDocs.filter(
    (m) => m.from === state.yourName || m.to === state.yourName
  );

  inboxBadge.textContent = mine.length;
  if (mine.length === 0) {
    inboxList.innerHTML = `<div class="inbox-empty">No messages yet. Go to Encryption → encrypt a message → Send Message.</div>`;
    return;
  }

  inboxList.innerHTML = "";
  // newest first
  [...mine].reverse().forEach((msg) => {
    const direction = msg.from === state.yourName ? "sent" : "received";
    const label = direction === "sent" ? `To: ${msg.to}` : `From: ${msg.from}`;
    const time = msg.clientTime
      ? new Date(msg.clientTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";
    const item = document.createElement("div");
    item.className = `inbox-item ${direction}`;
    item.innerHTML = `
      <div class="meta"><span>${label}</span><span>${time}</span></div>
      <div class="cipher">${msg.text}</div>
    `;
    inboxList.appendChild(item);
  });
}

// ============ CLOUD CONNECTION ============
const cloudStatusNote = document.getElementById("cloudStatusNote");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

function startCloudSync() {
  cloudStatusNote.textContent = "Connected — live syncing with Firestore.";
  statusText.textContent = "Cloud Connected";
  statusDot.style.background = "var(--green-bright)";

  let knownIds = null; // null = first snapshot (don't beep on initial load)

  window.EnigmaCloud.subscribeToMessages((docs) => {
    if (knownIds !== null) {
      const newIncoming = docs.filter(
        (d) => !knownIds.has(d.id) && d.to === state.yourName && d.from !== state.yourName
      );
      if (newIncoming.length > 0) playIncomingBeep();
    }
    knownIds = new Set(docs.map((d) => d.id));

    state.cloudDocs = docs;
    renderInbox();
  }, ACCESS_CODE);
}

if (window.EnigmaCloud) {
  startCloudSync();
} else {
  cloudStatusNote.textContent = "Connecting to cloud sync…";
  window.addEventListener("enigma-cloud-ready", startCloudSync, { once: true });
  window.addEventListener("enigma-cloud-error", () => {
    cloudStatusNote.textContent = "Cloud sync error — check your internet or Firestore rules.";
    statusText.textContent = "Cloud Error";
    statusDot.style.background = "var(--red)";
  });
}

// ============ HISTORY ============
const historyList = document.getElementById("historyList");

function renderHistory() {
  if (state.history.length === 0) {
    historyList.innerHTML = `<div class="inbox-empty">No activity yet.</div>`;
    return;
  }
  historyList.innerHTML = "";
  state.history.forEach((h) => {
    const item = document.createElement("div");
    item.className = "inbox-item";
    item.innerHTML = `
      <div class="meta"><span>${h.type}</span><span>${h.time}</span></div>
      <div class="cipher">${h.detail}</div>
    `;
    historyList.appendChild(item);
  });
}

// ============ SYSTEM INFO ============
function updateSystemInfo() {
  document.getElementById("infoRotors").textContent = state.rotorSelection.join(" - ");
  document.getElementById("infoRing").textContent = state.ringSettings.join(" - ");
  document.getElementById("infoPosition").textContent = liveMachine.getRotorPositions().join(" - ");
  document.getElementById("infoPlugboard").textContent = `${state.plugPairs.length} Pairs`;
}

// ============ INIT ============
renderTypedBuffer();
renderRotorSelect();
renderSelectsAndInputs();
renderPlugboard();
renderInbox();
renderHistory();
updateSystemInfo();
updateRotorDials();
