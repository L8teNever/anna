/**
 * Tickende Bombe – klassisches "Pass das Handy weiter"-Spiel.
 * Die Zündzeit ist zufällig zwischen min/max Sekunden und wird bewusst nie
 * angezeigt: das Ticken wird nur hörbar/fühlbar schneller, bis es knallt.
 * Beim Explodieren bekommt der Verlierer eine zufällige Aufgabe aus den
 * gewählten Kategorien.
 */
(function () {
  const SETTINGS_KEY  = "anna:bombe:settings";
  const CATS_KEY      = "anna:bombe:categories";

  /* ------------------------------------------------------------------ */
  /* Aufgaben-Datenbank                                                   */
  /* ------------------------------------------------------------------ */
  const CATEGORIES = [
    {
      id: "aktion",
      label: "🏃 Aktionen",
      color: "#e53935",
      tasks: [
        "Mach 10 Liegestütze!",
        "Hüpfe 30 Sekunden lang auf einem Bein.",
        "Mach einen Hampelmann – so schnell du kannst, 20 Stück.",
        "Lauf einmal im Kreis durch den Raum.",
        "Halte 20 Sekunden lang die Planke.",
        "Knie nieder und steh 5× schnell auf.",
        "Mach rückwärts 5 Schritte – ohne umzufallen.",
        "Spring so hoch du kannst – 5×.",
      ],
    },
    {
      id: "imitieren",
      label: "🎭 Imitieren",
      color: "#8e24aa",
      tasks: [
        "Imitiere ein Auto, das anspringt und Gas gibt – mit Geräuschen!",
        "Mach das Geräusch einer Katze – überzeuge die Gruppe.",
        "Imitiere einen Hund, der bellt und wedelt.",
        "Mach das Geräusch eines Hubschraubers beim Starten.",
        "Imitiere einen Roboter – Bewegungen und Stimme.",
        "Mach das Geräusch eines Zuges, der losfährt.",
        "Imitiere einen schlafenden Bären – mit Schnarchen.",
        "Tu so als ob du ein Motorrad bist – inkl. Startgeräusch.",
        "Mach das Geräusch und die Bewegung einer alten Nähmaschine.",
        "Imitiere einen wütenden Pinguin.",
      ],
    },
    {
      id: "wissen",
      label: "🧠 Wissen",
      color: "#1e88e5",
      tasks: [
        "Nenne 5 Automarken in 10 Sekunden.",
        "Sage die Hauptstädte von 3 europäischen Ländern auf.",
        "Nenne 5 verschiedene Sportarten in 8 Sekunden.",
        "Zähle rückwärts von 20 auf 1 – ohne Fehler.",
        "Nenne 4 Tiere, die in der Arktis leben.",
        "Sage das Alphabet rückwärts – so weit du kommst in 10 Sekunden.",
        "Nenne 5 Dinge, die man im Badezimmer findet.",
        "Nenne 3 Erfinder und ihre Erfindungen.",
        "Nenne 5 Länder ohne Meeresküste.",
        "Sage 3 Wörter auf Englisch, die mindestens 8 Buchstaben haben.",
      ],
    },
    {
      id: "singen",
      label: "🎤 Singen",
      color: "#43a047",
      tasks: [
        "Singe die ersten 4 Zeilen deines Lieblingsliedes.",
        "Singe \"Happy Birthday\" auf Englisch – komplett.",
        "Singe einen Jingle aus der Werbung deiner Wahl.",
        "Singe \"Alle meine Entchen\" mit vollem Einsatz.",
        "Singe irgendetwas, das du gerade siehst – improvisiert.",
        "Singe die Titelmelodie einer Zeichentrickserie.",
        "Singe einen Zungenbrecher im Rap-Stil.",
        "Singe deinen eigenen Namen als Opernarie.",
      ],
    },
    {
      id: "social",
      label: "😄 Social",
      color: "#fb8c00",
      tasks: [
        "Erzähle einen Witz – die Gruppe entscheidet, ob er gut ist.",
        "Gib jedem in der Runde ein aufrichtiges Kompliment.",
        "Mach ein Selfie mit deinem verrücktesten Gesicht und zeig es rum.",
        "Beschreibe deinen Tag in genau 5 Wörtern.",
        "Tu eine Minute lang so, als wärst du berühmt.",
        "Sprich die nächsten 2 Minuten mit einem erfundenen Akzent.",
        "Nenne das Lustigste, das du diese Woche erlebt hast.",
        "Stelle dich selbst vor – als wärst du ein Superheld.",
        "Sag der Person links von dir etwas Nettes auf eine ungewöhnliche Art.",
        "Erfinde spontan einen Reim über jemanden in der Runde.",
      ],
    },
    {
      id: "challenge",
      label: "🔥 Challenge",
      color: "#d81b60",
      tasks: [
        "Halte 30 Sekunden lang die Luft an.",
        "Versuche, deine Zunge an deine Nase zu berühren.",
        "Schreibe deinen Namen mit der falschen Hand in die Luft.",
        "Führe 1 Minute lang kein Wort – absolutes Schweigen.",
        "Iss eine Prise Salz, ohne das Gesicht zu verziehen.",
        "Berühre deinen Ellbogen mit der Hand derselben Seite – funktioniert das?",
        "Mach die \"Gangnam Style\"-Bewegung für 15 Sekunden.",
        "Stell dein Handy auf die Stirn – und hält es dort 10 Sekunden ohne Hände.",
        "Falte deine Arme – jetzt wechsle sie andersherum. Versuche es 5×.",
        "Klopfe mit einer Hand auf deinen Kopf und reibe gleichzeitig mit der anderen auf deinem Bauch.",
      ],
    },
  ];

  /* ------------------------------------------------------------------ */
  /* DOM-Referenzen                                                        */
  /* ------------------------------------------------------------------ */
  const setupView     = document.getElementById("setup-view");
  const playView      = document.getElementById("play-view");
  const backButton    = document.getElementById("back-button");

  const minSecondsInput = document.getElementById("min-seconds-input");
  const maxSecondsInput = document.getElementById("max-seconds-input");
  const startButton     = document.getElementById("start-button");

  const bombRing      = document.getElementById("bomb-ring");
  const bombIcon      = document.getElementById("bomb-icon");
  const bombIconUse   = bombIcon.querySelector("use");
  const playStatus    = document.getElementById("play-status");
  const playActions   = document.getElementById("play-actions");
  const restartButton = document.getElementById("restart-button");
  const exitButton    = document.getElementById("exit-button");

  const categoryPicker  = document.getElementById("category-picker");
  const taskCard        = document.getElementById("task-card");
  const taskCategoryLbl = document.getElementById("task-category-label");
  const taskText        = document.getElementById("task-text");

  const playerPicker = PlayerPicker.create(document.getElementById("player-picker"), "bombe");
  let tickTimeoutId = null;
  let roundActive   = false;

  /* ------------------------------------------------------------------ */
  /* Einstellungen                                                         */
  /* ------------------------------------------------------------------ */
  function loadFuseSettings() {
    try { return Object.assign({ min: 30, max: 90 }, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); }
    catch { return { min: 30, max: 90 }; }
  }
  function saveFuseSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

  function loadSelectedCats() {
    try {
      const stored = JSON.parse(localStorage.getItem(CATS_KEY));
      if (Array.isArray(stored)) return new Set(stored);
    } catch {}
    // Standard: alle Kategorien aktiv
    return new Set(CATEGORIES.map((c) => c.id));
  }
  function saveSelectedCats(set) { localStorage.setItem(CATS_KEY, JSON.stringify([...set])); }

  const fuseSettings  = loadFuseSettings();
  let selectedCats    = loadSelectedCats();

  minSecondsInput.value = fuseSettings.min;
  maxSecondsInput.value = fuseSettings.max;

  /* ------------------------------------------------------------------ */
  /* Kategorie-Chip-Picker aufbauen                                        */
  /* ------------------------------------------------------------------ */
  function buildCategoryPicker() {
    categoryPicker.innerHTML = "";
    CATEGORIES.forEach((cat) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "bombe-cat-chip";
      chip.dataset.id = cat.id;
      chip.style.setProperty("--cat-color", cat.color);
      chip.setAttribute("aria-pressed", selectedCats.has(cat.id) ? "true" : "false");
      chip.textContent = cat.label;
      if (selectedCats.has(cat.id)) chip.classList.add("bombe-cat-chip--active");

      chip.addEventListener("click", () => {
        const active = chip.classList.toggle("bombe-cat-chip--active");
        chip.setAttribute("aria-pressed", active ? "true" : "false");
        if (active) selectedCats.add(cat.id);
        else selectedCats.delete(cat.id);
        saveSelectedCats(selectedCats);
      });

      categoryPicker.appendChild(chip);
    });
  }
  buildCategoryPicker();

  /* ------------------------------------------------------------------ */
  /* Aufgabe ziehen                                                        */
  /* ------------------------------------------------------------------ */
  function pickTask() {
    const activeCats = CATEGORIES.filter((c) => selectedCats.has(c.id));
    if (activeCats.length === 0) return null;
    const cat  = activeCats[Math.floor(Math.random() * activeCats.length)];
    const task = cat.tasks[Math.floor(Math.random() * cat.tasks.length)];
    return { cat, task };
  }

  /* ------------------------------------------------------------------ */
  /* Tick-Logik                                                           */
  /* ------------------------------------------------------------------ */
  function currentFuseRange() {
    let min = Math.max(5, parseInt(minSecondsInput.value, 10) || 30);
    let max = Math.max(5, parseInt(maxSecondsInput.value, 10) || 90);
    if (max < min) [min, max] = [max, min];
    saveFuseSettings({ min, max });
    return { min, max };
  }

  function pulse() {
    bombRing.classList.remove("bomb-ring--pulse");
    void bombRing.offsetWidth;
    bombRing.classList.add("bomb-ring--pulse");
  }

  function scheduleTick(totalMs, startedAt) {
    const remaining = totalMs - (performance.now() - startedAt);
    if (remaining <= 0) { explode(); return; }
    const progress = remaining / totalMs;
    const interval = 150 + 750 * Math.pow(progress, 1.4);
    tickTimeoutId = setTimeout(() => {
      if (!roundActive) return;
      pulse();
      Sound.tick(700 + 500 * (1 - progress));
      scheduleTick(totalMs, startedAt);
    }, interval);
  }

  /* ------------------------------------------------------------------ */
  /* Runden-Steuerung                                                     */
  /* ------------------------------------------------------------------ */
  function startRound() {
    const { min, max } = currentFuseRange();
    const totalMs = (min + Math.random() * (max - min)) * 1000;

    roundActive = true;
    setupView.hidden = true;
    playView.hidden  = false;
    playActions.hidden = true;
    taskCard.hidden    = true;

    bombRing.classList.remove("bomb-ring--exploded");
    bombIconUse.setAttribute("href", "#icon-bomb");
    playStatus.dataset.exploded = "false";
    playStatus.style.removeProperty("color");

    Sound.unlock();
    WakeLock.enable();

    const selectedNames = playerPicker.getSelectedNames();
    if (selectedNames.length > 0) {
      const starter = selectedNames[Math.floor(Math.random() * selectedNames.length)];
      playStatus.textContent = `${starter} fängt an – gib dann weiter…`;
      Sound.say(`${starter} fängt an`);
    } else {
      playStatus.textContent = "Gib das Handy weiter…";
    }

    scheduleTick(totalMs, performance.now());
  }

  function explode() {
    roundActive = false;
    if (tickTimeoutId) clearTimeout(tickTimeoutId);

    bombIconUse.setAttribute("href", "#icon-burst");
    bombRing.classList.add("bomb-ring--exploded");
    playStatus.textContent    = "💥 BOOM! Die Bombe ist hochgegangen.";
    playStatus.dataset.exploded = "true";
    playActions.hidden = false;

    // Aufgabe anzeigen
    const drawn = pickTask();
    if (drawn) {
      taskCategoryLbl.textContent = drawn.cat.label;
      taskCategoryLbl.style.setProperty("--cat-color", drawn.cat.color);
      taskText.textContent = drawn.task;
      taskCard.hidden = false;
      // Slide-in animation rücksetzen
      taskCard.classList.remove("bomb-task-card--in");
      void taskCard.offsetWidth;
      taskCard.classList.add("bomb-task-card--in");
    }

    // Screen Shake
    document.body.classList.add("shake");
    setTimeout(() => document.body.classList.remove("shake"), 500);

    // Fullscreen Flash
    const flash = document.createElement("div");
    flash.className = "explosion-flash";
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 600);

    Sound.boom();
    if (Storage.getSettings().vibrationEnabled && navigator.vibrate) {
      navigator.vibrate([300, 100, 300, 100, 500]);
    }
    WakeLock.disable();
  }

  function stopRound() {
    roundActive = false;
    if (tickTimeoutId) clearTimeout(tickTimeoutId);
    WakeLock.disable();
  }

  /* ------------------------------------------------------------------ */
  /* Event-Listener                                                        */
  /* ------------------------------------------------------------------ */
  startButton.addEventListener("click", startRound);
  restartButton.addEventListener("click", startRound);
  exitButton.addEventListener("click", () => { stopRound(); window.location.href = "/"; });
  backButton.addEventListener("click", () => {
    stopRound();
    if (!playView.hidden && setupView.hidden) {
      setupView.hidden = false;
      playView.hidden  = true;
      return;
    }
    window.location.href = "/";
  });
  window.addEventListener("beforeunload", stopRound);
})();
