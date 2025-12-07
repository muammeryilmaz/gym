import { generateId, loadData, persistData } from '../_data.js';
import { jsonResponse, readJsonBody } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJsonBody(request);
    const { instructorId, clientId, method, time, dayOfWeek, daysOfMonth, date } = body;
    if (!instructorId || !clientId || !method || !time) {
      return jsonResponse({ error: 'Eksik bilgiler var' }, 400);
    }

    const data = await loadData(env);
    const instructorExists = data.instructors.some((i) => i.id === instructorId);
    const clientExists = data.clients.some((c) => c.id === clientId && c.instructorId === instructorId);
    if (!instructorExists || !clientExists) {
      return jsonResponse({ error: 'Hoca veya danisan bulunamadi' }, 404);
    }
    if (method === 'weekly' && typeof dayOfWeek === 'undefined') {
      return jsonResponse({ error: 'Gun bilgisi gerekli' }, 400);
    }
    if (method === 'monthly' && !daysOfMonth) {
      return jsonResponse({ error: 'Gun listesi gerekli' }, 400);
    }
    if (method === 'once' && !date) {
      return jsonResponse({ error: 'Tarih bilgisi gerekli' }, 400);
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
    await persistData(env, data);
    return jsonResponse(booking);
  } catch (err) {
    return jsonResponse({ error: 'Randevu eklenemedi' }, 500);
  }
}
