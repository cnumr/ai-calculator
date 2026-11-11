#!/usr/bin/env python3
"""Load test of the API: requests per second (TPS) and latencies by load step.

Runs, for each concurrency level, N clients that send requests back to back
(closed loop, keep-alive) for a fixed duration, then prints the throughput,
the latency percentiles and the errors of each step. The supported TPS is the
throughput of the last step whose p95 stays under --p95-max with no error.

Standard library only (no dependency to install). Meant to target a backend
started with low resources, see docs/LOAD_TEST.md:

  scripts/load_test.py --base-url http://localhost:8001
  scripts/load_test.py --endpoint use-cases --concurrency 1,4,16
"""

import argparse
import http.client
import json
import statistics
import threading
import time
from urllib.parse import urlsplit


def build_scenario(base_url: str) -> bytes:
    """A realistic POST /api/calculate body: every use case of the catalogue,
    used once a day with its default provider and profile, 50 employees."""
    status, body = request(connect(base_url), "GET", "/api/use-cases")
    if status != 200:
        raise SystemExit(f"GET /api/use-cases returned {status}")
    catalogue = json.loads(body)
    usages = [
        {
            "kind": uc["kind"],
            "use_case_id": uc["id"],
            "provider_id": uc["default_provider"],
            "profile_id": uc["recommended_tier"],
            "frequency": 1,
        }
        for uc in catalogue["use_cases"]
    ]
    return json.dumps({"usages": usages, "headcount": 50}).encode()


def connect(base_url: str) -> http.client.HTTPConnection:
    url = urlsplit(base_url)
    factory = http.client.HTTPSConnection if url.scheme == "https" else http.client.HTTPConnection
    return factory(url.hostname, url.port, timeout=30)


def request(conn, method, path, body=None):
    headers = {"Accept-Encoding": "gzip"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    conn.request(method, path, body=body, headers=headers)
    response = conn.getresponse()
    return response.status, response.read()


def run_step(base_url, method, path, body, concurrency, duration):
    """Latencies (s) of the successful requests and the error count."""
    latencies: list[float] = []
    errors = 0
    lock = threading.Lock()
    deadline = time.monotonic() + duration

    def client():
        nonlocal errors
        conn = connect(base_url)
        local, failed = [], 0
        while time.monotonic() < deadline:
            start = time.perf_counter()
            try:
                status, _ = request(conn, method, path, body)
                ok = status == 200
            except (OSError, http.client.HTTPException):
                ok = False
                conn.close()
                conn = connect(base_url)
            if ok:
                local.append(time.perf_counter() - start)
            else:
                failed += 1
        conn.close()
        with lock:
            latencies.extend(local)
            errors += failed

    threads = [threading.Thread(target=client) for _ in range(concurrency)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    return latencies, errors


def percentile(values, q):
    return statistics.quantiles(values, n=100)[q - 1] if len(values) > 1 else values[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base-url", default="http://localhost:8001")
    parser.add_argument("--endpoint", choices=["calculate", "use-cases"], default="calculate")
    parser.add_argument("--concurrency", default="1,2,4,8,16", help="clients per step")
    parser.add_argument("--duration", type=float, default=20, help="seconds per step")
    parser.add_argument("--p95-max", type=float, default=1000, help="acceptable p95 (ms)")
    args = parser.parse_args()

    if args.endpoint == "calculate":
        method, path, body = "POST", "/api/calculate", build_scenario(args.base_url)
    else:
        method, path, body = "GET", "/api/use-cases", None

    print(f"{method} {args.base_url}{path} - {args.duration:g} s per step, p95 max {args.p95_max:g} ms")
    print(f"{'clients':>7} {'requests':>8} {'TPS':>7} {'p50 ms':>7} {'p95 ms':>7} {'p99 ms':>7} {'errors':>6}")
    supported = None
    for concurrency in (int(c) for c in args.concurrency.split(",")):
        latencies, errors = run_step(
            args.base_url, method, path, body, concurrency, args.duration
        )
        if not latencies:
            print(f"{concurrency:>7} {0:>8} {'-':>7} {'-':>7} {'-':>7} {'-':>7} {errors:>6}")
            break
        tps = len(latencies) / args.duration
        p50, p95, p99 = (percentile(latencies, q) * 1000 for q in (50, 95, 99))
        print(
            f"{concurrency:>7} {len(latencies):>8} {tps:>7.1f} {p50:>7.0f} {p95:>7.0f} {p99:>7.0f} {errors:>6}"
        )
        if errors == 0 and p95 <= args.p95_max:
            supported = (tps, concurrency, p95)
        else:
            break  # saturated: higher steps would only queue more

    if supported:
        tps, concurrency, p95 = supported
        print(f"\nSupported: ~{tps:.1f} TPS ({concurrency} clients, p95 {p95:.0f} ms, no error).")
    else:
        print("\nNo step met the p95 target without error.")


if __name__ == "__main__":
    main()
