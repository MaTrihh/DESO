let ALL = [];
let selected = [];
let answers = [];
let idx = 0;

let timerId = null;
let endAt = null;

const $ = (id) => document.getElementById(id);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function loadQuestions() {
  const res = await fetch("questions.json");
  if (!res.ok) throw new Error("No se pudo cargar questions.json");
  ALL = await res.json();

  // Validación mínima (para evitar preguntas rotas)
  ALL.forEach((q, i) => {
    if (!q.topic) q.topic = "Sin tema";
    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`Pregunta ${i} sin options válidas`);
    }
    if (
      typeof q.answerIndex !== "number" ||
      q.answerIndex < 0 ||
      q.answerIndex >= q.options.length
    ) {
      throw new Error(`Pregunta ${i} con answerIndex inválido`);
    }
  });
}

function uniqueTopics() {
  const set = new Set(ALL.map((q) => q.topic).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function fillTopics() {
  const sel = $("topicSelect");
  uniqueTopics().forEach((t) => {
    const op = document.createElement("option");
    op.value = t;
    op.textContent = t;
    sel.appendChild(op);
  });
  $("info").textContent = `${ALL.length} preguntas cargadas`;
  $("globalInfo").textContent = `${ALL.length} preguntas · ${
    uniqueTopics().length
  } temas`;
}

function pickQuestions(topic, count) {
  const pool =
    topic === "__ALL__" ? [...ALL] : ALL.filter((q) => q.topic === topic);

  if (pool.length === 0) return [];
  shuffle(pool);
  return pool.slice(0, Math.min(count, pool.length));
}

/* ---------- Navegación ---------- */

function showSection(name) {
  $("setup").classList.add("hidden");
  $("exam").classList.add("hidden");
  $("results").classList.add("hidden");
  $("bank").classList.add("hidden");
  $(name).classList.remove("hidden");
}

$("navExam").addEventListener("click", () => {
  clearInterval(timerId);
  showSection("setup");
});

$("navBank").addEventListener("click", () => {
  clearInterval(timerId);
  showSection("bank");
});

/* ---------- Examen ---------- */

function startExam() {
  const topic = $("topicSelect").value;
  const minutes = Math.max(1, Number($("minutes").value || 30));
  const count = Math.max(1, Number($("count").value || 25));

  selected = pickQuestions(topic, count);
  if (selected.length === 0) {
    alert("No hay preguntas para ese tema.");
    return;
  }

  answers = Array(selected.length).fill(null);
  idx = 0;

  showSection("exam");
  $("topicLabel").textContent =
    topic === "__ALL__" ? "Tema: Todos" : `Tema: ${topic}`;

  clearInterval(timerId);
  endAt = Date.now() + minutes * 60 * 1000;
  tick();
  timerId = setInterval(tick, 250);

  renderQuestion();
}

function tick() {
  const left = endAt - Date.now();
  if (left <= 0) {
    $("timer").textContent = "00:00";
    clearInterval(timerId);
    finishExam(true);
    return;
  }
  const totalSec = Math.ceil(left / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  $("timer").textContent = `${m}:${s}`;
}

function renderQuestion() {
  const q = selected[idx];
  $("questionText").textContent = q.question;
  $("progress").textContent = `Pregunta ${idx + 1} / ${selected.length}`;

  const form = $("optionsForm");
  form.innerHTML = "";

  q.options.forEach((optText, optIdx) => {
    const label = document.createElement("label");
    label.className = "opt";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "opt";
    input.value = String(optIdx);
    input.checked = answers[idx] === optIdx;

    input.addEventListener("change", () => {
      answers[idx] = optIdx;
      updateUnanswered();
    });

    const span = document.createElement("span");
    span.textContent = optText;

    label.appendChild(input);
    label.appendChild(span);
    form.appendChild(label);
  });

  $("prevBtn").disabled = idx === 0;
  $("nextBtn").disabled = idx === selected.length - 1;

  updateUnanswered();
}

function updateUnanswered() {
  const missing = answers.filter((a) => a === null).length;
  $("unanswered").textContent =
    missing === 0 ? "Todo respondido ✅" : `Sin responder: ${missing}`;
}

function finishExam(fromTimeout = false) {
  clearInterval(timerId);

  let correct = 0;
  const details = selected.map((q, i) => {
    const user = answers[i];
    const ok = user === q.answerIndex;
    if (ok) correct++;
    return { q, user, ok };
  });

  showSection("results");

  const total = selected.length;
  const missing = answers.filter((a) => a === null).length;

  $("scoreLine").innerHTML =
    `<strong>${correct}/${total}</strong> correctas` +
    (missing ? ` · ${missing} sin responder` : "") +
    (fromTimeout ? ` · <span class="bad">Tiempo agotado</span>` : "");

  const list = $("resultList");
  list.innerHTML = "";

  details.forEach((d, i) => {
    const div = document.createElement("div");
    div.className = "result-item";

    const userText =
      d.user === null ? "— (sin responder)" : d.q.options[d.user];
    const correctText = d.q.options[d.q.answerIndex];

    div.innerHTML = `
      <div><strong>${i + 1}.</strong> ${d.q.question}</div>
      <div class="${d.ok ? "good" : "bad"}">${d.ok ? "✅ Bien" : "❌ Mal"}</div>
      <div class="muted">Tu respuesta: ${userText}</div>
      ${d.ok ? "" : `<div><strong>Correcta:</strong> ${correctText}</div>`}
      <div class="muted">Tema: ${d.q.topic || "Sin tema"}</div>
    `;
    list.appendChild(div);
  });
}

function backToSetup() {
  clearInterval(timerId);
  showSection("setup");
}

$("startBtn").addEventListener("click", startExam);
$("prevBtn").addEventListener("click", () => {
  if (idx > 0) {
    idx--;
    renderQuestion();
  }
});
$("nextBtn").addEventListener("click", () => {
  if (idx < selected.length - 1) {
    idx++;
    renderQuestion();
  }
});
$("finishBtn").addEventListener("click", () => finishExam(false));
$("backBtn").addEventListener("click", backToSetup);

/* ---------- Banco de preguntas ---------- */

function groupByTopic(questions) {
  const map = new Map();
  for (const q of questions) {
    const t = q.topic || "Sin tema";
    if (!map.has(t)) map.set(t, []);
    map.get(t).push(q);
  }
  const topics = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  return topics.map((t) => ({
    topic: t,
    items: map
      .get(t)
      .slice()
      .sort((a, b) => a.question.localeCompare(b.question)),
  }));
}

function renderBank(filterText = "") {
  const container = $("bankContainer");
  container.innerHTML = "";

  const f = filterText.trim().toLowerCase();
  const filtered = !f
    ? ALL
    : ALL.filter((q) => {
        const hay = `${q.topic} ${q.question} ${q.options?.join(
          " "
        )}`.toLowerCase();
        return hay.includes(f);
      });

  const groups = groupByTopic(filtered);

  groups.forEach((g) => {
    const det = document.createElement("details");

    const sum = document.createElement("summary");
    sum.textContent = `${g.topic} (${g.items.length})`;
    det.appendChild(sum);

    g.items.forEach((q, i) => {
      const block = document.createElement("div");
      block.className = "bank-q";

      const optsHtml = q.options
        .map((op, oi) => {
          const isCorrect = oi === q.answerIndex;
          return `<li class="${isCorrect ? "correct good" : ""}">${op}${
            isCorrect ? " ✅" : ""
          }</li>`;
        })
        .join("");

      block.innerHTML = `
        <div><strong>${i + 1}.</strong> ${q.question}</div>
        <ul>${optsHtml}</ul>
      `;

      det.appendChild(block);
    });

    container.appendChild(det);
  });

  if (groups.length === 0) {
    container.innerHTML = `<p class="muted">No hay resultados con ese filtro.</p>`;
  }
}

$("bankSearch").addEventListener("input", (e) => {
  renderBank(e.target.value);
});

/* ---------- Init ---------- */

(async function init() {
  try {
    await loadQuestions();
    fillTopics();
    renderBank("");
    showSection("setup");
  } catch (e) {
    console.error(e);
    $("globalInfo").textContent = "Error cargando questions.json";
    alert(`Error: ${e.message}`);
  }
})();
