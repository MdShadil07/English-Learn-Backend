# Service Level Objectives (SLOs)

This document formally defines the reliability and performance targets for the English Practice WebRTC / SFU infrastructure. These targets must be measured and monitored continuously in production.

## Metrics & Targets

| Metric | Target | Description | Remediation if Breached |
|--------|--------|-------------|-------------------------|
| **Join success** | 99.9% | Percentage of valid requests to join a room that succeed within 5 seconds. | Investigate Redis rate limiter (`hotRoomProtectionService`) and Mediasoup worker capacity. Scale up SFU nodes. |
| **Reconnect success** | 99% | Percentage of dropped connections that successfully re-establish via ICE restart or Consumer recreation. | Review DTLS timeout configurations and client-side `socket.io` reconnect settings. |
| **Packet loss** | <2% | Average RTP packet loss rate across all active consumers. | Trigger Graceful Degradation (force lower simulcast layers). Check network backbone health. |
| **Speaker switch latency** | <500ms | Time elapsed between an active speaker change event and the video router switching streams. | Optimize `setDominantSpeaker` socket handler. Ensure Node event loop is not blocked. |
| **p95 RTT** | <150ms | 95th percentile Round Trip Time (latency) for media packets. | Deploy Edge SFU nodes closer to users. Evaluate TURN server geographic distribution. |

## Monitoring Implementation

To enforce these SLOs, the following data points must be aggregated into a time-series database (e.g., Prometheus, Datadog):
1. **Mediasoup Stats**: Periodically poll `transport.getStats()` and `consumer.getStats()` to measure Packet Loss and RTT.
2. **Socket.io Metrics**: Track connection times and error rates via socket middleware to measure Join/Reconnect success.
3. **Application Logs**: Emit structured logs (JSON) when `setDominantSpeaker` is called to calculate latency percentiles.

## Incident Response

If an SLO is breached for a sustained period (e.g., 5 minutes):
1. The **Graceful Degradation Engine** will automatically engage to protect node integrity (disabling new publishes).
2. Alerts will fire via PagerDuty / Slack to the engineering on-call team.
3. Temporary scaling (auto-scaling groups) will provision additional SFU instances.
