const STORAGE_KEY = 'uber-driver-dashboard-v2';

const state = {
  sessions: [],
  activeSession: null,
  editingSessionId: null,
  filters: getDefaultFilters(),
  now: Date.now(),
};

const els = {
  startArea: document.getElementById('start-area'),
  finishPanel: document.getElementById('finish-panel'),
  editPanel: document.getElementById('edit-panel'),
  summaryCards: document.getElementById('summary-cards'),
  barsArea: document.getElementById('bars-area'),
  historyList: document.getElementById('history-list'),
  latestPanel: document.getElementById('latest-panel'),
  filterMode: document.getElementById('filterMode'),
  rangeStart: document.getElementById('rangeStart'),
  rangeEnd: document.getElementById('rangeEnd'),
  endKm: document.getElementById('endKm'),
  grossEarnings: document.getElementById('grossEarnings'),
  fuelCost: document.getElementById('fuelCost'),
  rides: document.getElementById('rides'),
  notes: document.getElementById('notes'),
  saveDayBtn: document.getElementById('save-day-btn'),
  cancelFinishBtn: document.getElementById('cancel-finish-btn'),
  editDate: document.getElementById('editDate'),
  editStartTime: document.getElementById('editStartTime'),
  editEndTime: document.getElementById('editEndTime'),
  editStartKm: document.getElementById('editStartKm'),
  editEndKm: document.getElementById('editEndKm'),
  editGrossEarnings: document.getElementById('editGrossEarnings'),
  editFuelCost: document.getElementById('editFuelCost'),
  editRides: document.getElementById('editRides'),
  editDriveHours: document.getElementById('editDriveHours'),
  editDriveMinutes: document.getElementById('editDriveMinutes'),
  editNotes: document.getElementById('editNotes'),
  updateDayBtn: document.getElementById('update-day-btn'),
  cancelEditBtn: document.getElementById('cancel-edit-btn'),
};

loadState();
attachEvents();
render();
setInterval(() => {
  state.now = Date.now();
  if (state.activeSession) renderStartArea();
}, 1000);

function attachEvents() {
  els.filterMode.addEventListener('change', (e) => {
    state.filters.mode = e.target.value;
    toggleRangeInputs();
    render();
  });
  els.rangeStart.addEventListener('change', (e) => {
    state.filters.rangeStart = e.target.value;
    render();
  });
  els.rangeEnd.addEventListener('change', (e) => {
    state.filters.rangeEnd = e.target.value;
    render();
  });
  els.saveDayBtn.addEventListener('click', saveDay);
  els.cancelFinishBtn.addEventListener('click', closeFinishPanel);
  els.updateDayBtn.addEventListener('click', updateSession);
  els.cancelEditBtn.addEventListener('click', closeEditPanel);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('uber-driver-dashboard-v1');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    state.activeSession = parsed.activeSession || null;
  } catch {
    // ignore
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    sessions: state.sessions,
    activeSession: state.activeSession,
  }));
}

function render() {
  sortSessions();
  toggleRangeInputs();
  renderStartArea();
  renderSummary();
  renderLatestDay();
  renderHistory();
  persist();
}

function sortSessions() {
  state.sessions.sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());
}

function renderStartArea() {
  if (!state.activeSession) {
    els.startArea.innerHTML = `
      <div class="form-grid">
        <label>
          <span>Quilometragem atual do carro</span>
          <input id="startKmInput" inputmode="decimal" placeholder="Ex: 125430" />
        </label>
        <div class="inline-buttons">
          <button class="primary-button" id="startWorkBtn">INICIAR</button>
        </div>
      </div>
    `;
    document.getElementById('startWorkBtn').addEventListener('click', () => {
      const startKm = parseNumber(document.getElementById('startKmInput').value);
      if (!isFinite(startKm) || startKm < 0) {
        alert('Digite a quilometragem atual corretamente.');
        return;
      }
      state.activeSession = {
        startedAt: new Date().toISOString(),
        startKm,
        currentStatus: 'running',
        pausedAt: null,
        pauses: [],
        totalPausedMs: 0,
      };
      render();
    });
    return;
  }

  const activeDriveMs = getActiveDriveMs(state.activeSession);
  els.startArea.innerHTML = `
    <div>
      <p>Início: ${dateTimeFormat(state.activeSession.startedAt)}</p>
      <p>KM inicial: ${numberFormat(state.activeSession.startKm)}</p>
      <p>Status: <strong>${state.activeSession.currentStatus === 'running' ? 'Trabalhando' : 'Pausado'}</strong></p>
    </div>
    <div class="live-metrics">
      <div class="live-box">
        <span>Tempo ao volante</span>
        <strong>${formatDuration(activeDriveMs)}</strong>
      </div>
      <div class="inline-buttons">
        ${state.activeSession.currentStatus === 'running'
          ? '<button class="secondary-button" id="pauseBtn">Pausar</button>'
          : '<button class="secondary-button" id="resumeBtn">Continuar trabalho</button>'}
        <button class="primary-button" id="finishBtn">Finalizar o dia</button>
      </div>
    </div>
  `;

  const pauseBtn = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const finishBtn = document.getElementById('finishBtn');

  if (pauseBtn) pauseBtn.addEventListener('click', pauseWork);
  if (resumeBtn) resumeBtn.addEventListener('click', resumeWork);
  if (finishBtn) finishBtn.addEventListener('click', () => {
    closeEditPanel();
    els.finishPanel.classList.remove('hidden');
  });
}

function pauseWork() {
  if (!state.activeSession || state.activeSession.currentStatus === 'paused') return;
  state.activeSession.currentStatus = 'paused';
  state.activeSession.pausedAt = new Date().toISOString();
  render();
}

function resumeWork() {
  if (!state.activeSession || state.activeSession.currentStatus !== 'paused' || !state.activeSession.pausedAt) return;
  const pauseStart = new Date(state.activeSession.pausedAt).getTime();
  const pauseEnd = Date.now();
  state.activeSession.totalPausedMs += pauseEnd - pauseStart;
  state.activeSession.pauses.push({
    startedAt: new Date(pauseStart).toISOString(),
    endedAt: new Date(pauseEnd).toISOString(),
  });
  state.activeSession.currentStatus = 'running';
  state.activeSession.pausedAt = null;
  render();
}

function saveDay() {
  if (!state.activeSession) return;

  const endKm = parseNumber(els.endKm.value);
  const grossEarnings = parseNumber(els.grossEarnings.value);
  const fuelCost = parseNumber(els.fuelCost.value);
  const rides = parseNumber(els.rides.value);
  const notes = els.notes.value.trim();

  if (!isFinite(endKm) || endKm < state.activeSession.startKm) {
    alert('A quilometragem final precisa ser maior ou igual à inicial.');
    return;
  }
  if (!isFinite(grossEarnings) || grossEarnings < 0) {
    alert('Digite o faturamento bruto do dia.');
    return;
  }
  if (!isFinite(fuelCost) || fuelCost < 0) {
    alert('Digite o gasto com combustível. Se não abasteceu, use 0.');
    return;
  }
  if (!isFinite(rides) || rides < 0) {
    alert('Digite a quantidade de corridas.');
    return;
  }

  let totalPausedMs = state.activeSession.totalPausedMs;
  const pauses = [...state.activeSession.pauses];

  if (state.activeSession.currentStatus === 'paused' && state.activeSession.pausedAt) {
    const pauseStart = new Date(state.activeSession.pausedAt).getTime();
    const pauseEnd = Date.now();
    totalPausedMs += pauseEnd - pauseStart;
    pauses.push({
      startedAt: new Date(pauseStart).toISOString(),
      endedAt: new Date(pauseEnd).toISOString(),
    });
  }

  const endedAt = new Date().toISOString();
  const activeDriveMs = Math.max(0, new Date(endedAt).getTime() - new Date(state.activeSession.startedAt).getTime() - totalPausedMs);

  state.sessions.unshift({
    id: self.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    startedAt: state.activeSession.startedAt,
    endedAt,
    startKm: state.activeSession.startKm,
    endKm,
    grossEarnings,
    fuelCost,
    rides,
    notes,
    pauses,
    activeDriveMs,
  });

  state.activeSession = null;
  closeFinishPanel();

  const date = toDateInput(new Date(endedAt));
  state.filters.mode = 'range';
  state.filters.rangeStart = date;
  state.filters.rangeEnd = date;
  els.filterMode.value = 'range';
  render();
}

function renderSummary() {
  const filtered = getFilteredSessions();
  const summary = summarizeSessions(filtered);
  els.summaryCards.innerHTML = `
    <article class="metric-card"><span>Faturamento bruto</span><strong>${currency(summary.gross)}</strong></article>
    <article class="metric-card"><span>Combustível</span><strong>${currency(summary.fuel)}</strong></article>
    <article class="metric-card"><span>Lucro líquido</span><strong>${currency(summary.net)}</strong></article>
    <article class="metric-card"><span>Tempo ao volante</span><strong>${formatDuration(summary.driveMs)}</strong></article>
    <article class="metric-card"><span>Quilômetros rodados</span><strong>${numberFormat(summary.km)} km</strong></article>
    <article class="metric-card"><span>Corridas</span><strong>${summary.rides}</strong></article>
  `;

  const chartData = buildChartData(filtered);
  if (!chartData.length) {
    els.barsArea.innerHTML = '<div class="empty">Nenhum dia encontrado nesse período.</div>';
    return;
  }

  const maxValue = Math.max(1, ...chartData.flatMap(item => [item.gross, item.fuel, Math.max(0, item.net)]));
  els.barsArea.innerHTML = chartData.map(item => `
    <div class="bar-group">
      <div class="bar-stack">
        <div class="bar gross" style="height:${(item.gross / maxValue) * 180}px" title="Faturamento: ${item.gross}"></div>
        <div class="bar fuel" style="height:${(item.fuel / maxValue) * 180}px" title="Combustível: ${item.fuel}"></div>
        <div class="bar net" style="height:${(Math.max(0, item.net) / maxValue) * 180}px" title="Líquido: ${item.net}"></div>
      </div>
      <span class="bar-label">${item.label}</span>
    </div>
  `).join('');
}

function renderLatestDay() {
  const latest = state.sessions[0];
  if (!latest) {
    els.latestPanel.innerHTML = '<p class="eyebrow">Último dia salvo</p><h2>Ainda não existe nenhum dia salvo</h2>';
    return;
  }
  els.latestPanel.innerHTML = `
    <p class="eyebrow">Último dia salvo</p>
    <h2>${dateFormat(latest.endedAt)}</h2>
    <div class="cards-grid">
      <article class="metric-card"><span>Bruto</span><strong>${currency(latest.grossEarnings)}</strong></article>
      <article class="metric-card"><span>Combustível</span><strong>${currency(latest.fuelCost)}</strong></article>
      <article class="metric-card"><span>Líquido</span><strong>${currency(latest.grossEarnings - latest.fuelCost)}</strong></article>
      <article class="metric-card"><span>Tempo</span><strong>${formatDuration(latest.activeDriveMs || 0)}</strong></article>
    </div>
  `;
}

function renderHistory() {
  if (!state.sessions.length) {
    els.historyList.innerHTML = '<div class="empty">Você ainda não salvou nenhum dia.</div>';
    return;
  }
  els.historyList.innerHTML = state.sessions.map(session => `
    <article class="history-item">
      <div>
        <strong>${dateFormat(session.endedAt)}</strong>
        <p>${timeFormat(session.startedAt)} até ${timeFormat(session.endedAt)} • ${session.rides} corridas • ${numberFormat(session.endKm - session.startKm)} km</p>
        ${session.notes ? `<p class="notes-text">Obs.: ${escapeHtml(session.notes)}</p>` : ''}
      </div>
      <div class="history-values">
        <span>Bruto: ${currency(session.grossEarnings)}</span>
        <span>Combustível: ${currency(session.fuelCost)}</span>
        <span>Líquido: ${currency(session.grossEarnings - session.fuelCost)}</span>
        <span>Tempo: ${formatDuration(session.activeDriveMs || 0)}</span>
        <div class="inline-buttons history-actions">
          <button class="secondary-button small-button" data-edit-id="${session.id}">Editar</button>
          <button class="ghost-button small-button" data-delete-id="${session.id}">Excluir</button>
        </div>
      </div>
    </article>
  `).join('');

  document.querySelectorAll('[data-edit-id]').forEach(button => {
    button.addEventListener('click', () => openEditPanel(button.dataset.editId));
  });
  document.querySelectorAll('[data-delete-id]').forEach(button => {
    button.addEventListener('click', () => deleteSession(button.dataset.deleteId));
  });
}

function openEditPanel(sessionId) {
  const session = state.sessions.find(item => item.id === sessionId);
  if (!session) return;
  state.editingSessionId = sessionId;
  const started = new Date(session.startedAt);
  const ended = new Date(session.endedAt);
  els.editDate.value = toDateInput(ended);
  els.editStartTime.value = toTimeInput(started);
  els.editEndTime.value = toTimeInput(ended);
  els.editStartKm.value = String(session.startKm ?? '');
  els.editEndKm.value = String(session.endKm ?? '');
  els.editGrossEarnings.value = String(session.grossEarnings ?? '');
  els.editFuelCost.value = String(session.fuelCost ?? '');
  els.editRides.value = String(session.rides ?? '');
  const driveMs = session.activeDriveMs || 0;
  els.editDriveHours.value = String(Math.floor(driveMs / 3600000));
  els.editDriveMinutes.value = String(Math.round((driveMs % 3600000) / 60000));
  els.editNotes.value = session.notes || '';
  closeFinishPanel();
  els.editPanel.classList.remove('hidden');
  els.editPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeEditPanel() {
  state.editingSessionId = null;
  els.editPanel.classList.add('hidden');
}

function updateSession() {
  if (!state.editingSessionId) return;
  const session = state.sessions.find(item => item.id === state.editingSessionId);
  if (!session) return;

  const date = els.editDate.value;
  const startTime = els.editStartTime.value;
  const endTime = els.editEndTime.value;
  const startKm = parseNumber(els.editStartKm.value);
  const endKm = parseNumber(els.editEndKm.value);
  const grossEarnings = parseNumber(els.editGrossEarnings.value);
  const fuelCost = parseNumber(els.editFuelCost.value);
  const rides = parseNumber(els.editRides.value);
  const driveHours = parseInt(els.editDriveHours.value || '0', 10);
  const driveMinutes = parseInt(els.editDriveMinutes.value || '0', 10);
  const notes = els.editNotes.value.trim();

  if (!date || !startTime || !endTime) {
    alert('Preencha a data e os horários.');
    return;
  }
  if (!isFinite(startKm) || startKm < 0) {
    alert('Digite um KM inicial válido.');
    return;
  }
  if (!isFinite(endKm) || endKm < startKm) {
    alert('O KM final precisa ser maior ou igual ao inicial.');
    return;
  }
  if (!isFinite(grossEarnings) || grossEarnings < 0 || !isFinite(fuelCost) || fuelCost < 0 || !isFinite(rides) || rides < 0) {
    alert('Revise faturamento, combustível e corridas.');
    return;
  }
  if (!Number.isFinite(driveHours) || driveHours < 0 || !Number.isFinite(driveMinutes) || driveMinutes < 0 || driveMinutes > 59) {
    alert('Revise o tempo ao volante.');
    return;
  }

  const startedAt = new Date(`${date}T${startTime}:00`);
  let endedAt = new Date(`${date}T${endTime}:00`);
  if (endedAt.getTime() < startedAt.getTime()) {
    endedAt = new Date(endedAt.getTime() + 24 * 60 * 60 * 1000);
  }

  session.startedAt = startedAt.toISOString();
  session.endedAt = endedAt.toISOString();
  session.startKm = startKm;
  session.endKm = endKm;
  session.grossEarnings = grossEarnings;
  session.fuelCost = fuelCost;
  session.rides = rides;
  session.notes = notes;
  session.activeDriveMs = ((driveHours * 60) + driveMinutes) * 60000;
  closeEditPanel();
  render();
}

function deleteSession(sessionId) {
  const session = state.sessions.find(item => item.id === sessionId);
  if (!session) return;
  const confirmed = confirm(`Excluir o dia ${dateFormat(session.endedAt)}?`);
  if (!confirmed) return;
  state.sessions = state.sessions.filter(item => item.id !== sessionId);
  if (state.editingSessionId === sessionId) closeEditPanel();
  render();
}

function closeFinishPanel() {
  els.finishPanel.classList.add('hidden');
  els.endKm.value = '';
  els.grossEarnings.value = '';
  els.fuelCost.value = '';
  els.rides.value = '';
  els.notes.value = '';
}

function getDefaultFilters() {
  const range = getWeekRange();
  return {
    mode: 'week',
    rangeStart: toDateInput(range.start),
    rangeEnd: toDateInput(range.end),
  };
}

function toggleRangeInputs() {
  const isRange = state.filters.mode === 'range';
  els.rangeStart.classList.toggle('hidden', !isRange);
  els.rangeEnd.classList.toggle('hidden', !isRange);
  els.rangeStart.value = state.filters.rangeStart;
  els.rangeEnd.value = state.filters.rangeEnd;
  els.filterMode.value = state.filters.mode;
}

function getFilteredSessions() {
  const { start, end } = resolveFilterRange(state.filters);
  return state.sessions.filter(session => {
    const time = new Date(session.endedAt).getTime();
    return time >= start.getTime() && time <= end.getTime();
  });
}

function resolveFilterRange(filters) {
  if (filters.mode === 'week') return getWeekRange();
  if (filters.mode === 'month') return getMonthRange();
  if (filters.mode === 'year') return getYearRange();
  return {
    start: new Date(`${filters.rangeStart}T00:00:00`),
    end: new Date(`${filters.rangeEnd}T23:59:59.999`),
  };
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

function getYearRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), 0, 1),
    end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
  };
}

function summarizeSessions(sessions) {
  return sessions.reduce((acc, session) => {
    acc.gross += session.grossEarnings;
    acc.fuel += session.fuelCost;
    acc.net += session.grossEarnings - session.fuelCost;
    acc.rides += session.rides;
    acc.km += Math.max(0, session.endKm - session.startKm);
    acc.driveMs += session.activeDriveMs || 0;
    return acc;
  }, { gross: 0, fuel: 0, net: 0, rides: 0, km: 0, driveMs: 0 });
}

function buildChartData(sessions) {
  const grouped = {};
  sessions.forEach(session => {
    const date = new Date(session.endedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (!grouped[key]) {
      grouped[key] = {
        label: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date),
        gross: 0,
        fuel: 0,
        net: 0,
      };
    }
    grouped[key].gross += session.grossEarnings;
    grouped[key].fuel += session.fuelCost;
    grouped[key].net += session.grossEarnings - session.fuelCost;
  });
  return Object.keys(grouped).sort().map(key => grouped[key]);
}

function getActiveDriveMs(activeSession) {
  const startMs = new Date(activeSession.startedAt).getTime();
  const pausedCurrent = activeSession.currentStatus === 'paused' && activeSession.pausedAt
    ? Date.now() - new Date(activeSession.pausedAt).getTime()
    : 0;
  return Math.max(0, Date.now() - startMs - activeSession.totalPausedMs - pausedCurrent);
}

function parseNumber(value) {
  return Number(String(value).trim().replace(/\./g, '').replace(',', '.'));
}

function currency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function numberFormat(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value || 0);
}

function dateFormat(value) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function timeFormat(value) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function dateTimeFormat(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}min`;
}

function toDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toTimeInput(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
