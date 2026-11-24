import { useEffect, useRef, useState } from 'react'
import { Film, ImageOff, LoaderCircle, Pause, Play, RotateCcw } from 'lucide-react'
import type { Post } from '../data/model'
import { formatDuration } from '../lib/format'
import { Button, ErrorMessage, IconButton } from './UI'

let activeAudio: HTMLAudioElement | null = null

export const mediaLabel = { image: 'Imagen', audio: 'Audio', video: 'Video' } as const

export function ArtworkImage({ post, eager = false, decorative = false, retry = true }: { post: Post; eager?: boolean; decorative?: boolean; retry?: boolean }) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  if (post.kind === 'video' && !post.cover) {
    return <div className="artwork-image video-cover" aria-hidden="true" style={{ aspectRatio: post.width / post.height }}>
      <Film size={24} strokeWidth={1.5} />
    </div>
  }
  const src = post.kind === 'image' ? post.src : post.cover || '/media/sonido.svg'
  if (failed) return <div className="media-failure" role="status"><ImageOff aria-hidden="true" /><p>No pudimos cargar esta imagen.</p>
    {retry && <Button variant="secondary" onClick={event => { event.preventDefault(); setAttempt(value => value + 1); setFailed(false) }}><RotateCcw size={17} aria-hidden="true" />Reintentar</Button>}
  </div>
  return <img key={attempt} className="artwork-image" src={src} alt={decorative ? '' : post.alt}
    width={post.width} height={post.height} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />
}

export function VideoPlayer({ post, eager = false }: { post: Post; eager?: boolean }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <div className="media-failure" role="status">
    <p>No pudimos reproducir este video.</p>
    <Button variant="secondary" onClick={() => setFailed(false)}>Reintentar</Button>
  </div>

  return <video className="video-player" src={post.src} poster={post.cover || undefined}
    aria-label={`Video: ${post.title}`} controls playsInline preload={eager ? 'metadata' : 'none'}
    style={{ aspectRatio: post.width / post.height }} onError={() => setFailed(true)} />
}

export function AudioPlayer({ post }: { post: Post }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(post.duration)
  const [error, setError] = useState('')

  useEffect(() => {
    const audio = ref.current
    return () => {
      audio?.pause()
      if (activeAudio === audio) activeAudio = null
    }
  }, [])

  const toggle = async () => {
    const audio = ref.current
    if (!audio) return
    if (!audio.paused) { audio.pause(); return }
    setError('')
    setLoading(true)
    try {
      if (audio.error) audio.load()
      if (audio.ended) audio.currentTime = 0
      await audio.play()
    } catch (failure) {
      console.error('[Trama] Error de reproducción.', failure)
      setError('No pudimos reproducir este audio. Volvé a intentar.')
    } finally {
      setLoading(false)
    }
  }
  return <div className="audio-player">
    <audio ref={ref} src={post.src} preload="metadata" aria-label={`Audio: ${post.title}`}
      onPlay={event => {
        if (activeAudio && activeAudio !== event.currentTarget) activeAudio.pause()
        activeAudio = event.currentTarget
        setPlaying(true)
      }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
      onLoadedMetadata={event => {
        const value = event.currentTarget.duration
        if (Number.isFinite(value) && value > 0) setDuration(value)
        else setError('La duración del audio no está disponible.')
      }}
      onError={() => { setLoading(false); setPlaying(false); setError('Este audio no se puede reproducir ahora. Volvé a intentar.') }}
    />
    <div className="audio-controls">
      <IconButton className="play-button" icon={loading ? LoaderCircle : playing ? Pause : Play} label={`${playing ? 'Pausar' : 'Reproducir'} ${post.title}`} onClick={() => void toggle()} disabled={loading} />
      <input type="range" aria-label={`Avance de ${post.title}`} min="0" max={duration} step="0.1" value={Math.min(position, duration)} disabled={!duration}
        aria-valuetext={`${formatDuration(position)} de ${formatDuration(duration)}`}
        onChange={event => { if (ref.current) { ref.current.currentTime = Number(event.target.value); setPosition(Number(event.target.value)) } }} />
      <span className="audio-duration">{formatDuration(playing || position > 0 ? position : duration)}</span>
    </div>
    <ErrorMessage message={error} />
  </div>
}
