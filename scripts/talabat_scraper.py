#!/usr/bin/env python3
"""Estimated-budget Talabat Qatar area discovery and listing runner."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from apify_client import ApifyClient

ACTOR_ID = "lentic_clockss/talabat-scraper"
COUNTRY = "qatar"
ESTIMATED_COST_PER_ROW_USD = 0.003


def _first(row: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = row.get(key)
        if value not in (None, ""):
            return value
    return None


def _as_float(value: Any) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _place_id(key: str) -> str:
    return "talabat:" + hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]


def _group_places(rows: list[dict[str, Any]], area_slug: str) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        restaurant_id = _first(row, "restaurantId", "restaurant_id", "brandId", "brand_id")
        branch_id = _first(row, "branchId", "branch_id")
        url = _first(row, "url", "website")
        name = _first(row, "name", "restaurantName", "brandName", "title")
        identity = (
            f"{restaurant_id}:{branch_id}"
            if restaurant_id and branch_id
            else str(restaurant_id or branch_id or url or f"{name or 'unknown'}:{area_slug}")
        )
        place = grouped.setdefault(
            identity,
            {
                "id": _place_id(f"{identity}:{branch_id or ''}"),
                "name_en": str(name or "Talabat restaurant"),
                "addr_area": str(_first(row, "area", "areaName", "areaSlug") or area_slug),
                "delivery_platforms": ["Talabat"],
                "talabat_listed": True,
                "talabat_source_url": str(url) if url else None,
                "source": "talabat",
                "source_url": str(url) if url else None,
                "_mask_version": 0,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "talabat_offers": [],
            },
        )

        if name and place["name_en"] == "Talabat restaurant":
            place["name_en"] = str(name)
        if url:
            place["talabat_source_url"] = str(url)
            place["source_url"] = str(url)
        rating = _as_float(_first(row, "rate", "rating"))
        if rating is not None:
            place["talabat_rating"] = rating
            place["rating"] = rating
        delivery_fee = _first(row, "deliveryFee", "delivery_fee")
        if delivery_fee is not None:
            place["talabat_delivery_fee"] = delivery_fee
        minimum_order = _first(row, "minimumOrderAmount", "minimum_order_amount")
        if minimum_order is not None:
            place["talabat_min_order"] = minimum_order
        cuisine = _first(row, "cuisineString", "cuisine", "category")
        if cuisine and isinstance(cuisine, str):
            place["primary_type_display"] = cuisine

        offer = _first(row, "promotionTitle", "offerTitle", "promotion", "offer", "promotionDescription")
        if offer:
            offers = place["talabat_offers"]
            offer_text = str(offer).strip()
            if offer_text and offer_text not in offers:
                offers.append(offer_text)

    return list(grouped.values())


def _run(client: ApifyClient, args: argparse.Namespace) -> dict[str, Any]:
    estimated_row_limit = math.floor(args.max_charge_usd / ESTIMATED_COST_PER_ROW_USD)
    if estimated_row_limit < 1:
        raise ValueError(f"--max-charge-usd must be at least ${ESTIMATED_COST_PER_ROW_USD:.3f} for one estimated row.")

    if args.mode == "discover":
        run_input: dict[str, Any] = {
            "mode": "discoverAreas",
            "country": COUNTRY,
            "maxResults": min(500, estimated_row_limit),
        }
    else:
        if not args.area_id or not args.area_slug:
            raise ValueError("Area runs require both --area-id and --area-slug from discovery output.")
        run_input = {
            "mode": "area",
            "country": COUNTRY,
            "areaId": args.area_id,
            "areaSlug": args.area_slug,
            "maxResults": min(args.max_results, estimated_row_limit),
            "fetchAllPages": True,
            "maxPages": args.max_pages,
            "enrichDetails": True,
            "maxEnrich": args.max_enrich,
            "includePromotions": args.include_promotions,
            "filters": [],
            "sort": "rating",
        }

    run = client.actor(ACTOR_ID).call(run_input=run_input)
    if not run:
        raise RuntimeError("Apify returned no run metadata.")
    status = run.get("status")
    if status != "SUCCEEDED":
        raise RuntimeError(f"Talabat actor finished with status {status or 'unknown'} (run {run.get('id', 'unknown')}).")
    dataset_id = run.get("defaultDatasetId")
    if not dataset_id:
        raise RuntimeError(f"Talabat actor run {run.get('id', 'unknown')} has no output dataset.")

    rows = list(client.dataset(dataset_id).iterate_items())
    error_rows = [row for row in rows if str(row.get("type", "")).upper() == "ERROR_SUMMARY"]
    if error_rows:
        raise RuntimeError(f"Talabat actor reported ERROR_SUMMARY: {json.dumps(error_rows[:2], ensure_ascii=False)}")
    if not rows:
        raise RuntimeError(f"Talabat actor run {run.get('id')} succeeded with an empty dataset; refusing to report a successful scrape.")

    output: dict[str, Any] = {
        "run_id": run.get("id"),
        "status": status,
        "country": COUNTRY,
        "budget": {
            "max_charge_usd": args.max_charge_usd,
            "estimated_cost_per_row_usd": ESTIMATED_COST_PER_ROW_USD,
            "requested_max_results": run_input["maxResults"],
            "estimated_cost_at_row_limit_usd": round(run_input["maxResults"] * ESTIMATED_COST_PER_ROW_USD, 3),
        },
        "raw_rows": rows,
    }
    if args.mode == "discover":
        output["areas"] = rows
    else:
        output["area"] = {"id": args.area_id, "slug": args.area_slug}
        output["places"] = _group_places(rows, args.area_slug)
    return output


def _output_path(args: argparse.Namespace) -> Path:
    if args.output:
        return Path(args.output)
    if args.mode == "discover":
        return Path("talabat-qatar-areas.json")
    return Path(f"talabat-qatar-{args.area_slug}.json")


def main() -> int:
    parser = argparse.ArgumentParser(description="Discover Talabat Qatar areas or scrape one area.")
    parser.add_argument("mode", choices=("discover", "area"))
    parser.add_argument("--area-id")
    parser.add_argument("--area-slug")
    parser.add_argument("--max-results", type=int, default=20, help="Rows for the first POC run; default 20.")
    parser.add_argument("--max-pages", type=int, default=10)
    parser.add_argument("--max-enrich", type=int, default=5)
    parser.add_argument(
        "--max-charge-usd",
        type=float,
        default=0.50,
        help="Estimated $0.003/row budget; locally caps requested rows, not a provider-enforced bill ceiling.",
    )
    parser.add_argument("--include-promotions", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--output", help="Output JSON path. Defaults to a Qatar-specific file in the current directory.")
    args = parser.parse_args()

    token = os.environ.get("APIFY_TOKEN")
    if not token:
        print("APIFY_TOKEN is not set; no actor run was started.", file=sys.stderr)
        return 2
    if args.max_charge_usd < ESTIMATED_COST_PER_ROW_USD:
        print(f"--max-charge-usd must be at least ${ESTIMATED_COST_PER_ROW_USD:.3f} for one estimated row.", file=sys.stderr)
        return 2
    if args.mode == "area" and (not args.area_id or not args.area_slug):
        print("Area runs require --area-id and --area-slug from discovery output.", file=sys.stderr)
        return 2
    if args.mode == "area" and (args.max_results < 1 or args.max_pages < 1 or args.max_enrich < 0):
        print("Area result/page limits must be positive and --max-enrich cannot be negative.", file=sys.stderr)
        return 2

    try:
        result = _run(ApifyClient(token), args)
        output_path = _output_path(args)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        count = len(result.get("areas", result.get("places", [])))
        print(f"Talabat {args.mode} succeeded: {count} {('areas' if args.mode == 'discover' else 'grouped restaurants')}; output={output_path}; run_id={result['run_id']}")
        return 0
    except Exception as error:
        print(f"Talabat {args.mode} failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
