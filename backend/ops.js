const express = require('express');
const db = require('./db');
const { authenticate } = require('./middleware/auth');
const router = express.Router();
router.use(authenticate);


router.get('/tasks',(req,res)=>{
  const row=db.prepare('SELECT payload FROM rizvi_sync_state WHERE id=1').get();
  let payload={}; try{payload=JSON.parse(row?.payload||'{}')}catch(e){}
  res.json({tasks:Array.isArray(payload.tasks)?payload.tasks:[]});
});
router.post('/tasks',(req,res)=>{
  const t=req.body||{}; if(!t.title) return res.status(400).json({error:'title required'});
  const row=db.prepare('SELECT payload FROM rizvi_sync_state WHERE id=1').get(); let payload={}; try{payload=JSON.parse(row?.payload||'{}')}catch(e){}
  payload.tasks=Array.isArray(payload.tasks)?payload.tasks:[]; const task={...t,id:t.id||Date.now().toString(),created_at:t.created_at||new Date().toISOString()};
  payload.tasks.push(task); payload.tasks=payload.tasks.slice(-5000);
  const now=new Date().toISOString(); db.prepare(`INSERT INTO rizvi_sync_state(id,payload,updated_at,updated_by) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).run(JSON.stringify(payload),now,req.user.id);
  res.status(201).json({task,updated_at:now});
});

router.get('/snapshot', (req,res)=>{
  const row=db.prepare('SELECT payload, updated_at FROM rizvi_sync_state WHERE id=1').get();
  if(!row) return res.json({payload:null,updated_at:null});
  let payload=null; try{payload=JSON.parse(row.payload)}catch(e){}
  res.json({payload,updated_at:row.updated_at});
});
router.post('/sync',(req,res)=>{
  const payload=req.body?.payload;
  if(!payload || typeof payload!=='object') return res.status(400).json({error:'payload required'});
  const safe={
    tasks:Array.isArray(payload.tasks)?payload.tasks.slice(-5000):[],
    updates:Array.isArray(payload.updates)?payload.updates.slice(-5000):[],
    checks:payload.checks||{},
    settings:payload.settings||{}
  };
  const json=JSON.stringify(safe), now=new Date().toISOString();
  db.prepare(`INSERT INTO rizvi_sync_state(id,payload,updated_at,updated_by) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).run(json,now,req.user.id);
  res.json({ok:true,updated_at:now});
});
router.get('/health',(req,res)=>res.json({ok:true,time:new Date().toISOString(),service:'RIZVI OPS SYNC'}));
module.exports=router;
