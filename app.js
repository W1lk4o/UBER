import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const STORAGE_KEYS = {
  supabaseUrl: 'motorista_pro_supabase_url',
  supabaseAnonKey: 'motorista_pro_supabase_anon_key',
  activeSession: 'motorista_pro_active_session',
  localEntries: 'motorista_pro_local_entries'
};

let supabase = null;
let currentUser = null;
let entries = [];
let activeSession = loadJSON(STORAGE_KEYS.activeSession, null);
let chart = null;
let timerHandle = null;

const $ = (id) => document.getElementById(id);
const els = {
  openSettingsBtn: $('openSettingsBtn'), logoutBtn: $('logoutBtn'),
  setupWarning: $('setupWarning'), authCard: $('authCard'), appContent: $('appContent'),
  authForm: $('authForm'), authEmail: $('authEmail'), authPassword: $('authPassword'), signUpBtn: $('signUpBtn'),
  workDate: $('workDate'), startKm: $('startKm'), startForm: $('startForm'),
  sessionPanel: $('sessionPanel'), todayStatus: $('todayStatus'), elapsedText: $('elapsedText'), startAtText: $('startAtText'),
  pauseBtn: $('pauseBtn'), resumeBtn: $('resumeBtn'), finishOpenBtn: $('finishOpenBtn'),
  finishDialog: $('finishDialog'), closeFinishDialog: $('closeFinishDialog'), finishForm: $('finishForm'),
  endKm: $('endKm'), grossAmount: $('grossAmount'), fuelAmount: $('fuelAmount'), rideCount: $('rideCount'), refueled: $('refueled'), notes: $('notes'),
  periodType: $('periodType'), fromDate: $('fromDate'), toDate: $('toDate'), customRange: $('customRange'),
  grossTotal: $('grossTotal'), fuelTotal: $('fuelTotal'), netTotal: $('netTotal'), hoursTotal: $('hoursTotal'), chartCanvas: $('chart'),
  historyEmpty: $('historyEmpty'), historyList: $('historyList'), syncBtn: $('syncBtn'), exportBtn: $('exportBtn'), importInput: $('importInput'),
  editDialog: $('editDialog'), closeEditDialog: $('closeEditDialog'), editForm: $('editForm'), deleteEntryBtn: $('deleteEntryBtn'),
  editId: $('editId'), editDate: $('editDate'), editStartTime: $('editStartTime'), editEndTime: $('editEndTime'), editDriveTime: $('editDriveTime'),
  editStartKm: $('editStartKm'), editEndKm: $('editEndKm'), editGross: $('editGross'), editFuel: $('editFuel'), editRides: $('editRides'), editRefueled: $('editRefueled'), editNotes: $('editNotes'),
  settingsDialog: $('settingsDialog'), closeSettingsDialog: $('closeSettingsDialog'), settingsForm: $('settingsForm'),
  supabaseUrlInput: $('supabaseUrlInput'), supabaseAnonKeyInput: $('supabaseAnonKeyInput')
};

boot();

function boot() {
  setDefaultDates();
  bindEvents();
  restoreSupabaseConfig();
  renderSession();
  if (!supabase) {
    entries = loadLocalEntries();
    refreshDashboard();
  }
}

function bindEvents() {
  els.openSettingsBtn.addEventListener('click', () => els.settingsDialog.showModal());
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

  els.periodType.addEventListener('change', refreshDashboard);
  els.fromDate.addEventListener('change', refreshDashboard);
  els.toDate.addEventListener('change', refreshDashboard);

  els.syncBtn.addEventListener('click', syncEntries);
  els.exportBtn.addEventListener('click', exportJson);
  els.importInput.addEventListener('change', importJson);

  els.closeEditDialog.addEventListener('click', () => els.editDialog.close());
  els.editForm.addEventListener('submit', saveEdit);
  els.deleteEntryBtn.addEventListener('click', deleteEntry);
}

function setDefaultDates() {
  const today = todayString();
  els.workDate.value = today;
  els.fromDate.value = today;
  els.toDate.value = today;
}

function restoreSupabaseConfig() {
  const url = localStorage.getItem(STORAGE_KEYS.supabaseUrl) || '';
  const anon = localStorage.getItem(STORAGE_KEYS.supabaseAnonKey) || '';
  els.supabaseUrlInput.value = url;
  els.supabaseAnonKeyInput.value = anon;
  if (!url || !anon) {
    renderAuthState();
    return;
  }
  try {
    supabase = createClient(url, anon);
    initAuth();
  } catch (error) {
    alert('Erro ao configurar Supabase: ' + error.message);
  }
}

async function initAuth() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    alert('Erro ao ler sessão do Supabase: ' + error.message);
    renderAuthState();
    return;
  }
  currentUser = data.session?.user || null;
  renderAuthState();
  if (currentUser) await loadEntries();
  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    renderAuthState();
    if (currentUser) await loadEntries();
    else {
      entries = loadLocalEntries();
      refreshDashboard();
    }
  });
}

function renderAuthState() {
  const configured = !!supabase;
  els.setupWarning.classList.toggle('hidden', configured);
  els.authCard.classList.toggle('hidden', !configured || !!currentUser);
  els.appContent.classList.toggle('hidden', configured && !currentUser);
  els.logoutBtn.classList.toggle('hidden', !currentUser);
  if (!configured) {
    els.appContent.classList.remove('hidden');
  }
}

async function saveSupabaseSettings(event) {
  event.preventDefault();
  const url = els.supabaseUrlInput.value.trim();
  const anon = els.supabaseAnonKeyInput.value.trim();
  localStorage.setItem(STORAGE_KEYS.supabaseUrl, url);
  localStorage.setItem(STORAGE_KEYS.supabaseAnonKey, anon);
  try {
    supabase = createClient(url, anon);
    els.settingsDialog.close();
    await initAuth();
  } catch (error) {
    alert('Configuração inválida: ' + error.message);
  }
}

async function signUp() {
  if (!supabase) return alert('Configure o Supabase primeiro.');
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value.trim();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return alert(error.message);
  alert('Conta criada. Se o e-mail de confirmação estiver ativo, confirme sua conta.');
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

function startDay(event) {
  event.preventDefault();
  if (activeSession) return alert('Já existe um dia em andamento.');
  const startKm = Number(els.startKm.value);
  if (!Number.isFinite(startKm) || startKm < 0) return alert('Informe um KM inicial válido.');
  activeSession = {
    date: els.workDate.value,
    startKm,
    startAtIso: new Date().toISOString(),
    status: 'running',
    pausedAtIso: null,
    elapsedMsWhenPaused: 0
  };
  saveJSON(STORAGE_KEYS.activeSession, activeSession);
  renderSession();
}

function pauseSession() {
  if (!activeSession || activeSession.status !== 'running') return;
  activeSession.elapsedMsWhenPaused = getElapsedMs();
  activeSession.pausedAtIso = new Date().toISOString();
  activeSession.status = 'paused';
  saveJSON(STORAGE_KEYS.activeSession, activeSession);
  renderSession();
}

function resumeSession() {
  if (!activeSession || activeSession.status !== 'paused') return;
  const pausedFor = Date.now() - new Date(activeSession.pausedAtIso).getTime();
  activeSession.startAtIso = new Date(new Date(activeSession.startAtIso).getTime() + pausedFor).toISOString();
  activeSession.pausedAtIso = null;
  activeSession.status = 'running';
  saveJSON(STORAGE_KEYS.activeSession, activeSession);
  renderSession();
}

function getElapsedMs() {
  if (!activeSession) return 0;
  if (activeSession.status === 'paused') return activeSession.elapsedMsWhenPaused || 0;
  return Math.max(0, Date.now() - new Date(activeSession.startAtIso).getTime());
}

function renderSession() {
  clearInterval(timerHandle);
  const running = !!activeSession;
  els.sessionPanel.classList.toggle('hidden', !running);
  els.todayStatus.textContent = running ? (activeSession.status === 'paused' ? 'Pausado' : 'Rodando') : 'Sem dia ativo';
  if (!running) {
    els.elapsedText.textContent = '00:00:00';
    els.startAtText.textContent = '-';
    return;
  }
  els.startAtText.textContent = new Date(activeSession.startAtIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  els.pauseBtn.classList.toggle('hidden', activeSession.status !== 'running');
  els.resumeBtn.classList.toggle('hidden', activeSession.status !== 'paused');
  const update = () => { els.elapsedText.textContent = formatDuration(getElapsedMs()); };
  update();
  if (activeSession.status === 'running') timerHandle = setInterval(update, 1000);
}

function openFinishDialog() {
  if (!activeSession) return alert('Nenhum dia em andamento.');
  els.endKm.value = '';
  els.grossAmount.value = '';
  els.fuelAmount.value = '0';
  els.rideCount.value = '0';
  els.refueled.checked = false;
  els.notes.value = '';
  els.finishDialog.showModal();
}

async function finishDay(event) {
  event.preventDefault();
  if (!activeSession) return;

  const endKm = Number(els.endKm.value);
  const gross = Number(els.grossAmount.value);
  const fuel = Number(els.fuelAmount.value);
  const rides = Number(els.rideCount.value);
  if (![endKm, gross, fuel, rides].every(Number.isFinite)) return alert('Preencha todos os campos corretamente.');
  if (endKm < activeSession.startKm) return alert('O KM final não pode ser menor que o inicial.');

  const endDate = new Date();
  const record = {
    id: crypto.randomUUID(),
    work_date: activeSession.date,
    start_time: activeSession.startAtIso,
    end_time: endDate.toISOString(),
    drive_seconds: Math.floor(getElapsedMs() / 1000),
    start_km: activeSession.startKm,
    end_km: endKm,
    gross_amount: gross,
    fuel_amount: fuel,
    ride_count: rides,
    refueled: els.refueled.checked,
    notes: els.notes.value.trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (supabase && currentUser) {
    const payload = { ...record, user_id: currentUser.id };
    const { data, error } = await supabase.from('work_days').insert(payload).select().single();
    if (error) return alert(error.message);
    entries.unshift(normalizeEntry(data));
  } else {
    entries.unshift(normalizeEntry(record));
    persistLocalEntries();
  }

  activeSession = null;
  localStorage.removeItem(STORAGE_KEYS.activeSession);
  els.finishDialog.close();
  renderSession();
  refreshDashboard();
}

async function loadEntries() {
  const { data, error } = await supabase
    .from('work_days')
    .select('*')
    .order('work_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    alert('Erro ao carregar dados: ' + error.message);
    return;
  }
  entries = data.map(normalizeEntry);
  refreshDashboard();
}

function normalizeEntry(entry) {
  return {
    ...entry,
    id: entry.id,
    work_date: entry.work_date,
    start_time: entry.start_time,
    end_time: entry.end_time,
    drive_seconds: Number(entry.drive_seconds || 0),
    start_km: Number(entry.start_km || 0),
    end_km: Number(entry.end_km || 0),
    gross_amount: Number(entry.gross_amount || 0),
    fuel_amount: Number(entry.fuel_amount || 0),
    ride_count: Number(entry.ride_count || 0),
    refueled: !!entry.refueled,
    notes: entry.notes || '',
    created_at: entry.created_at || new Date().toISOString(),
    updated_at: entry.updated_at || new Date().toISOString()
  };
}

function refreshDashboard() {
  const filtered = getFilteredEntries();
  renderTotals(filtered);
  renderChart(filtered);
  renderHistory(entries);
  els.customRange.classList.toggle('hidden', els.periodType.value !== 'custom');
}

function getFilteredEntries() {
  const type = els.periodType.value;
  const today = new Date();
  let from = null;
  let to = null;

  if (type === 'week') {
    const day = today.getDay();
    const diff = day === 0 ? 6 : day - 1;
    from = startOfDay(addDays(today, -diff));
    to = endOfDay(addDays(from, 6));
  } else if (type === 'month') {
    from = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    to = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (type === 'year') {
    from = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0);
    to = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else {
    from = els.fromDate.value ? startOfDay(new Date(els.fromDate.value + 'T00:00:00')) : null;
    to = els.toDate.value ? endOfDay(new Date(els.toDate.value + 'T00:00:00')) : null;
  }

  return entries.filter((entry) => {
    const d = new Date(entry.work_date + 'T12:00:00');
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

function renderTotals(filtered) {
  const gross = sum(filtered, 'gross_amount');
  const fuel = sum(filtered, 'fuel_amount');
  const net = gross - fuel;
  const seconds = sum(filtered, 'drive_seconds');
  els.grossTotal.textContent = money(gross);
  els.fuelTotal.textContent = money(fuel);
  els.netTotal.textContent = money(net);
  els.hoursTotal.textContent = formatHoursMinutes(seconds);
}

function renderChart(filtered) {
  const grouped = [...filtered]
    .sort((a, b) => a.work_date.localeCompare(b.work_date))
    .reduce((acc, entry) => {
      if (!acc[entry.work_date]) acc[entry.work_date] = { gross: 0, fuel: 0, net: 0 };
      acc[entry.work_date].gross += entry.gross_amount;
      acc[entry.work_date].fuel += entry.fuel_amount;
      acc[entry.work_date].net += entry.gross_amount - entry.fuel_amount;
      return acc;
    }, {});

  const labels = Object.keys(grouped);
  const grossData = labels.map((k) => grouped[k].gross);
  const fuelData = labels.map((k) => grouped[k].fuel);
  const netData = labels.map((k) => grouped[k].net);

  if (chart) chart.destroy();
  chart = new Chart(els.chartCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Bruto', data: grossData },
        { label: 'Combustível', data: fuelData },
        { label: 'Líquido', data: netData }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#f9fafb' } } },
      scales: {
        x: { ticks: { color: '#f9fafb' }, grid: { color: 'rgba(255,255,255,0.08)' } },
        y: { ticks: { color: '#f9fafb', callback: (v) => 'R$ ' + v }, grid: { color: 'rgba(255,255,255,0.08)' } }
      }
    }
  });
}

function renderHistory(list) {
  els.historyEmpty.classList.toggle('hidden', list.length > 0);
  els.historyList.innerHTML = '';
  for (const entry of list) {
    const card = document.createElement('article');
    card.className = 'history-item';
    card.innerHTML = `
      <div class="history-head">
        <div>
          <h3 class="history-title">${formatDate(entry.work_date)}</h3>
          <div class="history-sub">${shortTime(entry.start_time)} até ${shortTime(entry.end_time)} · ${formatDuration(entry.drive_seconds * 1000)}</div>
        </div>
        <div class="row wrap">
          <button type="button" class="secondary edit-btn">Editar</button>
        </div>
      </div>
      <div class="history-metrics">
        <div class="mini"><span>Bruto</span><strong>${money(entry.gross_amount)}</strong></div>
        <div class="mini"><span>Combustível</span><strong>${money(entry.fuel_amount)}</strong></div>
        <div class="mini"><span>Líquido</span><strong>${money(entry.gross_amount - entry.fuel_amount)}</strong></div>
        <div class="mini"><span>Corridas</span><strong>${entry.ride_count}</strong></div>
      </div>
      <div class="history-sub" style="margin-top:10px;">KM ${entry.start_km.toFixed(1)} → ${entry.end_km.toFixed(1)} · ${entry.refueled ? 'Abasteceu' : 'Não abasteceu'}${entry.notes ? ' · ' + escapeHtml(entry.notes) : ''}</div>
    `;
    card.querySelector('.edit-btn').addEventListener('click', () => openEditDialog(entry.id));
    els.historyList.appendChild(card);
  }
}

function openEditDialog(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  els.editId.value = entry.id;
  els.editDate.value = entry.work_date;
  els.editStartTime.value = isoToTime(entry.start_time);
  els.editEndTime.value = isoToTime(entry.end_time);
  els.editDriveTime.value = secondsToHms(entry.drive_seconds);
  els.editStartKm.value = entry.start_km;
  els.editEndKm.value = entry.end_km;
  els.editGross.value = entry.gross_amount;
  els.editFuel.value = entry.fuel_amount;
  els.editRides.value = entry.ride_count;
  els.editRefueled.checked = entry.refueled;
  els.editNotes.value = entry.notes;
  els.editDialog.showModal();
}

async function saveEdit(event) {
  event.preventDefault();
  const id = els.editId.value;
  const driveSeconds = hmsToSeconds(els.editDriveTime.value.trim());
  if (driveSeconds == null) return alert('Tempo ao volante inválido. Use hh:mm:ss');
  const updated = {
    work_date: els.editDate.value,
    start_time: combineDateTime(els.editDate.value, els.editStartTime.value),
    end_time: combineDateTime(els.editDate.value, els.editEndTime.value),
    drive_seconds: driveSeconds,
    start_km: Number(els.editStartKm.value),
    end_km: Number(els.editEndKm.value),
    gross_amount: Number(els.editGross.value),
    fuel_amount: Number(els.editFuel.value),
    ride_count: Number(els.editRides.value),
    refueled: els.editRefueled.checked,
    notes: els.editNotes.value.trim(),
    updated_at: new Date().toISOString()
  };

  if (updated.end_km < updated.start_km) return alert('O KM final não pode ser menor que o inicial.');

  if (supabase && currentUser) {
    const { data, error } = await supabase.from('work_days').update(updated).eq('id', id).select().single();
    if (error) return alert(error.message);
    entries = entries.map((entry) => entry.id === id ? normalizeEntry(data) : entry);
  } else {
    entries = entries.map((entry) => entry.id === id ? normalizeEntry({ ...entry, ...updated }) : entry);
    persistLocalEntries();
  }
  els.editDialog.close();
  refreshDashboard();
}

async function deleteEntry() {
  const id = els.editId.value;
  if (!id) return;
  if (!confirm('Excluir este dia?')) return;

  if (supabase && currentUser) {
    const { error } = await supabase.from('work_days').delete().eq('id', id);
    if (error) return alert(error.message);
  }
  entries = entries.filter((entry) => entry.id !== id);
  if (!supabase || !currentUser) persistLocalEntries();
  els.editDialog.close();
  refreshDashboard();
}

async function syncEntries() {
  if (!supabase || !currentUser) return alert('Entre com sua conta para sincronizar.');
  const local = loadLocalEntries();
  if (!local.length) {
    await loadEntries();
    alert('Sincronização concluída.');
    return;
  }
  const payload = local.map((entry) => ({ ...entry, user_id: currentUser.id }));
  const { error } = await supabase.from('work_days').upsert(payload, { onConflict: 'id' });
  if (error) return alert(error.message);
  persistLocalEntries([]);
  await loadEntries();
  alert('Dados locais enviados para a nuvem.');
}

function exportJson() {
  const payload = {
    exported_at: new Date().toISOString(),
    entries,
    active_session: activeSession
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `motorista-pro-backup-${todayString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const importedEntries = Array.isArray(parsed.entries) ? parsed.entries.map(normalizeEntry) : [];
      entries = dedupeById([...importedEntries, ...entries]);
      if (!supabase || !currentUser) persistLocalEntries();
      if (parsed.active_session) {
        activeSession = parsed.active_session;
        saveJSON(STORAGE_KEYS.activeSession, activeSession);
        renderSession();
      }
      refreshDashboard();
      alert('Importação concluída.');
    } catch {
      alert('Arquivo JSON inválido.');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function loadLocalEntries() {
  return loadJSON(STORAGE_KEYS.localEntries, []).map(normalizeEntry);
}

function persistLocalEntries(next = entries) {
  saveJSON(STORAGE_KEYS.localEntries, next);
}

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function dedupeById(list) {
  const map = new Map();
  for (const item of list) map.set(item.id, item);
  return [...map.values()].sort((a, b) => b.work_date.localeCompare(a.work_date));
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function sum(list, key) {
  return list.reduce((acc, item) => acc + Number(item[key] || 0), 0);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  return secondsToHms(totalSeconds);
}

function secondsToHms(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function hmsToSeconds(value) {
  const match = /^(\d{1,3}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, hh, mm, ss] = match;
  if (Number(mm) > 59 || Number(ss) > 59) return null;
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
}

function formatHoursMinutes(totalSeconds) {
  const seconds = Math.floor(totalSeconds || 0);
  const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDate(date) {
  return new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function shortTime(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function isoToTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function combineDateTime(date, time) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
