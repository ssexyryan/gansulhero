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

  const CATEGORY_EMOJI = { FD6: '🍽', CE7: '☕', AT4: '🏛', SW8: '🏦', BK9: '🏦', PO3: '📮', AD5: '🏨', SC4: '🏫', PK6: '🅿️', OL7: '⛽' };

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
    app.innerHTML = '<div class="center-message"><div class="error-panel">Supabase 설정값이 없어 실행할 수 없음</div></div>';
    return;
  }

  const supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  let placeDebounce = null;

  const state = {
    name: localStorage.getItem(NAME_KEY) || '',
    draftName: '',
    month: new Date(),
    logs: [],
    selectedDate: null,
    viewDate: null,
    form: emptyForm(),
    placeQuery: '',
    placeSuggestions: [],
    placeLoading: false,
    loading: false,
    error: '',
  };

  function emptyForm() {
    return {
      soju: 0, beer: 0, distilled: 0, wine: 0, whiskey: 0,
      selectedDrinks: [],
      drinkMax: { soju: 4, beer: 4, distilled: 4, wine: 4, whiskey: 4 },
      place: '', placeId: '', placeUrl: '', placeImage: '', placeCat: '',
      memo: '',
    };
  }

  /* utils */
  const ymd = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  };
  const monthLabel = (date) => date.getFullYear() + '년 ' + (date.getMonth() + 1) + '월';
  const dateLabel = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const holiday = HOLIDAYS[dateStr];
    const base = d.getFullYear() + '년 ' + (d.getMonth()+1) + '월 ' + d.getDate() + '일 (' + DAYS[d.getDay()] + ')';
    return holiday ? base + ' · ' + holiday + ' 🎌' : base;
  };
  const gridForMonth = (date) => {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= last; d++) cells.push(new Date(date.getFullYear(), date.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };
  const startOfWeek = (date) => { const d = new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); return d; };
  const endOfWeek = (date) => { const d = startOfWeek(date); d.setDate(d.getDate()+6); return d; };
  const weekRangeLabel = (s, e) => (s.getMonth()+1) + '/' + s.getDate() + '–' + (e.getMonth()+1) + '/' + e.getDate();
  const totalBottles = (log) => DRINKS.reduce((sum, d) => sum + (Number(log[d.key]) || 0), 0);
  const heatLevel = (n) => n >= 6 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0;
  const heatStyle = (level) => [
    'background:rgba(255,255,255,0.85);border-color:rgba(251,191,36,0.12);',
    'background:rgba(254,240,138,0.75);border-color:rgba(245,158,11,0.30);',
    'background:rgba(253,186,116,0.76);border-color:rgba(249,115,22,0.32);',
    'background:rgba(251,146,60,0.82);border-color:rgba(234,88,12,0.40);',
    'background:rgba(249,115,22,0.92);border-color:rgba(194,65,12,0.52);color:#fff7ed;',
  ][level];
  const esc = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

  /* data */
  function getDayMap() {
    const map = new Map();
    state.logs.forEach((log) => { const arr = map.get(log.drink_date) || []; arr.push(log); map.set(log.drink_date, arr); });
    return map;
  }
  function getTopMemo(logs) {
    if (!logs || !logs.length) return null;
    const w = logs.filter(l => l.memo);
    if (!w.length) return null;
    return [...w].sort((a, b) => totalBottles(b) - totalBottles(a))[0].memo;
  }
  function getWeeklyHero() {
    const start = startOfWeek(new Date()), end = endOfWeek(new Date());
    const counts = new Map();
    state.logs.forEach((log) => { const d = new Date(log.drink_date + 'T00:00:00'); if (d >= start && d <= end) counts.set(log.user_name, (counts.get(log.user_name) || 0) + 1); });
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return { period: weekRangeLabel(start, end), top: sorted[0] || null };
  }
  function getMonthlyRanking() {
    const counts = new Map();
    state.logs.forEach((log) => counts.set(log.user_name, (counts.get(log.user_name) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }

  /* form sync */
  function syncFormWithSelected() {
    if (!state.selectedDate || !state.name) return;
    const mine = state.logs.find(l => l.drink_date === state.selectedDate && l.user_name === state.name);
    if (mine) {
      const selectedDrinks = DRINKS.filter(d => Number(mine[d.key]) > 0).map(d => d.key);
      const drinkMax = { soju: 4, beer: 4, distilled: 4, wine: 4, whiskey: 4 };
      DRINKS.forEach(d => { if (Number(mine[d.key]) > drinkMax[d.key]) drinkMax[d.key] = Number(mine[d.key]); });
      state.form = {
        soju: Number(mine.soju)||0, beer: Number(mine.beer)||0,
        distilled: Number(mine.distilled)||0, wine: Number(mine.wine)||0, whiskey: Number(mine.whiskey)||0,
        selectedDrinks, drinkMax,
        place: mine.place_name||'', placeId: mine.place_id||'',
        placeUrl: mine.place_url||'', placeImage: mine.place_image||'', placeCat: '',
        memo: mine.memo||'',
      };
      state.placeQuery = state.form.place;
    } else {
      state.form = emptyForm();
      state.placeQuery = '';
    }
    state.placeSuggestions = [];
    state.error = '';
  }

  /* API */
  async function fetchMonth() {
    const from = ymd(new Date(state.month.getFullYear(), state.month.getMonth(), 1));
    const to = ymd(new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0));
    const { data, error } = await supabase
      .from('drink_logs')
      .select('id,drink_date,user_name,soju,beer,distilled,wine,whiskey,place_name,place_id,place_url,place_image,memo,created_at')
      .gte('drink_date', from).lte('drink_date', to)
      .order('drink_date', { ascending: true }).order('created_at', { ascending: false });
    if (error) { state.error = '기록을 불러오지 못했음'; return; }
    state.logs = data || [];
  }

  async function saveEntry() {
    if (!state.name || !state.selectedDate || state.loading) return;
    state.loading = true; state.error = ''; render();
    const payload = {
      drink_date: state.selectedDate, user_name: state.name,
      soju: state.form.soju, beer: state.form.beer, distilled: state.form.distilled,
      wine: state.form.wine, whiskey: state.form.whiskey,
      place_name: state.form.place.trim() || null,
      place_id: state.form.placeId || null,
      place_url: state.form.placeUrl || null,
      place_image: state.form.placeImage || null,
      memo: state.form.memo.trim().slice(0,40) || null,
    };
    const existing = state.logs.find(l => l.drink_date === state.selectedDate && l.user_name === state.name);
    let error = null;
    if (existing?.id) ({ error } = await supabase.from('drink_logs').update(payload).eq('id', existing.id));
    else ({ error } = await supabase.from('drink_logs').insert(payload));
    state.loading = false;
    if (error) { state.error = getFriendlyError(error); render(); return; }
    await fetchMonth(); state.selectedDate = null; render();
  }

  async function deleteEntry() {
    if (!state.name || !state.selectedDate || state.loading) return;
    state.loading = true; state.error = ''; render();
    const { error } = await supabase.from('drink_logs').delete().eq('drink_date', state.selectedDate).eq('user_name', state.name);
    state.loading = false;
    if (error) { state.error = '삭제 중 오류 발생'; render(); return; }
    await fetchMonth(); state.selectedDate = null; render();
  }

  function getFriendlyError(err) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('place_name')) return 'DB에 place 컬럼 없음 — migration.sql 실행 필요';
    if (msg.includes('distilled')) return 'DB에 distilled 컬럼 없음 — migration.sql 실행 필요';
    if (msg.includes('row-level security') || msg.includes('permission')) return 'Supabase 정책 오류 — schema.sql 재실행 필요';
    if (msg.includes('duplicate')) return '중복 오류 — 새로고침 후 다시 시도';
    return err?.message || '저장 중 오류 발생';
  }

  async function searchPlaces(query) {
    if (!query || query.length < 2) { state.placeSuggestions = []; render(); return; }
    state.placeLoading = true; render();
    try {
      const res = await fetch('/api/kakao-places?q=' + encodeURIComponent(query));
      const data = await res.json();
      state.placeSuggestions = data.documents || [];
    } catch { state.placeSuggestions = []; }
    state.placeLoading = false; render();
  }

  function selectPlace(place) {
    state.form.place = place.place_name;
    state.form.placeId = place.id;
    state.form.placeUrl = place.place_url;
    const jsKey = cfg.kakaoJsKey;
    state.form.placeImage = (place.x && place.y && jsKey)
      ? 'https://smap.kakao.com/staticmap/v2.png?appkey=' + jsKey + '&width=320&height=180&center=' + place.x + ',' + place.y + '&markers=TYPE_A,RED,' + place.x + ',' + place.y + '&level=3'
      : '';
    state.form.placeCat = place.category_group_code || '';
    state.placeQuery = place.place_name;
    state.placeSuggestions = [];
    render();
  }

  /* render */
  function render() {
    const dayMap = getDayMap();
    const grid = gridForMonth(state.month);
    const weeklyHero = getWeeklyHero();
    const ranking = getMonthlyRanking();
    const viewLogs = state.viewDate ? state.logs.filter(l => l.drink_date === state.viewDate) : [];
    const mySelected = state.selectedDate && state.name
      ? state.logs.find(l => l.drink_date === state.selectedDate && l.user_name === state.name)
      : null;

    app.innerHTML =
      (!state.name ? renderNameOverlay() : '') +
      renderShell(dayMap, grid, weeklyHero, ranking) +
      (state.viewDate ? renderViewModal(viewLogs) : '') +
      (state.selectedDate ? renderInputModal(mySelected) : '');

    bindEvents();
  }

  function renderNameOverlay() {
    return '<div class="overlay"><div class="name-card">' +
      '<div class="name-top"><span class="badge">🍺 간술히어로</span><span class="hint">처음 한 번만 저장</span></div>' +
      '<h1 class="name-title">이름을 등록해줘</h1>' +
      '<div class="name-desc">저장하면 같은 디바이스에서는 다음부터 바로 입장함</div>' +
      '<input class="name-input" id="name-input" value="' + esc(state.draftName) + '" placeholder="이름 입력" />' +
      '<button class="primary" id="save-name">입장하기</button>' +
      '</div></div>';
  }

  function renderShell(dayMap, grid, weeklyHero, ranking) {
    return '<div class="shell">' +
      '<div class="header"><div class="brand-wrap"><div class="brand-icon">🍺</div>' +
      '<div><div class="brand">간술히어로</div><div class="sub">오늘의 간술 기록을 한눈에</div></div></div>' +
      '<div class="me-chip">내 이름 · ' + esc(state.name || '-') + '</div></div>' +
      renderCalendar(dayMap, grid) +
      renderStats(weeklyHero, ranking) +
      '</div>';
  }

  function renderCalendar(dayMap, grid) {
    const todayStr = ymd(new Date());
    return '<section class="calendar-panel panel">' +
      '<div class="panel-top"><div><div class="label">공유 캘린더</div><div class="title">' + monthLabel(state.month) + '</div></div>' +
      '<div class="actions"><button class="ghost" data-action="prev-month">이전</button><button class="ghost" data-action="today">오늘</button><button class="ghost" data-action="next-month">다음</button></div></div>' +
      '<div class="legend">' + ['0','1+','2+','4+','6+'].map((l,i) => '<div class="legend-item"><span class="legend-swatch" style="' + heatStyle(i) + '"></span><span>' + l + '</span></div>').join('') + '</div>' +
      '<div class="week-row">' + DAYS.map(d => '<div>' + d + '</div>').join('') + '</div>' +
      '<div class="grid">' + grid.map((date, idx) => {
        if (!date) return '<div class="empty" key="e-' + idx + '"></div>';
        const key = ymd(date);
        const logs = dayMap.get(key) || [];
        const isToday = key === todayStr;
        const holiday = HOLIDAYS[key];
        const topMemo = getTopMemo(logs);
        return '<button class="day' + (isToday ? ' today' : '') + (holiday ? ' holiday' : '') + '" data-date="' + key + '" style="' + heatStyle(heatLevel(logs.length)) + '">' +
          '<div class="day-head"><span class="day-number">' + date.getDate() + '</span>' +
          (logs.length ? '<span class="day-count" data-view-date="' + key + '">' + logs.length + '</span>' : '') + '</div>' +
          (holiday ? '<div class="day-holiday hide-sm">' + esc(holiday) + '</div>' : '') +
          '<div class="day-names hide-sm">' + logs.slice(0,3).map(l => '<span class="pill">' + esc(l.user_name) + '</span>').join('') + (logs.length > 3 ? '<span class="more">+' + (logs.length-3) + '</span>' : '') + '</div>' +
          (topMemo ? '<div class="cell-memo hide-sm">' + esc(topMemo) + '</div>' : '') +
          '</button>';
      }).join('') + '</div></section>';
  }

  function renderStats(weeklyHero, ranking) {
    return '<section class="stats">' +
      '<div class="hero-banner"><div class="label">이번 주 배너</div><div class="card-title">🍺 이번 주 최다 음주자</div>' +
      '<div class="hero-period">' + weeklyHero.period + '</div>' +
      '<div class="hero-value">' + (weeklyHero.top ? esc(weeklyHero.top[0]) + ' · ' + weeklyHero.top[1] + '회' : '이번 주 기록 없음') + '</div></div>' +
      '<div class="rank-panel"><div class="label">간술히어로</div><div class="card-title">이번 달 간술히어로</div>' +
      '<div class="rank-list">' + (ranking.length ? ranking.map(([name, count], i) =>
        '<div class="rank-row"><div class="rank-left"><span class="rank-index">' + (i+1) + '</span><span>' + esc(name) + '</span></div><strong>' + count + '회</strong></div>'
      ).join('') : '<div class="empty-text">아직 기록 없음</div>') + '</div></div>' +
      '</section>';
  }

  function renderViewModal(logs) {
    const cards = logs.length ? logs.map(log => {
      const drinks = DRINKS.filter(d => Number(log[d.key]) > 0);
      const catEmoji = CATEGORY_EMOJI[log.place_cat] || '📍';
      return '<div class="view-card">' +
        (log.place_image ? '<img class="view-place-img" src="' + esc(log.place_image) + '" onerror="this.style.display=\'none\'" />' : '') +
        '<div class="view-card-header"><span class="view-name">' + esc(log.user_name) + '</span><span class="view-total">총 ' + totalBottles(log) + '병</span></div>' +
        (log.place_name ? '<div class="view-place">' + catEmoji + ' ' + esc(log.place_name) + '</div>' : '') +
        (drinks.length ? '<div class="view-drinks">' + drinks.map(d => '<span class="drink-badge">' + d.emoji + ' ×' + log[d.key] + '</span>').join('') + '</div>' : '') +
        (log.memo ? '<div class="view-memo">"' + esc(log.memo) + '"</div>' : '') +
        '</div>';
    }).join('') : '<div class="empty-text" style="padding:20px 0">아직 기록이 없음</div>';

    return '<div class="modal-backdrop" id="view-backdrop"><div class="modal-card">' +
      '<div class="modal-header"><div><div class="label">이날의 기록</div><div class="modal-title">' + dateLabel(state.viewDate) + '</div></div>' +
      '<button class="close-btn" id="close-view">✕</button></div>' +
      '<div class="view-list">' + cards + '</div>' +
      (state.name ? '<div class="modal-actions"><span></span><button class="primary" id="edit-from-view">✏️ 내 기록 수정</button></div>' : '') +
      '</div></div>';
  }

  function renderInputModal(mySelected) {
    const { form } = state;
    const selectedSet = new Set(form.selectedDrinks);

    const placeSection = '<div class="modal-section">' +
      '<div class="section-title">📍 간술 플레이스</div>' +
      '<div class="place-search-wrap">' +
      '<input id="place-input" class="place-input" placeholder="음식점 검색..." value="' + esc(state.placeQuery) + '" autocomplete="off" />' +
      (state.placeLoading ? '<div class="place-spin">검색 중...</div>' : '') +
      (state.placeSuggestions.length ? '<div class="place-dropdown">' +
        state.placeSuggestions.map((p, i) =>
          '<button class="place-option" data-place-idx="' + i + '">' +
          '<span class="place-opt-icon">' + (CATEGORY_EMOJI[p.category_group_code] || '🍽') + '</span>' +
          '<div class="place-opt-info"><div class="place-opt-name">' + esc(p.place_name) + '</div>' +
          '<div class="place-opt-addr">' + esc(p.road_address_name || p.address_name) + '</div></div>' +
          '</button>'
        ).join('') + '</div>' : '') +
      '</div>' +
      (form.place ? '<div class="place-selected">' +
        (form.placeImage ? '<img class="place-thumb" src="' + esc(form.placeImage) + '" onerror="this.style.display=\'none\'" />' : '<span class="place-thumb-icon">' + (CATEGORY_EMOJI[form.placeCat] || '🍽') + '</span>') +
        '<div class="place-selected-info"><div class="place-selected-name">' + esc(form.place) + '</div>' +
        (form.placeUrl ? '<a class="place-link" href="' + esc(form.placeUrl) + '" target="_blank" rel="noopener">지도 보기 →</a>' : '') +
        '</div><button class="place-clear-btn" id="place-clear">✕</button></div>' : '') +
      '</div>';

    const drinkSection = '<div class="modal-section">' +
      '<div class="section-title">🥃 주종 선택</div>' +
      '<div class="drink-toggle-row">' +
      DRINKS.map(d => '<button class="drink-toggle' + (selectedSet.has(d.key) ? ' active' : '') + '" data-drink-toggle="' + d.key + '">' + d.emoji + ' ' + d.label + '</button>').join('') +
      '</div>' +
      (form.selectedDrinks.length ? '<div class="gauge-list">' +
        form.selectedDrinks.map(key => {
          const d = DRINKS.find(x => x.key === key);
          const val = form[key] || 0;
          const max = form.drinkMax[key] || 4;
          const pct = max > 0 ? Math.round((val / max) * 100) : 0;
          const trackBg = 'linear-gradient(to right,#fbbf24 0%,#f97316 ' + pct + '%,rgba(217,119,6,0.12) ' + pct + '%,rgba(217,119,6,0.12) 100%)';
          return '<div class="gauge-row">' +
            '<div class="gauge-info"><span class="gauge-emoji">' + d.emoji + '</span><span class="gauge-label">' + d.label + '</span></div>' +
            '<input type="range" class="gauge-slider" min="0" max="' + max + '" step="0.5" value="' + val + '" data-gauge-key="' + key + '" style="background:' + trackBg + '">' +
            '<span class="gauge-val">' + val + '</span>' +
            '<button class="gauge-plus" data-gauge-plus="' + key + '">+</button>' +
            '</div>';
        }).join('') + '</div>' : '<div class="gauge-hint">주종을 선택하면 입력 게이지가 나타남</div>') +
      '</div>';

    const memoSection = '<div class="modal-section">' +
      '<div class="memo-header"><span class="section-title">💬 간술메모</span><span class="memo-len" id="memo-len">' + (form.memo||'').length + '/40</span></div>' +
      '<input id="memo-input" class="memo-input" type="text" maxlength="40" placeholder="간술을 하며 깨우친 인생의 진리" value="' + esc(form.memo) + '" />' +
      '</div>';

    return '<div class="modal-backdrop" id="input-backdrop"><div class="modal-card">' +
      '<div class="modal-header"><div><div class="label">내 기록</div><div class="modal-title">' + dateLabel(state.selectedDate) + '</div></div>' +
      '<button class="close-btn" id="close-input">✕</button></div>' +
      placeSection + drinkSection + memoSection +
      (state.error ? '<div class="error">' + esc(state.error) + '</div>' : '') +
      '<div class="modal-actions">' +
      (mySelected ? '<button class="delete-btn" id="delete-entry">내 기록 삭제</button>' : '<span></span>') +
      '<button class="primary" id="save-entry"' + (state.loading ? ' disabled' : '') + '>' + (state.loading ? '저장 중...' : mySelected ? '내 기록 수정' : '내 기록 저장') + '</button>' +
      '</div></div></div>';
  }

  /* events */
  function bindEvents() {
    const nameInput = document.getElementById('name-input');
    if (nameInput) {
      nameInput.addEventListener('input', e => { state.draftName = e.target.value; });
      nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); });
      setTimeout(() => nameInput.focus(), 0);
    }
    document.getElementById('save-name')?.addEventListener('click', saveName);
    function saveName() {
      const clean = state.draftName.trim();
      if (!clean) return;
      localStorage.setItem(NAME_KEY, clean);
      state.name = clean;
      render();
    }

    document.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', async () => {
        const a = el.dataset.action;
        if (a === 'prev-month') state.month = new Date(state.month.getFullYear(), state.month.getMonth()-1, 1);
        else if (a === 'next-month') state.month = new Date(state.month.getFullYear(), state.month.getMonth()+1, 1);
        else if (a === 'today') state.month = new Date();
        await fetchMonth(); render();
      });
    });

    document.querySelectorAll('[data-date]').forEach(el => {
      el.addEventListener('click', e => {
        const dateKey = e.currentTarget.dataset.date;
        const hasLogs = state.logs.some(l => l.drink_date === dateKey);
        if (hasLogs) {
          state.viewDate = dateKey;
          state.selectedDate = null;
        } else {
          state.selectedDate = dateKey;
          state.viewDate = null;
          syncFormWithSelected();
        }
        render();
      });
    });

    document.querySelectorAll('[data-view-date]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        state.viewDate = e.currentTarget.dataset.viewDate;
        state.selectedDate = null;
        render();
      });
    });

    document.getElementById('close-view')?.addEventListener('click', () => { state.viewDate = null; render(); });
    document.getElementById('edit-from-view')?.addEventListener('click', () => {
      state.selectedDate = state.viewDate;
      state.viewDate = null;
      syncFormWithSelected();
      render();
    });
    document.getElementById('close-input')?.addEventListener('click', () => { state.selectedDate = null; render(); });
    document.getElementById('view-backdrop')?.addEventListener('click', e => { if (e.target.id === 'view-backdrop') { state.viewDate = null; render(); } });
    document.getElementById('input-backdrop')?.addEventListener('click', e => { if (e.target.id === 'input-backdrop' && !state.loading) { state.selectedDate = null; render(); } });

    document.querySelectorAll('[data-drink-toggle]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const key = e.currentTarget.dataset.drinkToggle;
        const idx = state.form.selectedDrinks.indexOf(key);
        if (idx >= 0) { state.form.selectedDrinks.splice(idx, 1); state.form[key] = 0; }
        else state.form.selectedDrinks.push(key);
        render();
      });
    });

    document.querySelectorAll('.gauge-slider').forEach(el => {
      el.addEventListener('input', e => {
        e.stopPropagation();
        const key = e.currentTarget.dataset.gaugeKey;
        const val = parseFloat(e.currentTarget.value);
        const max = state.form.drinkMax[key] || 4;
        state.form[key] = val;
        const row = e.currentTarget.closest('.gauge-row');
        if (row) { const vEl = row.querySelector('.gauge-val'); if (vEl) vEl.textContent = val; }
        const pct = max > 0 ? Math.round((val / max) * 100) : 0;
        e.currentTarget.style.background = 'linear-gradient(to right,#fbbf24 0%,#f97316 ' + pct + '%,rgba(217,119,6,0.12) ' + pct + '%,rgba(217,119,6,0.12) 100%)';
      });
    });

    document.querySelectorAll('[data-gauge-plus]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const key = e.currentTarget.dataset.gaugePlus;
        state.form.drinkMax[key] = (state.form.drinkMax[key] || 4) + 0.5;
        render();
      });
    });

    const placeInput = document.getElementById('place-input');
    if (placeInput) {
      placeInput.addEventListener('input', e => {
        state.placeQuery = e.target.value;
        clearTimeout(placeDebounce);
        placeDebounce = setTimeout(() => searchPlaces(state.placeQuery), 400);
      });
      placeInput.addEventListener('keydown', e => { if (e.key === 'Escape') { state.placeSuggestions = []; render(); } });
    }

    document.querySelectorAll('[data-place-idx]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        selectPlace(state.placeSuggestions[Number(e.currentTarget.dataset.placeIdx)]);
      });
    });

    document.getElementById('place-clear')?.addEventListener('click', e => {
      e.stopPropagation();
      state.form.place = ''; state.form.placeId = ''; state.form.placeUrl = '';
      state.form.placeImage = ''; state.form.placeCat = '';
      state.placeQuery = ''; state.placeSuggestions = [];
      render();
    });

    const memoInput = document.getElementById('memo-input');
    if (memoInput) {
      memoInput.addEventListener('input', e => {
        state.form.memo = e.target.value.slice(0, 40);
        const el = document.getElementById('memo-len');
        if (el) el.textContent = state.form.memo.length + '/40';
      });
    }

    document.getElementById('save-entry')?.addEventListener('click', saveEntry);
    document.getElementById('delete-entry')?.addEventListener('click', deleteEntry);
  }

  (async () => { await fetchMonth(); render(); })();
})();
