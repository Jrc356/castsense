const PHOTO_QUALITY = 0.8

export interface PhotoCapture {
  uri: string
  width: number
  height: number
  mimeType: string
  sizeBytes?: number
}

export interface CameraRef {
  takePictureAsync: (options?: Record<string, unknown>) => Promise<{
    uri: string
    width?: number
    height?: number
    mimeType?: string
    sizeBytes?: number
  }>
}

export interface LibraryMediaResult {
  uri: string
  type: 'photo'
  width: number
  height: number
  mimeType: string
  sizeBytes?: number
  exif?: {
    location?: {
      latitude: number
      longitude: number
      altitude?: number
    }
    timestamp?: Date
  }
}

export async function capturePhoto(camera: CameraRef): Promise<PhotoCapture> {
  try {
    const photo = await camera.takePictureAsync({
      quality: PHOTO_QUALITY,
      base64: false,
    })

    return {
      uri: photo.uri,
      width: photo.width ?? 0,
      height: photo.height ?? 0,
      mimeType: photo.mimeType ?? 'image/jpeg',
      sizeBytes: photo.sizeBytes,
    }
  } catch (error) {
    throw new CameraError('CAPTURE_FAILED', 'Failed to capture photo', error)
  }
}

function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null)
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0] ?? null
      resolve(file)
    }
    input.click()
  })
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      resolve({ width: image.width, height: image.height })
    }
    image.onerror = () => reject(new Error('Failed to read selected image dimensions'))
    image.src = uri
  })
}

export async function pickMediaFromLibrary(): Promise<LibraryMediaResult | null> {
  try {
    const file = await pickImageFile()
    if (!file) {
      return null
    }

    const uri = URL.createObjectURL(file)
    const { width, height } = await getImageSize(uri)

    return {
      uri,
      type: 'photo',
      width,
      height,
      mimeType: file.type || 'image/jpeg',
      sizeBytes: file.size,
    }
  } catch (error) {
    throw new CameraError('PICKER_FAILED', 'Failed to select photo from library', error)
  }
}

export class CameraError extends Error {
  code: string
  originalError?: unknown

  constructor(code: string, message: string, originalError?: unknown) {
    super(message)
    this.name = 'CameraError'
    this.code = code
    this.originalError = originalError
  }
}
