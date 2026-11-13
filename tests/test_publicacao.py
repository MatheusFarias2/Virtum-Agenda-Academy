import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from preparar_publicacao import preparar, aplicar_politica_publica, BASE


class PublicacaoTests(unittest.TestCase):
    def test_demo_publica_somente_estaticos(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'dist'
            dados = preparar(out)
            self.assertTrue(dados['demonstracao'])
            self.assertTrue((out/'index.html').is_file())
            self.assertTrue((out/'agenda.json').is_file())
            self.assertTrue((out/'assets/app.js').is_file())
            self.assertFalse((out/'servidor_agenda.py').exists())
            self.assertFalse((out/'virtum_academy.db').exists())
            script = (out/'assets/app.js').read_text(encoding='utf-8')
            self.assertEqual(script.count("fetch('/agenda.json'"),2)
            self.assertNotIn("fetch('/api/agenda'",script)

    def test_arquivo_real_exige_confirmacao(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError,'--autorizado'):
                preparar(Path(tmp)/'dist', banco=Path(tmp)/'inexistente.db')

    def test_campos_pessoais_ocultos_por_padrao(self):
        dados={'eventos':[{'id':'1','tipo':'aula','data':'2026-11-11','curso_ids':[1], 'cursos':['X'],
                  'disciplina':'Materia','titulo':'Materia','semestres':['2'], 'tutor':'Nome Pessoa',
                  'local':'Sala Restrita','cor_tutor':'#ffffff','financeiro':999}],
                'cursos':[{'id':1,'nome':'Curso'}], 'feriados':[], 'demonstracao':False}
        clean=aplicar_politica_publica(dados)
        self.assertEqual(clean['eventos'][0]['tutor'],'')
        self.assertEqual(clean['eventos'][0]['local'],'')
        self.assertEqual(clean['eventos'][0]['cor_tutor'],'')
        self.assertNotIn('financeiro',clean['eventos'][0])
        self.assertEqual(aplicar_politica_publica(dados,True,True,True)['eventos'][0]['cor_tutor'],'#ffffff')
        with self.assertRaises(ValueError): aplicar_politica_publica(dados,False,False,True)

    def test_vercel_restringe_output(self):
        config=json.loads((BASE/'vercel.json').read_text(encoding='utf-8'))
        self.assertEqual(config['outputDirectory'],'public')
        self.assertFalse(any(p.suffix in {'.py','.db','.sqlite'} for p in (BASE/'public').rglob('*') if p.is_file()))


if __name__=='__main__': unittest.main()
