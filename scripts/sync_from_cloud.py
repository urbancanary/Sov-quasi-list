#!/usr/bin/env python3
"""
Sync raw reports from cloud MCP server to local Mac for processing.

Usage:
    python sync_from_cloud.py [--server URL] [--output-dir PATH]

Example:
    python sync_from_cloud.py --server https://sov-quasi-list.up.railway.app
"""

import argparse
import json
import os
import sys
from pathlib import Path
from datetime import datetime

try:
    import requests
except ImportError:
    print("Please install requests: pip install requests")
    sys.exit(1)


# Default configuration
DEFAULT_SERVER = "http://localhost:3000"
DEFAULT_OUTPUT_DIR = "/Users/andyseaman/Notebooks/sovereign-credit-system/credit_reports/raw_reports"


def sync_from_cloud(server_url: str, output_dir: str, dry_run: bool = False) -> dict:
    """
    Sync pending files from cloud server to local directory.

    Returns dict with sync results.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    results = {
        "server": server_url,
        "output_dir": str(output_path),
        "timestamp": datetime.now().isoformat(),
        "downloaded": [],
        "failed": [],
        "already_exists": [],
    }

    # Get pending files
    print(f"\n{'='*50}")
    print("  Sovereign Reports Sync")
    print(f"{'='*50}")
    print(f"\nServer: {server_url}")
    print(f"Target: {output_path}\n")

    try:
        response = requests.get(f"{server_url}/api/sync/pending", timeout=30)
        response.raise_for_status()
        pending = response.json()
    except requests.RequestException as e:
        print(f"❌ Failed to connect to server: {e}")
        return results

    pending_count = pending.get("count", 0)
    pending_files = pending.get("files", [])

    if pending_count == 0:
        print("✅ No files pending sync")
        return results

    print(f"📥 Found {pending_count} file(s) to sync\n")

    if dry_run:
        print("DRY RUN - would download:")
        for f in pending_files:
            print(f"  - {f['originalName']} ({f['size']} bytes)")
        return results

    synced_filenames = []

    for file_info in pending_files:
        filename = file_info["filename"]
        original_name = file_info["originalName"]
        size = file_info["size"]

        target_path = output_path / original_name

        # Check if file already exists
        if target_path.exists():
            print(f"⏭️  Skipping {original_name} (already exists)")
            results["already_exists"].append(original_name)
            synced_filenames.append(filename)  # Still mark as synced
            continue

        print(f"📄 Downloading: {original_name} ({size} bytes)")

        try:
            dl_response = requests.get(
                f"{server_url}/api/sync/download/{filename}",
                timeout=60
            )
            dl_response.raise_for_status()

            # Save file
            target_path.write_bytes(dl_response.content)
            print(f"   ✅ Saved to {target_path}")

            results["downloaded"].append({
                "filename": filename,
                "original_name": original_name,
                "path": str(target_path),
                "size": len(dl_response.content),
            })
            synced_filenames.append(filename)

        except requests.RequestException as e:
            print(f"   ❌ Failed: {e}")
            results["failed"].append({
                "filename": filename,
                "original_name": original_name,
                "error": str(e),
            })

    # Mark files as synced
    if synced_filenames:
        print(f"\n📝 Marking {len(synced_filenames)} file(s) as synced...")
        try:
            mark_response = requests.post(
                f"{server_url}/api/sync/mark-synced",
                json={"filenames": synced_filenames},
                timeout=30
            )
            mark_response.raise_for_status()
            mark_result = mark_response.json()
            print(f"   ✅ {mark_result.get('message', 'Done')}")
        except requests.RequestException as e:
            print(f"   ⚠️ Warning: Failed to mark as synced: {e}")

    # Print summary
    print(f"\n{'='*50}")
    print("  Sync Complete")
    print(f"{'='*50}")
    print(f"\n  Downloaded: {len(results['downloaded'])}")
    print(f"  Skipped:    {len(results['already_exists'])}")
    print(f"  Failed:     {len(results['failed'])}")

    # Show server status
    try:
        status_response = requests.get(f"{server_url}/api/sync/status", timeout=10)
        if status_response.ok:
            status = status_response.json()
            summary = status.get("summary", {})
            print(f"\n  Server Status:")
            print(f"    Pending:    {summary.get('pendingSync', 0)}")
            print(f"    Synced:     {summary.get('synced', 0)}")
            print(f"    Processing: {summary.get('processing', 0)}")
            print(f"    Processed:  {summary.get('processed', 0)}")
    except:
        pass

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Sync raw reports from cloud MCP server to local Mac"
    )
    parser.add_argument(
        "--server", "-s",
        default=os.environ.get("SOV_SYNC_SERVER", DEFAULT_SERVER),
        help=f"Server URL (default: {DEFAULT_SERVER})"
    )
    parser.add_argument(
        "--output-dir", "-o",
        default=os.environ.get("RAW_REPORTS_DIR", DEFAULT_OUTPUT_DIR),
        help=f"Output directory (default: {DEFAULT_OUTPUT_DIR})"
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Show what would be downloaded without actually downloading"
    )

    args = parser.parse_args()

    results = sync_from_cloud(
        server_url=args.server,
        output_dir=args.output_dir,
        dry_run=args.dry_run,
    )

    # Exit with error code if any downloads failed
    if results["failed"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
