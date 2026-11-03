self.addEventListener('message', event => {
  if (event.data?.type !== 'TRAMA_PUSH_ENABLED' || typeof event.data.enabled !== 'boolean') return
  event.waitUntil((async () => {
    try {
      const cache = await caches.open('trama-push-state-v1')
      await cache.put('/__trama-push-state', new Response(String(event.data.enabled)))
      event.ports[0]?.postMessage({ ok: true })
    } catch { event.ports[0]?.postMessage({ ok: false }) }
  })())
})

self.addEventListener('push', event => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { return }
  event.waitUntil((async () => {
    const cache = await caches.open('trama-push-state-v1')
    const state = await cache.match('/__trama-push-state')
    if (!state || await state.text() !== 'true') return
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const visible = windows.filter(client => client.visibilityState === 'visible')
    if (visible.length) {
      visible.forEach(client => client.postMessage({ type: 'TRAMA_PUSH', payload }))
      return
    }
    const data = payload.data || {}
    const postId = data.publicacionId || data.postId || (['LIKE', 'COMMENT'].includes(data.tipo) && data.resourceType !== 'COMMENT' ? data.resourceId : '')
    let path = postId ? `/obra/${encodeURIComponent(postId)}` : '/inicio'
    if (!postId && data.url) {
      try {
        const url = new URL(data.url, self.location.origin)
        if (url.origin === self.location.origin && /^\/(obra\/|user\/|perfil\/|desafios\/|inicio(?:$|\?))/.test(url.pathname)) path = url.pathname + url.search + url.hash
      } catch { path = '/inicio' }
    }
    const title = data.tipo === 'LIKE' ? 'Nuevo me gusta' : data.tipo === 'COMMENT' ? 'Nuevo comentario' : 'Trama'
    const body = data.tipo === 'LIKE' ? 'Tu obra recibió un me gusta.' : data.tipo === 'COMMENT' ? 'Tu obra recibió un comentario.' : 'Tenés una nueva notificación.'
    await self.registration.showNotification((payload.notification?.title || data.title || title).slice(0, 120), {
      body: (payload.notification?.body || data.body || body).slice(0, 500),
      tag: payload.fcmMessageId || payload.messageId || data.notificacionId,
      data: { path },
    })
  })())
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const url = new URL(event.notification.data?.path || '/inicio', self.location.origin)
    if (url.origin !== self.location.origin) return
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const client = windows[0]
    if (client) { await client.navigate(url.href); await client.focus() }
    else await self.clients.openWindow(url.href)
  })())
})