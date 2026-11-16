/* VIRTUM AGENDA PREMIUM | FASE D1 — polimento progressivo.
 * Nao acessa o banco, nao busca dados, nao modifica o JSON ou o app.js.
 */
(() => {
  'use strict';
  const root = document.querySelector('.app-shell');
  if (!root || root.dataset.vaD === '1') return;
  root.dataset.vaD = '1';
  const sidebar = root.querySelector('.sidebar');
  const main = root.querySelector('main.main');
  if (!sidebar || !main) return;

  // Permite ir diretamente ao conteudo com Tab/Enter.
  main.id = main.id || 'conteudo-principal';
  main.setAttribute('tabindex', '-1');
  const skip = document.createElement('a');
  skip.className = 'va-skip-link';
  skip.href = '#' + main.id;
  skip.textContent = 'Ir para o calendário';
  root.parentNode.insertBefore(skip, root);
  skip.addEventListener('click', () => {
    // A ancora continua funcionando mesmo caso o foco programatico falhe.
    main.focus({preventScroll: true});
  });

  // Filtros recolhiveis somente em telas menores. O valor de cada campo e mantido.
  const brand = sidebar.querySelector('.brand');
  const filters = ['curso', 'semestre', 'tipo', 'busca'].map(id => document.getElementById(id));
  if (brand && filters.every(Boolean)) {
    const toggle = document.createElement('button');
    toggle.className = 'va-mobile-filter-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-controls', 'curso semestre tipo busca');
    const title = document.createElement('span');
    title.textContent = 'Filtros da agenda';
    const indicator = document.createElement('span');
    indicator.className = 'va-filter-count';
    indicator.hidden = true;
    const chevron = document.createElement('span');
    chevron.className = 'va-filter-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '⌄';
    toggle.append(title, indicator, chevron);
    brand.insertAdjacentElement('afterend', toggle);
    let open = false;
    const setOpen = (value) => {
      open = Boolean(value);
      sidebar.dataset.vaFilters = open ? 'open' : 'closed';
      toggle.setAttribute('aria-expanded', String(open));
    };
    const countActive = () => {
      const amount = filters.filter(field => field.value.trim().length > 0).length;
      indicator.hidden = amount === 0;
      indicator.textContent = String(amount);
      toggle.setAttribute('aria-label', `Filtros da agenda, ${amount} ${amount === 1 ? 'ativo' : 'ativos'}. ${open ? 'Recolher' : 'Expandir'} filtros`);
    };
    toggle.addEventListener('click', () => { setOpen(!open); countActive(); });
    sidebar.addEventListener('input', countActive);
    sidebar.addEventListener('change', countActive);
    // O app.js preenche curso/semestre de forma assincrona: observar as opcoes.
    for (const field of filters.slice(0, 3)) {
      new MutationObserver(countActive).observe(field, {childList: true});
    }
    const clear = document.getElementById('limpar');
    clear?.addEventListener('click', () => requestAnimationFrame(countActive));
    setOpen(false);
    countActive();
  }

  // O status existente pode indicar falha de atualizacao; nunca se diz 'ao vivo'
  // so porque a pagina esta aberta.
  const status = document.getElementById('atualizacao');
  if (status) {
    const updateStatus = () => {
      const value = status.textContent || '';
      status.classList.toggle('va-status-warning', /falha|indispon[ií]vel|sem conex[aã]o/i.test(value));
    };
    new MutationObserver(updateStatus).observe(status, {childList: true, characterData: true, subtree: true});
    updateStatus();
  }
  // Sinaliza o agrupamento da troca de visualizacao aos leitores de tela.
  const views = document.querySelector('.view-switch');
  if (views) {
    views.setAttribute('role', 'group');
    views.setAttribute('aria-label', 'Modo de visualização da agenda');
  }
})();
