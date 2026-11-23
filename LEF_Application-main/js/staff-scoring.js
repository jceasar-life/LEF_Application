// Staff-only TEST scoring. This does not save results or affect loan decisions.
import { matrices } from '../scoring/matrices.js';
import { calculateScore } from '../scoring/scoring.js';

export function showDemoScoring(panel, application) {
  panel.replaceChildren();
  panel.hidden = true;
  const loanType = String(application.loan_type || '').toLowerCase();
  if (!application.is_demo || !Object.hasOwn(matrices, loanType)) return;
  panel.hidden = false;
  const matrix = matrices[loanType];
  const title = document.createElement('h3');
  title.textContent = 'Test scoring calculator (staff only)';
  const note = document.createElement('p');
  note.textContent = 'Use fictional values. This is an experimental calculation only: results are NOT saved, and do not approve or decline a loan. Some LEF bands still need client clarification.';
  const form = document.createElement('form');
  const inputs = matrix.criteria.map(({field, label}) => {
    const wrapper = document.createElement('label');
    wrapper.style.display = 'block';
    wrapper.style.margin = '0.6rem 0';
    const control = field === 'character' ? document.createElement('select') : document.createElement('input');
    if (field === 'character') {
      ['', 'strong', 'medium', 'weak'].forEach(value => control.add(new Option(value || 'Select recommendation', value)));
    } else {
      control.type = 'number';
      control.min = '0';
      control.step = field === 'fico' ? '1' : 'any';
      if (field === 'fico') control.max = '850';
    }
    wrapper.append(document.createTextNode(label + ': '), control);
    form.append(wrapper);
    return [field, control];
  });
  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'action-btn';
  button.textContent = 'Calculate fictional score';
  const result = document.createElement('p');
  result.setAttribute('role', 'status');
  const breakdown = document.createElement('ul');
  form.append(button, result, breakdown);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const values = Object.fromEntries(inputs.map(([key, control]) => [key,
        control.value === '' ? null : key === 'character' ? control.value : control.valueAsNumber]));
      const score = calculateScore({loanType, ...values});
      result.textContent = score.rating
        ? `Test score: ${score.totalPoints}/${score.maximumPoints} (${score.rating}). Not stored.`
        : 'No rating assigned. Some inputs or score ranges need clarification.';
      breakdown.replaceChildren(...score.factors.map(factor => {
        const li = document.createElement('li');
        li.textContent = `${factor.label}: ${factor.points === null ? 'Missing or needs review' : factor.points + '/' + factor.maxPoints}`;
        return li;
      }));
    } catch (error) {
      result.textContent = 'Calculation unavailable: ' + (error.message || 'Invalid test input');
      breakdown.replaceChildren();
    }
  });
  panel.append(title, note, form);
}
