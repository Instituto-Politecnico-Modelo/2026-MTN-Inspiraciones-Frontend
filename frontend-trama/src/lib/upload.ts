import { validateFile } from '../data/store'
import type { MediaKind } from '../data/model'

export type Upload = { kind: MediaKind; src: string; width: number; height: number; duration: number; file?: File }

export async function readUpload(file: File, imageOnly = false): Promise<Upload> {
  const kind = validateFile(file)
  if (imageOnly && kind !== 'image') throw new Error('Elegí una imagen JPG, PNG o WebP.')
  if (kind !== 'image') return readPlayableMedia(kind, file)
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No pudimos leer este archivo.'))
    reader.onerror = () => reject(new Error('No pudimos leer este archivo. Volvé a elegirlo.'))
    reader.onabort = () => reject(new Error('Se canceló la lectura del archivo.'))
    reader.readAsDataURL(file)
  })
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ kind, src, width: image.naturalWidth, height: image.naturalHeight, duration: 0 })
    image.onerror = () => reject(new Error('El contenido no se puede abrir como una imagen. Elegí otro archivo.'))
    image.src = src
  })
}

async function readPlayableMedia(kind: 'audio' | 'video', file: File): Promise<Upload> {
  const src = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const element = document.createElement(kind)
      const finish = () => {
        clearTimeout(timeout)
        element.onloadedmetadata = null
        element.onerror = null
        element.removeAttribute('src')
        element.load()
      }
      const timeout = setTimeout(() => {
        finish()
        reject(new Error('No pudimos leer el archivo. Elegí otro o volvé a intentar.'))
      }, 15000)
      element.onloadedmetadata = () => {
        const duration = element.duration
        const width = element instanceof HTMLVideoElement ? element.videoWidth : 900
        const height = element instanceof HTMLVideoElement ? element.videoHeight : 600
        finish()
        if (!Number.isFinite(duration) || duration <= 0 || !width || !height) {
          reject(new Error('El archivo no contiene una pista que se pueda reproducir.'))
        } else {
          resolve({ kind, src, width, height, duration, file })
        }
      }
      element.onerror = () => {
        finish()
        reject(new Error(kind === 'video' ? 'Este navegador no puede reproducir el video. Probá con MP4 o WebM.' : 'Este navegador no puede reproducir el audio. Probá con MP3 o WAV.'))
      }
      element.preload = 'metadata'
      element.src = src
    })
  } catch (error) {
    URL.revokeObjectURL(src)
    throw error
  }
}
