/**
 * Lightweight CORS for local dev (React dashboard on :3001, gateway on :3000).
 * No extra npm dependency.
 */
function devCors() {
  return (req, res, next) => {
    const o = req.headers.origin;
    if (
      o &&
      (/^https?:\/\/localhost(:\d+)?$/.test(o) ||
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(o))
    ) {
      res.setHeader('Access-Control-Allow-Origin', o);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-user-id, x-user-email, x-user-role, X-Requested-With'
    );
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
}

module.exports = { devCors };
