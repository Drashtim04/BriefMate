const express = require('express');

const router = express.Router();

function getLlmBaseUrl() {
  const raw = process.env.LLM_BASE_URL || process.env.LLM_API_BASE_URL || 'http://localhost:8080';
  return String(raw).replace(/\/+$/, '');
}

function getTimeoutMs() {
  const raw = Number.parseInt(String(process.env.LLM_PROXY_TIMEOUT_MS || '30000'), 10);
  if (!Number.isFinite(raw) || raw < 1000) return 30000;
  return Math.min(raw, 120000);
}

async function proxyJson({ req, res, next, method, targetPath, body }) {
  const base = getLlmBaseUrl();
  const timeoutMs = getTimeoutMs();
  const url = `${base}${targetPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const text = await upstream.text();
    let json;

    try {
      json = text ? JSON.parse(text) : {};
    } catch (_err) {
      json = { ok: false, error: { message: text || 'Invalid upstream response', code: 'UPSTREAM_PARSE_ERROR' } };
    }

    res.status(upstream.status).json(json);
  } catch (err) {
    if (err?.name === 'AbortError') {
      res.status(504).json({
        ok: false,
        error: {
          message: `LLM upstream timeout after ${timeoutMs}ms`,
          code: 'LLM_UPSTREAM_TIMEOUT'
        }
      });
      return;
    }
    next(err);
  } finally {
    clearTimeout(timer);
  }
}

router.get('/health', async (req, res, next) => {
  await proxyJson({ req, res, next, method: 'GET', targetPath: '/health' });
});

router.get('/dashboard', async (req, res, next) => {
  await proxyJson({ req, res, next, method: 'GET', targetPath: '/dashboard' });
});

router.get('/employees', async (req, res, next) => {
  await proxyJson({ req, res, next, method: 'GET', targetPath: '/employees' });
});

router.get('/employees/:email/profile', async (req, res, next) => {
  const email = encodeURIComponent(String(req.params.email || '').toLowerCase());
  await proxyJson({ req, res, next, method: 'GET', targetPath: `/employees/${email}/profile` });
});

router.get('/meetings', async (req, res, next) => {
  const params = new URLSearchParams();
  if (req.query.employeeEmail) params.set('employeeEmail', String(req.query.employeeEmail));
  if (req.query.q) params.set('q', String(req.query.q));
  if (req.query.limit) params.set('limit', String(req.query.limit));

  const qs = params.toString();
  await proxyJson({ req, res, next, method: 'GET', targetPath: `/meetings${qs ? `?${qs}` : ''}` });
});

router.get('/meetings/:id/transcript', async (req, res, next) => {
  const meetingId = encodeURIComponent(String(req.params.id || ''));
  const params = new URLSearchParams();
  if (req.query.q) params.set('q', String(req.query.q));

  const qs = params.toString();
  await proxyJson({
    req,
    res,
    next,
    method: 'GET',
    targetPath: `/meetings/${meetingId}/transcript${qs ? `?${qs}` : ''}`
  });
});

router.post('/briefs/upcoming', async (req, res, next) => {
  await proxyJson({ req, res, next, method: 'POST', targetPath: '/briefs/upcoming', body: req.body || {} });
});

router.post('/chat/query', async (req, res, next) => {
  await proxyJson({ req, res, next, method: 'POST', targetPath: '/chat/query', body: req.body || {} });
});

router.post('/pipeline/run', async (req, res, next) => {
  await proxyJson({ req, res, next, method: 'POST', targetPath: '/pipeline/run', body: req.body || {} });
});

module.exports = router;
