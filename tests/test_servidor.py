import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from servidor_agenda import AgendaServer, Handler

class ServerTests(unittest.TestCase):
    def test_api_readonly_refresh_and_no_db_exposure(self):
        with tempfile.TemporaryDirectory() as d:
            db=Path(d)/'virtum_academy.db'
            con=sqlite3.connect(db)
            con.executescript('''
            CREATE TABLE curso(id INTEGER PRIMARY KEY,nome TEXT,na_lixeira INT);
            CREATE TABLE disciplina(id INTEGER PRIMARY KEY,nome TEXT,semestres TEXT,curso_id INT,na_lixeira INT);
            CREATE TABLE tutor(id INTEGER PRIMARY KEY,nome TEXT,na_lixeira INT);
            CREATE TABLE laboratorio(id INTEGER PRIMARY KEY,nome TEXT);
            CREATE TABLE aula(id INTEGER PRIMARY KEY,disciplina_id INT,mes_ref TEXT,semana INT,dia_semana INT,hora_inicio TEXT,hora_fim TEXT,turma TEXT,pratica TEXT,pratica_num TEXT,grupo TEXT,na_lixeira INT);
            CREATE TABLE alocacao(id INTEGER PRIMARY KEY,aula_id INT,tutor_id INT,laboratorio_id INT,status TEXT);
            INSERT INTO curso VALUES(1,'Curso Real',0);
            INSERT INTO disciplina VALUES(1,'Disciplina Real','1',1,0);
            INSERT INTO tutor VALUES(1,'Tutor Real',0);
            INSERT INTO laboratorio VALUES(1,'Sala Real');
            INSERT INTO aula VALUES(1,1,'11-2026',2,0,'19:00','22:00','1','AP','1','',0);
            INSERT INTO alocacao VALUES(1,1,1,1,'ATIVA');
            ''')
            con.commit();con.close()
            srv=AgendaServer(('127.0.0.1',0),Handler,db,5)
            thread=threading.Thread(target=srv.serve_forever,daemon=True);thread.start()
            base=f'http://127.0.0.1:{srv.server_address[1]}'
            try:
                with urlopen(base+'/api/agenda') as r: payload=json.load(r)
                self.assertEqual(payload['eventos'][0]['titulo'],'Disciplina Real')
                self.assertFalse(payload['demonstracao'])
                self.assertEqual(len(payload['eventos']),1)
                with urlopen(base+'/agenda.json') as r:
                    legacy=json.load(r)
                    self.assertEqual(r.headers['Cache-Control'], 'no-store, max-age=0')
                self.assertEqual(legacy, payload)
                with urlopen(base+'/assets/app.js') as r:
                    self.assertEqual(r.headers['Cache-Control'], 'no-store, max-age=0')
                with self.assertRaises(HTTPError) as cm: urlopen(base+'/virtum_academy.db')
                self.assertEqual(cm.exception.code,404)
                with self.assertRaises(HTTPError): urlopen(base+'/exportar_agenda.py')
                con=sqlite3.connect(db)
                con.execute("UPDATE alocacao SET status='CANCELADA'")
                con.commit();con.close()
                srv.last_check=0
                with urlopen(base+'/api/agenda') as r: payload=json.load(r)
                self.assertEqual(len(payload['eventos']),0)
            finally:
                srv.shutdown();srv.server_close();thread.join(timeout=5)
