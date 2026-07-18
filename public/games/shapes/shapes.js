/**
 * Perfekte Form – Form auswählen, freihand auf ein Canvas zeichnen, per
 * Konturvergleich (Resampling + 2D-Procrustes-Rotationsanpassung) einen
 * Prozentwert ausrechnen, wie gut die Zeichnung zur Idealform passt.
 */
(function () {
  const setupView = document.getElementById("setup-view");
  const playView = document.getElementById("play-view");
  const backButton = document.getElementById("back-button");

  const startButton = document.getElementById("start-button");
  const shapeSelect = document.getElementById("shape-select");
  const shapePromptName = document.getElementById("shape-prompt-name");

  const canvas = document.getElementById("shape-canvas");
  const ctx = canvas.getContext("2d");

  const resultPanel = document.getElementById("shape-result");
  const resultScoreEl = document.getElementById("shape-result-score");
  const resultVerdictEl = document.getElementById("shape-result-verdict");
  const drawActions = document.getElementById("draw-actions");
  const resultActions = document.getElementById("result-actions");
  const clearButton = document.getElementById("clear-button");
  const evaluateButton = document.getElementById("evaluate-button");
  const retryButton = document.getElementById("retry-button");
  const newShapeButton = document.getElementById("new-shape-button");

  const SHAPE_NAMES = { circle: "Kreis", rectangle: "Rechteck", triangle: "Dreieck", star: "Stern" };

  let selectedShape = "circle";
  let points = [];
  let drawing = false;

  /* ------------------------------------------------------------------ */
  /* Formauswahl                                                           */
  /* ------------------------------------------------------------------ */
  shapeSelect.addEventListener("click", (event) => {
    const btn = event.target.closest(".m3-segmented__option");
    if (!btn) return;
    selectedShape = btn.dataset.shape;
    shapeSelect.querySelectorAll(".m3-segmented__option").forEach((b) => {
      b.setAttribute("aria-pressed", String(b === btn));
    });
  });

  /* ------------------------------------------------------------------ */
  /* Canvas: Zeichnen per Pointer Events                                   */
  /* ------------------------------------------------------------------ */
  function canvasSize() {
    return canvas.parentElement.getBoundingClientRect();
  }

  function resizeCanvas() {
    const rect = canvasSize();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  function redraw() {
    const rect = canvasSize();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (points.length < 2) return;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--m3-primary").trim() || "#0b57cf";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (!resultPanel.hidden) return;
    canvas.setPointerCapture(event.pointerId);
    drawing = true;
    points.push(pointFromEvent(event));
    redraw();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    points.push(pointFromEvent(event));
    redraw();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
    canvas.addEventListener(type, () => { drawing = false; });
  });

  window.addEventListener("resize", () => { if (!playView.hidden) resizeCanvas(); }, { signal: Router.signal });

  /* ------------------------------------------------------------------ */
  /* Ideal-Formen (Einheitsgröße, Zentrum 0,0)                             */
  /* ------------------------------------------------------------------ */
  function circlePoints(n) {
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * k) / n;
      pts.push({ x: Math.cos(a), y: Math.sin(a) });
    }
    return pts;
  }

  const SHAPE_VERTICES = {
    rectangle: [
      { x: -1.2, y: -0.85 }, { x: 1.2, y: -0.85 }, { x: 1.2, y: 0.85 }, { x: -1.2, y: 0.85 },
    ],
    triangle: [
      { x: 0, y: -1.15 }, { x: 1, y: 0.85 }, { x: -1, y: 0.85 },
    ],
    star: (function () {
      const pts = [];
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (Math.PI * k) / 5;
        const r = k % 2 === 0 ? 1 : 0.45;
        pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
      }
      return pts;
    })(),
  };

  function idealShapePoints(shape, n) {
    if (shape === "circle") return circlePoints(n);
    return resampleClosed(SHAPE_VERTICES[shape], n);
  }

  /* ------------------------------------------------------------------ */
  /* Geometrie-Hilfsfunktionen                                            */
  /* ------------------------------------------------------------------ */
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // Verteilt "count" Punkte gleichmäßig (nach Bogenlänge) entlang des
  // geschlossenen Pfads/Polygons "path" (letzter Punkt verbindet implizit
  // wieder mit dem ersten). Funktioniert für die Nutzer-Zeichnung genauso
  // wie für die Ideal-Eckpunkte, damit beide Seiten vergleichbar sind.
  function resampleClosed(path, count) {
    const n = path.length;
    const segLengths = [];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const d = dist(path[i], path[(i + 1) % n]);
      segLengths.push(d);
      total += d;
    }
    if (total <= 1e-9) return null;

    const result = [];
    let segIndex = 0;
    let segStart = 0;
    for (let k = 0; k < count; k++) {
      const target = (total * k) / count;
      while (segIndex < n - 1 && segStart + segLengths[segIndex] < target) {
        segStart += segLengths[segIndex];
        segIndex++;
      }
      const a = path[segIndex];
      const b = path[(segIndex + 1) % n];
      const segLen = segLengths[segIndex] || 1e-9;
      const t = Math.min(1, Math.max(0, (target - segStart) / segLen));
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    return result;
  }

  // Zentriert auf den Schwerpunkt und skaliert auf mittleren Abstand 1 —
  // Größe/Position der Zeichnung sollen nicht in die Bewertung einfließen,
  // nur die Form selbst.
  function normalize(pts) {
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const centered = pts.map((p) => ({ x: p.x - cx, y: p.y - cy }));
    const rms = Math.sqrt(centered.reduce((s, p) => s + p.x * p.x + p.y * p.y, 0) / centered.length);
    if (rms < 1e-6) return null;
    return {
      points: centered.map((p) => ({ x: p.x / rms, y: p.y / rms })),
      centroid: { x: cx, y: cy },
      scale: rms,
    };
  }

  const RESAMPLE_COUNT = 64;
  // Empirisch gewählte Steilheit für die Umrechnung Fehler -> Prozent.
  const SCORE_STEEPNESS = 2.5;

  // Vergleicht die (resampelte, normalisierte) Nutzer-Kontur mit der
  // Idealform. Da man an beliebiger Stelle der Form anfangen kann zu
  // zeichnen und in beide Richtungen (im/gegen Uhrzeigersinn), wird über
  // alle zyklischen Verschiebungen und beide Richtungen die beste Rotation
  // gesucht (geschlossene 2D-Procrustes-Formel, keine Matrix-Bibliothek
  // nötig).
  function bestAlignment(U, I) {
    const n = U.length;
    let best = null;
    for (let dir = -1; dir <= 1; dir += 2) {
      for (let shift = 0; shift < n; shift++) {
        const shifted = new Array(n);
        for (let k = 0; k < n; k++) {
          let idx = (shift + dir * k) % n;
          if (idx < 0) idx += n;
          shifted[k] = I[idx];
        }

        let num = 0;
        let den = 0;
        for (let k = 0; k < n; k++) {
          num += U[k].x * shifted[k].y - U[k].y * shifted[k].x;
          den += U[k].x * shifted[k].x + U[k].y * shifted[k].y;
        }
        const theta = Math.atan2(num, den);
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        let sumSq = 0;
        const rotated = new Array(n);
        for (let k = 0; k < n; k++) {
          const rx = shifted[k].x * cosT - shifted[k].y * sinT;
          const ry = shifted[k].x * sinT + shifted[k].y * cosT;
          rotated[k] = { x: rx, y: ry };
          sumSq += (U[k].x - rx) * (U[k].x - rx) + (U[k].y - ry) * (U[k].y - ry);
        }

        const mse = sumSq / n;
        if (!best || mse < best.mse) best = { mse, rotated };
      }
    }
    return best;
  }

  function scoreDrawing(rawPoints, shape) {
    if (rawPoints.length < 8) return null;

    const userResampled = resampleClosed(rawPoints, RESAMPLE_COUNT);
    const userNorm = userResampled && normalize(userResampled);
    if (!userNorm) return null;

    const idealNorm = normalize(idealShapePoints(shape, RESAMPLE_COUNT));
    const best = bestAlignment(userNorm.points, idealNorm.points);

    const rmsError = Math.sqrt(best.mse);
    const pct = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-rmsError * SCORE_STEEPNESS))));

    // Die angepasste Idealform zurück in Canvas-Koordinaten der Zeichnung
    // transformieren, damit sie zum Vergleich darüber gelegt werden kann.
    const fittedIdeal = best.rotated.map((p) => ({
      x: p.x * userNorm.scale + userNorm.centroid.x,
      y: p.y * userNorm.scale + userNorm.centroid.y,
    }));

    return { pct, fittedIdeal };
  }

  function verdictFor(pct) {
    if (pct >= 90) return "Wow, fast perfekt!";
    if (pct >= 70) return "Gar nicht schlecht!";
    if (pct >= 40) return "Ausbaufähig …";
    return "Nochmal versuchen!";
  }

  function drawFittedIdeal(fittedIdeal) {
    ctx.save();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--game-orange").trim() || "#ffb787";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    fittedIdeal.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* Runden-Steuerung                                                     */
  /* ------------------------------------------------------------------ */
  function resetDrawing() {
    points = [];
    resultPanel.hidden = true;
    drawActions.hidden = false;
    resultActions.hidden = true;
    resizeCanvas();
  }

  function startRound() {
    Sound.unlock();
    shapePromptName.textContent = SHAPE_NAMES[selectedShape];
    ViewNav.transition(setupView, playView);
  }

  // Canvas erst sizen, sobald play-view tatsächlich sichtbar ist (view-nav.js
  // blendet Views erst 220ms nach dem transition()-Aufruf ein).
  playView.addEventListener("viewshow", resetDrawing);

  function evaluateDrawing() {
    const result = scoreDrawing(points, selectedShape);
    if (!result) {
      Toast.show("Bitte erst eine Form zeichnen", "alert-triangle");
      return;
    }
    drawFittedIdeal(result.fittedIdeal);
    resultScoreEl.textContent = `${result.pct}%`;
    resultVerdictEl.textContent = verdictFor(result.pct);
    resultPanel.hidden = false;
    drawActions.hidden = true;
    resultActions.hidden = false;
    Sound.success();
  }

  startButton.addEventListener("click", startRound);
  clearButton.addEventListener("click", resetDrawing);
  evaluateButton.addEventListener("click", evaluateDrawing);
  retryButton.addEventListener("click", resetDrawing);
  newShapeButton.addEventListener("click", () => ViewNav.transition(playView, setupView));

  backButton.addEventListener("click", () => {
    if (!playView.hidden && setupView.hidden) {
      ConfirmDialog.show({
        title: "Spiel verlassen?",
        message: "Die aktuelle Zeichnung geht verloren.",
        confirmLabel: "Verlassen",
        onConfirm: () => ViewNav.transition(playView, setupView),
      });
      return;
    }
    PageTransition.navigate("/");
  });

  // Bestätigung beim System-Zurück (Android/iOS-Zurück-Geste, siehe
  // view-nav.js) – die lässt sich nur synchron per window.confirm()
  // abfangen, ein eigenes Dialogfenster kann die Browser-Navigation nicht
  // rechtzeitig aufhalten.
  window.confirmGameExit = function () {
    const currentActive = document.querySelector(".app-view:not([hidden])");
    if (currentActive && currentActive.id === "play-view") {
      return confirm("Möchtest du das laufende Spiel wirklich beenden?");
    }
    return true;
  };
})();
