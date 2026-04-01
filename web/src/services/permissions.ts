export type PermissionStatus = 'granted' | 'denied' | 'undetermined'

export interface PermissionState {
  camera: PermissionStatus
  microphone: PermissionStatus
  location: PermissionStatus
  mediaLibrary: PermissionStatus
}

export type PermissionType = 'camera' | 'microphone' | 'location' | 'mediaLibrary'

async function queryPermission(name: PermissionName): Promise<PermissionStatus> {
  if (!('permissions' in navigator)) {
    return 'undetermined'
  }

  try {
    const status = await navigator.permissions.query({ name })
    if (status.state === 'granted') return 'granted'
    if (status.state === 'denied') return 'denied'
    return 'undetermined'
  } catch {
    return 'undetermined'
  }
}

export async function checkAllPermissions(): Promise<PermissionState> {
  const [camera, microphone, location] = await Promise.all([
    queryPermission('camera'),
    queryPermission('microphone'),
    queryPermission('geolocation'),
  ])

  return {
    camera,
    microphone,
    location,
    mediaLibrary: 'granted',
  }
}

export async function isPermissionGranted(type: PermissionType): Promise<boolean> {
  const status = await checkAllPermissions()
  return status[type] === 'granted'
}

async function requestMediaAccess(kind: 'camera' | 'microphone'): Promise<PermissionStatus> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'denied'
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      kind === 'camera' ? { video: true } : { audio: true },
    )
    stream.getTracks().forEach((track) => track.stop())
    return 'granted'
  } catch {
    return 'denied'
  }
}

async function requestLocationAccess(): Promise<PermissionStatus> {
  if (!navigator.geolocation) {
    return 'denied'
  }

  return await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      () => resolve('denied'),
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: true },
    )
  })
}

export async function requestPermission(type: PermissionType): Promise<PermissionStatus> {
  switch (type) {
    case 'camera':
      return await requestMediaAccess('camera')
    case 'microphone':
      return await requestMediaAccess('microphone')
    case 'location':
      return await requestLocationAccess()
    case 'mediaLibrary':
      return 'granted'
  }
}

function showPermissionDeniedAlert(title: string, message: string): void {
  // Browsers do not provide a universal deep-link to site permission settings.
  // Use a confirm dialog to keep parity with a user prompt flow.
  window.confirm(`${title}\n\n${message}`)
}

export async function requestCameraPermission(): Promise<boolean> {
  const status = await requestPermission('camera')
  if (status === 'denied') {
    showPermissionDeniedAlert(
      'Camera Permission Required',
      'CastSense needs camera access to capture fishing spot photos for analysis.',
    )
  }
  return status === 'granted'
}

export async function requestMicrophonePermission(): Promise<boolean> {
  const status = await requestPermission('microphone')
  if (status === 'denied') {
    showPermissionDeniedAlert(
      'Microphone Permission Recommended',
      'Microphone access is optional unless video capture with audio is enabled.',
    )
  }
  return status === 'granted'
}

export async function requestLocationPermission(): Promise<boolean> {
  const status = await requestPermission('location')
  if (status === 'denied') {
    showPermissionDeniedAlert(
      'Location Permission Recommended',
      'Location improves weather and local fishing context in analysis.',
    )
  }
  return status === 'granted'
}

export async function requestMediaLibraryPermission(): Promise<boolean> {
  const status = await requestPermission('mediaLibrary')
  return status === 'granted'
}

export async function requestCapturePermissions(): Promise<{
  camera: boolean
  microphone: boolean
  location: boolean
}> {
  const [camera, microphone, location] = await Promise.all([
    requestCameraPermission(),
    requestMicrophonePermission(),
    requestLocationPermission(),
  ])

  return { camera, microphone, location }
}

export async function requestLibraryPermissions(): Promise<{
  mediaLibrary: boolean
  location: boolean
}> {
  const [mediaLibrary, location] = await Promise.all([
    requestMediaLibraryPermission(),
    requestLocationPermission(),
  ])

  return { mediaLibrary, location }
}

export async function requestRequiredCapturePermissions(): Promise<boolean> {
  return await requestCameraPermission()
}

export async function hasCapturePermissions(): Promise<boolean> {
  const state = await checkAllPermissions()
  return state.camera === 'granted'
}

export async function canUseLocation(): Promise<boolean> {
  const state = await checkAllPermissions()
  return state.location === 'granted' || state.location === 'undetermined'
}

export function isGranted(status: PermissionStatus): boolean {
  return status === 'granted'
}

export function isDenied(status: PermissionStatus): boolean {
  return status === 'denied'
}

export function isBlocked(status: PermissionStatus): boolean {
  return status === 'denied'
}

export function isUnavailable(_status: PermissionStatus): boolean {
  return false
}

export const RESULTS = {
  GRANTED: 'granted' as const,
  DENIED: 'denied' as const,
  BLOCKED: 'denied' as const,
  UNAVAILABLE: 'denied' as const,
}
