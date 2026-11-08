'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const multer=require('multer');
const db=require('../db');
const appSettings=require('../services/appSettings');
const dir=path.join(__dirname,'..','public','uploads','branding');
fs.mkdirSync(dir,{recursive:true});
const fields={logo:{key:'logo_url',prefix:'company-logo'},avatar:{key:'admin_avatar_url',prefix:'admin-avatar'},favicon:{key:'favicon_url',prefix:'favicon'}};
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024,files:1},fileFilter(_req,file,cb){const ext=path.extname(file.originalname||'').toLowerCase();if(['.jpg','.jpeg','.png','.webp'].includes(ext)&&['image/jpeg','image/png','image/webp'].includes(file.mimetype))return cb(null,true);cb(Object.assign(new Error('Upload a JPG, PNG, or WEBP image (maximum 2 MB).'),{status:415}));}});
function detectImage(buffer){if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return'.jpg';if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'.png';if(buffer.length>=12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return'.webp';return null;}
async function save(req,res){const field=fields[req.params.asset];if(!field)return res.status(404).json({success:false,error:'Unknown brand image.'});if(!req.file)return res.status(400).json({success:false,error:'Choose an image up to 2 MB.'});const ext=detectImage(req.file.buffer);if(!ext)return res.status(415).json({success:false,error:'Image content is invalid. Upload a JPG, PNG, or WEBP file.'});const name=field.prefix+'-'+crypto.randomBytes(16).toString('hex')+ext;const dest=path.join(dir,name);try{await fs.promises.writeFile(dest,req.file.buffer,{flag:'wx',mode:0o644});const url='/uploads/branding/'+name;const old=await db.query('SELECT value FROM app_settings WHERE key=$1',[field.key]);await db.query('INSERT INTO app_settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()',[field.key,url]);const oldUrl=String(old.rows[0]?.value||'');if(/^\/uploads\/branding\/[a-zA-Z0-9._-]+$/.test(oldUrl)){const oldName=path.basename(oldUrl);if(oldName!==name&&oldName.startsWith(field.prefix+'-'))await fs.promises.unlink(path.join(dir,oldName)).catch(()=>{});}appSettings.invalidate();return res.status(201).json({success:true,url,key:field.key});}catch(error){await fs.promises.unlink(dest).catch(()=>{});console.error('[Brand asset upload]',error.message||error);return res.status(500).json({success:false,error:'Unable to save brand image.'});}}
function uploadError(err,_req,res,next){if(!err)return next();return res.status(err.code==='LIMIT_FILE_SIZE'?413:(err.status||400)).json({success:false,error:err.code==='LIMIT_FILE_SIZE'?'Image must be 2 MB or smaller.':err.message});}
module.exports={upload,uploadError,save};
