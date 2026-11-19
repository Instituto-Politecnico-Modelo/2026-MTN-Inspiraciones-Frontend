import { useState } from 'react'
import type { Command } from '../data/model'
import { useAction } from '../context/DemoContext'
import { Button, ErrorMessage, Modal, TextArea } from './UI'

export type Confirmation = {
  title: string
  description: string
  label: string
  command: (note: string) => Command
  reason?: boolean
  maxReasonLength?: number
  dangerous?: boolean
  success: string
}

export function CommandDialog({ confirmation, onClose, onDone }: { confirmation: Confirmation | null; onClose: () => void; onDone?: () => void }) {
  const [note, setNote] = useState('')
  const { run, pending, error } = useAction()
  if (!confirmation) return null
  return <Modal open title={confirmation.title} description={confirmation.description} onClose={onClose} busy={pending}>
    <form onSubmit={event => {
      event.preventDefault()
      void run(confirmation.command(note), confirmation.success).then(result => { if (result) { onClose(); onDone?.() } })
    }}>
      {confirmation.reason && <TextArea label="Motivo de la decisión" hint="Quedará registrado en la actividad de administración." required minLength={5} maxLength={confirmation.maxReasonLength ?? 1500} value={note} onChange={event => setNote(event.target.value)} />}
      <ErrorMessage message={error} />
      <div className="dialog-actions"><Button variant="secondary" disabled={pending} onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={pending} variant={confirmation.dangerous ? 'danger' : 'primary'}>{confirmation.label}</Button></div>
    </form>
  </Modal>
}
