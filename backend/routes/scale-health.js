const express = require('express');
const os = require('os');
const router = express.Router();
router.get('/', (req,res)=>res.json({
  ok:true,
  service:'RIZVI_FOMS',
  mode:'scale-ready',
  node:process.version,
  hostname:os.hostname(),
  pid:process.pid,
  uptime_seconds:Math.round(process.uptime()),
  memory_mb:Math.round(process.memoryUsage().rss/1024/1024),
  timestamp:new Date().toISOString()
}));
module.exports = router;
