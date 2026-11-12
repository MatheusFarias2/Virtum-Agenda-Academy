#!/usr/bin/env python3
"""Exporta agenda pública somente-leitura do banco SQLite do Virtum Academy.

Não modifica nenhuma tabela. Compatível com a estrutura v1.9.3.34.
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
import tempfile
from urllib.parse import quote


def _mes_ref(mes: str):
    raw = str(mes or '').strip()
    match = re.fullmatch(r'(\d{2})-(\d{4})', raw)
    if match:
        return int(match.group(2)), int(match.group(1))
    match = re.fullmatch(r'(\d{4})-(\d{2})', raw)
    if match:
        return int(match.group(1)), int(match.group(2))
    raise ValueError(f'Mês inválido: {raw}')


def calcular_data(mes_ref: str, semana: int, dia_semana: int) -> str:
    """Mesmo cálculo da função calc_data_aula do Virtum Academy."""
    ano, mes = _mes_ref(mes_ref)
    semana = int(semana)
    dia_semana = int(dia_semana)
    if not (1 <= semana <= 5 and 0 <= dia_semana <= 6):
        raise ValueError('Semana/dia da semana fora dos limites')
    primeiro = date(ano, mes, 1)
    primeira_segunda = primeiro + timedelta(days=(7 - primeiro.weekday()) % 7)
    return (primeira_segunda + timedelta(days=7 * (semana - 1) + dia_semana)).isoformat()


def semestres_lista(valor):
    return list(dict.fromkeys(re.findall(r'(?<!\d)\d{1,2}(?!\d)', str(valor or ''))))


def _fetch(con, sql, args=()):
    return [dict(r) for r in con.execute(sql, args)]


def _exists(con, name):
    return con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None


def carregar_agenda(caminho_bd: str) -> dict:
    origem = Path(caminho_bd).expanduser().resolve()
    if not origem.is_file():
        raise FileNotFoundError(f'Banco não encontrado: {origem}')
    # mode=ro impede gravações. uri=True trata corretamente espaços no caminho.
    # Não use immutable=1: isso poderia ignorar transações WAL recentes.
    uri = 'file:' + quote(origem.as_posix(), safe='/:') + '?mode=ro'
    con = sqlite3.connect(uri, uri=True, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        con.execute('PRAGMA query_only=ON')
        con.execute('BEGIN')  # snapshot coerente entre consultas, sem alterações
        obrigatorias = ('aula', 'alocacao', 'curso', 'disciplina', 'tutor', 'laboratorio')
        faltando = [t for t in obrigatorias if not _exists(con, t)]
        if faltando:
            raise RuntimeError('Banco incompatível com o Virtum Academy. Faltam: ' + ', '.join(faltando))

        cursos = _fetch(con, 'SELECT id, nome FROM curso WHERE COALESCE(na_lixeira,0)=0 ORDER BY nome')
        nomes_curso = {r['id']: str(r['nome'] or '').strip() for r in cursos}
        eventos = []
        coluna_cor = 't.cor_hex' if any(r[1]=='cor_hex' for r in con.execute('PRAGMA table_info(tutor)')) else "''"
        aulas = _fetch(con, f'''
            SELECT a.id AS aula_id, a.mes_ref, a.semana, a.dia_semana,
                   a.hora_inicio, a.hora_fim, a.turma, a.pratica, a.pratica_num, a.grupo,
                   c.id AS curso_id, c.nome AS curso, d.nome AS disciplina, d.semestres AS semestres,
                   t.nome AS tutor, COALESCE({coluna_cor},'') AS cor_tutor, COALESCE(l.nome,'') AS local
            FROM alocacao al
            JOIN aula a ON a.id=al.aula_id
            JOIN disciplina d ON d.id=a.disciplina_id
            JOIN curso c ON c.id=d.curso_id
            JOIN tutor t ON t.id=al.tutor_id
            LEFT JOIN laboratorio l ON l.id=al.laboratorio_id
            WHERE UPPER(TRIM(COALESCE(al.status,'')))='ATIVA'
              AND COALESCE(a.na_lixeira,0)=0
              AND COALESCE(d.na_lixeira,0)=0
              AND COALESCE(c.na_lixeira,0)=0
              AND COALESCE(t.na_lixeira,0)=0
            ORDER BY a.mes_ref, a.semana, a.dia_semana, a.hora_inicio, a.id
        ''')
        # Aulas podem ter mais de uma alocação em cenários históricos; não mesclar
        # salas/tutores diferentes silenciosamente.
        for n, r in enumerate(aulas):
            try:
                data = calcular_data(r['mes_ref'], r['semana'], r['dia_semana'])
            except (ValueError, TypeError):
                continue
            semestres = semestres_lista(r['semestres']) or semestres_lista(r['turma'])
            pratica = str(r['pratica'] or '').strip().upper()
            num = str(r['pratica_num'] or '').strip()
            atividade = pratica + num if pratica and num and not pratica.endswith(num) else pratica
            eventos.append({
                'id': f"aula-{r['aula_id']}-{n}", 'tipo': 'aula', 'data': data,
                'curso_ids': [r['curso_id']], 'cursos': [str(r['curso'] or '').strip()],
                'disciplina': str(r['disciplina'] or '').strip(), 'titulo': str(r['disciplina'] or '').strip(),
                'semestres': semestres, 'tutor': str(r['tutor'] or '').strip(),
                'local': str(r['local'] or '').strip(), 'hora_inicio': str(r['hora_inicio'] or ''),
                'hora_fim': str(r['hora_fim'] or ''), 'atividade': atividade,
                'grupo': str(r['grupo'] or r['turma'] or '').strip(),
                'cor_tutor': r['cor_tutor'] if re.fullmatch(r'#[0-9a-fA-F]{6}', str(r['cor_tutor'] or '')) else '',
            })

        if _exists(con, 'prova'):
            has_assoc = _exists(con, 'prova_curso')
            provas = _fetch(con, f'''
                SELECT p.id, p.data, p.titulo, p.curso_id, p.abrangencia,
                       p.tipo_evento, p.hora_inicio, p.hora_fim,
                       COALESCE(d.nome,'') AS disciplina, COALESCE(d.semestres,'') AS semestres,
                       COALESCE(l.nome,'') AS local, COALESCE(t.nome,'') AS tutor, COALESCE({coluna_cor},'') AS cor_tutor
                FROM prova p
                LEFT JOIN disciplina d ON d.id=p.disciplina_id
                LEFT JOIN laboratorio l ON l.id=p.laboratorio_id
                LEFT JOIN tutor t ON t.id=p.tutor_id
                WHERE p.ativo=1
                ORDER BY p.data, p.hora_inicio, p.id
            ''')
            cursos_prova = {}
            if has_assoc:
                for r in _fetch(con, 'SELECT prova_id, curso_id FROM prova_curso ORDER BY curso_id'):
                    cursos_prova.setdefault(r['prova_id'], []).append(r['curso_id'])
            for p in provas:
                data = str(p['data'] or '').strip()
                try:
                    date.fromisoformat(data)
                except ValueError:
                    continue
                if str(p['abrangencia'] or '').upper() == 'ALL':
                    ids = list(nomes_curso)
                else:
                    ids = cursos_prova.get(p['id']) or [p['curso_id']]
                ids = list(dict.fromkeys(int(i) for i in ids if i in nomes_curso))
                if not ids:
                    continue
                tipo = 'tcc' if str(p['tipo_evento'] or '').upper() == 'TCC' else 'prova'
                titulo = str(p['titulo'] or '').strip() or ('TCC' if tipo == 'tcc' else 'Prova')
                eventos.append({
                    'id': f"{tipo}-{p['id']}", 'tipo': tipo, 'data': data,
                    'curso_ids': ids, 'cursos': [nomes_curso[i] for i in ids],
                    'disciplina': str(p['disciplina'] or '').strip(), 'titulo': titulo,
                    'semestres': semestres_lista(p['semestres']), 'tutor': str(p['tutor'] or '').strip(),
                    'cor_tutor': p['cor_tutor'] if re.fullmatch(r'#[0-9a-fA-F]{6}', str(p['cor_tutor'] or '')) else '',
                    'local': str(p['local'] or '').strip(), 'hora_inicio': str(p['hora_inicio'] or ''),
                    'hora_fim': str(p['hora_fim'] or ''), 'atividade': tipo.upper(), 'grupo': '',
                })

        feriados = []
        if _exists(con, 'feriado'):
            for r in _fetch(con, 'SELECT data, nome FROM feriado ORDER BY data'):
                try:
                    date.fromisoformat(str(r['data']))
                    feriados.append({'data': r['data'], 'nome': str(r['nome'] or 'Feriado')})
                except ValueError:
                    pass
        con.execute('ROLLBACK')
        eventos.sort(key=lambda x: (x['data'], x['hora_inicio'], x['curso_ids'], x['tipo'], x['id']))
        return {
            'versao': 1, 'demonstracao': False,
            'atualizado_em': datetime.now().astimezone().isoformat(timespec='seconds'),
            'origem': 'Virtum Academy — exportação somente leitura',
            'cursos': [{'id': c['id'], 'nome': nomes_curso[c['id']]} for c in cursos],
            'eventos': eventos, 'feriados': feriados,
        }
    finally:
        con.close()


def exportar(banco: str, saida: str) -> dict:
    dados = carregar_agenda(banco)
    destino = Path(saida).expanduser().resolve()
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp_name = None
    try:
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', delete=False, dir=destino.parent, prefix='.agenda-', suffix='.json') as handle:
            json.dump(dados, handle, ensure_ascii=False, indent=2)
            handle.write('\n')
            tmp_name = handle.name
        os.replace(tmp_name, destino)
    finally:
        if tmp_name and os.path.exists(tmp_name):
            os.unlink(tmp_name)
    return dados


def main():
    parser = argparse.ArgumentParser(description='Exporta aulas e provas do Virtum Academy para o site Virtum Agenda.')
    parser.add_argument('banco', help='Caminho do virtum_academy.db (somente leitura).')
    parser.add_argument('--saida', default='agenda.json', help='Destino do arquivo JSON para publicar no site.')
    args = parser.parse_args()
    try:
        dados = exportar(args.banco, args.saida)
    except (OSError, RuntimeError, sqlite3.Error, ValueError) as exc:
        print(f'ERRO: {exc}', file=sys.stderr)
        return 1
    print(f"OK: {len(dados['eventos'])} eventos, {len(dados['cursos'])} cursos.")
    print('Arquivo publicado:', Path(args.saida).resolve())
    return 0


if __name__ == '__main__':
    sys.exit(main())
