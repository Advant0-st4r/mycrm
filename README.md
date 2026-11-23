# Krave Qatar delivery integrations

## Secrets

Set `APIFY_TOKEN` and `RAPIDAPI_KEY` as server-side environment variables in the Vercel project. Do not prefix either variable with `NEXT_PUBLIC_`. `.env.example` lists the required names without values.

## Talabat Qatar batch client

This uses the Apify Python client with the `lentic_clockss/talabat-scraper` actor. It starts with area discovery, then a one-area proof of concept; it does not launch a full-country scrape by default. The first discovery run showed that this community actor ignores `maxTotalChargeUsd`, so the client caps `maxResults` locally using the supplied estimate of $0.003 per row. This is an estimated row budget, not a guaranteed bill ceiling if the actor separately charges for enrichment.

```bash
python -m pip install -r requirements.txt
python scripts/talabat_scraper.py discover --max-charge-usd 0.50
python scripts/talabat_scraper.py area --area-id AREA_ID --area-slug AREA_SLUG --max-results 20 --max-enrich 5 --max-charge-usd 0.50
```

Use the `areas` array from `talabat-qatar-areas.json` for the area IDs and slugs. The area run writes a JSON file containing grouped `places` and `raw_rows`; import that JSON in the Qatar Delivery Platforms panel. Each run has an explicit maximum actor charge. The community actor is unverified, so manually check its area list and several restaurant URLs before scaling. Full coverage should be a separate, deliberate run with an adjusted budget.

## Ninja Saudi Arabia

When the Delivery Platforms country is set to Saudi Arabia, the UI calls `/api/ninja`. Enter a path documented by the RapidAPI listing and a JSON object of query parameters. The route fixes the upstream host, keeps `RAPIDAPI_KEY` server-side, times out after 15 seconds, forwards upstream status errors, and caches successful responses in memory for 60 seconds per runtime instance. The in-memory cache is best-effort on serverless deployments; it is not shared between instances.

The RapidAPI listing's endpoint schema is not included in this repository, so the UI intentionally accepts the endpoint path and parameter names instead of guessing them. Imported Talabat rows currently use the existing browser-local IndexedDB store, not the Neon tables.
