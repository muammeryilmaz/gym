export default {
  async fetch(request, env) {
    await ensureSchema(env);
    const url = new URL(request.url);
    const { pathname } = url;
    try {
      const method = request.method.toUpperCase();
      const path = pathname.replace(/^\/api\/?/, '');

      if (path === 'all' && method === 'GET') {
        const data = await loadData(env);
        const occurrences = generateOccurrences(data);
        return json({ ...data, occurrences });
      }

      if (path === 'occurrences' && method === 'GET') {
        const data = await loadData(env);
        const occurrences = generateOccurrences(data);
        return json({ occurrences });
      }

      if (path === 'instructors' && method === 'POST') {
        const body = await readJson(request);
        const firstName = normalizeName(body.firstName);
        const lastName = normalizeName(body.lastName);
        if (!firstName || !lastName) return error('Isim ve soyisim gerekli', 400);
        const id = crypto.randomUUID();
        await env.DB.prepare(
          'INSERT INTO instructors (id, firstName, lastName) VALUES (?1, ?2, ?3)',
        )
          .bind(id, firstName, lastName)
          .run();
        return json({ id, firstName, lastName });
      }

      const instructorMatch = path.match(/^instructors\/(.+)$/);
      if (instructorMatch && method === 'DELETE') {
        const instructorId = instructorMatch[1];
        await env.DB.batch([
          env.DB.prepare('DELETE FROM bookings WHERE instructorId=?1').bind(instructorId),
          env.DB.prepare('DELETE FROM clients WHERE instructorId=?1').bind(instructorId),
          env.DB.prepare('DELETE FROM instructors WHERE id=?1').bind(instructorId),
        ]);
        return json({ success: true });
      }

      if (path === 'clients' && method === 'POST') {
        const body = await readJson(request);
        const instructorId = body.instructorId;
        const firstName = normalizeName(body.firstName);
        const lastName = normalizeName(body.lastName);
        if (!instructorId || !firstName || !lastName) return error('Hoca ve isim bilgileri gerekli', 400);
        const instructor = await env.DB.prepare('SELECT id FROM instructors WHERE id=?1')
          .bind(instructorId)
          .first();
        if (!instructor) return error('Hoca bulunamadi', 404);
        const id = crypto.randomUUID();
        await env.DB.prepare(
          'INSERT INTO clients (id, instructorId, firstName, lastName) VALUES (?1, ?2, ?3, ?4)',
        )
          .bind(id, instructorId, firstName, lastName)
          .run();
        return json({ id, instructorId, firstName, lastName });
      }

      const clientMatch = path.match(/^clients\/(.+)$/);
      if (clientMatch) {
        const clientId = clientMatch[1];
        if (method === 'PUT') {
          const body = await readJson(request);
          const instructorId = body.instructorId;
          if (!instructorId) return error('Yeni hoca gerekli', 400);
          const client = await env.DB.prepare('SELECT * FROM clients WHERE id=?1').bind(clientId).first();
          if (!client) return error('Danisan bulunamadi', 404);
          const instructor = await env.DB.prepare('SELECT id FROM instructors WHERE id=?1')
            .bind(instructorId)
            .first();
          if (!instructor) return error('Hoca bulunamadi', 404);
          await env.DB.batch([
            env.DB.prepare('UPDATE clients SET instructorId=?1 WHERE id=?2').bind(instructorId, clientId),
            env.DB.prepare('UPDATE bookings SET instructorId=?1 WHERE clientId=?2').bind(instructorId, clientId),
          ]);
          return json({ ...client, instructorId });
        }
        if (method === 'DELETE') {
          await env.DB.batch([
            env.DB.prepare('DELETE FROM bookings WHERE clientId=?1').bind(clientId),
            env.DB.prepare('DELETE FROM clients WHERE id=?1').bind(clientId),
          ]);
          return json({ success: true });
        }
      }

      if (path === 'bookings' && method === 'POST') {
        const body = await readJson(request);
        const { instructorId, clientId, method: bookingMethod, time, dayOfWeek, daysOfMonth, date } = body;
        if (!instructorId || !clientId || !bookingMethod || !time) return error('Eksik bilgiler var', 400);
        const instructor = await env.DB.prepare('SELECT id FROM instructors WHERE id=?1')
          .bind(instructorId)
          .first();
        const client = await env.DB.prepare('SELECT id FROM clients WHERE id=?1 AND instructorId=?2')
          .bind(clientId, instructorId)
          .first();
        if (!instructor || !client) return error('Hoca veya danisan bulunamadi', 404);
        if (bookingMethod === 'weekly' && typeof dayOfWeek === 'undefined') return error('Gun bilgisi gerekli', 400);
        if (bookingMethod === 'monthly' && !daysOfMonth) return error('Gun listesi gerekli', 400);
        if (bookingMethod === 'once' && !date) return error('Tarih bilgisi gerekli', 400);
        const id = crypto.randomUUID();
        await env.DB.prepare(
          'INSERT INTO bookings (id, instructorId, clientId, method, time, date, dayOfWeek, daysOfMonth, exclusions) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, "")',
        )
          .bind(
            id,
            instructorId,
            clientId,
            bookingMethod,
            time,
            bookingMethod === 'once' ? String(date) : '',
            bookingMethod === 'weekly' ? String(dayOfWeek) : '',
            bookingMethod === 'monthly' ? String(daysOfMonth) : '',
          )
          .run();
        return json({ id, instructorId, clientId, method: bookingMethod, time, date, dayOfWeek, daysOfMonth, exclusions: '' });
      }

      const bookingMatch = path.match(/^bookings\/(.+)$/);
      if (bookingMatch) {
        const bookingId = bookingMatch[1];
        if (method === 'PUT') {
          const body = await readJson(request);
          const { method: bookingMethod, time, dayOfWeek, daysOfMonth, date, scope = 'all', occurrenceDate } = body;
          if (!time) return error('Eksik bilgiler var', 400);
          const booking = await env.DB.prepare('SELECT * FROM bookings WHERE id=?1').bind(bookingId).first();
          if (!booking) return error('Randevu bulunamadi', 404);

          if (scope === 'single' && booking.method !== 'once') {
            if (!occurrenceDate) return error('Hedef tarih gerekli', 400);
            const exclusions = buildExclusionSet(booking);
            exclusions.add(normalizeDateKey(occurrenceDate));
            const exclusionsStr = Array.from(exclusions).join(';');
            await env.DB.prepare('UPDATE bookings SET exclusions=?1 WHERE id=?2').bind(exclusionsStr, bookingId).run();

            const newId = crypto.randomUUID();
            await env.DB.prepare(
              'INSERT INTO bookings (id, instructorId, clientId, method, time, date, dayOfWeek, daysOfMonth, exclusions) VALUES (?1, ?2, ?3, "once", ?4, ?5, "", "", "")',
            )
              .bind(
                newId,
                booking.instructorId,
                booking.clientId,
                time,
                normalizeDateKey(date || occurrenceDate),
              )
              .run();
            return json({ updated: { ...booking, exclusions: exclusionsStr }, single: { id: newId } });
          }

          if (!bookingMethod) return error('Eksik bilgiler var', 400);
          if (bookingMethod === 'weekly' && typeof dayOfWeek === 'undefined') return error('Gun bilgisi gerekli', 400);
          if (bookingMethod === 'monthly' && !daysOfMonth) return error('Gun listesi gerekli', 400);
          if (bookingMethod === 'once' && !date) return error('Tarih bilgisi gerekli', 400);

          await env.DB.prepare(
            'UPDATE bookings SET method=?1, time=?2, date=?3, dayOfWeek=?4, daysOfMonth=?5, exclusions=?6 WHERE id=?7',
          )
            .bind(
              bookingMethod,
              time,
              bookingMethod === 'once' ? String(date) : '',
              bookingMethod === 'weekly' ? String(dayOfWeek) : '',
              bookingMethod === 'monthly' ? String(daysOfMonth) : '',
              bookingMethod === 'once' ? '' : booking.exclusions || '',
              bookingId,
            )
            .run();
          return json({ success: true });
        }

        if (method === 'DELETE') {
          const body = await readJson(request);
          const scope = body?.scope || 'all';
          const occurrenceDate = body?.occurrenceDate;
          const booking = await env.DB.prepare('SELECT * FROM bookings WHERE id=?1').bind(bookingId).first();
          if (!booking) return error('Randevu bulunamadi', 404);
          if (scope === 'single' && booking.method !== 'once') {
            if (!occurrenceDate) return error('Hedef tarih gerekli', 400);
            const exclusions = buildExclusionSet(booking);
            exclusions.add(normalizeDateKey(occurrenceDate));
            const exclusionsStr = Array.from(exclusions).join(';');
            await env.DB.prepare('UPDATE bookings SET exclusions=?1 WHERE id=?2').bind(exclusionsStr, bookingId).run();
            return json({ success: true });
          }
          await env.DB.prepare('DELETE FROM bookings WHERE id=?1').bind(bookingId).run();
          return json({ success: true });
        }
      }

      return error('Not found', 404);
    } catch (err) {
      console.error(err);
      return error('Sunucu hatasi', 500);
    }
  },
};

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS instructors (id TEXT PRIMARY KEY, firstName TEXT NOT NULL, lastName TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, instructorId TEXT NOT NULL, firstName TEXT NOT NULL, lastName TEXT NOT NULL, FOREIGN KEY (instructorId) REFERENCES instructors(id))`,
  `CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, instructorId TEXT NOT NULL, clientId TEXT NOT NULL, method TEXT NOT NULL, time TEXT NOT NULL, date TEXT, dayOfWeek TEXT, daysOfMonth TEXT, exclusions TEXT, FOREIGN KEY (instructorId) REFERENCES instructors(id), FOREIGN KEY (clientId) REFERENCES clients(id))`,
  `CREATE INDEX IF NOT EXISTS idx_clients_instructor ON clients(instructorId)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_instructor ON bookings(instructorId)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(clientId)`,
];

let schemaReady;
async function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch(SCHEMA_STATEMENTS.map((sql) => env.DB.prepare(sql)));
  }
  return schemaReady;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (_err) {
    return {};
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

function normalizeName(value = '') {
  return value.trim().replace(/\s+/g, ' ');
}

function dateKeyFromDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date)) return String(value);
  return dateKeyFromDate(date);
}

function buildExclusionSet(booking) {
  return new Set(
    (booking.exclusions || '')
      .split(';')
      .map((d) => normalizeDateKey(d.trim()))
      .filter(Boolean),
  );
}

function generateOccurrences({ bookings, clients, instructors }, daysAhead = 30) {
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

    const timeParts = (booking.time || '').split(':');
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
          occurrences.push(makeOccurrence(booking, client, instructor, date));
        }
      }
    } else if (booking.method === 'monthly') {
      const days = (booking.daysOfMonth || '')
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
          occurrences.push(makeOccurrence(booking, client, instructor, date));
        }
      }
    } else if (booking.method === 'once') {
      if (!booking.date) continue;
      const date = new Date(booking.date);
      const dateKey = dateKeyFromDate(date);
      if (exclusions.has(dateKey)) continue;
      date.setHours(hours, minutes, 0, 0);
      if (date >= today && date <= endDate) {
        occurrences.push(makeOccurrence(booking, client, instructor, date));
      }
    }
  }

  occurrences.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  return occurrences;
}

function makeOccurrence(booking, client, instructor, date) {
  return {
    id: `${booking.id}-${date.toISOString()}`,
    bookingId: booking.id,
    instructorId: booking.instructorId,
    clientId: booking.clientId,
    instructorName: `${instructor.firstName} ${instructor.lastName}`.trim(),
    clientName: `${client.firstName} ${client.lastName}`.trim(),
    dateTime: date.toISOString(),
    method: booking.method,
  };
}

async function loadData(env) {
  const instructors = (await env.DB.prepare('SELECT * FROM instructors').all()).results || [];
  const clients = (await env.DB.prepare('SELECT * FROM clients').all()).results || [];
  const bookings = (await env.DB.prepare('SELECT * FROM bookings').all()).results || [];
  return { instructors, clients, bookings };
}
