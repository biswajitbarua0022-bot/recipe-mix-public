export const maxPhotoBytes = 10 * 1024 * 1024
export const maxPhotoEdge = 1200

export function imageType(header: Uint8Array) {
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'image/jpeg'
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => header[index] === value)) return 'image/png'
  const text = new TextDecoder().decode(header)
  if (text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP') return 'image/webp'
  return null
}

export async function preparePhoto(file: File): Promise<Blob> {
  if (file.size > maxPhotoBytes) throw new Error('This photo is over 10 MB. Choose a smaller file.')
  const type = imageType(new Uint8Array(await file.slice(0, 12).arrayBuffer()))
  if (!type) throw new Error('Choose a JPG, PNG or WebP image.')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file.slice(0, file.size, type))
  } catch {
    throw new Error('This image could not be opened. Choose another JPG, PNG or WebP image.')
  }

  try {
    const scale = Math.min(1, maxPhotoEdge / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser could not resize the photo.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('This browser could not save the resized photo.'))
      }, 'image/webp', 0.84)
    })
  } finally {
    bitmap.close()
  }
}
