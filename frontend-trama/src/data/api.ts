import type {
  Appeal, Challenge, Command, DemoState, Discipline, Folder, Post, Proposal, Report, User,
} from './model'
import { disciplines, inspirationTypes, reportReasons } from './model'

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const TOKEN_KEY = 'trama-token'
const MARK = '\u2063trama:'
const MAX_CONTENT = 2000

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code = '') { super(message) }
}

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Page<T> = { items?: T[]; contenido?: T[]; nextCursor?: string | null; siguienteCursor?: string | null }

export const assetUrl = (url: string | null | undefined) => !url ? '' : url.startsWith('/') ? `${BASE}${url}` : url

function pack(text: string, meta: Json) {
  return `${text}${MARK}${JSON.stringify(meta)}`
}

function unpack(raw: string | null | undefined): { text: string; meta: Json } {
  const value = raw ?? ''
  const index = value.indexOf(MARK)
  if (index < 0) return { text: value, meta: {} }
  try { return { text: value.slice(0, index), meta: JSON.parse(value.slice(index + MARK.length)) as Json } } catch { return { text: value.slice(0, index), meta: {} } }
}

const ambitoByDiscipline: Record<Discipline, string> = {
  'Ilustración': 'Ilustración', Pintura: 'Pintura', 'Fotografía': 'Fotografía', 'Cerámica': 'Escultura',
  Escultura: 'Escultura', 'Música': 'Música', Collage: 'Arte digital', 'Diseño': 'Arte digital',
}
const disciplineByAmbito: Record<string, Discipline> = {
  Dibujo: 'Ilustración', 'Ilustración': 'Ilustración', Pintura: 'Pintura', 'Fotografía': 'Fotografía',
  Escultura: 'Escultura', 'Música': 'Música', 'Arte digital': 'Diseño',
}
const generoByDiscipline: Record<Discipline, string> = {
  'Ilustración': 'GENERO_ILUSTRACION', Pintura: 'GENERO_ARTE', 'Fotografía': 'GENERO_FOTOGRAFIA', 'Cerámica': 'GENERO_ESCULTURA',
  Escultura: 'GENERO_ESCULTURA', 'Música': 'GENERO_MUSICA', Collage: 'GENERO_ARTE', 'Diseño': 'GENERO_EDITORIAL',
}
const reasonCode: Record<typeof reportReasons[number], string> = {
  'Autoría o derechos': 'PLAGIO_DERECHOS_AUTOR', 'Contenido inapropiado': 'CONTENIDO_INAPROPIADO', Spam: 'SPAM', 'Otro motivo': 'OTRO',
}
const reasonByCode = Object.fromEntries(Object.entries(reasonCode).map(([label, code]) => [code, label])) as Record<string, typeof reportReasons[number]>

const emptyState = (): DemoState => ({
  version: 1, revision: 0, createdAt: new Date().toISOString(), users: [], posts: [], folders: [], follows: [], blocks: [],
  challenges: [], requests: [], reports: [], appeals: [], audit: [],
})

const uniq = <T,>(values: T[]) => [...new Set(values)]
const pickDisciplines = (value: unknown): Discipline[] => Array.isArray(value) ? value.filter((item): item is Discipline => disciplines.includes(item as Discipline)) : []
const pickInspirations = (value: unknown): User['inspirations'] => Array.isArray(value) ? value.filter((item): item is User['inspirations'][number] => inspirationTypes.includes(item as User['inspirations'][number])) : []

async function dataUrlToBlob(source: string): Promise<Blob> {
  const response = await fetch(source.startsWith('/') ? assetUrl(source) : source)
  if (!response.ok) throw new Error('No pudimos leer el archivo seleccionado.')
  return response.blob()
}

// Los desafíos solo aceptan PNG o JPEG; otros formatos (webp) se convierten.
async function toPngDataUrl(source: string): Promise<string> {
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('No pudimos preparar la imagen para el desafío.'))
    image.src = source
  })
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  canvas.getContext('2d')?.drawImage(image, 0, 0)
  return canvas.toDataURL('image/png')
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No pudimos leer la imagen.'))
    reader.onerror = () => reject(new Error('No pudimos leer la imagen.'))
    reader.readAsDataURL(blob)
  })
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

async function http<T = Json>(method: string, path: string, body?: unknown, form?: FormData): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) })
  } catch {
    throw new ApiError('No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.', 0)
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  let payload: Json
  try { payload = text ? JSON.parse(text) as Json : {} } catch { payload = {} }
  if (!response.ok) {
    if (response.status === 401 && token && !path.startsWith('/api/auth/')) localStorage.removeItem(TOKEN_KEY)
    const detail = typeof payload.message === 'string' ? payload.message : ''
    throw new ApiError(detail || (response.status === 403 ? 'No tenés permiso para realizar esta acción.' : response.status === 404 ? 'El recurso ya no está disponible.' : 'No pudimos completar la operación. Volvé a intentar.'), response.status, String(payload.code ?? ''))
  }
  return payload as T
}

const items = <T,>(page: Page<T> | T[] | undefined): T[] => Array.isArray(page) ? page : page?.items ?? page?.contenido ?? []

async function allPages<T>(path: string): Promise<T[]> {
  const result: T[] = []
  let cursor: string | null | undefined
  for (let guard = 0; guard < 50; guard++) {
    const page = await http<Page<T>>('GET', `${path}${path.includes('?') ? '&' : '?'}limite=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
    result.push(...items(page))
    cursor = page.nextCursor ?? page.siguienteCursor
    if (!cursor) break
  }
  return result
}

async function adminPages<T>(path: string): Promise<T[]> {
  const result: T[] = []
  for (let page = 0; page < 20; page++) {
    const response = await http<Json>('GET', `${path}${path.includes('?') ? '&' : '?'}pagina=${page}&tamanio=50`)
    const rows = items<T>(response as Page<T>)
    result.push(...rows)
    if (rows.length < 50) break
  }
  return result
}

async function uploadImage(source: string): Promise<string> {
  if (!source.startsWith('data:')) return source
  let blob = await dataUrlToBlob(source)
  if (blob.type !== 'image/png' && blob.type !== 'image/jpeg') blob = await dataUrlToBlob(await toPngDataUrl(source))
  const form = new FormData()
  form.append('imagen', blob, blob.type === 'image/jpeg' ? 'obra.jpg' : 'obra.png')
  const response = await http<{ url: string }>('POST', '/api/imagenes', undefined, form)
  return response.url
}

export type Session = { token: string; userId: string }

export class ApiRepository {
  private state: DemoState = emptyState()
  private versions = new Map<string, number>()
  private aliases = new Map<string, string>()
  private userCache = new Map<string, User>()

  resolveId = (id: string) => this.aliases.get(id) ?? id

  private rid(id: string) { return this.resolveId(id) }

  private likedIds(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(`trama-likes:${this.meId}`) ?? '[]') as string[]) } catch { return new Set() }
  }

  currentUserId() { return this.state.users.find(user => user.id === this.meId)?.id ?? this.meId }
  private meId: string | null = null

  async login(email: string, password: string): Promise<string> {
    const response = await http<{ accessToken: string; user: { id: string } }>('POST', '/api/auth/login', { email: email.trim(), password })
    localStorage.setItem(TOKEN_KEY, response.accessToken)
    this.meId = response.user.id
    return response.user.id
  }

  async register(input: { email: string; username: string; nombreCompleto: string; password: string }): Promise<string> {
    await http('POST', '/api/auth/register', input)
    return this.login(input.email, input.password)
  }

  async appeal(input: { email: string; password: string; mensaje: string }) {
    await http('POST', '/api/auth/appeals', input)
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY)
    this.meId = null
    this.state = emptyState()
    this.userCache.clear()
  }

  async load(): Promise<DemoState> {
    if (!getToken()) { this.meId = null; this.state = emptyState(); return this.state }
    try {
      this.state = await this.build()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { this.logout(); return this.state }
      throw error
    }
    return this.state
  }

  async close() { /* sin recursos locales */ }

  private toUser(raw: Json, extra: Partial<User> = {}): User {
    const { text, meta } = unpack(raw.descripcion as string | undefined)
    const known = this.userCache.get(raw.id as string)
    const user: User = {
      id: raw.id as string,
      name: (raw.nombreCompleto as string) || (raw.username as string) || 'Perfil',
      handle: String(raw.username ?? '').toLowerCase(),
      email: (raw.email as string) ?? known?.email ?? '',
      role: raw.role === 'ADMIN' ? 'admin' : known?.role ?? 'artist',
      status: raw.status === 'SUSPENDED' ? 'suspended' : raw.status === 'DELETED' ? 'deleted' : known?.status ?? 'active',
      bio: (raw.sobreMi as string) ?? '',
      location: text,
      website: typeof meta.w === 'string' ? meta.w : '',
      avatar: assetUrl(raw.avatarUrl as string | undefined),
      disciplines: pickDisciplines(meta.d),
      inspirations: pickInspirations(meta.i),
      joinedAt: (raw.createdAt as string) ?? known?.joinedAt ?? new Date(0).toISOString(),
      suspensionReason: known?.suspensionReason ?? '',
      ...extra,
    }
    this.userCache.set(user.id, user)
    return user
  }

  private async build(): Promise<DemoState> {
    const me = await http<Json>('GET', '/api/usuarios/me')
    this.meId = me.id as string
    const isAdmin = me.role === 'ADMIN'
    const meUser = this.toUser(me)

    const [rawPosts, rawFolders, rawChallenges, rawRequests] = await Promise.all([
      allPages<Json>('/api/publicaciones').catch(() => items(undefined as never) as Json[]),
      allPages<Json>(`/api/usuarios/${this.meId}/carpetas`),
      allPages<Json>('/api/desafios?'),
      allPages<Json>(isAdmin ? '/api/solicitudes?' : '/api/solicitudes/mis-solicitudes?'),
    ])
    const adminUsers = isAdmin ? await adminPages<Json>('/api/admin/usuarios') : []
    const adminPosts = isAdmin ? await adminPages<Json>('/api/admin/publicaciones?estado=ELIMINADA') : []
    const adminReports = isAdmin ? await adminPages<Json>('/api/admin/reportes') : []
    const adminAppeals = isAdmin ? await adminPages<Json>('/api/admin/apelaciones') : []
    const rawBlocks = await allPages<Json>('/api/usuarios/me/bloqueos').catch(() => [] as Json[])
    const blocks: DemoState['blocks'] = rawBlocks.map(raw => ({ blockerId: me.id as string, blockedId: raw.usuarioBloqueadoId as string }))

    const posts: Post[] = []
    const seen = new Set<string>()
    const commentsByPost = await Promise.all(rawPosts.map(post => Number(post.comentariosCount ?? 0) > 0 ? http<Page<Json>>('GET', `/api/publicaciones/${post.id}/comentarios`).then(items).catch(() => [] as Json[]) : Promise.resolve([] as Json[])))
    rawPosts.forEach((raw, index) => {
      if (!raw.fotoUrl) return
      seen.add(raw.id as string)
      posts.push(this.toPost(raw, commentsByPost[index]!, 'published'))
    })
    for (const raw of adminPosts) {
      if (seen.has(raw.id as string)) continue
      posts.push({
        id: raw.id as string, authorId: raw.autorId as string, title: String(raw.titulo ?? 'Obra eliminada').slice(0, 120),
        description: String(raw.descripcion ?? ''), alt: String(raw.titulo ?? ''), discipline: 'Ilustración', technique: '', kind: 'image',
        src: '', cover: '', width: 1, height: 1, duration: 0, license: '', credit: '', creditUrl: '', status: 'deleted',
        createdAt: (raw.fechaCreacion as string) ?? new Date(0).toISOString(), likes: [], comments: [], challengeId: null,
      })
    }

    const ownFolders = rawFolders.filter(folder => folder.creadorId === me.id)
    const folderPosts = await Promise.all(ownFolders.map(folder => http<Page<Json>>('GET', `/api/carpetas/${folder.id}/publicaciones?limite=20`).then(items).catch(() => [] as Json[])))
    const folders: Folder[] = ownFolders.map((folder, index) => ({
      id: folder.id as string, ownerId: me.id as string, name: folder.nombre as string,
      postIds: folderPosts[index]!.map(entry => String(entry.publicacionId ?? entry.id)),
    }))

    const answers = await Promise.all(rawChallenges.map(challenge => http<Page<Json>>('GET', `/api/desafios/${challenge.id}/respuestas?limite=20`).then(items).catch(() => [] as Json[])))
    const challengeOfPost = new Map<string, string>()
    answers.forEach((list, index) => list.forEach(answer => {
      const target = /trama-post:([\w-]+)/.exec(String(answer.descripcionLarga ?? answer.descripcion ?? ''))?.[1]
      if (target) challengeOfPost.set(target, rawChallenges[index]!.id as string)
    }))
    const stored = readChallengeLinks()
    const knownChallenges = new Set(rawChallenges.map(challenge => challenge.id as string))
    posts.forEach(post => {
      const linked = stored[post.id]
      post.challengeId = challengeOfPost.get(post.id) ?? (linked && knownChallenges.has(linked) ? linked : null)
    })

    this.versions.clear()
    const challenges: Challenge[] = rawChallenges.map(raw => {
      this.versions.set(raw.id as string, Number(raw.version ?? 0))
      const { text, meta } = unpack(raw.descripcionLarga as string | undefined)
      const cover = String(raw.fotoPrincipalUrl ?? '')
      return {
        id: raw.id as string, title: raw.nombre as string, description: text,
        disciplines: uniq(items<unknown>(raw.ambitos as unknown[]).map(item => disciplineByAmbito[String((item as Json)?.valor ?? item)]).filter((item): item is Discipline => !!item)),
        kinds: (Array.isArray(meta.k) && meta.k.length ? meta.k : ['image']) as Challenge['kinds'],
        startsAt: raw.fechaInicio as string, endsAt: raw.fechaFin as string, cover, archived: false,
        createdBy: raw.autorId as string, requestId: typeof meta.r === 'string' ? meta.r : null,
      }
    })

    const requests: Proposal[] = rawRequests.map(raw => {
      const { text, meta } = unpack(raw.descripcionLarga as string | undefined)
      const state = raw.estado as string
      return {
        id: raw.id as string, authorId: raw.autorId as string, title: raw.nombre as string, description: text,
        discipline: disciplineByAmbito[String(raw.ambitos?.[0]?.valor ?? raw.ambitos?.[0] ?? '')] ?? (pickDisciplines([meta.d])[0] ?? 'Ilustración'),
        status: state === 'APROBADA' ? 'approved' : state === 'RECHAZADA' ? 'rejected' : 'pending',
        createdAt: raw.createdAt as string, note: '', resolvedAt: state === 'PENDIENTE' ? null : (raw.updatedAt as string) ?? (raw.createdAt as string),
        resolvedBy: state === 'PENDIENTE' ? null : (me.id as string),
      }
    })

    const reports: Report[] = adminReports.map(raw => ({
      id: raw.id as string, postId: raw.publicacionId as string, authorId: (raw.reportanteId as string) ?? (me.id as string),
      reason: reasonByCode[raw.motivo as string] ?? 'Otro motivo', description: String(raw.textoLibre ?? raw.descripcion ?? 'Sin descripción adicional.'),
      status: raw.estadoModeracion === 'RESUELTO' ? 'accepted' : raw.estadoModeracion === 'DESESTIMADO' ? 'dismissed' : 'pending',
      createdAt: raw.fechaCreacion as string, note: '',
      resolvedAt: raw.estadoModeracion === 'PENDIENTE' || raw.estadoModeracion === 'EN_REVISION' ? null : (raw.fechaActualizacion as string),
      resolvedBy: raw.estadoModeracion === 'PENDIENTE' || raw.estadoModeracion === 'EN_REVISION' ? null : (me.id as string),
    }))
    for (const report of reports) if (!posts.some(post => post.id === report.postId)) {
      const reported = adminReports.find(raw => raw.id === report.id)?.publicacion as Json | undefined
      posts.push({
        id: report.postId, authorId: (reported?.autorId as string) ?? (me.id as string), title: 'Obra reportada', description: '', alt: '', discipline: 'Ilustración',
        technique: '', kind: 'image', src: '', cover: '', width: 1, height: 1, duration: 0, license: '', credit: '', creditUrl: '',
        status: reported?.estado === 'ELIMINADA' ? 'deleted' : 'published', createdAt: report.createdAt, likes: [], comments: [], challengeId: null,
      })
    }

    const appeals: Appeal[] = adminAppeals.map(raw => ({
      id: raw.id as string, authorId: raw.usuarioId as string, description: raw.mensaje as string,
      status: raw.estado === 'ACEPTADA' || raw.estado === 'APROBADA' ? 'approved' : raw.estado === 'RECHAZADA' ? 'rejected' : 'pending',
      createdAt: raw.creadaEn as string, note: String(raw.motivoRechazo ?? ''),
      resolvedAt: (raw.resueltaEn as string | null) ?? null, resolvedBy: raw.resueltaEn ? (me.id as string) : null,
    }))

    const users = new Map<string, User>([[meUser.id, meUser]])
    for (const raw of adminUsers) {
      const base = this.userCache.get(raw.id as string)
      users.set(raw.id as string, {
        ...(base ?? this.toUser({ id: raw.id, username: String(raw.email).split('@')[0], nombreCompleto: raw.nombre })),
        id: raw.id as string, name: (raw.nombre as string) || base?.name || 'Perfil', email: raw.email as string,
        role: raw.rol === 'ADMIN' ? 'admin' : 'artist',
        status: raw.estadoCuenta === 'BANEADO' ? 'suspended' : raw.estadoCuenta === 'ELIMINADO' ? 'deleted' : 'active',
        joinedAt: raw.fechaRegistro as string,
      })
    }
    const needed = uniq([
      ...posts.map(post => post.authorId), ...posts.flatMap(post => post.comments.map(comment => comment.authorId)),
      ...challenges.map(challenge => challenge.createdBy), ...requests.map(request => request.authorId),
      ...reports.map(report => report.authorId), ...appeals.map(appeal => appeal.authorId), ...blocks.map(block => block.blockedId),
    ]).filter(id => !!id && !users.has(id))
    await Promise.all(needed.map(async id => {
      try { users.set(id, this.toUser(await http<Json>('GET', `/api/usuarios/${id}`))) } catch (error) {
        if (!(error instanceof ApiError)) throw error
        users.set(id, this.toUser({ id, username: 'perfil.no.disponible', nombreCompleto: 'Perfil no disponible' }, { status: 'deleted' }))
      }
    }))
    for (const [id, user] of users) if (id !== meUser.id && !adminUsers.some(raw => raw.id === id) && !needed.includes(id)) users.set(id, user)
    for (const user of users.values()) {
      const cached = this.userCache.get(user.id)
      if (cached && cached.id !== meUser.id && !adminUsers.some(raw => raw.id === user.id)) Object.assign(user, { email: cached.email })
    }

    const follows: DemoState['follows'] = []
    const edges = new Set<string>()
    const addEdge = (followerId: string, followingId: string) => {
      const key = `${followerId}>${followingId}`
      if (!edges.has(key)) { edges.add(key); follows.push({ followerId, followingId }) }
    }
    const profileIds = uniq([meUser.id, ...posts.filter(post => post.status === 'published').map(post => post.authorId)]).filter(id => users.has(id)).slice(0, 30)
    await Promise.all(profileIds.map(async id => {
      const [following, followers] = await Promise.all([
        allPages<Json>(`/api/usuarios/${id}/seguidos`).catch(() => [] as Json[]),
        allPages<Json>(`/api/usuarios/${id}/seguidores`).catch(() => [] as Json[]),
      ])
      following.forEach(entry => { addEdge(id, entry.id as string); if (!users.has(entry.id as string)) users.set(entry.id as string, this.toUser(entry)) })
      followers.forEach(entry => { addEdge(entry.id as string, id); if (!users.has(entry.id as string)) users.set(entry.id as string, this.toUser(entry)) })
    }))

    return {
      version: 1, revision: this.state.revision + 1, createdAt: this.state.createdAt,
      users: [...users.values()], posts, folders, follows, blocks, challenges, requests, reports, appeals, audit: [],
    }
  }

  private toPost(raw: Json, comments: Json[], status: Post['status']): Post {
    const { text, meta } = unpack(raw.contenido as string)
    const [first = '', ...rest] = text.split('\n')
    const author = raw.usuarioId as string
    const likes: string[] = Array.from({ length: Number(raw.reaccionesCount ?? 0) }, (_, index) => `like-${raw.id}-${index}`)
    if ((raw.likeDelUsuarioActual || this.likedIds().has(raw.id as string)) && this.meId) { if (likes.length) likes[0] = this.meId; else likes.push(this.meId) }
    return {
      id: raw.id as string, authorId: author, title: first.trim().slice(0, 120) || 'Sin título', description: rest.join('\n').trim(),
      alt: typeof meta.a === 'string' && meta.a ? meta.a : first.trim(), discipline: pickDisciplines([meta.d])[0] ?? 'Ilustración',
      technique: typeof meta.t === 'string' ? meta.t : '', kind: 'image', src: assetUrl(raw.fotoUrl as string), cover: '',
      width: Number(meta.w) > 0 ? Number(meta.w) : 1200, height: Number(meta.h) > 0 ? Number(meta.h) : 900, duration: 0,
      license: typeof meta.l === 'string' ? meta.l : '', credit: typeof meta.c === 'string' ? meta.c : '', creditUrl: typeof meta.u === 'string' ? meta.u : '',
      status, createdAt: raw.createdAt as string, likes,
      comments: comments.map(comment => ({ id: comment.id as string, authorId: comment.usuarioId as string, text: comment.contenido as string, createdAt: comment.createdAt as string })),
      challengeId: null,
    }
  }

  async execute(_actorId: string | null, command: Command): Promise<DemoState> {
    await this.run(command)
    return this.load()
  }

  private contentOf(post: Pick<Post, 'title' | 'description' | 'alt' | 'discipline' | 'technique' | 'license' | 'credit' | 'creditUrl' | 'width' | 'height'>) {
    const content = pack(`${post.title}\n${post.description}`, {
      a: post.alt, d: post.discipline, t: post.technique, l: post.license, c: post.credit, u: post.creditUrl, w: post.width, h: post.height,
    })
    if (content.length > MAX_CONTENT) throw new Error(`El título, la descripción y los datos de la obra superan el máximo de ${MAX_CONTENT} caracteres. Acortá el texto.`)
    return content
  }

  private post(id: string) {
    const post = this.state.posts.find(item => item.id === this.rid(id))
    if (!post) throw new Error('La publicación no está disponible.')
    return post
  }

  private async coverFor(source: string) {
    let url = source
    if (!url.startsWith('data:')) url = await blobToDataUrl(await dataUrlToBlob(url))
    if (!/^data:image\/(png|jpeg);/.test(url)) throw new Error('La portada debe ser JPG o PNG.')
    return { url, formato: url.startsWith('data:image/png') ? 'PNG' : 'JPEG', principal: true }
  }

  private challengeBody(challenge: Challenge, cover: Awaited<ReturnType<ApiRepository['coverFor']>>) {
    return {
      nombre: challenge.title,
      descripcionLarga: pack(challenge.description, { k: challenge.kinds, ...(challenge.requestId ? { r: challenge.requestId } : {}) }),
      fechaInicio: challenge.startsAt, fechaFin: challenge.endsAt,
      ambitos: uniq(challenge.disciplines.map(item => ambitoByDiscipline[item])), fotos: [cover],
    }
  }

  private async run(command: Command): Promise<void> {
    switch (command.type) {
      case 'create-account':
        throw new Error('Para crear una cuenta usá la pantalla de registro.')
      case 'update-profile': {
        const changes = command.changes
        const avatarUrl = changes.avatar.startsWith('data:') ? undefined : changes.avatar
        const current = this.state.users.find(user => user.id === this.meId)
        await http('PATCH', '/api/usuarios/me', {
          nombreCompleto: changes.name, ...(changes.handle !== current?.handle ? { username: changes.handle } : {}), sobreMi: changes.bio,
          descripcion: pack(changes.location, { w: changes.website, d: changes.disciplines, i: current?.inspirations ?? [] }),
          ...(avatarUrl !== undefined && avatarUrl === '' ? { avatarUrl: null } : {}),
        })
        if (changes.avatar.startsWith('data:')) {
          const form = new FormData()
          form.append('avatar', await dataUrlToBlob(changes.avatar), 'avatar.png')
          await http('POST', '/api/usuarios/me/avatar', undefined, form)
        }
        return
      }
      case 'set-interests': {
        const me = this.state.users.find(user => user.id === this.meId)
        if (!me) throw new Error('Tenés que ingresar para continuar.')
        const generoIds = uniq(command.disciplines.map(item => generoByDiscipline[item]))
        await http('PUT', '/api/usuarios/me/intereses/onboarding', { generoIds, estiloIds: [], tipoMusicaIds: [] })
        await http('PATCH', '/api/usuarios/me', { descripcion: pack(me.location, { w: me.website, d: command.disciplines, i: command.inspirations }) })
        return
      }
      case 'toggle-like': {
        const id = this.rid(command.postId)
        const result = await http<Json>('POST', `/api/publicaciones/${id}/reacciones`, { tipo: 'LIKE' })
        const liked = this.likedIds()
        if (result.activa) liked.add(id); else liked.delete(id)
        localStorage.setItem(`trama-likes:${this.meId}`, JSON.stringify([...liked]))
        return
      }
      case 'toggle-follow': {
        const target = this.rid(command.userId)
        const following = this.state.follows.some(edge => edge.followerId === this.meId && edge.followingId === target)
        await http(following ? 'DELETE' : 'PUT', `/api/usuarios/${target}/seguimiento`)
        return
      }
      case 'toggle-block': {
        const target = this.rid(command.userId)
        const blocked = this.state.blocks.some(block => block.blockerId === this.meId && block.blockedId === target)
        await http(blocked ? 'DELETE' : 'PUT', `/api/usuarios/${target}/bloqueo`)
        return
      }
      case 'create-folder': {
        const created = await http<Json>('POST', '/api/carpetas', { nombre: command.name, visibilidad: 'PRIVADA', tags: [] })
        this.aliases.set(command.id, created.id as string)
        return
      }
      case 'rename-folder':
        await http('PATCH', `/api/carpetas/${this.rid(command.folderId)}`, { nombre: command.name })
        return
      case 'delete-folder':
        await http('DELETE', `/api/carpetas/${this.rid(command.folderId)}`)
        return
      case 'save-to-folder':
        await http('PUT', `/api/carpetas/${this.rid(command.folderId)}/publicaciones/${this.rid(command.postId)}`)
        return
      case 'remove-from-folder':
        await http('DELETE', `/api/carpetas/${this.rid(command.folderId)}/publicaciones/${this.rid(command.postId)}`)
        return
      case 'create-post': {
        const post = command.post
        if (post.kind !== 'image') throw new Error('Por ahora solo se pueden publicar imágenes.')
        if (!post.alt) throw new Error('Agregá una descripción de la imagen para que sea accesible.')
        const content = this.contentOf(post)
        const fotoUrl = await uploadImage(post.src)
        const created = await http<Json>('POST', '/api/publicaciones', { contenido: content, tipoContenido: 'IMAGEN', fotoUrl, categorias: [], hashtags: [], cuentasEtiquetadas: [] })
        this.aliases.set(post.id, created.id as string)
        if (post.challengeId) {
          try { await this.joinChallenge(this.rid(post.challengeId), created.id as string, post.title, fotoUrl) }
          catch (error) { throw new Error(`Tu obra se publicó, pero no pudo sumarse al desafío: ${error instanceof Error ? error.message : 'error desconocido'}`, { cause: error }) }
        }
        return
      }
      case 'update-post': {
        const post = this.post(command.postId)
        const changes = command.changes
        if (!changes.alt) throw new Error('Agregá una descripción accesible del contenido.')
        await http('PUT', `/api/publicaciones/${post.id}`, {
          contenido: this.contentOf({ ...post, ...changes }), fotoUrl: post.src.startsWith(BASE) && BASE ? post.src.slice(BASE.length) : post.src,
          categorias: [], hashtags: [], cuentasEtiquetadas: [],
        })
        return
      }
      case 'add-comment':
        await http('POST', `/api/publicaciones/${this.rid(command.postId)}/comentarios`, { contenido: command.text })
        return
      case 'delete-comment': {
        const post = this.post(command.postId)
        const comment = post.comments.find(item => item.id === this.rid(command.commentId))
        const mine = this.state.users.find(user => user.id === this.meId)
        if (comment && comment.authorId !== this.meId && mine?.role === 'admin') {
          await http('POST', `/api/admin/publicaciones/${post.id}/comentarios/${comment.id}/ocultar`, { motivoAdmin: 'Moderación de comentario' })
        } else await http('DELETE', `/api/publicaciones/${post.id}/comentarios/${this.rid(command.commentId)}`)
        return
      }
      case 'delete-post':
        await http('DELETE', `/api/publicaciones/${this.rid(command.postId)}`)
        return
      case 'moderate-post':
        if (command.status !== 'deleted') throw new Error('El servicio solo permite eliminar publicaciones. Usá «Eliminar» para retirar esta obra.')
        await http('POST', `/api/admin/publicaciones/${this.rid(command.postId)}/eliminar`, { motivoAdmin: command.reason })
        return
      case 'set-user-status': {
        const id = this.rid(command.userId)
        if (command.status === 'suspended') await http('POST', `/api/admin/usuarios/${id}/banear`, { permanente: true, motivoAdmin: command.reason })
        else if (command.status === 'deleted') await http('POST', `/api/admin/usuarios/${id}/eliminar`, { motivoAdmin: command.reason })
        else await http('POST', `/api/admin/usuarios/${id}/restaurar`, { motivoAdmin: command.reason })
        return
      }
      case 'change-role':
        await http('POST', `/api/admin/users/${this.rid(command.userId)}/role`, { role: command.role === 'admin' ? 'ADMIN' : 'USER', motivoAdmin: 'Cambio de rol desde administración' })
        return
      case 'save-challenge': {
        const challenge = command.challenge
        const existing = this.state.challenges.find(item => item.id === this.rid(challenge.id))
        const body = this.challengeBody({ ...challenge, createdBy: existing?.createdBy ?? this.meId ?? '' }, await this.coverFor(challenge.cover))
        if (existing) await http('PUT', `/api/desafios/${existing.id}`, { ...body, version: this.versions.get(existing.id) ?? 0 })
        else {
          const created = await http<Json>('POST', '/api/desafios', body)
          this.aliases.set(challenge.id, created.id as string)
        }
        return
      }
      case 'archive-challenge':
        if (!command.archived) throw new Error('Un desafío archivado no se puede restaurar. Creá uno nuevo con la misma consigna.')
        await http('DELETE', `/api/desafios/${this.rid(command.challengeId)}`)
        return
      case 'join-challenge': {
        const post = this.post(command.postId)
        await this.joinChallenge(this.rid(command.challengeId), post.id, post.title, post.src.startsWith(BASE) && BASE ? post.src.slice(BASE.length) : post.src)
        return
      }
      case 'create-request': {
        const request = command.request
        const start = new Date()
        const end = new Date(start.getTime() + 30 * 24 * 3600 * 1000)
        await http('POST', '/api/solicitudes', {
          nombre: request.title,
          descripcionLarga: pack(request.description, { d: request.discipline }),
          fechaInicio: start.toISOString(), fechaFin: end.toISOString(),
          ambitos: [ambitoByDiscipline[request.discipline]],
          fotos: [{ url: PLACEHOLDER_COVER, formato: 'PNG', principal: true }],
        })
        return
      }
      case 'review-request':
        await http('PUT', `/api/solicitudes/${this.rid(command.requestId)}/${command.status === 'approved' ? 'aprobar' : 'rechazar'}`)
        return
      case 'create-report':
        await http('POST', `/api/publicaciones/${this.rid(command.report.postId)}/reportes`, { motivo: reasonCode[command.report.reason], textoLibre: command.report.description })
        return
      case 'review-report': {
        const id = this.rid(command.reportId)
        const current = this.state.reports.find(report => report.id === id)
        if (current?.status === 'pending') await http('POST', `/api/admin/reportes/${id}/iniciar-revision`, { motivoAdmin: command.note }).catch(error => { if (!(error instanceof ApiError) || error.status >= 500) throw error })
        await http('POST', `/api/admin/reportes/${id}/${command.status === 'accepted' ? 'aceptar' : 'rechazar'}`, { motivoAdmin: command.note })
        return
      }
      case 'create-appeal':
        throw new Error('Para solicitar una revisión ingresá tu correo, tu contraseña y el mensaje desde la pantalla de apelación.')
      case 'review-appeal': {
        const id = this.rid(command.appealId)
        if (command.status === 'approved') await http('POST', `/api/admin/apelaciones/${id}/aceptar`)
        else await http('POST', `/api/admin/apelaciones/${id}/rechazar`, { motivo: command.note })
        return
      }
    }
  }

  private async joinChallenge(challengeId: string, postId: string, title: string, imageUrl: string) {
    let url = imageUrl.startsWith('data:') ? imageUrl : await blobToDataUrl(await dataUrlToBlob(imageUrl))
    if (!/^data:image\/(png|jpeg);base64,/.test(url)) url = await toPngDataUrl(url)
    await http('POST', `/api/desafios/${challengeId}/respuestas`, {
      nombre: title, descripcionLarga: `Participación desde Trama. trama-post:${postId}`, contenido: { tipo: 'imagen', url },
    })
    writeChallengeLink(postId, challengeId)
  }
}

const CHALLENGE_LINKS_KEY = 'trama-challenge-links'

function readChallengeLinks(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CHALLENGE_LINKS_KEY) ?? '{}') as Record<string, string> } catch { return {} }
}

function writeChallengeLink(postId: string, challengeId: string) {
  try { localStorage.setItem(CHALLENGE_LINKS_KEY, JSON.stringify({ ...readChallengeLinks(), [postId]: challengeId })) } catch { /* sin almacenamiento disponible */ }
}

const PLACEHOLDER_COVER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
