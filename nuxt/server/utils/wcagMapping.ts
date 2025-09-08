type AccessibilityStandard = 'WCAG2A' | 'WCAG2AA' | 'WCAG2AAA';

// Axe-core WCAG mapping
export const getAxeTags = (standard: string): string[] => {
  const tagMap: { [key: string]: string[] } = {
    'WCAG20A': ['wcag2a'],
    'WCAG20AA': ['wcag2a', 'wcag2aa'],
    'WCAG20AAA': ['wcag2a', 'wcag2aa', 'wcag2aaa'],
    
    'WCAG21A': ['wcag2a', 'wcag21a'],
    'WCAG21AA': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    'WCAG21AAA': ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'],
    
    'WCAG22A': ['wcag2a', 'wcag21a', 'wcag22a'],
    'WCAG22AA': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'],
    'WCAG22AAA': ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa', 'wcag22a', 'wcag22aa', 'wcag22aaa']
  }
  
  return tagMap[standard] || ['wcag2a', 'wcag2aa', 'wcag21aa'] // fallback
}

// Pa11y WCAG mapping
export const getPa11yStandard = (standard: string): AccessibilityStandard => {
  const standardMap: { [key: string]: AccessibilityStandard } = {
    'WCAG20A': 'WCAG2A',
    'WCAG20AA': 'WCAG2AA',
    'WCAG20AAA': 'WCAG2AAA',
    
    'WCAG21A': 'WCAG2A',
    'WCAG21AA': 'WCAG2AA',
    'WCAG21AAA': 'WCAG2AAA',
    
    'WCAG22A': 'WCAG2A',
    'WCAG22AA': 'WCAG2AA',
    'WCAG22AAA': 'WCAG2AAA'
  }

  return standardMap[standard] || 'WCAG2AA'
}
