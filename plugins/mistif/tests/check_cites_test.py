"""Tests for skills/research/scripts/check_cites.py: quote matching on page text (no network)."""
import importlib.util
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('check_cites', os.path.join(HERE, '..', 'skills', 'research', 'scripts', 'check_cites.py'))
cc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cc)

PAGE = """<html><head><style>p{color:red}</style><script>var x = "the council voted 7 to 2";</script></head>
<body><h1>Minutes</h1><p>On 4&nbsp;March&nbsp;2024 the council <b>voted 7&ndash;2</b> to adopt the “quiet hours” bylaw.</p></body></html>"""


class QuoteTests(unittest.TestCase):
    def setUp(self):
        self.text = cc.page_text(PAGE)

    def test_exact_quote_is_found(self):
        self.assertEqual(cc.find_quote('the council voted 7-2 to adopt', self.text), 'ok')

    def test_case_tags_entities_and_curly_quotes_are_ignored(self):
        self.assertEqual(cc.find_quote('On 4 March 2024 the Council voted 7–2 to adopt the "quiet hours" bylaw', self.text), 'ok')

    def test_script_text_does_not_count(self):
        self.assertEqual(cc.find_quote('the council voted 7 to 2', self.text), 'quote missing')

    def test_changed_figure_is_missing(self):
        self.assertEqual(cc.find_quote('the council voted 6-3 to adopt', self.text), 'quote missing')

    def test_empty_quote_is_missing(self):
        self.assertEqual(cc.find_quote('', self.text), 'quote missing')

    def test_non_web_url_fails_without_fetching(self):
        self.assertTrue(cc.check({'url': 'file:///etc/passwd', 'quote': 'x'}).startswith('fetch failed'))


if __name__ == '__main__':
    unittest.main()
