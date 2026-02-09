"""
One-off script to populate audio URLs for episodes that are missing them.
Fetches RSS feeds and matches episodes by slug (GUID) or title, then PATCHes
the production API to set ad_supported_audio_url.

Usage:
  python scripts/sync_audio_urls.py <AUTH_TOKEN>

  Get your auth token from browser DevTools:
    Application > Local Storage > localhost:5178 > django_access_token
"""

import sys
import xml.etree.ElementTree as ET
import requests

API_BASE = "https://backend.eeriecasts.bitbenders.com/api"

# RSS feeds to sync — add more here as needed
FEEDS = [
    "https://feeds.transistor.fm/drakenblud-the-malformed-king-u0c2eae103b525a6a",
]


def parse_rss_episodes(feed_url):
    """Fetch an RSS feed and extract episode slug (GUID) → audio URL mappings."""
    resp = requests.get(feed_url, timeout=20)
    resp.raise_for_status()
    root = ET.fromstring(resp.content)

    episodes = []
    for item in root.iter("item"):
        title = item.findtext("title", "").strip()
        guid = item.findtext("guid", "").strip()
        enclosure = item.find("enclosure")
        audio_url = enclosure.get("url", "") if enclosure is not None else ""
        if title and audio_url:
            episodes.append({"title": title, "guid": guid, "audio_url": audio_url})
    return episodes


def get_api_podcasts(token):
    """Fetch all podcasts from the API."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    resp = requests.get(f"{API_BASE}/podcasts/", headers=headers, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    return data.get("results", data) if isinstance(data, dict) else data


def patch_episode(episode_id, audio_url, token):
    """PATCH an episode to set its ad_supported_audio_url."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {"ad_supported_audio_url": audio_url}
    resp = requests.patch(
        f"{API_BASE}/episodes/{episode_id}/",
        json=payload,
        headers=headers,
        timeout=10,
    )
    return resp.status_code, resp.text


def sync_feed(feed_url, token):
    """Sync a single RSS feed's audio URLs into the API."""
    print(f"\n{'='*60}")
    print(f"Syncing: {feed_url}")
    print(f"{'='*60}")

    rss_episodes = parse_rss_episodes(feed_url)
    print(f"  RSS episodes found: {len(rss_episodes)}")

    if not rss_episodes:
        print("  No episodes in feed, skipping.")
        return

    # Get all podcasts and their episodes from the API
    podcasts = get_api_podcasts(token)

    # Build lookup: slug → (episode_id, title, current_audio_url)
    #   and title_lower → (episode_id, slug, current_audio_url)
    slug_map = {}   # slug → {id, title, audio_url}
    title_map = {}  # lowercase title → {id, slug, audio_url}
    for podcast in podcasts:
        for ep in podcast.get("episodes", []):
            slug_map[ep.get("slug", "")] = ep
            title_map[ep.get("title", "").lower().strip()] = ep

    updated = 0
    skipped = 0
    not_found = 0

    for rss_ep in rss_episodes:
        # Try matching by GUID (slug) first, then by title
        match = slug_map.get(rss_ep["guid"])
        if not match:
            match = title_map.get(rss_ep["title"].lower().strip())

        if not match:
            print(f"  NOT FOUND: '{rss_ep['title']}' (guid={rss_ep['guid']})")
            not_found += 1
            continue

        # Skip if episode already has an audio URL
        if match.get("audio_url"):
            skipped += 1
            continue

        # PATCH the episode
        ep_id = match["id"]
        status, body = patch_episode(ep_id, rss_ep["audio_url"], token)
        if 200 <= status < 300:
            print(f"  UPDATED: id={ep_id} '{rss_ep['title']}' -> {rss_ep['audio_url'][:60]}...")
            updated += 1
        else:
            print(f"  FAILED:  id={ep_id} '{rss_ep['title']}' HTTP {status}: {body[:120]}")

    print(f"\n  Summary: {updated} updated, {skipped} already had audio, {not_found} not found in DB")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("ERROR: Please provide your auth token as the first argument.")
        print("  Get it from: browser DevTools > Application > Local Storage > django_access_token")
        sys.exit(1)

    token = sys.argv[1].strip()
    print(f"Using token: {token[:10]}...{token[-4:]}")

    for feed_url in FEEDS:
        sync_feed(feed_url, token)

    print("\nDone!")


if __name__ == "__main__":
    main()
