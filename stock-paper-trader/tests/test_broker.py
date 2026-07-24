import sqlite3
import unittest

from torn_stock_lab.broker import ensure_portfolio, execute
from torn_stock_lab.database import SCHEMA


class BrokerTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        ensure_portfolio(self.db, "paper", 1_000_000)

    def tearDown(self):
        self.db.close()

    def test_buy_and_sell_with_fee(self):
        bought = execute(
            self.db,
            signal_id=None,
            portfolio="paper",
            ticker="FHG",
            side="BUY",
            price=100,
            timestamp=1,
            allocation_percent=0.10,
            sell_fee_rate=0.001,
            minimum_trade_value=1,
        )
        self.assertTrue(bought)
        sold = execute(
            self.db,
            signal_id=None,
            portfolio="paper",
            ticker="FHG",
            side="SELL",
            price=110,
            timestamp=2,
            allocation_percent=0.10,
            sell_fee_rate=0.001,
            minimum_trade_value=1,
        )
        self.assertTrue(sold)
        cash = self.db.execute(
            "SELECT cash FROM portfolios WHERE name='paper'"
        ).fetchone()["cash"]
        self.assertAlmostEqual(cash, 1_009_890)


if __name__ == "__main__":
    unittest.main()

