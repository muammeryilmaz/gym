import { loadData, persistData } from '../_data.js';
import { jsonResponse } from '../_utils.js';

export async function onRequestDelete({ params, env }) {
  try {
    const instructorId = params.id;
    const data = await loadData(env);
    data.instructors = data.instructors.filter((i) => i.id !== instructorId);
    data.clients = data.clients.filter((c) => c.instructorId !== instructorId);
    data.bookings = data.bookings.filter((b) => b.instructorId !== instructorId);
    await persistData(env, data);
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: 'Hoca silinemedi' }, 500);
  }
}
