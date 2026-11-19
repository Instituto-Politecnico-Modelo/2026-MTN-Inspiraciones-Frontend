import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { disableNotifications, enableNotifications, listenNotifications, notificationPath, parsePushNotice } from './push'

const firebase = vi.hoisted(() => ({
  getToken: vi.fn().mockResolvedValue('device-test'),
  deleteToken: vi.fn().mockResolvedValue(true),
  isSupported: vi.fn().mockResolvedValue(true),
}))
vi.mock('firebase/app', () => ({ getApps: () => [{ name: 'trama-push' }], initializeApp: vi.fn() }))
vi.mock('firebase/messaging', () => ({ ...firebase, getMessaging: vi.fn() }))

const config = { apiKey: 'web-key', appId: 'web-app', projectId: 'project', messagingSenderId: '123', vapidKey: 'public-vapid' }
const unsubscribe = vi.fn().mockResolvedValue(true)
const worker = {
  active: { postMessage: vi.fn((_message: unknown, ports: MessagePort[]) => ports?.[0]?.postMessage({ ok: true })) },
  pushManager: { getSubscription: vi.fn().mockResolvedValue({ unsubscribe }) },
}
const serviceWorker = Object.assign(new EventTarget(), {
  register: vi.fn().mockResolvedValue(worker),
  getRegistration: vi.fn().mockResolvedValue(worker),
  ready: Promise.resolve(worker),
})

function loadWorker(state: Map<string, string>, clients: object[] = []) {
  const handlers: Record<string, (event: unknown) => void> = {}
  const showNotification = vi.fn()
  const cache = {
    put: async (key: string, value: Response) => { state.set(key, await value.text()) },
    match: async (key: string) => state.has(key) ? new Response(state.get(key)) : undefined,
  }
  runInNewContext(readFileSync('public/push-sw.js', 'utf8'), {
    self: {
      addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler },
      clients: { matchAll: async () => clients },
      registration: { showNotification }, location: { origin: 'https://trama.example' },
    },
    caches: { open: async () => cache }, Response, URL,
  })
  return {
    showNotification,
    dispatch: async (name: string, fields: Record<string, unknown>) => {
      const tasks: Promise<unknown>[] = []
      handlers[name]({ ...fields, waitUntil: (task: Promise<unknown>) => tasks.push(task) })
      await Promise.all(tasks)
    },
  }
}

describe('worker de notificaciones', () => {
  it('conserva el consentimiento tras reiniciar y muestra un solo aviso en segundo plano', async () => {
    const state = new Map<string, string>()
    await loadWorker(state).dispatch('message', { data: { type: 'TRAMA_PUSH_ENABLED', enabled: true }, ports: [] })
    const restarted = loadWorker(state)
    await restarted.dispatch('push', { data: { json: () => ({ fcmMessageId: 'message', data: { tipo: 'COMMENT', resourceId: 'post-id' } }) } })
    expect(restarted.showNotification).toHaveBeenCalledExactlyOnceWith('Nuevo comentario', expect.objectContaining({
      body: 'Tu obra recibió un comentario.', data: { path: '/obra/post-id' },
    }))
  })

  it('envia el mensaje a la app visible sin duplicar la notificacion del sistema', async () => {
    const client = { visibilityState: 'visible', postMessage: vi.fn() }
    const worker = loadWorker(new Map([['/__trama-push-state', 'true']]), [client])
    const payload = { data: { tipo: 'LIKE', resourceId: 'post-id' } }
    await worker.dispatch('push', { data: { json: () => payload } })
    expect(client.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'TRAMA_PUSH', payload })
    expect(worker.showNotification).not.toHaveBeenCalled()
  })

  it('ignora notificaciones tras cerrar sesion incluso despues de reiniciar', async () => {
    const state = new Map([['/__trama-push-state', 'true']])
    await loadWorker(state).dispatch('message', { data: { type: 'TRAMA_PUSH_ENABLED', enabled: false }, ports: [] })
    const restarted = loadWorker(state)
    await restarted.dispatch('push', { data: { json: () => ({ data: { tipo: 'LIKE' } }) } })
    expect(restarted.showNotification).not.toHaveBeenCalled()
  })
})
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('trama-token', 'auth-test')
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') })
  vi.stubGlobal('navigator', { serviceWorker })
  fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(config)))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { localStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals() })

describe('notificaciones del dispositivo', () => {
  it('solo activa el dispositivo despues de registrar el token con el JWT', async () => {
    await enableNotifications('receiver', 'auth-test')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/push-notifications/device-tokens', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer auth-test' }),
      body: JSON.stringify({ token: 'device-test', plataforma: 'WEB' }),
    }))
    expect(JSON.parse(localStorage.getItem('trama-push-device')!)).toEqual({ userId: 'receiver', token: 'device-test' })
  })

  it('no marca como activado un registro rechazado por el servidor', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(config))).mockResolvedValueOnce(new Response('', { status: 503 }))
    await expect(enableNotifications('receiver', 'auth-test')).rejects.toThrow(/servicio de notificaciones/)
    expect(localStorage.getItem('trama-push-device')).toBeNull()
  })

  it('no registra tokens ni vuelve a pedir permiso cuando esta bloqueado', async () => {
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() })
    await expect(enableNotifications('receiver', 'auth-test')).rejects.toThrow(/bloqueadas/)
    expect(Notification.requestPermission).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancela el registro si la sesion cambio durante la solicitud', async () => {
    firebase.getToken.mockImplementationOnce(async () => { localStorage.removeItem('trama-token'); return 'device-test' })
    await expect(enableNotifications('receiver', 'auth-test')).rejects.toThrow(/sesión/)
    expect(fetchMock).not.toHaveBeenCalledWith('/api/push-notifications/device-tokens', expect.objectContaining({ method: 'POST' }))
    expect(localStorage.getItem('trama-push-device')).toBeNull()
  })

  it('desactiva la recepcion local aunque falle la baja remota', async () => {
    localStorage.setItem('trama-push-device', JSON.stringify({ userId: 'receiver', token: 'device-test' }))
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await expect(disableNotifications('auth-test')).rejects.toThrow('offline')
    expect(localStorage.getItem('trama-push-device')).toBeNull()
    expect(unsubscribe).toHaveBeenCalled()
    expect(worker.active.postMessage).toHaveBeenCalledWith({ type: 'TRAMA_PUSH_ENABLED', enabled: false }, expect.any(Array))
  })

  it('filtra mensajes de otra cuenta y retira el listener al cerrar', () => {
    const receive = vi.fn()
    localStorage.setItem('trama-push-device', JSON.stringify({ userId: 'receiver', token: 'device-test' }))
    const stop = listenNotifications('receiver', receive)
    const message = () => new MessageEvent('message', { data: { type: 'TRAMA_PUSH', payload: { messageId: 'one', notification: { title: 'Like' } } } })
    serviceWorker.dispatchEvent(message())
    expect(receive).toHaveBeenCalledTimes(1)
    localStorage.removeItem('trama-push-device')
    serviceWorker.dispatchEvent(message())
    expect(receive).toHaveBeenCalledTimes(1)
    stop()
  })

  it('rechaza cargas invalidas y restringe los enlaces a Trama', () => {
    expect(parsePushNotice(null)).toBeNull()
    expect(parsePushNotice({ notification: { title: 42 } })).toBeNull()
    expect(notificationPath({ postId: 'post/1' })).toBe('/obra/post%2F1')
    expect(notificationPath({ url: 'https://otro.example/obra/post' })).toBe('/inicio')
    expect(notificationPath({ url: 'javascript:alert(1)' })).toBe('/inicio')
    expect(notificationPath({ url: '/user/artista' })).toBe('/user/artista')
  })

  it('presenta el payload real del modulo Push con un enlace a la obra', () => {
    expect(parsePushNotice({ messageId: 'like', data: { tipo: 'LIKE', resourceId: 'post-id' } })).toEqual({
      id: 'like', title: 'Nuevo me gusta', body: 'Tu obra recibió un me gusta.', path: '/obra/post-id',
    })
    expect(parsePushNotice({ data: { tipo: 'COMMENT', resourceId: 'post-id' } })?.title).toBe('Nuevo comentario')
  })
})