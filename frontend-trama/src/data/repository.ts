import { StateSchema, type Command, type DemoState } from './model'
import { applyCommand, createSeed, newId } from './store'

const DATABASE = 'trama-frontend-demo-v1'
const STORE = 'application'

export class DemoRepository {
  private database: Promise<IDBDatabase> | null = null

  constructor(private readonly name = DATABASE) {}

  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      this.database = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
          reject(new Error('Este navegador no permite guardar la demo. Habilitá el almacenamiento local para continuar.'))
          return
        }
        const request = indexedDB.open(this.name, 1)
        request.onupgradeneeded = () => request.result.createObjectStore(STORE)
        request.onsuccess = () => {
          request.result.onversionchange = () => {
            request.result.close()
            this.database = null
          }
          resolve(request.result)
        }
        request.onerror = () => reject(request.error ?? new Error('No pudimos abrir los datos locales.'))
        request.onblocked = () => reject(new Error('Otra pestaña bloquea los datos. Cerrala y volvé a intentar.'))
      })
      this.database.catch(() => { this.database = null })
    }
    return this.database
  }

  private async transaction(update?: (state: DemoState) => DemoState, reset = false): Promise<DemoState> {
    const database = await this.open()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite')
      const store = transaction.objectStore(STORE)
      const request = store.get('state')
      let result: DemoState | undefined
      let operationError: unknown
      request.onsuccess = () => {
        try {
          const stored: unknown = request.result
          const initial = reset || stored === undefined
          const state = initial ? createSeed() : StateSchema.parse(stored)
          result = update ? update(state) : state
          if (initial || update) store.put(result, 'state')
        } catch (error) {
          operationError = error
          transaction.abort()
        }
      }
      transaction.oncomplete = () => {
        if (result) resolve(result)
        else reject(new Error('No pudimos leer los datos locales.'))
      }
      transaction.onerror = () => reject(operationError ?? transaction.error ?? new Error('No pudimos guardar los cambios.'))
      transaction.onabort = () => reject(operationError ?? transaction.error ?? new Error('Se canceló el guardado. Los cambios no se aplicaron.'))
    })
  }

  load() {
    return this.transaction()
  }

  execute(actorId: string | null, command: Command) {
    return this.transaction(state => applyCommand(state, actorId, command))
  }

  reset() {
    return this.transaction(undefined, true)
  }

  private session = 'trama-demo-profile'
  resolveId = (id: string) => id
  currentUserId() { return sessionStorage.getItem(this.session) }
  async login(email: string) {
    const user = (await this.load()).users.find(candidate => candidate.email === email.trim().toLowerCase() && candidate.status !== 'deleted')
    if (!user) throw new Error('No encontramos ese perfil.')
    sessionStorage.setItem(this.session, user.id)
    return user.id
  }
  async register(input: { email: string; username: string; nombreCompleto: string; password: string }) {
    const id = newId('artista')
    await this.execute(null, { type: 'create-account', user: { id, name: input.nombreCompleto, handle: input.username, email: input.email } })
    sessionStorage.setItem(this.session, id)
    return id
  }
  async appeal(input: { email: string; password: string; mensaje: string }) {
    const id = await this.login(input.email)
    await this.execute(id, { type: 'create-appeal', id: newId('apelacion'), description: input.mensaje })
  }
  logout() { sessionStorage.removeItem(this.session) }

  async close() {
    if (this.database) (await this.database).close()
    this.database = null
  }
}
