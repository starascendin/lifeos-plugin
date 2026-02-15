"""
Sync scraped Empower finance data to Convex.

Reads output/all_accounts.json, cleans data, and pushes to Convex
via the internal mutation API using admin key.

Usage:
  PYENV_VERSION=3.12.10 uv run python sync_to_convex.py
"""
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import httpx

SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR / "output"
ALL_ACCOUNTS_JSON = OUTPUT_DIR / "all_accounts.json"

# Convex deployment URL and admin key from env
CONVEX_URL = os.environ.get("CONVEX_URL", "")
CONVEX_ADMIN_KEY = os.environ.get("CONVEX_ADMIN_KEY", "")
# Token identifier for the user (from Clerk)
USER_TOKEN_IDENTIFIER = os.environ.get("USER_TOKEN_IDENTIFIER", "")

# ==================== Account Classification ====================
# Hardcoded mapping of account numbers to types
ACCOUNT_MAP: dict[str, dict[str, str]] = {
    # Cash
    "4824": {"type": "cash", "subtype": "checking", "asset_class": "asset"},
    "560":  {"type": "cash", "subtype": "checking", "asset_class": "asset"},
    # Investments
    "0653": {"type": "investment", "subtype": "brokerage", "asset_class": "asset"},
    "4348": {"type": "investment", "subtype": "brokerage", "asset_class": "asset"},
    "880":  {"type": "investment", "subtype": "roth_ira", "asset_class": "asset"},
    "042":  {"type": "investment", "subtype": "individual", "asset_class": "asset"},
    "909":  {"type": "investment", "subtype": "rollover_ira", "asset_class": "asset"},
    "9957": {"type": "investment", "subtype": "other", "asset_class": "asset"},
    "3315": {"type": "investment", "subtype": "brokerage", "asset_class": "asset"},
    "0359": {"type": "investment", "subtype": "brokerage", "asset_class": "asset"},
    # Credit cards
    "2775": {"type": "credit_card", "subtype": "credit_card", "asset_class": "liability"},
    "4937": {"type": "credit_card", "subtype": "credit_card", "asset_class": "liability"},
    "7277": {"type": "credit_card", "subtype": "credit_card", "asset_class": "liability"},
    "4108": {"type": "credit_card", "subtype": "credit_card", "asset_class": "liability"},
    "2276": {"type": "credit_card", "subtype": "credit_card", "asset_class": "liability"},
}

# Known institution names (extracted from messy raw text)
KNOWN_INSTITUTIONS = [
    "Chase",
    "Charles Schwab",
    "E*TRADE",
    "Fidelity Investments",
    "Barclaycard",
    "Wells Fargo",
    "Vanguard",
    "Venmo",
    "Wealthfront",
    "Citibank",
]


def clean_institution(raw: str) -> str:
    """Extract clean institution name from messy raw text."""
    for name in KNOWN_INSTITUTIONS:
        if name.lower() in raw.lower():
            return name
    # Fallback: take first word
    first_word = raw.split()[0] if raw.strip() else "Unknown"
    # Remove trailing digits
    return re.sub(r"\d+$", "", first_word).strip() or "Unknown"


def clean_account_name(raw_title: str, account_num: str) -> str:
    """Extract clean account name from raw accountTitle."""
    # Look for pattern: "Type - Ending in XXXX"
    match = re.search(r"([\w\s/]+?)\s*-\s*Ending in\s*\d+", raw_title)
    if match:
        return match.group(1).strip()
    # Fallback: look for known patterns
    for pattern in ["Total Checking", "Investor Checking", "Credit Card",
                    "Roth Contributory Ira", "Rollover Ira", "Individual",
                    "Self Directed", "Securities"]:
        if pattern.lower() in raw_title.lower():
            return pattern
    return f"Account ...{account_num}"


def parse_balance(raw: str) -> int:
    """Parse balance string like '$44,511' to cents."""
    cleaned = raw.replace("$", "").replace(",", "").strip()
    try:
        return int(round(float(cleaned) * 100))
    except ValueError:
        return 0


def parse_amount(raw: str) -> int:
    """Parse amount string like '-$9.99' to cents (preserving sign)."""
    cleaned = raw.replace("$", "").replace(",", "").strip()
    try:
        return int(round(float(cleaned) * 100))
    except ValueError:
        return 0


def parse_date_to_iso(raw: str) -> str:
    """Convert '2/14/2026' to '2026-02-14'."""
    try:
        dt = datetime.strptime(raw, "%m/%d/%Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return raw


def parse_date_to_ms(raw: str) -> int:
    """Convert '2/14/2026' to epoch milliseconds."""
    try:
        dt = datetime.strptime(raw, "%m/%d/%Y")
        return int(dt.timestamp() * 1000)
    except ValueError:
        return 0


def clean_account(raw_acct: dict) -> dict:
    """Clean a single account entry from all_accounts.json."""
    acct_num = raw_acct["accountNum"]
    raw_inst = raw_acct["institution"]
    raw_title = raw_acct.get("accountTitle", "")

    acct_info = ACCOUNT_MAP.get(acct_num, {
        "type": "other", "subtype": "other", "asset_class": "asset",
    })

    institution = clean_institution(raw_inst)
    account_name = clean_account_name(raw_title, acct_num)
    balance_cents = parse_balance(raw_acct["balance"])
    is_debt = acct_info["asset_class"] == "liability"

    # Clean transactions
    transactions = []
    for txn in raw_acct.get("transactions", []):
        cleaned_txn: dict = {
            "date": parse_date_to_iso(txn["date"]),
            "dateMs": parse_date_to_ms(txn["date"]),
            "description": txn.get("description", ""),
            "category": txn.get("category", "Uncategorized"),
            "amountCents": parse_amount(txn.get("amount", "$0")),
        }
        # Investment fields
        if txn.get("action"):
            cleaned_txn["action"] = txn["action"]
        if txn.get("quantity"):
            try:
                cleaned_txn["quantity"] = float(txn["quantity"])
            except (ValueError, TypeError):
                pass
        if txn.get("price"):
            cleaned_txn["priceCents"] = parse_balance(txn["price"])

        transactions.append(cleaned_txn)

    return {
        "accountNum": acct_num,
        "institution": institution,
        "accountName": account_name,
        "accountType": acct_info["type"],
        "accountSubtype": acct_info["subtype"],
        "assetClass": acct_info["asset_class"],
        "balanceCents": balance_cents,
        "isDebt": is_debt,
        "rawInstitution": raw_inst,
        "rawAccountTitle": raw_title,
        "transactions": transactions,
    }


def sync_to_convex(accounts: list[dict] | None = None) -> bool:
    """Push cleaned finance data to Convex."""
    if not CONVEX_URL:
        print("ERROR: CONVEX_URL not set")
        return False
    if not CONVEX_ADMIN_KEY:
        print("ERROR: CONVEX_ADMIN_KEY not set")
        return False
    if not USER_TOKEN_IDENTIFIER:
        print("ERROR: USER_TOKEN_IDENTIFIER not set")
        return False

    if accounts is None:
        if not ALL_ACCOUNTS_JSON.exists():
            print(f"ERROR: {ALL_ACCOUNTS_JSON} not found")
            return False
        with open(ALL_ACCOUNTS_JSON) as f:
            raw_accounts = json.load(f)
        accounts = [clean_account(a) for a in raw_accounts]

    print(f"\nSyncing {len(accounts)} accounts to Convex...")

    # POST to Convex internal mutation API
    # Format: POST {CONVEX_URL}/api/mutation
    api_url = CONVEX_URL.rstrip("/")
    if not api_url.endswith(".convex.cloud") and not api_url.endswith(".convex.site"):
        # Ensure we're using the .convex.cloud URL
        pass

    mutation_url = f"{api_url}/api/run"

    payload = {
        "path": "lifeos/finance:syncFinanceData",
        "args": {
            "userTokenIdentifier": USER_TOKEN_IDENTIFIER,
            "accounts": accounts,
        },
        "format": "json",
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Convex {CONVEX_ADMIN_KEY}",
    }

    try:
        resp = httpx.post(
            mutation_url,
            json=payload,
            headers=headers,
            timeout=60,
        )
        if resp.status_code == 200:
            result = resp.json()
            print(f"Sync successful: {json.dumps(result, indent=2)}")
            return True
        else:
            print(f"Sync failed ({resp.status_code}): {resp.text}")
            return False
    except Exception as e:
        print(f"Sync error: {e}")
        return False


def main():
    if not ALL_ACCOUNTS_JSON.exists():
        print(f"ERROR: {ALL_ACCOUNTS_JSON} not found. Run scrape_all.py first.")
        sys.exit(1)

    with open(ALL_ACCOUNTS_JSON) as f:
        raw_accounts = json.load(f)

    print(f"Loaded {len(raw_accounts)} accounts from {ALL_ACCOUNTS_JSON.name}")

    accounts = [clean_account(a) for a in raw_accounts]

    # Print summary
    total_assets = sum(a["balanceCents"] for a in accounts if a["assetClass"] == "asset")
    total_liabilities = sum(a["balanceCents"] for a in accounts if a["assetClass"] == "liability")
    total_txns = sum(len(a["transactions"]) for a in accounts)

    print(f"\nCleaned data:")
    for a in accounts:
        txn_count = len(a["transactions"])
        print(f"  {a['institution']:20s} ...{a['accountNum']:>4s}  {a['accountType']:12s}  ${a['balanceCents']/100:>12,.2f}  ({txn_count} txns)")

    print(f"\nTotal Assets:      ${total_assets/100:>12,.2f}")
    print(f"Total Liabilities: ${total_liabilities/100:>12,.2f}")
    print(f"Net Worth:         ${(total_assets - total_liabilities)/100:>12,.2f}")
    print(f"Total Transactions: {total_txns}")

    success = sync_to_convex(accounts)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
