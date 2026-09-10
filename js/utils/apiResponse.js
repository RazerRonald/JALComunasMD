/** Lee el contrato JSON de una API sin mostrar HTML ni errores del parser. */
export async function readApiResponse(response, validate = () => true) {
  const unavailable = () => Object.assign(
    new Error('El servicio de solicitudes no está disponible temporalmente. Intenta más tarde.'),
    { code: 'api/backend-unavailable' },
  );
  const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json' && !/^application\/[a-z0-9.+-]+\+json$/.test(type)) throw unavailable();
  let data;
  try { data = await response.json(); } catch (_) { throw unavailable(); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw unavailable();
  if (!response.ok) {
    throw Object.assign(new Error(typeof data.error === 'string' && data.error
      ? data.error : 'No se pudo completar la solicitud. Intenta nuevamente.'),
    { code: typeof data.code === 'string' ? data.code : 'api/unavailable' });
  }
  if (!validate(data)) throw unavailable();
  return data;
}
