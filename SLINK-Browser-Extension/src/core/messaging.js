(function installMessaging(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before messaging.');

  let nextRequestId = 1;

  async function send(type, payload = {}) {
    const response = await chrome.runtime.sendMessage({
      channel: 'slink',
      requestId: nextRequestId++,
      type: String(type || ''),
      payload
    });

    if (!response?.ok) {
      const error = new Error(response?.error?.message || 'SLINK background request failed.');
      error.code = response?.error?.code || 'SLINK_MESSAGE_FAILED';
      throw error;
    }
    return response.data;
  }

  function createRouter(routes) {
    const routeMap = Object.freeze({ ...routes });

    return (message, sender, sendResponse) => {
      if (message?.channel !== 'slink') return false;

      const handler = routeMap[message.type];
      if (typeof handler !== 'function') {
        sendResponse({
          ok: false,
          requestId: message.requestId,
          error: { code: 'SLINK_ROUTE_NOT_FOUND', message: `Unknown SLINK route: ${message.type}` }
        });
        return false;
      }

      Promise.resolve()
        .then(() => handler(message.payload || {}, sender))
        .then(data => sendResponse({ ok: true, requestId: message.requestId, data }))
        .catch(error => sendResponse({
          ok: false,
          requestId: message.requestId,
          error: {
            code: String(error?.code || 'SLINK_BACKGROUND_ERROR'),
            message: SLINK.core.format?.errorMessage(error) || String(error)
          }
        }));

      return true;
    };
  }

  SLINK.define('core', 'messaging', Object.freeze({
    createRouter,
    send
  }));
})(globalThis);
