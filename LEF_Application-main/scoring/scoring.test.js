import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore } from './scoring.js';

test('fictional personal application scores 31 and A', () => {
  const out = calculateScore({loanType:'personal',fico:740,assetsMonths:4,character:'strong',stableIncomeMonths:6,debtServiceCoverage:2.2});
  assert.equal(out.totalPoints,31);
  assert.equal(out.rating,'A');
  assert.equal(out.status,'preliminary-rated');
});
test('fictional personal application falls in D band', () => {
  const out = calculateScore({loanType:'personal',fico:510,assetsMonths:0,character:'weak',stableIncomeMonths:0,debtServiceCoverage:1.1});
  assert.equal(out.totalPoints,6);
  assert.equal(out.rating,'D');
  assert.equal(out.ratingTableAcceptable,false);
});
test('fictional commercial application scores 31 and A', () => {
  const out = calculateScore({loanType:'business',fico:710,collateralCoveragePercent:115,ownerEquityPercent:22,character:'strong',stableCashFlowMonths:25,debtServiceCoverage:2.4});
  assert.equal(out.totalPoints,31);
  assert.equal(out.rating,'A');
});
test('missing input cannot receive rating', () => {
  const out = calculateScore({loanType:'personal',fico:710});
  assert.equal(out.totalPoints,null);
  assert.equal(out.rating,null);
  assert.ok(out.unresolved.includes('character'));
});
test('undocumented equity threshold refuses to invent points', () => {
  const out = calculateScore({loanType:'business',fico:710,collateralCoveragePercent:110,ownerEquityPercent:1,character:'strong',stableCashFlowMonths:25,debtServiceCoverage:2.4});
  assert.equal(out.status,'needs-review');
  assert.equal(out.rating,null);
});
test('rejects unsupported loan type', () => {
  assert.throws(()=>calculateScore({loanType:'mortgage'}),/Unsupported loanType/);
});
