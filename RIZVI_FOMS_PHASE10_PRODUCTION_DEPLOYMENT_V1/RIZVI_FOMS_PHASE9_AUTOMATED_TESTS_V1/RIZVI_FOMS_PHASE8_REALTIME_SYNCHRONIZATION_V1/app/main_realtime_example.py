# Integration example for FastAPI application
from fastapi import WebSocket, WebSocketDisconnect
from .realtime import hub

async def websocket_dashboard(channel:str, websocket:WebSocket):
    await hub.connect(channel,websocket)
    try:
        while True:
            await websocket.receive_text()  # heartbeat/client signal
    except WebSocketDisconnect:
        hub.disconnect(channel,websocket)
