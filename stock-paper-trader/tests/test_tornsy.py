import unittest

from torn_stock_lab.tornsy import tickers_from_watchlist


class TornsyTests(unittest.TestCase):
    def test_discovers_all_tradable_tickers(self):
        payload = {
            "data": [
                {"stock": "FHG", "price": "900"},
                {"stock": "ASS", "price": "100"},
                {"stock": "TCSE", "price": "16000", "index": 1},
            ]
        }
        self.assertEqual(tickers_from_watchlist(payload), ["ASS", "FHG"])
        self.assertEqual(
            tickers_from_watchlist(payload, include_index=True),
            ["ASS", "FHG", "TCSE"],
        )


if __name__ == "__main__":
    unittest.main()
