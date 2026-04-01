const MAX_IMAGE_DIMENSION = 1920
const JPEG_QUALITY = 0.85

export interface ProcessedImage {
  uri: string
  base64: string
  width: number
  height: number
  wasResized: boolean
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image source'))
    image.src = src
  })
}

async function toDataUrl(uri: string): Promise<string> {
  if (uri.startsWith('data:image')) {
    return uri
  }

  if (uri.startsWith('blob:')) {
    const image = await loadImage(uri)
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to initialize canvas context for blob image')
    }

    ctx.drawImage(image, 0, 0, image.width, image.height)
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  }

  const response = await fetch(uri)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }

  const blob = await response.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image blob'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

export async function processImage(uri: string): Promise<ProcessedImage> {
  const sourceDataUrl = await toDataUrl(uri)
  const image = await loadImage(sourceDataUrl)

  const longEdge = Math.max(image.width, image.height)
  const wasResized = longEdge > MAX_IMAGE_DIMENSION
  const scale = wasResized ? MAX_IMAGE_DIMENSION / longEdge : 1

  const width = Math.round(image.width * scale)
  const height = Math.round(image.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to initialize canvas context')
  }

  ctx.drawImage(image, 0, 0, width, height)
  const resizedDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const base64 = resizedDataUrl.split(',')[1] ?? ''

  if (!base64) {
    throw new Error('Failed to encode image as base64')
  }

  return {
    uri: resizedDataUrl,
    base64,
    width,
    height,
    wasResized,
  }
}

export async function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  const sourceDataUrl = await toDataUrl(uri)
  const image = await loadImage(sourceDataUrl)
  return {
    width: image.width,
    height: image.height,
  }
}
