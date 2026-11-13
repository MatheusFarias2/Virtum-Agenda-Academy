# Auditoria técnica inicial — Virtum Agenda

**Entrada auditada:** ZIP v0.2.9 recebido no chat em 12/11/2026. Não houve acesso ao SQLite real.

## Confirmado por inspeção do código

- O servidor local (`servidor_agenda.py`) atende somente `127.0.0.1`, possui uma lista explícita de arquivos HTTP e lê SQLite pelo exportador em modo `ro` / `query_only`.
- A interface da v0.2.9 depende de `fetch('/api/agenda')`, que não existe por padrão num host estático. A variante de `public/assets/app.js` consulta `fetch('/agenda.json')`.
- O exportador local inclui nomes de curso, disciplina, tutor, sala, datas, horários, TCC e provas. O JSON não contém campos financeiros explícitos na estrutura atual, mas títulos de eventos podem conter textos digitados pelos operadores.
- A versão pública tem **zero dependências de SQLite ou Python no navegador**. O projeto Vercel serve apenas `public/`, conforme `vercel.json`.
- O repositório GitHub consultado em 12/11/2026 estava público e mostrava um arquivo `__pycache__` rastreado e um marcador de conflito no README. Isso precisa ser tratado antes de liberar informações reais.

## Realizado nesta etapa

- Site demonstrativo com JSON totalmente fictício em `public/agenda.json`.
- `vercel.json` com `outputDirectory=public`, cabeçalhos para não reusar agenda desatualizada e políticas básicas de segurança.
- Gerador manual de pasta estática `dist/`, ignorada pelo Git, com política de redução de informações pessoais e opção explícita de autorização.
- `.gitignore` para evitar futuros commits acidentais de bancos, caches e dados gerados.
- Testes de unidade para o pipeline estático, além dos testes anteriores do servidor local.

## Antes do uso por alunos

- [ ] Validar quem pode ter acesso. **Sem autenticação, qualquer visitante poderá baixar o JSON completo.**
- [ ] Definir e autorizar publicamente campos: curso, disciplina, horários, salas, nomes dos tutores, TCC e avaliação.
- [ ] Verificar se nomes e horários exigem restrição, especialmente em caso de dados de menores ou de turmas específicas.
- [ ] Validar controle de atualização de agenda após mudança no Academy, com rollback e auditoria.
- [ ] Validar ambiente de preview da Vercel no celular e no desktop.
- [ ] Corrigir eventuais conflitos Git e remover caches rastreados.
- [ ] Comparar este código v0.2.9 com o branch Git atual antes de aplicar qualquer alteração.

## Observação

Nenhuma implantação pública foi feita por esta preparação. Uma versão de preview com dados fictícios é apropriada para validar layout e hospedagem, mas não representa a integração com dados reais em produção.
