const express = require('express');
const crypto = require('crypto');
const { Storage } = require('@google-cloud/storage');
const { PubSub } = require('@google-cloud/pubsub');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const bucketName = process.env.GCS_BUCKET;
const topicName = process.env.PUBSUB_DOCUMENT_TOPIC || 'rizvi-document-ingest';
const storage = bucketName ? new Storage() : null;
const pubsub = process.env.GOOGLE_CLOUD_PROJECT ? new PubSub({ projectId: process.env.GOOGLE_CLOUD_PROJECT }) : null;

function cleanName(name='file') {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'file';
}
function requireCloud(res) {
  if (!bucketName || !storage) {
    res.status(503).json({ error: 'Document storage is not configured. Set GCS_BUCKET and Google Cloud credentials.' });
    return false;
  }
  return true;
}

// Direct-to-object-storage upload. The application server never receives the file bytes.
router.post('/initiate', async (req, res) => {
  try {
    if (!requireCloud(res)) return;
    const { file_name, content_type, size_bytes, sha256, module, department, section, designation } = req.body || {};
    if (!file_name || !content_type) return res.status(400).json({ error: 'file_name and content_type are required' });
    const size = Number(size_bytes || 0);
    const max = Number(process.env.MAX_UPLOAD_BYTES || 5368709120); // 5 GiB default policy
    if (!Number.isFinite(size) || size < 0 || size > max) return res.status(413).json({ error: `File exceeds configured limit (${max} bytes)` });

    const id = crypto.randomUUID();
    const objectName = `documents/${new Date().toISOString().slice(0,10)}/${req.user.employee_code || req.user.id}/${id}-${cleanName(file_name)}`;
    const [url] = await storage.bucket(bucketName).file(objectName).getSignedUrl({
      version: 'v4', action: 'write', expires: Date.now() + Number(process.env.SIGNED_URL_TTL_MS || 15*60*1000),
      contentType: content_type,
    });
    res.json({ upload_id: id, object_name: objectName, upload_url: url, method: 'PUT', headers: { 'Content-Type': content_type }, sha256: sha256 || null, size_bytes: size, module: module || 'general', department: department || null, section: section || null, designation: designation || null });
  } catch (e) {
    console.error('upload initiate', e);
    res.status(500).json({ error: 'Could not initiate upload' });
  }
});

router.post('/complete', async (req, res) => {
  try {
    if (!requireCloud(res)) return;
    const { upload_id, object_name, file_name, content_type, size_bytes, sha256, module, department, section, designation } = req.body || {};
    if (!upload_id || !object_name) return res.status(400).json({ error: 'upload_id and object_name are required' });
    const file = storage.bucket(bucketName).file(object_name);
    const [meta] = await file.getMetadata();
    const actualSize = Number(meta.size || 0);
    if (size_bytes && Number(size_bytes) !== actualSize) return res.status(409).json({ error: 'Uploaded size does not match declared size', actual_size: actualSize });
    const job = { type:'DOCUMENT_INGEST', upload_id, object_name, bucket:bucketName, file_name:file_name || meta.name.split('/').pop(), content_type:content_type || meta.contentType || 'application/octet-stream', size_bytes:actualSize, sha256:sha256 || null, module:module || 'general', department:department || null, section:section || null, designation:designation || null, uploaded_by:{ id:req.user.id, employee_code:req.user.employee_code || null, role:req.user.role }, created_at:new Date().toISOString() };
    if (pubsub) await pubsub.topic(topicName).publishMessage({ json: job });
    res.status(202).json({ status: pubsub ? 'QUEUED' : 'UPLOADED_AWAITING_PROCESSOR', job });
  } catch (e) {
    console.error('upload complete', e);
    res.status(500).json({ error: 'Could not finalize upload' });
  }
});

router.get('/health', async (req,res) => {
  const out = { storage: !!storage, bucket: bucketName || null, pubsub: !!pubsub, topic: pubsub ? topicName : null };
  if (storage) { try { await storage.bucket(bucketName).getMetadata(); out.bucket_reachable=true; } catch(e) { out.bucket_reachable=false; out.bucket_error=e.message; } }
  res.json(out);
});

module.exports = router;
