// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GroupedAccessibility from '../app/components/Report/GroupedAccessibility.vue'
import GroupedFindingCard from '../app/components/Report/GroupedFindingCard.vue'
import { reviewGrouping } from '../server/services/groupingReviewService'
import type { FindingGroupingDecision } from '../shared/types/scanEvidence'
import en from '../i18n/locales/en.json'
import { reportFixture } from './fixtures/groupedReport'

import { buildGroupedReport } from '../shared/utils/reportPresentation'

function render(split = false) {
  const scan = reportFixture(split)
  const wrapper = mount(GroupedAccessibility, {
    props: { results: scan, busy: false },
    global: {
      components: { ReportGroupedFindingCard: GroupedFindingCard },
      mocks: { $t: (key: string, params: Record<string, string | number> = {}) => Object.entries(params).reduce((text, [name, value]) => text.replace('{' + name + '}', String(value)), (en as Record<string, string>)[key] ?? key) },
    },
  })
  return { wrapper, scan }
}

describe('grouped report interface', () => {
  it('shows one card per problem while retaining source paths and evidence', async () => {
    const { wrapper } = render()
    expect(wrapper.findAll('article')).toHaveLength(3)
    const button = wrapper.findAll('article').find(item => item.text().includes('axe:button-name'))!
    expect(button.text()).toContain('Pa11y / Axe')
    expect(button.text()).toContain('Known engines: 1')
    expect(button.findAll('section')).toHaveLength(1)
    expect(button.text()).toContain('Original tool evidence')
    wrapper.unmount()
  })

  it('filters by outcome, source, criterion and issue type, and switches element/page views', async () => {
    const { wrapper } = render()
    const controls = wrapper.findAll('select')
    await controls[1]!.setValue('incomplete')
    expect(wrapper.findAll('article')).toHaveLength(1)
    await controls[1]!.setValue('')
    await controls[2]!.setValue('Pa11y / HTMLCS')
    await controls[3]!.setValue('1.1.1')
    expect(wrapper.findAll('article')).toHaveLength(1)
    await controls[2]!.setValue('')
    await controls[3]!.setValue('')
    await controls[4]!.setValue('axe:button-name')
    expect(wrapper.findAll('article')).toHaveLength(1)
    await controls[4]!.setValue('')
    await controls[0]!.setValue('elements')
    expect(wrapper.findAll('article')).toHaveLength(3)
    await controls[0]!.setValue('pages')
    expect(wrapper.findAll('article')).toHaveLength(3)
    expect(wrapper.text()).toContain('Exports include all findings')
    wrapper.unmount()
  })

  it('requires an audited decision and updates the view after a confirmed merge', async () => {
    const { wrapper, scan } = render(true)
    const buttons = wrapper.findAll('article').filter(item => item.text().includes('axe:button-name'))
    expect(buttons).toHaveLength(2)
    for (const item of buttons) await item.find('input[type="checkbox"]').setValue(true)
    const combine = wrapper.findAll('button').find(item => item.text() === 'Combine selected findings')!
    expect(combine.attributes('disabled')).toBeDefined()
    await wrapper.find('input[type="text"]').setValue('Evaluator')
    await wrapper.find('textarea').setValue('Shared component confirmed')
    expect(combine.attributes('disabled')).toBeUndefined()
    await combine.trigger('click')
    const decision = wrapper.emitted('decision')![0]![0] as FindingGroupingDecision
    expect(decision).toMatchObject({ reviewer: 'Evaluator', reason: 'Shared component confirmed', action: 'combine' })
    expect(decision.occurrenceIds).toHaveLength(2)
    const grouping = reviewGrouping({ evidence: scan.evidence, decision })
    await wrapper.setProps({ results: { ...scan, evidence: { ...scan.evidence, grouping } } })
    expect(wrapper.findAll('article').filter(item => item.text().includes('axe:button-name'))).toHaveLength(1)
    expect(wrapper.text()).toContain('Grouping decision history')
    expect(wrapper.find('textarea').element.value).toBe('')
    wrapper.unmount()
  })

  it('renders scanned markup as text and never creates executable help links', () => {
    const { wrapper, scan } = render()
    wrapper.unmount()
    for (const item of scan.evidence.observations) {
      item.helpUrl = 'javascript:alert(1)'
      if (item.element) item.element.html = '<script>alert(1)</script>'
    }
    const card = mount(GroupedFindingCard, { props: { finding: buildFinding(scan), evidence: scan.evidence, selected: false }, global: { mocks: { $t: (key: string) => key } } })
    expect(card.find('script').exists()).toBe(false)
    expect(card.findAll('a').every(link => !link.attributes('href')?.startsWith('javascript:'))).toBe(true)
    card.unmount()
  })
})
function buildFinding(scan: ReturnType<typeof reportFixture>) {
  return buildGroupedReport(scan).findings[0]!
}
