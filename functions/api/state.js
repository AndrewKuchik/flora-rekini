const MAX_STATE_BYTES = 5 * 1024 * 1024;

function headers(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Flora-Workspace',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Cache-Control': 'no-store'
  };
}

function response(body, status, origin, extra) {
  return new Response(body, { status, headers: Object.assign(headers(origin), extra || {}) });
}

function workspaceId(request) {
  const value = request.headers.get('X-Flora-Workspace') || '';
  return /^[a-zA-Z0-9_-]{20,100}$/.test(value) ? value : null;
}

export async function onRequest(context) {
  const request = context.request;
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return response(null, 204, origin);
  const workspace = workspaceId(request);
  if (!workspace) return response(JSON.stringify({ error: 'Invalid workspace link' }), 400, origin, {'Content-Type':'application/json'});
  if (!context.env.DB) return response(JSON.stringify({ error: 'D1 binding DB is not configured' }), 503, origin, {'Content-Type':'application/json'});

  try {
    if (request.method === 'GET') {
      const row = await context.env.DB.prepare('SELECT state_json, updated_at FROM workspace_state WHERE workspace = ?1').bind(workspace).first();
      if (!row) return response(JSON.stringify({ profile:{}, clients:[], services:[], invoices:[], draft:null, updatedAt:null }), 200, origin, {'Content-Type':'application/json'});
      return response(row.state_json, 200, origin, {'Content-Type':'application/json', 'Last-Modified': row.updated_at});
    }
    if (request.method === 'PUT') {
      const text = await request.text();
      if (text.length > MAX_STATE_BYTES) return response(JSON.stringify({ error: 'State is too large' }), 413, origin, {'Content-Type':'application/json'});
      const parsed = JSON.parse(text);
      const now = new Date().toISOString();
      const state = Object.assign({ profile:{}, clients:[], services:[], invoices:[], draft:null }, parsed, { updatedAt: now });
      const serialized = JSON.stringify(state);
      await context.env.DB.prepare('INSERT INTO workspace_state (workspace, state_json, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(workspace) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at').bind(workspace, serialized, now).run();
      return response(serialized, 200, origin, {'Content-Type':'application/json'});
    }
    return response(JSON.stringify({ error: 'Method not allowed' }), 405, origin, {'Content-Type':'application/json'});
  } catch (error) {
    return response(JSON.stringify({ error: 'Cloud storage error' }), 500, origin, {'Content-Type':'application/json'});
  }
}
