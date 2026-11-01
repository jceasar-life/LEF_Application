/**
 * LEF rating criteria transcribed from client-provided screenshots (Nov 2026).
 * DO NOT use these configurations for automated lending decisions without
 * validation and approval by LEF. The screenshot does not define A+ or totals <5.
 * Commercial "collateral" wording is ambiguous: confirm the actual numerator.
 */
export const matrices = {
  personal: {
    id: 'consumer-v1-draft',
    label: 'Consumer loan rating',
    version: 'draft-1',
    maxPoints: 31,
    criteria: [
      { field: 'fico', label: 'FICO score', max: 5 },
      { field: 'assetsMonths', label: 'Months of expenses saved', max: 7 },
      { field: 'character', label: 'FOC coach recommendation', max: 8 },
      { field: 'stableIncomeMonths', label: 'Months of stable net income', max: 6 },
      { field: 'debtServiceCoverage', label: 'Personal debt service coverage', max: 5 },
    ],
  },
  business: {
    id: 'commercial-v1-draft',
    label: 'Commercial loan rating',
    version: 'draft-1',
    maxPoints: 31,
    criteria: [
      { field: 'fico', label: 'FICO score', max: 5 },
      { field: 'collateralCoveragePercent', label: 'Collateral coverage (%) — definition pending', max: 6 },
      { field: 'ownerEquityPercent', label: 'Owner equity (%)', max: 5 },
      { field: 'character', label: 'FOC coach / CEI consultant recommendation', max: 5 },
      { field: 'stableCashFlowMonths', label: 'Months of stable cash flow', max: 5 },
      { field: 'debtServiceCoverage', label: 'Business debt service coverage', max: 5 },
    ],
  },
};

// Screenshot summary: A+ has N/A boundaries; scores outside 5–31 unspecified.
export const bands = [
  {rating:'A', min:23, max:31, reserve:'5%', acceptableForApproval:true, monitoring:'Annually'},
  {rating:'B', min:19, max:22, reserve:'10%', acceptableForApproval:true, monitoring:'Semi-annually'},
  {rating:'C', min:15, max:18, reserve:'15%', acceptableForApproval:true, monitoring:'Quarterly'},
  {rating:'D', min:5, max:14, reserve:'16–100%', acceptableForApproval:false, monitoring:'Monthly or more frequently'},
];
