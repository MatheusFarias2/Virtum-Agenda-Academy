/* Virtum Agenda Premium | Fase C1 — dialogos e cronogramas.
 * Camada progressiva: nao altera app.js, nao consulta API e nao modifica dados.
 */
(() => {
  'use strict';
  const SETTINGS = [
    { id: 'disciplina-dialog', list: 'disciplina-aulas', kind: 'disciplina' },
    { id: 'dia-dialog', list: 'dia-aulas', kind: 'dia' },
  ];
  const strip = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const plural = (amount, one, many) => `${amount} ${amount === 1 ? one : many}`;
  const knownType = card => {
    const description = strip(card.querySelector('.disciplina-aula-desc')?.textContent.trim() || '');
    if (/^prova(?:\b|\s|\u00b7)/.test(description)) return 'prova';
    if (/^tcc(?:\b|\s|\u00b7)/.test(description)) return 'tcc';
    if (/^aula(?:\b|\s|\u00b7)/.test(description)) return 'aula';
    return 'outra';
  };
  const textNode = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  function createEnhancement(options) {
    const dialog = document.getElementById(options.id);
    const list = document.getElementById(options.list);
    if (!dialog || !list || dialog.dataset.vaC === '1') return;
    dialog.dataset.vaC = '1';
    dialog.classList.add('va-premium-dialog');
    const toolbar = dialog.querySelector('.disciplina-toolbar');
    if (!toolbar) return;
    const controls = textNode('section', 'vc-controls');
    controls.setAttribute('aria-label', 'Refinar visualização de atividades');
    const stats = textNode('div', 'vc-overview');
    stats.setAttribute('aria-live', 'polite');
    const controlsRow = textNode('div', 'vc-controls-row');
    const searchLabel = textNode('label', 'vc-field');
    searchLabel.append(textNode('span', 'vc-field-label', 'Buscar na lista'));
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'vc-search';
    search.placeholder = options.kind === 'dia' ? 'Disciplina, tutor ou sala…' : 'Atividade, local ou tutor…';
    search.autocomplete = 'off';
    search.setAttribute('aria-label', 'Buscar atividades na janela');
    searchLabel.append(search);
    controlsRow.append(searchLabel);
    let tutorSelect = null;
    if (options.kind === 'disciplina') {
      const label = textNode('label', 'vc-field vc-tutor-field');
      label.append(textNode('span', 'vc-field-label', 'Tutor'));
      tutorSelect = document.createElement('select');
      tutorSelect.className = 'vc-tutor-select';
      tutorSelect.setAttribute('aria-label', 'Filtrar cronograma por tutor');
      const all = document.createElement('option');
      all.value = '';
      all.textContent = 'Todos os tutores';
      tutorSelect.append(all);
      label.append(tutorSelect);
      controlsRow.append(label);
    }
    const typeRow = textNode('div', 'vc-type-row');
    typeRow.setAttribute('role', 'group');
    typeRow.setAttribute('aria-label', 'Filtrar por tipo de atividade');
    const typeOptions = [ ['todos', 'Todas'], ['aula', 'Aulas'], ['prova', 'Provas'], ['tcc', 'TCCs'] ];
    for (const [value,label] of typeOptions) {
      const button = textNode('button', 'vc-type-button', label);
      button.type = 'button';
      button.dataset.vcType = value;
      button.setAttribute('aria-pressed', String(value === 'todos'));
      typeRow.append(button);
    }
    const results = textNode('div', 'vc-results');
    results.setAttribute('role', 'status');
    results.setAttribute('aria-live', 'polite');
    const reset = textNode('button', 'vc-reset', 'Limpar filtros');
    reset.type = 'button';
    reset.hidden = true;
    results.append(reset);
    controls.append(stats, controlsRow, typeRow, results);
    toolbar.insertAdjacentElement('afterend', controls);
    const empty = textNode('div', 'vc-empty');
    empty.hidden = true;
    empty.append(textNode('strong', '', 'Nenhuma atividade encontrada'), textNode('p', '', 'Altere a busca ou os filtros para ver outros resultados.'));
    list.insertAdjacentElement('afterend', empty);

    let currentType = 'todos';
    let frame = 0;
    let lastCardKey = '';
    let previousOpen = false;
    const cards = () => [...list.querySelectorAll('.disciplina-aula')];
    const getTutor = card => (card.querySelector('.disciplina-tutor')?.textContent || '').trim() || 'Tutor não informado';

    function syncTutorOptions(allCards) {
      if (!tutorSelect) return;
      const tutors = [...new Set(allCards.map(getTutor))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const key = JSON.stringify(tutors);
      if (key === lastCardKey) return;
      const selected = tutorSelect.value;
      tutorSelect.replaceChildren();
      const any = document.createElement('option'); any.value = ''; any.textContent = 'Todos os tutores'; tutorSelect.append(any);
      for (const tutor of tutors) {
        const option = document.createElement('option');
        option.value = tutor;
        option.textContent = tutor;
        tutorSelect.append(option);
      }
      tutorSelect.value = tutors.includes(selected) ? selected : '';
      lastCardKey = key;
    }
    function update() {
      if (!dialog.open) return;
      const allCards = cards();
      syncTutorOptions(allCards);
      const text = strip(search.value.trim());
      const selectedTutor = tutorSelect?.value || '';
      let visible = 0;
      let uniqueTutors = new Set();
      for (const card of allCards) {
        const tutor = getTutor(card);
        uniqueTutors.add(tutor);
        const isVisible = (!text || strip(card.textContent).includes(text)) &&
          (!selectedTutor || tutor === selectedTutor) &&
          (currentType === 'todos' || knownType(card) === currentType);
        card.hidden = !isVisible;
        if (isVisible) visible++;
      }
      stats.replaceChildren();
      const overviewNumber = textNode('span', 'vc-overview-value', String(allCards.length));
      const overviewLabel = textNode('span', 'vc-overview-label', options.kind === 'dia' ? 'atividades do dia' : 'atividades no cronograma');
      const overviewTutors = textNode('span', 'vc-overview-tutors', plural(uniqueTutors.size, 'tutor', 'tutores'));
      stats.append(overviewNumber, overviewLabel, overviewTutors);
      let resultText = results.querySelector('.vc-result-count');
      if (!resultText) { resultText = textNode('span', 'vc-result-count'); results.prepend(resultText); }
      resultText.textContent = `${visible} de ${allCards.length} ${allCards.length === 1 ? 'atividade' : 'atividades'} exibidas`;
      const hasFilters = Boolean(text || selectedTutor || currentType !== 'todos' || (options.kind === 'dia' && document.getElementById('dia-tutor-filtro')?.value));
      reset.hidden = !hasFilters;
      empty.hidden = visible > 0 || allCards.length === 0;
      for (const b of typeRow.querySelectorAll('[data-vc-type]')) {
        b.setAttribute('aria-pressed', String(b.dataset.vcType === currentType));
      }
    }
    function scheduleUpdate() {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; update(); });
    }
    function resetFilters() {
      search.value = '';
      currentType = 'todos';
      if (tutorSelect) tutorSelect.value = '';
      const nativeTutor = options.kind === 'dia' ? document.getElementById('dia-tutor-filtro') : null;
      if (nativeTutor?.value) {
        nativeTutor.value = '';
        nativeTutor.dispatchEvent(new Event('change', { bubbles: true }));
      }
      scheduleUpdate();
    }
    search.addEventListener('input', scheduleUpdate);
    tutorSelect?.addEventListener('change', scheduleUpdate);
    typeRow.addEventListener('click', event => {
      const b = event.target.closest('[data-vc-type]');
      if (!b) return;
      currentType = b.dataset.vcType;
      scheduleUpdate();
    });
    reset.addEventListener('click', resetFilters);
    dialog.addEventListener('close', () => {
      previousOpen = false;
      search.value = '';
      currentType = 'todos';
      if (tutorSelect) tutorSelect.value = '';
      for (const card of cards()) card.hidden = false;
      empty.hidden = true;
    });
    dialog.addEventListener('keydown', event => {
      if (event.key === '/' && !['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) {
        event.preventDefault(); search.focus();
      }
    });
    const listObserver = new MutationObserver(scheduleUpdate);
    listObserver.observe(list, {childList: true});
    const dialogObserver = new MutationObserver(() => {
      if (dialog.open && !previousOpen) {
        previousOpen = true;
        resetFilters();
        scheduleUpdate();
      }
    });
    dialogObserver.observe(dialog, {attributes: true, attributeFilter: ['open']});
  }
  for (const opt of SETTINGS) createEnhancement(opt);
})();
