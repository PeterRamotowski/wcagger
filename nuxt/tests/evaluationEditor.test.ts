// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SampleEditor from '../app/components/Evaluation/SampleEditor.vue'
import { useEvaluation } from '../app/composables/useEvaluation'
import { newEvaluation, newEvaluationSample } from '../shared/utils/evaluation'
import { reportFixture } from './fixtures/groupedReport'
import en from '../i18n/locales/en.json'

const translate = (key: string, params: Record<string, unknown> = {}) => Object.entries(params).reduce((text, [name, value]) => text.replace('{' + name + '}', String(value)), (en as Record<string, string>)[key] ?? key)
function render() {
  const wrapper = mount(SampleEditor, {
    props: { modelValue: newEvaluation(), busy: false, busySampleId: null, statuses: {}, sampleErrors: {}, error: null, canBuild: false },
    global: { stubs: { EvaluationPlanningEditor: true, EvaluationProcessEditor: true }, mocks: { $t: translate } },
  })
  return wrapper
}
describe('evaluation sample editor', () => {
  it('bulk adds full URLs without removing intentional duplicates or partially edited rows', async () => {
    const wrapper = render()
    const draft = wrapper.props('modelValue')
    draft.samples[0]!.selectionReason = 'Keep this draft'
    await wrapper.setProps({ modelValue: draft })
    const bulk = wrapper.find('details textarea')
    await bulk.setValue('https://example.com/?a=1#main\nhttps://example.com/?a=1#main')
    await wrapper.find('details button').trigger('click')
    const value = wrapper.emitted('update:modelValue')![0]![0] as ReturnType<typeof newEvaluation>
    expect(value.samples).toHaveLength(3)
    expect(value.samples[0]!.selectionReason).toBe('Keep this draft')
    expect(value.samples[1]!.url).toBe('https://example.com/?a=1#main')
    expect(value.samples[1]!.id).not.toBe(value.samples[2]!.id)
    await wrapper.setProps({ modelValue: value })
    expect(wrapper.text()).toContain('This URL appears more than once')
    wrapper.unmount()
  })
  it('rejects an invalid bulk list atomically and prevents scanning manual states', async () => {
    const wrapper = render()
    await wrapper.find('details textarea').setValue('https://example.com\n/relative')
    await wrapper.find('details button').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    const sample = newEvaluationSample('https://example.com')
    sample.preparation = 'manual'
    await wrapper.setProps({ modelValue: { ...newEvaluation(), samples: [sample] } })
    const scan = wrapper.findAll('button').find(button => button.text() === 'Scan this sample')!
    expect(scan.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('cannot be scanned yet')
    wrapper.unmount()
  })
  it('emits individual sample scans and combined-report requests', async () => {
    const wrapper = render()
    const sample = newEvaluationSample('https://example.com')
    await wrapper.setProps({ modelValue: { ...newEvaluation(), samples: [sample] }, canBuild: true })
    await wrapper.findAll('button').find(button => button.text() === 'Scan this sample')!.trigger('click')
    expect(wrapper.emitted('scan')![0]).toEqual([sample.id])
    await wrapper.findAll('button').find(button => button.text() === 'Build combined report')!.trigger('click')
    expect(wrapper.emitted('build')).toHaveLength(1)
    wrapper.unmount()
  })
})
describe('evaluation scanning state', () => {
  it('captures configuration, excludes stale scans and clears an older scan after a failed replacement', async () => {
    const request = vi.fn().mockResolvedValue({ success: true, data: reportFixture() })
    vi.stubGlobal('$fetch', request)
    const state = useEvaluation()
    state.evaluation.value.samples[0]!.url = 'https://example.com/'
    const id = state.evaluation.value.samples[0]!.id
    await state.scanSample(id, ['axe'], [])
    expect(state.currentScan(state.evaluation.value.samples[0]!, ['axe'], [])).toBe(true)
    expect(state.currentScan(state.evaluation.value.samples[0]!, ['pa11y'], ['axe'])).toBe(false)
    const originalName = state.scans.value[id]!.sample.name
    state.evaluation.value.samples[0]!.name = 'Renamed'
    expect(state.scans.value[id]!.sample.name).toBe(originalName)
    request.mockResolvedValueOnce({ success: false, error: 'Navigation failed' })
    await state.scanSample(id, ['axe'], [])
    expect(state.scans.value[id]).toBeUndefined()
    expect(state.sampleErrors.value[id]).toBe('Navigation failed')
    expect(state.busy.value).toBe(false)
  })
  it('builds only matching scans, retains manual entries and never scans an unprepared state', async () => {
    const request = vi.fn().mockResolvedValue({ success: true, data: reportFixture() })
    vi.stubGlobal('$fetch', request)
    const state = useEvaluation()
    const sample = state.evaluation.value.samples[0]!
    sample.url = 'https://example.com/'
    const manual = newEvaluationSample(sample.url)
    manual.preparation = 'manual'
    state.evaluation.value.samples.push(manual)
    await state.scanSample(sample.id, ['axe'], [])
    await state.scanSample(manual.id, ['axe'], [])
    expect(request).toHaveBeenCalledTimes(1)
    await state.buildReport(['axe'], [])
    const body = request.mock.calls[1]![1].body
    expect(body.evaluation.samples).toHaveLength(2)
    expect(body.scans).toHaveLength(1)
    expect(body.scans[0].sampleId).toBe(sample.id)
  })
})
