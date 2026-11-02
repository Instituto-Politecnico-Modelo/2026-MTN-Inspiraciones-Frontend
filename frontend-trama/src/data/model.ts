import { z } from 'zod'

export const disciplines = ['Ilustración', 'Pintura', 'Fotografía', 'Cerámica', 'Escultura', 'Música', 'Collage', 'Diseño'] as const
export const inspirationTypes = ['Obras terminadas', 'Procesos creativos', 'Naturaleza', 'Arquitectura', 'Sonidos', 'Lugares para crear'] as const
export const reportReasons = ['Autoría o derechos', 'Contenido inapropiado', 'Spam', 'Otro motivo'] as const

const id = z.string().min(1).max(80).regex(/^[\w-]+$/, 'El identificador no es válido.')
const date = z.string().datetime({ offset: true })
const shortText = z.string().trim().min(1, 'Completá este campo.').max(120, 'Usá hasta 120 caracteres.')
const source = z.string().max(24 * 1024 * 1024).refine(value =>
  /^\/media\/[\w./-]+$/.test(value) ||
  /^data:(image\/(?:jpeg|png|webp)|audio\/(?:mpeg|wav|x-wav|ogg|mp4));base64,[A-Za-z0-9+/=\s]+$/.test(value),
  'El archivo no tiene un formato admitido.',
)
const optionalImage = z.union([z.literal(''), source.refine(value => !value.startsWith('data:audio/'), 'Elegí una imagen.')])
const website = z.union([
  z.literal(''),
  z.string().trim().max(500).url('Escribí una dirección web completa.').regex(/^https?:\/\//i, 'El enlace debe comenzar con https:// o http://.'),
])

export const UserSchema = z.object({
  id,
  name: z.string().trim().min(2, 'Escribí un nombre de al menos 2 caracteres.').max(80),
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9._]{3,24}$/, 'Usá entre 3 y 24 letras, números, puntos o guiones bajos.'),
  email: z.string().trim().toLowerCase().email('Escribí un correo válido.').max(254),
  role: z.enum(['artist', 'admin']),
  status: z.enum(['active', 'suspended', 'deleted']),
  bio: z.string().trim().max(500, 'La biografía puede tener hasta 500 caracteres.'),
  location: z.string().trim().max(100),
  website,
  avatar: optionalImage,
  disciplines: z.array(z.enum(disciplines)).max(8),
  inspirations: z.array(z.enum(inspirationTypes)).max(6),
  joinedAt: date,
  suspensionReason: z.string().max(1000),
})

export const ProfileSchema = UserSchema.pick({
  name: true, handle: true, bio: true, location: true, website: true, avatar: true, disciplines: true,
}).strict()

export const AccountSchema = UserSchema.pick({ id: true, name: true, handle: true, email: true }).strict()

export const CommentSchema = z.object({
  id, authorId: id,
  text: z.string().trim().min(1, 'Escribí un comentario.').max(1000, 'El comentario puede tener hasta 1000 caracteres.'),
  createdAt: date,
})

export const PostSchema = z.object({
  id, authorId: id,
  title: shortText,
  description: z.string().trim().max(2500),
  alt: z.string().trim().max(10000, 'Usá hasta 10.000 caracteres para la descripción o transcripción.'),
  discipline: z.enum(disciplines),
  technique: z.string().trim().max(80),
  kind: z.enum(['image', 'audio']),
  src: source,
  cover: optionalImage,
  width: z.number().positive().max(50000),
  height: z.number().positive().max(50000),
  duration: z.number().min(0),
  license: z.string().trim().max(300),
  credit: z.string().max(500),
  creditUrl: website,
  status: z.enum(['published', 'hidden', 'deleted']),
  createdAt: date,
  likes: z.array(id),
  comments: z.array(CommentSchema),
  challengeId: id.nullable(),
})

export const PostChangesSchema = PostSchema.pick({
  title: true, description: true, alt: true, discipline: true, technique: true, license: true,
}).strict()

export const FolderSchema = z.object({
  id, ownerId: id,
  name: z.string().trim().min(1, 'Dale un nombre a la carpeta.').max(60, 'Usá hasta 60 caracteres.'),
  postIds: z.array(id),
})

export const ChallengeSchema = z.object({
  id,
  title: shortText,
  description: z.string().trim().min(10, 'Contá la consigna con al menos 10 caracteres.').max(3000),
  disciplines: z.array(z.enum(disciplines)).min(1, 'Elegí al menos una disciplina.').max(8),
  kinds: z.array(z.enum(['image', 'audio'])).min(1, 'Elegí al menos un formato.').max(2),
  startsAt: date,
  endsAt: date,
  cover: source,
  archived: z.boolean(),
  createdBy: id,
  requestId: id.nullable(),
}).refine(value => Date.parse(value.endsAt) > Date.parse(value.startsAt), {
  message: 'El cierre debe ser posterior al inicio.', path: ['endsAt'],
})

const reviewed = {
  note: z.string().trim().max(1500),
  resolvedAt: date.nullable(),
  resolvedBy: id.nullable(),
}

export const RequestSchema = z.object({
  id, authorId: id,
  title: shortText,
  description: z.string().trim().min(10, 'Describí tu propuesta con al menos 10 caracteres.').max(3000),
  discipline: z.enum(disciplines),
  status: z.enum(['pending', 'approved', 'rejected']),
  createdAt: date,
  ...reviewed,
})

export const ReportSchema = z.object({
  id, postId: id, authorId: id,
  reason: z.enum(reportReasons),
  description: z.string().trim().min(10, 'Describí el motivo con al menos 10 caracteres.').max(1500),
  status: z.enum(['pending', 'accepted', 'dismissed']),
  createdAt: date,
  ...reviewed,
})

export const AppealSchema = z.object({
  id, authorId: id,
  description: z.string().trim().min(10, 'Contanos qué debería revisar el equipo.').max(1500),
  status: z.enum(['pending', 'approved', 'rejected']),
  createdAt: date,
  ...reviewed,
})

export const StateSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  createdAt: date,
  users: z.array(UserSchema),
  posts: z.array(PostSchema),
  folders: z.array(FolderSchema),
  follows: z.array(z.object({ followerId: id, followingId: id })),
  blocks: z.array(z.object({ blockerId: id, blockedId: id })).default([]),
  challenges: z.array(ChallengeSchema),
  requests: z.array(RequestSchema),
  reports: z.array(ReportSchema),
  appeals: z.array(AppealSchema),
  audit: z.array(z.object({ id, actorId: id, label: z.string().max(500), targetId: id, createdAt: date })),
}).superRefine((state, context) => {
  const users = new Set(state.users.map(user => user.id))
  const posts = new Set(state.posts.map(post => post.id))
  for (const collection of [state.users, state.posts, state.folders, state.challenges, state.requests, state.reports, state.appeals]) {
    if (new Set(collection.map(item => item.id)).size !== collection.length) {
      context.addIssue({ code: 'custom', message: 'Los datos locales contienen identificadores repetidos.' })
    }
  }
  if (state.posts.some(post => !users.has(post.authorId) || post.likes.some(userId => !users.has(userId)) || post.comments.some(comment => !users.has(comment.authorId))) ||
    state.folders.some(folder => !users.has(folder.ownerId) || folder.postIds.some(postId => !posts.has(postId))) ||
    state.follows.some(follow => !users.has(follow.followerId) || !users.has(follow.followingId)) ||
    state.reports.some(report => !posts.has(report.postId) || !users.has(report.authorId))) {
    context.addIssue({ code: 'custom', message: 'Hay referencias incompletas en los datos locales.' })
  }
})

export type User = z.infer<typeof UserSchema>
export type ProfileChanges = z.infer<typeof ProfileSchema>
export type Post = z.infer<typeof PostSchema>
export type PostChanges = z.infer<typeof PostChangesSchema>
export type Folder = z.infer<typeof FolderSchema>
export type Challenge = z.infer<typeof ChallengeSchema>
export type Proposal = z.infer<typeof RequestSchema>
export type Report = z.infer<typeof ReportSchema>
export type Appeal = z.infer<typeof AppealSchema>
export type DemoState = z.infer<typeof StateSchema>
export type MediaKind = Post['kind']
export type Discipline = typeof disciplines[number]

export type NewPost = Omit<Post, 'authorId' | 'createdAt' | 'status' | 'likes' | 'comments'>
export type ChallengeInput = Omit<Challenge, 'createdBy'>

export type Command =
  | { type: 'create-account'; user: z.infer<typeof AccountSchema> }
  | { type: 'update-profile'; changes: ProfileChanges }
  | { type: 'set-interests'; disciplines: User['disciplines']; inspirations: User['inspirations'] }
  | { type: 'toggle-like'; postId: string }
  | { type: 'toggle-follow'; userId: string }
  | { type: 'toggle-block'; userId: string }
  | { type: 'create-folder'; id: string; name: string }
  | { type: 'rename-folder'; folderId: string; name: string }
  | { type: 'delete-folder'; folderId: string }
  | { type: 'save-to-folder' | 'remove-from-folder'; folderId: string; postId: string }
  | { type: 'create-post'; post: NewPost }
  | { type: 'update-post'; postId: string; changes: PostChanges }
  | { type: 'add-comment'; id: string; postId: string; text: string }
  | { type: 'delete-comment'; postId: string; commentId: string }
  | { type: 'moderate-post'; postId: string; status: Post['status']; reason: string }
  | { type: 'delete-post'; postId: string }
  | { type: 'set-user-status'; userId: string; status: User['status']; reason: string }
  | { type: 'change-role'; userId: string; role: User['role'] }
  | { type: 'save-challenge'; challenge: ChallengeInput }
  | { type: 'archive-challenge'; challengeId: string; archived: boolean }
  | { type: 'join-challenge'; challengeId: string; postId: string }
  | { type: 'create-request'; request: Pick<Proposal, 'id' | 'title' | 'description' | 'discipline'> }
  | { type: 'review-request'; requestId: string; status: 'approved' | 'rejected'; note: string }
  | { type: 'create-report'; report: Pick<Report, 'id' | 'postId' | 'reason' | 'description'> }
  | { type: 'review-report'; reportId: string; status: 'accepted' | 'dismissed'; note: string }
  | { type: 'create-appeal'; id: string; description: string }
  | { type: 'review-appeal'; appealId: string; status: 'approved' | 'rejected'; note: string }
