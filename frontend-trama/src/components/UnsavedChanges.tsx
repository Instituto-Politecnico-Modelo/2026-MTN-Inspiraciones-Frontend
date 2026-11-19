import { useCallback, useRef } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import { Button, Modal } from './UI'

export function useUnsavedChanges(dirty: boolean, saving = false) {
  const allowed = useRef(false)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !allowed.current &&
    `${currentLocation.pathname}${currentLocation.search}` !== `${nextLocation.pathname}${nextLocation.search}`)
  useBeforeUnload(useCallback(event => {
    if (dirty && !allowed.current) { event.preventDefault(); event.returnValue = '' }
  }, [dirty]))
  return {
    allow: () => { allowed.current = true },
    dialog: <Modal open={blocker.state === 'blocked'} title={saving ? 'Guardando tus cambios' : 'Tenés cambios sin guardar'} description={saving ? 'Esperá a que termine el guardado antes de salir.' : 'Si salís ahora, se perderán los cambios de este formulario.'} busy={saving} onClose={() => blocker.reset?.()}>
      <div className="dialog-actions"><Button variant="secondary" disabled={saving} onClick={() => blocker.reset?.()}>Seguir editando</Button>
        <Button variant="danger" disabled={saving} onClick={() => blocker.proceed?.()}>Salir sin guardar</Button></div>
    </Modal>,
  }
}
