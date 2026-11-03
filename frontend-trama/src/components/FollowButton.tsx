import { Check, UserPlus } from 'lucide-react'
import { useAction, useDemo } from '../context/DemoContext'
import type { User } from '../data/model'
import { Button, ErrorMessage } from './UI'
import { useAccountGate } from './Shell'

export function FollowButton({ artist }: { artist: User }) {
  const { state, user } = useDemo()
  const { run, pending, error } = useAction()
  const gate = useAccountGate()
  const following = !!user && state.follows.some(follow => follow.followerId === user.id && follow.followingId === artist.id)
  const label = `${following ? 'Dejar de seguir a' : 'Seguir a'} ${artist.name}`
  if (user?.id === artist.id) return null
  return <div className="follow-control"><Button className="follow-button" variant={following ? 'secondary' : 'primary'} loading={pending} aria-pressed={following} aria-label={label} title={label}
    onClick={() => { if (gate()) void run({ type: 'toggle-follow', userId: artist.id }, following ? `Dejaste de seguir a ${artist.name}.` : `Ahora seguís a ${artist.name}.`) }}>
    {!pending && (following ? <Check size={18} aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />)}<span className="follow-label">{following ? 'Siguiendo' : 'Seguir'}</span>
  </Button><ErrorMessage message={error} /></div>
}
