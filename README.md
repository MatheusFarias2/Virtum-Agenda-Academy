# Virtum Agenda v0.2.0 — integração com banco real

## Iniciar no Windows

Execute `INICIAR_SITE_WINDOWS.bat`. O inicializador mantém a detecção/instalação de Python portátil da v0.1.5. Na primeira execução, informe o caminho completo do `virtum_academy.db` do Virtum Academy. Caminhos UNC de rede também são aceitos se o usuário tiver acesso. O caminho validado fica salvo em `%LOCALAPPDATA%\VirtumAgenda\banco_agenda.txt` (para alterar o banco, exclua esse arquivo ou edite o caminho).

O site abre em `http://127.0.0.1:8080/`. O servidor lê o banco em modo somente leitura, com consultas em snapshot. Atualiza cache a cada 30 segundos e o navegador consulta a cada 60 segundos. **O banco SQLite nunca é servido por HTTP.** O servidor escuta apenas em localhost; não é um site público nem pode ser acessado por alunos de outros computadores.

## Publicar na internet

Esta versão **não** publica dados automaticamente na internet. Para uma versão pública, use um processo de exportação unidirecional, revisão de privacidade e hospedagem HTTPS. Nunca disponibilize o SQLite na pasta pública.

## Segurança

O conteúdo público inclui nomes de cursos, disciplinas, tutores e salas. Confirme autorização institucional antes de disponibilizar essas informações fora da rede interna. Nenhum dado financeiro é exportado. O acesso a SQLite é `mode=ro` e `query_only=ON`.

## Diagnóstico

Se falhar, confirme o arquivo selecionado, permissões de rede, porta 8080 e o log `%TEMP%\virtum-agenda-inicializador.log`. Pode testar manualmente: `python servidor_agenda.py --banco "C:\caminho\virtum_academy.db"`.

## Testes

`python -m unittest discover -s tests -v`

## v0.2.1 HF1
Corrigido import do exportador no Python embutido isolado (`python312._pth`). A validacao e o servidor adicionam explicitamente o diretorio do aplicativo ao `sys.path`.

## v0.2.2 HF2
Compatibilidade com clientes antigos: /agenda.json responde dinamicamente com os mesmos dados reais de /api/agenda. Arquivos HTML/CSS/JS sem cache para evitar scripts antigos. O banco SQLite continua inacessivel por HTTP.


## v0.2.3 HF3 — Polimento de usabilidade
- Filtros de curso, semestre, tipo e modo de visualização lembrados no navegador local.
- Botão para atualizar os dados sem reiniciar o servidor.
- Em telas pequenas, indicadores compactos de atividade no calendário e detalhes ao tocar no dia.
- Aviso de conexão interrompida sem apagar os dados carregados na sessão.
- Ajustes de foco por teclado e preferência de movimento reduzido.
- O banco segue somente leitura; não houve alteração no exportador nem no inicializador.


## v0.2.4 — Fase 2: refinamento visual
Nova hierarquia tipografica, identidade roxa Virtum, superficies e estados interativos, aprimoramento do calendario e layout responsivo. Nao modifica exportacao SQLite, API, filtros ou inicializador.


## v0.2.5 — Fase 3: Experiência acadêmica
- Nova visualização semanal com sete dias (segunda a domingo), atividades e feriados.
- Navegação anterior/próxima avança uma semana na visualização semanal.
- Clique no cabeçalho do dia para abrir seus detalhes.
- Próximas atividades ampliadas para seis registros.
- A preferência de visualização semanal é preservada no navegador.
- Nenhuma mudança no servidor, na API, no banco ou no inicializador.


## v0.2.6 — Grade e planilha

Na barra do calendário, escolha **Mês** (grade), **Semana**, **Lista** ou **Planilha**. A planilha apresenta as atividades do mês filtrado, em ordem cronológica, com data, horário, curso, disciplina/evento, semestre, tipo, atividade, tutor/avaliador e sala/local. Em telas estreitas, a tabela tem rolagem horizontal. O botão `.ics` permanece disponível por evento. A visualização é apenas de leitura e não adiciona nenhuma consulta ou permissão ao banco SQLite.

## v0.2.7 — Cronograma interativo por disciplina
Dois cliques numa disciplina (ou toque no celular, Enter/Espaço via teclado) abrem uma janela com as aulas, provas e TCCs relacionados ao curso. As cores são lidas do campo `tutor.cor_hex` do Virtum Academy; sem cor cadastrada, usa-se um tom neutro. O banco permanece somente leitura.


## v0.2.8 HF1 — Clique em disciplinas
- Clique simples em qualquer atividade com disciplina abre o cronograma (grade, semana, lista, planilha e proximas atividades).
- Corrigido erro JavaScript ao selecionar datas com feriado.
- Atualizada versao de assets para evitar cache antigo.


## v0.2.9 — Consulta completa do dia
No calendário mensal, clique no espaço do dia ou em `+N atividades` para abrir todas as atividades daquela data, com filtro opcional por tutor. Clique diretamente no chip de uma disciplina para abrir o cronograma completo da disciplina. Os filtros gerais de curso, semestre, tipo e busca permanecem ativos.


## Pré-publicação P1 (base v0.2.9)
Veja `LEIA_PRIMEIRO_PUBLICACAO.md`. O site para Vercel está em `public/` com **dados fictícios**, sem SQLite. O servidor local e a interface original foram preservados.
