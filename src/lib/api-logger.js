import { NextResponse } from 'next/server';

const DB_OFFLINE_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE']);

function isDbConnectionError(err) {
  if (!err) return false;
  if (DB_OFFLINE_CODES.has(err.code)) return true;
  if (typeof err.message === 'string' &&
      /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connection.*refused|database.*unavailable|too many clients/i.test(err.message)) return true;
  return false;
}

export function withApiLogging(handler) {
  return async function loggedHandler(req, ctx) {
    const start = Date.now();
    try {
      const res = await handler(req, ctx);
      logApiResponse(req, res, start);
      return res;
    } catch (err) {
      if (isDbConnectionError(err)) {
        logApiError(req, err, start, 503);
        return NextResponse.json(
          { error: 'db_offline', message: 'Database is unreachable. Contact your administrator.' },
          { status: 503 }
        );
      }
      logApiError(req, err, start);
      throw err;
    }
  };
}

function logApiResponse(req, res, start) {
  const url = req.nextUrl || new URL(req.url);
  const decodedPath = safeDecodeUrl(`${url.pathname}${url.search}`);
  const durationMs = Date.now() - start;
  const logLevel = getLogLevel();
  if (logLevel === 'silent') {
    return;
  }

  const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
  let message = `[api] ${req.method} ${decodedPath} ${res.status} ${durationMs}ms ip=${ip}`;
  if (logLevel === 'debug') {
    const userAgent = req.headers.get('user-agent') || 'unknown';
    message += ` ua="${userAgent}"`;
  }

  console.log(message);
}

function logApiError(req, err, start, status = 500) {
  const url = req.nextUrl || new URL(req.url);
  const decodedPath = safeDecodeUrl(`${url.pathname}${url.search}`);
  const durationMs = Date.now() - start;
  const message = err?.message || 'unknown error';
  const logLevel = getLogLevel();
  if (logLevel === 'silent') {
    return;
  }

  const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
  let logLine = `[api] ${req.method} ${decodedPath} ${status} ${durationMs}ms ip=${ip} error="${message}"`;
  if (logLevel === 'debug') {
    const userAgent = req.headers.get('user-agent') || 'unknown';
    logLine += ` ua="${userAgent}"`;
  }

  console.log(logLine);
}

function safeDecodeUrl(value) {
  try {
    return decodeURIComponent(value);
  } catch (err) {
    return value;
  }
}

function getLogLevel() {
  const level = process.env.API_LOG_LEVEL || process.env.LOG_LEVEL || 'info';
  return level.toLowerCase();
}
