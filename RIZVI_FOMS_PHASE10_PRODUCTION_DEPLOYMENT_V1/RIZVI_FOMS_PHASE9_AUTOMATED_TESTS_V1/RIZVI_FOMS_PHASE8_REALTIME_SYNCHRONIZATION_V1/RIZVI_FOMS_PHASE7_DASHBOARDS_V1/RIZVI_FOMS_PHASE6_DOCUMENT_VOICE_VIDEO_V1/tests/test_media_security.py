from pathlib import Path
from app.media_security import classify_asset,validate_upload
def test_classification():
    assert classify_asset('audio/mpeg','x.mp3')=='VOICE'
    assert classify_asset('video/mp4','x.mp4')=='VIDEO'
    assert classify_asset('application/pdf','x.pdf')=='DOCUMENT'
def test_integrity(tmp_path):
    p=tmp_path/'test.txt';p.write_text('rizvi')
    result=validate_upload(p,max_bytes=100)
    assert len(result['sha256'])==64
    assert result['size_bytes']==5
