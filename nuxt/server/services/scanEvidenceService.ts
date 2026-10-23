import { randomUUID } from 'node:crypto'
import { getPa11yStandard } from '~~/server/utils/wcagMapping'
import type { AxeResults } from 'axe-core'
import type { EngineEvidence, ObservationOutcome, Pa11yScanResults, ScanObservation } from '~~/shared/types/scanEvidence'

interface RunContext {
  url: string
  standard: string
  startedAt: string
  completedAt: string
}

export function createAxeEvidence(results: AxeResults, context: RunContext, tags: string[], timeout?: number): EngineEvidence {
  const runId = randomUUID()
  const groups = [
    ['violations', 'violation'],
    ['incomplete', 'incomplete'],
    ['passes', 'pass'],
    ['inapplicable', 'inapplicable'],
  ] as const
  const observations: ScanObservation[] = groups.flatMap(([group, outcome]) => results[group].flatMap((result) => {
    const { nodes, ...rule } = result
    // Nodeless rules remain rule-level observations, with no invented element.
    return (nodes.length ? nodes : [undefined]).map(node => ({
      id: randomUUID(),
      runId,
      ruleId: rule.id,
      outcome,
      title: rule.help,
      description: rule.description,
      helpUrl: rule.helpUrl,
      impact: node?.impact ?? rule.impact,
      tags: [...rule.tags],
      element: node?.target.length
        ? {
            documentId: runId,
            locator: { kind: 'axe-target' as const, target: node.target },
            html: node.html,
          }
        : undefined,
      evidence: { kind: 'axe' as const, rule, node },
    }))
  }))
  return {
    runs: [{
      id: runId,
      tool: 'axe',
      engine: 'axe',
      engineVersion: results.testEngine.version,
      status: 'completed',
      startedAt: context.startedAt,
      completedAt: context.completedAt,
      requestedUrl: context.url,
      resolvedUrl: results.url,
      standard: context.standard,
      configuration: { tags, timeout },
    }],
    observations,
  }
}

export function createPa11yEvidence(results: Pa11yScanResults, context: RunContext, runners: string[]): EngineEvidence {
  // Include successful runners even if they reported no issues. Never guess an unknown runner.
  const runNames = [...new Set([...runners, ...results.issues.map(issue => issue.runner ?? 'unknown')])]
  const runs: EngineEvidence['runs'] = runNames.map(runner => ({
    id: randomUUID(),
    tool: 'pa11y',
    runner,
    engine: runner === 'axe' || runner === 'htmlcs' ? runner : 'unknown',
    status: 'completed',
    startedAt: context.startedAt,
    completedAt: context.completedAt,
    requestedUrl: context.url,
    resolvedUrl: results.pageUrl,
    standard: context.standard,
    configuration: { standard: getPa11yStandard(context.standard), runners: [...runners], timeout: 20000, wait: 2000 },
  }))
  const observations: ScanObservation[] = results.issues.map((issue) => {
    const run = runs.find(item => item.runner === (issue.runner ?? 'unknown'))!
    const extras = issue.runnerExtras
    const outcome: ObservationOutcome = extras?.needsFurtherReview === true
      ? 'incomplete'
      : issue.type === 'error'
        ? 'violation'
        : issue.type === 'warning' || issue.type === 'notice' ? issue.type : 'unknown'
    return {
      id: randomUUID(),
      runId: run.id,
      ruleId: issue.code,
      outcome,
      title: issue.message,
      description: typeof extras?.description === 'string' ? extras.description : undefined,
      helpUrl: typeof extras?.helpUrl === 'string' ? extras.helpUrl : undefined,
      impact: typeof extras?.impact === 'string' ? extras.impact : undefined,
      tags: [],
      element: issue.selector
        ? {
            documentId: run.id,
            locator: { kind: 'css-selector', selector: issue.selector },
            html: issue.context,
          }
        : undefined,
      evidence: { kind: 'pa11y', issue },
    }
  })
  return { runs, observations }
}
