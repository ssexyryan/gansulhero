(() => {
  const app = document.getElementById('app');
  const NAME_KEY = 'gansulhero_name';
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const TYPES = ['간술', '공적간술', '찾간'];
  const COUNTS = [0, 1, 2, 3, 4, 5];

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
    form: { soju: 0, beer: 0, wine: 0, whiskey: 0, session_type: '간술', memo: '' },
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

  const weekRangeLabel = (start, end) => `${start.getMonth() + 1}/${start.getDate()}–${end.getMonth() + 1}/${end.getDate()}`;
  const totalBottles = (log) => (Number(log.soju) || 0) + (Number(log.beer) || 0) + (Number(log.wine) || 0) + (Number(log.whiskey) || 0);

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
    return { soju: 0, beer: 0, wine: 0, whiskey: 0, session_type: '간술', memo: '' };
  }

  function syncFormWithSelected() {
    if (!state.selectedDate || !state.name) return;
    const mine = state.logs.find((log) => log.drink_date === state.selectedDate && log.user_name === state.name);
    state.form = mine ? {
      soju: Number(mine.soju) || 0,
      beer: Number(mine.beer) || 0,
      wine: Number(mine.wine) || 0,
      whiskey: Number(mine.whiskey) || 0,
      session_type: mine.session_type || '간술',
      memo: mine.memo || ''
    } : emptyForm();
    state.error = '';
  }

  async function fetchMonth() {
    const from = ymd(new Date(state.month.getFullYear(), state.month.getMonth(), 1));
    const to = ymd(new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0));
    const { data, error } = await supabase
      .from('drink_logs')
      .select('id, drink_date, user_name, soju, beer, wine, whiskey, session_type, memo, created_at')
      .gte('drink_date', from)
      .lte('drink_date', to)
      .order('drink_date', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      state.error = '기록을 불러오지 못했음';
      return;
    }
    state.logs = data || [];
  }

  function getFriendlyError(error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('memo')) return 'DB에 memo 컬럼이 아직 없어 저장이 안 됨. migration.sql 먼저 실행해줘.';
    if (message.includes('row-level security') || message.includes('permission')) return 'Supabase 정책 때문에 저장이 막혔음. schema.sql 또는 migration.sql을 다시 실행해줘.';
    if (message.includes('duplicate')) return '같은 날짜의 기존 기록을 불러오지 못해 중복 저장이 막혔음. 새로고침 후 다시 시도해줘.';
    return error?.message || '저장 중 오류가 발생했음';
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
      wine: state.form.wine,
      whiskey: state.form.whiskey,
      session_type: state.form.session_type,
      memo: state.form.memo.trim() || null
    };

    const existing = state.logs.find((log) => log.drink_date === state.selectedDate && log.user_name === state.name);

    let error = null;
    if (existing?.id) {
      ({ error } = await supabase.from('drink_logs').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('drink_logs').insert(payload));
    }

    state.loading = false;
    if (error) {
      state.error = getFriendlyError(error);
      render();
      return;
    }

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
    if (error) {
      state.error = '삭제 중 오류가 발생했음';
      render();
      return;
    }

    await fetchMonth();
    state.selectedDate = null;
    render();
  }

  function render() {
    const dayMap = getDayMap();
    const grid = gridForMonth(state.month);
    const weeklyHero = getWeeklyHero();
    const ranking = getMonthlyRanking();
    const selectedLogs = state.selectedDate ? state.logs.filter((log) => log.drink_date === state.selectedDate) : [];
    const mySelected = state.selectedDate && state.name ? state.logs.find((log) => log.drink_date === state.selectedDate && log.user_name === state.name) : null;

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
            ${['0', '1+', '2+', '4+', '6+'].map((label, idx) => `<div class="legend-item"><span class="legend-swatch" style="${heatStyle(idx)}"></span><span>${label}</span></div>`).join('')}
          </div>

          <div class="week-row">${DAYS.map((d) => `<div>${d}</div>`).join('')}</div>
          <div class="grid">
            ${grid.map((date, index) => {
              if (!date) return `<div class="empty" key="e-${index}"></div>`;
              const key = ymd(date);
              const logs = dayMap.get(key) || [];
              const today = key === ymd(new Date()) ? 'today' : '';
              return `
                <button class="day ${today}" data-date="${key}" style="${heatStyle(heatLevel(logs.length))}">
                  <div class="day-head">
                    <span class="day-number">${date.getDate()}</span>
                    ${logs.length ? `<span class="day-count">${logs.length}</span>` : ''}
                  </div>
                  <div class="day-names">
                    ${logs.slice(0, 4).map((log) => `<span class="pill">${escapeHtml(log.user_name)}</span>`).join('')}
                    ${logs.length > 4 ? `<span class="more">+${logs.length - 4}</span>` : ''}
                  </div>
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
              ${ranking.length ? ranking.map(([name, count], idx) => `
                <div class="rank-row">
                  <div class="rank-left"><span class="rank-index">${idx + 1}</span><span>${escapeHtml(name)}</span></div>
                  <strong>${count}회</strong>
                </div>
              `).join('') : `<div class="empty-text">아직 기록 없음</div>`}
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
                <div class="modal-title">${state.selectedDate}</div>
              </div>
              <button class="close-btn" id="close-modal">닫기</button>
            </div>

            <div class="section">
              <div class="section-title">음주량</div>
              ${[['소주','soju'],['맥주','beer'],['와인','wine'],['위스키','whiskey']].map(([label, key]) => `
                <div class="select-row">
                  <div class="select-label">${label}</div>
                  <div class="options">
                    ${COUNTS.map((count) => `<button class="count ${state.form[key] === count ? 'active' : ''}" data-count-key="${key}" data-count-value="${count}">${count}</button>`).join('')}
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="section">
              <div class="section-title">유형</div>
              <div class="options">
                ${TYPES.map((type) => `<button class="type-btn ${state.form.session_type === type ? 'active' : ''}" data-type="${type}">${type}</button>`).join('')}
              </div>
            </div>

            <div class="section">
              <div class="section-title">이날의 기록 메모</div>
              <textarea id="memo-input" class="memo-input" placeholder="짧게 메모 남기기">${escapeHtml(state.form.memo)}</textarea>
            </div>

            <div class="section">
              <div class="section-title">이 날의 기록</div>
              <div class="record-list">
                ${selectedLogs.length ? selectedLogs.map((log) => `
                  <div class="record-row">
                    <div>
                      <div class="record-name">${escapeHtml(log.user_name)}</div>
                      <div class="record-meta">${escapeHtml(log.session_type)} · 총 ${totalBottles(log)}병</div>
                      ${log.memo ? `<div class="record-memo">${escapeHtml(log.memo)}</div>` : ''}
                    </div>
                    <div class="record-breakdown">소주 ${log.soju} · 맥주 ${log.beer} · 와인 ${log.wine} · 위스키 ${log.whiskey}</div>
                  </div>
                `).join('') : `<div class="empty-text">아직 등록된 기록 없음</div>`}
              </div>
            </div>

            ${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ''}

            <div class="modal-actions">
              ${mySelected ? `<button class="delete-btn" id="delete-entry">내 기록 삭제</button>` : '<span></span>'}
              <button class="primary" id="save-entry">${state.loading ? '저장 중...' : mySelected ? '내 기록 수정' : '내 기록 저장'}</button>
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
        state.form.memo = e.target.value;
      });
    }

    document.querySelectorAll('[data-action="prev-month"]').forEach((el) => el.addEventListener('click', async () => {
      state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
      await fetchMonth();
      render();
    }));
    document.querySelectorAll('[data-action="next-month"]').forEach((el) => el.addEventListener('click', async () => {
      state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
      await fetchMonth();
      render();
    }));
    document.querySelectorAll('[data-action="today"]').forEach((el) => el.addEventListener('click', async () => {
      state.month = new Date();
      await fetchMonth();
      render();
    }));

    document.querySelectorAll('[data-date]').forEach((el) => el.addEventListener('click', (e) => {
      state.selectedDate = e.currentTarget.dataset.date;
      syncFormWithSelected();
      render();
    }));

    document.querySelectorAll('[data-count-key]').forEach((el) => el.addEventListener('click', (e) => {
      const key = e.currentTarget.dataset.countKey;
      const value = Number(e.currentTarget.dataset.countValue);
      state.form[key] = value;
      render();
    }));

    document.querySelectorAll('[data-type]').forEach((el) => el.addEventListener('click', (e) => {
      state.form.session_type = e.currentTarget.dataset.type;
      render();
    }));

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
