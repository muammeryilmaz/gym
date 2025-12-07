export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch (err) {
    return {};
  }
}
