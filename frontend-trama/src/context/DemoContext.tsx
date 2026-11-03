import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle, X } from 'lucide-react'
import { ApiRepository, type ProfileLookup } from '../data/api'
import { errorMessage, newId } from '../data/store'
import type { Command, DemoState, User } from '../data/model'
import { Brand } from '../components/Brand'
import { Button, ErrorMessage, IconButton } from '../components/UI'

type Notice = { id: string; text: string; kind: 'success' | 'error' | 'info' }
export type Backend = {
  load: () => Promise<DemoState>
  execute: (actorId: string | null, command: Command) => Promise<DemoState>
  close: () => Promise<void>
  currentUserId: () => string | null
  login: (email: string, password: string) => Promise<string>
  register: (input: { email: string; username: string; nombreCompleto: string; password: string }) => Promise<string>
  appeal: (input: { email: string; password: string; mensaje: string }) => Promise<void>
  searchUsers?: (query: string) => Promise<User[]>
  getProfile?: (lookup: ProfileLookup) => Promise<User>
  logout: () => void
  resolveId: (id: string) => string
}
type Context = {
  state: DemoState
  user: User | null
  execute: (command: Command) => Promise<DemoState>
  login: (email: string, password: string) => Promise<User>
  register: (input: { email: string; username: string; nombreCompleto: string; password: string }) => Promise<User>
  appeal: (input: { email: string; password: string; mensaje: string }) => Promise<void>
  searchUsers: (query: string) => Promise<User[]>
  getProfile: (lookup: ProfileLookup) => Promise<void>
  logout: () => void
  resolveId: (id: string) => string
  notify: (text: string, kind?: Notice['kind']) => void
}
const DemoContext = createContext<Context | null>(null)

export function DemoProvider({ children, repository: providedRepository }: { children: ReactNode; repository?: Backend }) {
  const [repository] = useState<Backend>(() => providedRepository ?? new ApiRepository())
  const [state, setState] = useState<DemoState | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [startupError, setStartupError] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<Notice | null>(null)
  const notify = useCallback((text: string, kind: Notice['kind'] = 'success') => setNotice({ id: newId('aviso'), text, kind }), [])
  const refresh = useCallback(async () => {
    const result = await repository.load()
    setState(result)
    return result
  }, [repository])

  const initialize = useCallback(async () => {
    setLoading(true)
    setStartupError('')
    try {
      await refresh()
      setUserId(repository.currentUserId())
    } catch (error) {
      console.error('[Trama] No se pudo abrir la aplicación.', error)
      setStartupError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [refresh, repository])

  useEffect(() => { void initialize() }, [initialize])

  useEffect(() => {
    if (!notice || notice.kind === 'error') return
    const timeout = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(timeout)
  }, [notice])

  const execute = useCallback(async (command: Command) => {
    const result = await repository.execute(userId, command)
    setState(previous => !previous || result.revision >= previous.revision ? result : previous)
    return result
  }, [repository, userId])

  const enter = useCallback(async (id: string) => {
    const latest = await repository.load()
    const candidate = latest.users.find(user => user.id === id && user.status !== 'deleted')
    if (!candidate) throw new Error('No pudimos abrir tu perfil. Intentá de nuevo.')
    setState(latest)
    setUserId(candidate.id)
    return candidate
  }, [repository])

  const login = useCallback(async (email: string, password: string) => enter(await repository.login(email, password)), [enter, repository])
  const register = useCallback(async (input: { email: string; username: string; nombreCompleto: string; password: string }) => enter(await repository.register(input)), [enter, repository])
  const appeal = useCallback((input: { email: string; password: string; mensaje: string }) => repository.appeal(input), [repository])

  const mergeUsers = useCallback((users: User[]) => {
    setState(previous => {
      if (!previous) return previous
      const merged = new Map(previous.users.map(user => [user.id, user]))
      users.forEach(user => merged.set(user.id, user))
      return { ...previous, users: [...merged.values()] }
    })
  }, [])

  const searchUsers = useCallback(async (query: string) => {
    const users = repository.searchUsers ? await repository.searchUsers(query) : (await repository.load()).users
    mergeUsers(users)
    return users
  }, [repository, mergeUsers])

  const getProfile = useCallback(async (lookup: ProfileLookup) => {
    if (repository.getProfile) mergeUsers([await repository.getProfile(lookup)])
  }, [repository, mergeUsers])

  const logout = useCallback(() => {
    repository.logout()
    setUserId(null)
    void refresh().catch(error => console.error('[Trama] No se pudo actualizar tras cerrar sesión.', error))
  }, [refresh, repository])

  if (loading || !state || startupError) return <main className="startup">
    <Brand />
    {loading ? <><LoaderCircle className="spin" aria-hidden="true" /><h1>Preparando tu espacio</h1><p role="status">Cargando Trama…</p></> : <>
      <h1>No pudimos abrir Trama</h1><ErrorMessage message={startupError} />
      <p>Revisá tu conexión e intentá de nuevo.</p>
      <div className="button-row"><Button onClick={() => void initialize()}>Reintentar</Button></div>
    </>}
  </main>

  const user = state.users.find(candidate => candidate.id === userId && candidate.status !== 'deleted') ?? null
  return <DemoContext.Provider value={{ state, user, execute, login, register, appeal, searchUsers, getProfile, logout, resolveId: repository.resolveId, notify }}>
    {children}
    {notice && <div className={`toast toast-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      {notice.kind === 'error' ? <AlertCircle size={20} aria-hidden="true" /> : <CheckCircle2 size={20} aria-hidden="true" />}
      <span>{notice.text}</span><IconButton icon={X} label="Cerrar aviso" onClick={() => setNotice(null)} />
    </div>}
  </DemoContext.Provider>
}
export function useDemo() {
  const context = useContext(DemoContext)
  if (!context) throw new Error('No está disponible el contexto de la aplicación.')
  return context
}

export function useAction() {
  const { execute, notify } = useDemo()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const run = async (command: Command, success?: string) => {
    setPending(true)
    setError('')
    try {
      const result = await execute(command)
      if (success) notify(success)
      return result
    } catch (failure) {
      const message = errorMessage(failure)
      console.error('[Trama] Operación rechazada.', failure)
      setError(message)
      notify(message, 'error')
      return null
    } finally {
      setPending(false)
    }
  }
  return { run, pending, error, clearError: () => setError('') }
}
