# Virtum Agenda | Preparação de publicação — P1

**Base recebida:** Virtum Agenda v0.2.9. Este pacote NAO incorpora automaticamente alteracoes de commits posteriores do GitHub, mesmo que haja um commit com nome v0.5.x. Antes de substituir arquivos no repositorio, use diff e preserve alteracoes novas.

## O que este pacote resolve

- `public/`: site HTML/CSS/JS autonomo para hospedagem estatica, sem servidor Python.
- `public/agenda.json`: exclusivamente DADOS DEMONSTRATIVOS FICTICIOS. O deploy de teste nao contem informacoes reais.
- `vercel.json`: Vercel publica somente `public/` (nenhum Python, script ou arquivo SQLite na web). Inclui cabecalhos de seguranca e controle de cache.
- `preparar_publicacao.py`: cria pasta `dist/` com JSON demonstrativo ou dados reais destinados a REVISÃO, sem fazer upload.
- `.gitignore`: evita novos arquivos SQLite, logs, caches e pasta dist no Git. **Arquivos já rastreados exigem `git rm --cached`.**

## Previsualizar no computador

Na raiz do pacote, execute:

```bash
python preparar_publicacao.py
cd dist
python -m http.server 8000 --bind 127.0.0.1
```

Abra http://127.0.0.1:8000/ e verifique filtros, grade, planilha, detalhes da disciplina e cores do tutor ficticio.

## Publicar SOMENTE a demonstracao usando GitHub + Vercel

1. Copie `public/`, `vercel.json`, `.gitignore` e (se desejar) as ferramentas para o projeto Git existente. Nao sobrescreva commits mais recentes sem comparar o codigo.
2. Confirme que `public/agenda.json` tem `"demonstracao": true`, um curso ficticio e nenhum dado real.
3. Execute `git status` e confira exatamente os arquivos que serao incluidos. Nao inclua bancos de dados, backups, configs locais nem `dist/`.
4. Envie o commit ao GitHub e conecte o projeto na Vercel. Configure **Framework Preset: Other**, **Output Directory: public**, **Build Command: vazio**. O `vercel.json` ja informa `outputDirectory: public`.
5. Use a URL de preview para testar em celular e desktop. Nao divulgue aos alunos como sistema oficial enquanto o JSON for demonstrativo.

## Preparar dados reais para REVISAO, sem colocar no Git

```bash
python preparar_publicacao.py --banco "C:\CAMINHO\virtum_academy.db" --autorizado
```

O resultado fica em `dist/agenda.json` e contem apenas campos publicos selecionados. Por padrao, nomes de tutores, salas e cores sao OMITIDOS. Para inclui-los, somente com autorizacao da instituicao:

```bash
python preparar_publicacao.py --banco "C:\CAMINHO\virtum_academy.db" --autorizado --incluir-tutores --incluir-salas --incluir-cores
```

**ANTES de qualquer deploy real:** abra `dist/agenda.json` e inspecione curso, disciplina, titulo, grupo, feriados, datas, nome de tutores, salas, eventuais observacoes inseridas em titulos e dados de TCC/provas. Mesmo sem CPF ou financeiro, horários e locais podem exigir restricao. Revise o JSON por inteiro, nao apenas uma amostra. Obtenha aprovacao de quem administra os dados e defina se o publico e aberto ou autenticado.

**NAO** copie automaticamente o JSON real para `public/agenda.json` rastreado pelo Git. O site estatico e seu JSON sao publicos a qualquer pessoa com o link. A sincronizacao automatica protegida e a publicacao do JSON real pertencem a uma etapa separada.

## Cuidados com Git

Remover cache rastreado do indice sem apagar arquivo local:

```bash
git rm -r --cached --ignore-unmatch __pycache__
git add .gitignore README.md public vercel.json preparar_publicacao.py LEIA_PRIMEIRO_PUBLICACAO.md
git status
```

Se houver `<<<<<<<`, `=======` ou `>>>>>>>` em `README.md` por conflito antigo, resolva manualmente. O GitHub consultado durante a auditoria exibia ao menos um marcador. Nunca use `git push --force` para aplicar este pacote.

## Limites conhecidos

- Esta base nao possui login nem isolamento por aluno. Publicacao real aberta significa que todos os dados do JSON sao acessiveis por qualquer visitante. A ocultacao na UI nao protege os dados.
- Nao ha sincronizacao automatica hospedada com o SQLite; a versao de teste so consome JSON estatico.
- A integracao local permanece em `servidor_agenda.py` e continua rodando apenas em localhost.
- Nao ha garantia de que `vercel.json` tenha sido verificado por um deploy real; teste no dominio de preview.
