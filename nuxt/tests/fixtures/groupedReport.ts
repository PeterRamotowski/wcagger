import { createAxeEvidence, createPa11yEvidence } from '../../server/services/scanEvidenceService'
import { groupScanEvidence } from '../../server/services/findingGroupingService'
import { ResultsProcessor } from '../../server/services/resultsProcessor'
import { axeNode, axeResults, axeRule, pa11yIssue, pa11yResults, runContext } from './scanResults'

export function reportFixture(split = false) {
  const result = new ResultsProcessor().createInitialResults(runContext.url)
  result.timestamp = runContext.startedAt
  const direct = createAxeEvidence(axeResults({
    incomplete: [axeRule({ id: 'color-contrast', help: 'Elements must meet minimum color contrast', description: 'Check text contrast', tags: ['wcag143'] })],
    violations: [axeRule(), axeRule({ id: 'image-alt', help: 'Images must have alternative text', description: 'Provide an image alternative', tags: ['wcag111'], nodes: [{ ...axeNode(['#photo']), html: '<img id="photo" src="photo.png">' }] })],
  }), runContext, ['wcag2a'])
  const wrapped = createPa11yEvidence(pa11yResults({ issues: [
    pa11yIssue(),
    pa11yIssue({ code: 'WCAG2AA.Principle1.Guideline1_1.1_1_1.H37', message: 'Images must have alternative text', runner: 'htmlcs', context: '<img src="photo.png">', selector: '#photo' }),
    pa11yIssue({ code: 'color-contrast', message: 'Elements must meet minimum color contrast', runnerExtras: { needsFurtherReview: true } }),
  ] }), runContext, ['axe', 'htmlcs'])
  result.evidence.runs = [...direct.runs, ...wrapped.runs].map(run => ({
    ...run, sampleId: result.evidence.sample.id, stateId: result.evidence.sample.state.id,
    capture: { documentId: 'document', fingerprint: split && run.tool === 'pa11y' ? 'changed' : 'same', stable: true },
  }))
  result.evidence.observations = [...direct.observations, ...wrapped.observations].map((item) => {
    if (!item.element) return item
    const locator = item.element.locator
    const selector = locator.kind === 'css-selector' ? locator.selector : String(locator.target[0])
    return { ...item, element: { ...item.element, documentId: 'document', identity: { documentId: 'document', elementId: selector, signature: 'signature-' + selector } } }
  })
  result.evidence.grouping = groupScanEvidence(result.evidence)
  return result
}
