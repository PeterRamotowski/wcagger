import { newEvaluation, newEvaluationSample } from '../../shared/utils/evaluation'
import { reportFixture } from './groupedReport'

export function evaluationFixture(sameUrl = false) {
  const first = newEvaluationSample('https://example.com/article?lang=en#content')
  first.name = 'Article'
  first.typeTags = ['article', 'video']
  first.selectionReason = 'Representative article with video'
  const second = newEvaluationSample(sameUrl ? first.url : 'https://example.com/contact')
  second.name = 'Contact'
  const manual = newEvaluationSample(first.url)
  manual.preparation = 'manual'
  manual.state.description = 'Validation errors after submission'
  const evaluation = { ...newEvaluation(), name: 'Example evaluation', targetStandard: 'WCAG22AA', scope: { description: 'Public pages in English' }, samples: [first, second, manual] }
  const scans = [first, second].map((sample) => {
    const result = reportFixture()
    result.url = sample.url
    result.evidence.sample.url = sample.url
    for (const run of result.evidence.runs) {
      run.requestedUrl = sample.url
      run.resolvedUrl = sample.url
      run.standard = evaluation.targetStandard
    }
    return { sampleId: sample.id, evidence: result.evidence }
  })
  return { evaluation, scans }
}
