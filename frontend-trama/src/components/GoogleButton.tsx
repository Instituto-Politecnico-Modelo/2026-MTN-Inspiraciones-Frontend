import { useEffect, useRef } from 'react'
import { googleClientId, loadGoogleIdentity } from '../lib/googleIdentity'

export function GoogleButton({ onCredential }: { onCredential: (idToken: string) => Promise<void> | void }) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const handler = useRef(onCredential)
  useEffect(() => { handler.current = onCredential })
  useEffect(() => {
    if (!googleClientId) return
    let active = true
    void loadGoogleIdentity().then(api => {
      if (!active || !buttonRef.current) return
      api.initialize({ client_id: googleClientId, callback: response => void handler.current(response.credential) })
      buttonRef.current.replaceChildren()
      api.renderButton(buttonRef.current, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 360, locale: 'es' })
    }).catch(error => console.error('[Trama] No se pudo preparar el botón de Google.', error))
    return () => { active = false }
  }, [])
  if (!googleClientId) return null
  return <div className="google-signin" ref={buttonRef} />
}
