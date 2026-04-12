import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const STORAGE_KEYS = {
  supabaseUrl: 'uber_supabase_url',
  supabaseAnonKey: 'uber_supabase_anon_key',
  session: 'uber_active_session',
  localEntries: 'uber_local_entries'
};

let supabase = null;
let currentUser = null;
let entries = [];
let localEntries = loadLocalEntries();
let activeSession = loadActiveSession();
let timerInterval = null;
let chart = null;

const $ = (id) => document.getElementById(id);
const els = {
  openSettingsBtn: $('openSettingsBtn'), logoutBtn: $('logoutBtn'),
  authCard: $('authCard'), authForm: $('authForm'), signUpBtn: $('signUpBtn'), authEmail: $('authEmail'), authPassword: $('authPassword'),
  setupWarning: $('setupWarning'), appContent: $('appContent'),
  workDate: $('workDate'), startKm: $('startKm'), startForm: $('startForm'),
  sessionPanel: $('sessionPanel'), elapsedText: $('elapsedText'), startAtText: $('startAtText'), todayStatus: $('todayStatus'),
  pauseBtn: $('pauseBtn'), resumeBtn: $('resumeBtn'), finishOpenBtn: $('finishOpenBtn'),
  finishDialog: $('finishDialog'), closeFinishDialog: $('closeFinishDialog'), finishForm: $('finishForm'),
  endKm: $('endKm'), grossAmount: $('grossAmount'), fuelAmount: $('fuelAmount'), vehicleAmount: $('vehicleAmount'), vehicleDetailsGroup: $('vehicleDetailsGroup'), vehicleCategory: $('vehicleCategory'), vehicleDescription: $('vehicleDescription'), rideCount: $('rideCount'), refueled: $('refueled'), notes: $('notes'),
  periodType: $('periodType'), fromDate: $('fromDate'), toDate: $('toDate'), customRange: $('customRange'),
  grossTotal: $('grossTotal'), fuelTotal: $('fuelTotal'), vehicleTotal: $('vehicleTotal'), vehicleSummaryBtn: $('vehicleSummaryBtn'), netTotal: $('netTotal'), kmTotal: $('kmTotal'), hoursTotal: $('hoursTotal'), chartCanvas: $('chart'),
  historyList: $('historyList'), historyEmpty: $('historyEmpty'),
  editDialog: $('editDialog'), closeEditDialog: $('closeEditDialog'), editForm: $('editForm'), deleteEntryBtn: $('deleteEntryBtn'),
  editId: $('editId'), editDate: $('editDate'), editStartTime: $('editStartTime'), editEndTime: $('editEndTime'), editDriveTime: $('editDriveTime'), editStartKm: $('editStartKm'), editEndKm: $('editEndKm'), editGross: $('editGross'), editFuel: $('editFuel'), editVehicle: $('editVehicle'), editVehicleDetailsGroup: $('editVehicleDetailsGroup'), editVehicleCategory: $('editVehicleCategory'), editVehicleDescription: $('editVehicleDescription'), editRides: $('editRides'), editRefueled: $('editRefueled'), editNotes: $('editNotes'),
  exportBtn: $('exportBtn'), importInput: $('importInput'), syncBtn: $('syncBtn'),
  vehicleExpensesDialog: $('vehicleExpensesDialog'), closeVehicleExpensesDialog: $('closeVehicleExpensesDialog'), vehicleModalTotal: $('vehicleModalTotal'), vehicleModalCount: $('vehicleModalCount'), vehicleCategorySummary: $('vehicleCategorySummary'), vehicleExpensesEmpty: $('vehicleExpensesEmpty'), vehicleExpensesList: $('vehicleExpensesList'),
  settingsDialog: $('settingsDialog'), closeSettingsDialog: $('closeSettingsDialog'), settingsForm: $('settingsForm'), supabaseUrlInput: $('supabaseUrlInput'), supabaseAnonKeyInput: $('supabaseAnonKeyInput')
};

function boot() {
  setToday();
  bindEvents();
  restoreSupabaseClient();
  renderAuthState();
  refreshDashboard();
  renderSession();
}

function bindEvents() {
  els.openSettingsBtn.addEventListener('click', openSettings);
  els.closeSettingsDialog.addEventListener('click', () => els.settingsDialog.close());
  els.settingsForm.addEventListener('submit', saveSupabaseSettings);

  els.authForm.addEventListener('submit', signIn);
  els.signUpBtn.addEventListener('click', signUp);
  els.logoutBtn.addEventListener('click', logout);

  els.startForm.addEventListener('submit', startDay);
  els.pauseBtn.addEventListener('click', pauseSession);
  els.resumeBtn.addEventListener('click', resumeSession);
  els.finishOpenBtn.addEventListener('click', openFinishDialog);
  els.closeFinishDialog.addEventListener('click', () => els.finishDialog.close());
  els.finishForm.addEventListener('submit', finishDay);
  els.vehicleAmount.addEventListener('input', () => toggleVehicleDetails(false));

  els.periodType.addEventListener('change', refreshDashboard);
  els.fromDate.addEventListener('change', refreshDashboard);
  els.toDate.addEventListener('change', refreshDashboard);

  els.closeEditDialog.addEventListener('click', () => els.editDialog.close());
  els.editForm.addEventListener('submit', saveEdit);
  els.deleteEntryBtn.addEventListener('click', deleteEntry);
  els.editVehicle.addEventListener('input', () => toggleVehicleDetails(true));

  els.vehicleSummaryBtn.addEventListener('click', openVehicleExpensesDialog);
  els.closeVehicleExpensesDialog.addEventListener('click', () => els.vehicleExpensesDialog.close());

  els.exportBtn.addEventListener('click', exportJson);
  els.importInput.addEventListener('change', importJson);
  els.syncBtn.addEventListener('click', syncEntries);
}

function restoreSupabaseClient() {
  const url = localStorage.getItem(STORAGE_KEYS.supabaseUrl) || '';
  const key = localStorage.getItem(STORAGE_KEYS.supabaseAnonKey) || '';
  els.supabaseUrlInput.value = url;
  els.supabaseAnonKeyInput.value = key;
  if (!url || !key) return;
  supabase = createClient(url, key);
  initAuthState();
}

async function initAuthState() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    alert('Erro ao ler sessão do Supabase: ' + error.message);
    return;
  }
  currentUser = data.session?.user ?? null;
  renderAuthState();
  if (currentUser) await loadEntries();
  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    renderAuthState();
    if (currentUser) await loadEntries();
    else {
      entries = normalizeLocalEntries(loadLocalEntries());
      refreshDashboard();
    }
  });
}

function renderAuthState() {
  const hasConfig = !!supabase;
  els.setupWarning.classList.toggle('hidden', hasConfig);
  els.authCard.classList.toggle('hidden', !hasConfig || !!currentUser);
  els.appContent.classList.remove('hidden');
  els.logoutBtn.classList.toggle('hidden', !currentUser);
  els.syncBtn.classList.toggle('hidden', !currentUser);
}

function openSettings() { els.settingsDialog.showModal(); }

async function saveSupabaseSettings(event) {
  event.preventDefault();
  const url = els.supabaseUrlInput.value.trim();
  const key = els.supabaseAnonKeyInput.value.trim();
  localStorage.setItem(STORAGE_KEYS.supabaseUrl, url);
  localStorage.setItem(STORAGE_KEYS.supabaseAnonKey, key);
  supabase = createClient(url, key);
  els.settingsDialog.close();
  await initAuthState();
}

async function signUp() {
  if (!supabase) return alert('Configure o Supabase primeiro.');
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value.trim();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return alert(error.message);
  alert('Conta criada. Se o Supabase estiver pedindo confirmação de e-mail, confira sua caixa de entrada.');
}

async function signIn(event) {
  event.preventDefault();
  if (!supabase) return alert('Configure o Supabase primeiro.');
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value.trim();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return alert(error.message);
}

async function logout() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) return alert(error.message);
}

function setToday() {
  const today = new Date().toISOString().slice(0, 10);
  els.workDate.value = today;
  if (!els.fromDate.value) els.fromDate.value = today;
  if (!els.toDate.value) els.toDate.value = today;
}

function loadActiveSession() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null');
    return normalizeActiveSession(raw);
  } catch {
    return null;
  }
}
function persistActiveSession() {
  if (!activeSession) localStorage.removeItem(STORAGE_KEYS.session);
  else localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(activeSession));
}

function normalizeActiveSession(raw) {
  if (!raw) return null;

  if (raw.sessionStartAt) {
    return {
      date: raw.date,
      startKm: Number(raw.startKm || 0),
      sessionStartAt: raw.sessionStartAt,
      status: raw.status === 'paused' ? 'paused' : 'running',
      pauses: Array.isArray(raw.pauses) ? raw.pauses : [],
      currentPauseStartedAt: raw.currentPauseStartedAt || null
    };
  }

  if (raw.startAt) {
    const migrated = {
      date: raw.date,
      startKm: Number(raw.startKm || 0),
      sessionStartAt: raw.startAt,
      status: raw.status === 'paused' ? 'paused' : 'running',
      pauses: [],
      currentPauseStartedAt: raw.pauseStartedAt || null
    };

    if (Number(raw.elapsedMs || 0) > 0) {
      const startedAtMs = new Date(raw.startAt).getTime();
      const elapsedMs = Number(raw.elapsedMs || 0);
      const pausedAtMs = raw.pauseStartedAt ? new Date(raw.pauseStartedAt).getTime() : Date.now();
      const totalWindowMs = Math.max(0, pausedAtMs - startedAtMs);
      const pausedMs = Math.max(0, totalWindowMs - elapsedMs);
      if (pausedMs > 0) {
        migrated.pauses.push({
          startAt: new Date(pausedAtMs - pausedMs).toISOString(),
          endAt: raw.pauseStartedAt || new Date().toISOString()
        });
      }
    }

    return migrated;
  }

  return null;
}

function loadLocalEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.localEntries) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeLocalEntries(items) {
  return (items || []).map((item) => ({
    ...item,
    vehicle_amount: Number(item.vehicle_amount || 0),
    vehicle_category: item.vehicle_category || '',
    vehicle_description: item.vehicle_description || '',
    source: item.source || 'local'
  }));
}

function persistLocalEntries() {
  localStorage.setItem(STORAGE_KEYS.localEntries, JSON.stringify(localEntries));
}

function makeLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function startDay(event) {
  event.preventDefault();
  if (activeSession) return alert('Já existe um dia em andamento.');
  activeSession = {
    date: els.workDate.value,
    startKm: Number(els.startKm.value),
    sessionStartAt: new Date().toISOString(),
    pauses: [],
    currentPauseStartedAt: null,
    status: 'running'
  };
  persistActiveSession();
  renderSession();
}

function pauseSession() {
  if (!activeSession || activeSession.status !== 'running') return;
  activeSession.status = 'paused';
  activeSession.currentPauseStartedAt = new Date().toISOString();
  persistActiveSession();
  renderSession();
}

function resumeSession() {
  if (!activeSession || activeSession.status !== 'paused') return;
  activeSession.pauses = activeSession.pauses || [];
  if (activeSession.currentPauseStartedAt) {
    activeSession.pauses.push({
      startAt: activeSession.currentPauseStartedAt,
      endAt: new Date().toISOString()
    });
  }
  activeSession.currentPauseStartedAt = null;
  activeSession.status = 'running';
  persistActiveSession();
  renderSession();
}

function getElapsedMs(referenceDate = new Date()) {
  if (!activeSession) return 0;
  const sessionStartMs = new Date(activeSession.sessionStartAt).getTime();
  const referenceMs = activeSession.status === 'paused' && activeSession.currentPauseStartedAt
    ? new Date(activeSession.currentPauseStartedAt).getTime()
    : referenceDate.getTime();

  const totalPausedMs = (activeSession.pauses || []).reduce((sum, pause) => {
    const startMs = new Date(pause.startAt).getTime();
    const endMs = pause.endAt ? new Date(pause.endAt).getTime() : referenceMs;
    return sum + Math.max(0, endMs - startMs);
  }, 0);

  return Math.max(0, referenceMs - sessionStartMs - totalPausedMs);
}

function renderSession() {
  clearInterval(timerInterval);
  const active = !!activeSession;
  els.sessionPanel.classList.toggle('hidden', !active);
  els.todayStatus.textContent = active ? (activeSession.status === 'running' ? 'Rodando' : 'Pausado') : 'Sem corrida ativa';
  if (!active) {
    els.elapsedText.textContent = '00:00:00';
    els.startAtText.textContent = '-';
    return;
  }
  els.startAtText.textContent = new Date(activeSession.sessionStartAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  els.pauseBtn.classList.toggle('hidden', activeSession.status !== 'running');
  els.resumeBtn.classList.toggle('hidden', activeSession.status !== 'paused');
  const tick = () => { els.elapsedText.textContent = formatDuration(getElapsedMs()); };
  tick();
  if (activeSession.status === 'running') timerInterval = setInterval(tick, 1000);
}

function openFinishDialog() {
  if (!activeSession) return alert('Nenhum dia ativo.');
  els.endKm.value = '';
  els.grossAmount.value = '';
  els.fuelAmount.value = '0';
  els.vehicleAmount.value = '0';
  els.vehicleCategory.value = '';
  els.vehicleDescription.value = '';
  toggleVehicleDetails(false);
  els.rideCount.value = '0';
  els.refueled.checked = false;
  els.notes.value = '';
  els.finishDialog.showModal();
}

async function finishDay(event) {
  event.preventDefault();
  if (!activeSession) return;
  const endAt = new Date();
  const baseEntry = {
    work_date: activeSession.date,
    start_time: new Date(activeSession.sessionStartAt).toISOString(),
    end_time: endAt.toISOString(),
    drive_seconds: Math.floor(getElapsedMs() / 1000),
    start_km: Number(activeSession.startKm),
    end_km: Number(els.endKm.value),
    gross_amount: Number(els.grossAmount.value),
    fuel_amount: Number(els.fuelAmount.value),
    vehicle_amount: Number(els.vehicleAmount.value),
    vehicle_category: normalizedVehicleCategory(els.vehicleAmount.value, els.vehicleCategory.value),
    vehicle_description: normalizedVehicleDescription(els.vehicleAmount.value, els.vehicleDescription.value),
    ride_count: Number(els.rideCount.value),
    refueled: els.refueled.checked,
    notes: els.notes.value.trim()
  };

  if (currentUser && supabase) {
    const entry = { ...baseEntry, user_id: currentUser.id };
    const { data, error } = await supabase.from('work_days').insert(entry).select().single();
    if (error) return alert('Erro ao salvar no Supabase: ' + error.message);
    localEntries.unshift({ ...data, source: 'cloud' });
    persistLocalEntries();
  } else {
    localEntries.unshift({ ...baseEntry, id: makeLocalId(), source: 'local' });
    persistLocalEntries();
  }

  activeSession = null;
  persistActiveSession();
  els.finishDialog.close();
  await loadEntries();
  renderSession();
}

async function loadEntries() {
  localEntries = loadLocalEntries();
  let merged = normalizeLocalEntries(localEntries);
  if (currentUser && supabase) {
    const { data, error } = await supabase
      .from('work_days')
      .select('*')
      .order('work_date', { ascending: false })
      .order('start_time', { ascending: false });
    if (error) {
      alert('Erro ao carregar dias: ' + error.message);
    } else {
      merged = (data || []).map((item) => ({ ...item, source: 'cloud' }));
      localEntries = merged;
      persistLocalEntries();
    }
  }
  entries = merged.sort((a, b) => String(b.work_date).localeCompare(String(a.work_date)) || String(b.start_time).localeCompare(String(a.start_time)));
  refreshDashboard();
}

function getFilteredEntries() {
  const type = els.periodType.value;
  const now = new Date();
  let from = null;
  let to = null;
  if (type === 'week') {
    const day = now.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    from = new Date(now); from.setDate(now.getDate() - diff); from.setHours(0,0,0,0);
    to = new Date(from); to.setDate(from.getDate() + 6); to.setHours(23,59,59,999);
  } else if (type === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999);
  } else if (type === 'year') {
    from = new Date(now.getFullYear(), 0, 1);
    to = new Date(now.getFullYear(), 11, 31, 23,59,59,999);
  } else {
    els.customRange.classList.remove('hidden');
    if (!els.fromDate.value || !els.toDate.value) return [];
    from = new Date(els.fromDate.value + 'T00:00:00');
    to = new Date(els.toDate.value + 'T23:59:59');
  }
  if (type !== 'custom') els.customRange.classList.add('hidden');
  return entries.filter((item) => {
    const d = new Date(item.work_date + 'T12:00:00');
    return d >= from && d <= to;
  });
}

function refreshDashboard() {
  const filtered = getFilteredEntries();
  const gross = filtered.reduce((sum, item) => sum + Number(item.gross_amount || 0), 0);
  const fuel = filtered.reduce((sum, item) => sum + Number(item.fuel_amount || 0), 0);
  const vehicle = filtered.reduce((sum, item) => sum + Number(item.vehicle_amount || 0), 0);
  const secs = filtered.reduce((sum, item) => sum + Number(item.drive_seconds || 0), 0);
  const kms = filtered.reduce((sum, item) => sum + Math.max(0, Number(item.end_km || 0) - Number(item.start_km || 0)), 0);
  els.grossTotal.textContent = money(gross);
  els.fuelTotal.textContent = money(fuel);
  els.vehicleTotal.textContent = money(vehicle);
  els.netTotal.textContent = money(gross - fuel - vehicle);
  els.kmTotal.textContent = formatKm(kms);
  els.hoursTotal.textContent = formatHoursMinutes(secs);
  renderChart(filtered);
  renderHistory();
  if (els.vehicleExpensesDialog.open) renderVehicleExpensesDialog(filtered);
}

function renderChart(filtered) {
  const grouped = groupEntriesForChart(filtered);
  if (chart) chart.destroy();
  chart = new Chart(els.chartCanvas, {
    type: 'bar',
    data: {
      labels: grouped.labels,
      datasets: [
        { label: 'Bruto', data: grouped.grossData, borderRadius: 8 },
        { label: 'Líquido', data: grouped.netData, borderRadius: 8 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      resizeDelay: 150,
      plugins: { legend: { labels: { color: '#f9fafb' } } },
      scales: {
        x: { ticks: { color: '#e5e7eb' }, grid: { display: false } },
        y: { ticks: { color: '#e5e7eb' }, grid: { color: 'rgba(255,255,255,0.06)' } }
      }
    }
  });
}

function groupEntriesForChart(filtered) {
  const period = els.periodType.value;
  const map = new Map();

  for (const item of filtered) {
    const date = new Date(item.work_date + 'T12:00:00');
    const key = period === 'year'
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : item.work_date;

    if (!map.has(key)) {
      map.set(key, {
        label: period === 'year'
          ? date.toLocaleDateString('pt-BR', { month: 'short' })
          : formatDate(item.work_date),
        gross: 0,
        fuel: 0,
        vehicle: 0
      });
    }

    const target = map.get(key);
    target.gross += Number(item.gross_amount || 0);
    target.fuel += Number(item.fuel_amount || 0);
    target.vehicle += Number(item.vehicle_amount || 0);
  }

  const rows = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => value);

  return {
    labels: rows.map((row) => row.label),
    grossData: rows.map((row) => round2(row.gross)),
    netData: rows.map((row) => round2(row.gross - row.fuel - row.vehicle))
  };
}

function renderHistory() {
  els.historyEmpty.classList.toggle('hidden', entries.length > 0);
  els.historyList.innerHTML = '';
  for (const item of entries) {
    const div = document.createElement('article');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-top">
        <div>
          <strong>${formatDate(item.work_date)}</strong>
          <div class="muted">${timeOnly(item.start_time)} até ${timeOnly(item.end_time)}</div>
        </div>
        <div class="row wrap actions-right">
          <span class="tiny muted">${item.source === 'cloud' ? 'Nuvem' : 'Local'}</span>
          <button type="button" class="secondary" data-edit="${escapeHtml(String(item.id))}">Editar</button>
        </div>
      </div>
      <div class="history-stats">
        <div class="history-stat">Bruto<br><strong>${money(item.gross_amount)}</strong></div>
        <div class="history-stat">Combustível<br><strong>${money(item.fuel_amount)}</strong></div>
        <div class="history-stat">Veículo<br><strong>${money(item.vehicle_amount || 0)}</strong>${renderVehicleMeta(item)}</div>
        <div class="history-stat">Líquido<br><strong>${money(Number(item.gross_amount) - Number(item.fuel_amount) - Number(item.vehicle_amount || 0))}</strong></div>
        <div class="history-stat">Tempo<br><strong>${formatDuration(Number(item.drive_seconds||0)*1000)}</strong></div>
      </div>
      <div class="history-stats">
        <div class="history-stat">KM<br><strong>${Number(item.end_km) - Number(item.start_km)} km</strong></div>
        <div class="history-stat">Corridas<br><strong>${item.ride_count}</strong></div>
        <div class="history-stat">Abasteceu<br><strong>${item.refueled ? 'Sim' : 'Não'}</strong></div>
        <div class="history-stat">Obs.<br><strong>${escapeHtml(item.notes || '-')}</strong></div>
      </div>`;
    div.querySelector('[data-edit]').addEventListener('click', () => openEdit(String(item.id)));
    els.historyList.appendChild(div);
  }
}

function openEdit(id) {
  const item = entries.find(x => String(x.id) === String(id));
  if (!item) return alert('Não achei esse lançamento.');
  els.editId.value = String(item.id);
  els.editDate.value = item.work_date;
  els.editStartTime.value = timeInputValue(item.start_time);
  els.editEndTime.value = timeInputValue(item.end_time);
  els.editDriveTime.value = secondsToHms(item.drive_seconds || 0);
  els.editStartKm.value = item.start_km;
  els.editEndKm.value = item.end_km;
  els.editGross.value = item.gross_amount;
  els.editFuel.value = item.fuel_amount;
  els.editVehicle.value = Number(item.vehicle_amount || 0);
  els.editVehicleCategory.value = item.vehicle_category || '';
  els.editVehicleDescription.value = item.vehicle_description || '';
  toggleVehicleDetails(true, Number(item.vehicle_amount || 0) > 0);
  els.editRides.value = item.ride_count;
  els.editRefueled.checked = !!item.refueled;
  els.editNotes.value = item.notes || '';
  els.editDialog.showModal();
}

async function saveEdit(event) {
  event.preventDefault();
  const id = els.editId.value;
  const existing = entries.find((item) => String(item.id) === String(id));
  if (!existing) return alert('Lançamento não encontrado.');

  const payload = {
    work_date: els.editDate.value,
    start_time: combineDateAndTime(els.editDate.value, els.editStartTime.value),
    end_time: combineDateAndTime(els.editDate.value, els.editEndTime.value),
    drive_seconds: hmsToSeconds(els.editDriveTime.value),
    start_km: Number(els.editStartKm.value),
    end_km: Number(els.editEndKm.value),
    gross_amount: Number(els.editGross.value),
    fuel_amount: Number(els.editFuel.value),
    vehicle_amount: Number(els.editVehicle.value),
    vehicle_category: normalizedVehicleCategory(els.editVehicle.value, els.editVehicleCategory.value),
    vehicle_description: normalizedVehicleDescription(els.editVehicle.value, els.editVehicleDescription.value),
    ride_count: Number(els.editRides.value),
    refueled: els.editRefueled.checked,
    notes: els.editNotes.value.trim()
  };

  if (existing.source === 'cloud' && currentUser && supabase) {
    const { error } = await supabase.from('work_days').update(payload).eq('id', id);
    if (error) return alert('Erro ao atualizar: ' + error.message);
  }

  localEntries = loadLocalEntries().map((item) => String(item.id) === String(id) ? { ...item, ...payload } : item);
  if (!localEntries.some((item) => String(item.id) === String(id))) {
    localEntries.unshift({ ...existing, ...payload });
  }
  persistLocalEntries();
  els.editDialog.close();
  await loadEntries();
}

async function deleteEntry() {
  const id = els.editId.value;
  const existing = entries.find((item) => String(item.id) === String(id));
  if (!existing) return alert('Lançamento não encontrado.');
  if (!confirm('Excluir este dia?')) return;

  if (existing.source === 'cloud' && currentUser && supabase) {
    const { error } = await supabase.from('work_days').delete().eq('id', id);
    if (error) return alert('Erro ao excluir: ' + error.message);
  }

  localEntries = loadLocalEntries().filter((item) => String(item.id) !== String(id));
  persistLocalEntries();
  els.editDialog.close();
  await loadEntries();
}

async function syncEntries() {
  if (!currentUser || !supabase) return alert('Conecte o Supabase e faça login primeiro.');
  const pending = loadLocalEntries().filter((item) => item.source === 'local');
  if (!pending.length) {
    alert('Não há lançamentos locais pendentes para sincronizar.');
    return;
  }
  const payload = pending.map((item) => ({
    user_id: currentUser.id,
    work_date: item.work_date,
    start_time: item.start_time,
    end_time: item.end_time,
    drive_seconds: Number(item.drive_seconds || 0),
    start_km: Number(item.start_km || 0),
    end_km: Number(item.end_km || 0),
    gross_amount: Number(item.gross_amount || 0),
    fuel_amount: Number(item.fuel_amount || 0),
    vehicle_amount: Number(item.vehicle_amount || 0),
    vehicle_category: item.vehicle_category || '',
    vehicle_description: item.vehicle_description || '',
    ride_count: Number(item.ride_count || 0),
    refueled: !!item.refueled,
    notes: item.notes || ''
  }));
  const { error } = await supabase.from('work_days').insert(payload);
  if (error) return alert('Erro ao sincronizar: ' + error.message);
  alert('Sincronização concluída.');
  await loadEntries();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `motorista-pro-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed)) throw new Error('Arquivo inválido.');

    const normalized = parsed.map((item) => ({
      id: item.id || makeLocalId(),
      work_date: item.work_date,
      start_time: item.start_time,
      end_time: item.end_time,
      drive_seconds: Number(item.drive_seconds || 0),
      start_km: Number(item.start_km || 0),
      end_km: Number(item.end_km || 0),
      gross_amount: Number(item.gross_amount || 0),
      fuel_amount: Number(item.fuel_amount || 0),
      vehicle_amount: Number(item.vehicle_amount || 0),
      vehicle_category: item.vehicle_category || '',
      vehicle_description: item.vehicle_description || '',
      ride_count: Number(item.ride_count || 0),
      refueled: !!item.refueled,
      notes: item.notes || '',
      source: currentUser ? 'cloud' : 'local'
    }));

    if (currentUser && supabase) {
      const payload = normalized.map((item) => ({ ...item, id: undefined, source: undefined, user_id: currentUser.id }));
      const { error } = await supabase.from('work_days').insert(payload);
      if (error) throw error;
    } else {
      localEntries = [...normalized, ...loadLocalEntries()];
      persistLocalEntries();
    }

    alert('Importação concluída.');
    await loadEntries();
  } catch (err) {
    alert('Erro ao importar: ' + err.message);
  } finally {
    event.target.value = '';
  }
}



function toggleVehicleDetails(isEdit, forceVisible = null) {
  const amountEl = isEdit ? els.editVehicle : els.vehicleAmount;
  const groupEl = isEdit ? els.editVehicleDetailsGroup : els.vehicleDetailsGroup;
  const categoryEl = isEdit ? els.editVehicleCategory : els.vehicleCategory;
  const descriptionEl = isEdit ? els.editVehicleDescription : els.vehicleDescription;
  const visible = forceVisible ?? Number(amountEl.value || 0) > 0;
  groupEl.classList.toggle('hidden', !visible);
  categoryEl.required = visible;
  descriptionEl.required = visible;
  if (!visible) {
    categoryEl.value = '';
    descriptionEl.value = '';
  }
}

function normalizedVehicleCategory(amount, value) {
  return Number(amount || 0) > 0 ? String(value || '').trim() : '';
}

function normalizedVehicleDescription(amount, value) {
  return Number(amount || 0) > 0 ? String(value || '').trim() : '';
}

function vehicleCategoryLabel(value) {
  const labels = {
    manutencao: 'Manutenção',
    lavagem: 'Lavagem',
    pneus: 'Pneus',
    estacionamento: 'Estacionamento',
    pedagio: 'Pedágio',
    documentacao: 'Documentação',
    acessorios: 'Acessórios',
    outros: 'Outros'
  };
  return labels[value] || 'Sem categoria';
}

function renderVehicleMeta(item) {
  if (Number(item.vehicle_amount || 0) <= 0) return '';
  const bits = [];
  if (item.vehicle_category) bits.push(vehicleCategoryLabel(item.vehicle_category));
  if (item.vehicle_description) bits.push(escapeHtml(item.vehicle_description));
  if (!bits.length) return '';
  return `<div class="tiny muted vehicle-meta">${bits.join(' • ')}</div>`;
}

function openVehicleExpensesDialog() {
  renderVehicleExpensesDialog(getFilteredEntries());
  els.vehicleExpensesDialog.showModal();
}

function renderVehicleExpensesDialog(filtered) {
  const vehicleItems = filtered
    .filter((item) => Number(item.vehicle_amount || 0) > 0)
    .sort((a, b) => String(b.work_date).localeCompare(String(a.work_date)) || String(b.start_time).localeCompare(String(a.start_time)));

  const total = vehicleItems.reduce((sum, item) => sum + Number(item.vehicle_amount || 0), 0);
  els.vehicleModalTotal.textContent = money(total);
  els.vehicleModalCount.textContent = String(vehicleItems.length);

  const categoryMap = new Map();
  for (const item of vehicleItems) {
    const key = item.vehicle_category || 'sem_categoria';
    const label = item.vehicle_category ? vehicleCategoryLabel(item.vehicle_category) : 'Sem categoria';
    categoryMap.set(key, { label, total: (categoryMap.get(key)?.total || 0) + Number(item.vehicle_amount || 0) });
  }

  const categoryRows = [...categoryMap.values()].sort((a, b) => b.total - a.total);
  els.vehicleCategorySummary.innerHTML = categoryRows.length
    ? categoryRows.map((row) => `<div class="category-pill"><span>${escapeHtml(row.label)}</span><strong>${money(row.total)}</strong></div>`).join('')
    : '<div class="muted">Sem gastos com veículo neste período.</div>';

  els.vehicleExpensesEmpty.classList.toggle('hidden', vehicleItems.length > 0);
  els.vehicleExpensesList.innerHTML = vehicleItems.map((item) => `
    <article class="expense-item">
      <div class="expense-top">
        <strong>${formatDate(item.work_date)}</strong>
        <strong>${money(item.vehicle_amount)}</strong>
      </div>
      <div class="tiny muted">${escapeHtml(vehicleCategoryLabel(item.vehicle_category || ''))}</div>
      <div>${escapeHtml(item.vehicle_description || 'Sem descrição.')}</div>
    </article>
  `).join('');
}

function formatKm(value) {
  return `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function money(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatDate(value) { return new Date(value + 'T12:00:00').toLocaleDateString('pt-BR'); }
function timeOnly(value) { return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function timeInputValue(value) { return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }); }
function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return secondsToHms(total);
}
function secondsToHms(total) {
  const h = String(Math.floor(total / 3600)).padStart(2,'0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2,'0');
  const s = String(total % 60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}
function hmsToSeconds(text) {
  const [h='0',m='0',s='0'] = String(text).split(':');
  return Number(h)*3600 + Number(m)*60 + Number(s);
}
function formatHoursMinutes(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function combineDateAndTime(date, time) { return new Date(`${date}T${time}:00`).toISOString(); }
function round2(value) { return Math.round(Number(value || 0) * 100) / 100; }

function escapeHtml(text) {
  const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return String(text).replace(/[&<>"']/g, c => map[c]);
}

boot();
