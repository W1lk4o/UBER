import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const STORAGE_KEYS = {
  supabaseUrl: 'uber_supabase_url',
  supabaseAnonKey: 'uber_supabase_anon_key',
  session: 'uber_active_session'
};

let supabase = null;
let currentUser = null;
let entries = [];
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
  endKm: $('endKm'), grossAmount: $('grossAmount'), fuelAmount: $('fuelAmount'), rideCount: $('rideCount'), refueled: $('refueled'), notes: $('notes'),
  periodType: $('periodType'), fromDate: $('fromDate'), toDate: $('toDate'), customRange: $('customRange'),
  grossTotal: $('grossTotal'), fuelTotal: $('fuelTotal'), netTotal: $('netTotal'), hoursTotal: $('hoursTotal'), chartCanvas: $('chart'),
  historyList: $('historyList'), historyEmpty: $('historyEmpty'),
  editDialog: $('editDialog'), closeEditDialog: $('closeEditDialog'), editForm: $('editForm'), deleteEntryBtn: $('deleteEntryBtn'),
  editId: $('editId'), editDate: $('editDate'), editStartTime: $('editStartTime'), editEndTime: $('editEndTime'), editDriveTime: $('editDriveTime'), editStartKm: $('editStartKm'), editEndKm: $('editEndKm'), editGross: $('editGross'), editFuel: $('editFuel'), editRides: $('editRides'), editRefueled: $('editRefueled'), editNotes: $('editNotes'),
  exportBtn: $('exportBtn'), importInput: $('importInput'), syncBtn: $('syncBtn'),
  settingsDialog: $('settingsDialog'), closeSettingsDialog: $('closeSettingsDialog'), settingsForm: $('settingsForm'), supabaseUrlInput: $('supabaseUrlInput'), supabaseAnonKeyInput: $('supabaseAnonKeyInput')
};

function boot() {
  setToday();
  bindEvents();
  restoreSupabaseClient();
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

  els.periodType.addEventListener('change', refreshDashboard);
  els.fromDate.addEventListener('change', refreshDashboard);
  els.toDate.addEventListener('change', refreshDashboard);

  els.closeEditDialog.addEventListener('click', () => els.editDialog.close());
  els.editForm.addEventListener('submit', saveEdit);
  els.deleteEntryBtn.addEventListener('click', deleteEntry);

  els.exportBtn.addEventListener('click', exportJson);
  els.importInput.addEventListener('change', importJson);
  els.syncBtn.addEventListener('click', syncEntries);
}

function restoreSupabaseClient() {
  const url = localStorage.getItem(STORAGE_KEYS.supabaseUrl) || '';
  const key = localStorage.getItem(STORAGE_KEYS.supabaseAnonKey) || '';
  els.supabaseUrlInput.value = url;
  els.supabaseAnonKeyInput.value = key;
  if (!url || !key) {
    renderAuthState();
    return;
  }
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
    else { entries = []; refreshDashboard(); }
  });
}

function renderAuthState() {
  const hasConfig = !!supabase;
  els.setupWarning.classList.toggle('hidden', hasConfig);
  els.authCard.classList.toggle('hidden', !hasConfig || !!currentUser);
  els.appContent.classList.toggle('hidden', !currentUser);
  els.logoutBtn.classList.toggle('hidden', !currentUser);
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
}

function loadActiveSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || 'null'); }
  catch { return null; }
}
function persistActiveSession() {
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(activeSession));
}

function startDay(event) {
  event.preventDefault();
  if (activeSession) return alert('Já existe um dia em andamento.');
  activeSession = {
    date: els.workDate.value,
    startKm: Number(els.startKm.value),
    startAt: new Date().toISOString(),
    elapsedMs: 0,
    pauseStartedAt: null,
    status: 'running'
  };
  persistActiveSession();
  renderSession();
}

function pauseSession() {
  if (!activeSession || activeSession.status !== 'running') return;
  activeSession.status = 'paused';
  activeSession.pauseStartedAt = new Date().toISOString();
  activeSession.elapsedMs = getElapsedMs();
  persistActiveSession();
  renderSession();
}

function resumeSession() {
  if (!activeSession || activeSession.status !== 'paused') return;
  const pausedFor = Date.now() - new Date(activeSession.pauseStartedAt).getTime();
  activeSession.startAt = new Date(new Date(activeSession.startAt).getTime() + pausedFor).toISOString();
  activeSession.pauseStartedAt = null;
  activeSession.status = 'running';
  persistActiveSession();
  renderSession();
}

function getElapsedMs() {
  if (!activeSession) return 0;
  if (activeSession.status === 'paused') return activeSession.elapsedMs || 0;
  return Date.now() - new Date(activeSession.startAt).getTime();
}

function renderSession() {
  clearInterval(timerInterval);
  const active = !!activeSession;
  els.sessionPanel.classList.toggle('hidden', !active);
  els.todayStatus.textContent = active ? (activeSession.status === 'running' ? 'Rodando' : 'Pausado') : 'Sem corrida ativa';
  if (!active) return;
  els.startAtText.textContent = new Date(activeSession.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
  els.rideCount.value = '0';
  els.refueled.checked = false;
  els.notes.value = '';
  els.finishDialog.showModal();
}

async function finishDay(event) {
  event.preventDefault();
  if (!currentUser || !supabase || !activeSession) return;
  const endAt = new Date();
  const entry = {
    user_id: currentUser.id,
    work_date: activeSession.date,
    start_time: new Date(activeSession.startAt).toISOString(),
    end_time: endAt.toISOString(),
    drive_seconds: Math.floor(getElapsedMs() / 1000),
    start_km: Number(activeSession.startKm),
    end_km: Number(els.endKm.value),
    gross_amount: Number(els.grossAmount.value),
    fuel_amount: Number(els.fuelAmount.value),
    ride_count: Number(els.rideCount.value),
    refueled: els.refueled.checked,
    notes: els.notes.value.trim()
  };
  const { error } = await supabase.from('work_days').insert(entry);
  if (error) return alert('Erro ao salvar no Supabase: ' + error.message);
  activeSession = null;
  persistActiveSession();
  els.finishDialog.close();
  await loadEntries();
  renderSession();
}

async function loadEntries() {
  const { data, error } = await supabase.from('work_days').select('*').order('work_date', { ascending: false }).order('start_time', { ascending: false });
  if (error) return alert('Erro ao carregar dias: ' + error.message);
  entries = data || [];
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
  const secs = filtered.reduce((sum, item) => sum + Number(item.drive_seconds || 0), 0);
  els.grossTotal.textContent = money(gross);
  els.fuelTotal.textContent = money(fuel);
  els.netTotal.textContent = money(gross - fuel);
  els.hoursTotal.textContent = formatHoursMinutes(secs);
  renderChart(filtered);
  renderHistory();
}

function renderChart(filtered) {
  const grouped = [...filtered].sort((a,b) => a.work_date.localeCompare(b.work_date));
  const labels = grouped.map(item => formatDate(item.work_date));
  const grossData = grouped.map(item => Number(item.gross_amount || 0));
  const fuelData = grouped.map(item => Number(item.fuel_amount || 0));
  const netData = grouped.map(item => Number(item.gross_amount || 0) - Number(item.fuel_amount || 0));
  if (chart) chart.destroy();
  chart = new Chart(els.chartCanvas, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Bruto', data: grossData },
      { label: 'Combustível', data: fuelData },
      { label: 'Líquido', data: netData }
    ]},
    options: { responsive: true, maintainAspectRatio: false }
  });
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
        <div class="row wrap">
          <button class="secondary" data-edit="${item.id}">Editar</button>
        </div>
      </div>
      <div class="history-stats">
        <div class="history-stat">Bruto<br><strong>${money(item.gross_amount)}</strong></div>
        <div class="history-stat">Combustível<br><strong>${money(item.fuel_amount)}</strong></div>
        <div class="history-stat">Líquido<br><strong>${money(Number(item.gross_amount)-Number(item.fuel_amount))}</strong></div>
        <div class="history-stat">Tempo<br><strong>${formatDuration(Number(item.drive_seconds||0)*1000)}</strong></div>
      </div>
      <div class="history-stats">
        <div class="history-stat">KM<br><strong>${Number(item.end_km) - Number(item.start_km)} km</strong></div>
        <div class="history-stat">Corridas<br><strong>${item.ride_count}</strong></div>
        <div class="history-stat">Abasteceu<br><strong>${item.refueled ? 'Sim' : 'Não'}</strong></div>
        <div class="history-stat">Obs.<br><strong>${escapeHtml(item.notes || '-')}</strong></div>
      </div>`;
    div.querySelector('[data-edit]').addEventListener('click', () => openEdit(item.id));
    els.historyList.appendChild(div);
  }
}

function openEdit(id) {
  const item = entries.find(x => x.id === id);
  if (!item) return;
  els.editId.value = item.id;
  els.editDate.value = item.work_date;
  els.editStartTime.value = timeInputValue(item.start_time);
  els.editEndTime.value = timeInputValue(item.end_time);
  els.editDriveTime.value = secondsToHms(item.drive_seconds || 0);
  els.editStartKm.value = item.start_km;
  els.editEndKm.value = item.end_km;
  els.editGross.value = item.gross_amount;
  els.editFuel.value = item.fuel_amount;
  els.editRides.value = item.ride_count;
  els.editRefueled.checked = !!item.refueled;
  els.editNotes.value = item.notes || '';
  els.editDialog.showModal();
}

async function saveEdit(event) {
  event.preventDefault();
  const id = els.editId.value;
  const payload = {
    work_date: els.editDate.value,
    start_time: combineDateAndTime(els.editDate.value, els.editStartTime.value),
    end_time: combineDateAndTime(els.editDate.value, els.editEndTime.value),
    drive_seconds: hmsToSeconds(els.editDriveTime.value),
    start_km: Number(els.editStartKm.value),
    end_km: Number(els.editEndKm.value),
    gross_amount: Number(els.editGross.value),
    fuel_amount: Number(els.editFuel.value),
    ride_count: Number(els.editRides.value),
    refueled: els.editRefueled.checked,
    notes: els.editNotes.value.trim()
  };
  const { error } = await supabase.from('work_days').update(payload).eq('id', id);
  if (error) return alert('Erro ao atualizar: ' + error.message);
  els.editDialog.close();
  await loadEntries();
}

async function deleteEntry() {
  const id = els.editId.value;
  if (!confirm('Excluir este dia?')) return;
  const { error } = await supabase.from('work_days').delete().eq('id', id);
  if (error) return alert('Erro ao excluir: ' + error.message);
  els.editDialog.close();
  await loadEntries();
}

async function syncEntries() { if (currentUser) await loadEntries(); }

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
    const payload = parsed.map(item => ({
      user_id: currentUser.id,
      work_date: item.work_date,
      start_time: item.start_time,
      end_time: item.end_time,
      drive_seconds: Number(item.drive_seconds || 0),
      start_km: Number(item.start_km || 0),
      end_km: Number(item.end_km || 0),
      gross_amount: Number(item.gross_amount || 0),
      fuel_amount: Number(item.fuel_amount || 0),
      ride_count: Number(item.ride_count || 0),
      refueled: !!item.refueled,
      notes: item.notes || ''
    }));
    const { error } = await supabase.from('work_days').insert(payload);
    if (error) throw error;
    alert('Importação concluída.');
    await loadEntries();
  } catch (err) {
    alert('Erro ao importar: ' + err.message);
  } finally {
    event.target.value = '';
  }
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
function escapeHtml(text) {
  const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return String(text).replace(/[&<>"']/g, c => map[c]);
}

boot();
