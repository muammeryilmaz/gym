import crypto from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const BOOKING_HEADERS = [
  'id',
  'instructorId',
  'clientId',
  'method',
  'time',
  'date',
  'dayOfWeek',
  'daysOfMonth',
  'exclusions',
];
const FILES = {
  instructors: path.join(DATA_DIR, 'instructors.csv'),
  clients: path.join(DATA_DIR, 'clients.csv'),
  bookings: path.join(DATA_DIR, 'bookings.csv'),
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function normalizeName(value = '') {
  return value.trim().replace(/\s+/g, ' ');
}

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const defaults = [
    { file: FILES.instructors, header: 'id,firstName,lastName\n' },
    { file: FILES.clients, header: 'id,instructorId,firstName,lastName\n' },
    {
      file: FILES.bookings,
      header: `${BOOKING_HEADERS.join(',')}\n`,
    },
  ];

  for (const entry of defaults) {
    try {
      await fs.access(entry.file);
    } catch (err) {
      await fs.writeFile(entry.file, entry.header, 'utf8');
    }
  }
}

function parseCSV(content) {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split(',');
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });
    return record;
  });
}

function toCSV(rows, headers) {
  const headerRow = headers.join(',');
  const body = rows
    .map((row) => headers.map((key) => (row[key] ?? '').toString().replace(/,/g, ' ')).join(','))
    .join('\n');
  return `${headerRow}\n${body}`;
}

async function readTable(file) {
  const content = await fs.readFile(file, 'utf8');
  return parseCSV(content);
}

async function writeTable(file, rows, headers) {
  const csv = toCSV(rows, headers);
  await fs.writeFile(file, csv, 'utf8');
}

function generateId() {
  return crypto.randomUUID();
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

    const timeParts = booking.time.split(':');
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

async function loadData() {
  const [instructors, clients, bookings] = await Promise.all([
    readTable(FILES.instructors),
    readTable(FILES.clients),
    readTable(FILES.bookings),
  ]);
  return { instructors, clients, bookings };
}

async function persistData({ instructors, clients, bookings }) {
  await Promise.all([
    writeTable(FILES.instructors, instructors, ['id', 'firstName', 'lastName']),
    writeTable(FILES.clients, clients, ['id', 'instructorId', 'firstName', 'lastName']),
    writeTable(FILES.bookings, bookings, BOOKING_HEADERS),
  ]);
}

app.get('/api/all', async (_req, res) => {
  try {
    const data = await loadData();
    const occurrences = generateOccurrences(data);
    res.json({ ...data, occurrences });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Veriler yuklenemedi' });
  }
});

app.post('/api/instructors', async (req, res) => {
  try {
    const firstName = normalizeName(req.body.firstName || '');
    const lastName = normalizeName(req.body.lastName || '');
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Isim ve soyisim gerekli' });
    }
    const data = await loadData();
    const id = generateId();
    data.instructors.push({ id, firstName, lastName });
    await persistData(data);
    res.json({ id, firstName, lastName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hoca eklenemedi' });
  }
});

app.delete('/api/instructors/:id', async (req, res) => {
  try {
    const instructorId = req.params.id;
    const data = await loadData();
    data.instructors = data.instructors.filter((i) => i.id !== instructorId);
    data.clients = data.clients.filter((c) => c.instructorId !== instructorId);
    data.bookings = data.bookings.filter((b) => b.instructorId !== instructorId);
    await persistData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hoca silinemedi' });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const instructorId = req.body.instructorId;
    const firstName = normalizeName(req.body.firstName || '');
    const lastName = normalizeName(req.body.lastName || '');
    if (!instructorId || !firstName || !lastName) {
      return res.status(400).json({ error: 'Hoca ve isim bilgileri gerekli' });
    }
    const data = await loadData();
    const instructorExists = data.instructors.some((i) => i.id === instructorId);
    if (!instructorExists) return res.status(404).json({ error: 'Hoca bulunamadi' });
    const id = generateId();
    data.clients.push({ id, instructorId, firstName, lastName });
    await persistData(data);
    res.json({ id, instructorId, firstName, lastName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Danisan eklenemedi' });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const clientId = req.params.id;
    const { instructorId } = req.body;
    if (!instructorId) return res.status(400).json({ error: 'Yeni hoca gerekli' });
    const data = await loadData();
    const client = data.clients.find((c) => c.id === clientId);
    if (!client) return res.status(404).json({ error: 'Danisan bulunamadi' });
    const instructorExists = data.instructors.some((i) => i.id === instructorId);
    if (!instructorExists) return res.status(404).json({ error: 'Hoca bulunamadi' });
    client.instructorId = instructorId;
    data.bookings = data.bookings.map((b) =>
      b.clientId === clientId ? { ...b, instructorId } : b,
    );
    await persistData(data);
    res.json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Danisan guncellenemedi' });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const clientId = req.params.id;
    const data = await loadData();
    const initialLength = data.clients.length;
    data.clients = data.clients.filter((c) => c.id !== clientId);
    data.bookings = data.bookings.filter((b) => b.clientId !== clientId);
    if (data.clients.length === initialLength) return res.status(404).json({ error: 'Danisan bulunamadi' });
    await persistData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Danisan silinemedi' });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const { instructorId, clientId, method, time, dayOfWeek, daysOfMonth, date } = req.body;
    if (!instructorId || !clientId || !method || !time) {
      return res.status(400).json({ error: 'Eksik bilgiler var' });
    }
    const data = await loadData();
    const instructorExists = data.instructors.some((i) => i.id === instructorId);
    const clientExists = data.clients.some((c) => c.id === clientId && c.instructorId === instructorId);
    if (!instructorExists || !clientExists) {
      return res.status(404).json({ error: 'Hoca veya danisan bulunamadi' });
    }
    if (method === 'weekly' && typeof dayOfWeek === 'undefined') {
      return res.status(400).json({ error: 'Gun bilgisi gerekli' });
    }
    if (method === 'monthly' && !daysOfMonth) {
      return res.status(400).json({ error: 'Gun listesi gerekli' });
    }
    if (method === 'once' && !date) {
      return res.status(400).json({ error: 'Tarih bilgisi gerekli' });
    }
    const booking = {
      id: generateId(),
      instructorId,
      clientId,
      method,
      time,
      date: method === 'once' ? String(date) : '',
      dayOfWeek: method === 'weekly' ? String(dayOfWeek) : '',
      daysOfMonth: method === 'monthly' ? String(daysOfMonth) : '',
      exclusions: '',
    };
    data.bookings.push(booking);
    await persistData(data);
    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Randevu eklenemedi' });
  }
});

app.put('/api/bookings/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { method, time, dayOfWeek, daysOfMonth, date, scope = 'all', occurrenceDate } = req.body;
    const data = await loadData();
    const booking = data.bookings.find((b) => b.id === bookingId);
    if (!booking) return res.status(404).json({ error: 'Randevu bulunamadi' });

    if (!time) return res.status(400).json({ error: 'Eksik bilgiler var' });

    if (scope === 'single' && booking.method !== 'once') {
      if (!occurrenceDate) return res.status(400).json({ error: 'Hedef tarih gerekli' });
      const exclusions = buildExclusionSet(booking);
      exclusions.add(normalizeDateKey(occurrenceDate));
      booking.exclusions = Array.from(exclusions).join(';');

      const newBooking = {
        id: generateId(),
        instructorId: booking.instructorId,
        clientId: booking.clientId,
        method: 'once',
        time,
        date: normalizeDateKey(date || occurrenceDate),
        dayOfWeek: '',
        daysOfMonth: '',
        exclusions: '',
      };
      data.bookings.push(newBooking);
      await persistData(data);
      return res.json({ updated: booking, single: newBooking });
    }

    if (!method) return res.status(400).json({ error: 'Eksik bilgiler var' });
    if (method === 'weekly' && typeof dayOfWeek === 'undefined') {
      return res.status(400).json({ error: 'Gun bilgisi gerekli' });
    }
    if (method === 'monthly' && !daysOfMonth) {
      return res.status(400).json({ error: 'Gun listesi gerekli' });
    }
    if (method === 'once' && !date) {
      return res.status(400).json({ error: 'Tarih bilgisi gerekli' });
    }

    booking.method = method;
    booking.time = time;
    booking.date = method === 'once' ? String(date) : '';
    booking.dayOfWeek = method === 'weekly' ? String(dayOfWeek) : '';
    booking.daysOfMonth = method === 'monthly' ? String(daysOfMonth) : '';
    booking.exclusions = method === 'once' ? '' : booking.exclusions || '';
    await persistData(data);
    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Randevu guncellenemedi' });
  }
});

app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { scope = 'all', occurrenceDate } = req.body || {};
    const data = await loadData();
    const initialLength = data.bookings.length;

    const booking = data.bookings.find((b) => b.id === bookingId);
    if (!booking) return res.status(404).json({ error: 'Randevu bulunamadi' });

    if (scope === 'single' && booking.method !== 'once') {
      if (!occurrenceDate) return res.status(400).json({ error: 'Hedef tarih gerekli' });
      const exclusions = buildExclusionSet(booking);
      exclusions.add(String(occurrenceDate));
      booking.exclusions = Array.from(exclusions).join(';');
      await persistData(data);
      return res.json({ success: true });
    }

    data.bookings = data.bookings.filter((b) => b.id !== bookingId);
    await persistData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Randevu silinemedi' });
  }
});

app.get('/api/occurrences', async (_req, res) => {
  try {
    const data = await loadData();
    const occurrences = generateOccurrences(data);
    res.json({ occurrences });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Randevular yuklenemedi' });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureDataFiles().then(() => {
  app.listen(PORT, () => {
    console.log(`Guray Pilates Salonu uygulamasi ${PORT} portunda hazır`);
  });
});
