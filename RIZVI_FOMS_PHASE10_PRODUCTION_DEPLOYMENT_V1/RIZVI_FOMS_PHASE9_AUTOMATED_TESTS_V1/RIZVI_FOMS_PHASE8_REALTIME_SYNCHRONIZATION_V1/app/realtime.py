import asyncio
from collections import defaultdict
from datetime import datetime

class RealtimeHub:
    def __init__(self):
        self.channels=defaultdict(set)

    async def connect(self, channel, websocket):
        await websocket.accept()
        self.channels[channel].add(websocket)

    def disconnect(self, channel, websocket):
        self.channels[channel].discard(websocket)

    async def publish(self, channel, event):
        dead=[]
        for ws in list(self.channels[channel]):
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(channel,ws)

hub=RealtimeHub()

def event_envelope(event_type, aggregate_type, aggregate_id, payload):
    return {
        "event_type":event_type,
        "aggregate_type":aggregate_type,
        "aggregate_id":str(aggregate_id),
        "payload":payload,
        "occurred_at":datetime.utcnow().isoformat()+"Z"
    }

class IdempotencyStore:
    def __init__(self): self._seen=set()
    def accept_once(self, consumer_name, event_id):
        key=(consumer_name,str(event_id))
        if key in self._seen: return False
        self._seen.add(key); return True
