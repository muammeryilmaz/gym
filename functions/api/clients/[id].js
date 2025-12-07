import { loadData, persistData } from '../_data.js';
import { jsonResponse, readJsonBody } from '../_utils.js';

export async function onRequestPut({ params, request, env }) {
  try {
    const clientId = params.id;
    const body = await readJsonBody(request);
    const { instructorId } = body;
    if (!instructorId) return jsonResponse({ error: 'Yeni hoca gerekli' }, 400);

    const data = await loadData(env);
    const client = data.clients.find((c) => c.id === clientId);
    if (!client) return jsonResponse({ error: 'Danisan bulunamadi' }, 404);
    const instructorExists = data.instructors.some((i) => i.id === instructorId);
    if (!instructorExists) return jsonResponse({ error: 'Hoca bulunamadi' }, 404);

    client.instructorId = instructorId;
    data.bookings = data.bookings.map((b) =>
      b.clientId === clientId ? { ...b, instructorId } : b,
    );
    await persistData(env, data);
    return jsonResponse(client);
  } catch (err) {
    return jsonResponse({ error: 'Danisan guncellenemedi' }, 500);
  }
}

export async function onRequestDelete({ params, env }) {
  try {
    const clientId = params.id;
    const data = await loadData(env);
    const initialLength = data.clients.length;
    data.clients = data.clients.filter((c) => c.id !== clientId);
    data.bookings = data.bookings.filter((b) => b.clientId !== clientId);
    if (data.clients.length === initialLength) {
      return jsonResponse({ error: 'Danisan bulunamadi' }, 404);
    }
    await persistData(env, data);
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: 'Danisan silinemedi' }, 500);
  }
}
