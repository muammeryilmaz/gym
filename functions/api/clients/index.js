import { generateId, loadData, normalizeName, persistData } from '../_data.js';
import { jsonResponse, readJsonBody } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJsonBody(request);
    const instructorId = body.instructorId;
    const firstName = normalizeName(body.firstName || '');
    const lastName = normalizeName(body.lastName || '');
    if (!instructorId || !firstName || !lastName) {
      return jsonResponse({ error: 'Hoca ve isim bilgileri gerekli' }, 400);
    }

    const data = await loadData(env);
    const instructorExists = data.instructors.some((i) => i.id === instructorId);
    if (!instructorExists) return jsonResponse({ error: 'Hoca bulunamadi' }, 404);

    const id = generateId();
    data.clients.push({ id, instructorId, firstName, lastName });
    await persistData(env, data);
    return jsonResponse({ id, instructorId, firstName, lastName });
  } catch (err) {
    return jsonResponse({ error: 'Danisan eklenemedi' }, 500);
  }
}
