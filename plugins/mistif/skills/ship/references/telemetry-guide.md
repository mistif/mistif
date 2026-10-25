# Telemetry guide

## Log line fields
`time`, `level`, `event` (a stable name like `order.payment_failed`), `correlation_id`, `entry_point` (when several feed one sink), and the few fields needed to act on it. No secrets, no personal data; list the allowed fields instead of dumping objects.

## Metrics
- Per endpoint and per dependency: request rate, error rate, duration (p50, p95, p99).
- Per resource: how full it is (CPU, memory, queue depth, connections).
- Labels: route template, status class, dependency name. Never user ids, full URLs or message text.

## Alert skeleton
```
Name: what the user feels (e.g. "checkout errors above 2% for 10 min")
Severity: page | ticket
Why this number: the baseline and the reasoning
Runbook: link
```
Only two severities. If nobody can act on an alert, delete it.

## Runbook skeleton
- What this alert means.
- The first thing to check.
- How to escalate, and to whom.
- Update this page after each use.

## Proving it works
Cause a failure on purpose in a test environment and find it using only the telemetry. Fire each alert once; get a yes before it can page a real person.
