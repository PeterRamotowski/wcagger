import { newEvaluation, newEvaluationSample } from '../../shared/utils/evaluation'
import type { ProcessStep } from '../../shared/types/evaluation'

export function processEvaluation() {
  const value = newEvaluation()
  value.targetStandard = 'WCAG22AA'
  const sample = newEvaluationSample('https://example.test/start')
  value.samples = [sample]
  const step: ProcessStep = { id: 'entry', name: 'Open form', sampleId: sample.id, stateId: sample.state.id, stateKind: 'initial', action: 'Open the contact page', prerequisites: '', role: '', expectedState: 'An empty contact form is visible' }
  value.processes = [{ id: 'contact', name: 'Contact request', startingPoint: 'Open https://example.com/ and choose Contact', prerequisites: 'Use an empty test inbox', role: 'Visitor', paths: [{ id: 'normal', name: 'Submit a valid request', kind: 'default', condition: '', steps: [step] }, { id: 'errors', name: 'Invalid form', kind: 'critical-branch', condition: 'Start at Contact, leave required inputs empty', steps: [{ ...step, id: 'error', name: 'Show validation errors', stateKind: 'form-error', sampleId: null, stateId: null, action: 'Submit the empty form', expectedState: 'Error summary and inline errors' }] }] }]
  return value
}
