#!/usr/bin/env bash
# 全テスト実行スクリプト（CI / 手動どちらでも使用可）
# 使い方:
#   bash scripts/run-tests.sh
#   または Windows Git Bash:
#   sh scripts/run-tests.sh

set -e

echo ""
echo "=== [1/5] Unit tests ==="
npx jest tests/unit --no-coverage

echo ""
echo "=== [2/5] Integration tests ==="
npx jest tests/integration --no-coverage

echo ""
echo "=== [3/5] Security tests ==="
npx jest tests/security --no-coverage

echo ""
echo "=== [4/5] Schema tests ==="
npx jest tests/schema --no-coverage

echo ""
echo "=== [5/5] E2E tests (Playwright) ==="
npx playwright test

echo ""
echo "=== Coverage summary ==="
npx jest --coverage --coverageReporters=text-summary --silent

echo ""
echo "=== ✅ All tests passed ==="
