// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { mount } from '@vue/test-utils'
import PlanningEditor from '../app/components/Evaluation/PlanningEditor.vue'
import SampleEditor from '../app/components/Evaluation/SampleEditor.vue'
import { useEvaluation } from '../app/composables/useEvaluation'
import { newEvaluation, newEvaluationSample, newRecordId } from '../shared/utils/evaluation'
import { selectRandomSamples } from '../server/services/evaluationSamplingService'
import type { Evaluation } from '../shared/types/evaluation'
import en from '../i18n/locales/en.json'
import { reportFixture } from './fixtures/groupedReport'

const t = (key: string, values: Record<string, unknown> = {}) => Object.entries(values).reduce((text, [key, value]) => text.replace('{' + key + '}', String(value)), (en as Record<string, string>)[key] ?? key)
function draft() {
  const value = newEvaluation()
  value.samples = [newEvaluationSample('https://example.com/structured')]
  return value
}
function planning(value = draft()) {
  const wrapper = mount(PlanningEditor, { props: { 'modelValue': value, 'busy': false, 'onUpdate:modelValue': (next) => {
    void wrapper.setProps({ modelValue: next })
  } }, global: { mocks: { $t: t } } })
  return wrapper
}
describe('scope and sampling editor', () => {
  it('preserves scope metadata and removes deleted inventory references from every sample', async () => {
    const value = draft()
    value.scope.productName = 'Product identity'
    value.inventory = [{ id: 'header', kind: 'common-view', name: 'Header', description: '' }]
    value.samples[0]!.inventoryIds = ['header']
    const wrapper = planning(value)
    await wrapper.findAll('label').find(label => label.text().startsWith('Evaluator or team'))!.find('input').setValue('Reviewer')
    expect(wrapper.props('modelValue').scope).toMatchObject({ evaluator: 'Reviewer', productName: 'Product identity' })
    await wrapper.find('[data-inventory-id] button').trigger('click')
    expect(wrapper.props('modelValue').inventory).toEqual([])
    expect(wrapper.props('modelValue').samples[0]!.inventoryIds).toEqual([])
    wrapper.unmount()
  })
  it('rejects invalid pool input atomically and enables random selection only with a source and eligible views', async () => {
    const wrapper = planning()
    const pool = wrapper.findAll('label').find(label => label.text().startsWith('Add in-scope candidate URLs'))!.find('textarea')
    await pool.setValue('https://example.com/a\n/relative')
    await wrapper.findAll('button').find(button => button.text() === 'Add candidate URLs')!.trigger('click')
    expect(wrapper.find('[role=alert]').exists()).toBe(true)
    expect(wrapper.props('modelValue').sampling!.candidates).toEqual([])
    await pool.setValue('https://example.com/a?x=1#main\nhttps://example.com/a?x=1#main')
    await wrapper.findAll('button').find(button => button.text() === 'Add candidate URLs')!.trigger('click')
    expect(wrapper.props('modelValue').sampling!.candidates).toHaveLength(2)
    expect(wrapper.text()).toContain('Eligible unique candidate views: 1 of 2')
    const draw = wrapper.findAll('button').find(button => button.text() === 'Add random samples')!
    expect(draw.attributes('disabled')).toBeDefined()
    await wrapper.findAll('label').find(label => label.text().startsWith('Candidate-pool source'))!.find('textarea').setValue('CMS export')
    expect(draw.attributes('disabled')).toBeUndefined()
    await draw.trigger('click')
    expect(wrapper.emitted('draw')).toHaveLength(1)
    expect(wrapper.text()).toContain('not declared to cover the whole scope')
    wrapper.unmount()
  })
  it('keeps generated URLs and states tied to their recorded draw, and preserves metadata when scope text changes', async () => {
    const value = draft()
    value.scope.productName = 'Retain this identity'
    value.sampling!.source = 'Sitemap'
    value.sampling!.candidates = [{ id: newRecordId(), url: 'https://example.com/random', name: '', stateDescription: 'Initial page state', preparation: 'initial-page' }]
    const selected = selectRandomSamples(value, () => 0)
    const wrapper = mount(SampleEditor, { props: { modelValue: selected, busy: false, busySampleId: null, statuses: {}, sampleErrors: {}, error: null, canBuild: false }, global: { stubs: { EvaluationPlanningEditor: true, EvaluationProcessEditor: true }, mocks: { $t: t } } })
    const row = wrapper.findAll('[data-sample-id]')[1]!
    expect(row.find('input[type=url]').attributes('disabled')).toBeDefined()
    expect(row.findAll('textarea').at(-1)!.attributes('disabled')).toBeDefined()
    const description = wrapper.findAll('label').find(label => label.text().startsWith('Scope description'))!.find('textarea')
    await description.setValue('New scope description')
    const next = wrapper.emitted('update:modelValue')![0]![0] as Evaluation
    expect(next.scope).toMatchObject({ productName: 'Retain this identity', description: 'New scope description' })
    wrapper.unmount()
  })
  it('loads server-selected samples without discarding existing scan evidence', async () => {
    const scope = effectScope()
    const state = scope.run(() => useEvaluation())!
    state.evaluation.value = draft()
    const sample = state.evaluation.value.samples[0]!
    state.scans.value[sample.id] = { sample: JSON.parse(JSON.stringify(sample)), standard: state.evaluation.value.targetStandard, tools: ['axe'], runners: [], results: reportFixture() }
    state.evaluation.value.sampling!.source = 'CMS export'
    state.evaluation.value.sampling!.candidates = [{ id: newRecordId(), url: 'https://example.com/random', name: '', stateDescription: 'Initial page state', preparation: 'initial-page' }]
    const selected = selectRandomSamples(state.evaluation.value, () => 0)
    const fetcher = vi.fn().mockResolvedValue(selected)
    vi.stubGlobal('$fetch', fetcher)
    try {
      await state.drawSamples()
      expect(fetcher.mock.calls[0]![0]).toBe('/api/evaluation-sampling')
      expect(state.evaluation.value.samples).toHaveLength(2)
      expect(state.currentScan(state.evaluation.value.samples[0]!, ['axe'], [])).toBe(true)
      expect(state.busy.value).toBe(false)
    } finally {
      scope.stop()
    }
  })
})
