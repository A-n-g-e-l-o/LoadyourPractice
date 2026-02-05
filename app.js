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

let questions = [];
let currentIndex = 0;
let answers = new Map();
let score = { correct: 0, incorrect: 0, total: 0 };

const stripPrefix = (line) => line.replace(/^[\s\d\|]+/, '').trim();

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

    if (/^Choose\s+/i.test(line) || /^\-{2,}/.test(line)) {
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

themeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    document.body.className = button.dataset.theme;
  });
});

fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    questions = parseQuestions(reader.result);
    currentIndex = 0;
    answers = new Map();
    score = { correct: 0, incorrect: 0, total: 0 };
    updateScorePanel();
    updateStatus(`Geladen: ${file.name} (${questions.length} vragen)`);
    renderQuestion();
  };
  reader.readAsText(file);
});

loadSample.addEventListener('click', async () => {
  try {
    const response = await fetch('sample.psm1');
    const text = await response.text();
    questions = parseQuestions(text);
    currentIndex = 0;
    answers = new Map();
    score = { correct: 0, incorrect: 0, total: 0 };
    updateScorePanel();
    updateStatus(`Geladen: sample.psm1 (${questions.length} vragen)`);
    renderQuestion();
  } catch (error) {
    updateStatus('Kon sample.psm1 niet laden.');
  }
});

updateScorePanel();
renderQuestion();