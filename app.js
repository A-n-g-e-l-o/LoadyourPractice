const fileInput = document.getElementById('fileInput');
const loadSample = document.getElementById('loadSample');
const statusEl = document.getElementById('status');
const questionTitle = document.getElementById('questionTitle');
const questionText = document.getElementById('questionText');
const questionProgress = document.getElementById('questionProgress');
const optionsForm = document.getElementById('optionsForm');
const checkAnswerBtn = document.getElementById('checkAnswer');
const nextQuestionBtn = document.getElementById('nextQuestion');
const prevQuestionBtn = document.getElementById('prevQuestion');
const feedbackEl = document.getElementById('feedback');
const toggleScoreBtn = document.getElementById('toggleScore');
const scorePanel = document.getElementById('scorePanel');
const scoreCorrect = document.getElementById('scoreCorrect');
const scoreIncorrect = document.getElementById('scoreIncorrect');
const scoreTotal = document.getElementById('scoreTotal');
const themeButtons = document.querySelectorAll('.theme-btn');
const randomToggle = document.getElementById('randomToggle');
const toggleHistoryBtn = document.getElementById('toggleHistory');
const historyPanel = document.getElementById('historyPanel');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistory');
const resetSessionBtn = document.getElementById('resetSession');

const HISTORY_KEY = 'loadyourpractice-history';
const RANDOM_KEY = 'loadyourpractice-random';

let questions = [];
let baseQuestions = [];
let currentIndex = 0;
let answers = new Map();
let score = { correct: 0, incorrect: 0, total: 0 };
let history = [];
let currentFileName = '';

const stripPrefix = (line) => line.replace(/^[\s\d\|]+/, '').trim();

const normalizeQuestionText = (text) => {
  let normalized = text.replace(/\r\n/g, '\n');
  normalized = normalized.replace(/QUESTION\s*(\d+)/gi, '\nQUESTION $1\n');
  normalized = normalized.replace(/Correct Answer\s*:\s*/gi, '\nCorrect Answer: ');
  normalized = normalized.replace(/\b([A-Z])\s*/g, '\n$1. ');
  return normalized;
};

const parseQuestions = (text) => {
  const lines = text.split(/\r?\n/).map(stripPrefix);
  const result = [];
  let current = null;
  let collectingText = false;

  const pushCurrent = () => {
    if (current) {
      current.text = current.text.join(' ').replace(/\s+/g, ' ').trim();
      result.push(current);
    }
  };  

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const questionMatch = line.match(/^QUESTION\s+(\d+)/i);
    if (questionMatch) {
      pushCurrent();
      current = {
        number: questionMatch[1],
        text: [],
        options: [],
        correct: []
      };
      collectingText = true;
      continue;
    }

    if (!current) continue;

    const correctMatch = line.match(/^Correct Answer\s*:\s*(.+)$/i);
    if (correctMatch) {
      const letters = correctMatch[1]
        .replace(/[^A-Za-z]/g, '')
        .toUpperCase()
        .split('');
      current.correct = Array.from(new Set(letters));
      collectingText = false;
      continue;
    }

    if (/^Choose\s+/i.test(line) || /^-{2,}/.test(line)) {
      continue;
    }

    const optionMatch = line.match(/^([A-Z])\./);
    if (optionMatch) {
      const label = optionMatch[1];
      const value = line.replace(/^([A-Z])\./, '').trim();
      current.options.push({ label, value });
      collectingText = false;
      continue;
    }

    if (collectingText) {
      current.text.push(line);
    }
  }

  pushCurrent();
  return result;
};

const updateStatus = (message) => {
  statusEl.textContent = message;
};

const updateScorePanel = () => {
  scoreCorrect.textContent = score.correct;
  scoreIncorrect.textContent = score.incorrect;
  scoreTotal.textContent = score.total;
};

const configurePdfWorker = () => {
  if (window.pdfjsLib?.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
};

const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

const readPdfText = async (file) => {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js is not available.');
  }
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => `${item.str}${item.hasEOL ? '\n' : ' '}`)
      .join('');
    text += `${pageText}\n`;
  }

  return text;
};

const readDocxText = async (file) => {
  if (!window.mammoth) {
    throw new Error('Mammoth is not available.');
  }
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

const loadHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch (error) {
    return [];
  }
};

const saveHistory = () => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

const renderHistory = () => {
  if (!historyList) return;
  historyList.innerHTML = '';

  if (!history.length) {
    const emptyItem = document.createElement('li');
    emptyItem.textContent = 'Geen geschiedenis opgeslagen.';
    historyList.appendChild(emptyItem);
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement('li');
    const dateText = new Date(entry.date).toLocaleString();
    const fileText = entry.file ? ` • ${entry.file}` : '';
    item.textContent = ` ${dateText} • ${entry.correct}/${entry.total} goed${fileText}`;
    historyList.appendChild(item);
  });
};

const addHistoryEntry = () => {
  if (score.total === 0) return;
  history.unshift({
    date: new Date().toISOString(),
    correct: score.correct,
    incorrect: score.incorrect,
    total: score.total,
    file: currentFileName || 'Onbekend'
  });

  history = history.slice(0, 50);
  saveHistory();
  renderHistory();
};

const shuffleQuestions = (list) => {
  const array = [...list];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const applyQuestionOrder = () => {
  if (!baseQuestions.length) {
    questions = [];
    return;
  }
  questions = randomToggle?.checked ? shuffleQuestions(baseQuestions) : [...baseQuestions];
  currentIndex = 0;
  answers = new Map();
  score = { correct: 0, incorrect: 0, total: 0 };
  updateScorePanel();
  renderQuestion();
};

const resetSession = () => {
  answers = new Map();
  score = { correct: 0, incorrect: 0, total: 0 };
  updateScorePanel();
  renderQuestion();
};

const renderQuestion = () => {
  if (!questions.length) {
    questionTitle.textContent = 'Geen vragen geladen';
    questionText.textContent = 'Laad een bestand om te beginnen.';
    optionsForm.innerHTML = '';
    questionProgress.textContent = '0 / 0';
    feedbackEl.textContent = '';
    return;
  }

  const question = questions[currentIndex];
  questionTitle.textContent = `Vraag ${question.number}`;
  questionText.textContent = question.text || 'Geen vraagtekst gevonden.';
  questionProgress.textContent = `${currentIndex + 1} / ${questions.length}`;
  feedbackEl.textContent = '';

  const existing = answers.get(question.number);
  const isMulti = question.correct.length > 1;
  optionsForm.innerHTML = '';

  question.options.forEach((option) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'option';

    const input = document.createElement('input');
    input.type = isMulti ? 'checkbox' : 'radio';
    input.name = 'option';
    input.value = option.label;

    if (existing?.selected?.includes(option.label)) {
      input.checked = true;
    }

    const span = document.createElement('span');
    span.textContent = `${option.label}. ${option.value}`;

    wrapper.appendChild(input);
    wrapper.appendChild(span);
    optionsForm.appendChild(wrapper);
  });

  if (existing?.checked) {
    feedbackEl.textContent = existing.correct
      ? 'Correct!'
      : `Onjuist. Juiste antwoord: ${question.correct.join(', ')}`;
    feedbackEl.className = existing.correct ? 'feedback success' : 'feedback error';
  }
};

const getSelectedAnswers = () => {
  const selected = Array.from(optionsForm.querySelectorAll('input:checked'))
    .map((input) => input.value)
    .sort();
  return selected;
};

const compareAnswers = (selected, correct) => {
  if (selected.length !== correct.length) return false;
  return selected.every((answer) => correct.includes(answer));
};

const updateScore = (question, wasCorrect, isCorrect) => {
  if (wasCorrect === undefined) {
    score.total += 1;
    if (isCorrect) score.correct += 1;
    else score.incorrect += 1;
    return;
  }

  if (wasCorrect === isCorrect) return;
  if (wasCorrect) {
    score.correct -= 1;
    score.incorrect += 1;
  } else {
    score.incorrect -= 1;
    score.correct += 1;
  }
};

const loadQuestionsFromText = (text, fileName) => {
  const normalizedText = normalizeQuestionText(text);
  baseQuestions = parseQuestions(normalizedText);
  currentFileName = fileName;
  applyQuestionOrder();

  if (!baseQuestions.length) {
    updateStatus(`Geen vragen gevonden in ${fileName}. Controleer het formaat.`);
    return;
  }

  updateStatus(`Geladen: ${fileName} (${baseQuestions.length} vragen)`);
};

const loadQuestionsFromFile = async (file) => {
  const extension = file.name.split('.').pop().toLowerCase();
  updateStatus(`Bezig met laden van ${file.name}...`);

  try {
    let text = '';

    if (extension === 'pdf') {
      text = await readPdfText(file);
    } else if (extension === 'docx') {
      text = await readDocxText(file);
    } else {
      text = await readFileAsText(file);
    }

    loadQuestionsFromText(text, file.name);
  } catch (error) {
    console.error(error);
    updateStatus('Kon bestand niet laden.');
  }
};

checkAnswerBtn.addEventListener('click', () => {
  if (!questions.length) return;
  const question = questions[currentIndex];
  const selected = getSelectedAnswers();
  if (!selected.length) {
    feedbackEl.textContent = 'Selecteer eerst een antwoord.';
    feedbackEl.className = 'feedback warning';
    return;
  }

  const isCorrect = compareAnswers(selected, question.correct);
  const existing = answers.get(question.number);

  updateScore(question, existing?.correct, isCorrect);

  answers.set(question.number, {
    selected,
    correct: isCorrect,
    checked: true
  });

  feedbackEl.textContent = isCorrect
    ? 'Correct!'
    : `Onjuist. Juiste antwoord: ${question.correct.join(', ')}`;
  feedbackEl.className = isCorrect ? 'feedback success' : 'feedback error';

  updateScorePanel();
});

nextQuestionBtn.addEventListener('click', () => {
  if (!questions.length) return;
  currentIndex = (currentIndex + 1) % questions.length;
  renderQuestion();
});

prevQuestionBtn.addEventListener('click', () => {
  if (!questions.length) return;
  currentIndex = (currentIndex - 1 + questions.length) % questions.length;
  renderQuestion();
});

toggleScoreBtn.addEventListener('click', () => {
  scorePanel.hidden = !scorePanel.hidden;
  toggleScoreBtn.textContent = scorePanel.hidden ? 'Toon score' : 'Verberg score';
});

toggleHistoryBtn?.addEventListener('click', () => {
  historyPanel.hidden = !historyPanel.hidden;
  toggleHistoryBtn.textContent = historyPanel.hidden
    ? 'Toon geschiedenis'
    : 'Verberg geschiedenis';
});

clearHistoryBtn?.addEventListener('click', () => {
  history = [];
  saveHistory();
  renderHistory();
});

resetSessionBtn?.addEventListener('click', () => {
  addHistoryEntry();
  resetSession();
});

themeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    document.body.className = button.dataset.theme;
  });
});

randomToggle?.addEventListener('change', () => {
  localStorage.setItem(RANDOM_KEY, randomToggle.checked);
  if (!baseQuestions.length) return;
  applyQuestionOrder();
  updateStatus(
    randomToggle.checked
      ? 'Random volgorde ingeschakeld.'
      : 'Random volgorde uitgeschakeld.'
  );
});

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  addHistoryEntry();
  await loadQuestionsFromFile(file);
});

loadSample.addEventListener('click', async () => {
  try {
    addHistoryEntry();
    const response = await fetch('sample.psm1');
    const text = await response.text();
    loadQuestionsFromText(text, 'sample.psm1');
  } catch (error) {
    updateStatus('Kon sample.psm1 niet laden.');
  }
});

configurePdfWorker();

history = loadHistory();
if (randomToggle) {
  const storedRandom = localStorage.getItem(RANDOM_KEY);
  if (storedRandom !== null) {
    randomToggle.checked = storedRandom === 'true';
  }
}
renderHistory();
updateScorePanel();
renderQuestion();