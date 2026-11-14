import { markBackupExported, readBackupData } from '../data/backup-store'
import type { BackupData } from '../data/backup-store'
import { localDateKey } from '../planner/calendar'
import { imageType, maxPhotoBytes, maxPhotoEdge } from '../recipes/prepare-photo'
import { makeBackupFile, parseBackupFile } from './backup-format'
import type { EncodedPhoto } from './backup-format'

async function encodePhoto(blob: Blob): Promise<EncodedPhoto> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const type = imageType(bytes.subarray(0, 12))
  if (!type) throw new Error('A saved photo has an unsupported format.')
  const chunks: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)))
  }
  return { type, base64: btoa(chunks.join('')) }
}

async function decodePhoto(photo: EncodedPhoto) {
  if (photo.base64.length > Math.ceil(maxPhotoBytes / 3) * 4) throw new Error('A backup photo is over 10 MB.')
  try {
    if (photo.base64.length % 4 !== 0 || /[^a-z0-9+/=]/i.test(photo.base64)) throw new Error()
    const bytes = Uint8Array.from(atob(photo.base64), (character) => character.charCodeAt(0))
    if (bytes.length > maxPhotoBytes || imageType(bytes.subarray(0, 12)) !== photo.type) throw new Error()
    const blob = new Blob([bytes], { type: photo.type })
    const bitmap = await createImageBitmap(blob)
    const edge = Math.max(bitmap.width, bitmap.height)
    bitmap.close()
    if (edge > maxPhotoEdge) throw new Error()
    return blob
  } catch {
    throw new Error('A backup photo is invalid or exceeds the supported image size.')
  }
}

export async function prepareRestore(file: File) {
  const backup = parseBackupFile(await file.text())
  const recipePhotos: BackupData['recipePhotos'] = []
  for (const { recipeId, blob } of backup.data.recipePhotos) {
    recipePhotos.push({ recipeId, blob: await decodePhoto(blob) })
  }
  return { exportedAt: backup.exportedAt, data: { ...backup.data, recipePhotos } }
}

export async function downloadBackup() {
  const { data } = await readBackupData()
  const recipePhotos: BackupData<EncodedPhoto>['recipePhotos'] = []
  for (const { recipeId, blob } of data.recipePhotos) {
    recipePhotos.push({ recipeId, blob: await encodePhoto(blob) })
  }

  const now = new Date()
  const backup = makeBackupFile({ ...data, recipePhotos }, now)
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `recipe-mix-backup-${localDateKey(now)}.json`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  // A failed status write cannot undo a download.
  await markBackupExported(now.getTime()).catch(() => {})
  return now.getTime()
}
