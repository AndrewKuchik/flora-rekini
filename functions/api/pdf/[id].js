function headers(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Flora-Workspace',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Cache-Control': 'no-store'
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: Object.assign(headers(origin), {'Content-Type':'application/json'}) });
}

function workspaceId(request) {
  const value = request.headers.get('X-Flora-Workspace') || '';
  return /^[a-zA-Z0-9_-]{20,100}$/.test(value) ? value : null;
}

export async function onRequest(context) {
  const request = context.request;
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return new Response(null, {status:204, headers:headers(origin)});
  const workspace = workspaceId(request);
  const id = String(context.params.id || '');
  if (!workspace || !/^[a-zA-Z0-9_-]{10,120}$/.test(id)) return json({error:'Invalid PDF link'}, 400, origin);
  if (!context.env.PDF_FILES) return json({error:'KV binding PDF_FILES is not configured'}, 503, origin);
  const key = workspace + ':' + id;

  try {
    if (request.method === 'PUT') {
      const length = Number(request.headers.get('Content-Length') || 0);
      if (length > 25 * 1024 * 1024) return json({error:'PDF is larger than 25 MiB'}, 413, origin);
      const body = await request.arrayBuffer();
      if (body.byteLength > 25 * 1024 * 1024) return json({error:'PDF is larger than 25 MiB'}, 413, origin);
      await context.env.PDF_FILES.put(key, body, {metadata:{contentType:'application/pdf'}});
      return json({ok:true}, 200, origin);
    }
    if (request.method === 'GET') {
      const object = await context.env.PDF_FILES.get(key, {type:'stream'});
      if (!object) return json({error:'PDF not found'}, 404, origin);
      return new Response(object, {status:200, headers:Object.assign(headers(origin), {'Content-Type':'application/pdf', 'Content-Disposition':'inline'})});
    }
    if (request.method === 'DELETE') {
      await context.env.PDF_FILES.delete(key);
      return json({ok:true}, 200, origin);
    }
    return json({error:'Method not allowed'}, 405, origin);
  } catch (error) {
    return json({error:'PDF storage error'}, 500, origin);
  }
}
