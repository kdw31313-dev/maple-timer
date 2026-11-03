const PAGE_ORIGIN = 'https://kdw31313-dev.github.io';
const METHODS = new Set(['getMe', 'getChat', 'sendMessage']);
const MAX_REQUEST_BYTES = 25_000;

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      'Access-Control-Allow-Origin': PAGE_ORIGIN,
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
    },
  });
}

function authorized(header, secret) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret ?? '')) return false;
  const expected = 'Bearer ' + secret;
  if (header?.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}

async function telegram(method, text, env) {
  const body = new URLSearchParams();
  if (method !== 'getMe') body.set('chat_id', env.TELEGRAM_CHAT_ID);
  if (method === 'sendMessage') {
    if (env.TELEGRAM_THREAD_ID) body.set('message_thread_id', env.TELEGRAM_THREAD_ID);
    body.set('text', text);
  }

  try {
    const url = new URL('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/' + method);
    const sending = method === 'sendMessage';
    if (!sending) url.search = body.toString();
    const response = await fetch(url.href, {
      method: sending ? 'POST' : 'GET',
      ...(sending ? {
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(Object.fromEntries(body)),
      } : {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(12000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      const target = location ? new URL(location, url) : null;
      const telegramHost = target?.hostname === 'api.telegram.org' || target?.hostname === 'core.telegram.org' ||
        target?.hostname === 'telegram.org' || target?.hostname === 't.me';
      return json({
        ok:false, relay_error:'telegram_response', upstream_status:response.status,
        redirect_host:telegramHost ? target.hostname : (target ? 'other' : 'missing'),
        redirect_path:target?.pathname === '/' ? 'root' : target?.pathname === '/bots' ? 'bot_docs' :
          target?.pathname === url.pathname ? 'same' : 'different',
        redirect_https:target?.protocol === 'https:',
      }, 502);
    }
    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok === true) {
      const result = data.result;
      if (method === 'getMe') return json({ok:true});
      if (method === 'getChat') {
        if (env.TELEGRAM_THREAD_ID && result?.type !== 'private' && !result?.is_forum) {
          return json({ok:false, error_code:400, description:'message thread not found in this chat'}, 400);
        }
        return json({ok:true, result:{type:result?.type, is_forum:result?.is_forum}});
      }
      return json({ok:true, result:{
        chat:{id:result?.chat?.id},
        message_id:result?.message_id,
        is_topic_message:result?.is_topic_message,
        message_thread_id:result?.message_thread_id,
      }});
    }
    if (data?.ok !== false || response.status < 400) {
      return json({ok:false, relay_error:'telegram_response', upstream_status:response.status}, 502);
    }
    return json({
      ok:false,
      error_code:data.error_code,
      description:typeof data.description === 'string'
        ? data.description.replaceAll(env.TELEGRAM_BOT_TOKEN, '[redacted]').slice(0, 200) : undefined,
      parameters:{migrate_to_chat_id:data.parameters?.migrate_to_chat_id},
    }, response.status);
  } catch (error) {
    const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
    const failure = {ok:false, relay_error:timeout ? 'telegram_timeout' : 'telegram_network'};
    if (method === 'getMe' && !timeout) {
      const detail = String(error.message ?? '');
      if (/dns|resolve|name lookup/i.test(detail)) failure.network_stage = 'dns';
      else if (/certificate|tls|ssl/i.test(detail)) failure.network_stage = 'tls';
      else if (/connect|socket|network/i.test(detail)) failure.network_stage = 'connection';
      else if (/redirect/i.test(detail)) failure.network_stage = 'redirect';
      else failure.network_stage = 'unknown';
      try {
        const control = await fetch('https://api.telegram.org/bot123:invalid_control_token/getMe', {
          redirect: 'error',
          signal: AbortSignal.timeout(3000),
        });
        failure.control_status = control.status;
      } catch {
        failure.control_status = 0;
      }
    }
    return json(failure, timeout ? 504 : 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/telegram' || url.search || request.headers.get('Origin') !== PAGE_ORIGIN) {
      return new Response(null, {status:404});
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status:204,
        headers:{
          'Access-Control-Allow-Origin': PAGE_ORIGIN,
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '600',
          'Vary': 'Origin',
        },
      });
    }
    if (request.method !== 'POST') return json({ok:false, relay_error:'bad_request'}, 405);
    if (!authorized(request.headers.get('Authorization'), env.MAPLE_RELAY_KEY)) {
      return json({ok:false, relay_error:'unauthorized'}, 401);
    }
    if (!/^\d+:[\w-]+$/.test(env.TELEGRAM_BOT_TOKEN ?? '') ||
        !/^-\d+$/.test(env.TELEGRAM_CHAT_ID ?? '') ||
        (env.TELEGRAM_THREAD_ID && !/^[1-9]\d*$/.test(env.TELEGRAM_THREAD_ID))) {
      return json({ok:false, relay_error:'configuration'}, 503);
    }

    let data;
    try {
      if (Number(request.headers.get('Content-Length')) > MAX_REQUEST_BYTES) throw Error();
      const raw = await request.text();
      if (raw.length > MAX_REQUEST_BYTES) throw Error();
      data = JSON.parse(raw);
    } catch {
      return json({ok:false, relay_error:'bad_request'}, 400);
    }
    if (!METHODS.has(data?.method) ||
        (data.method === 'sendMessage' && (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 4096))) {
      return json({ok:false, relay_error:'bad_request'}, 400);
    }
    return telegram(data.method, data.text, env);
  },
};
