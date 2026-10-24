// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { readonly } from 'vue'
import { mount } from '@vue/test-utils'
import AssessmentEditor from '../app/components/Evaluation/AssessmentEditor.vue'
import AssessmentReport from '../app/components/Evaluation/AssessmentReport.vue'
import { savedFixture } from './fixtures/savedEvaluation'
import { buildGroupedReport } from '../shared/utils/reportPresentation'
import type { ManualAssessment } from '../shared/types/manualAssessment'
import en from '../i18n/locales/en.json'

const t = (key: string, params: Record<string, unknown> = {}) => Object.entries(params).reduce((text, [key, value]) => text.replace('{' + key + '}', String(value)), (en as Record<string, string>)[key] ?? key)
function editor() {
  const value = savedFixture()
  const wrapper = mount(AssessmentEditor, { props: { 'evaluation': value.evaluation, 'modelValue': [] as ManualAssessment[], 'runIds': { [value.evaluation.samples[0]!.id]: value.report!.evidence.runs.map(run => run.id) }, 'report': buildGroupedReport(readonly(value.report!)), 'busy': false, 'onUpdate:modelValue': (modelValue) => {
    void wrapper.setProps({ modelValue })
  } }, global: { mocks: { $t: t } } })
  return { wrapper, value }
}
describe('manual assessment editor', () => {
  it('records only a justified human outcome and links matching findings without merging sample assessments', async () => {
    const { wrapper, value } = editor()
    const outcome = wrapper.findAll('select')[2]!
    await outcome.setValue('passed')
    await wrapper.findAll('button').find(button => button.text() === 'Record assessment')!.trigger('click')
    expect(wrapper.find('[role=alert]').text()).toContain('requires')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    for (const [label, text] of [['Reviewer', 'Reviewer'], ['Actual testing environment', 'Firefox and NVDA'], ['Justification', 'Inspected every relevant image and checked reading order']]) await wrapper.findAll('label').find(item => item.text().startsWith(label!))!.find('textarea').setValue(text!)
    await wrapper.find('input[value=content]').setValue(true)
    const linked = wrapper.findAll('label').find(item => item.text().includes('Images must have alternative text'))!
    await linked.find('input').setValue(true)
    expect(wrapper.findAll('select')[0]!.attributes('disabled')).toBeDefined()
    await wrapper.findAll('button').find(button => button.text() === 'Record assessment')!.trigger('click')
    const assessment = wrapper.props('modelValue')[0]!
    expect(assessment).toMatchObject({ outcome: 'passed', reviewer: 'Reviewer', criterionId: '1.1.1', sampleId: value.evaluation.samples[0]!.id, methods: ['content'] })
    expect(assessment.observationIds.length).toBeGreaterThan(0)
    expect(wrapper.findAll('select')[0]!.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
  it('retains prior revisions and marks stale evidence for review without overwriting the earlier outcome', async () => {
    const { wrapper, value } = editor()
    await wrapper.findAll('select')[2]!.setValue('needs-review')
    await wrapper.findAll('button').find(button => button.text() === 'Record assessment')!.trigger('click')
    const original = wrapper.props('modelValue')[0]!
    await wrapper.setProps({ evaluation: { ...value.evaluation, scope: { ...value.evaluation.scope, boundaries: 'Scope expanded' } } })
    expect(wrapper.text()).toContain('Needs renewed review')
    expect(wrapper.props('modelValue')[0]!.basis).toEqual(original.basis)
    await wrapper.findAll('button').find(button => button.text() === 'Record assessment')!.trigger('click')
    expect(wrapper.emitted('archive')![0]![0]).toMatchObject({ outcome: 'needs-review', basis: original.basis })
    expect(wrapper.props('modelValue')[0]!.basis.scope).not.toBe(original.basis.scope)
    expect(wrapper.text()).not.toContain('Needs renewed review')
    wrapper.unmount()
  })
  it('shows recorded outcomes separately from untested pairs and renders supporting evidence as text', async () => {
    const { wrapper, value } = editor()
    await wrapper.findAll('select')[2]!.setValue('needs-review')
    await wrapper.findAll('label').find(item => item.text().startsWith('Supporting evidence'))!.find('textarea').setValue('<img src=x onerror=alert(1)>')
    await wrapper.findAll('button').find(button => button.text() === 'Record assessment')!.trigger('click')
    value.report!.evidence.evaluation!.manualAssessments = wrapper.props('modelValue')
    const report = mount(AssessmentReport, { props: { report: buildGroupedReport(readonly(value.report!)) }, global: { mocks: { $t: t } } })
    expect(report.text()).toContain('Needs review')
    expect(report.text()).toContain('54')
    expect(report.find('img').exists()).toBe(false)
    expect(report.text()).toContain('<img src=x')
    report.unmount()
    wrapper.unmount()
  })
})
