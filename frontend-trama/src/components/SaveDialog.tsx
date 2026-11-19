import { useState } from 'react'
import { FolderLock, Plus } from 'lucide-react'
import { useAction, useDemo } from '../context/DemoContext'
import { newId, privateFolders } from '../data/store'
import type { Post } from '../data/model'
import { Button, ErrorMessage, Field, Modal } from './UI'

export function SaveDialog({ post, onClose }: { post: Post; onClose: () => void }) {
  const { state, user } = useDemo()
  const { run, pending, error } = useAction()
  const [name, setName] = useState('')
  if (!user) return null
  const folders = privateFolders(state, user.id, user.id)
  return <Modal open title="Guardar inspiración" description="Tus carpetas son privadas. Los cambios se guardan al seleccionarlas." onClose={onClose} busy={pending}>
    <div className="save-preview"><img src={post.kind === 'audio' ? post.cover || '/media/sonido.svg' : post.src} alt="" /><strong>{post.title}</strong></div>
    <div className="folder-options">{folders.map(folder => <label className="folder-option" key={folder.id}>
      <FolderLock size={21} aria-hidden="true" /><span>{folder.name}<small>{folder.postIds.length} {folder.postIds.length === 1 ? 'obra' : 'obras'}</small></span>
      <input type="checkbox" checked={folder.postIds.includes(post.id)} disabled={pending} onChange={event => void run({ type: event.target.checked ? 'save-to-folder' : 'remove-from-folder', folderId: folder.id, postId: post.id }, event.target.checked ? 'Obra guardada en tu carpeta privada.' : 'Obra quitada de la carpeta.')} />
    </label>)}</div>
    {!folders.length && <p className="muted">Creá tu primera carpeta para guardar esta obra.</p>}
    <form className="new-folder-form" onSubmit={event => {
      event.preventDefault()
      const id = newId('carpeta')
      void run({ type: 'create-folder', id, name }).then(async result => {
        if (result && await run({ type: 'save-to-folder', folderId: id, postId: post.id }, 'Carpeta creada y obra guardada.')) setName('')
      })
    }}><Field label="Nueva carpeta" placeholder="Por ejemplo, formas que me inspiran" value={name} onChange={event => setName(event.target.value)} required maxLength={60} />
      <Button type="submit" variant="secondary" loading={pending}><Plus size={18} aria-hidden="true" />Crear y guardar</Button>
    </form>
    <ErrorMessage message={error} /><div className="dialog-actions"><Button onClick={onClose} disabled={pending}>Listo</Button></div>
  </Modal>
}
