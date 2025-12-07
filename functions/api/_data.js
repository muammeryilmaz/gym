const KV_KEYS = {
  instructors: 'instructors',
  clients: 'clients',
  bookings: 'bookings',
};

export function normalizeName(value = '') {
  return value.trim().replace(/\s+/g, ' ');
}

export function generateId() {
  return crypto.randomUUID();
}

function dateKeyFromDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function normalizeDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date)) return String(value);
  return dateKeyFromDate(date);
}

export function buildExclusionSet(booking) {
  return new Set(
    (booking.exclusions || '')
      .split(';')
      .map((d) => normalizeDateKey(d.trim()))
      .filter(Boolean),
  );
}

async function readTable(env, key) {
  const raw = await env.DATA.get(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

async function writeTable(env, key, rows) {
  await env.DATA.put(key, JSON.stringify(rows ?? []));
}

export async function loadData(env) {
  const [instructors, clients, bookings] = await Promise.all([
    readTable(env, KV_KEYS.instructors),
    readTable(env, KV_KEYS.clients),
    readTable(env, KV_KEYS.bookings),
  ]);
  return { instructors, clients, bookings };
}

export async function persistData(env, { instructors, clients, bookings }) {
  await Promise.all([
    writeTable(env, KV_KEYS.instructors, instructors),
    writeTable(env, KV_KEYS.clients, clients),
    writeTable(env, KV_KEYS.bookings, bookings),
  ]);
}

export function generateOccurrences({ bookings, clients, instructors }, daysAhead = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + daysAhead);

  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const instructorMap = new Map(instructors.map((i) => [i.id, i]));
  const occurrences = [];

  for (const booking of bookings) {
    const client = clientMap.get(booking.clientId);
    const instructor = instructorMap.get(booking.instructorId);
    if (!client || !instructor) continue;

    const timeParts = String(booking.time || '').split(':');
    const hours = Number(timeParts[0]);
    const minutes = Number(timeParts[1] || 0);
    const exclusions = buildExclusionSet(booking);

    if (Number.isNaN(hours)) continue;

    if (booking.method === 'weekly') {
      const targetDay = Number(booking.dayOfWeek);
      for (let i = 0; i <= daysAhead; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        if (date.getDay() !== targetDay) continue;
        const dateKey = dateKeyFromDate(date);
        if (exclusions.has(dateKey)) continue;
        date.setHours(hours, minutes, 0, 0);
        if (date >= today && date <= endDate) {
          occurrences.push({
            id: `${booking.id}-${date.toISOString()}`,
            bookingId: booking.id,
            instructorId: booking.instructorId,
            clientId: booking.clientId,
            instructorName: `${instructor.firstName} ${instructor.lastName}`.trim(),
            clientName: `${client.firstName} ${client.lastName}`.trim(),
            dateTime: date.toISOString(),
            method: 'weekly',
          });
        }
      }
    } else if (booking.method === 'monthly') {
      const days = String(booking.daysOfMonth || '')
        .split(';')
        .map((d) => Number(d))
        .filter((d) => !Number.isNaN(d) && d >= 1 && d <= 31);
      const uniqueDays = Array.from(new Set(days));
      for (let i = 0; i <= daysAhead; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        if (!uniqueDays.includes(date.getDate())) continue;
        const dateKey = dateKeyFromDate(date);
        if (exclusions.has(dateKey)) continue;
        date.setHours(hours, minutes, 0, 0);
        if (date >= today && date <= endDate) {
          occurrences.push({
            id: `${booking.id}-${date.toISOString()}`,
            bookingId: booking.id,
            instructorId: booking.instructorId,
            clientId: booking.clientId,
            instructorName: `${instructor.firstName} ${instructor.lastName}`.trim(),
            clientName: `${client.firstName} ${client.lastName}`.trim(),
            dateTime: date.toISOString(),
            method: 'monthly',
          });
        }
      }
    } else if (booking.method === 'once') {
      if (!booking.date) continue;
      const date = new Date(booking.date);
      const dateKey = dateKeyFromDate(date);
      if (exclusions.has(dateKey)) continue;
      date.setHours(hours, minutes, 0, 0);
      if (date >= today && date <= endDate) {
        occurrences.push({
          id: `${booking.id}-${date.toISOString()}`,
          bookingId: booking.id,
          instructorId: booking.instructorId,
          clientId: booking.clientId,
          instructorName: `${instructor.firstName} ${instructor.lastName}`.trim(),
          clientName: `${client.firstName} ${client.lastName}`.trim(),
          dateTime: date.toISOString(),
          method: 'once',
        });
      }
    }
  }

  occurrences.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  return occurrences;
}
