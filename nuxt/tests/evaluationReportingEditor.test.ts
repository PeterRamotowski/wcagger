// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { readonly } from 'vue'
import { mount } from '@vue/test-utils'
import ReportingEditor from '../app/components/Evaluation/ReportingEditor.vue'
import ReviewReport from '../app/components/Evaluation/ReviewReport.vue'
import FindingCard from '../app/components/Report/GroupedFindingCard.vue'
import { buildGroupedReport } from '../shared/utils/reportPresentation'
import { newReportingNotes } from '../shared/utils/reportingNotes'
import { savedFixture } from './fixtures/savedEvaluation'
import { completeReviewFixture, sharedFindingReviewFixture } from './fixtures/evaluationReview'
import en from '../i18n/locales/en.json'

const t = (key: string, params: Record<string, unknown> = {}) => Object.entries(params).reduce((text, [key, value]) => text.replace('{' + key + '}', String(value)), (en as Record<string, string>)[key] ?? key)
describe('reporting editor and indexes', () => {
  it('requires a current captured report and protects unrecorded review edits', async () => {
    const wrapper = mount(ReportingEditor, { props: { 'modelValue': newReportingNotes(), 'report': buildGroupedReport(readonly(savedFixture().report!)), 'ready': false, 'busy': false, 'onUpdate:modelValue': (modelValue) => {
      void wrapper.setProps({ modelValue })
    } }, global: { mocks: { $t: t } } })
    const record = wrapper.findAll('button').find(button => button.text() === 'Record stage review')!
    expect(record.attributes('disabled')).toBeDefined()
    await wrapper.setProps({ ready: true })
    await record.trigger('click')
    expect(wrapper.find('[role=alert]').text()).toContain('requires')
    await wrapper.findAll('label').find(item => item.text() === 'Reviewer')!.find('input').setValue('Evaluator')
    await wrapper.findAll('label').find(item => item.text().startsWith('Stage review notes'))!.find('textarea').setValue('Checked the product scope and recorded remaining work')
    expect(wrapper.find('select').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('pending')!.at(-1)).toEqual([true])
    await record.trigger('click')
    expect(wrapper.props('modelValue').reviews[0]!).toMatchObject({ stage: 'scope', reviewer: 'Evaluator' })
    expect(wrapper.find('select').attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('Needs attention')
    wrapper.unmount()
  })
  it('shows methodology review separately from failures and escapes report conclusions', () => {
    const result = completeReviewFixture()
    result.evidence.evaluation!.reporting!.limitations = '<img src=x onerror=alert(1)>'
    const wrapper = mount(ReviewReport, { props: { report: buildGroupedReport(readonly(result)) }, global: { mocks: { $t: t } } })
    expect(wrapper.text()).toContain('The recorded methodology workflow still needs review')
    expect(wrapper.find('[data-criterion-id="1.1.1"]').text()).toContain('Failed')
    expect(wrapper.find('[data-workflow-stage="scope"]').text()).toContain('Reviewed')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x')
    wrapper.unmount()
  })
  it('keeps distinct occurrence outcomes visible beneath one shared finding', () => {
    const result = sharedFindingReviewFixture()
    const report = buildGroupedReport(readonly(result))
    const finding = report.findings.find(item => item.issueType === 'axe:button-name')!
    const wrapper = mount(FindingCard, { props: { finding, evidence: readonly(result.evidence), selected: false, sampleOutcomes: report.evaluationReview!.criteria }, global: { mocks: { $t: t } } })
    const rows = wrapper.findAll('[data-occurrence-manual-outcome]')
    expect(rows).toHaveLength(2)
    expect(rows.map(row => row.text())).toEqual(expect.arrayContaining([expect.stringContaining('Needs review'), expect.stringContaining('Failed')]))
    expect(wrapper.text()).toContain(finding.id)
    expect(finding.occurrences).toHaveLength(2)
    wrapper.unmount()
  })
})
