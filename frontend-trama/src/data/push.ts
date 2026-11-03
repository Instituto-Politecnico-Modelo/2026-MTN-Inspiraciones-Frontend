import type { FirebaseOptions } from 'firebase/app'
import { z } from 'zod'
import { getToken } from './api'

const BASE = '/api/push-notifications'
const DEVICE_KEY = 'trama-push-device'
const deviceSchema = z.object({ userId: z.string(), token: z.string().min(1) })
const messageSchema = z.object({
  messageId: z.string().optional(),
  fcmMessageId: z.string().optional(),
  notification: z.object({ title: z.string().optional(), body: z.string().optional() }).optional(),
  data: z.record(z.string(), z.string()).optional(),
})
export type PushNotice = { id: string; title: string; body: string; path: string }
type WebConfig = FirebaseOptions & { vapidKey: string }

function storedDevice() {
  try { return deviceSchema.parse(JSON.parse(localStorage.getItem(DEVICE_KEY) ?? 'null')) } catch { return null }
}

export function notificationsEnabled(userId: string) {
  return storedDevice()?.userId === userId && typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

export function notificationPath(data: Record<string, string> = {}) {
  const postId = data.publicacionId || data.postId || (['LIKE', 'COMMENT'].includes(data.tipo) && data.resourceType !== 'COMMENT' ? data.resourceId : '')
  if (postId) return `/obra/${encodeURIComponent(postId)}`
  if (data.url) {
    try {
      const url = new URL(data.url, location.origin)
      if (url.origin === location.origin && /^\/(obra\/|user\/|perfil\/|desafios\/|inicio(?:$|\?))/.test(url.pathname)) return url.pathname + url.search + url.hash
    } catch { return '/inicio' }
  }
  return '/inicio'
}

export function parsePushNotice(value: unknown): PushNotice | null {
  const result = messageSchema.safeParse(value)
  if (!result.success || (!result.data.notification && !result.data.data)) return null
  const payload = result.data
  const type = payload.data?.tipo
  const title = type === 'LIKE' ? 'Nuevo me gusta' : type === 'COMMENT' ? 'Nuevo comentario' : 'Trama'
  const body = type === 'LIKE' ? 'Tu obra recibió un me gusta.' : type === 'COMMENT' ? 'Tu obra recibió un comentario.' : 'Tenés una nueva notificación.'
  return {
    id: payload.messageId || payload.fcmMessageId || payload.data?.notificacionId || crypto.randomUUID(),
    title: (payload.notification?.title || payload.data?.title || title).slice(0, 120),
    body: (payload.notification?.body || payload.data?.body || body).slice(0, 500),
    path: notificationPath(payload.data),
  }
}

async function request(path: string, authToken: string, method = 'GET', body?: unknown) {
  if (!authToken) throw new Error('Ingresá nuevamente para activar las notificaciones.')
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${authToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(response.status === 503
    ? 'El servicio de notificaciones no está configurado o no está disponible.'
    : 'No pudimos conectar las notificaciones. Intentá nuevamente.')
  return response.status === 204 ? undefined : response.json()
}

async function messaging(authToken: string) {
  const [firebase, sdk, config] = await Promise.all([
    import('firebase/app'), import('firebase/messaging'), request('/config', authToken) as Promise<WebConfig>,
  ])
  const parsed = z.object({ apiKey: z.string().min(1), appId: z.string().min(1), projectId: z.string().min(1), messagingSenderId: z.string().min(1), vapidKey: z.string().min(1) }).safeParse(config)
  if (!parsed.success) throw new Error('La configuración de notificaciones web está incompleta.')
  if (!await sdk.isSupported()) throw new Error('Este navegador no admite notificaciones push.')
  const app = firebase.getApps().find(item => item.name === 'trama-push') ?? firebase.initializeApp(config, 'trama-push')
  return { sdk, client: sdk.getMessaging(app), config }
}

async function setDeviceActive(enabled: boolean) {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration('/push-sw.js')
  if (!registration?.active) {
    if (enabled) throw new Error('No pudimos iniciar las notificaciones en segundo plano.')
    return
  }
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel()
    const finish = (ok: boolean) => {
      clearTimeout(timeout)
      channel.port1.close()
      channel.port2.close()
      if (ok) resolve()
      else reject(new Error('No pudimos actualizar las notificaciones del dispositivo.'))
    }
    const timeout = setTimeout(() => finish(false), 5000)
    channel.port1.onmessage = event => finish(event.data?.ok === true)
    registration.active!.postMessage({ type: 'TRAMA_PUSH_ENABLED', enabled }, [channel.port2])
  })
}

export async function enableNotifications(userId: string, authToken: string) {
  if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('Las notificaciones requieren un navegador compatible y HTTPS o localhost.')
  }
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  if (permission !== 'granted') throw new Error(permission === 'denied'
    ? 'Las notificaciones están bloqueadas en los permisos de este sitio.'
    : 'No se concedió el permiso de notificaciones.')
  const { sdk, client, config } = await messaging(authToken)
  const registration = await navigator.serviceWorker.register('/push-sw.js')
  await navigator.serviceWorker.ready
  const token = await sdk.getToken(client, { vapidKey: config.vapidKey, serviceWorkerRegistration: registration })
  if (!token) throw new Error('No pudimos registrar este dispositivo.')
  if (getToken() !== authToken) throw new Error('La sesión cambió. Activá las notificaciones nuevamente.')
  await request('/device-tokens', authToken, 'POST', { token, plataforma: 'WEB' })
  localStorage.setItem(DEVICE_KEY, JSON.stringify({ userId, token }))
  try {
    await setDeviceActive(true)
    if (getToken() !== authToken) throw new Error('La sesión cambió. Activá las notificaciones nuevamente.')
  } catch (failure) {
    await disableNotifications(authToken).catch(() => undefined)
    throw failure
  }
}

export async function disableNotifications(authToken: string) {
  const device = storedDevice()
  localStorage.removeItem(DEVICE_KEY)
  try { await setDeviceActive(false) } finally {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/push-sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      await subscription?.unsubscribe()
    }
    if (device) await request('/device-tokens', authToken, 'DELETE', { token: device.token })
  }
}

export function listenNotifications(userId: string, receive: (notice: PushNotice) => void) {
  if (!('serviceWorker' in navigator)) return () => {}
  const listener = (event: MessageEvent) => {
    if (storedDevice()?.userId !== userId || event.data?.type !== 'TRAMA_PUSH') return
    const notice = parsePushNotice(event.data.payload)
    if (notice) receive(notice)
  }
  navigator.serviceWorker.addEventListener('message', listener)
  return () => navigator.serviceWorker.removeEventListener('message', listener)
}