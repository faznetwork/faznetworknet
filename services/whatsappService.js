"use strict";
const fs=require("fs");
const path=require("path");
let socket=null,qrDataUrl=null,qrText=null,connection="disconnected",lastError=null,connectPromise=null;
function authDir(){return path.resolve(process.env.WHATSAPP_AUTH_DIR||path.join(process.cwd(),"data","whatsapp-auth"));}
function normalizePhone(value){
 let digits=String(value||"").replace(/\D/g,"");
 if(digits.startsWith("00880"))digits=digits.slice(2);
 if(digits.startsWith("01")&&digits.length===11)digits="88"+digits;
 if(digits.startsWith("1")&&digits.length===10)digits="880"+digits;
 if(!/^8801\d{9}$/.test(digits))throw new Error("Enter a valid Bangladesh mobile number (01XXXXXXXXX or 8801XXXXXXXXX).");
 return digits;
}
async function connect(){
 if(connection==="connected"&&socket)return getStatus();
 if(connectPromise)return connectPromise;
 connectPromise=(async()=>{
  let baileys,qrcode;
  try{baileys=require("@whiskeysockets/baileys");qrcode=require("qrcode");}catch(_){throw new Error("WhatsApp linking dependencies are unavailable. Install @whiskeysockets/baileys and qrcode, then restart the app.");}
  const makeWASocket=baileys.default||baileys.makeWASocket;
  if(typeof makeWASocket!=="function")throw new Error("WhatsApp gateway could not load its socket implementation.");
  fs.mkdirSync(authDir(),{recursive:true});
  const {state,saveCreds}=await baileys.useMultiFileAuthState(authDir());
  socket=makeWASocket({auth:state,printQRInTerminal:false,logger:require("pino")?require("pino")({level:"silent"}):undefined,browser:["FAZ NETWORK","Chrome","1.0.0"]});
  connection="connecting";lastError=null;qrDataUrl=null;qrText=null;
  socket.ev.on("creds.update",saveCreds);
  socket.ev.on("connection.update",async update=>{
   if(update.qr){qrText=update.qr;try{qrDataUrl=await qrcode.toDataURL(update.qr,{margin:2,width:280});}catch(error){lastError="QR generation failed.";}}
   if(update.connection==="open"){connection="connected";qrDataUrl=null;qrText=null;lastError=null;}
   if(update.connection==="connecting")connection="connecting";
   if(update.connection==="close"){
    connection="disconnected";
    const code=update.lastDisconnect?.error?.output?.statusCode;
    lastError=code===baileys.DisconnectReason?.loggedOut?"WhatsApp session logged out.":"WhatsApp connection closed; reconnect to continue.";
    socket=null;
   }
  });
  return getStatus();
 })().catch(error=>{lastError=String(error.message||error);connection="error";throw error;}).finally(()=>{connectPromise=null;});
 return connectPromise;
}
function getStatus(){return {connection,connected:connection==="connected",qrDataUrl,qrText:qrText?true:false,lastError,authConfigured:fs.existsSync(path.join(authDir(),"creds.json"))};}
async function sendMessage({to,message}={}){
 if(!socket||connection!=="connected")throw new Error("WhatsApp is not linked. Open Notification Hub and connect the WhatsApp device first.");
 const digits=normalizePhone(to);
 const result=await socket.sendMessage(digits+"@s.whatsapp.net",{text:String(message||"").slice(0,4000)});
 return {success:true,messageId:result?.key?.id||null};
}
async function unlink(){
 try{if(socket){socket.end(undefined);socket=null;}}catch(_){}
 connection="disconnected";qrDataUrl=null;qrText=null;lastError=null;
 await fs.promises.rm(authDir(),{recursive:true,force:true});
 return getStatus();
}
module.exports={connect,getStatus,sendMessage,unlink,normalizePhone};
