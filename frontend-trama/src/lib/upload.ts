import { validateFile } from '../data/store'
import type { MediaKind } from '../data/model'

export type Upload = { kind: MediaKind; src: string; width: number; height: number; duration: number }

export async function readUpload(file: File, imageOnly = false): Promise<Upload> {
  const kind = validateFile(file)
  if (imageOnly && kind !== 'image') throw new Error('Elegí una imagen JPG, PNG o WebP.')
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No pudimos leer este archivo.'))
    reader.onerror = () => reject(new Error('No pudimos leer este archivo. Volvé a elegirlo.'))
    reader.onabort = () => reject(new Error('Se canceló la lectura del archivo.'))
    reader.readAsDataURL(file)
  })
  if (kind === 'image') return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ kind, src, width: image.naturalWidth, height: image.naturalHeight, duration: 0 })
    image.onerror = () => reject(new Error('El contenido no se puede abrir como una imagen. Elegí otro archivo.'))
    image.src = src
  })
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio')
    const finish = () => {
      clearTimeout(timeout)
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.removeAttribute('src')
      audio.load()
    }
    const timeout = setTimeout(() => { finish(); reject(new Error('No pudimos leer la duración del audio. Elegí otro archivo o volvé a intentar.')) }, 15000)
    audio.onloadedmetadata = () => {
      const duration = audio.duration
      finish()
      if (!Number.isFinite(duration) || duration <= 0) reject(new Error('No pudimos leer la duración de este audio.'))
      else resolve({ kind, src, width: 900, height: 600, duration })
    }
    audio.onerror = () => { finish(); reject(new Error('Este navegador no puede reproducir el archivo. Probá con MP3 o WAV.')) }
    audio.preload = 'metadata'
    audio.src = src
  })
}
