import type { AccessibilityCheckResults } from './accessibility'
import type { Evaluation } from './evaluation'

export type EngineTaskKey = 'axe' | 'pa11y:axe' | 'pa11y:htmlcs'
export type WorkStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped'
export type JobStatus = 'queued' | 'running' | 'completed' | 'incomplete' | 'failed'
export interface EngineAttempt {
  id: string
  status: WorkStatus
  startedAt?: string
  completedAt?: string
  error?: string
}
export interface EngineTask { sampleId: string, key: EngineTaskKey, attempts: EngineAttempt[] }
export interface EvaluationJob {
  schemaVersion: 1
  id: string
  evaluation: Evaluation
  tools: string[]
  runners: string[]
  status: JobStatus
  createdAt: string
  updatedAt: string
  expiresAt: string
  tasks: EngineTask[]
}
export interface EngineUpdate { key: EngineTaskKey, status: 'running' | 'completed' | 'failed', result?: AccessibilityCheckResults, error?: string }
export interface EvaluationExecution {
  tools: string[]
  runners: string[]
  jobId: string
  status: JobStatus
  tasks: EngineTask[]
}
