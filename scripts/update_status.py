#!/usr/bin/env python3
"""
Update report status on the cloud server after local processing.

Usage:
    # Mark a single report as completed
    python update_status.py --server URL --id sov_germany --status completed

    # Mark multiple reports
    python update_status.py --server URL --batch '[{"id": "sov_germany", "status": "completed"}]'

    # Check work queue
    python update_status.py --server URL --work-queue

    # Show summary
    python update_status.py --server URL --summary
"""

import argparse
import json
import os
import sys

try:
    import requests
except ImportError:
    print("Please install requests: pip install requests")
    sys.exit(1)


DEFAULT_SERVER = os.environ.get(
    "SOV_SYNC_SERVER",
    "https://sov-quasi-list-production.up.railway.app"
)


def update_single(server: str, report_id: str, status: str) -> bool:
    """Update a single report's status."""
    try:
        response = requests.patch(
            f"{server}/api/reports/{report_id}/status",
            json={"status": status},
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        print(f"Updated {report_id} -> {status}")
        return True
    except requests.RequestException as e:
        print(f"Failed to update {report_id}: {e}")
        return False


def update_batch(server: str, updates: list) -> int:
    """Update multiple reports at once."""
    try:
        response = requests.post(
            f"{server}/api/reports/batch-status",
            json={"updates": updates},
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        print(f"Updated {result.get('updated', 0)} reports")
        return result.get('updated', 0)
    except requests.RequestException as e:
        print(f"Batch update failed: {e}")
        return 0


def show_work_queue(server: str):
    """Display the current work queue."""
    try:
        response = requests.get(f"{server}/api/work-queue", timeout=30)
        response.raise_for_status()
        data = response.json()

        print("\n" + "=" * 50)
        print("  Work Queue")
        print("=" * 50)

        summary = data.get("summary", {})
        print(f"\n  Needs Research: {summary.get('needsResearch', 0)}")
        print(f"  Needs Update:   {summary.get('needsUpdate', 0)}")
        print(f"  Raw Uploaded:   {summary.get('rawUploaded', 0)}")
        print(f"  Pending Sync:   {summary.get('pendingSync', 0)}")

        needs_research = data.get("needsResearch", [])
        if needs_research:
            print("\n  Countries needing research:")
            for r in needs_research:
                print(f"    - {r['name']} ({r['id']})")

        needs_update = data.get("needsUpdate", [])
        if needs_update:
            print("\n  Reports needing update:")
            for r in needs_update:
                print(f"    - {r['name']} ({r['id']})")

        print()

    except requests.RequestException as e:
        print(f"Failed to fetch work queue: {e}")


def show_summary(server: str):
    """Display overall status summary."""
    try:
        response = requests.get(f"{server}/api/work-queue/summary", timeout=30)
        response.raise_for_status()
        data = response.json()

        print("\n" + "=" * 50)
        print("  Status Summary")
        print("=" * 50)

        reports = data.get("reports", {})
        print(f"\n  Total Reports: {reports.get('total', 0)}")
        print("  By Status:")
        for status, count in reports.get("byStatus", {}).items():
            print(f"    {status}: {count}")

        uploads = data.get("uploads", {})
        if uploads.get("total", 0) > 0:
            print(f"\n  Total Uploads: {uploads.get('total', 0)}")
            print("  By Sync Status:")
            for status, count in uploads.get("bySyncStatus", {}).items():
                print(f"    {status}: {count}")

        print()

    except requests.RequestException as e:
        print(f"Failed to fetch summary: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Update report status on cloud server"
    )
    parser.add_argument(
        "--server", "-s",
        default=DEFAULT_SERVER,
        help=f"Server URL (default: {DEFAULT_SERVER})"
    )
    parser.add_argument(
        "--id",
        help="Report ID to update"
    )
    parser.add_argument(
        "--status",
        choices=["needs-research", "raw-uploaded", "in-progress", "completed", "needs-update"],
        help="New status for the report"
    )
    parser.add_argument(
        "--batch",
        help='JSON array of updates: [{"id": "...", "status": "..."}]'
    )
    parser.add_argument(
        "--work-queue", "-w",
        action="store_true",
        help="Show work queue (what needs attention)"
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Show status summary"
    )

    args = parser.parse_args()

    if args.work_queue:
        show_work_queue(args.server)
    elif args.summary:
        show_summary(args.server)
    elif args.batch:
        updates = json.loads(args.batch)
        update_batch(args.server, updates)
    elif args.id and args.status:
        update_single(args.server, args.id, args.status)
    else:
        # Default: show work queue
        show_work_queue(args.server)


if __name__ == "__main__":
    main()
