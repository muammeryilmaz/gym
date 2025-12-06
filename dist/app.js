const state = {
  instructors: [],
  clients: [],
  bookings: [],
  occurrences: [],
  selectedBooking: null,
  selectedOccurrence: null,
};

const todayEl = document.getElementById('today');
const scheduleGrid = document.getElementById('schedule-grid');

const instructorFirst = document.getElementById('instructor-first');
const instructorLast = document.getElementById('instructor-last');
const addInstructorBtn = document.getElementById('add-instructor');

const clientInstructor = document.getElementById('client-instructor');
const clientFirst = document.getElementById('client-first');
const clientLast = document.getElementById('client-last');
const addClientBtn = document.getElementById('add-client');
const manageClientSelect = document.getElementById('manage-client');
const manageClientInfo = document.getElementById('manage-client-info');
const manageClientInstructor = document.getElementById('manage-client-instructor');
const changeClientInstructorBtn = document.getElementById('change-client-instructor');
const deleteClientBtn = document.getElementById('delete-client');

const bookingInstructor = document.getElementById('booking-instructor');
const bookingClient = document.getElementById('booking-client');
const bookingMethod = document.getElementById('booking-method');
const bookingTime = document.getElementById('booking-time');
const bookingDate = document.getElementById('booking-date');
const bookingDay = document.getElementById('booking-day');
const weeklyFields = document.getElementById('weekly-fields');
const monthlyFields = document.getElementById('monthly-fields');
const onceFields = document.getElementById('once-fields');
const dayGrid = document.getElementById('day-grid');
const createBookingBtn = document.getElementById('create-booking');

const editModal = document.getElementById('edit-modal');
const editMeta = document.getElementById('edit-meta');
const editMethod = document.getElementById('edit-method');
const editTime = document.getElementById('edit-time');
const editDay = document.getElementById('edit-day');
const editWeeklyFields = document.getElementById('edit-weekly-fields');
const editMonthlyFields = document.getElementById('edit-monthly-fields');
const editOnceFields = document.getElementById('edit-once-fields');
const editDayGrid = document.getElementById('edit-day-grid');
const editDate = document.getElementById('edit-date');
const scopeSingle = document.getElementById('scope-single');
const scopeAll = document.getElementById('scope-all');
const deleteBookingBtn = document.getElementById('delete-booking');
const saveBookingBtn = document.getElementById('save-booking');
const closeModalBtn = document.getElementById('close-modal');

function formatDate(iso) {
  const date = new Date(iso);
  return date.toLocaleString('tr-TR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dateKey(iso) {
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function setToday() {
  const now = new Date();
  todayEl.textContent = now.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'İşlem başarısız');
  }
  return res.json();
}

async function loadAll() {
  const data = await api('/api/all');
  Object.assign(state, data);
  renderInstructors();
  populateSelects();
}

function populateSelects() {
  const instructorOptions = ['<option value="">Hoca seç</option>'];
  state.instructors.forEach((i) => {
    instructorOptions.push(`<option value="${i.id}">${i.firstName} ${i.lastName}</option>`);
  });
  clientInstructor.innerHTML = instructorOptions.join('');
  bookingInstructor.innerHTML = instructorOptions.join('');
  manageClientInstructor.innerHTML = instructorOptions.join('');

  // Varsayılan olarak ilk hocayı seç ve danışan listesini doldur.
  if (state.instructors.length) {
    bookingInstructor.value = bookingInstructor.value || state.instructors[0].id;
    clientInstructor.value = clientInstructor.value || state.instructors[0].id;
    manageClientInstructor.value = manageClientInstructor.value || state.instructors[0].id;
  }
  updateClientSelect();
  populateClientManagement();
}

function updateClientSelect() {
  const instructorId = bookingInstructor.value;
  const clients = state.clients.filter((c) => c.instructorId === instructorId);
  if (!clients.length) {
    bookingClient.innerHTML = '<option value="">Önce danışan ekle</option>';
    return;
  }
  bookingClient.innerHTML = clients
    .map((c) => `<option value="${c.id}">${c.firstName} ${c.lastName}</option>`)
    .join('');
}

function populateClientManagement() {
  const sorted = [...state.clients].sort((a, b) => {
    const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
    const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
    return nameA.localeCompare(nameB, 'tr');
  });
  manageClientSelect.innerHTML = sorted
    .map((c) => `<option value="${c.id}">${c.firstName} ${c.lastName}</option>`)
    .join('');
  updateManageClientInfo();
}

function updateManageClientInfo() {
  const clientId = manageClientSelect.value;
  const client = state.clients.find((c) => c.id === clientId);
  if (!client) {
    manageClientInfo.textContent = 'Danışan seçin';
    manageClientInstructor.value = '';
    return;
  }
  const instructor = state.instructors.find((i) => i.id === client.instructorId);
  manageClientInfo.textContent = instructor
    ? `Şu anki hoca: ${instructor.firstName} ${instructor.lastName}`
    : 'Hoca bilgisi bulunamadı';
  manageClientInstructor.value = client.instructorId;
}

function buildDayGrid(container) {
  container.innerHTML = '';
  for (let d = 1; d <= 31; d++) {
    const pill = document.createElement('div');
    pill.className = 'day-pill';
    pill.textContent = d;
    pill.dataset.value = d;
    pill.addEventListener('click', () => pill.classList.toggle('active'));
    container.appendChild(pill);
  }
}

function buildTimeOptions() {
  const list = document.getElementById('time-options');
  const options = [];
  for (let h = 0; h < 24; h++) {
    ['00', '15', '30', '45'].forEach((m) => {
      const hour = h.toString().padStart(2, '0');
      options.push(`<option value="${hour}:${m}"></option>`);
    });
  }
  list.innerHTML = options.join('');
}

function getSelectedDays(container) {
  return Array.from(container.querySelectorAll('.day-pill.active')).map((el) => el.dataset.value);
}

function setSelectedDays(container, days) {
  Array.from(container.children).forEach((el) => {
    const val = Number(el.dataset.value);
    el.classList.toggle('active', days.includes(val));
  });
}

function renderInstructors() {
  scheduleGrid.innerHTML = '';
  if (!state.instructors.length) {
    scheduleGrid.innerHTML = '<div class="badge">Henüz hoca yok</div>';
    return;
  }

  const occurrencesByInstructor = state.instructors.map((inst) => {
    const items = state.occurrences.filter((o) => o.instructorId === inst.id);
    return { instructor: inst, items };
  });

  occurrencesByInstructor.sort((a, b) => {
    const firstA = a.items[0]?.dateTime || '9999';
    const firstB = b.items[0]?.dateTime || '9999';
    return new Date(firstA) - new Date(firstB);
  });

  occurrencesByInstructor.forEach(({ instructor, items }) => {
    const card = document.createElement('div');
    card.className = 'instructor-card';

    const header = document.createElement('div');
    header.className = 'instructor-header';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = `${instructor.firstName} ${instructor.lastName}`;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Hoca Sil';
    removeBtn.addEventListener('click', () => deleteInstructor(instructor.id));

    header.appendChild(name);
    header.appendChild(removeBtn);
    card.appendChild(header);

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'helper';
      empty.textContent = 'Önümüzdeki 1 ayda randevu yok';
      card.appendChild(empty);
    }

    items.forEach((occ) => {
      const item = document.createElement('div');
      item.className = 'appointment';
      item.dataset.bookingId = occ.bookingId;
      item.innerHTML = `<div class="who">${occ.clientName}</div><div class="when">${formatDate(occ.dateTime)}</div>`;
      item.addEventListener('click', () => openEditModal(occ));
      card.appendChild(item);
    });

    scheduleGrid.appendChild(card);
  });
}

async function deleteInstructor(id) {
  if (!confirm('Hocayı silmek istediğinize emin misiniz? Danışan ve randevuları da silinir.')) return;
  await api(`/api/instructors/${id}`, { method: 'DELETE' });
  await loadAll();
}

addInstructorBtn.addEventListener('click', async () => {
  const firstName = instructorFirst.value.trim();
  const lastName = instructorLast.value.trim();
  if (!firstName || !lastName) return alert('Ad ve soyad gerekli');
  await api('/api/instructors', {
    method: 'POST',
    body: JSON.stringify({ firstName, lastName }),
  });
  instructorFirst.value = '';
  instructorLast.value = '';
  await loadAll();
});

addClientBtn.addEventListener('click', async () => {
  const instructorId = clientInstructor.value;
  if (!instructorId) return alert('Önce hoca seçin');
  const firstName = clientFirst.value.trim();
  const lastName = clientLast.value.trim();
  if (!firstName || !lastName) return alert('Ad ve soyad gerekli');
  await api('/api/clients', {
    method: 'POST',
    body: JSON.stringify({ instructorId, firstName, lastName }),
  });
  clientFirst.value = '';
  clientLast.value = '';
  await loadAll();
});

changeClientInstructorBtn.addEventListener('click', async () => {
  const clientId = manageClientSelect.value;
  const instructorId = manageClientInstructor.value;
  if (!clientId || !instructorId) return alert('Danışan ve hoca seçin');
  await api(`/api/clients/${clientId}`, {
    method: 'PUT',
    body: JSON.stringify({ instructorId }),
  });
  await loadAll();
});

deleteClientBtn.addEventListener('click', async () => {
  const clientId = manageClientSelect.value;
  if (!clientId) return alert('Danışan seçin');
  if (!confirm('Danışanı ve randevularını silmek istiyor musunuz?')) return;
  await api(`/api/clients/${clientId}`, { method: 'DELETE' });
  await loadAll();
});

bookingInstructor.addEventListener('change', updateClientSelect);
bookingMethod.addEventListener('change', () => toggleMethodFields(bookingMethod.value));
manageClientSelect.addEventListener('change', updateManageClientInfo);

function toggleMethodFields(method, prefix = 'create', scope = 'all') {
  const showWeekly = method === 'weekly' && scope === 'all';
  const showMonthly = method === 'monthly' && scope === 'all';
  const showOnce = method === 'once' || scope === 'single';
  const weekly = prefix === 'create' ? weeklyFields : editWeeklyFields;
  const monthly = prefix === 'create' ? monthlyFields : editMonthlyFields;
  const once = prefix === 'create' ? onceFields : editOnceFields;

  weekly.style.display = showWeekly ? 'block' : 'none';
  monthly.style.display = showMonthly ? 'block' : 'none';
  once.style.display = showOnce ? 'block' : 'none';
}

function getEditScope() {
  return scopeSingle.checked ? 'single' : 'all';
}

function updateEditVisibility() {
  const scope = getEditScope();
  toggleMethodFields(editMethod.value, 'edit', scope);
  const disablePatternInputs = scope === 'single';
  editMethod.disabled = scope === 'single';
  editDay.disabled = disablePatternInputs;
  Array.from(editDayGrid.querySelectorAll('.day-pill')).forEach((el) => {
    el.style.pointerEvents = disablePatternInputs ? 'none' : 'auto';
    el.style.opacity = disablePatternInputs ? '0.5' : '1';
  });
}

createBookingBtn.addEventListener('click', async () => {
  const instructorId = bookingInstructor.value;
  const clientId = bookingClient.value;
  const method = bookingMethod.value;
  const time = bookingTime.value;
  if (!instructorId || !clientId || !time) return alert('Tüm alanları doldurun');
  const payload = { instructorId, clientId, method, time };
  if (method === 'weekly') {
    payload.dayOfWeek = bookingDay.value;
  } else if (method === 'monthly') {
    const days = getSelectedDays(dayGrid);
    if (!days.length) return alert('En az bir gün seçin');
    payload.daysOfMonth = days.join(';');
  } else {
    if (!bookingDate.value) return alert('Tarih seçin');
    payload.date = bookingDate.value;
  }
  await api('/api/bookings', { method: 'POST', body: JSON.stringify(payload) });
  bookingTime.value = '';
  setSelectedDays(dayGrid, []);
  bookingDate.value = '';
  await loadAll();
});

function openEditModal(occurrence) {
  state.selectedBooking = state.bookings.find((b) => b.id === occurrence.bookingId);
  state.selectedOccurrence = occurrence;
  if (!state.selectedBooking) return;
  editMeta.textContent = `${occurrence.clientName} · ${occurrence.instructorName}`;
  editMethod.value = state.selectedBooking.method;
  editTime.value = state.selectedBooking.time;
  editDate.value =
    state.selectedBooking.method === 'once'
      ? state.selectedBooking.date || dateKey(occurrence.dateTime)
      : dateKey(occurrence.dateTime);
  scopeAll.checked = true;
  scopeSingle.checked = false;
  if (state.selectedBooking.method === 'weekly') {
    editDay.value = state.selectedBooking.dayOfWeek;
    toggleMethodFields('weekly', 'edit', getEditScope());
  } else {
    const days = (state.selectedBooking.daysOfMonth || '')
      .split(';')
      .map((d) => Number(d))
      .filter(Boolean);
    setSelectedDays(editDayGrid, days);
    toggleMethodFields(state.selectedBooking.method, 'edit', getEditScope());
  }
  if (state.selectedBooking.method === 'once') {
    scopeSingle.checked = true;
  }
  updateEditVisibility();
  editModal.classList.add('active');
}

function closeModal() {
  editModal.classList.remove('active');
  state.selectedBooking = null;
  state.selectedOccurrence = null;
}

closeModalBtn.addEventListener('click', closeModal);
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeModal();
});
editMethod.addEventListener('change', () => updateEditVisibility());
scopeSingle.addEventListener('change', () => updateEditVisibility());
scopeAll.addEventListener('change', () => updateEditVisibility());

saveBookingBtn.addEventListener('click', async () => {
  if (!state.selectedBooking) return;
  const scope = getEditScope();
  const method = editMethod.value;
  const time = editTime.value;
  if (!time) return alert('Saat gerekli');
  const payload = { method, time, scope };
  if (method === 'once' || scope === 'single') {
    if (!editDate.value) return alert('Tarih gerekli');
    payload.date = editDate.value;
    payload.occurrenceDate = state.selectedOccurrence ? dateKey(state.selectedOccurrence.dateTime) : editDate.value;
  } else if (method === 'weekly') {
    payload.dayOfWeek = editDay.value;
  } else {
    const days = getSelectedDays(editDayGrid);
    if (!days.length) return alert('En az bir gün seçin');
    payload.daysOfMonth = days.join(';');
  }
  await api(`/api/bookings/${state.selectedBooking.id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  closeModal();
  await loadAll();
});

deleteBookingBtn.addEventListener('click', async () => {
  if (!state.selectedBooking) return;
  if (!confirm('Randevuyu silmek istiyor musunuz?')) return;
  const scope = getEditScope();
  const payload =
    scope === 'single' && state.selectedOccurrence
      ? { scope, occurrenceDate: dateKey(state.selectedOccurrence.dateTime) }
      : { scope };
  await api(`/api/bookings/${state.selectedBooking.id}`, { method: 'DELETE', body: JSON.stringify(payload) });
  closeModal();
  await loadAll();
});

function init() {
  setToday();
  buildDayGrid(dayGrid);
  buildDayGrid(editDayGrid);
  buildTimeOptions();
  loadAll().catch((err) => alert(err.message));
}

init();
