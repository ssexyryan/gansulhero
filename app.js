(() => {
  const app = document.getElementById('app');
  const NAME_KEY = 'gansulhero_name';
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  const DRINKS = [
    { key: 'soju',      label: '소주',   emoji: '🍶' },
    { key: 'beer',      label: '맥주',   emoji: '🍺' },
    { key: 'distilled', label: '증류주', emoji: '🫗' },
    { key: 'wine',      label: '와인',   emoji: '🍷' },
    { key: 'whiskey',   label: '위스키', emoji: '🥃' },
  ];

  const HOLIDAYS = {
    '2025-01-01': '신정', '2025-01-28': '설날연휴', '2025-01-29': '설날',
    '2025-01-30': '설날연휴', '2025-03-01': '삼일절', '2025-05-05': '어린이날',
    '2025-06-06': '현충일', '2025-08-15': '광복절', '2025-10-03': '개천절',
    '2025-10-05': '추석연휴', '2025-10-06': '추석', '2025-10-07': '추석연휴',
    '2025-10-09': '한글날', '2025-12-25': '성탄절',
    '2026-01-01': '신정', '2026-02-16': '설날연휴', '2026-02-17': '설날',
    '2026-02-18': '설날연휴', '2026-03-01': '삼일절', '2026-05-05': '어린이날',
    '2026-05-24': '부처님오신날', '2026-06-06': '현충일', '2026-08-15': '광복절',
    '2026-09-24': '추석연휴', '2026-09-25': '추석', '2026-09-26': '추석연휴',
    '2026-10-03': '개천절', '2026-10-09': '한글날', '2026-12-25': '성탄절',
    '2027-01-01': '신정', '2027-02-06': '설날연휴', '2027-02-07': '설날',
    '2027-02-08': '설날연휴', '2027-03-01': '삼일절', '2027-05-05': '어린이날',
    '2027-05-13': '부처님오신날', '2027-06-06': '현충일', '2027-08-15': '광복절',
    '2027-10-03': '개천절', '2027-10-09': '한글날', '2027-10-14': '추석연휴',
    '2027-10-15': '추석', '2027-10-16': '추석연휴', '2027-12-25': '성탄절',
  };

  const cfg = window.GANSULHERO_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    app.innerHTML = `<div class="center-message"><div class="error-panel">Supabase 설정값이 없어 실행할 수 없음</div></div>`;
    return;
  }

  const supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const state = {
    name: localStorage.getItem(NAME_KEY) || '',
    draftName: '',
    month: new Date(),
    logs: [],
    selectedDate: null,
    form: { soju: 0, beer: 0, distilled: 0, wine: 0, whiskey: 0, memo: '' },
    loading: false,
    error: ''
  };

  const ymd = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const monthLabel = (date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월`;

  const dateLabel = (dateStr) => {
    const d = new Date(`${dateStr}T00:00:00`);
    const dayName = DAYS[d.getDay()];
    const holiday = HOLIDAYS[dateStr];
    const base = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${dayName})`;
    return holiday ? `${base} · ${holiday} 🎌` : base;
  };

  const gridForMonth = (date) => {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const start = first.getDay();
    const cells = [];
    for (let i = 0; i < start; i += 1) cells.push(null);
    for (let d = 1; d <= last; d += 1) cells.push(new Date(date.getFullYear(), date.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const startOfWeek = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  };

  const endOfWeek = (date) => {
    const d = startOfWeek(date);
    d.setDate(d.getDate() + 6);
    return d;
  };

  const weekRangeLabel = (start, end) =>
    `${start.getMonth() + 1}/${start.getDate()}–${end.getMonth() + 1}/${end.getDate()}`;

  const totalBottles = (log) => DRINKS.reduce((sum, d) => sum + (Number(log[d.key]) || 0), 0);

  const heatLevel = (count) => (count >= 6 ? 4 : count >= 4 ? 3 : count >= 2 ? 2 : count >= 1 ? 1 : 0);
  const heatStyle = (level) => [
    'background: rgba(255, 255, 255, 0.85); border-color: rgba(251, 191, 36, 0.12);',
    'background: rgba(254, 240, 138, 0.75); border-color: rgba(245, 158, 11, 0.30);',
    'background: rgba(253, 186, 116, 0.76); border-color: rgba(249, 115, 22, 0.32);',
    'background: rgba(251, 146, 60, 0.82); border-color: rgba(234, 88, 12, 0.40);',
    'background: rgba(249, 115, 22, 0.92); border-color: rgba(194, 65, 12, 0.52); color: #fff7ed;'
  ][level];

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function getDayMap() {
    const map = new Map();
    state.logs.forEach((log) => {
      const arr = map.get(log.drink_date) || [];
      arr.push(log);
      map.set(log.drink_date, arr);
    });
    return map;
  }

  function getTopMemo(logs) {
    if (!logs || !logs.length) return null;
    const withMemo = logs.filter((l) => l.memo);
    if (!withMemo.length) return null;
    return [...withMemo].sort((a, b) => totalBottles(b) - totalBottles(a))[0].memo;
  }

  function getWeeklyHero() {
    const start = startOfWeek(new Date());
    const end = endOfWeek(new Date());
    const counts = new Map();
    state.logs.forEach((log) => {
      const d = new Date(`${log.drink_date}T00:00:00`);
      if (d >= start && d <= end) counts.set(log.user_name, (counts.get(log.user_name) || 0) + 1);
    });
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return { period: weekRangeLabel(start, end), top: sorted[0] || null };
  }

  function getMonthlyRanking() {
    const counts = new Map();
    state.logs.forEach((log) => counts.set(log.user_name, (counts.get(log.user_name) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }

  function emptyForm() {
    return { soju: 0, beer: 0, distilled: 0, wine: 0, whiskey: 0, memo: '' };
  }

  function syncFormWithSelected() {
    if (!state.selectedDate || !state.name) return;
    const mine = state.logs.find(
      (log) => log.drink_date === state.selectedDate && log.user_name === state.name
    );
    state.form = mine
      ? {
          soju: Number(mine.soju) || 0,
          beer: Number(mine.beer) || 0,
          distilled: Number(mine.distilled) || 0,
          wine: Number(mine.wine) || 0,
          whiskey: Number(mine.whiskey) || 0,
          memo: mine.memo || '',
        }
      : emptyForm();
    state.error = '';
  }

  async function fetchMonth() {
    const from = ymd(new Date(state.month.getFullYear(), state.month.getMonth(), 1));
    const to = ymd(new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0));
    const { data, error } = await supabase
      .from('drink_logs')
      .select('id, drink_date, user_name, soju, beer, distilled, wine, whiskey, memo, created_at')
      .gte('drink_date', from)
      .lte('drink_date', to)
      .order('drink_date', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) { state.error = '기록을 불러오지 못했음'; return; }
    state.logs = data || [];
  }

  function getFriendlyError(error) {
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('distilled')) return 'DB에 distilled 컬럼 없음 — migration.sql 실행 필요';
    if (msg.includes('memo')) return 'DB에 memo 컬럼 없음 — migration.sql 실행 필요';
    if (msg.includes('row-level security') || msg.includes('permission')) return 'Supabase 정책 오류 — schema.sql 재실행 필요';
    if (msg.includes('duplicate')) return '중복 오류 — 새로고침 후 다시 시도';
    return error?.message || '저장 중 오류 발생';
  }

  async function saveEntry() {
    if (!state.name || !state.selectedDate || state.loading) return;
    state.loading = true;
    state.error = '';
    render();

    const payload = {
      drink_date: state.selectedDate,
      user_name: state.name,
      soju: state.form.soju,
      beer: state.form.beer,
      distilled: state.form.distilled,
      wine: state.form.wine,
      whiskey: state.form.whiskey,
      memo: state.form.memo.trim().slice(0, 20) || null,
    };

    const existing = state.logs.find(
      (log) => log.drink_date === state.selectedDate && log.user_name === state.name
    );

    let error = null;
    if (existing?.id) {
      ({ error } = await supabase.from('drink_logs').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('drink_logs').insert(payload));
    }

    state.loading = false;
    if (error) { state.error = getFriendlyError(error); render(); return; }

    await fetchMonth();
    state.selectedDate = null;
    render();
  }

  async function deleteEntry() {
    if (!state.name || !state.selectedDate || state.loading) return;
    state.loading = true;
    state.error = '';
    render();

    const { error } = await supabase
      .from('drink_logs')
      .delete()
      .eq('drink_date', state.selectedDate)
      .eq('user_name', state.name);

    state.loading = false;
    if (error) { state.error = '삭제 중 오류 발생'; render(); return; }

    await fetchMonth();
    state.selectedDate = null;
    render();
  }

  function render() {
    const dayMap = getDayMap();
    const grid = gridForMonth(state.month);
    const weeklyHero = getWeeklyHero();
    const ranking = getMonthlyRanking();
    const selectedLogs = state.selectedDate
      ? state.logs.filter((log) => log.drink_date === state.selectedDate)
      : [];
    const mySelected =
      state.selectedDate && state.name
        ? state.logs.find(
            (log) => log.drink_date === state.selectedDate && log.user_name === state.name
          )
        : null;

    app.innerHTML = `
      ${!state.name ? `
        <div class="overlay">
          <div class="name-card">
            <div class="name-top">
              <span class="badge">🍺 간술히어로</span>
              <span class="hint">처음 한 번만 저장</span>
            </div>
            <h1 class="name-title">이름을 등록해줘</h1>
            <div class="name-desc">저장하면 같은 디바이스에서는 다음부터 바로 입장함</div>
            <input class="name-input" id="name-input" value="${escapeHtml(state.draftName)}" placeholder="이름 입력" />
            <button class="primary" id="save-name">입장하기</button>
          </div>
        </div>
      ` : ''}

      <div class="shell">
        <div class="header">
          <div class="brand-wrap">
            <div class="brand-icon">🍺</div>
            <div>
              <div class="brand">간술히어로</div>
              <div class="sub">오늘의 간술 기록을 한눈에</div>
            </div>
          </div>
          <div class="me-chip">내 이름 · ${escapeHtml(state.name || '-')}</div>
        </div>

        <section class="calendar-panel panel">
          <div class="panel-top">
            <div>
              <div class="label">공유 캘린더</div>
              <div class="title">${monthLabel(state.month)}</div>
            </div>
            <div class="actions">
              <button class="ghost" data-action="prev-month">이전</button>
              <button class="ghost" data-action="today">오늘</button>
              <button class="ghost" data-action="next-month">다음</button>
            </div>
          </div>

          <div class="legend">
            ${['0', '1+', '2+', '4+', '6+'].map((label, idx) => `
              <div class="legend-item">
                <span class="legend-swatch" style="${heatStyle(idx)}"></span>
                <span>${label}</span>
              </div>
            `).join('')}
          </div>

          <div class="week-row">${DAYS.map((d) => `<div>${d}</div>`).join('')}</div>
          <div class="grid">
            ${grid.map((date, index) => {
              if (!date) return `<div class="empty" key="e-${index}"></div>`;
              const key = ymd(date);
              const logs = dayMap.get(key) || [];
              const isToday = key === ymd(new Date());
              const holiday = HOLIDAYS[key];
              const topMemo = getTopMemo(logs);
              return `
                <button class="day${isToday ? ' today' : ''}${holiday ? ' holiday' : ''}" data-date="${key}" style="${heatStyle(heatLevel(logs.length))}">
                  <div class="day-head">
                    <span class="day-number">${date.getDate()}</span>
                    ${logs.length ? `<span class="day-count">${logs.length}</span>` : ''}
                  </div>
                  ${holiday ? `<div class="day-holiday">${escapeHtml(holiday)}</div>` : ''}
                  <div class="day-names">
                    ${logs.slice(0, 3).map((log) => `<span class="pill">${escapeHtml(log.user_name)}</span>`).join('')}
                    ${logs.length > 3 ? `<span class="more">+${logs.length - 3}</span>` : ''}
                  </div>
                  ${topMemo ? `<div class="cell-memo">${escapeHtml(topMemo)}</div>` : ''}
                </button>
              `;
            }).join('')}
          </div>
        </section>

        <section class="stats">
          <div class="hero-banner">
            <div class="label">이번 주 배너</div>
            <div class="card-title">🍺 이번 주 최다 음주자</div>
            <div class="hero-period">${weeklyHero.period}</div>
            <div class="hero-value">${weeklyHero.top ? `${escapeHtml(weeklyHero.top[0])} · ${weeklyHero.top[1]}회` : '이번 주 기록 없음'}</div>
          </div>
          <div class="rank-panel">
            <div class="label">간술히어로</div>
            <div class="card-title">이번 달 간술히어로</div>
            <div class="rank-list">
              ${ranking.length
                ? ranking.map(([name, count], idx) => `
                    <div class="rank-row">
                      <div class="rank-left">
                        <span class="rank-index">${idx + 1}</span>
                        <span>${escapeHtml(name)}</span>
                      </div>
                      <strong>${count}회</strong>
                    </div>
                  `).join('')
                : `<div class="empty-text">아직 기록 없음</div>`}
            </div>
          </div>
        </section>
      </div>

      ${state.selectedDate ? `
        <div class="modal-backdrop" id="modal-backdrop">
          <div class="modal-card">

            <div class="modal-header">
              <div>
                <div class="label">날짜 상세</div>
                <div class="modal-title">${dateLabel(state.selectedDate)}</div>
              </div>
              <button class="close-btn" id="close-modal">✕</button>
            </div>

            <div class="modal-section">
              <div class="section-title">📋 이날의 기록</div>
              <div class="record-list">
                ${selectedLogs.length
                  ? selectedLogs.map((log) => {
                      const activeDrinks = DRINKS.filter((d) => Number(log[d.key]) > 0);
                      return `
                        <div class="record-row">
                          <div class="record-left">
                            <div class="record-name">${escapeHtml(log.user_name)}</div>
                            ${log.memo ? `<div class="record-memo">"${escapeHtml(log.memo)}"</div>` : ''}
                          </div>
                          <div class="record-drinks">
                            ${activeDrinks.length
                              ? activeDrinks.map((d) => `<span class="drink-badge">${d.emoji} ×${log[d.key]}</span>`).join('')
                              : '<span class="record-meta">기록 없음</span>'}
                          </div>
                        </div>
                      `;
                    }).join('')
                  : `<div class="empty-text">아직 등록된 기록 없음</div>`}
              </div>
            </div>

            <div class="modal-divider"></div>

            <div class="modal-section">
              <div class="section-title">✏️ 내 기록</div>

              <div class="drink-grid">
                ${DRINKS.map(({ key, label, emoji }) => `
                  <button class="drink-icon-btn${state.form[key] > 0 ? ' active' : ''}" data-drink-key="${key}">
                    <span class="drink-emoji">${emoji}</span>
                    <span class="drink-label">${label}</span>
                    <span class="drink-count">${state.form[key] > 0 ? `×${state.form[key]}` : '–'}</span>
                  </button>
                `).join('')}
              </div>

              <div class="memo-wrap">
                <div class="memo-header">
                  <span class="section-label">📝 메모</span>
                  <span class="memo-len" id="memo-len">${(state.form.memo || '').length}/20</span>
                </div>
                <input
                  id="memo-input"
                  class="memo-input"
                  type="text"
                  placeholder="오늘 술자리 한 줄 메모"
                  maxlength="20"
                  value="${escapeHtml(state.form.memo)}"
                />
              </div>

              ${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ''}

              <div class="modal-actions">
                ${mySelected
                  ? `<button class="delete-btn" id="delete-entry">내 기록 삭제</button>`
                  : '<span></span>'}
                <button class="primary" id="save-entry" ${state.loading ? 'disabled' : ''}>
                  ${state.loading ? '저장 중...' : mySelected ? '내 기록 수정' : '내 기록 저장'}
                </button>
              </div>
            </div>

          </div>
        </div>
      ` : ''}
    `;

    bindEvents();
  }

  function bindEvents() {
    const nameInput = document.getElementById('name-input');
    const saveNameBtn = document.getElementById('save-name');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => { state.draftName = e.target.value; });
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const clean = state.draftName.trim();
          if (!clean) return;
          localStorage.setItem(NAME_KEY, clean);
          state.name = clean;
          render();
        }
      });
      setTimeout(() => nameInput.focus(), 0);
    }
    if (saveNameBtn) {
      saveNameBtn.addEventListener('click', () => {
        const clean = state.draftName.trim();
        if (!clean) return;
        localStorage.setItem(NAME_KEY, clean);
        state.name = clean;
        render();
      });
    }

    const memoInput = document.getElementById('memo-input');
    if (memoInput) {
      memoInput.addEventListener('input', (e) => {
        state.form.memo = e.target.value.slice(0, 20);
        const lenEl = document.getElementById('memo-len');
        if (lenEl) lenEl.textContent = `${state.form.memo.length}/20`;
      });
    }

    document.querySelectorAll('[data-action="prev-month"]').forEach((el) =>
      el.addEventListener('click', async () => {
        state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
        await fetchMonth(); render();
      })
    );
    document.querySelectorAll('[data-action="next-month"]').forEach((el) =>
      el.addEventListener('click', async () => {
        state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
        await fetchMonth(); render();
      })
    );
    document.querySelectorAll('[data-action="today"]').forEach((el) =>
      el.addEventListener('click', async () => {
        state.month = new Date(); await fetchMonth(); render();
      })
    );

    document.querySelectorAll('[data-date]').forEach((el) =>
      el.addEventListener('click', (e) => {
        state.selectedDate = e.currentTarget.dataset.date;
        syncFormWithSelected();
        render();
      })
    );

    document.querySelectorAll('[data-drink-key]').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = e.currentTarget.dataset.drinkKey;
        state.form[key] = (state.form[key] + 1) % 6;
        render();
      })
    );

    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target.id === 'modal-backdrop' && !state.loading) {
          state.selectedDate = null;
          render();
        }
      });
    }

    const closeModal = document.getElementById('close-modal');
    if (closeModal) closeModal.addEventListener('click', () => { state.selectedDate = null; render(); });

    const saveEntryBtn = document.getElementById('save-entry');
    if (saveEntryBtn) saveEntryBtn.addEventListener('click', saveEntry);
    const deleteEntryBtn = document.getElementById('delete-entry');
    if (deleteEntryBtn) deleteEntryBtn.addEventListener('click', deleteEntry);
  }

  (async () => {
    await fetchMonth();
    render();
  })();
})();
