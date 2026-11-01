import { matrices, bands } from './matrices.js';

const numeric = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isOneOf = (v, values) => values.includes(v);

function scoreField(type, field, value) {
  if (field === 'fico') {
    if (!Number.isInteger(value) || value < 0 || value > 850) return null;
    return value >= 700 ? 5 : value >= 650 ? 4 : value >= 600 ? 3 : value >= 500 ? 2 : 1;
  }
  if (field === 'character') {
    if (!isOneOf(value, ['strong','medium','weak'])) return null;
    return (type === 'personal' ? {strong:8,medium:4,weak:1} : {strong:5,medium:3,weak:1})[value];
  }
  if (!numeric(value)) return null;
  if (field === 'assetsMonths') return value >= 3 ? 7 : value >= 2 ? 5 : value >= 1 ? 3 : 1;
  if (field === 'stableIncomeMonths') return value >= 3 ? 6 : value >= 2 ? 4 : value >= 1 ? 2 : 1;
  if (field === 'debtServiceCoverage') return value >= 2 ? 5 : value >= 1.5 ? 3 : 1;
  if (field === 'stableCashFlowMonths') return value >= 24 ? 5 : value >= 12 ? 3 : 1;
  if (field === 'ownerEquityPercent') {
    // Source specifies 20%+, 5–19.9%, 1.5–4.9%; <1.5% unspecified.
    return value >= 20 ? 5 : value >= 5 ? 3 : value >= 1.5 ? 1 : null;
  }
  if (field === 'collateralCoveragePercent') {
    // Require normalized *collateral coverage* percentage entered by authorized staff.
    // Do not derive it from 'loan-to-collateral value': screenshot label conflicts
    // with increasing points for increasing percentages.
    // Screenshot leaves narrow gaps (e.g., 89.95%, 109.95%); flag gaps.
    return value >= 110 ? 6 : value >= 100 && value <= 109.5 ? 4
      : value >= 90 && value <= 99.99 ? 2 : value <= 89.9 ? 0 : null;
  }
  return null;
}

/** Pure, side-effect-free preliminary assessment. Never call from public UI with secret criteria. */
export function calculateScore(application) {
  if (!application || typeof application !== 'object') throw new TypeError('Application must be an object');
  const matrix = matrices[application.loanType];
  if (!matrix) throw new Error('Unsupported loanType; expected personal or business');
  const factors = matrix.criteria.map(({field,label,max}) => {
    const value = application[field];
    const points = scoreField(application.loanType, field, value);
    return {field,label,value: value ?? null,points,maxPoints:max,status:points === null ? 'needs-review' : 'scored'};
  });
  const unresolved = factors.filter(f=>f.points===null).map(f=>f.field);
  // Financial decisions are not allowed based on incomplete or unspecified fields.
  const complete = unresolved.length === 0;
  const totalPoints = complete ? factors.reduce((sum,f)=>sum+f.points,0) : null;
  const band = complete ? bands.find(b=>totalPoints>=b.min && totalPoints<=b.max) : null;
  return {
    matrixId:matrix.id,version:matrix.version,loanType:application.loanType,
    status:complete && band ? 'preliminary-rated' : 'needs-review',
    totalPoints,maximumPoints:matrix.maxPoints,rating:band?.rating ?? null,
    reserveGuidance:band?.reserve ?? null,monitoringGuidance:band?.monitoring ?? null,
    // A rating or 'acceptable' column is NOT an actual loan approval.
    ratingTableAcceptable: band?.acceptableForApproval ?? null,
    factors,unresolved,
    warnings:[
      'Draft scoring rules transcribed from screenshots; LEF approval required.',
      ...(application.loanType==='business' ? ['Confirm collateral ratio definition and screenshot range gaps before production.'] : []),
      ...(!complete ? ['Missing or ambiguous scoring inputs; no rating assigned.'] : []),
      ...(complete && !band ? ['Score is outside defined 5–31 rating bands; no rating assigned.'] : []),
      'A+ rating is undefined in the source table; no automatic A+ assigned.',
      'Human review is required; this is not an approval or denial.',
    ],
  };
}
