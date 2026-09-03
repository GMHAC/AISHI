# Real-time dashboard contract
# Publish events after committed database transactions:
# work_item.changed
# checklist.changed
# kpi.measurement.created
# audit.finding.changed
# nc.changed
# capa.changed
# media_asset.changed
# management_message.created
#
# A dashboard gateway subscribes to the enterprise outbox/event stream,
# recalculates affected scope aggregates and pushes updates by WebSocket/SSE.
# Target refresh requirement: clients receive/pull fresh dashboard state
# within approximately 3 seconds under healthy infrastructure.
