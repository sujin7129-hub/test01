const STORAGE_KEY = "vocab-study-app-v1";

let state = {
  decks: [],
  currentDeckId: null,
  importRows: [],
  importHeaders: [],
  study: {
    mode: null,
    items: [],
    index: 0,
    flipped: false,
    currentQuiz: null
  }
};

const $ = (id) => document.getElementById(id);

const posAliases = {
  "n.": "명사", "noun": "명사", "명사": "명사",
  "v.": "동사", "verb": "동사", "동사": "동사",
  "adj.": "형용사", "adjective": "형용사", "형용사": "형용사",
  "adv.": "부사", "adverb": "부사", "부사": "부사",
  "prep.": "전치사", "preposition": "전치사", "전치사": "전치사",
  "conj.": "접속사", "conjunction": "접속사", "접속사": "접속사",
  "phrase": "표현/숙어", "idiom": "숙어", "숙어": "숙어",
  "동사구/숙어": "동사구/숙어",
  "전치사구/부사구": "전치사구/부사구"
};

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.decks));
}

function load() {
  try {
    state.decks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    state.decks = [];
  }
}

function normalizePos(pos) {
  const raw = String(pos || "").trim();
  if (!raw) return "미분류";
  return posAliases[raw.toLowerCase()] || raw;
}

function getStatus(item) {
  const score = item.masteryScore || 0;
  if ((item.wrongCount || 0) > 0 && score < 3) return "오답";
  if ((item.studyCount || 0) === 0) return "미학습";
  if (score >= 6) return "암기 완료";
  return "학습 중";
}

function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function currentDeck() {
  return state.decks.find(d => d.id === state.currentDeckId);
}

function renderDeckList() {
  const wrap = $("deckList");
  wrap.innerHTML = "";

  if (!state.decks.length) {
    wrap.innerHTML = `<p class="muted">저장된 단어장이 없습니다.</p>`;
    return;
  }

  state.decks.forEach(deck => {
    const learned = deck.items.filter(i => getStatus(i) !== "미학습").length;
    const wrong = deck.items.filter(i => getStatus(i) === "오답").length;
    const el = document.createElement("div");
    el.className = "deck-item" + (deck.id === state.currentDeckId ? " active" : "");
    el.innerHTML = `
      <strong>${escapeHtml(deck.title)}</strong>
      <small>${deck.items.length}개 · 학습 ${learned}개 · 오답 ${wrong}개</small>
    `;
    el.onclick = () => openDeck(deck.id);
    wrap.appendChild(el);
  });
}

function openDeck(deckId) {
  state.currentDeckId = deckId;
  renderDeckList();
  renderDeckView();
  showView("deckView");
}

function renderDeckView() {
  const deck = currentDeck();
  if (!deck) {
    showView("uploadView");
    return;
  }

  $("deckName").textContent = deck.title;
  $("deckMeta").textContent = `${deck.items.length}개 단어 · 생성일 ${new Date(deck.createdAt).toLocaleString()}`;

  renderStats(deck);
  renderFilters(deck);
  renderWordTable(deck);
}

function renderStats(deck) {
  const total = deck.items.length;
  const learned = deck.items.filter(i => getStatus(i) !== "미학습").length;
  const done = deck.items.filter(i => getStatus(i) === "암기 완료").length;
  const wrong = deck.items.filter(i => getStatus(i) === "오답").length;
  const correct = deck.items.reduce((sum, i) => sum + (i.correctCount || 0), 0);
  const incorrect = deck.items.reduce((sum, i) => sum + (i.wrongCount || 0), 0);
  const rate = correct + incorrect ? Math.round((correct / (correct + incorrect)) * 100) : 0;

  $("statsCards").innerHTML = `
    ${statCard("전체", total)}
    ${statCard("학습", learned)}
    ${statCard("암기 완료", done)}
    ${statCard("오답", wrong)}
    ${statCard("정답률", `${rate}%`)}
  `;
}

function statCard(label, value) {
  return `<div class="stat-card"><span>${label}</span><strong>${value}</strong></div>`;
}

function renderFilters(deck) {
  const posSet = [...new Set(deck.items.map(i => i.partOfSpeech || "미분류"))].sort();
  const current = $("posFilter").value;
  $("posFilter").innerHTML = `<option value="">전체 품사</option>` + posSet.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  $("posFilter").value = current;
}

function renderWordTable(deck) {
  const search = $("searchInput").value.trim().toLowerCase();
  const pos = $("posFilter").value;
  const status = $("statusFilter").value;

  let items = deck.items;
  if (search) {
    items = items.filter(i =>
      i.term.toLowerCase().includes(search) ||
      i.meaning.toLowerCase().includes(search) ||
      (i.partOfSpeech || "").toLowerCase().includes(search)
    );
  }
  if (pos) items = items.filter(i => i.partOfSpeech === pos);
  if (status) items = items.filter(i => getStatus(i) === status);

  const rows = items.map((i, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><b>${escapeHtml(i.term)}</b></td>
      <td>${escapeHtml(i.partOfSpeech || "미분류")}</td>
      <td>${escapeHtml(i.meaning)}</td>
      <td>${getStatus(i)}</td>
      <td>${i.correctCount || 0}/${i.wrongCount || 0}</td>
      <td>
        <button class="ghost" onclick="editItem('${i.id}')">수정</button>
        <button class="danger ghost" onclick="deleteItem('${i.id}')">삭제</button>
      </td>
    </tr>
  `).join("");

  $("wordTable").innerHTML = `
    <thead>
      <tr>
        <th>#</th><th>어휘/표현</th><th>품사</th><th>뜻</th><th>상태</th><th>정답/오답</th><th>관리</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="7" class="muted">표시할 단어가 없습니다.</td></tr>`}</tbody>
  `;
}

window.editItem = function(itemId) {
  const deck = currentDeck();
  const item = deck.items.find(i => i.id === itemId);
  if (!item) return;

  const term = prompt("어휘/표현", item.term);
  if (term === null) return;
  const pos = prompt("품사", item.partOfSpeech || "");
  if (pos === null) return;
  const meaning = prompt("뜻", item.meaning);
  if (meaning === null) return;

  item.term = term.trim();
  item.partOfSpeech = normalizePos(pos);
  item.meaning = meaning.trim();
  save();
  renderDeckView();
};

window.deleteItem = function(itemId) {
  if (!confirm("이 단어를 삭제할까요?")) return;
  const deck = currentDeck();
  deck.items = deck.items.filter(i => i.id !== itemId);
  save();
  renderDeckView();
  renderDeckList();
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some(v => String(v).trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }

  row.push(cell);
  if (row.some(v => String(v).trim() !== "")) rows.push(row);

  const headers = rows.shift()?.map(h => String(h).trim()) || [];
  return rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = String(r[i] ?? "").trim());
    return obj;
  });
}

async function readFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "csv") {
    const text = await file.text();
    return parseCSV(text);
  }

  if (["xlsx", "xls"].includes(ext)) {
    if (!window.XLSX) {
      throw new Error("XLSX 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하거나 CSV 파일을 사용하세요.");
    }
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: "" });
  }

  throw new Error("CSV 또는 XLSX 파일만 업로드할 수 있습니다.");
}

function autoMap(headers) {
  const lower = headers.map(h => [h, h.toLowerCase().replace(/\s/g, "")]);

  const find = (candidates) => {
    const found = lower.find(([raw, norm]) => candidates.some(c => norm.includes(c)));
    return found ? found[0] : "";
  };

  return {
    term: find(["어휘", "표현", "단어", "영어", "english", "word", "phrase", "term"]),
    pos: find(["품사", "pos", "partofspeech"]),
    meaning: find(["뜻", "의미", "해석", "meaning", "definition"])
  };
}

function setupMapping(rows, fileName) {
  state.importRows = rows;
  state.importHeaders = Object.keys(rows[0] || {});
  const headers = state.importHeaders;
  const mapping = autoMap(headers);

  fillSelect("mapTerm", headers, mapping.term);
  fillSelect("mapPos", ["", ...headers], mapping.pos);
  fillSelect("mapMeaning", headers, mapping.meaning);

  $("deckTitle").value = fileName.replace(/\.(csv|xlsx|xls)$/i, "");
  $("mappingPanel").classList.remove("hidden");
  $("previewPanel").classList.remove("hidden");
  renderPreview();

  ["mapTerm", "mapPos", "mapMeaning"].forEach(id => $(id).onchange = renderPreview);
}

function fillSelect(id, options, selected) {
  $(id).innerHTML = options.map(o => `<option value="${escapeHtml(o)}">${o ? escapeHtml(o) : "사용 안 함"}</option>`).join("");
  $(id).value = selected || "";
}

function renderPreview() {
  const termCol = $("mapTerm").value;
  const posCol = $("mapPos").value;
  const meaningCol = $("mapMeaning").value;

  const rows = state.importRows.slice(0, 10).map((r, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml(r[termCol] || "")}</td>
      <td>${escapeHtml(posCol ? r[posCol] : "미분류")}</td>
      <td>${escapeHtml(r[meaningCol] || "")}</td>
    </tr>
  `).join("");

  $("previewTable").innerHTML = `
    <thead><tr><th>#</th><th>어휘/표현</th><th>품사</th><th>뜻</th></tr></thead>
    <tbody>${rows}</tbody>
  `;
}

function createDeck() {
  const termCol = $("mapTerm").value;
  const posCol = $("mapPos").value;
  const meaningCol = $("mapMeaning").value;
  const title = $("deckTitle").value.trim();

  if (!termCol || !meaningCol) {
    alert("어휘/표현과 뜻 컬럼을 선택하세요.");
    return;
  }

  const items = state.importRows
    .map(row => ({
      id: uuid(),
      term: String(row[termCol] || "").trim(),
      partOfSpeech: normalizePos(posCol ? row[posCol] : ""),
      meaning: String(row[meaningCol] || "").trim(),
      correctCount: 0,
      wrongCount: 0,
      studyCount: 0,
      masteryScore: 0,
      lastStudiedAt: null,
      nextReviewAt: null
    }))
    .filter(i => i.term && i.meaning);

  if (!items.length) {
    alert("학습할 단어가 없습니다. 컬럼 매핑을 확인하세요.");
    return;
  }

  const deck = {
    id: uuid(),
    title: title || "새 단어장",
    sourceFileName: title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items
  };

  state.decks.unshift(deck);
  save();
  resetImport();
  openDeck(deck.id);
}

function resetImport() {
  state.importRows = [];
  state.importHeaders = [];
  $("fileInput").value = "";
  $("uploadStatus").textContent = "";
  $("mappingPanel").classList.add("hidden");
  $("previewPanel").classList.add("hidden");
}

function startFlashcards(items = null) {
  const deck = currentDeck();
  state.study.mode = "flashcard";
  state.study.items = items || deck.items.slice();
  state.study.index = 0;
  state.study.flipped = false;
  showView("studyView");
  $("flashcardMode").classList.remove("hidden");
  $("quizMode").classList.add("hidden");
  renderFlashcard();
}

function renderFlashcard() {
  const item = state.study.items[state.study.index];
  if (!item) {
    alert("학습할 단어가 없습니다.");
    openDeck(state.currentDeckId);
    return;
  }

  $("studyProgress").textContent = `${state.study.index + 1} / ${state.study.items.length}`;
  $("cardFront").textContent = item.term;
  $("cardBack").innerHTML = `${escapeHtml(item.meaning)}<small>${escapeHtml(item.partOfSpeech || "미분류")}</small>`;
  $("cardFront").classList.toggle("hidden", state.study.flipped);
  $("cardBack").classList.toggle("hidden", !state.study.flipped);
}

function gradeFlashcard(grade) {
  const item = state.study.items[state.study.index];
  if (!item) return;

  item.studyCount = (item.studyCount || 0) + 1;
  item.lastStudiedAt = new Date().toISOString();

  if (grade === "know") {
    item.correctCount = (item.correctCount || 0) + 1;
    item.masteryScore = (item.masteryScore || 0) + 2;
  } else if (grade === "unclear") {
    item.masteryScore = item.masteryScore || 0;
  } else {
    item.wrongCount = (item.wrongCount || 0) + 1;
    item.masteryScore = (item.masteryScore || 0) - 1;
  }

  save();

  if (state.study.index < state.study.items.length - 1) {
    state.study.index++;
    state.study.flipped = false;
    renderFlashcard();
  } else {
    alert("플래시카드 학습이 끝났습니다.");
    openDeck(state.currentDeckId);
  }
}

function startQuiz(items = null) {
  const deck = currentDeck();
  state.study.mode = "quiz";
  state.study.items = items || deck.items.slice();
  state.study.index = 0;
  showView("studyView");
  $("flashcardMode").classList.add("hidden");
  $("quizMode").classList.remove("hidden");
  makeQuiz();
}

function makeQuiz() {
  const items = state.study.items;
  const item = items[state.study.index];

  if (!item) {
    alert("퀴즈가 끝났습니다.");
    openDeck(state.currentDeckId);
    return;
  }

  const type = Math.random() > 0.5 ? "meaning" : "term";
  const question = type === "meaning" ? item.term : item.meaning;
  const answer = type === "meaning" ? item.meaning : item.term;

  const allDeckItems = currentDeck().items;
  const pool = allDeckItems
    .filter(i => i.id !== item.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(i => type === "meaning" ? i.meaning : i.term);

  const choices = [...pool, answer]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort(() => Math.random() - 0.5);

  while (choices.length < 4 && allDeckItems.length > choices.length) {
    const candidate = allDeckItems[Math.floor(Math.random() * allDeckItems.length)];
    const value = type === "meaning" ? candidate.meaning : candidate.term;
    if (value && !choices.includes(value)) choices.push(value);
  }

  state.study.currentQuiz = { itemId: item.id, type, answer };

  $("studyProgress").textContent = `${state.study.index + 1} / ${items.length}`;
  $("quizType").textContent = type === "meaning" ? "뜻 맞히기" : "단어 맞히기";
  $("quizQuestion").textContent = question;
  $("quizFeedback").innerHTML = "";
  $("btnNextQuiz").classList.add("hidden");

  $("quizChoices").innerHTML = choices.map(c => `
    <button class="choice" data-choice="${escapeHtml(c)}">${escapeHtml(c)}</button>
  `).join("");

  document.querySelectorAll(".choice").forEach(btn => {
    btn.onclick = () => answerQuiz(btn.dataset.choice);
  });
}

function answerQuiz(choice) {
  const quiz = state.study.currentQuiz;
  const deck = currentDeck();
  const item = deck.items.find(i => i.id === quiz.itemId);
  const correct = choice === quiz.answer;

  document.querySelectorAll(".choice").forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.choice === quiz.answer) btn.classList.add("correct");
    if (btn.dataset.choice === choice && !correct) btn.classList.add("wrong");
  });

  item.studyCount = (item.studyCount || 0) + 1;
  item.lastStudiedAt = new Date().toISOString();

  if (correct) {
    item.correctCount = (item.correctCount || 0) + 1;
    item.masteryScore = (item.masteryScore || 0) + 2;
    $("quizFeedback").innerHTML = `<p class="success-text">✅ 정답입니다!</p>`;
  } else {
    item.wrongCount = (item.wrongCount || 0) + 1;
    item.masteryScore = (item.masteryScore || 0) - 2;
    $("quizFeedback").innerHTML = `<p class="danger-text">❌ 오답입니다. 정답: <b>${escapeHtml(quiz.answer)}</b></p>`;
  }

  save();
  $("btnNextQuiz").classList.remove("hidden");
}

function nextQuiz() {
  state.study.index++;
  makeQuiz();
}

function exportCSV(deck) {
  const header = ["어휘/표현", "품사", "뜻", "상태", "정답수", "오답수"];
  const rows = deck.items.map(i => [
    i.term, i.partOfSpeech || "미분류", i.meaning, getStatus(i), i.correctCount || 0, i.wrongCount || 0
  ]);

  const csv = [header, ...rows]
    .map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  downloadBlob(csv, `${deck.title}.csv`, "text/csv;charset=utf-8");
}

function downloadBlob(content, filename, type) {
  const blob = new Blob(["\ufeff" + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sampleCSV() {
  const csv = `어휘/표현,품사,뜻
disinfection,명사,소독
last,동사,"지속되다, 계속되다"
chemical,명사,"화학 약품, 화학 제품"
in progress,전치사구/부사구,진행 중인
unpack,동사,(짐을) 풀다
efficient,형용사,효율적인`;
  downloadBlob(csv, "sample_vocab.csv", "text/csv;charset=utf-8");
}

function showWrongOnly() {
  const deck = currentDeck();
  const wrong = deck.items.filter(i => getStatus(i) === "오답" || (i.wrongCount || 0) > 0);
  if (!wrong.length) {
    alert("오답 단어가 없습니다.");
    return;
  }
  const mode = confirm("오답 단어를 퀴즈로 복습할까요?\n취소를 누르면 플래시카드로 복습합니다.");
  if (mode) startQuiz(wrong);
  else startFlashcards(wrong);
}

function bindEvents() {
  $("btnShowUpload").onclick = () => {
    resetImport();
    showView("uploadView");
  };

  $("btnSample").onclick = sampleCSV;
  $("btnCreateDeck").onclick = createDeck;
  $("btnCancelImport").onclick = resetImport;

  $("fileInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      $("uploadStatus").textContent = "파일을 읽는 중입니다...";
      const rows = await readFile(file);
      if (!rows.length) throw new Error("파일에 데이터가 없습니다.");
      $("uploadStatus").textContent = `${rows.length}개 행을 읽었습니다.`;
      setupMapping(rows, file.name);
    } catch (err) {
      $("uploadStatus").textContent = "오류: " + err.message;
    }
  };

  const dropzone = $("dropzone");
  dropzone.ondragover = (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  };
  dropzone.ondragleave = () => dropzone.classList.remove("dragover");
  dropzone.ondrop = (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    $("fileInput").files = e.dataTransfer.files;
    $("fileInput").dispatchEvent(new Event("change"));
  };

  $("searchInput").oninput = () => renderWordTable(currentDeck());
  $("posFilter").onchange = () => renderWordTable(currentDeck());
  $("statusFilter").onchange = () => renderWordTable(currentDeck());

  $("btnFlashcards").onclick = () => startFlashcards();
  $("btnQuiz").onclick = () => startQuiz();
  $("btnWrong").onclick = showWrongOnly;

  $("btnBackToDeck").onclick = () => openDeck(state.currentDeckId);
  $("flashcard").onclick = () => {
    state.study.flipped = !state.study.flipped;
    renderFlashcard();
  };

  document.querySelectorAll("[data-grade]").forEach(btn => {
    btn.onclick = () => gradeFlashcard(btn.dataset.grade);
  });

  $("btnNextQuiz").onclick = nextQuiz;

  $("btnDeleteDeck").onclick = () => {
    const deck = currentDeck();
    if (!deck) return;
    if (!confirm(`"${deck.title}" 단어장을 삭제할까요?`)) return;
    state.decks = state.decks.filter(d => d.id !== deck.id);
    state.currentDeckId = state.decks[0]?.id || null;
    save();
    renderDeckList();
    if (state.currentDeckId) openDeck(state.currentDeckId);
    else showView("uploadView");
  };

  $("btnExportDeck").onclick = () => {
    const deck = currentDeck();
    if (deck) exportCSV(deck);
  };

  $("btnExportAll").onclick = () => {
    downloadBlob(JSON.stringify(state.decks, null, 2), "vocab_app_backup.json", "application/json;charset=utf-8");
  };

  $("btnClearAll").onclick = () => {
    if (!confirm("모든 단어장과 학습 기록을 삭제할까요?")) return;
    state.decks = [];
    state.currentDeckId = null;
    save();
    renderDeckList();
    showView("uploadView");
  };
}

function init() {
  load();
  bindEvents();
  renderDeckList();

  if (state.decks.length) {
    openDeck(state.decks[0].id);
  } else {
    showView("uploadView");
  }
}

init();
