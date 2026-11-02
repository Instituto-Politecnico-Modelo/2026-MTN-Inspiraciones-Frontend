import { useState } from 'react'
import { Bookmark, Heart, MessageCircle, Music2 } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAction, useDemo } from '../context/DemoContext'
import type { Post } from '../data/model'
import { Avatar, Badge, ErrorMessage } from './UI'
import { ArtworkImage, AudioPlayer } from './Media'
import { SaveDialog } from './SaveDialog'
import { useAccountGate } from './Shell'

export function PostActions({ post, comments = true }: { post: Post; comments?: boolean }) {
  const { state, user } = useDemo()
  const { run, pending, error } = useAction()
  const gate = useAccountGate()
  const [saving, setSaving] = useState(false)
  const location = useLocation()
  const liked = !!user && post.likes.includes(user.id)
  const saved = !!user && state.folders.some(folder => folder.ownerId === user.id && folder.postIds.includes(post.id))
  return <>
    <div className="post-actions">
      <button type="button" className={`post-action ${liked ? 'is-active' : ''}`} aria-pressed={liked} aria-label={`${liked ? 'Quitar Me gusta de' : 'Me gusta en'} ${post.title}`} title={liked ? 'Quitar Me gusta' : 'Me gusta'} disabled={pending}
        onClick={() => { if (gate()) void run({ type: 'toggle-like', postId: post.id }) }}>
        <Heart size={21} strokeWidth={1.8} aria-hidden="true" /><span>{post.likes.length}</span>
      </button>
      {comments && <Link className="post-action" to={`/obra/${post.id}#comentarios`} state={{ from: location.pathname + location.search }} aria-label={`Ver ${post.comments.length} comentarios de ${post.title}`} title="Ver comentarios"><MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" /><span>{post.comments.length}</span></Link>}
      <button type="button" className={`post-action save-action ${saved ? 'is-active' : ''}`} aria-pressed={saved} aria-label={`${saved ? 'Administrar guardado de' : 'Guardar'} ${post.title}`} title={saved ? 'Administrar guardado' : 'Guardar en carpeta'}
        onClick={() => { if (gate()) setSaving(true) }}><Bookmark size={20} strokeWidth={1.8} aria-hidden="true" /></button>
    </div>
    <ErrorMessage message={error} />
    {saving && <SaveDialog post={post} onClose={() => setSaving(false)} />}
  </>
}

export function PostCard({ post, eager = false }: { post: Post; eager?: boolean }) {
  const { state } = useDemo()
  const location = useLocation()
  const author = state.users.find(user => user.id === post.authorId)
  if (!author) return <article className="post-card"><ErrorMessage message="No pudimos encontrar la autoría de esta obra." /></article>
  return <article className="post-card">
    <Link to={`/obra/${post.id}`} state={{ from: location.pathname + location.search }} className="artwork-link">
      <div className="card-media"><ArtworkImage post={post} eager={eager} decorative={post.kind === 'audio'} retry={false} />
        {post.kind === 'audio' && <span className="media-kind"><Music2 size={16} aria-hidden="true" />{post.technique === 'Sample' ? 'Sample' : 'Audio'}</span>}
      </div>
      <h2>{post.title}</h2>
    </Link>
    {post.kind === 'audio' && <AudioPlayer post={post} />}
    <Link className="artist-link" to={`/perfil/${author.id}`}><Avatar user={author} /><span>{author.name}</span><span className="card-discipline">{post.discipline}</span></Link>
    {post.status === 'published' ? <PostActions post={post} /> : <Badge status={post.status} />}
  </article>
}

export function PostGrid({ posts, compact = false }: { posts: Post[]; compact?: boolean }) {
  return <div className={`artwork-grid ${compact ? 'compact-grid' : ''}`}>{posts.map((post, index) => <PostCard key={post.id} post={post} eager={index < 3} />)}</div>
}
