import hashlib
from pathlib import Path

DEFAULT_MAX_BYTES = 1024 * 1024 * 1024  # 1 GiB policy default; configure in production

def sha256_file(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()

def validate_upload(path, max_bytes=DEFAULT_MAX_BYTES):
    p=Path(path)
    if not p.exists() or not p.is_file():
        raise ValueError('Upload target is not a file')
    size=p.stat().st_size
    if size>max_bytes:
        raise ValueError('File exceeds configured size limit')
    return {'filename':p.name,'size_bytes':size,'sha256':sha256_file(p)}

def classify_asset(media_type, filename):
    mt=(media_type or '').lower()
    ext=Path(filename).suffix.lower()
    if mt.startswith('audio/') or ext in {'.wav','.mp3','.m4a','.ogg','.aac'}: return 'VOICE'
    if mt.startswith('video/') or ext in {'.mp4','.mov','.mkv','.webm','.avi'}: return 'VIDEO'
    if mt.startswith('image/') or ext in {'.png','.jpg','.jpeg','.webp'}: return 'IMAGE'
    if mt: return 'DOCUMENT'
    return 'OTHER'
