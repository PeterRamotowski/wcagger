export const wcagStandards: Record<string, WcagStandard> = {
  // WCAG 2.0
  'WCAG20A': {
    name: 'WCAG 2.0 Level A',
    description: 'Podstawowy poziom dostępności. Opublikowany w 2008 roku.',
    recommendation: 'Przestarzały - zalecane przejście na nowszą wersję.'
  },
  'WCAG20AA': {
    name: 'WCAG 2.0 Level AA',
    description: 'Standardowy poziom dostępności wymagany przez większość przepisów prawnych.',
    recommendation: 'Przestarzały - zalecane przejście na WCAG 2.1 AA lub 2.2 AA.'
  },
  'WCAG20AAA': {
    name: 'WCAG 2.0 Level AAA',
    description: 'Najwyższy poziom dostępności w WCAG 2.0.',
    recommendation: 'Przestarzały - trudny do pełnego wdrożenia.'
  },
  
  // WCAG 2.1
  'WCAG21A': {
    name: 'WCAG 2.1 Level A',
    description: 'Podstawowy poziom z dodatkowymi kryteriami dla urządzeń mobilnych i poznawczych.',
    recommendation: 'Dobry punkt startowy, ale zalecany poziom AA.'
  },
  'WCAG21AA': {
    name: 'WCAG 2.1 Level AA',
    description: 'Zalecany standard dla większości stron. Dodaje 17 nowych kryteriów do WCAG 2.0.',
    recommendation: 'Optymalny wybór dla większości projektów - szeroko akceptowany prawnie.'
  },
  'WCAG21AAA': {
    name: 'WCAG 2.1 Level AAA',
    description: 'Najwyższy poziom dostępności w WCAG 2.1.',
    recommendation: 'Doskonały dla krytycznych usług, ale może być trudny do pełnego wdrożenia.'
  },
  
  // WCAG 2.2
  'WCAG22A': {
    name: 'WCAG 2.2 Level A',
    description: 'Najnowszy podstawowy poziom z dodatkowymi kryteriami poznawczymi.',
    recommendation: 'Nowy standard - dobry punkt startowy.'
  },
  'WCAG22AA': {
    name: 'WCAG 2.2 Level AA',
    description: 'Najnowszy standard AA z 9 nowymi kryteriami sukcesu opublikowany w październiku 2023.',
    recommendation: 'Najnowszy i najlepszy wybór - przyszłościowy standard prawny.'
  },
  'WCAG22AAA': {
    name: 'WCAG 2.2 Level AAA',
    description: 'Najwyższy aktualny poziom dostępności z najnowszymi wymaganiami.',
    recommendation: 'Idealny dla organizacji stawiających na najwyższą dostępność.'
  }
};
