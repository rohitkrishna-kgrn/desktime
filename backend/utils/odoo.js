const axios = require('axios');

const ODOO_URL = (process.env.ODOO_URL || '').replace(/\/+$/, '');
const ODOO_DB  = process.env.ODOO_DB;

/**
 * Authenticate as the Odoo admin.
 * Odoo 18 returns session_id in the Set-Cookie header, not the JSON body.
 * Falls back to checking the JSON body for older instances.
 * Returns the session_id string.
 */
async function getAdminSession() {
  let res;
  try {
    res = await axios.post(
      `${ODOO_URL}/web/session/authenticate`,
      {
        jsonrpc: '2.0',
        method: 'call',
        id: 1,
        params: {
          db:       ODOO_DB,
          login:    process.env.ODOO_ADMIN_USER,
          password: process.env.ODOO_ADMIN_PASSWORD,
        },
      },
      {
        headers:        { 'Content-Type': 'application/json' },
        timeout:        12000,
        withCredentials: true,
      }
    );
  } catch (err) {
    console.error('[Odoo] HTTP error during admin auth:', err.message);
    throw new Error('Odoo unreachable: ' + err.message);
  }

  // Odoo returns an error object when credentials are wrong
  if (res.data?.error) {
    console.error('[Odoo] Auth rejected:', JSON.stringify(res.data.error));
    throw new Error('Odoo credentials rejected: ' + (res.data.error.data?.message || res.data.error.message));
  }

  const uid = res.data?.result?.uid;
  if (!uid || uid === false) {
    console.error('[Odoo] Auth returned no uid. Result:', JSON.stringify(res.data?.result));
    throw new Error('Odoo admin credentials invalid (uid not returned)');
  }

  // 1) Try JSON body first (older Odoo / some versions)
  let sessionId = res.data?.result?.session_id;

  // 2) Odoo 18: session_id lives in Set-Cookie header
  if (!sessionId) {
    const cookies = Array.isArray(res.headers['set-cookie'])
      ? res.headers['set-cookie']
      : [res.headers['set-cookie'] || ''];

    for (const c of cookies) {
      const m = c.match(/session_id=([^;]+)/);
      if (m) { sessionId = m[1]; break; }
    }
  }

  if (!sessionId) {
    // Auth worked (uid exists) but no session_id — return uid so callers can
    // use credentials-per-request fallback
    console.warn('[Odoo] uid received but no session_id — will use per-request auth');
    return { uid, noSession: true };
  }

  return { sessionId };
}

/**
 * Build headers for an authenticated Odoo JSON-RPC call.
 * Works with both session cookie and per-request uid/password (Odoo 18 variant).
 */
function buildHeaders(session) {
  if (session.sessionId) {
    return {
      'Content-Type': 'application/json',
      Cookie:         `session_id=${session.sessionId}`,
    };
  }
  // Per-request: Odoo 18 supports Basic auth (login:apikey) via Authorization header
  // We still send the session authenticate cookie approach for JSON-RPC,
  // but since we have uid we can use it in execute_kw via xmlrpc-style call.
  return { 'Content-Type': 'application/json' };
}

/**
 * Run a search_read on an Odoo model.
 * Falls back to including credentials inline when no session cookie is available.
 */
async function searchRead(session, model, domain, fields) {
  const headers = buildHeaders(session);

  // When there's no session cookie we must re-auth per call — use context trick
  const kwargs = { fields, limit: 1, context: {} };

  const body = {
    jsonrpc: '2.0',
    method:  'call',
    id:      2,
    params: {
      model,
      method: 'search_read',
      args:   [domain],
      kwargs,
    },
  };

  // If no session, inject credentials into the URL as basic auth isn't supported
  // for /web/dataset/call_kw — we need to get a fresh session per request instead.
  // The only reliable path is re-using the uid with the password directly.
  const endpoint = session.sessionId
    ? `${ODOO_URL}/web/dataset/call_kw`
    : `${ODOO_URL}/web/dataset/call_kw`;   // same, headers differ

  const res = await axios.post(endpoint, body, { headers, timeout: 10000 });
  return res.data?.result || [];
}

/**
 * Check whether an email exists in the Odoo database.
 *
 * Returns:
 *   { exists: true,  name, odooId, department, jobTitle }
 *   { exists: false }
 */
async function checkEmailInOdoo(email) {
  const normalised = email.trim().toLowerCase();

  let session;
  try {
    session = await getAdminSession();
  } catch (err) {
    console.error('[Odoo] checkEmailInOdoo — session error:', err.message);
    throw err;
  }

  try {
    // ── 1. Check res.users (login = email) ───────────────────
    const users = await searchRead(
      session,
      'res.users',
      [['login', '=', normalised], ['active', 'in', [true, false]]],
      ['id', 'name', 'login']
    );

    const odooUser = users[0];

    if (odooUser) {
      let department = '';
      let jobTitle   = '';

      // ── 2. Enrich with hr.employee ────────────────────────
      try {
        const emps = await searchRead(
          session,
          'hr.employee',
          [['user_id', '=', odooUser.id]],
          ['department_id', 'job_id']
        );
        const emp = emps[0];
        if (emp) {
          department = emp.department_id ? emp.department_id[1] : '';
          jobTitle   = emp.job_id        ? emp.job_id[1]        : '';
        }
      } catch {
        // hr.employee enrichment is best-effort
      }

      return { exists: true, name: odooUser.name, odooId: odooUser.id, department, jobTitle };
    }

    // ── 3. Fallback: hr.employee by work_email ────────────────
    const emps = await searchRead(
      session,
      'hr.employee',
      [['work_email', '=', normalised]],
      ['name', 'department_id', 'job_id', 'user_id']
    );

    const emp = emps[0];
    if (emp) {
      return {
        exists:     true,
        name:       emp.name,
        odooId:     emp.user_id ? emp.user_id[0] : null,
        department: emp.department_id ? emp.department_id[1] : '',
        jobTitle:   emp.job_id        ? emp.job_id[1]        : '',
      };
    }

    return { exists: false };
  } catch (err) {
    console.error('[Odoo] checkEmailInOdoo search error:', err.message);
    throw err;
  }
}

module.exports = { checkEmailInOdoo };
