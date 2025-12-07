import { generateOccurrences, loadData } from './_data.js';
import { jsonResponse } from './_utils.js';

export async function onRequestGet({ env }) {
  try {
    const data = await loadData(env);
    const occurrences = generateOccurrences(data);
    return jsonResponse({ ...data, occurrences });
  } catch (err) {
    return jsonResponse({ error: 'Veriler yuklenemedi' }, 500);
  }
}
