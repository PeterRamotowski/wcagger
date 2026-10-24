// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProcessEditor from '../app/components/Evaluation/ProcessEditor.vue'
import ProcessReport from '../app/components/Evaluation/ProcessReport.vue'
import { processEvaluation } from './fixtures/processEvaluation'
import { newEvaluationSample } from '../shared/utils/evaluation'
import { combineEvaluationResults } from '../server/services/evaluationResultsService'
import { prepareExportData } from '../app/utils/exportReport'
import { reportFixture } from './fixtures/groupedReport'
import en from '../i18n/locales/en.json'

const t = (key: string, params: Record<string, unknown> = {}) => Object.entries(params).reduce((text, [key, value]) => text.replace('{' + key + '}', String(value)), (en as Record<string, string>)[key] ?? key)
function editor() {
  const wrapper = mount(ProcessEditor, { props: { 'modelValue': processEvaluation(), 'onUpdate:modelValue': (value) => {
    void wrapper.setProps({ modelValue: value })
  } }, global: { mocks: { $t: t } } })
  return wrapper
}
describe('process editor and report', () => {
  it('links exact sample states and creates manual samples without overwriting an existing initial page', async () => {
    const wrapper = editor()
    const row = wrapper.findAll('[data-step-id]')[1]!
    const id = wrapper.props('modelValue').samples[0]!.id
    await row.findAll('select')[1]!.setValue(id)
    expect(wrapper.text()).toContain('This interaction state needs a manual sample')
    await row.findAll('button').find(button => button.text() === 'Create and link a sample for this state')!.trigger('click')
    const value = wrapper.props('modelValue')
    expect(value.samples).toHaveLength(2)
    expect(value.samples[0]!.preparation).toBe('initial-page')
    expect(value.samples[1]!).toMatchObject({ url: value.samples[0]!.url, name: 'Show validation errors', preparation: 'manual', state: { description: 'Error summary and inline errors' } })
    expect(value.processes![0]!.paths[1]!.steps[0]!).toMatchObject({ sampleId: value.samples[1]!.id, stateId: value.samples[1]!.state.id })
    expect(wrapper.text()).not.toContain('This interaction state needs a manual sample')
    wrapper.unmount()
  })
  it('reorders stable step identities, preserves references on sample removal and enforces the sample cap', async () => {
    const wrapper = editor()
    const path = wrapper.find('[data-path-id]')
    await path.findAll('button').find(button => button.text() === 'Add step')!.trigger('click')
    const secondId = wrapper.props('modelValue').processes![0]!.paths[0]!.steps[1]!.id
    await path.findAll('[data-step-id]')[1]!.findAll('button').find(button => button.text() === 'Move up')!.trigger('click')
    expect(wrapper.props('modelValue').processes![0]!.paths[0]!.steps.map(step => step.id)).toEqual([secondId, 'entry'])
    const value = wrapper.props('modelValue')
    const linked = value.samples[0]!.id
    await wrapper.setProps({ modelValue: { ...value, samples: Array.from({ length: 20 }, () => newEvaluationSample('https://example.com/new')) } })
    expect((path.findAll('[data-step-id]')[1]!.findAll('select')[1]!.element as HTMLSelectElement).value).toBe(linked)
    expect(wrapper.text()).toContain('Linked sample was removed')
    expect(wrapper.props('modelValue').processes![0]!.paths[0]!.steps[1]!.sampleId).toBe(linked)
    expect(path.findAll('button').find(button => button.text() === 'Create and link a sample for this state')!.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('reports manual gaps alongside successful initial-page scans and uses the captured definition', () => {
    const value = processEvaluation()
    const results = combineEvaluationResults({ evaluation: value, scans: [{ sampleId: value.samples[0]!.id, evidence: reportFixture().evidence }] })
    value.processes![0]!.name = 'Changed draft'
    const wrapper = mount(ProcessReport, { props: { report: prepareExportData(results).report }, global: { mocks: { $t: t } } })
    expect(wrapper.text()).toContain('Contact request')
    expect(wrapper.text()).not.toContain('Changed draft')
    expect(wrapper.text()).toContain('Initial page fully scanned; manual assessment pending')
    expect(wrapper.text()).toContain('Sample/state unavailable')
    expect(wrapper.text()).toContain('Submit the empty form')
    expect(wrapper.text()).toContain('Visitor')
    wrapper.unmount()
  })
})
