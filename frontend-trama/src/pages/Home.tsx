import { ArrowRight, MapPin, Trophy, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'
import { challengeStatus, searchPosts, visiblePosts } from '../data/store'
import type { Challenge, DemoState } from '../data/model'
import { Badge, EmptyState, ErrorMessage, PageTitle, Tabs } from '../components/UI'
import { PostGrid } from '../components/PostCard'
import { NearbyFeed } from './NearbyFeed'

const homeTabs = [
  { value: 'para-vos', label: 'Para vos' },
  { value: 'cerca-de-mi', label: 'Cerca de mí' },
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

function forYouPosts(state: DemoState) {
  const visible = visiblePosts(state)
  if (!state.feed?.length) return visible
  const byId = new Map(visible.map(post => [post.id, post]))
  return state.feed.flatMap(id => byId.get(id) ?? [])
}

export function HomePage() {
  const { state, user } = useDemo()
  const [params, setParams] = useSearchParams()
  const requested = params.get('vista') ?? 'para-vos'
  const tab = homeTabs.some(item => item.value === requested) ? requested : 'para-vos'
  const challenge = state.challenges.find(item => challengeStatus(item) === 'open')
  const posts = tab === 'cerca-de-mi' ? visiblePosts(state)
    : tab === 'seguidos' ? user ? searchPosts(state, { following: user.id }) : []
    : tab === 'desafios' ? visiblePosts(state).filter(post => post.challengeId) : forYouPosts(state)
  return <>
    <PageTitle title="Inicio" />
    {requested !== tab && <ErrorMessage message="La vista de ese enlace no existe. Podés elegir una de las pestañas de Inicio." />}
    <Tabs label="Contenido de Inicio" value={tab} items={homeTabs}
      onChange={value => setParams(value === 'para-vos' ? {} : { vista: value }, { replace: true, preventScrollReset: true })}>
      {tab === 'cerca-de-mi' ? user ? <NearbyFeed key={user.id} posts={posts} /> : <EmptyState icon={MapPin} title="Encontrá obras cerca tuyo"
        description="Ingresá para ver publicaciones cerca de tu ubicación y en tu ciudad."
        action={<Link className="button button-primary" to="/ingresar?volver=%2Finicio%3Fvista%3Dcerca-de-mi">Ingresar</Link>} />
      : posts.length ? <><PostGrid posts={posts} compact />
        {challenge && <ChallengeNudge challenge={challenge} />}
      </> : <EmptyState icon={tab === 'seguidos' ? Users : Trophy}
        title={tab === 'seguidos' ? user ? 'Encontrá otras miradas' : 'Tu comunidad empieza acá' : 'Todavía no hay obras para mostrar'}
        description={tab === 'seguidos' ? 'Seguí artistas para reunir sus publicaciones en este espacio.' : 'Las respuestas de la comunidad a los desafíos van a aparecer en esta pestaña.'}
        action={<Link className="button button-primary" to={tab === 'seguidos' ? user ? '/descubrir?tipo=artistas' : '/ingresar' : '/desafios'}>{tab === 'seguidos' ? user ? 'Descubrir artistas' : 'Ingresar' : 'Explorar desafíos'}</Link>} />}
    </Tabs>
  </>
}
