import { generateId, loadData, normalizeName, persistData } from '../_data.js';
import { jsonResponse, readJsonBody } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJsonBody(request);
    const firstName = normalizeName(body.firstName || '');
    const lastName = normalizeName(body.lastName || '');
    if (!firstName || !lastName) {
      return jsonResponse({ error: 'Isim ve soyisim gerekli' }, 400);
    }

    const data = await loadData(env);
    const id = generateId();
    data.instructors.push({ id, firstName, lastName });
    await persistData(env, data);
    return jsonResponse({ id, firstName, lastName });
  } catch (err) {
    return jsonResponse({ error: 'Hoca eklenemedi' }, 500);
  }
}
