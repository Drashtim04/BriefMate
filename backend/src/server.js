const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { loadConfig } = require('./shared/config');
const { connectMongo, mongoStatus } = require('./db/mongo');
const apiRoutes = require('./routes');

loadConfig();

// Optional DB connect (only if MONGODB_URI is set). We don't block server start on DB.
connectMongo()
  .then((result) => {
    if (result?.connected) {
      const st = mongoStatus();
      console.log(`[intellihr-backend] mongo connected: ${st.name || ''}@${st.host || ''}`.trim());
    } else if (result?.reason === 'MONGODB_URI_NOT_SET') {
      console.log('[intellihr-backend] mongo disabled (MONGODB_URI not set)');
    }
  })
  .catch((err) => {
    console.warn('[intellihr-backend] mongo connect failed:', err.message || err);
  });

const app = express();

app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'intellihr-backend', ts: new Date().toISOString() });
});

app.use('/api', apiRoutes);

// Basic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  res.status(status).json({
    ok: false,
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR'
    }
  });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`[intellihr-backend] listening on :${port}`);
});
