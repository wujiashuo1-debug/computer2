(() => {
  const DATA = window.TERM_DATA || [];
  const state = {
    pool: [],
    terms: [],
    definitions: [],
    selectedTermId: null,
    matches: {},
    checked: false,
    revealed: false,
  };

  const els = {
    chapterSelect: document.getElementById('chapterSelect'),
    countSelect: document.getElementById('countSelect'),
    modeSelect: document.getElementById('modeSelect'),
    newRoundBtn: document.getElementById('newRoundBtn'),
    checkBtn: document.getElementById('checkBtn'),
    answerBtn: document.getElementById('answerBtn'),
    clearBtn: document.getElementById('clearBtn'),
    printBtn: document.getElementById('printBtn'),
    stats: document.getElementById('stats'),
    termCount: document.getElementById('termCount'),
    terms: document.getElementById('terms'),
    definitions: document.getElementById('definitions'),
    resultPanel: document.getElementById('resultPanel'),
    scoreLine: document.getElementById('scoreLine'),
    mistakeList: document.getElementById('mistakeList'),
    bankList: document.getElementById('bankList'),
  };

  const storageKey = 'cn-matching-mistakes-v1';

  function normalizeText(s) {
    return String(s || '').replace(/\s+/g, '').replace(/[。；;,.，]/g, '');
  }

  function equivalent(a, b) {
    return normalizeText(a.term) === normalizeText(b.term) && normalizeText(a.definition) === normalizeText(b.definition);
  }

  function getMistakes() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); }
    catch { return []; }
  }

  function saveMistakes(ids) {
    localStorage.setItem(storageKey, JSON.stringify([...new Set(ids)]));
  }

  function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function chapterShort(chapter) {
    return chapter.replace(/\s+/g, ' ').replace('计算机网络概述', '概述').replace('数据链路层', '链路层');
  }

  function setupChapters() {
    const chapters = [...new Set(DATA.map(x => x.chapter))];
    els.chapterSelect.innerHTML = '<option value="all">全部章节</option>' + chapters.map(ch => `<option value="${escapeHtml(ch)}">${escapeHtml(ch)}</option>`).join('');
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function getPool() {
    const chapter = els.chapterSelect.value;
    let pool = chapter === 'all' ? DATA : DATA.filter(x => x.chapter === chapter);
    if (els.modeSelect.value === 'mistakes') {
      const ids = new Set(getMistakes());
      pool = pool.filter(x => ids.has(x.id));
      if (!pool.length) {
        alert('目前还没有错题记录。先随机练一轮并批改，就会自动记录错题。');
        els.modeSelect.value = 'random';
        return getPool();
      }
    }
    return pool;
  }

  function newRound() {
    const pool = getPool();
    const countValue = els.countSelect.value;
    let count = countValue === 'all' ? pool.length : Number(countValue);
    count = Math.min(Math.max(count, 1), pool.length);
    const selected = els.modeSelect.value === 'sequential' ? pool.slice(0, count) : shuffle(pool).slice(0, count);
    state.pool = pool;
    state.terms = selected;
    state.definitions = shuffle(selected);
    state.selectedTermId = null;
    state.matches = {};
    state.checked = false;
    state.revealed = false;
    els.resultPanel.hidden = true;
    render();
  }

  function labelForDef(id) {
    const index = state.definitions.findIndex(x => x.id === id);
    return index >= 0 ? String.fromCharCode(65 + index) : '';
  }

  function labelForTerm(id) {
    const index = state.terms.findIndex(x => x.id === id);
    return index >= 0 ? String(index + 1) : '';
  }

  function getTermById(id) { return DATA.find(x => x.id === id); }

  function getDefById(id) { return DATA.find(x => x.id === id); }

  function isCorrect(termId, defId) {
    if (!termId || !defId) return false;
    const term = getTermById(termId);
    const def = getDefById(defId);
    return term && def && (term.id === def.id || equivalent(term, def));
  }

  function render() {
    renderStats();
    renderTerms();
    renderDefinitions();
    renderBank();
  }

  function renderStats() {
    const total = DATA.length;
    const uniqueTerms = new Set(DATA.map(x => normalizeText(x.term) + '|' + normalizeText(x.definition))).size;
    const poolTotal = state.pool.length || getPool().length;
    const mistakes = getMistakes().length;
    els.stats.innerHTML = `
      <span class="badge">文档名词解释：${total} 条</span>
      <span class="badge">去重后约：${uniqueTerms} 条</span>
      <span class="badge">当前范围：${poolTotal} 条</span>
      <span class="badge">错题本：${mistakes} 条</span>
    `;
    els.termCount.textContent = `${state.terms.length} 题`;
  }

  function renderTerms() {
    els.terms.innerHTML = state.terms.map((item, idx) => {
      const matchedDefId = state.matches[item.id];
      const classes = ['item'];
      if (state.selectedTermId === item.id) classes.push('selected');
      if (matchedDefId) classes.push('matched');
      if (state.checked) classes.push(isCorrect(item.id, matchedDefId) ? 'correct' : 'wrong');
      if (state.revealed) classes.push('revealed');
      const tag = matchedDefId ? `<div class="match-tag">已连：${labelForDef(matchedDefId)}</div>` : '';
      return `<button class="${classes.join(' ')}" data-term-id="${item.id}" type="button">
        <span class="num">${idx + 1}</span>
        <span class="item-main">
          <span class="term">${escapeHtml(item.term)}</span>
          <span class="chapter-tag">${escapeHtml(chapterShort(item.chapter))}</span>
          ${tag}
        </span>
      </button>`;
    }).join('');
  }

  function renderDefinitions() {
    els.definitions.innerHTML = state.definitions.map((item, idx) => {
      const matchedTermId = Object.keys(state.matches).find(termId => state.matches[termId] === item.id);
      const classes = ['item'];
      if (matchedTermId) classes.push('matched');
      if (state.checked && matchedTermId) classes.push(isCorrect(matchedTermId, item.id) ? 'correct' : 'wrong');
      if (state.revealed) classes.push('revealed');
      const tag = matchedTermId ? `<div class="match-tag">已连：${labelForTerm(matchedTermId)}</div>` : '';
      return `<button class="${classes.join(' ')}" data-def-id="${item.id}" type="button">
        <span class="letter">${String.fromCharCode(65 + idx)}</span>
        <span class="item-main">
          <span class="definition">${escapeHtml(item.definition)}</span>
          ${tag}
        </span>
      </button>`;
    }).join('');
  }

  function renderBank() {
    const chapters = [...new Set(DATA.map(x => x.chapter))];
    els.bankList.innerHTML = chapters.map(ch => {
      const rows = DATA.filter(x => x.chapter === ch).map(x => `<div class="bank-row"><strong>${escapeHtml(x.term)}</strong>：${escapeHtml(x.definition)}</div>`).join('');
      return `<div class="bank-chapter"><h3>${escapeHtml(ch)}</h3>${rows}</div>`;
    }).join('');
  }

  function selectTerm(termId) {
    state.selectedTermId = state.selectedTermId === termId ? null : termId;
    state.checked = false;
    state.revealed = false;
    els.resultPanel.hidden = true;
    renderTerms();
    renderDefinitions();
  }

  function selectDefinition(defId) {
    if (!state.selectedTermId) {
      alert('先点左边的名词，再点右边的释义。');
      return;
    }
    const oldTerm = Object.keys(state.matches).find(termId => state.matches[termId] === defId);
    if (oldTerm && oldTerm !== state.selectedTermId) delete state.matches[oldTerm];
    state.matches[state.selectedTermId] = defId;
    state.selectedTermId = null;
    state.checked = false;
    state.revealed = false;
    els.resultPanel.hidden = true;
    renderTerms();
    renderDefinitions();
  }

  function checkAnswers() {
    state.checked = true;
    state.revealed = false;
    let correct = 0;
    const wrong = [];
    state.terms.forEach(term => {
      const defId = state.matches[term.id];
      if (isCorrect(term.id, defId)) correct += 1;
      else wrong.push({ term, chosen: defId ? getDefById(defId) : null });
    });
    const previousMistakes = getMistakes();
    const newMistakes = wrong.map(x => x.term.id);
    const cleared = state.terms.filter(term => isCorrect(term.id, state.matches[term.id])).map(x => x.id);
    const finalMistakes = previousMistakes.filter(id => !cleared.includes(id)).concat(newMistakes);
    saveMistakes(finalMistakes);

    els.resultPanel.hidden = false;
    els.scoreLine.className = `score-line ${wrong.length ? 'bad' : 'ok'}`;
    els.scoreLine.textContent = `本轮得分：${correct} / ${state.terms.length}`;
    els.mistakeList.innerHTML = wrong.length ? wrong.map(({term, chosen}) => `
      <div class="mistake">
        <div><strong>${escapeHtml(term.term)}</strong></div>
        <div>正确释义：${escapeHtml(term.definition)}</div>
        <div>你的选择：${chosen ? escapeHtml(chosen.definition) : '未连线'}</div>
      </div>`).join('') : '<div class="mistake" style="border-color:#bbf7d0;background:#f0fdf4"><strong>全对。</strong>这一轮可以过，但别飘，换章节继续刷。</div>';
    render();
    els.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showAnswers() {
    state.terms.forEach(term => { state.matches[term.id] = term.id; });
    state.checked = false;
    state.revealed = true;
    els.resultPanel.hidden = true;
    renderTerms();
    renderDefinitions();
  }

  function clearMatches() {
    state.matches = {};
    state.selectedTermId = null;
    state.checked = false;
    state.revealed = false;
    els.resultPanel.hidden = true;
    renderTerms();
    renderDefinitions();
  }

  els.terms.addEventListener('click', e => {
    const btn = e.target.closest('[data-term-id]');
    if (btn) selectTerm(btn.dataset.termId);
  });
  els.definitions.addEventListener('click', e => {
    const btn = e.target.closest('[data-def-id]');
    if (btn) selectDefinition(btn.dataset.defId);
  });
  els.newRoundBtn.addEventListener('click', newRound);
  els.checkBtn.addEventListener('click', checkAnswers);
  els.answerBtn.addEventListener('click', showAnswers);
  els.clearBtn.addEventListener('click', clearMatches);
  els.printBtn.addEventListener('click', () => window.print());
  els.chapterSelect.addEventListener('change', newRound);
  els.countSelect.addEventListener('change', newRound);
  els.modeSelect.addEventListener('change', newRound);

  setupChapters();
  newRound();
})();
