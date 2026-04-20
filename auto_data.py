import requests
import json
import time
import os
import firebase_admin
from firebase_admin import credentials, firestore

# --- CONFIG ---
API_KEY = os.environ.get("CRAFTERSMC_API_KEY")
if not API_KEY:
    raise EnvironmentError("CRAFTERSMC_API_KEY secret is not set.")
BASE_URL = "https://api.craftersmc.net/v1/skyblock/bazaar"

# --- FIREBASE SETUP ---
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

price_doc_ref = db.collection("prices").document("itemsV2")

def get_best_buy_price(item_id):
    url = f"{BASE_URL}/{item_id}/details"
    headers = {"X-API-Key": API_KEY, "Accept": "application/json"}

    while True:
        try:
            res = requests.get(url, headers=headers, timeout=15)

            if res.status_code == 429:
                body = res.json()
                wait = body.get("retryAfter", 60)
                print(f"  > Rate limit hit. Waiting {wait}s...")
                time.sleep(wait + 1)  # +1s buffer
                continue  # Retry the same item

            if res.status_code == 404:
                # Item exists in items.json but is not a bazaar item (e.g. Crystallized Heart)
                print(f"  > '{item_id}' is not a bazaar item, skipping.")
                return None

            if res.status_code == 200:
                data = res.json()
                sells = data.get("sellTopEntries", [])
                if not sells:
                    return None
                raw_price = sells[0].get("price", 0)
                return round(raw_price)  # Standard rounding: >=.5 rounds up, <.5 rounds down

            print(f"  > Unexpected status {res.status_code} for {item_id}, skipping.")
            return None

        except Exception as e:
            print(f"  > Error fetching {item_id}: {e}")
            return None

def main():
    try:
        with open("Minion_recipes/items.json", "r") as f:
            items_data = json.load(f)

        items = [e["id"] for e in items_data if "id" in e]

        new_prices = {}
        skipped = []
        total = len(items)
        print(f"\nFetching prices for {total} items...")

        for i, item_id in enumerate(items, 1):
            print(f"[{i}/{total}] {item_id}")
            price = get_best_buy_price(item_id)

            if price is None:
                # Not a bazaar item or failed to load — skip entirely,
                # don't write a 0 that could mislead the calculator
                skipped.append(item_id)
            else:
                new_prices[item_id] = price

            time.sleep(0.5)  # Base delay between requests

        print(f"\nUploading {len(new_prices)} prices to Firestore...")
        price_doc_ref.set(new_prices)
        print("✅ Successfully updated 'prices/itemsV2'!")

        if skipped:
            print(f"\nSkipped {len(skipped)} non-bazaar or failed items:")
            for s in skipped:
                print(f"  - {s}")

    except FileNotFoundError as e:
        print(f"Error: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()
