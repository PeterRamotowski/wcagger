export interface CandidateInspection {
  schemaVersion: 1
  method: 'static-html-v1'
  requestedUrl: string
  finalUrl: string
  inspectedAt: string
  durationLimitMs: number
  byteLimit: number
  bytes: number
  contentType: string
  title: string
  suggestedTypes: string[]
}
export const INSPECTION_DURATIONS = [5000, 10000, 15000] as const
export const INSPECTION_BYTES = [131072, 262144, 524288] as const
export const INSPECTION_MAX_REDIRECTS = 3
