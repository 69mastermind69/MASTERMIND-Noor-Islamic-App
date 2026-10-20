
/* =========================================================
   NOOR ISLAMIC APP
   Developer MASTERMIND
   Main JavaScript — Offline-first application
========================================================= */

"use strict";

/* =========================================================
   1. HELPERS AND LOCAL STORAGE
========================================================= */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

const KEYS = {
  pinSalt: "noor_pin_salt",
  pinHash: "noor_pin_hash",
  notes: "noor_notes",
  prayers: "noor_prayer_log",
  tasbih: "noor_tasbih",
  tasbihTarget: "noor_tasbih_target",
  settings: "noor_settings",
  city: "noor_city",
  worldCities: "noor_world_cities"
};

const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

function bnNumber(value) {
  return String(value).replace(/\d/g, digit =>
    BENGALI_DIGITS[Number(digit)]
  );
}

function readText(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeText(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function showMessage(element, message, isError = false) {
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error", isError);
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  return new Date(`${key}T12:00:00`);
}

function formatDate(date, options = {}) {
  try {
    return new Intl.DateTimeFormat("bn-BD", options).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

function formatDateKey(key) {
  return formatDate(dateFromKey(key), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function safeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}


/* =========================================================
   2. APP SETTINGS
========================================================= */

let settings = {
  theme: "emerald",
  timeFormat: "24",
  weekStart: "saturday"
};

function loadSettings() {
  const saved = readJSON(KEYS.settings, {});

  settings = {
    ...settings,
    ...saved
  };

  if (!["emerald", "midnight", "sand"].includes(settings.theme)) {
    settings.theme = "emerald";
  }

  if (!["12", "24"].includes(settings.timeFormat)) {
    settings.timeFormat = "24";
  }

  if (!["saturday", "sunday", "monday"].includes(settings.weekStart)) {
    settings.weekStart = "saturday";
  }

  applyTheme();
  syncSettingsControls();
}

function saveSettings() {
  if (!writeJSON(KEYS.settings, settings)) {
    alert("সেটিংস সংরক্ষণ করা যায়নি। ব্রাউজারের স্টোরেজ পরীক্ষা করো।");
  }
}

function applyTheme() {
  if (settings.theme === "emerald") {
    document.body.removeAttribute("data-theme");
  } else {
    document.body.dataset.theme = settings.theme;
  }

  const themeMeta = $('meta[name="theme-color"]');

  if (themeMeta) {
    themeMeta.content =
      settings.theme === "midnight" ? "#101b19" :
      settings.theme === "sand" ? "#faf5eb" :
      "#075b46";
  }
}

function syncSettingsControls() {
  const themeSelect = $("#themeSelect");
  const timeFormatSelect = $("#timeFormatSelect");
  const weekStartSelect = $("#weekStartSelect");

  if (themeSelect) themeSelect.value = settings.theme;
  if (timeFormatSelect) timeFormatSelect.value = settings.timeFormat;
  if (weekStartSelect) weekStartSelect.value = settings.weekStart;
}

function formatTime(timestamp, timezone, includeSeconds = false) {
  const options = {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: settings.timeFormat === "12"
  };

  if (includeSeconds) {
    options.second = "2-digit";
  }

  try {
    return new Intl.DateTimeFormat("bn-BD", options)
      .format(new Date(timestamp));
  } catch {
    return "--:--";
  }
}


/* =========================================================
   3. PIN SETUP AND LOGIN
========================================================= */

/*
  The PIN is stored as a salted SHA-256 hash, not as plain text.

  Important: a browser-only PIN is a privacy barrier, not strong
  security. SHA-256 is not a dedicated password-hashing algorithm.
  For stronger protection, use a carefully designed authentication
  system and encryption. GitHub Pages itself is a static host.
*/

function randomSalt() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("এই ব্রাউজারে নিরাপদ PIN সেটআপ সমর্থিত নয়।");
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPin(pin, salt) {
  if (!globalThis.crypto?.subtle || !globalThis.TextEncoder) {
    throw new Error(
      "PIN ব্যবস্থার জন্য HTTPS প্রয়োজন। GitHub Pages-এর HTTPS লিংক দিয়ে অ্যাপটি খোলো।"
    );
  }

  const input = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", input);

  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyPin(pin) {
  const salt = readText(KEYS.pinSalt);
  const savedHash = readText(KEYS.pinHash);

  if (!salt || !savedHash) return false;

  try {
    const candidate = await hashPin(pin, salt);
    return candidate === savedHash;
  } catch {
    return false;
  }
}

function showPinScreen() {
  $("#pinScreen").hidden = false;
  $("#appShell").hidden = true;

  $("#pinSetup").hidden = true;
  $("#pinLogin").hidden = false;

  $("#loginPinInput").value = "";
  showMessage($("#pinLoginMessage"), "");

  $("#loginPinInput").focus();
}

function preparePinScreen() {
  const savedSalt = readText(KEYS.pinSalt);
  const savedHash = readText(KEYS.pinHash);

  if (savedSalt && savedHash) {
    $("#pinSetup").hidden = true;
    $("#pinLogin").hidden = false;
  } else {
    $("#pinSetup").hidden = false;
    $("#pinLogin").hidden = true;
  }

  $("#pinScreen").hidden = false;
  $("#appShell").hidden = true;
}

function unlockApp() {
  $("#pinScreen").hidden = true;
  $("#appShell").hidden = false;

  showView("home");
  refreshApp();
}

async function handlePinSetup(event) {
  event.preventDefault();

  const pin = $("#setupPinInput").value;
  const confirmation = $("#confirmPinInput").value;
  const message = $("#pinSetupMessage");

  if (!/^\d{4,8}$/.test(pin)) {
    showMessage(
      message,
      "PIN অবশ্যই ৪–৮ সংখ্যার হতে হবে।",
      true
    );
    return;
  }

  if (pin !== confirmation) {
    showMessage(message, "দুটি PIN এক হয়নি। আবার পরীক্ষা করো।", true);
    return;
  }

  try {
    const salt = randomSalt();
    const hash = await hashPin(pin, salt);

    if (
      !writeText(KEYS.pinSalt, salt) ||
      !writeText(KEYS.pinHash, hash)
    ) {
      throw new Error(
        "PIN সংরক্ষণ করা যায়নি। ব্রাউজারের স্টোরেজ পরীক্ষা করো।"
      );
    }

    $("#pinSetupForm").reset();
    unlockApp();
  } catch (error) {
    showMessage(
      message,
      error.message || "PIN সেট করা যায়নি।",
      true
    );
  }
}

async function handlePinLogin(event) {
  event.preventDefault();

  const pin = $("#loginPinInput").value;
  const message = $("#pinLoginMessage");

  try {
    const correct = await verifyPin(pin);

    if (!correct) {
      showMessage(
        message,
        "PIN সঠিক নয়। আবার চেষ্টা করো।",
        true
      );
      $("#loginPinInput").select();
      return;
    }

    unlockApp();
  } catch {
    showMessage(
      message,
      "PIN যাচাই করা যায়নি। আবার চেষ্টা করো।",
      true
    );
  }
}

function lockApp() {
  showPinScreen();
}

async function changePin() {
  const oldPin = prompt("বর্তমান PIN লেখো:");

  if (oldPin === null) return;

  const correct = await verifyPin(oldPin);

  if (!correct) {
    alert("বর্তমান PIN সঠিক নয়।");
    return;
  }

  const newPin = prompt("নতুন ৪–৮ সংখ্যার PIN লেখো:");

  if (newPin === null) return;

  if (!/^\d{4,8}$/.test(newPin)) {
    alert("নতুন PIN অবশ্যই ৪–৮ সংখ্যার হতে হবে।");
    return;
  }

  const confirmation = prompt("নতুন PIN আবার লেখো:");

  if (confirmation === null) return;

  if (newPin !== confirmation) {
    alert("নতুন দুটি PIN এক হয়নি।");
    return;
  }

  try {
    const salt = randomSalt();
    const hash = await hashPin(newPin, salt);

    if (
      !writeText(KEYS.pinSalt, salt) ||
      !writeText(KEYS.pinHash, hash)
    ) {
      throw new Error("নতুন PIN সংরক্ষণ করা যায়নি।");
    }

    alert("PIN সফলভাবে পরিবর্তন হয়েছে।");
  } catch (error) {
    alert(error.message || "PIN পরিবর্তন করা যায়নি।");
  }
}


/* =========================================================
   4. NAVIGATION
========================================================= */

const VIEW_NAMES = [
  "home",
  "prayer",
  "calendar",
  "notebook",
  "ibadah",
  "world",
  "qibla",
  "settings"
];

function showView(name) {
  if (!VIEW_NAMES.includes(name)) {
    name = "home";
  }

  VIEW_NAMES.forEach(viewName => {
    const view = $(`#view-${viewName}`);

    if (view) {
      view.hidden = viewName !== name;
    }
  });

  $$(".nav-item").forEach(button => {
    const active = button.dataset.nav === name;

    button.classList.toggle("active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  if (name === "calendar") {
    renderCalendar();
    renderIslamicEvents();
  }

  if (name === "notebook") {
    renderNotes();
  }

  if (name === "world") {
    updateWorldClocks();
  }

  if (name === "prayer") {
    renderPrayerDisplay();
  }
}

function bindNavigation() {
  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-nav]");

    if (!trigger) return;

    event.preventDefault();

    showView(trigger.dataset.nav);
  });
}


/* =========================================================
   5. GREGORIAN AND HIJRI DATES
========================================================= */

const hijriLongFormatter = new Intl.DateTimeFormat(
  "bn-BD-u-ca-islamic",
  {
    day: "numeric",
    month: "long",
    year: "numeric"
  }
);

const hijriNumericFormatter = new Intl.DateTimeFormat(
  "en-US-u-ca-islamic-nu-latn",
  {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }
);

function getHijriParts(date = new Date()) {
  try {
    const parts = hijriNumericFormatter.formatToParts(date);
    const values = {};

    parts.forEach(part => {
      values[part.type] = part.value;
    });

    const year = Number(values.year);
    const month = Number(values.month);
    const day = Number(values.day);

    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day)
    ) {
      return { year, month, day };
    }
  } catch {
    // Show a readable fallback if the browser has limited support.
  }

  return null;
}

function formatHijriLong(date = new Date()) {
  try {
    return hijriLongFormatter.format(date);
  } catch {
    return "এই ব্রাউজারে হিজরি তারিখ সমর্থিত নয়";
  }
}

function updateDateLabels() {
  const now = new Date();

  $("#hijriDate").textContent = formatHijriLong(now);

  $("#gregorianDate").textContent = formatDate(now, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  $("#weekdayLabel").textContent = formatDate(now, {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}


/* =========================================================
   6. DAILY PRAYER CHECKLIST
========================================================= */

const PRAYER_KEYS = [
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha"
];

function getPrayerLog() {
  return readJSON(KEYS.prayers, {});
}

function getTodayPrayerRecord() {
  const allRecords = getPrayerLog();
  const today = localDateKey();

  return allRecords[today] || {};
}

function renderPrayerChecklist() {
  const record = getTodayPrayerRecord();

  $$("[data-prayer]").forEach(input => {
    input.checked = Boolean(record[input.dataset.prayer]);
  });

  updatePrayerProgress();
}

function savePrayerCheck(input) {
  const allRecords = getPrayerLog();
  const today = localDateKey();

  if (!allRecords[today]) {
    allRecords[today] = {};
  }

  allRecords[today][input.dataset.prayer] = input.checked;

  if (!writeJSON(KEYS.prayers, allRecords)) {
    showMessage(
      $("#prayerChecklistMessage"),
      "চেকলিস্ট সংরক্ষণ করা যায়নি। ব্রাউজারের স্টোরেজ পরীক্ষা করো।",
      true
    );
    return;
  }

  showMessage($("#prayerChecklistMessage"), "");
  updatePrayerProgress();
}

function updatePrayerProgress() {
  const completed = $$("[data-prayer]")
    .filter(input => input.checked).length;

  const percentage = Math.round(
    (completed / PRAYER_KEYS.length) * 100
  );

  $("#dailyProgressText").textContent = `${bnNumber(percentage)}%`;
  $("#dailyProgressFill").style.width = `${percentage}%`;

  $("#dailyProgressBar").setAttribute(
    "aria-valuenow",
    String(percentage)
  );

  showMessage(
    $("#prayerChecklistMessage"),
    completed === 5
      ? "মাশাআল্লাহ! আজকের পাঁচ ওয়াক্তের চেকলিস্ট সম্পূর্ণ হয়েছে।"
      : ""
  );
}


/* =========================================================
   7. DAILY GOOD-DEEDS NOTEBOOK
========================================================= */

let editingNoteId = null;

function getNotes() {
  const notes = readJSON(KEYS.notes, []);

  return Array.isArray(notes) ? notes : [];
}

function saveNotes(notes) {
  if (!writeJSON(KEYS.notes, notes)) {
    showMessage(
      $("#noteMessage"),
      "নোট সংরক্ষণ করা যায়নি। স্টোরেজের জায়গা পরীক্ষা করো।",
      true
    );
    return false;
  }

  return true;
}

function prepareNoteEditor() {
  $("#noteDate").value = localDateKey();

  const content = $("#noteContent");
  const count = $("#noteCharCount");

  content.addEventListener("input", () => {
    count.textContent =
      `${bnNumber(content.value.length)} / ${bnNumber(5000)}`;
  });

  $("#noteSearch").addEventListener("input", renderNotes);

  $("#dailyNoteForm").addEventListener("submit", event => {
    event.preventDefault();
    submitNote();
  });
}

function submitNote() {
  const date = $("#noteDate").value;
  const title = $("#noteTitle").value.trim();
  const content = $("#noteContent").value.trim();

  if (!date || !title || !content) {
    showMessage(
      $("#noteMessage"),
      "তারিখ, শিরোনাম ও লেখাটি পূরণ করো।",
      true
    );
    return;
  }

  const notes = getNotes();

  if (editingNoteId) {
    const index = notes.findIndex(note => note.id === editingNoteId);

    if (index !== -1) {
      notes[index] = {
        ...notes[index],
        date,
        title,
        content,
        updatedAt: new Date().toISOString()
      };
    }
  } else {
    notes.unshift({
      id: safeId(),
      date,
      title,
      content,
      createdAt: new Date().toISOString()
    });
  }

  if (!saveNotes(notes)) return;

  cancelNoteEdit();
  $("#dailyNoteForm").reset();
  $("#noteDate").value = localDateKey();
  $("#noteCharCount").textContent = `০ / ${bnNumber(5000)}`;

  showMessage($("#noteMessage"), "তোমার নোট সংরক্ষণ হয়েছে।");
  renderNotes();
}

function cancelNoteEdit() {
  editingNoteId = null;

  const saveButton = $("#saveNoteBtn");
  saveButton.textContent = "নোট সংরক্ষণ করো";

  const cancelButton = $("#cancelNoteEditBtn");

  if (cancelButton) {
    cancelButton.remove();
  }
}

function beginNoteEdit(id) {
  const note = getNotes().find(item => item.id === id);

  if (!note) return;

  editingNoteId = id;

  $("#noteDate").value = note.date;
  $("#noteTitle").value = note.title;
  $("#noteContent").value = note.content;

  $("#noteCharCount").textContent =
    `${bnNumber(note.content.length)} / ${bnNumber(5000)}`;

  $("#saveNoteBtn").textContent = "পরিবর্তন সংরক্ষণ করো";

  if (!$("#cancelNoteEditBtn")) {
    const button = document.createElement("button");

    button.id = "cancelNoteEditBtn";
    button.type = "button";
    button.className = "btn btn-secondary";
    button.textContent = "সম্পাদনা বাতিল";

    button.addEventListener("click", () => {
      cancelNoteEdit();
      $("#dailyNoteForm").reset();
      $("#noteDate").value = localDateKey();
      showMessage($("#noteMessage"), "");
    });

    $(".form-bottom-row").append(button);
  }

  showView("notebook");
  $("#noteTitle").focus();
}

function deleteNote(id) {
  if (!confirm("এই নোটটি মুছে ফেলবে?")) return;

  const notes = getNotes().filter(note => note.id !== id);

  if (!saveNotes(notes)) return;

  if (editingNoteId === id) {
    cancelNoteEdit();
    $("#dailyNoteForm").reset();
    $("#noteDate").value = localDateKey();
  }

  renderNotes();
}

function createNoteElement(note) {
  const card = document.createElement("article");
  card.className = "saved-note-card";

  const title = document.createElement("h3");
  title.textContent = note.title;

  const date = document.createElement("div");
  date.className = "saved-note-date";
  date.textContent = formatDateKey(note.date);

  const content = document.createElement("p");
  content.className = "saved-note-content";
  content.textContent = note.content;

  const actions = document.createElement("div");
  actions.className = "saved-note-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.textContent = "সম্পাদনা";
  editButton.addEventListener("click", () => beginNoteEdit(note.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-note";
  deleteButton.textContent = "মুছে ফেলো";
  deleteButton.addEventListener("click", () => deleteNote(note.id));

  actions.append(editButton, deleteButton);
  card.append(title, date, content, actions);

  return card;
}

function renderNotes() {
  const container = $("#savedNotesList");

  if (!container) return;

  const search = ($("#noteSearch").value || "")
    .trim()
    .toLocaleLowerCase();

  const notes = getNotes()
    .sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);

      if (dateCompare !== 0) return dateCompare;

      return String(b.createdAt || "").localeCompare(
        String(a.createdAt || "")
      );
    })
    .filter(note => {
      const searchable = `${note.title} ${note.content} ${note.date}`
        .toLocaleLowerCase();

      return searchable.includes(search);
    });

  container.replaceChildren();

  if (notes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const icon = document.createElement("span");
    icon.textContent = "📔";

    const heading = document.createElement("h3");
    heading.textContent = search
      ? "কোনো নোট পাওয়া যায়নি"
      : "তোমার নোটবুক এখানে থাকবে";

    const description = document.createElement("p");
    description.textContent = search
      ? "অন্য কোনো শব্দ দিয়ে খুঁজে দেখো।"
      : "প্রথম নোট লিখলে সেটি এখানে দেখা যাবে।";

    empty.append(icon, heading, description);
    container.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  notes.forEach(note => {
    fragment.append(createNoteElement(note));
  });

  container.append(fragment);
}


/* =========================================================
   8. PRAYER-TIME CITIES AND CALCULATIONS
========================================================= */

/*
  This built-in astronomical calculation is an offline prototype.
  It is not a substitute for a verified local prayer timetable.
  Angles, high-latitude handling and local official conventions can
  differ. Check the results against a trusted mosque timetable.
*/

const CITIES = {
  dhaka: {
    name: "ঢাকা",
    lat: 23.8103,
    lon: 90.4125,
    tz: "Asia/Dhaka"
  },
  chittagong: {
    name: "চট্টগ্রাম",
    lat: 22.3569,
    lon: 91.7832,
    tz: "Asia/Dhaka"
  },
  sylhet: {
    name: "সিলেট",
    lat: 24.8949,
    lon: 91.8687,
    tz: "Asia/Dhaka"
  },
  makkah: {
    name: "মক্কা",
    lat: 21.4225,
    lon: 39.8262,
    tz: "Asia/Riyadh"
  },
  madinah: {
    name: "মদিনা",
    lat: 24.4672,
    lon: 39.6112,
    tz: "Asia/Riyadh"
  },
  karachi: {
    name: "করাচি",
    lat: 24.8607,
    lon: 67.0011,
    tz: "Asia/Karachi"
  },
  jakarta: {
    name: "জাকার্তা",
    lat: -6.2088,
    lon: 106.8456,
    tz: "Asia/Jakarta"
  },
  "kuala-lumpur": {
    name: "কুয়ালালামপুর",
    lat: 3.139,
    lon: 101.6869,
    tz: "Asia/Kuala_Lumpur"
  },
  istanbul: {
    name: "ইস্তাম্বুল",
    lat: 41.0082,
    lon: 28.9784,
    tz: "Europe/Istanbul"
  },
  cairo: {
    name: "কায়রো",
    lat: 30.0444,
    lon: 31.2357,
    tz: "Africa/Cairo"
  },
  london: {
    name: "লন্ডন",
    lat: 51.5072,
    lon: -0.1276,
    tz: "Europe/London"
  },
  "new-york": {
    name: "নিউইয়র্ক",
    lat: 40.7128,
    lon: -74.006,
    tz: "America/New_York"
  }
};

const PRAYER_LABELS = {
  fajr: "ফজর",
  sunrise: "সূর্যোদয়",
  dhuhr: "জোহর",
  asr: "আসর",
  maghrib: "মাগরিব",
  isha: "এশা"
};

let selectedCityKey = "dhaka";

function getSelectedCity() {
  return CITIES[selectedCityKey] || CITIES.dhaka;
}

function getCivilDateInZone(timezone, timestamp = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).formatToParts(new Date(timestamp));

  const values = {};

  parts.forEach(part => {
    values[part.type] = part.value;
  });

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day)
  };
}

function offsetCivilDate(parts, offsetDays) {
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + offsetDays, 12)
  );

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function getDayOfYear(year, month, day) {
  const current = Date.UTC(year, month - 1, day);
  const first = Date.UTC(year, 0, 1);

  return Math.floor((current - first) / 86400000) + 1;
}

function calculateSolarTimes(city, civilDate) {
  const { year, month, day } = civilDate;
  const dayOfYear = getDayOfYear(year, month, day);

  const latitude = city.lat * Math.PI / 180;
  const longitude = city.lon;

  const gamma = 2 * Math.PI / 365 * (dayOfYear - 1);

  const equationOfTime = 229.18 * (
    0.000075 +
    0.001868 * Math.cos(gamma) -
    0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) -
    0.040849 * Math.sin(2 * gamma)
  );

  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const solarNoon = 720 - 4 * longitude - equationOfTime;

  function hourAngleForZenith(zenithDegrees) {
    const zenith = zenithDegrees * Math.PI / 180;

    const cosine =
      (Math.cos(zenith) -
        Math.sin(latitude) * Math.sin(declination)) /
      (Math.cos(latitude) * Math.cos(declination));

    if (cosine < -1 || cosine > 1) return null;

    return Math.acos(cosine) * 180 / Math.PI;
  }

  function minutesForZenith(zenith, rising) {
    const hourAngle = hourAngleForZenith(zenith);

    if (hourAngle === null) return null;

    return solarNoon + (rising ? -1 : 1) * 4 * hourAngle;
  }

  const sunrise = minutesForZenith(90.833, true);
  const sunset = minutesForZenith(90.833, false);

  const method = $("#calculationMethod").value;

  const angles = {
    mwl: { fajr: 18, isha: 17 },
    karachi: { fajr: 18, isha: 18 },
    "umm-al-qura": { fajr: 18.5, isha: 0 },
    egypt: { fajr: 19.5, isha: 17.5 },
    singapore: { fajr: 20, isha: 18 }
  };

  const selectedAngles = angles[method] || angles.mwl;

  const fajr = minutesForZenith(90 + selectedAngles.fajr, true);

  let isha = null;

  if (method === "umm-al-qura") {
    if (sunset !== null) {
      const dateAtNoon = new Date(
        year, month - 1, day, 12
      );
      const hijri = getHijriParts(dateAtNoon);

      // Common Umm al-Qura convention: 90 minutes,
      // with 120 minutes during Ramadan.
      const delay = hijri?.month === 9 ? 120 : 90;

      isha = sunset + delay;
    }
  } else {
    isha = minutesForZenith(90 + selectedAngles.isha, false);
  }

  const dhuhr = solarNoon + 2;

  const factor = $("#asrMethod").value === "hanafi" ? 2 : 1;

  const asrAltitude = Math.atan(
    1 / (
      factor +
      Math.tan(Math.abs(latitude - declination))
    )
  );

  const asrCosine =
    (Math.sin(asrAltitude) -
      Math.sin(latitude) * Math.sin(declination)) /
    (Math.cos(latitude) * Math.cos(declination));

  let asr = null;

  if (asrCosine >= -1 && asrCosine <= 1) {
    const asrHourAngle = Math.acos(asrCosine) * 180 / Math.PI;
    asr = solarNoon + 4 * asrHourAngle;
  }

  return { fajr, sunrise, dhuhr, asr, maghrib: sunset, isha };
}

function solarMinutesToTimestamp(civilDate, minutes) {
  if (minutes === null || !Number.isFinite(minutes)) {
    return null;
  }

  return Date.UTC(
    civilDate.year,
    civilDate.month - 1,
    civilDate.day
  ) + minutes * 60000;
}

function calculatePrayerSchedule(city, civilDate) {
  const solarTimes = calculateSolarTimes(city, civilDate);

  const schedule = {};

  Object.entries(solarTimes).forEach(([key, minutes]) => {
    schedule[key] = {
      key,
      name: PRAYER_LABELS[key],
      timestamp: solarMinutesToTimestamp(civilDate, minutes)
    };
  });

  return schedule;
}

function getTodaysSchedule(city) {
  const date = getCivilDateInZone(city.tz);
  return calculatePrayerSchedule(city, date);
}

function renderPrayerDisplay() {
  const city = getSelectedCity();
  const schedule = getTodaysSchedule(city);

  const list = $("#prayerTimesList");
  list.replaceChildren();

  const keys = [
    "fajr",
    "sunrise",
    "dhuhr",
    "asr",
    "maghrib",
    "isha"
  ];

  let hasAnyTime = false;

  keys.forEach(key => {
    const item = schedule[key];

    const row = document.createElement("div");
    row.className = "prayer-time-row";

    const label = document.createElement("span");
    label.textContent = PRAYER_LABELS[key];

    const time = document.createElement("strong");

    if (item.timestamp === null) {
      time.textContent = "হিসাব পাওয়া যায়নি";
    } else {
      time.textContent = formatTime(item.timestamp, city.tz);
      hasAnyTime = true;
    }

    row.append(label, time);
    list.append(row);
  });

  if (!hasAnyTime) {
    const warning = document.createElement("p");
    warning.className = "notice";
    warning.textContent =
      "এই অক্ষাংশে সাধারণ সূর্য-ভিত্তিক হিসাব পাওয়া যায়নি। " +
      "বিশ্বস্ত স্থানীয় সময়সূচি অনুসরণ করো।";

    list.append(warning);
  }

  ["fajr", "dhuhr", "asr", "maghrib", "isha"].forEach(key => {
    const element = $(`#home-time-${key}`);

    if (element) {
      const item = schedule[key];

      element.textContent = item?.timestamp === null || !item
        ? "সময় পাওয়া যায়নি"
        : formatTime(item.timestamp, city.tz);
    }
  });

  $("#suhoorTime").textContent = schedule.fajr.timestamp === null
    ? "--:--"
    : formatTime(schedule.fajr.timestamp, city.tz);

  $("#iftarTime").textContent = schedule.maghrib.timestamp === null
    ? "--:--"
    : formatTime(schedule.maghrib.timestamp, city.tz);

  updateNextPrayer();
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return (
    `${bnNumber(hours)} ঘণ্টা ` +
    `${bnNumber(minutes)} মিনিট ` +
    `${bnNumber(remainingSeconds)} সেকেন্ড`
  );
}

function updateNextPrayer() {
  const city = getSelectedCity();
  const now = Date.now();

  const todayDate = getCivilDateInZone(city.tz);
  const today = calculatePrayerSchedule(city, todayDate);

  const prayerKeys = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

  let next = prayerKeys
    .map(key => today[key])
    .find(item =>
      item.timestamp !== null &&
      item.timestamp > now
    );

  if (!next) {
    const tomorrowDate = offsetCivilDate(todayDate, 1);
    const tomorrow = calculatePrayerSchedule(city, tomorrowDate);

    next = tomorrow.fajr;
  }

  if (!next || next.timestamp === null) {
    $("#nextPrayerName").textContent = "সময় নির্ধারণ সম্ভব নয়";
    $("#nextPrayerTime").textContent = "--:--";
    $("#prayerCountdown").textContent =
      "স্থানীয় নামাজের সময়সূচি অনুসরণ করো।";
    return;
  }

  $("#nextPrayerName").textContent = next.name;
  $("#nextPrayerTime").textContent =
    formatTime(next.timestamp, city.tz);

  $("#prayerCountdown").textContent =
    `আর ${formatDuration(next.timestamp - now)} বাকি`;
}


/* =========================================================
   9. HIJRI MONTH CALENDAR
========================================================= */

let calendarYear = null;
let calendarMonth = null;
let calendarSearchCenter = new Date();

function findHijriMonthStart(
  targetYear,
  targetMonth,
  center = calendarSearchCenter,
  updateCenter = false
) {
  const ranges = [45, 400, 3800];

  for (const range of ranges) {
    for (let offset = -range; offset <= range; offset++) {
      const candidate = new Date(center);
      candidate.setDate(candidate.getDate() + offset);
      candidate.setHours(12, 0, 0, 0);

      const parts = getHijriParts(candidate);

      if (
        parts &&
        parts.year === targetYear &&
        parts.month === targetMonth &&
        parts.day === 1
      ) {
        if (updateCenter) {
          calendarSearchCenter = new Date(candidate);
        }

        return candidate;
      }
    }
  }

  return null;
}

function selectedWeekStart() {
  const map = {
    sunday: 0,
    monday: 1,
    saturday: 6
  };

  return map[settings.weekStart] ?? 6;
}

function renderCalendar() {
  const grid = $("#hijriCalendarGrid");

  if (!grid) return;

  const title = $("#calendarMonth");
  const weekdays = [
    "রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"
  ];

  const weekStart = selectedWeekStart();
  const orderedWeekdays = Array.from(
    { length: 7 },
    (_, index) => weekdays[(weekStart + index) % 7]
  );

  grid.replaceChildren();

  orderedWeekdays.forEach(day => {
    const heading = document.createElement("div");
    heading.className = "calendar-weekday";
    heading.textContent = day;
    grid.append(heading);
  });

  if (calendarYear === null || calendarMonth === null) {
    const current = getHijriParts(new Date());

    if (!current) {
      title.textContent = "হিজরি ক্যালেন্ডার";
      const message = document.createElement("p");
      message.className = "muted-text";
      message.textContent =
        "এই ব্রাউজারে ইসলামিক ক্যালেন্ডার সমর্থিত নয়।";
      grid.append(message);
      return;
    }

    calendarYear = current.year;
    calendarMonth = current.month;
  }

  const firstDate = findHijriMonthStart(
    calendarYear,
    calendarMonth,
    calendarSearchCenter,
    true
  );

  if (!firstDate) {
    title.textContent = "হিজরি মাস পাওয়া যায়নি";

    const message = document.createElement("p");
    message.className = "muted-text";
    message.textContent =
      "ব্রাউজারের ক্যালেন্ডার ডেটা থেকে এই মাসের শুরু নির্ণয় করা যায়নি।";

    grid.append(message);
    return;
  }

  title.textContent = formatDate(firstDate, {
    calendar: "islamic",
    month: "long",
    year: "numeric"
  });

  const firstDayOffset =
    (firstDate.getDay() - weekStart + 7) % 7;

  for (let index = 0; index < firstDayOffset; index++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    empty.setAttribute("aria-hidden", "true");
    grid.append(empty);
  }

  const days = [];
  let currentDate = new Date(firstDate);

  for (let i = 0; i < 31; i++) {
    const parts = getHijriParts(currentDate);

    if (
      !parts ||
      parts.year !== calendarYear ||
      parts.month !== calendarMonth
    ) {
      break;
    }

    days.push({
      date: new Date(currentDate),
      day: parts.day
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const todayKey = localDateKey();

  days.forEach(item => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "calendar-day";
    button.textContent = bnNumber(item.day);
    button.title = formatDate(item.date, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    if (localDateKey(item.date) === todayKey) {
      button.classList.add("today");
      button.setAttribute("aria-current", "date");
    }

    button.addEventListener("click", () => {
      $("#noteDate").value = localDateKey(item.date);
      showView("notebook");
      $("#noteTitle").focus();
    });

    grid.append(button);
  });
}

function moveHijriMonth(direction) {
  if (calendarYear === null || calendarMonth === null) {
    const parts = getHijriParts(new Date());

    if (!parts) return;

    calendarYear = parts.year;
    calendarMonth = parts.month;
  }

  calendarMonth += direction;

  if (calendarMonth > 12) {
    calendarMonth = 1;
    calendarYear++;
  } else if (calendarMonth < 1) {
    calendarMonth = 12;
    calendarYear--;
  }

  calendarSearchCenter.setDate(
    calendarSearchCenter.getDate() + direction * 29
  );

  renderCalendar();
  renderIslamicEvents();
}

const ISLAMIC_EVENTS = [
  { month: 1, day: 1, title: "ইসলামি নববর্ষ" },
  { month: 1, day: 10, title: "আশুরা" },
  { month: 3, day: 12, title: "রবিউল আউয়ালে ঐতিহাসিক স্মরণ দিবস" },
  { month: 7, day: 27, title: "ইসরা ও মিরাজ — তারিখ নিয়ে মতভেদ রয়েছে" },
  { month: 8, day: 15, title: "শাবানের মধ্যরাত — পালন নিয়ে মতভেদ রয়েছে" },
  { month: 9, day: 1, title: "রমজান শুরু — চাঁদ দেখার ওপর নির্ভরশীল" },
  { month: 9, day: 27, title: "লাইলাতুল কদর — নির্দিষ্ট রাত নিশ্চিত নয়" },
  { month: 10, day: 1, title: "ঈদুল ফিতর — চাঁদ দেখার ওপর নির্ভরশীল" },
  { month: 12, day: 9, title: "আরাফার দিন" },
  { month: 12, day: 10, title: "ঈদুল আজহা — চাঁদ দেখার ওপর নির্ভরশীল" }
];

function renderIslamicEvents() {
  const container = $("#islamicEventsList");

  if (!container || calendarYear === null) return;

  container.replaceChildren();

  ISLAMIC_EVENTS.forEach(event => {
    const monthStart = findHijriMonthStart(
      calendarYear,
      event.month,
      calendarSearchCenter,
      false
    );

    if (!monthStart) return;

    const eventDate = new Date(monthStart);
    eventDate.setDate(eventDate.getDate() + event.day - 1);

    const actualParts = getHijriParts(eventDate);

    if (
      !actualParts ||
      actualParts.year !== calendarYear ||
      actualParts.month !== event.month ||
      actualParts.day !== event.day
    ) {
      return;
    }

    const row = document.createElement("div");
    row.className = "event-row";

    const heading = document.createElement("strong");
    heading.textContent = event.title;

    const date = document.createElement("small");
    date.textContent = formatHijriLong(eventDate);

    row.append(heading, date);
    container.append(row);
  });

  if (!container.children.length) {
    const note = document.createElement("p");
    note.className = "muted-text";
    note.textContent = "এই বছরের দিবসের তালিকা তৈরি করা যায়নি।";
    container.append(note);
  }
}


/* =========================================================
   10. DIGITAL TASBIH
========================================================= */

let tasbihCount = 0;
let tasbihTarget = 33;

function loadTasbih() {
  tasbihCount = Math.max(
    0,
    Number(readText(KEYS.tasbih, "0")) || 0
  );

  tasbihTarget = Math.max(
    1,
    Number(readText(KEYS.tasbihTarget, "33")) || 33
  );

  $("#tasbihTargetSelect").value =
    ["33", "99", "100"].includes(String(tasbihTarget))
      ? String(tasbihTarget)
      : "custom";

  $("#customTasbihTarget").hidden =
    $("#tasbihTargetSelect").value !== "custom";

  if ($("#tasbihTargetSelect").value === "custom") {
    $("#customTasbihTarget").value = tasbihTarget;
  }

  renderTasbih();
}

function renderTasbih() {
  $("#tasbihCount").textContent = bnNumber(tasbihCount);
  $("#tasbihTarget").textContent = bnNumber(tasbihTarget);

  writeText(KEYS.tasbih, tasbihCount);
  writeText(KEYS.tasbihTarget, tasbihTarget);
}

function changeTasbih(amount) {
  tasbihCount = Math.max(0, tasbihCount + amount);
  renderTasbih();

  if (
    tasbihCount > 0 &&
    tasbihCount % tasbihTarget === 0
  ) {
    $("#tasbihCount").animate?.(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.08)" },
        { transform: "scale(1)" }
      ],
      { duration: 260, easing: "ease-out" }
    );
  }
}

function resetTasbih() {
  if (!confirm("তাসবিহ কাউন্টার রিসেট করবে?")) return;

  tasbihCount = 0;
  renderTasbih();
}


/* =========================================================
   11. WORLD CLOCK
========================================================= */

const WORLD_CITY_OPTIONS = {
  "Asia/Dhaka": "ঢাকা, বাংলাদেশ",
  "Asia/Riyadh": "মক্কা / মদিনা, সৌদি আরব",
  "Europe/London": "লন্ডন, যুক্তরাজ্য",
  "America/New_York": "নিউইয়র্ক, যুক্তরাষ্ট্র",
  "Asia/Karachi": "করাচি, পাকিস্তান",
  "Asia/Jakarta": "জাকার্তা, ইন্দোনেশিয়া",
  "Asia/Kuala_Lumpur": "কুয়ালালামপুর, মালয়েশিয়া",
  "Europe/Istanbul": "ইস্তাম্বুল, তুরস্ক",
  "Africa/Cairo": "কায়রো, মিশর",
  "Asia/Tokyo": "টোকিও, জাপান",
  "Australia/Sydney": "সিডনি, অস্ট্রেলিয়া",
  "America/Toronto": "টরন্টো, কানাডা"
};

let worldCities = [];

function loadWorldCities() {
  const saved = readJSON(KEYS.worldCities, null);

  if (Array.isArray(saved)) {
    worldCities = saved.filter(city =>
      city &&
      typeof city.name === "string" &&
      Object.hasOwn(WORLD_CITY_OPTIONS, city.tz)
    );
  } else {
    worldCities = [
      { name: "ঢাকা, বাংলাদেশ", tz: "Asia/Dhaka" },
      { name: "মক্কা / মদিনা", tz: "Asia/Riyadh" },
      { name: "লন্ডন, যুক্তরাজ্য", tz: "Europe/London" }
    ];
  }

  renderWorldClocks();
}

function saveWorldCities() {
  writeJSON(KEYS.worldCities, worldCities);
}

function renderWorldClocks() {
  const container = $("#worldClockList");
  container.replaceChildren();

  worldCities.forEach(city => {
    const card = document.createElement("article");
    card.className = "world-clock-card";

    const name = document.createElement("p");
    name.textContent = city.name;

    const time = document.createElement("h2");
    time.dataset.timezone = city.tz;
    time.textContent = "--:--";

    const date = document.createElement("small");
    date.dataset.timezoneDate = city.tz;
    date.textContent = "তারিখ লোড হচ্ছে…";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "world-clock-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `${city.name} সরাও`);

    remove.addEventListener("click", () => {
      worldCities = worldCities.filter(item => item.tz !== city.tz);
      saveWorldCities();
      renderWorldClocks();
    });

    card.append(name, time, date, remove);
    container.append(card);
  });

  if (!worldCities.length) {
    const empty = document.createElement("p");
    empty.className = "muted-text";
    empty.textContent = "উপরের তালিকা থেকে একটি শহর যোগ করো।";
    container.append(empty);
  }

  updateWorldClocks();
}

function addWorldCity() {
  const select = $("#worldCitySelect");
  const timezone = select.value;

  if (!Object.hasOwn(WORLD_CITY_OPTIONS, timezone)) return;

  if (worldCities.some(city => city.tz === timezone)) {
    alert("এই শহরের টাইমজোন তালিকায় আছে।");
    return;
  }

  worldCities.push({
    name: WORLD_CITY_OPTIONS[timezone],
    tz: timezone
  });

  saveWorldCities();
  renderWorldClocks();
}

function updateWorldClocks() {
  const now = new Date();

  $$("[data-timezone]").forEach(element => {
    element.textContent = formatTime(
      now.getTime(),
      element.dataset.timezone,
      true
    );
  });

  $$("[data-timezone-date]").forEach(element => {
    try {
      element.textContent = new Intl.DateTimeFormat("bn-BD", {
        timeZone: element.dataset.timezone,
        weekday: "short",
        day: "numeric",
        month: "short"
      }).format(now);
    } catch {
      element.textContent = "তারিখ অনুপলব্ধ";
    }
  });
}


/* =========================================================
   12. QIBLA DIRECTION
========================================================= */

const KAABA = {
  latitude: 21.4225,
  longitude: 39.8262
};

let qiblaBearing = null;
let deviceHeading = null;

function calculateQiblaBearing(latitude, longitude) {
  const toRadians = degrees => degrees * Math.PI / 180;

  const lat1 = toRadians(latitude);
  const lat2 = toRadians(KAABA.latitude);
  const deltaLongitude = toRadians(
    KAABA.longitude - longitude
  );

  const y = Math.sin(deltaLongitude) * Math.cos(lat2);

  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLongitude);

  const angle = Math.atan2(y, x) * 180 / Math.PI;

  return (angle + 360) % 360;
}

function compassDirection(degrees) {
  const names = [
    "উত্তর", "উত্তর-পূর্ব", "পূর্ব", "দক্ষিণ-পূর্ব",
    "দক্ষিণ", "দক্ষিণ-পশ্চিম", "পশ্চিম", "উত্তর-পশ্চিম"
  ];

  return names[Math.round(degrees / 45) % 8];
}

function updateQiblaNeedle() {
  if (qiblaBearing === null) return;

  const relativeAngle = deviceHeading === null
    ? qiblaBearing
    : qiblaBearing - deviceHeading;

  $("#qiblaNeedle").style.transform =
    `rotate(${relativeAngle}deg)`;

  $("#qiblaDegrees").textContent =
    `কিবলার দিক: ${bnNumber(Math.round(qiblaBearing))}° ${compassDirection(qiblaBearing)}`;

  $("#qiblaStatus").textContent = deviceHeading === null
    ? "এটি উত্তর দিক থেকে হিসাব করা কোণ। কম্পাস সেন্সর না থাকলে ফোনের দিক নিজে মিলিয়ে নাও।"
    : "কম্পাস সেন্সর পাওয়া গেছে। আশপাশের ধাতব বস্তু থেকে দূরে থেকে যাচাই করো।";
}

function handleDeviceOrientation(event) {
  let heading = null;

  if (typeof event.webkitCompassHeading === "number") {
    heading = event.webkitCompassHeading;
  } else if (
    typeof event.alpha === "number" &&
    event.absolute === true
  ) {
    heading = (360 - event.alpha) % 360;
  }

  if (heading !== null) {
    deviceHeading = heading;
    updateQiblaNeedle();
  }
}

async function requestCompassPermission() {
  const Orientation = window.DeviceOrientationEvent;

  if (
    Orientation &&
    typeof Orientation.requestPermission === "function"
  ) {
    try {
      const result = await Orientation.requestPermission();

      if (result === "granted") {
        window.addEventListener(
          "deviceorientation",
          handleDeviceOrientation,
          true
        );
      }
    } catch {
      // Position-based bearing can still be displayed.
    }
  } else if (Orientation) {
    window.addEventListener(
      "deviceorientationabsolute",
      handleDeviceOrientation,
      true
    );

    window.addEventListener(
      "deviceorientation",
      handleDeviceOrientation,
      true
    );
  }
}

async function findQibla() {
  if (!navigator.geolocation) {
    showMessage(
      $("#qiblaStatus"),
      "এই ব্রাউজারে অবস্থান নির্ণয়ের সুবিধা নেই।",
      true
    );
    return;
  }

  $("#qiblaStatus").textContent =
    "অবস্থান নির্ণয় করা হচ্ছে… অনুমতি চাইলে অনুমতি দাও।";

  await requestCompassPermission();

  navigator.geolocation.getCurrentPosition(
    position => {
      qiblaBearing = calculateQiblaBearing(
        position.coords.latitude,
        position.coords.longitude
      );

      updateQiblaNeedle();
    },

    error => {
      const messages = {
        1: "অবস্থানের অনুমতি দেওয়া হয়নি। ব্রাউজার সেটিংসে অনুমতি দাও।",
        2: "অবস্থান পাওয়া যায়নি। ডিভাইসের অবস্থান সেটিংস পরীক্ষা করো।",
        3: "অবস্থান নির্ণয়ের সময় শেষ হয়েছে। আবার চেষ্টা করো।"
      };

      $("#qiblaStatus").textContent =
        messages[error.code] || "অবস্থান নির্ণয় করা যায়নি।";
    },

    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000
    }
  );
}


/* =========================================================
   13. PWA INSTALLATION AND OFFLINE STATUS
========================================================= */

let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();

  deferredInstallPrompt = event;

  const button = $("#installAppBtn");

  if (button) {
    button.hidden = false;
  }
});

async function installApp() {
  if (!deferredInstallPrompt) {
    alert(
      "ইনস্টল অপশন এখন পাওয়া যাচ্ছে না। ব্রাউজারের মেনু থেকে " +
      "Add to Home Screen বা Install App নির্বাচন করো।"
    );
    return;
  }

  deferredInstallPrompt.prompt();

  await deferredInstallPrompt.userChoice;

  deferredInstallPrompt = null;
  $("#installAppBtn").hidden = true;
}

function updateOfflineStatus() {
  const status = $("#offlineStatus");

  if (!status) return;

  if (!navigator.onLine) {
    status.textContent = "অফলাইন মোড";
    return;
  }

  if (navigator.serviceWorker?.controller) {
    status.textContent = "অফলাইন ক্যাশ সক্রিয়";
  } else {
    status.textContent = "অফলাইন সেটআপ বাকি";
  }
}

function registerOfflineWorker() {
  if (!("serviceWorker" in navigator)) {
    $("#offlineStatus").textContent = "ব্রাউজার সীমাবদ্ধতা";
    return;
  }

  const secureOrigin =
    location.protocol === "https:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  if (!secureOrigin) {
    $("#offlineStatus").textContent = "HTTPS প্রয়োজন";
    return;
  }

  navigator.serviceWorker.register("./sw.js")
    .then(() => {
      updateOfflineStatus();
    })
    .catch(() => {
      $("#offlineStatus").textContent = "sw.js ফাইল প্রয়োজন";
    });

  navigator.serviceWorker.addEventListener(
    "controllerchange",
    updateOfflineStatus
  );
}


/* =========================================================
   14. RESET APP DATA
========================================================= */

function resetAppData() {
  const confirmed = confirm(
    "এই ব্রাউজারে সংরক্ষিত PIN, নোট, নামাজের চেকলিস্ট, " +
    "তাসবিহ ও সেটিংস মুছে যাবে। এগিয়ে যাবে?"
  );

  if (!confirmed) return;

  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("noor_")) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    alert("অ্যাপের ডেটা মুছে ফেলা যায়নি।");
    return;
  }

  location.reload();
}


/* =========================================================
   15. EVENT BINDING
========================================================= */

function bindEvents() {
  $("#pinSetupForm").addEventListener(
    "submit",
    handlePinSetup
  );

  $("#pinLoginForm").addEventListener(
    "submit",
    handlePinLogin
  );

  $("#lockAppBtn").addEventListener("click", lockApp);
  $("#lockFromSettingsBtn").addEventListener("click", lockApp);
  $("#changePinBtn").addEventListener("click", changePin);

  $("#resetAppBtn").addEventListener("click", resetAppData);

  bindNavigation();

  $$("[data-prayer]").forEach(input => {
    input.addEventListener("change", () => {
      savePrayerCheck(input);
    });
  });

  $("#prevMonthBtn").addEventListener("click", () => {
    moveHijriMonth(-1);
  });

  $("#nextMonthBtn").addEventListener("click", () => {
    moveHijriMonth(1);
  });

  $("#tasbihPlusBtn").addEventListener("click", () => {
    changeTasbih(1);
  });

  $("#tasbihMinusBtn").addEventListener("click", () => {
    changeTasbih(-1);
  });

  $("#tasbihResetBtn").addEventListener("click", resetTasbih);

  $("#tasbihTargetSelect").addEventListener("change", event => {
    const value = event.target.value;
    const custom = $("#customTasbihTarget");

    custom.hidden = value !== "custom";

    if (value !== "custom") {
      tasbihTarget = Number(value);
      renderTasbih();
    } else {
      custom.focus();
    }
  });

  $("#customTasbihTarget").addEventListener("change", event => {
    const value = Number(event.target.value);

    if (!Number.isInteger(value) || value < 1 || value > 100000) {
      alert("লক্ষ্য ১ থেকে ১০০০০০-এর মধ্যে হতে হবে।");
      event.target.value = tasbihTarget;
      return;
    }

    tasbihTarget = value;
    renderTasbih();
  });

  $("#prayerCitySelect").addEventListener("change", event => {
    selectedCityKey = event.target.value;

    writeText(KEYS.city, selectedCityKey);

    renderPrayerDisplay();
  });

  $("#calculationMethod").addEventListener(
    "change",
    renderPrayerDisplay
  );

  $("#asrMethod").addEventListener(
    "change",
    renderPrayerDisplay
  );

  $("#addWorldCityBtn").addEventListener("click", addWorldCity);
  $("#findQiblaBtn").addEventListener("click", findQibla);

  $("#installAppBtn").addEventListener("click", installApp);

  $("#themeSelect").addEventListener("change", event => {
    settings.theme = event.target.value;
    applyTheme();
    saveSettings();
  });

  $("#timeFormatSelect").addEventListener("change", event => {
    settings.timeFormat = event.target.value;
    saveSettings();
    renderPrayerDisplay();
    updateWorldClocks();
  });

  $("#weekStartSelect").addEventListener("change", event => {
    settings.weekStart = event.target.value;
    saveSettings();
    renderCalendar();
  });

  window.addEventListener("online", updateOfflineStatus);

  window.addEventListener("offline", updateOfflineStatus);
}


/* =========================================================
   16. INITIALIZE APP
========================================================= */

function refreshApp() {
  updateDateLabels();
  renderPrayerChecklist();
  renderPrayerDisplay();
  renderNotes();
  renderCalendar();
  renderIslamicEvents();
  updateWorldClocks();
  renderTasbih();
  syncSettingsControls();
}

function boot() {
  loadSettings();
  preparePinScreen();

  const savedCity = readText(KEYS.city, "dhaka");

  selectedCityKey = CITIES[savedCity] ? savedCity : "dhaka";

  $("#prayerCitySelect").value = selectedCityKey;

  prepareNoteEditor();
  loadTasbih();
  loadWorldCities();

  bindEvents();

  const currentHijri = getHijriParts(new Date());

  if (currentHijri) {
    calendarYear = currentHijri.year;
    calendarMonth = currentHijri.month;
  }

  refreshApp();
  registerOfflineWorker();
  updateOfflineStatus();

  // Dates and prayer displays can change while the app remains open.
  setInterval(updateDateLabels, 60000);

  setInterval(() => {
    renderPrayerDisplay();
    updateWorldClocks();
  }, 60000);

  setInterval(updateNextPrayer, 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
