export const useWcagStandards = () => {
  const { t } = useI18n();

  return {
    // WCAG 2.0
    'WCAG20A': {
      name: t('wcag_20_a'),
      description: t('wcag_20_a_description'),
      recommendation: t('wcag_20_a_recommendation')
    },
    'WCAG20AA': {
      name: t('wcag_20_aa'),
      description: t('wcag_20_aa_description'),
      recommendation: t('wcag_20_aa_recommendation')
    },
    'WCAG20AAA': {
      name: t('wcag_20_aaa'),
      description: t('wcag_20_aaa_description'),
      recommendation: t('wcag_20_aaa_recommendation')
    },
    
    // WCAG 2.1
    'WCAG21A': {
      name: t('wcag_21_a'),
      description: t('wcag_21_a_description'),
      recommendation: t('wcag_21_a_recommendation')
    },
    'WCAG21AA': {
      name: t('wcag_21_aa'),
      description: t('wcag_21_aa_description'),
      recommendation: t('wcag_21_aa_recommendation')
    },
    'WCAG21AAA': {
      name: t('wcag_21_aaa'),
      description: t('wcag_21_aaa_description'),
      recommendation: t('wcag_21_aaa_recommendation')
    },
    
    // WCAG 2.2
    'WCAG22A': {
      name: t('wcag_22_a'),
      description: t('wcag_22_a_description'),
      recommendation: t('wcag_22_a_recommendation')
    },
    'WCAG22AA': {
      name: t('wcag_22_aa'),
      description: t('wcag_22_aa_description'),
      recommendation: t('wcag_22_aa_recommendation')
    },
    'WCAG22AAA': {
      name: t('wcag_22_aaa'),
      description: t('wcag_22_aaa_description'),
      recommendation: t('wcag_22_aaa_recommendation')
    }
  };
};
