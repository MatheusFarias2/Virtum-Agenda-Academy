/* VIRTUM AGENDA - SITE ESTATICO PARA PUBLICACAO; SEM ACESSO AO SQLITE */
/* Virtum Agenda: consulta somente a API local de leitura; nunca acessa SQLite diretamente. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const data = { cursos: [], eventos: [], feriados: [], demonstracao: false, atualizado_em: null };
  const params = new URLSearchParams(location.search);
  const today = localISO(new Date());
  const saved = (() => { try { return JSON.parse(localStorage.getItem('virtum-agenda-preferencias') || '{}'); } catch { return {}; } })();
  const state = { ano: Number(today.slice(0,4)), mes: Number(today.slice(5,7))-1, dia: today, curso: params.get('curso') || saved.curso || '', semestre: saved.semestre || '', tipo: saved.tipo || '', busca: '', view: ['lista','semana','calendario','planilha'].includes(saved.view) ? saved.view : 'calendario' };
  const dtfMonth = new Intl.DateTimeFormat('pt-BR', { month:'long', year:'numeric' });
  const dtfFull = new Intl.DateTimeFormat('pt-BR', { weekday:'long', day:'numeric', month:'long' });
  const dtfShort = new Intl.DateTimeFormat('pt-BR', { weekday:'short', day:'2-digit', month:'short' });

  function localISO(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function fromISO(iso) { return new Date(`${iso}T12:00:00`); }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function norm(value) { return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function formatDay(iso) { return `${iso.slice(8,10)}/${iso.slice(5,7)}`; }
  function localLabel(iso) { return dtfFull.format(fromISO(iso)); }
  function timeLabel(e) { return [e.hora_inicio, e.hora_fim].filter(Boolean).join('–'); }
  function typeLabel(tipo) { return ({aula:'Aula',prova:'Prova',tcc:'TCC'})[tipo] || 'Atividade'; }
  function eventName(e) { return e.titulo || e.disciplina || typeLabel(e.tipo); }
  function eventMeta(e) {
    return [timeLabel(e), e.local, e.tutor ? `${e.tipo==='tcc' ? 'Avaliador' : 'Tutor'}: ${e.tutor}` : ''].filter(Boolean).join(' · ');
  }
  function filterItems() {
    return data.eventos.filter(e => {
      const ids = Array.isArray(e.curso_ids) ? e.curso_ids.map(String) : [];
      if (state.curso && !ids.includes(state.curso)) return false;
      if (state.semestre && Array.isArray(e.semestres) && e.semestres.length && !e.semestres.map(String).includes(state.semestre)) return false;
      if (state.tipo && e.tipo !== state.tipo) return false;
      if (state.busca) {
        const txt = norm([eventName(e), e.disciplina, e.tutor, e.local, ...(e.cursos||[]), e.atividade].join(' '));
        if (!txt.includes(norm(state.busca))) return false;
      }
      return true;
    }).sort((a,b) => a.data.localeCompare(b.data) || String(a.hora_inicio||'').localeCompare(String(b.hora_inicio||'')) || eventName(a).localeCompare(eventName(b)));
  }
  function monthItems(items) { const prefix = `${state.ano}-${String(state.mes+1).padStart(2,'0')}-`; return items.filter(e=>e.data.startsWith(prefix)); }
  function savePreferences() { try { localStorage.setItem('virtum-agenda-preferencias', JSON.stringify({curso:state.curso, semestre:state.semestre, tipo:state.tipo, view:state.view})); } catch {} }
  function updateQuery() {
    const url = new URL(location.href);
    if (state.curso) url.searchParams.set('curso', state.curso); else url.searchParams.delete('curso');
    history.replaceState(null,'',url);
    savePreferences();
  }
  function renderFilters() {
    $('curso').innerHTML = `<option value="">Todos os cursos</option>` + data.cursos.map(c=>`<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('');
    $('curso').value = data.cursos.some(c=>String(c.id)===state.curso) ? state.curso : '';
    state.curso = $('curso').value;
    const semesters = new Set(data.eventos.flatMap(e=>Array.isArray(e.semestres) ? e.semestres.map(String):[]));
    $('semestre').innerHTML = `<option value="">Todos os semestres</option>` + [...semesters].sort((a,b)=>Number(a)-Number(b)).map(s=>`<option value="${esc(s)}">${esc(s)}º semestre</option>`).join('');
    if ([...$('semestre').options].some(o=>o.value===state.semestre)) $('semestre').value=state.semestre; else {state.semestre=''; $('semestre').value='';}
    $('tipo').value=state.tipo;
  }
  function renderStats(items, mesItems) {
    const next = items.find(e=>e.data>=today);
    $('proxima').textContent = next ? formatDay(next.data) : '—';
    $('proxima-detalhe').textContent = next ? `${eventName(next)} · ${timeLabel(next) || typeLabel(next.tipo)}` : 'Nenhuma atividade futura cadastrada';
    $('dias-ativos').textContent = String(new Set(mesItems.map(e=>e.data)).size).padStart(2,'0');
    $('total-atividades').textContent = String(mesItems.length).padStart(2,'0');
  }
  function tutorColor(e) { return /^#[0-9a-fA-F]{6}$/.test(e.cor_tutor || '') ? e.cor_tutor : ''; }
  function openDiscipline(id) {
    const chosen=data.eventos.find(e=>String(e.id)===String(id));
    if(!chosen || !chosen.disciplina) return;
    // Identidade composta: disciplina + curso(s) + semestre(s). Evita misturar
    // homônimas de cursos distintos e respeita o filtro de semestre atual.
    const courseIds=(chosen.curso_ids||[]).map(String);
    const list=data.eventos.filter(e=>e.disciplina===chosen.disciplina &&
      (e.curso_ids||[]).some(cid=>courseIds.includes(String(cid))) &&
      (!state.semestre || !(e.semestres||[]).length || e.semestres.map(String).includes(state.semestre))
    ).sort((a,b)=>a.data.localeCompare(b.data)||String(a.hora_inicio||'').localeCompare(String(b.hora_inicio||'')));
    $('disciplina-titulo').textContent=chosen.disciplina;
    $('disciplina-contexto').textContent=[(chosen.cursos||[]).join(', '), (chosen.semestres||[]).length ? 'Semestres '+chosen.semestres.join(' e ') : ''].filter(Boolean).join(' · ');
    $('disciplina-contagem').textContent=`${list.length} atividade${list.length===1?'':'s'} cadastrada${list.length===1?'':'s'}`;
    $('disciplina-aulas').innerHTML=list.map(e=>{
      const cor=tutorColor(e);
      return `<div class="disciplina-aula" ${cor?`style="--tutor-color:${cor}"`:''}>
        <div class="disciplina-aula-top"><strong>${esc(formatDay(e.data))} · ${esc(e.atividade||typeLabel(e.tipo))}</strong><span>${esc(timeLabel(e)||'Horário não informado')}</span></div>
        <div class="disciplina-aula-desc">${esc(typeLabel(e.tipo))}${e.grupo?' · Grupo '+esc(e.grupo):''}${e.local?' · '+esc(e.local):''}</div>
        <div class="disciplina-tutor"><span class="disciplina-cor" ${cor?`style="background:${cor}"`:''}></span>${esc(e.tutor||'Tutor não informado')}</div>
      </div>`;
    }).join('');
    $('disciplina-dialog').showModal();
  }
  // A visualizacao do dia nao restringe por tutor nem pela quantidade de chips.
  function openDaySchedule(iso) {
    const all=filterItems().filter(e=>e.data===iso);
    const tutors=[...new Set(all.map(e=>e.tutor||'Tutor não informado'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const select=$('dia-tutor-filtro');
    select.innerHTML='<option value="">Todos os tutores</option>'+tutors.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
    $('dia-titulo').textContent=localLabel(iso);
    function update() {
      const filtered=all.filter(e=>!select.value||(e.tutor||'Tutor não informado')===select.value);
      $('dia-contagem').textContent=`${filtered.length} de ${all.length} atividade${all.length===1?'':'s'} do dia`;
      $('dia-aulas').innerHTML=filtered.length?filtered.map(e=>{
        const cor=tutorColor(e);
        return `<div class="disciplina-aula" ${cor?`style="--tutor-color:${cor}"`:''}>
          <div class="disciplina-aula-top"><strong>${esc(e.disciplina||eventName(e))} · ${esc(e.atividade||typeLabel(e.tipo))}</strong><span>${esc(timeLabel(e)||'Horário não informado')}</span></div>
          <div class="disciplina-aula-desc">${esc(typeLabel(e.tipo))}${(e.cursos||[]).length?' · '+esc(e.cursos.join(', ')):''}${e.grupo?' · Grupo '+esc(e.grupo):''}${e.local?' · '+esc(e.local):''}</div>
          <div class="disciplina-tutor"><span class="disciplina-cor" ${cor?`style="background:${cor}"`:''}></span>${esc(e.tutor||'Tutor não informado')}</div>
        </div>`;
      }).join(''):'<p class="muted">Nenhuma atividade para este filtro.</p>';
    }
    select.onchange=update;
    update();
    $('dia-dialog').showModal();
  }
  function disciplineAttr(e) { return e.disciplina ? ` data-disciplina-id="${esc(e.id)}" tabindex="0" role="button" aria-label="Abrir cronograma de ${esc(e.disciplina)}" title="Clique para abrir o cronograma da disciplina"` : ''; }
  function itemMarkup(e, options={}) {
    const courses = state.curso ? '' : (e.cursos||[]).slice(0,3).join(', ') + ((e.cursos||[]).length>3?' e outros':'');
    const icon = e.tipo==='aula' ? '▤' : e.tipo==='prova'?'✎':'◇';
    const sub = [options.date ? dtfShort.format(fromISO(e.data)) : '', courses, eventMeta(e)].filter(Boolean).join(' · ');
    return `<div class="item"${disciplineAttr(e)}><span class="item-icon ${esc(e.tipo)}">${icon}</span><div class="item-body"><div class="item-title">${esc(eventName(e))}</div><div class="item-meta">${esc(sub)}</div>${e.atividade && e.tipo==='aula'?`<span class="item-tag">${esc(e.atividade)}</span>`:''}${e.semestres?.length?` <span class="item-tag">${esc(e.semestres.join(' e '))}º semestre</span>`:''}${e.grupo?` <span class="item-tag">Grupo ${esc(e.grupo)}</span>`:''}</div><button class="item-action" type="button" data-ics="${esc(e.id)}" title="Adicionar ao calendário pessoal" aria-label="Baixar evento para calendário">↧</button></div>`;
  }
  function renderCalendar(items) {
    const y=state.ano, m=state.mes;
    const first = new Date(y,m,1), days = new Date(y,m+1,0).getDate();
    const weekdayOffset = (first.getDay()+6)%7; // segunda primeiro
    const cellsCount = Math.ceil((weekdayOffset+days)/7)*7;
    const byDay = new Map();
    const month = `${y}-${String(m+1).padStart(2,'0')}`;
    items.forEach(e=>{if(!byDay.has(e.data)) byDay.set(e.data, []); byDay.get(e.data).push(e);});
    const holidayByDay = new Map(data.feriados.map(h=>[h.data,h.nome]));
    const html=[];
    for(let i=0;i<cellsCount;i++){
      const date = new Date(y,m,1-weekdayOffset+i);
      const iso=localISO(date);
      const outside = date.getMonth()!==m;
      const events = byDay.get(iso)||[];
      const holiday = holidayByDay.get(iso);
      const chips=[];
      if(holiday) chips.push(`<span class="event-chip feriado" title="${esc(holiday)}">${esc(holiday)}</span>`);
      events.forEach(e=>chips.push(`<span class="event-chip ${esc(e.tipo)}"${disciplineAttr(e).replace(' tabindex="0" role="button"','')} title="${esc(eventName(e))}">${esc(e.tipo==='aula' && e.atividade?`${e.atividade} · ${eventName(e)}`:eventName(e))}</span>`));
      const max=2, shown=chips.slice(0,max).join(''), more=chips.length>max?`<span class="more-chip" title="Ver todas as atividades do dia">+${chips.length-max} atividade${chips.length-max>1?'s':''}</span>`:'';
      html.push(`<button class="day${outside?' outside':''}${iso===today?' today':''}${iso===state.dia?' selected':''}" type="button" data-day="${iso}" role="gridcell" aria-label="${esc(localLabel(iso))}: ${events.length} atividades"><span class="day-num">${date.getDate()}</span><span class="day-entries">${shown}${more}</span></button>`);
    }
    $('calendar-grid').innerHTML=html.join('');
    if(state.view!=='semana') $('month-info').textContent=`${new Set(items.filter(e=>e.data.startsWith(month)).map(e=>e.data)).size} dia(s) com atividades neste mês`;
  }
  function weekStart(iso) {
    const d=fromISO(iso); d.setDate(d.getDate()-(d.getDay()+6)%7); return d;
  }
  function renderWeek(items) {
    const start=weekStart(state.dia);
    const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return localISO(d);});
    const holidayByDay=new Map(data.feriados.map(h=>[h.data,h.nome]));
    $('week-container').innerHTML=days.map(iso=>{
      const events=items.filter(e=>e.data===iso);
      const holiday=holidayByDay.get(iso);
      return `<section class="week-day${iso===today?' is-today':''}"><button type="button" class="week-day-head" data-week-day="${iso}" aria-label="Ver detalhes de ${esc(localLabel(iso))}"><span>${esc(dtfShort.format(fromISO(iso)))}</span><strong>${events.length} atividade${events.length===1?'':'s'}</strong></button>${holiday?`<p class="week-holiday">✳ ${esc(holiday)}</p>`:''}${events.length?events.map(e=>itemMarkup(e)).join(''):'<p class="week-empty">Sem atividades</p>'}</section>`;
    }).join('');
    $('month-info').textContent=`Semana de ${formatDay(days[0])} a ${formatDay(days[6])}`;
  }
  function renderList(items) {
    const month = monthItems(items);
    if(!month.length){$('list-container').innerHTML='<div class="empty">Nenhuma atividade encontrada neste mês.<strong>Experimente outro mês ou ajuste os filtros.</strong></div>';return;}
    let last='';
    $('list-container').innerHTML=month.map(e=>{const heading=e.data!==last?`<div class="list-date">${esc(localLabel(e.data))}</div>`:'';last=e.data;return heading+itemMarkup(e);}).join('');
  }
  function renderSheet(items) {
    const month = monthItems(items);
    const holidays = data.feriados.filter(h=>h.data.startsWith(`${state.ano}-${String(state.mes+1).padStart(2,'0')}-`));
    const rows = month.map(e=>({date:e.data, kind:e.tipo, e})).concat(
      !state.tipo && !state.busca ? holidays.map(h=>({date:h.data,kind:'feriado',h})) : []
    ).sort((a,b)=>a.date.localeCompare(b.date) || String(a.e?.hora_inicio||'').localeCompare(String(b.e?.hora_inicio||'')));
    if (!rows.length) {
      $('sheet-container').innerHTML='<div class="empty">Nenhuma atividade encontrada neste mês.<strong>Experimente outro mês ou ajuste os filtros.</strong></div>';
      return;
    }
    const th = ['Data','Horário','Curso','Disciplina / evento','Semestre','Tipo','Atividade','Tutor / avaliador','Sala / local','Ações'];
    const body = rows.map(row=>{
      if(row.h) return `<tr class="sheet-holiday"><td>${esc(formatDay(row.date))}</td><td>—</td><td colspan="7">✳ Feriado: ${esc(row.h.nome)}</td><td>—</td></tr>`;
      const e=row.e;
      const semester=(e.semestres||[]).length ? e.semestres.join(' e ')+'º' : '—';
      const course=state.curso ? (data.cursos.find(c=>String(c.id)===state.curso)?.nome || (e.cursos||[]).join(', ')) : (e.cursos||[]).join(', ');
      const cells=[formatDay(e.data),timeLabel(e)||'—',course||'—',eventName(e),semester,typeLabel(e.tipo),e.atividade||e.grupo||'—',e.tutor||'—',e.local||'—'];
      return `<tr class="sheet-${esc(e.tipo)}"${disciplineAttr(e)}>${cells.map((v,i)=>`<td${i===3?' class="sheet-main"':''} title="${esc(v)}">${esc(v)}</td>`).join('')}<td><button class="sheet-ics" type="button" data-ics="${esc(e.id)}" aria-label="Baixar evento ${esc(eventName(e))} para calendário">↧ .ics</button></td></tr>`;
    }).join('');
    $('sheet-container').innerHTML=`<div class="sheet-intro"><strong>Visão em planilha</strong><span>${month.length} atividade${month.length===1?'':'s'} no mês · Role horizontalmente para ver todas as colunas</span></div><div class="sheet-scroll" tabindex="0" role="region" aria-label="Tabela de atividades, com rolagem horizontal"><table class="sheet-table"><thead><tr>${th.map(t=>`<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function renderDay(items) {
    $('selected-title').textContent=localLabel(state.dia);
    const dayItems=items.filter(e=>e.data===state.dia);
    const holiday=data.feriados.find(h=>h.data===state.dia);
    $('day-details').innerHTML=(holiday?`<div class="item"><span class="item-icon" style="color:#f3d596;background:#493d25">✳</span><div class="item-body"><div class="item-title">${esc(holiday.nome)}</div><div class="item-meta">Feriado cadastrado no Virtum Academy</div></div></div>`:'') + (dayItems.length?dayItems.map(e=>itemMarkup(e)).join('') : '<p class="muted">Nenhuma atividade encontrada para esta data.</p>');
  }
  function renderUpcoming(items) {
    const next=items.filter(e=>e.data>=today).slice(0,6);
    $('upcoming').innerHTML = next.length ? next.map(e=>itemMarkup(e,{date:true})).join('') : '<p class="muted">Nenhuma atividade futura nos dados publicados.</p>';
  }
  function render() {
    const items=filterItems(), currentMonth=monthItems(items);
    $('mes-titulo').textContent=state.view==='semana' ? `Semana de ${formatDay(localISO(weekStart(state.dia)))}` : dtfMonth.format(new Date(state.ano,state.mes,1));
    $('calendar-container').hidden=state.view!=='calendario';
    $('list-container').hidden=state.view!=='lista';
    $('week-container').hidden=state.view!=='semana';
    $('sheet-container').hidden=state.view!=='planilha';
    document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.view);b.setAttribute('aria-pressed',String(b.dataset.view===state.view));});
    renderStats(items,currentMonth);
    renderCalendar(items);
    renderList(items);
    if(state.view==='planilha') renderSheet(items);
    if(state.view==='semana') renderWeek(items);
    renderDay(items);
    renderUpcoming(items);
    savePreferences();
  }
  function monthShift(delta){if(state.view==='semana'){const d=fromISO(state.dia);d.setDate(d.getDate()+delta*7);state.dia=localISO(d);state.ano=d.getFullYear();state.mes=d.getMonth();}else{const d=new Date(state.ano,state.mes+delta,1);state.ano=d.getFullYear();state.mes=d.getMonth();state.dia=localISO(d);}render();}
  function downloadICS(id){
    const event = data.eventos.find(e=>String(e.id)===String(id));
    if(!event) return;
    function compact(dt){return dt.replace(/[-:]/g,'');}
    function escapeICS(s){return String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
    const start=event.data.replace(/-/g,'')+'T'+compact(event.hora_inicio||'19:00').padEnd(4,'0')+'00';
    const end=event.data.replace(/-/g,'')+'T'+compact(event.hora_fim||'22:00').padEnd(4,'0')+'00';
    const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Virtum Systems//Virtum Agenda//PT-BR','BEGIN:VEVENT',`UID:${encodeURIComponent(event.id)}@virtum-agenda`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${escapeICS(eventName(event))}`,`DESCRIPTION:${escapeICS([typeLabel(event.tipo),event.atividade,(event.cursos||[]).join(', '),event.tutor].filter(Boolean).join(' | '))}`,`LOCATION:${escapeICS(event.local)}`,'END:VEVENT','END:VCALENDAR'].join('\r\n')+'\r\n';
    const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`virtum-${event.data}-${event.id}.ics`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function bind() {
    $('curso').addEventListener('change',e=>{state.curso=e.target.value;updateQuery();render();});
    $('semestre').addEventListener('change',e=>{state.semestre=e.target.value;render();});
    $('tipo').addEventListener('change',e=>{state.tipo=e.target.value;render();});
    $('busca').addEventListener('input',e=>{state.busca=e.target.value;render();});
    $('atualizar-agora').addEventListener('click',()=>refreshAgenda());
    $('limpar').addEventListener('click',()=>{state.curso='';state.semestre='';state.tipo='';state.busca='';['curso','semestre','tipo','busca'].forEach(id=>$(id).value='');updateQuery();render();});
    $('prev-month').addEventListener('click',()=>monthShift(-1));
    $('next-month').addEventListener('click',()=>monthShift(1));
    $('voltar-hoje').addEventListener('click',()=>{const now=new Date();state.ano=now.getFullYear();state.mes=now.getMonth();state.dia=localISO(now);render();});
    document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;render();}));
    document.addEventListener('keydown', e=>{ if(e.key==='Escape' && document.activeElement===$('busca')) $('busca').blur(); });
    $('week-container').addEventListener('click',e=>{const el=e.target.closest('[data-week-day]');if(!el)return;state.dia=el.dataset.weekDay;render();$('selected-title').scrollIntoView({behavior:'smooth',block:'center'});});
    // Um clique no nome da disciplina abre o cronograma em todas as visualizacoes.
    // A delegacao funciona tambem apos a atualizacao automatica dos dados.
    document.body.addEventListener('click',e=>{
      if(e.target.closest('[data-ics]')) return;
      const discipline=e.target.closest('[data-disciplina-id]');
      if(discipline){
        e.preventDefault();
        e.stopPropagation();
        openDiscipline(discipline.dataset.disciplinaId);
        return;
      }
      const day=e.target.closest('#calendar-grid [data-day]');
      if(day){
        state.dia=day.dataset.day;
        const d=fromISO(state.dia);
        state.ano=d.getFullYear();state.mes=d.getMonth();render();openDaySchedule(state.dia);
      }
    });
    document.body.addEventListener('keydown',e=>{
      const el=e.target.closest('[data-disciplina-id]');
      if(el && (e.key==='Enter'||e.key===' ')){
        e.preventDefault();openDiscipline(el.dataset.disciplinaId);
      }
    });
    document.body.addEventListener('click',e=>{
      const button=e.target.closest('[data-ics]');
      if(button){e.stopPropagation();downloadICS(button.dataset.ics);}
    });
    $('dia-fechar').addEventListener('click',()=>$('dia-dialog').close());
    $('dia-dialog').addEventListener('click',e=>{if(e.target===$('dia-dialog'))$('dia-dialog').close();});
    $('disciplina-fechar').addEventListener('click',()=>$('disciplina-dialog').close());
    $('disciplina-dialog').addEventListener('click',e=>{if(e.target===$('disciplina-dialog'))$('disciplina-dialog').close();});
  }
  async function load(){
    bind();
    try{
      const res=await fetch('/agenda.json',{cache:'no-store'});
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const payload=await res.json();
      if(!Array.isArray(payload.eventos)||!Array.isArray(payload.cursos))throw new Error('Formato da agenda inválido.');
      Object.assign(data, payload);
      data.feriados=Array.isArray(payload.feriados)?payload.feriados:[];
      data.eventos=data.eventos.filter(e=>typeof e.data==='string' && /^\d{4}-\d{2}-\d{2}$/.test(e.data));
      if(data.eventos.length){
        const nowMonth=today.slice(0,7);
        const hasThisMonth=data.eventos.some(e=>e.data.startsWith(nowMonth));
        const firstFuture=data.eventos.find(e=>e.data>=today);
        const chosen=hasThisMonth?today:(firstFuture?.data||data.eventos[0].data);
        state.ano=Number(chosen.slice(0,4));state.mes=Number(chosen.slice(5,7))-1;state.dia=chosen;
      }
      $('demo-banner').hidden=!data.demonstracao;
      $('atualizacao').textContent=data.demonstracao?'Demonstração · Dados fictícios':data.atualizado_em?`Atualizado em ${new Date(data.atualizado_em).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}`:'Agenda publicada';
      renderFilters();render();updateQuery();
    }catch(error){
      $('error-banner').hidden=false;
      $('error-banner').textContent='Não foi possível carregar a agenda publicada. Tente atualizar a página. Detalhes: '+error.message;
      $('atualizacao').textContent='Agenda indisponível';
      render();
    }
  }
  load();
  // Atualização sob demanda e periódica, sem apagar filtros ou o mês em exibição.
  let refreshing=false;
  async function refreshAgenda(){
    if(refreshing)return;
    refreshing=true;
    const btn=$('atualizar-agora'); btn.disabled=true; btn.classList.add('refreshing');
    try {
      const res=await fetch('/agenda.json',{cache:'no-store'});
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const payload=await res.json();
      if(!Array.isArray(payload.eventos)||!Array.isArray(payload.cursos))throw new Error('Resposta inválida');
      Object.assign(data,payload);
      data.feriados=Array.isArray(payload.feriados)?payload.feriados:[];
      data.eventos=data.eventos.filter(e=>typeof e.data==='string' && /^\d{4}-\d{2}-\d{2}$/.test(e.data));
      $('error-banner').hidden=true;
      $('offline-banner').hidden=true;
      $('atualizacao').textContent=data.atualizado_em?`Atualizado em ${new Date(data.atualizado_em).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}`:'Agenda atualizada';
      renderFilters();render();
    } catch(err) {
      if(data.eventos.length){$('offline-banner').hidden=false;$('error-banner').hidden=true;}
      else {$('error-banner').hidden=false;$('error-banner').textContent='Não foi possível carregar a agenda: '+err.message;}
      $('atualizacao').textContent='Falha na atualização';
    } finally {refreshing=false;btn.disabled=false;btn.classList.remove('refreshing');}
  }
  setInterval(refreshAgenda,60000);
})();
