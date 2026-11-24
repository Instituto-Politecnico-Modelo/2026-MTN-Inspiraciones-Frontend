import { useEffect, useMemo, useRef } from 'react'
import { ArrowRight, MapPin, Trophy, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'
import { challengeStatus, searchPosts, visiblePosts } from '../data/store'
import type { Challenge, DemoState } from '../data/model'
import { markSeen, readSeen, sinkSeen } from '../lib/seenPosts'
import { Badge, EmptyState, ErrorMessage, PageTitle, Tabs } from '../components/UI'
import { PostGrid } from '../components/PostCard'
import { FeedMap } from '../components/FeedMap'
import { NearbyFeed } from './NearbyFeed'

const homeTabs = [
  { value: 'para-vos', label: 'Para vos' },
  { value: 'mapa', label: 'Mapa' },
  { value: 'seguidos', label: 'Seguidos' },
  { value: 'desafios', label: 'Desafíos' },
]

export function ChallengeNudge({ challenge }: { challenge: Challenge }) {
  return <article className="challenge-nudge post-card">
    <img src={challenge.cover} alt="" width="240" height="140" />
    <Badge status="open">Desafío abierto</Badge>
    <h2>{challenge.title}</h2>
    <Link to={`/desafios/${challenge.id}`}>Ver la consigna<ArrowRight size={18} aria-hidden="true" /></Link>
  </article>
}

function forYouPosts(state: DemoState, seen: Record<string, number>) {
  const visible = visiblePosts(state)
  if (!state.feed?.length) return sinkSeen(visible, seen)
  const byId = new Map(visible.map(post => [post.id, post]))
  return sinkSeen(state.feed.flatMap(id => byId.get(id) ?? []), seen)
}

// Marca como vista cada obra de "Para vos" que aparece en pantalla (una vez por carga de la página).
function useMarkSeen(userId: string | undefined, active: boolean) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = container.current
    if (!userId || !active || !root || typeof IntersectionObserver === 'undefined') return
    const counted = new Set<string>()
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.postId
        if (entry.isIntersecting && id && !counted.has(id)) {
          counted.add(id)
          markSeen(userId, id)
        }
      }
    }, { threshold: 0.6 })
    const observeAll = () => root.querySelectorAll('[data-post-id]').forEach(element => observer.observe(element))
    observeAll()
    const mutations = new MutationObserver(observeAll)
    mutations.observe(root, { childList: true, subtree: true })
    return () => { observer.disconnect(); mutations.disconnect() }
  }, [userId, active])
  return container
}

export function HomePage() {
  const { state, user } = useDemo()
  const [params, setParams] = useSearchParams()
  const requested = params.get('vista') ?? 'para-vos'
  const view = requested === 'cerca-de-mi' ? 'mapa' : requested
  const tab = homeTabs.some(item => item.value === view) ? view : 'para-vos'
  // Se lee una sola vez por carga: lo visto baja al recargar, no mientras se navega.
  const seen = useMemo(() => readSeen(user?.id), [user?.id])
  const challenge = state.challenges.find(item => challengeStatus(item) === 'open')
  const posts = tab === 'mapa' ? visiblePosts(state)
    : tab === 'seguidos' ? user ? searchPosts(state, { following: user.id }) : []
    : tab === 'desafios' ? visiblePosts(state).filter(post => post.challengeId) : forYouPosts(state, seen)
  const seenContainer = useMarkSeen(user?.id, tab === 'para-vos' && posts.length > 0)
  return <>
    <PageTitle title="Inicio" />
    {view !== tab && <ErrorMessage message="La vista de ese enlace no existe. Podés elegir una de las pestañas de Inicio." />}
    <Tabs label="Contenido de Inicio" value={tab} items={homeTabs}
      onChange={value => setParams(value === 'para-vos' ? {} : { vista: value }, { replace: true, preventScrollReset: true })}>
      {tab === 'mapa' ? user ? <NearbyFeed key={user.id} posts={posts} /> : <div className="nearby-feed">
        <FeedMap />
        <EmptyState icon={MapPin} title="Explorá publicaciones en el mapa"
          description="Ingresá para ver qué obras se compartieron en la zona que estás explorando."
          action={<Link className="button button-primary" to="/ingresar?volver=%2Finicio%3Fvista%3Dmapa">Ingresar</Link>} />
      </div>
      : posts.length ? <div ref={seenContainer}><PostGrid posts={posts} compact />
        {challenge && <ChallengeNudge challenge={challenge} />}
      </div> : <EmptyState icon={tab === 'seguidos' ? Users : Trophy}
        title={tab === 'seguidos' ? user ? 'Encontrá otras miradas' : 'Tu comunidad empieza acá' : 'Todavía no hay obras para mostrar'}
        description={tab === 'seguidos' ? 'Seguí artistas para reunir sus publicaciones en este espacio.' : 'Las respuestas de la comunidad a los desafíos van a aparecer en esta pestaña.'}
        action={<Link className="button button-primary" to={tab === 'seguidos' ? user ? '/descubrir?tipo=artistas' : '/ingresar' : '/desafios'}>{tab === 'seguidos' ? user ? 'Descubrir artistas' : 'Ingresar' : 'Explorar desafíos'}</Link>} />}
    </Tabs>
  </>
}
