# Production synchronization worker contract:
#
# Transaction:
#   1. Write business state.
#   2. Insert corresponding event_outbox row in same database transaction.
#
# Publisher:
#   3. Lock/select pending outbox events.
#   4. Publish to configured durable event transport.
#   5. Mark published only after confirmed publish.
#   6. Retry transient failures with backoff.
#   7. Move exhausted failures to DEAD_LETTER.
#
# Consumer:
#   8. Insert/check event_inbox by (consumer_name,event_id).
#   9. Process each event idempotently.
#  10. Update affected dashboard/cache/read model.
#  11. Push authorized changes to WebSocket/SSE subscribers.
#
# Database outbox/inbox provides reliable recovery; WebSocket is delivery
# acceleration, not the source of truth.
