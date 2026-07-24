import unittest

from torn_stock_lab.indicators import calculate_features


class IndicatorTests(unittest.TestCase):
    def test_uptrend_features(self):
        closes = [100 + value for value in range(40)]
        result = calculate_features(closes)
        self.assertGreater(result["return_7"], 0)
        self.assertGreater(result["sma_ratio"], 0)
        self.assertGreater(result["rsi_14"], 50)

    def test_requires_history(self):
        with self.assertRaises(ValueError):
            calculate_features([1.0] * 30)


if __name__ == "__main__":
    unittest.main()

