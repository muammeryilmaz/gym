import {
  buildExclusionSet,
  generateId,
  loadData,
  normalizeDateKey,
  persistData,
} from '../_data.js';
import { jsonResponse, readJsonBody } from '../_utils.js';

export async function onRequestPut({ params, request, env }) {
  try {
    const bookingId = params.id;
    const body = await readJsonBody(request);
    const { method, time, dayOfWeek, daysOfMonth, date, scope = 'all', occurrenceDate } = body;
    const data = await loadData(env);
    const booking = data.bookings.find((b) => b.id === bookingId);
    if (!booking) return jsonResponse({ error: 'Randevu bulunamadi' }, 404);
    if (!time) return jsonResponse({ error: 'Eksik bilgiler var' }, 400);

    if (scope === 'single' && booking.method !== 'once') {
      if (!occurrenceDate) return jsonResponse({ error: 'Hedef tarih gerekli' }, 400);
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
      await persistData(env, data);
      return jsonResponse({ updated: booking, single: newBooking });
    }

    if (!method) return jsonResponse({ error: 'Eksik bilgiler var' }, 400);
    if (method === 'weekly' && typeof dayOfWeek === 'undefined') {
      return jsonResponse({ error: 'Gun bilgisi gerekli' }, 400);
    }
    if (method === 'monthly' && !daysOfMonth) {
      return jsonResponse({ error: 'Gun listesi gerekli' }, 400);
    }
    if (method === 'once' && !date) {
      return jsonResponse({ error: 'Tarih bilgisi gerekli' }, 400);
    }

    booking.method = method;
    booking.time = time;
    booking.date = method === 'once' ? String(date) : '';
    booking.dayOfWeek = method === 'weekly' ? String(dayOfWeek) : '';
    booking.daysOfMonth = method === 'monthly' ? String(daysOfMonth) : '';
    booking.exclusions = method === 'once' ? '' : booking.exclusions || '';
    await persistData(env, data);
    return jsonResponse(booking);
  } catch (err) {
    return jsonResponse({ error: 'Randevu guncellenemedi' }, 500);
  }
}

export async function onRequestDelete({ params, request, env }) {
  try {
    const bookingId = params.id;
    const body = await readJsonBody(request);
    const { scope = 'all', occurrenceDate } = body || {};
    const data = await loadData(env);
    const initialLength = data.bookings.length;

    const booking = data.bookings.find((b) => b.id === bookingId);
    if (!booking) return jsonResponse({ error: 'Randevu bulunamadi' }, 404);

    if (scope === 'single' && booking.method !== 'once') {
      if (!occurrenceDate) return jsonResponse({ error: 'Hedef tarih gerekli' }, 400);
      const exclusions = buildExclusionSet(booking);
      exclusions.add(String(occurrenceDate));
      booking.exclusions = Array.from(exclusions).join(';');
      await persistData(env, data);
      return jsonResponse({ success: true });
    }

    data.bookings = data.bookings.filter((b) => b.id !== bookingId);
    if (data.bookings.length === initialLength) {
      return jsonResponse({ error: 'Randevu bulunamadi' }, 404);
    }
    await persistData(env, data);
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: 'Randevu silinemedi' }, 500);
  }
}
