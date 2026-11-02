import { z } from 'zod'
import {
  AccountSchema, AppealSchema, ChallengeSchema, CommentSchema, FolderSchema, PostChangesSchema,
  PostSchema, ProfileSchema, ReportSchema, RequestSchema, StateSchema, UserSchema,
  type Challenge, type Command, type DemoState, type MediaKind, type Post, type User,
} from './model'
export { createSeed } from './seed'

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? 'Revisá los datos del formulario.'
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return 'No queda espacio en este navegador. No se guardaron los cambios. Probá con un archivo más pequeño.'
  if (error instanceof Error) return error.message
  return 'No pudimos completar la operación. Volvé a intentar.'
}

function requireValue<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message)
  return value
}

export function visiblePosts(state: DemoState): Post[] {
  const active = new Set(state.users.filter(user => user.status === 'active').map(user => user.id))
  const blocked = new Set(state.blocks.map(block => block.blockedId))
  return state.posts.filter(post => post.status === 'published' && active.has(post.authorId) && !blocked.has(post.authorId))
}

export function privateFolders(state: DemoState, ownerId: string, viewerId: string | null) {
  return ownerId === viewerId ? state.folders.filter(folder => folder.ownerId === ownerId) : []
}

export function searchPosts(state: DemoState, filters: { query?: string; kind?: MediaKind; discipline?: string; technique?: string; following?: string; challenge?: string } = {}) {
  const query = normalize(filters.query ?? '')
  const followed = new Set(state.follows.filter(follow => follow.followerId === filters.following).map(follow => follow.followingId))
  return visiblePosts(state).filter(post => {
    const author = state.users.find(user => user.id === post.authorId)
    return (!filters.kind || post.kind === filters.kind) &&
      (!filters.discipline || post.discipline === filters.discipline) &&
      (!filters.technique || post.technique === filters.technique) &&
      (!filters.following || followed.has(post.authorId)) &&
      (!filters.challenge || post.challengeId === filters.challenge) &&
      (!query || normalize(`${post.title} ${post.description} ${post.discipline} ${post.technique} ${author?.name ?? ''}`).includes(query))
  })
}

export function challengeStatus(challenge: Challenge, now = new Date().toISOString()): 'open' | 'upcoming' | 'closed' | 'archived' {
  if (challenge.archived) return 'archived'
  if (Date.parse(now) < Date.parse(challenge.startsAt)) return 'upcoming'
  return Date.parse(now) >= Date.parse(challenge.endsAt) ? 'closed' : 'open'
}

const noteSchema = z.string().trim().min(5, 'Explicá el motivo con al menos 5 caracteres.').max(1500)

export function applyCommand(original: DemoState, actorId: string | null, command: Command, now = new Date().toISOString()): DemoState {
  const state = structuredClone(original)
  const fresh = (collection: { id: string }[], id: string) => {
    if (collection.some(item => item.id === id)) throw new Error('Esta operación ya fue registrada. Actualizá la página.')
  }
  if (command.type === 'create-account') {
    const account = AccountSchema.parse(command.user)
    fresh(state.users, account.id)
    if (state.users.some(user => normalize(user.email) === normalize(account.email))) throw new Error('Ese correo ya tiene un perfil en esta demo.')
    if (state.users.some(user => normalize(user.handle) === normalize(account.handle))) throw new Error('Ese nombre de usuario ya está en uso.')
    state.users.push(UserSchema.parse({
      ...account, role: 'artist', status: 'active', bio: '', location: '', website: '', avatar: '',
      disciplines: [], inspirations: [], joinedAt: now, suspensionReason: '',
    }))
    state.revision++
    return StateSchema.parse(state)
  }

  const actor = requireValue(state.users.find(user => user.id === actorId), 'Tenés que ingresar a la demo para continuar.')
  if (actor.status === 'deleted') throw new Error('Esta cuenta ya no está disponible.')
  if (actor.status === 'suspended' && command.type !== 'create-appeal') throw new Error('Esta cuenta está suspendida. Podés solicitar una revisión.')

  const admin = () => {
    if (actor.role !== 'admin') throw new Error('Esta acción requiere una cuenta de administrador.')
  }
  const postById = (id: string) => requireValue(state.posts.find(post => post.id === id), 'La publicación no está disponible.')
  const publicPost = (id: string) => requireValue(visiblePosts(state).find(post => post.id === id), 'La publicación no está disponible.')
  const ownFolder = (id: string) => requireValue(state.folders.find(folder => folder.id === id && folder.ownerId === actor.id), 'Esta carpeta es privada o no está disponible.')
  const log = (label: string, targetId: string) => state.audit.push({ id: newId('accion'), actorId: actor.id, label, targetId, createdAt: now })
  const checkParticipation = (challengeId: string, kind: MediaKind) => {
    const challenge = requireValue(state.challenges.find(item => item.id === challengeId), 'El desafío no está disponible.')
    if (challengeStatus(challenge, now) !== 'open') throw new Error('Este desafío ya no está abierto.')
    if (!challenge.kinds.includes(kind)) throw new Error('Este formato no está admitido por la consigna.')
  }

  switch (command.type) {
    case 'update-profile': {
      const changes = ProfileSchema.parse(command.changes)
      if (state.users.some(user => user.id !== actor.id && normalize(user.handle) === normalize(changes.handle))) throw new Error('Ese nombre de usuario ya está en uso.')
      Object.assign(actor, changes)
      break
    }
    case 'set-interests':
      Object.assign(actor, UserSchema.pick({ disciplines: true, inspirations: true }).parse(command))
      break
    case 'toggle-like': {
      const post = publicPost(command.postId)
      post.likes = post.likes.includes(actor.id) ? post.likes.filter(id => id !== actor.id) : [...post.likes, actor.id]
      break
    }
    case 'toggle-follow': {
      if (command.userId === actor.id) throw new Error('No podés seguir tu propio perfil.')
      requireValue(state.users.find(user => user.id === command.userId && user.status === 'active'), 'Este perfil no está disponible.')
      const index = state.follows.findIndex(follow => follow.followerId === actor.id && follow.followingId === command.userId)
      if (index >= 0) state.follows.splice(index, 1)
      else state.follows.push({ followerId: actor.id, followingId: command.userId })
      break
    }
    case 'toggle-block': {
      if (command.userId === actor.id) throw new Error('No podés bloquear tu propia cuenta.')
      requireValue(state.users.find(user => user.id === command.userId), 'Este perfil no está disponible.')
      const index = state.blocks.findIndex(block => block.blockerId === actor.id && block.blockedId === command.userId)
      if (index >= 0) state.blocks.splice(index, 1)
      else {
        state.blocks.push({ blockerId: actor.id, blockedId: command.userId })
        state.follows = state.follows.filter(follow => !(follow.followerId === actor.id && follow.followingId === command.userId) && !(follow.followerId === command.userId && follow.followingId === actor.id))
      }
      break
    }
    case 'create-folder':
    case 'rename-folder': {
      const name = FolderSchema.shape.name.parse(command.name)
      const existing = command.type === 'rename-folder' ? ownFolder(command.folderId) : null
      if (state.folders.some(folder => folder.ownerId === actor.id && normalize(folder.name) === normalize(name) && folder.id !== existing?.id)) throw new Error('Ya existe una carpeta con ese nombre.')
      if (existing) existing.name = name
      else if (command.type === 'create-folder') {
        fresh(state.folders, command.id)
        state.folders.push(FolderSchema.parse({ id: command.id, ownerId: actor.id, name, postIds: [] }))
      }
      break
    }
    case 'delete-folder':
      ownFolder(command.folderId)
      state.folders = state.folders.filter(folder => folder.id !== command.folderId)
      break
    case 'save-to-folder':
    case 'remove-from-folder': {
      const folder = ownFolder(command.folderId)
      if (command.type === 'save-to-folder') {
        publicPost(command.postId)
        if (!folder.postIds.includes(command.postId)) folder.postIds.push(command.postId)
      } else folder.postIds = folder.postIds.filter(id => id !== command.postId)
      break
    }
    case 'create-post': {
      fresh(state.posts, command.post.id)
      const post = PostSchema.parse({ ...command.post, authorId: actor.id, status: 'published', createdAt: now, likes: [], comments: [] })
      if (!post.alt) throw new Error(post.kind === 'image' ? 'Agregá una descripción de la imagen para que sea accesible.' : 'Describí el contenido del audio; agregá una transcripción si tiene voz.')
      if (post.kind === 'audio' && post.duration <= 0) throw new Error('No pudimos leer la duración del audio.')
      if (post.challengeId) checkParticipation(post.challengeId, post.kind)
      state.posts.unshift(post)
      break
    }
    case 'update-post': {
      const post = postById(command.postId)
      if (post.authorId !== actor.id) throw new Error('Solo podés editar tus propias publicaciones.')
      if (post.status === 'deleted') throw new Error('Esta publicación fue eliminada.')
      const changes = PostChangesSchema.parse(command.changes)
      if (!changes.alt) throw new Error('Agregá una descripción accesible del contenido.')
      Object.assign(post, changes)
      break
    }
    case 'add-comment': {
      const post = publicPost(command.postId)
      fresh(post.comments, command.id)
      post.comments.push(CommentSchema.parse({ id: command.id, authorId: actor.id, text: command.text, createdAt: now }))
      break
    }
    case 'delete-comment': {
      const post = postById(command.postId)
      const comment = requireValue(post.comments.find(item => item.id === command.commentId), 'El comentario ya no está disponible.')
      if (comment.authorId !== actor.id && actor.role !== 'admin') throw new Error('No tenés permiso para eliminar este comentario.')
      post.comments = post.comments.filter(item => item.id !== command.commentId)
      break
    }
    case 'delete-post':
    case 'moderate-post': {
      const post = postById(command.postId)
      if (command.type === 'delete-post') {
        if (post.authorId !== actor.id) throw new Error('Solo podés eliminar tus propias publicaciones.')
        post.status = 'deleted'
      } else {
        admin()
        const reason = noteSchema.parse(command.reason)
        if (post.status === 'deleted') throw new Error('La publicación ya fue eliminada y no puede modificarse.')
        post.status = command.status
        log(`${command.status === 'hidden' ? 'Ocultó' : command.status === 'deleted' ? 'Eliminó' : 'Restauró'} «${post.title}». ${reason}`, post.id)
      }
      break
    }
    case 'set-user-status': {
      admin()
      const target = requireValue(state.users.find(user => user.id === command.userId), 'La cuenta no está disponible.')
      if (target.id === actor.id) throw new Error('No podés realizar esta acción sobre tu propia cuenta.')
      if (target.status === 'deleted') throw new Error('Esta cuenta ya fue eliminada.')
      const reason = noteSchema.parse(command.reason)
      target.status = command.status
      target.suspensionReason = command.status === 'suspended' ? reason : ''
      if (command.status === 'deleted') {
        state.posts.forEach(post => {
          if (post.authorId === target.id) post.status = 'deleted'
          post.likes = post.likes.filter(id => id !== target.id)
          post.comments = post.comments.filter(comment => comment.authorId !== target.id)
        })
        state.folders = state.folders.filter(folder => folder.ownerId !== target.id)
        state.follows = state.follows.filter(follow => follow.followerId !== target.id && follow.followingId !== target.id)
      }
      log(`${command.status === 'active' ? 'Reactivó' : command.status === 'suspended' ? 'Suspendió' : 'Eliminó'} a ${target.name}. ${reason}`, target.id)
      break
    }
    case 'change-role': {
      admin()
      const target = requireValue(state.users.find(user => user.id === command.userId && user.status === 'active'), 'La cuenta debe estar activa para cambiar su rol.')
      if (target.id === actor.id) throw new Error('No podés cambiar el acceso de tu propia cuenta.')
      target.role = command.role
      log(`Cambió el rol de ${target.name} a ${command.role === 'admin' ? 'administrador' : 'artista'}.`, target.id)
      break
    }
    case 'save-challenge': {
      admin()
      const existing = state.challenges.find(challenge => challenge.id === command.challenge.id)
      const challenge = ChallengeSchema.parse({ ...command.challenge, createdBy: existing?.createdBy ?? actor.id })
      if (challenge.requestId) {
        requireValue(state.requests.find(request => request.id === challenge.requestId && request.status === 'approved'), 'La propuesta debe estar aprobada antes de publicarse.')
        if (state.challenges.some(item => item.requestId === challenge.requestId && item.id !== challenge.id)) throw new Error('Esta propuesta ya tiene un desafío publicado.')
      }
      if (existing) Object.assign(existing, challenge)
      else state.challenges.unshift(challenge)
      log(`${existing ? 'Editó' : 'Publicó'} el desafío «${challenge.title}».`, challenge.id)
      break
    }
    case 'archive-challenge': {
      admin()
      const challenge = requireValue(state.challenges.find(item => item.id === command.challengeId), 'El desafío no está disponible.')
      challenge.archived = command.archived
      log(`${command.archived ? 'Archivó' : 'Restauró'} el desafío «${challenge.title}».`, challenge.id)
      break
    }
    case 'join-challenge': {
      const post = publicPost(command.postId)
      if (post.authorId !== actor.id) throw new Error('Elegí una obra propia para participar.')
      checkParticipation(command.challengeId, post.kind)
      if (post.challengeId && post.challengeId !== command.challengeId) throw new Error('Esta obra ya participa de otro desafío.')
      post.challengeId = command.challengeId
      break
    }
    case 'create-request':
      fresh(state.requests, command.request.id)
      state.requests.unshift(RequestSchema.parse({ ...command.request, authorId: actor.id, status: 'pending', createdAt: now, note: '', resolvedAt: null, resolvedBy: null }))
      break
    case 'review-request': {
      admin()
      const request = requireValue(state.requests.find(item => item.id === command.requestId), 'La solicitud no está disponible.')
      if (request.status !== 'pending') throw new Error('Esta solicitud ya fue resuelta.')
      Object.assign(request, { status: command.status, note: noteSchema.parse(command.note), resolvedAt: now, resolvedBy: actor.id })
      log(`${command.status === 'approved' ? 'Aprobó' : 'Rechazó'} la propuesta «${request.title}».`, request.id)
      break
    }
    case 'create-report': {
      publicPost(command.report.postId)
      if (state.reports.some(report => report.postId === command.report.postId && report.authorId === actor.id && report.status === 'pending')) throw new Error('Ya enviaste un reporte de esta obra. Está pendiente de revisión.')
      fresh(state.reports, command.report.id)
      state.reports.unshift(ReportSchema.parse({ ...command.report, authorId: actor.id, status: 'pending', createdAt: now, note: '', resolvedAt: null, resolvedBy: null }))
      break
    }
    case 'review-report': {
      admin()
      const report = requireValue(state.reports.find(item => item.id === command.reportId), 'El reporte no está disponible.')
      if (report.status !== 'pending') throw new Error('Este reporte ya fue resuelto.')
      Object.assign(report, { status: command.status, note: noteSchema.parse(command.note), resolvedAt: now, resolvedBy: actor.id })
      if (command.status === 'accepted') {
        const post = postById(report.postId)
        if (post.status !== 'deleted') post.status = 'hidden'
      }
      log(`${command.status === 'accepted' ? 'Aceptó' : 'Desestimó'} el reporte de «${postById(report.postId).title}».`, report.id)
      break
    }
    case 'create-appeal':
      if (actor.status !== 'suspended') throw new Error('Tu cuenta no está suspendida.')
      if (state.appeals.some(appeal => appeal.authorId === actor.id && appeal.status === 'pending')) throw new Error('Ya hay una apelación pendiente de revisión.')
      fresh(state.appeals, command.id)
      state.appeals.unshift(AppealSchema.parse({ id: command.id, authorId: actor.id, description: command.description, status: 'pending', createdAt: now, note: '', resolvedAt: null, resolvedBy: null }))
      break
    case 'review-appeal': {
      admin()
      const appeal = requireValue(state.appeals.find(item => item.id === command.appealId), 'La apelación no está disponible.')
      if (appeal.status !== 'pending') throw new Error('Esta apelación ya fue resuelta.')
      const target = requireValue(state.users.find(user => user.id === appeal.authorId && user.status !== 'deleted'), 'Esta cuenta ya no está disponible.')
      Object.assign(appeal, { status: command.status, note: noteSchema.parse(command.note), resolvedAt: now, resolvedBy: actor.id })
      if (command.status === 'approved') {
        target.status = 'active'
        target.suspensionReason = ''
      }
      log(`${command.status === 'approved' ? 'Aceptó' : 'Rechazó'} la apelación de ${target.name}.`, appeal.id)
      break
    }
  }
  state.revision++
  return StateSchema.parse(state)
}

export function validateFile(file: Pick<File, 'type' | 'size'>): MediaKind {
  if (file.size === 0) throw new Error('El archivo está vacío.')
  const kind = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? 'image'
    : ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4'].includes(file.type) ? 'audio' : null
  if (!kind) throw new Error('Formato no admitido. Usá JPG, PNG, WebP, MP3, WAV, Ogg o M4A.')
  const limit = kind === 'image' ? 8 : 16
  if (file.size > limit * 1024 * 1024) throw new Error(`El archivo supera el límite de ${limit} MB.`)
  return kind
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number>>): string {
  return '\uFEFF' + rows.map(row => row.map(value => {
    const text = String(value)
    const safe = typeof value === 'string' && (/^[\s]*[=+@-]/.test(text) || /^[\t\r]/.test(text)) ? `'${text}` : text
    return `"${safe.replaceAll('"', '""')}"`
  }).join(',')).join('\r\n')
}

export function canManage(user: User | null): boolean {
  return user?.role === 'admin' && user.status === 'active'
}
