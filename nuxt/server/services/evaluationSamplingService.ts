import { randomInt, randomUUID } from 'node:crypto'
import type { RandomDraw } from '~~/shared/types/evaluation'
import { MAX_EVALUATION_SAMPLES, newEvaluationSample, validateEvaluation } from '~~/shared/utils/evaluation'
import { eligibleCandidates, locationForSample, MAX_DRAWS, samplingCoverage } from '~~/shared/utils/sampling'

export function selectRandomSamples(input: unknown, choose: (upperBound: number) => number = randomInt) {
  const evaluation = validateEvaluation(input)
  const sampling = evaluation.sampling!
  const coverage = samplingCoverage(evaluation)
  if (!sampling.source) throw new Error('Describe the candidate-pool source before selecting random samples')
  if (!coverage.structured) throw new Error('Add a structured sample set first')
  if (!coverage.missingRandom) throw new Error('The current random sample target is already met')
  if (sampling.draws.length >= MAX_DRAWS) throw new Error('The random draw history limit has been reached')
  const candidates = eligibleCandidates(evaluation)
  const count = Math.min(coverage.missingRandom, candidates.length, MAX_EVALUATION_SAMPLES - evaluation.samples.length)
  if (!count) throw new Error(candidates.length ? 'No sample slots remain; expand the evaluation capacity or revise the sample set' : 'No unused candidate views remain; record the limitation or expand the candidate pool')
  const draw: RandomDraw = {
    id: randomUUID(), timestamp: new Date().toISOString(), method: 'crypto-random-without-replacement-v1',
    source: sampling.source, coverage: sampling.coverage, coverageNotes: sampling.coverageNotes,
    requestedCount: coverage.missingRandom, eligibleCount: candidates.length,
    structuredSampleIds: evaluation.samples.filter(sample => sample.selection?.kind !== 'random').map(sample => sample.id),
    excludedLocations: evaluation.samples.map(locationForSample), pool: structuredClone(sampling.candidates), selected: [],
  }
  for (let index = 0; index < count; index++) {
    const selected = choose(candidates.length)
    if (!Number.isInteger(selected) || selected < 0 || selected >= candidates.length) throw new Error('Invalid random index')
    const candidate = candidates.splice(selected, 1)[0]!
    const sample = newEvaluationSample(candidate.url)
    sample.name = candidate.name
    sample.typeTags = [...(candidate.typeTags ?? [])]
    sample.state.description = candidate.stateDescription
    sample.preparation = candidate.preparation
    sample.selectionReason = sampling.rationale
    sample.selection = { kind: 'random', source: draw.source, method: draw.method, drawId: draw.id, candidateId: candidate.id }
    draw.selected.push({ sampleId: sample.id, candidateId: candidate.id })
    evaluation.samples.push(sample)
  }
  sampling.draws.push(draw)
  return validateEvaluation(evaluation)
}
