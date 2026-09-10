const DEFAULT_FIREBASE_PROJECT_ID = 'jal3-fd8a2';
const DEFAULT_FIREBASE_WEB_API_KEY = 'AIzaSyD_1bLYxGLrIngn6K2rexgHg4EijOAeOig';
const FIRESTORE_DATABASE = '(default)';
const COLLECTION_NOTICIAS = 'noticias';
const DRIVE_THUMB_SIZE = 1600;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12000;
const RETRY_BASE_DELAY_MS = 300;
const MAX_FETCH_RETRIES = 2;

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
  'CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
  'Vercel-CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
};

function getConfig() {
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID,
    apiKey: process.env.FIREBASE_WEB_API_KEY || DEFAULT_FIREBASE_WEB_API_KEY,
  };
}

function sendError(res, status, message) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: message }));
}

function getString(fields, key) {
  return fields?.[key]?.stringValue || '';
}

function isValidNoticiaId(id) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(String(id || ''));
}

function isValidCacheVersion(version) {
  return !version || /^[A-Za-z0-9_.:-]{1,256}$/.test(String(version));
}

function buildFirestoreUrl(noticiaId) {
  const { projectId, apiKey } = getConfig();
  const path = [
    'https://firestore.googleapis.com/v1/projects',
    encodeURIComponent(projectId),
    'databases',
    encodeURIComponent(FIRESTORE_DATABASE),
    'documents',
    COLLECTION_NOTICIAS,
    encodeURIComponent(noticiaId),
  ].join('/');

  return `${path}?key=${encodeURIComponent(apiKey)}`;
}

function buildDriveThumbnailUrl(fileId) {
  const params = new URLSearchParams({
    id: fileId,
    sz: `w${DRIVE_THUMB_SIZE}`,
  });
  return `https://drive.google.com/thumbnail?${params.toString()}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(url, options = {}) {
  const retries = options.retries ?? MAX_FETCH_RETRIES;
  let lastError = null;

  for (let intento = 0; intento <= retries; intento += 1) {
    try {
      const response = await fetchWithTimeout(url, options.fetchOptions || {});
      if (!isRetryableStatus(response.status) || intento === retries) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
      if (intento === retries) break;
    }

    await sleep(RETRY_BASE_DELAY_MS * (2 ** intento));
  }

  throw lastError || new Error('No se pudo completar la solicitud');
}

async function getNoticia(noticiaId) {
  const response = await fetchWithRetry(buildFirestoreUrl(noticiaId));
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Firestore respondio ${response.status}`);
  }
  return response.json();
}

async function getDriveImage(fileId) {
  const response = await fetchWithRetry(buildDriveThumbnailUrl(fileId));
  if (!response.ok) {
    throw new Error(`Drive respondio ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error('Drive no devolvio una imagen valida');
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    const err = new Error('La imagen supera el tamano maximo permitido');
    err.statusCode = 413;
    throw err;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    const err = new Error('La imagen supera el tamano maximo permitido');
    err.statusCode = 413;
    throw err;
  }

  return { buffer, contentType };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendError(res, 405, 'Metodo no permitido');
    return;
  }

  const noticiaId = String(req.query?.id || '').trim();
  if (!isValidNoticiaId(noticiaId)) {
    sendError(res, 400, 'ID de noticia invalido');
    return;
  }

  const cacheVersion = String(req.query?.v || '').trim();
  if (!isValidCacheVersion(cacheVersion)) {
    sendError(res, 400, 'Version de cache invalida');
    return;
  }

  try {
    const noticia = await getNoticia(noticiaId);
    const fields = noticia?.fields;
    if (!fields) {
      sendError(res, 404, 'Noticia no encontrada');
      return;
    }

    const mediaTipo = getString(fields, 'media_tipo');
    const mediaMime = getString(fields, 'media_mime');
    const mediaDriveId = getString(fields, 'media_drive_id');

    if (mediaTipo !== 'imagen' || !mediaDriveId) {
      sendError(res, 404, 'La noticia no tiene imagen disponible');
      return;
    }

    if (mediaMime && !mediaMime.toLowerCase().startsWith('image/')) {
      sendError(res, 415, 'El archivo asociado no es una imagen');
      return;
    }

    if (cacheVersion && cacheVersion !== mediaDriveId) {
      const params = new URLSearchParams({ id: noticiaId, v: mediaDriveId });
      res.statusCode = 302;
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Location', `/api/noticias-media?${params.toString()}`);
      res.end();
      return;
    }

    const etag = `"noticia-media-${mediaDriveId}"`;
    if (req.headers['if-none-match'] === etag) {
      Object.entries(CACHE_HEADERS).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      res.setHeader('ETag', etag);
      res.statusCode = 304;
      res.end();
      return;
    }

    const { buffer, contentType } = await getDriveImage(mediaDriveId);

    Object.entries(CACHE_HEADERS).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('Content-Type', contentType || mediaMime || 'image/jpeg');
    res.setHeader('Content-Length', buffer.byteLength);
    res.end(buffer);
  } catch (err) {
    console.error('[api/noticias-media]', err);
    sendError(res, err.statusCode || 502, 'No se pudo cargar la imagen de la noticia');
  }
};
