import json
from pathlib import Path
import sqlite3
import tempfile
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from exportar_agenda import calcular_data, carregar_agenda, exportar


class VirtumAgendaTests(unittest.TestCase):
    def test_calculo_primeira_segunda(self):
        self.assertEqual(calcular_data('11-2026', 1, 0), '2026-11-02')
        self.assertEqual(calcular_data('11-2026', 2, 2), '2026-11-11')
        self.assertEqual(calcular_data('2026-11', 3, 5), '2026-11-21')

    def test_agenda_somente_ativas_prova_multicurso(self):
        with tempfile.TemporaryDirectory() as temp:
            bd = Path(temp) / 'virtum_academy.db'
            con=sqlite3.connect(bd)
            con.executescript('''
                CREATE TABLE curso(id INTEGER PRIMARY KEY, nome TEXT, na_lixeira INT);
                CREATE TABLE disciplina(id INTEGER PRIMARY KEY, nome TEXT, semestres TEXT, curso_id INT, na_lixeira INT);
                CREATE TABLE tutor(id INTEGER PRIMARY KEY,nome TEXT,na_lixeira INT);
                CREATE TABLE laboratorio(id INTEGER PRIMARY KEY,nome TEXT);
                CREATE TABLE aula(id INTEGER PRIMARY KEY,disciplina_id INT,semestre_letivo INT,mes_ref TEXT,semana INT,dia_semana INT,hora_inicio TEXT,hora_fim TEXT,turma TEXT,pratica TEXT,pratica_num TEXT,grupo TEXT,na_lixeira INT);
                CREATE TABLE alocacao(id INTEGER PRIMARY KEY,aula_id INT,tutor_id INT,laboratorio_id INT,status TEXT);
                CREATE TABLE prova(id INTEGER PRIMARY KEY,data TEXT,titulo TEXT,curso_id INT,abrangencia TEXT,tipo_evento TEXT,hora_inicio TEXT,hora_fim TEXT,disciplina_id INT,laboratorio_id INT,tutor_id INT,ativo INT);
                CREATE TABLE prova_curso(prova_id INT,curso_id INT);
                CREATE TABLE feriado(data TEXT,nome TEXT);
                INSERT INTO curso VALUES(1,'Pedagogia',0),(2,'Psicologia',0);
                INSERT INTO disciplina VALUES(1,'Didática','3 e 4',1,0);
                INSERT INTO tutor VALUES(1,'Tutor Exemplo',0);
                INSERT INTO laboratorio VALUES(1,'Sala 101');
                INSERT INTO aula VALUES(1,1,2,'11-2026',2,2,'19:00','22:00','3 e 4','AP','1','A',0);
                INSERT INTO aula VALUES(2,1,2,'11-2026',2,3,'19:00','22:00','3 e 4','AP','2','A',0);
                INSERT INTO alocacao VALUES(1,1,1,1,'ATIVA'),(2,2,1,1,'CANCELADA');
                INSERT INTO prova VALUES(1,'2026-11-12','Prova geral',1,'ALL','PROVA','19:00','20:00',NULL,1,NULL,1);
                INSERT INTO prova VALUES(2,'2026-11-13','Defesa final',1,'SINGLE','TCC','19:00','20:00',NULL,1,1,1);
                INSERT INTO prova_curso VALUES(2,1);
                INSERT INTO feriado VALUES('2026-11-20','Consciência Negra');
            ''')
            con.commit();con.close()
            out=carregar_agenda(str(bd))
            self.assertEqual(len(out['eventos']),3)
            aula=next(e for e in out['eventos'] if e['tipo']=='aula')
            self.assertEqual(aula['data'],'2026-11-11')
            self.assertEqual(aula['atividade'],'AP1')
            self.assertEqual(aula['semestres'],['3','4'])
            prova=next(e for e in out['eventos'] if e['tipo']=='prova')
            self.assertEqual(prova['curso_ids'],[1,2])
            self.assertEqual(len(out['feriados']),1)
            dest=Path(temp)/'agenda.json'
            exportar(str(bd),str(dest))
            self.assertFalse(json.loads(dest.read_text())['demonstracao'])
            self.assertEqual(sqlite3.connect(bd).execute('SELECT COUNT(*) FROM aula').fetchone()[0],2)


if __name__=='__main__':
    unittest.main()
