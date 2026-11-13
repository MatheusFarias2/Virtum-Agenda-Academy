#!/usr/bin/env python3
"""Prepara um diretorio estatico para revisao; nao publica automaticamente.

Sem --banco: dados ficticios. Com --banco: exige --autorizado e
remove informacoes pessoais de tutor e sala, salvo aprovacao explicita.
A saida padrao e dist/ (ignorado pelo Git).
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import tempfile

from exportar_agenda import carregar_agenda

BASE = Path(__file__).resolve().parent
ARQUIVOS_PUBLICOS = ('index.html', 'assets/app.css', 'assets/app.js')
CAMPOS_EVENTO = (
    'id', 'tipo', 'data', 'curso_ids', 'cursos', 'disciplina', 'titulo',
    'semestres', 'tutor', 'local', 'hora_inicio', 'hora_fim', 'atividade',
    'grupo', 'cor_tutor',
)


def aplicar_politica_publica(dados, incluir_tutores=False, incluir_salas=False, incluir_cores=False):
    """Lista de permissao explicita. Nao exporta campos arbitrarios do BD."""
    if incluir_cores and not incluir_tutores:
        raise ValueError('Cores exigem aprovacao para exibir tutores.')
    saida = {
        'versao': 1,
        'demonstracao': bool(dados.get('demonstracao', False)),
        'atualizado_em': str(dados.get('atualizado_em') or ''),
        'origem': 'Virtum Academy — agenda para consulta',
        'cursos': [{'id': c['id'], 'nome': c['nome']} for c in dados.get('cursos', [])],
        'feriados': [{'data': h['data'], 'nome': h['nome']} for h in dados.get('feriados', [])],
        'eventos': [],
    }
    for e in dados.get('eventos', []):
        novo = {k: e.get(k, '') for k in CAMPOS_EVENTO}
        if not incluir_tutores: novo['tutor'] = ''
        if not incluir_salas: novo['local'] = ''
        if not incluir_cores: novo['cor_tutor'] = ''
        saida['eventos'].append(novo)
    return saida


def preparar(destino, banco=None, autorizado=False, incluir_tutores=False, incluir_salas=False, incluir_cores=False):
    destino = Path(destino).expanduser().resolve()
    origem = (BASE / 'public').resolve()
    if destino == origem or destino == BASE or destino == BASE.parent:
        raise ValueError('Escolha uma pasta de saida separada da origem.')
    if banco and not autorizado:
        raise ValueError('Exportacao real exige --autorizado. Obtenha aprovacao institucional e revise os dados.')
    if not banco and (autorizado or incluir_tutores or incluir_salas or incluir_cores):
        raise ValueError('Opcoes de publicacao real exigem --banco.')
    if destino.exists() and not (destino / '.virtum-agenda-dist').is_file():
        raise ValueError('Destino existente sem marcador do gerador. Use outra pasta para evitar apagar arquivos.')
    if banco:
        dados = aplicar_politica_publica(carregar_agenda(str(banco)), incluir_tutores, incluir_salas, incluir_cores)
    else:
        dados = json.loads((origem/'agenda.json').read_text(encoding='utf-8'))
    destino.parent.mkdir(parents=True, exist_ok=True)
    tempdir = Path(tempfile.mkdtemp(prefix='.virtum-publicacao-', dir=destino.parent))
    try:
        for nome in ARQUIVOS_PUBLICOS:
            source = origem / nome
            out = tempdir / nome
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, out)
        (tempdir/'agenda.json').write_text(json.dumps(dados, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
        (tempdir/'.virtum-agenda-dist').write_text('Gerado por preparar_publicacao.py\n',encoding='utf-8')
        # Configuracao para eventual envio direto do diretorio estatico; sem necessidade de Python.
        if destino.exists(): shutil.rmtree(destino)
        os.replace(tempdir, destino)
    finally:
        if tempdir.exists(): shutil.rmtree(tempdir)
    return dados


def main():
    parser = argparse.ArgumentParser(description='Monta um diretorio estatico para revisar e publicar a agenda.')
    parser.add_argument('--saida', default=str(BASE / 'dist'), help='Pasta de saida isolada e ignorada pelo Git.')
    parser.add_argument('--banco', help='Banco real para exportacao, usado em modo somente leitura.')
    parser.add_argument('--autorizado', action='store_true', help='Confirma autorizacao para preparar dados reais (nao faz deploy).')
    parser.add_argument('--incluir-tutores', action='store_true', help='Inclui nomes de tutores, sujeito a autorizacao institucional.')
    parser.add_argument('--incluir-salas', action='store_true', help='Inclui salas/laboratorios, sujeito a autorizacao institucional.')
    parser.add_argument('--incluir-cores', action='store_true', help='Inclui cores dos tutores, requer --incluir-tutores.')
    args = parser.parse_args()
    try:
        dados = preparar(args.saida, args.banco, args.autorizado, args.incluir_tutores, args.incluir_salas, args.incluir_cores)
    except Exception as exc:
        parser.error(str(exc))
    print('OK: site preparado sem deploy em:', Path(args.saida).resolve())
    print('Modo:', 'DEMONSTRACAO' if dados['demonstracao'] else 'DADOS REAIS (REVISAO OBRIGATORIA)')
    print(f"Eventos: {len(dados['eventos'])}; cursos: {len(dados['cursos'])}")
    print('Somente os arquivos dentro de dist/ devem ser disponibilizados. NUNCA publicar o SQLite.')


if __name__ == '__main__': main()
