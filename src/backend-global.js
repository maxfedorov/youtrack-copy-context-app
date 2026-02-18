/* eslint-disable no-console */
/* eslint-disable complexity */

function parseJsonSafe(str) {
  try {
    return JSON.parse(String(str));
  } catch {
    return null;
  }
}

function readRequestData(ctx) {
  if (typeof ctx.request.json === 'function') {
    return ctx.request.json();
  }
  const body = ctx.request.body;
  return typeof body === 'string' ? parseJsonSafe(body) : body;
}

function handleGetUserSettings(ctx) {
  try {
    const user = ctx.currentUser;
    if (!user) {
      ctx.response.json({ settings: null });
      return;
    }
    const raw = user.extensionProperties.copyContextSettings;
    const parsed = raw ? parseJsonSafe(raw) : null;
    ctx.response.json({ settings: parsed });
  } catch (err) {
    console.log('handleGetUserSettings error:', err && err.message);
    ctx.response.json({ settings: null });
  }
}

function handleSaveUserSettings(ctx) {
  try {
    const user = ctx.currentUser;
    if (!user) {
      ctx.response.code = 401;
      ctx.response.json({ error: 'Unauthorized' });
      return;
    }
    const data = readRequestData(ctx);
    if (!data || typeof data !== 'object') {
      ctx.response.code = 400;
      ctx.response.json({ error: 'Invalid settings payload' });
      return;
    }
    const str = JSON.stringify(data.settings || {});
    user.extensionProperties.copyContextSettings = String(str);
    ctx.response.json({ success: true });
  } catch (err) {
    console.log('handleSaveUserSettings error:', err && err.message);
    ctx.response.code = 500;
    ctx.response.json({ error: err && err.message });
  }
}

exports.httpHandler = {
  endpoints: [
    { method: 'GET', path: 'user-settings', handle: handleGetUserSettings },
    { method: 'POST', path: 'user-settings', handle: handleSaveUserSettings }
  ]
};
