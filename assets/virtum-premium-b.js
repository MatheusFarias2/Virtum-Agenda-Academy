/* Virtum Agenda Premium — Fase B1
 * Aprimoramento progressivo de calendario e planilha.
 * Nao altera o JSON, nao faz requisicoes e nao interfere nas chamadas da API.
 */
(() => {
  'use strict';
  const grid = document.getElementById('calendar-grid');
  const sheet = document.getElementById('sheet-container');
  if (!grid || !sheet) return;
  const STORE = 'virtum-agenda-premium-densidade';
  let density = 'confortavel';
  try { density = localStorage.getItem(STORE) === 'compacta' ? 'compacta' : 'confortavel'; } catch (_) {}

  function enhanceCalendar() {
    for (const day of grid.querySelectorAll('.day[data-day]')) {
      if (day.dataset.vaB === '1') continue;
      day.dataset.vaB = '1';
      const aria = day.getAttribute('aria-label') || '';
      const match = aria.match(/:\s*(\d+)\s+atividades?\b/i);
      const count = match ? Number(match[1]) : 0;
      if (!count) continue;
      const number = document.createElement('span');
      number.className = 'va-day-count';
      number.setAttribute('aria-hidden', 'true');
      number.textContent = String(count);
      day.appendChild(number);
      const more = day.querySelector('.more-chip');
      if (more) more.setAttribute('title', `Abrir todas as ${count} atividades deste dia`);
    }
  }
  function enhanceSheet() {
    const table = sheet.querySelector('.sheet-table');
    if (!table || table.dataset.vaB === '1') return;
    table.dataset.vaB = '1';
    let prevDate = null;
    for (const row of table.tBodies[0]?.rows || []) {
      const dateCell = row.cells[0];
      if (!dateCell) continue;
      const date = dateCell.textContent.trim();
      if (date !== prevDate) {
        row.classList.add('va-day-group-start');
        prevDate = date;
      }
      const text = dateCell.textContent;
      const dateBadge = document.createElement('span');
      dateBadge.className = 'va-sheet-date';
      dateBadge.textContent = text;
      dateCell.replaceChildren(dateBadge);
      if (row.classList.contains('sheet-holiday')) continue;
      const typeCell = row.cells[5];
      if (typeCell) {
        const type = typeCell.textContent.trim();
        const badge = document.createElement('span');
        badge.className = 'va-type-chip';
        if (row.classList.contains('sheet-prova')) badge.classList.add('va-type-prova');
        else if (row.classList.contains('sheet-tcc')) badge.classList.add('va-type-tcc');
        badge.textContent = type;
        typeCell.replaceChildren(badge);
      }
    }
    const intro = sheet.querySelector('.sheet-intro');
    if (!intro) return;
    const controls = document.createElement('div');
    controls.className = 'va-density-control';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Densidade da planilha');
    for (const [value, label] of [['confortavel', 'Confortável'], ['compacta', 'Compacta']]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.vaDensity = value;
      btn.textContent = label;
      controls.appendChild(btn);
    }
    intro.appendChild(controls);
    updateDensity();
  }
  function updateDensity() {
    sheet.classList.toggle('va-sheet-compact', density === 'compacta');
    for (const btn of sheet.querySelectorAll('[data-va-density]')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.vaDensity === density));
    }
  }
  sheet.addEventListener('click', event => {
    const button = event.target.closest('[data-va-density]');
    if (!button) return;
    density = button.dataset.vaDensity === 'compacta' ? 'compacta' : 'confortavel';
    try { localStorage.setItem(STORE, density); } catch (_) {}
    updateDensity();
  });
  new MutationObserver(enhanceCalendar).observe(grid, { childList: true });
  new MutationObserver(enhanceSheet).observe(sheet, { childList: true });
  enhanceCalendar();
  enhanceSheet();
})();
