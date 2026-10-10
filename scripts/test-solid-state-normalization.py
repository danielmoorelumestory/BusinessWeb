import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('normalize', Path(__file__).with_name('normalize-solid-state-mcp.py'))
normalize = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normalize)


class FinancialPeriodTest(unittest.TestCase):
    def test_missing_quarter_or_cell_is_not_zero(self):
        table = {'columns': ['2026-06-30'], 'rows': [{'metric': 'Total Revenue', 'values': [10]}]}
        self.assertIsNone(normalize.metric(table, ['Total Revenue'], normalize.PERIODS))
        table['columns'].append('2026-03-31')
        table['rows'][0]['values'].append(None)
        self.assertIsNone(normalize.metric(table, ['Total Revenue'], normalize.PERIODS))
        table['rows'][0]['values'][1] = 0
        self.assertEqual(normalize.metric(table, ['Total Revenue'], normalize.PERIODS), 10)

    def test_h1_uses_exact_quarters_not_last_two_columns(self):
        table = {'columns': ['2025-12-31', '2026-06-30', '2026-03-31'],
                 'rows': [{'metric': 'Operating Cash Flow', 'values': [9999, -4, 2]}]}
        self.assertEqual(normalize.metric(table, ['Operating Cash Flow'], normalize.PERIODS), -2)

    def test_provider_empty_response_does_not_create_an_identity(self):
        listing = normalize.listing('920185.BJ')
        self.assertFalse(listing['available'])
        self.assertIsNone(listing['price'])
        self.assertIsNone(normalize.financials('920185.BJ', 'CNY'))


if __name__ == '__main__':
    unittest.main()
