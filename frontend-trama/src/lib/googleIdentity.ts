const GIS_SCRIPT = 'https://accounts.google.com/gsi/client'

export const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()

export type GoogleIdApi = {
  initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; auto_select?: boolean }) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } }
  }
}

let loading: Promise<GoogleIdApi> | null = null

export function loadGoogleIdentity(): Promise<GoogleIdApi> {
  const ready = window.google?.accounts.id
  if (ready) return Promise.resolve(ready)
  loading ??= new Promise<GoogleIdApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SCRIPT
    script.async = true
    script.onload = () => {
      const api = window.google?.accounts.id
      if (api) resolve(api)
      else reject(new Error('Google no respondió al cargar el ingreso.'))
    }
    script.onerror = () => {
      script.remove()
      loading = null
      reject(new Error('No se pudo cargar el ingreso con Google. Revisá tu conexión.'))
    }
    document.head.append(script)
  })
  return loading
}
