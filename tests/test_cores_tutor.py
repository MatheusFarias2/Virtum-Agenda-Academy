import unittest
from pathlib import Path

class CoresTutorTests(unittest.TestCase):
    def test_exportador_expoe_cor(self):
        code=(Path(__file__).resolve().parents[1]/'exportar_agenda.py').read_text(encoding='utf-8')
        self.assertIn('t.cor_hex',code)
        self.assertIn("'cor_tutor'",code)
    def test_interface_possui_dialog(self):
        root=Path(__file__).resolve().parents[1]
        self.assertIn('disciplina-dialog',(root/'index.html').read_text(encoding='utf-8'))
        self.assertIn('openDiscipline',(root/'assets/app.js').read_text(encoding='utf-8'))

if __name__=='__main__':unittest.main()
