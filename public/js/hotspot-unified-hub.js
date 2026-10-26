(function hotspotUnifiedHub(){
 'use strict';
 var tabNames={dashboard:'Dashboard / Overview',users:'All Users',sessions:'Active Sessions',profiles:'Profiles & Packages',bindings:'IP/MAC Binding',vouchers:'Generate & Print',ledger:'Voucher Ledger & Cleanup',sales:'Sales History'};
 var state={tab:'dashboard',users:null,sessions:null,profiles:null,bindings:null,sales:null,stats:null,ledger:null,ledgerFilter:'all',errors:{},loading:{},rateSamples:{},openAddUser:false};
 var rateTimer=null;
 function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function toArray(value){return Array.isArray(value)?value:[];}
 function money(value){var n=Number(value||0);return '৳ '+(Number.isFinite(n)?n.toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2}):'0.00');}
 function bytes(value){var n=Number(value||0);if(!Number.isFinite(n)||n<=0)return '0 B';var u=['B','KB','MB','GB','TB'],i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),u.length-1);return (n/Math.pow(1024,i)).toFixed(i?1:0)+' '+u[i];}
 function initials(name){var w=String(name||'?').trim().split(/\s+/);return (w.length>1?w[0].charAt(0)+w[w.length-1].charAt(0):(w[0]||'?').slice(0,2)).toUpperCase();}
 function colorFor(name){var h=0,s=String(name||'');for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return ['#1d4ed8','#047857','#7e22ce','#c2410c','#0e7490','#be123c'][Math.abs(h)%6];}
 function durationSeconds(value){var raw=String(value||'').trim(),m,total=0,found=false;if(/^\d+:\d{2}:\d{2}$/.test(raw)){var p=raw.split(':').map(Number);return p[0]*3600+p[1]*60+p[2];}var re=/(\d+)\s*(w|d|h|m|s)/ig;while((m=re.exec(raw))){found=true;total+=Number(m[1])*({w:604800,d:86400,h:3600,m:60,s:1}[m[2].toLowerCase()]);}return found?total:null;}
 function duration(value){var sec=durationSeconds(value);if(sec===null)return value||'—';var d=Math.floor(sec/86400);sec%=86400;var h=Math.floor(sec/3600);sec%=3600;var m=Math.floor(sec/60);return [d?d+'d':'',h?h+'h':'',m?m+'m':''].filter(Boolean).join(' ')||'<1m';}
 async function request(url,options){
  var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},30000);
  try{
   var response=await fetch(url,Object.assign({credentials:'include',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json'},signal:controller.signal},options||{}));
   var data={};try{data=await response.json();}catch(_){}
   if(!response.ok||data.success===false)throw new Error(data.message||data.error||('Request failed ('+response.status+').'));
   var path=new URL(url,location.origin).pathname,expected=path==='/api/hotspot/active'||path==='/api/hotspot/users'?'users':path==='/api/hotspot/profiles'?'profiles':path==='/api/hotspot/voucher-sales'?'transactions':path==='/api/hotspot/ip-bindings'?'bindings':path==='/api/hotspot/voucher-records'?'vouchers':null;
   if(expected&&!Array.isArray(data[expected]))throw new Error('The endpoint returned an unexpected response. Please retry this tab.');
   return data;
  }catch(error){if(error.name==='AbortError')throw new Error('This Hotspot endpoint did not respond in 30 seconds. Other Hub tabs remain available.');throw error;}
  finally{clearTimeout(timer);}
 }
 function endpointFor(key){if(key==='ledger')return '/api/hotspot/voucher-records?status='+encodeURIComponent(state.ledgerFilter);return {users:'/api/hotspot/users?filter=all',sessions:'/api/hotspot/active',profiles:'/api/hotspot/profiles',bindings:'/api/hotspot/ip-bindings',sales:'/api/hotspot/voucher-sales',stats:'/api/hotspot/voucher-stats'}[key];}
 async function loadResource(key,force){
  if(state.loading[key])return state.loading[key];
  if(state[key]&&!force)return state[key];
  state.errors[key]='';state.loading[key]=(async function(){
   try{var data=await request(endpointFor(key));state[key]=data;state.errors[key]='';}
   catch(error){state.errors[key]=error.message;console.error('[Hotspot hub] '+key+' request failed:',error.message);}
   finally{state.loading[key]=null;if(state.tab===key||state.tab==='sessions'&&key==='users'||state.tab==='vouchers'&&key==='profiles'||state.tab==='dashboard'||state.tab==='ledger'&&key==='stats')renderCurrent();}
   return state[key];
  })();
  return state.loading[key];
 }
 function activeCount(){return toArray(state.sessions&&state.sessions.users).length;}
 function onlineCount(){var users=toArray(state.users&&state.users.users);return users.filter(function(u){return u.is_online===true||u.online===true;}).length;}
 function kpis(tab){
  var users=toArray(state.users&&state.users.users),sessions=toArray(state.sessions&&state.sessions.users),profiles=toArray(state.profiles&&state.profiles.profiles),sales=toArray(state.sales&&state.sales.transactions),bindings=toArray(state.bindings&&state.bindings.bindings),items=[];
  var online=onlineCount(),today=0,expires=0,now=Date.now();
  users.forEach(function(u){var created=u.created_at&&new Date(u.created_at).getTime();if(created&&new Date(created).toDateString()===new Date().toDateString())today++;var exp=u.expires_at&&new Date(u.expires_at).getTime();if(exp&&exp>now&&exp-now<=86400000)expires++;});
  if(tab==='users')items=[['TOTAL SUBSCRIBERS',users.length,'Saved accounts','blue'],['ONLINE NOW',online,'Active billing sessions','green'],['NEW TODAY',today,'Accounts created today','purple'],['EXPIRING ≤ 24H',expires,'Subscriber package expiry','orange']];
  else if(tab==='sessions')items=[['ACTIVE SESSIONS',sessions.length,'Live RouterOS sessions','blue'],['LIVE BANDWIDTH',hubBandwidth(sessions),'RX / TX from session samples','green'],['NEW SESSIONS TODAY',countStartedToday(sessions),'Estimated from uptime','purple'],['SESSION EXPIRY ≤ 24H',countExpiring(sessions),'Session time remaining','orange']];
  else if(tab==='profiles')items=[['PROFILES',profiles.length,'MikroTik Hotspot profiles','blue'],['SHARED DEVICES',profiles.reduce(function(n,p){return n+Number(p.sharedUsers||p['shared-users']||1);},0),'Total configured shared users','green'],['TIMEOUT SET',profiles.filter(function(p){return !!(p.sessionTimeout||p['session-timeout']);}).length,'Profiles with session timeout','purple'],['PRICED PLANS',profiles.filter(function(p){return Number(p.price||0)>0;}).length,'Profiles with price metadata','orange']];
  else if(tab==='bindings'){var due=bindings.filter(function(b){var x=new Date(b.expiry_date).getTime();return b.status==='active'&&x>Date.now()&&x-Date.now()<=86400000;}).length;items=[['TOTAL BINDINGS',bindings.length,'Managed devices','blue'],['ACTIVE',bindings.filter(function(b){return b.status==='active';}).length,'Router synchronized','green'],['EXPIRING ≤ 24H',due,'Device access expiry','purple'],['EXPIRED / BLOCKED',bindings.filter(function(b){return b.status==='expired';}).length,'Auto-blocked devices','orange']];}
  else if(tab==='dashboard'){var stats=state.stats||{},sessionsCount=sessions.length,up=hubBandwidth(sessions);items=[['TOTAL ACTIVE',sessionsCount,'Live Hotspot sessions','blue'],['LIVE BANDWIDTH',up,'Aggregate from session samples','green'],['NEW SESSIONS TODAY',countStartedToday(sessions),'Estimated from live session uptime','purple'],['ALERTS / EXPIRING',Number(stats.expiredVouchers||0)+Number(stats.cleanupPending||0),'Expired vouchers + cleanup queue','orange']];}
  else if(tab==='ledger'){var stats=state.stats||{};items=[['TOTAL VOUCHERS',Number(stats.totalVouchers||0),'Voucher records','blue'],['ACTIVE / USED',Number(stats.usedVouchers||stats.activeVouchers||0),'Redeemed / active vouchers','green'],['UNUSED',Number(stats.unusedVouchers||0),'Ready to issue','purple'],['CLEANUP QUEUE',Number(stats.cleanupPending||0),'Expired records pending cleanup','orange']];}
  else if(tab==='sales'){var amount=Number(state.sales&&state.sales.totalAmount||0),tx=Number(state.sales&&state.sales.matchedTransactions||sales.length),vouchers=Number(state.sales&&state.sales.totalVouchersSold||0);items=[['TOTAL COLLECTED',money(amount),'Matched processed sales','blue'],['TRANSACTIONS',tx,'Processed matched transactions','green'],['VOUCHERS SOLD',vouchers,'From sales summary','purple'],['RECORDS',sales.length,'Transactions in this result','orange']];}
  else items=[['AVAILABLE PROFILES',profiles.length,'Select a voucher package','blue'],['ACTIVE SESSIONS',activeCount(),'Current RouterOS sessions','green'],['SAVED SUBSCRIBERS',users.length,'Existing Hotspot accounts','purple'],['VOUCHER QUANTITY','1–500','Server-side validated','orange']];
  return items;
 }
 function countStartedToday(sessions){var now=Date.now();return sessions.filter(function(s){var sec=durationSeconds(s.uptime);return sec!==null&&new Date(now-sec*1000).toDateString()===new Date().toDateString();}).length;}
 function countExpiring(sessions){return sessions.filter(function(s){var sec=durationSeconds(s.sessionTimeLeft);return sec!==null&&sec<=86400;}).length;}
 function hubBandwidth(sessions){var totalIn=0,totalOut=0,elapsed=0,now=Date.now();sessions.forEach(function(s){var key=String(s.id||s.user||s.username||''),prev=state.rateSamples[key];if(prev){var dt=Math.max(1,(now-prev.time)/1000);totalIn+=Math.max(0,Number(s.bytesIn||0)-prev.in)*8/dt/1e6;totalOut+=Math.max(0,Number(s.bytesOut||0)-prev.out)*8/dt/1e6;elapsed++;}state.rateSamples[key]={in:Number(s.bytesIn||0),out:Number(s.bytesOut||0),time:now};});return elapsed?('↑ '+totalOut.toFixed(1)+' · ↓ '+totalIn.toFixed(1)+' Mbps'):'Sampling…';}
 function shellMarkup(){
  var tabs=[['dashboard','📊 Dashboard / Overview'],['users','👥 All Users'],['sessions','🟢 Active Sessions'],['profiles','⚡ Profiles & Packages'],['bindings','🔗 IP/MAC Binding'],['vouchers','🖨️ Generate & Print'],['ledger','📋 Voucher Ledger & Cleanup'],['sales','💰 Sales History']];
  return '<section id="hotspotUnifiedHub" class="hotspot-dynamic-view admin-view hotspot-unified-hub"><div class="huh-heading"><div><span class="huh-eyebrow">HOTSPOT OPERATIONS</span><h2>Hotspot Master Hub</h2><p>One workspace for subscribers, sessions, vouchers and network access</p></div><button type="button" class="huh-refresh" data-hub-refresh>↻ Refresh</button></div><nav class="huh-tabs" role="tablist" aria-label="Hotspot sections">'+tabs.map(function(t){return '<button class="huh-tab" type="button" role="tab" data-hub-tab="'+t[0]+'" aria-selected="false">'+esc(t[1])+'</button>';}).join('')+'</nav><div class="huh-kpis" id="huhKpis"></div><div class="huh-panel"><div class="huh-toolbar"><input id="huhSearch" type="search" placeholder="Search this tab by name, phone, IP, or MAC…" aria-label="Search Hotspot records"><span class="huh-toolbar-actions">'+(state.tab==='bindings'?'<button type="button" class="huh-primary" data-binding-action="add">＋ Add Bypassed Device</button>':'')+(state.tab==='users'?'<button type="button" class="huh-primary" data-user-action="add">＋ Add Hotspot User</button>':'')+(state.tab==='ledger'?'<button type="button" class="huh-primary" data-ledger-action="cleanup">↻ Run Cleanup</button>':'')+'<button type="button" class="huh-export" data-hub-export>↓ Export CSV</button></span></div><div id="huhContent" role="tabpanel" aria-live="polite"></div></div></section>';
 }
 function renderShell(tab){
  var dynamic=document.getElementById('dynamicPageContent');if(!dynamic)return false;
  ['view-main-dashboard','view-hotspot-dashboard'].forEach(function(id){var view=document.getElementById(id);if(view)view.style.display='none';});
  dynamic.style.display='block';dynamic.innerHTML=shellMarkup();
  dynamic.querySelectorAll('[data-hub-tab]').forEach(function(button){button.addEventListener('click',function(){openTab(button.dataset.hubTab,true);});});
  dynamic.querySelector('[data-hub-refresh]').addEventListener('click',function(){openTab(state.tab,false,true);});
  dynamic.querySelector('[data-hub-export]').addEventListener('click',exportCurrent);
  dynamic.querySelector('#huhSearch').addEventListener('input',function(){var q=this.value.trim().toLowerCase();dynamic.querySelectorAll('#huhContent tbody tr').forEach(function(row){row.hidden=!row.innerText.toLowerCase().includes(q);});});
  dynamic.addEventListener('click',handleAction);
  renderCurrent();openTab(tab||'users',false);
  return true;
 }
 function setPageTitle(tab){var el=document.getElementById('pageTitle');if(el)el.textContent=tabNames[tab]||'Hotspot Master Hub';}
 function openTab(tab,push,force){
  if(tab==='add-user'){state.openAddUser=true;tab='users';}
  if(tab==='ledger-cleanup'){state.ledgerFilter='cleanup';tab='ledger';}
  if(!tabNames[tab])tab='dashboard';
  if(tab==='ledger'&&/\/vouchers\/cleanup\/?$/.test(location.pathname))state.ledgerFilter='cleanup';
  state.tab=tab;setPageTitle(tab);
  var dynamic=document.getElementById('dynamicPageContent');if(!dynamic||!dynamic.querySelector('#hotspotUnifiedHub'))renderShell(tab);
  var route={dashboard:'/admin/hotspot/dashboard',users:'/admin/hotspot/users/all',sessions:'/admin/hotspot/users/active',profiles:'/admin/hotspot/profiles',bindings:'/admin/hotspot/ip-bindings',vouchers:'/admin/hotspot/vouchers/generate',ledger:state.ledgerFilter==='cleanup'?'/admin/hotspot/vouchers/cleanup':'/admin/hotspot/vouchers/manage',sales:'/admin/hotspot/sales'}[tab];
  if(push&&route&&location.pathname+location.search!==route)history.pushState({hotspotHubTab:tab},'',route);
  if(rateTimer){clearInterval(rateTimer);rateTimer=null;}
  renderCurrent();
  if(tab==='dashboard'){loadResource('sessions',force);loadResource('stats',force);loadResource('sales',force);}
  if(tab==='ledger'){loadResource('ledger',force);loadResource('stats',force);}
  if(tab==='users')loadResource('users',force);
  if(tab==='sessions'){loadResource('users',force);loadResource('sessions',force);rateTimer=setInterval(function(){if(state.tab==='sessions')loadResource('sessions',true);},5000);}
  if(tab==='profiles')loadResource('profiles',force);
  if(tab==='bindings')loadResource('bindings',force);
  if(tab==='sales')loadResource('sales',force);
  if(tab==='vouchers'){loadResource('profiles',force);renderVoucherForm();}
 }
 function notice(key,label){return '<div class="huh-state '+(state.errors[key]?'is-error':'')+'">'+(state.loading[key]?'Loading '+esc(label)+'…':state.errors[key]?esc(state.errors[key]):'No records found.')+'</div>';}
 function renderCurrent(){
  var root=document.getElementById('hotspotUnifiedHub');if(!root)return;
  root.querySelectorAll('[data-hub-tab]').forEach(function(b){b.setAttribute('aria-selected',b.dataset.hubTab===state.tab?'true':'false');b.classList.toggle('is-active',b.dataset.hubTab===state.tab);});
  var cards=kpis(state.tab);root.querySelector('#huhKpis').innerHTML=cards.map(function(c){return '<article class="huh-kpi huh-'+c[3]+'"><div>'+esc(c[0])+'</div><strong>'+esc(c[1])+'</strong><small>'+esc(c[2])+'</small></article>';}).join('');
  var bindingAdd=root.querySelector('[data-binding-action="add"]'),exportButton=root.querySelector('[data-hub-export]');
  if(state.tab==='bindings'&&!bindingAdd&&exportButton)root.querySelector('.huh-toolbar-actions').insertAdjacentHTML('afterbegin','<button type="button" class="huh-primary" data-binding-action="add">＋ Add Bypassed Device</button>');
  if(state.tab!=='bindings'&&bindingAdd)bindingAdd.remove();
  var toolbar=root.querySelector('.huh-toolbar-actions');
  if(state.tab==='users'&&!toolbar.querySelector('[data-user-action]'))toolbar.insertAdjacentHTML('afterbegin','<button type="button" data-user-action="add" class="huh-primary">＋ Add Hotspot User</button>');
  if(state.tab!=='users')toolbar.querySelector('[data-user-action]')?.remove();
  if(state.tab==='ledger'&&!toolbar.querySelector('[data-ledger-action]'))toolbar.insertAdjacentHTML('afterbegin','<button type="button" data-ledger-action="cleanup" class="huh-primary">↻ Run Cleanup</button>');
  if(state.tab!=='ledger')toolbar.querySelector('[data-ledger-action]')?.remove();
  var content=root.querySelector('#huhContent');
  if(state.tab==='dashboard')content.innerHTML=renderDashboard();
  else if(state.tab==='ledger')content.innerHTML=renderLedger();
  else if(state.tab==='users')content.innerHTML=renderUsers();
  else if(state.tab==='sessions')content.innerHTML=renderSessions();
  else if(state.tab==='profiles')content.innerHTML=renderProfiles();
  else if(state.tab==='bindings')content.innerHTML=renderBindings();
  else if(state.tab==='sales')content.innerHTML=renderSales();
  else if(state.tab==='vouchers')renderVoucherForm();
  if(state.openAddUser&&state.tab==='users'&&!state.loading.users){state.openAddUser=false;setTimeout(openAddUserForm,0);}
 }
 function renderDashboard(){
  var sessions=toArray(state.sessions&&state.sessions.users),tx=toArray(state.sales&&state.sales.transactions);
  var quick='<div class="huh-quick-actions"><button type="button" data-hub-tab="users">Manage users</button><button type="button" data-hub-tab="sessions">View live sessions</button><button type="button" data-hub-tab="vouchers">Generate vouchers</button><button type="button" data-hub-tab="ledger">Review voucher ledger</button></div>';
  var live=table(['LIVE SESSION','IP ADDRESS','UPTIME','TRAFFIC'],sessions.slice(0,8).map(function(x){return '<tr><td><strong>'+esc(x.user||x.username||'Unknown')+'</strong></td><td><code>'+esc(x.address||x.ip||'—')+'</code></td><td>'+esc(duration(x.uptime))+'</td><td><span class="huh-rx">↓ '+bytes(x.bytesIn)+'</span> <span class="huh-tx">↑ '+bytes(x.bytesOut)+'</span></td></tr>'; }),4);
  return '<div class="huh-dashboard-grid"><section><h3>Quick actions</h3>'+quick+'</section><section><h3>Recent sales</h3>'+renderSalesPreview(tx)+'</section></div><h3 class="huh-section-title">Current Hotspot sessions</h3>'+(!state.sessions?notice('sessions','live sessions'):live);
 }
 function renderSalesPreview(rows){
  if(!state.sales)return notice('sales','sales');
  return rows.length?'<div class="huh-sales-preview">'+rows.slice(0,5).map(function(t){return '<div><span>'+esc(t.matched_username||t.trx_id||'Payment')+'</span><strong>'+esc(money(t.amount))+'</strong></div>';}).join('')+'</div>':'<div class="huh-state">No matched sales in the current result.</div>';
 }
 function renderLedger(){
  if(!state.ledger)return notice('ledger','voucher ledger');
  var records=toArray(state.ledger.vouchers),stats=state.stats||{},filters=[['all','All'],['unused','Unused'],['active','Active'],['expired','Expired'],['cleanup','Cleanup queue']];
  var pills='<div class="huh-ledger-filters">'+filters.map(function(f){var n=f[0]==='all'?Number(stats.totalVouchers||records.length):f[0]==='unused'?Number(stats.unusedVouchers||0):f[0]==='active'?Number(stats.activeVouchers||0):f[0]==='expired'?Number(stats.expiredVouchers||0):Number(stats.cleanupPending||0);return '<button type="button" data-ledger-filter="'+f[0]+'" class="'+(state.ledgerFilter===f[0]?'is-active':'')+'">'+f[1]+' <span>'+n+'</span></button>';}).join('')+'</div>';
  var rows=records.map(function(v){var cleanup=v.cleanup_status||'—',status=v.display_status||v.status||'Unknown';return '<tr><td><strong>'+esc(v.username||'—')+'</strong><small class="huh-subline">PIN / password: <code>'+esc(v.password||'—')+'</code></small></td><td>'+esc(v.profile||'—')+'</td><td>'+esc(v.customer_name||v.phone||'—')+'</td><td><span class="huh-status '+(v.status==='expired'?'offline':'online')+'">'+esc(status)+'</span></td><td>'+esc(expiry(v.expires_at))+'</td><td>'+esc(cleanup)+(v.cleanup_error?'<small class="huh-subline">'+esc(v.cleanup_error)+'</small>':'')+'</td></tr>';});
  return pills+table(['VOUCHER / USER','PROFILE','CUSTOMER','STATUS','EXPIRY','CLEANUP'],rows,6);
 }
 async function runCleanup(button){
  if(!window.confirm('Run the existing expired voucher cleanup now?'))return;
  button.disabled=true;button.textContent='Running cleanup…';
  try{var result=await request('/api/hotspot/vouchers/cleanup/run',{method:'POST',body:JSON.stringify({})});window.alert(result.message||'Voucher cleanup completed.');state.ledger=null;state.stats=null;await loadResource('ledger',true);loadResource('stats',true);}
  catch(error){window.alert(error.message);}
  finally{button.disabled=false;button.textContent='↻ Run Cleanup';}
 }
 async function openAddUserForm(){
  if(!state.profiles)await loadResource('profiles',false);
  var overlay=document.createElement('div');overlay.className='huh-modal-backdrop';
  var options=toArray(state.profiles&&state.profiles.profiles).map(function(p){var id=p.profile_id||p.name;return '<option value="'+esc(id)+'">'+esc(p.name||id)+'</option>';}).join('');
  overlay.innerHTML='<section class="huh-modal" role="dialog" aria-modal="true" aria-labelledby="huhAddUserTitle"><button type="button" class="huh-modal-close" data-modal-close>×</button><h3 id="huhAddUserTitle">Add Hotspot User</h3><form id="huhAddUserForm"><label>Customer name<input name="customer_name" required maxlength="160"></label><label>Phone (optional)<input name="phone" inputmode="tel"></label><label>Package / profile<select name="profile_id" required><option value="">Select profile…</option>'+options+'</select></label><label>Custom expiry (Dhaka, optional)<input name="custom_expiry" type="datetime-local"></label><label class="huh-modal-wide">Note / address<input name="note" maxlength="1000"></label><div class="huh-modal-error" aria-live="polite"></div><footer><button type="button" class="huh-export" data-modal-close>Cancel</button><button type="submit" class="huh-primary" '+(options?'':'disabled')+'>Create user</button></footer></form></section>';
  document.body.appendChild(overlay);overlay.addEventListener('click',function(e){if(e.target===overlay||e.target.closest('[data-modal-close]'))overlay.remove();});
  overlay.querySelector('#huhAddUserForm').addEventListener('submit',async function(e){e.preventDefault();var form=e.currentTarget,submit=form.querySelector('[type=submit]'),err=overlay.querySelector('.huh-modal-error');submit.disabled=true;err.textContent='Creating Hotspot account…';try{var result=await request('/api/hotspot/users',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form).entries()))});overlay.remove();window.alert(result.message||'Hotspot user created.');state.users=null;await loadResource('users',true);}catch(error){err.textContent=error.message;submit.disabled=false;}});
 }
 function renderUsers(){
  if(!state.users)return notice('users','subscribers');
  var users=toArray(state.users.users);
  return table(['SUBSCRIBER','PACKAGE','IP ADDRESS','MAC ADDRESS','STATUS','EXPIRY'],users.map(function(u){
   var name=u.customer_name||u.name||u.username||'Unknown',online=u.is_online===true||u.online===true,mac=u.mac_address||u.macAddress||'',ip=u.ip||u.address||'';
   return '<tr><td>'+avatar(name,u.phone||u.username)+'</td><td><span class="huh-badge">'+esc(u.profile||'Package unavailable')+'</span></td><td><code>'+esc(ip||'—')+'</code></td><td>'+macCell(mac)+'</td><td><span class="huh-status '+(online?'online':'offline')+'">'+(online?'Online':'Offline')+'</span></td><td>'+esc(expiry(u.expires_at))+'</td></tr>';
  }),6);
 }
 function renderSessions(){
  if(!state.sessions)return notice('sessions','active sessions');
  var sessions=toArray(state.sessions.users),profiles=new Map(toArray(state.users&&state.users.users).map(function(u){return [String(u.username||'').toLowerCase(),u];}));
  return table(['SUBSCRIBER','PACKAGE','IP ADDRESS','MAC ADDRESS','LIVE TRAFFIC','UPTIME','AUTH'],sessions.map(function(s){
   var username=s.user||s.username||'Unknown',user=profiles.get(String(username).toLowerCase())||{},name=user.customer_name||user.name||username,m=s.macAddress||s.mac_address||'';
   return '<tr><td>'+avatar(name,user.phone||username)+'</td><td><span class="huh-badge">'+esc(s.profile||user.profile||'MikroTik session')+'</span></td><td><code>'+esc(s.address||s.ip||'—')+'</code></td><td>'+macCell(m)+'</td><td><span class="huh-rx">↓ '+bytes(s.bytesIn)+'</span><br><span class="huh-tx">↑ '+bytes(s.bytesOut)+'</span></td><td>'+esc(duration(s.uptime))+'</td><td><span class="huh-status online">RouterOS active</span></td></tr>';
  }),7);
 }
 function renderProfiles(){
  if(!state.profiles)return notice('profiles','profiles');
  var profiles=toArray(state.profiles.profiles);
  if(!profiles.length)return '<div class="huh-state">No Hotspot profiles were returned by MikroTik.</div>';
  return '<div class="huh-profile-grid">'+profiles.map(function(p){
   var rate=String(p.rateLimit||p['rate-limit']||'').trim(),split=rate.split('/'),shared=Number(p.sharedUsers||p['shared-users']||1),timeout=p.sessionTimeout||p['session-timeout']||'Not set',price=p.price;
   return '<article class="huh-profile-card"><header><div><span class="huh-profile-icon">◉</span><h3>'+esc(p.name||'Unnamed Profile')+'</h3></div><strong>'+esc(price==null?'Price unavailable':money(price))+'</strong></header><div class="huh-profile-specs"><div><small>RATE LIMIT (RX / TX)</small><strong>'+esc(split.length>1?split[0]+' / '+split[1]:rate||'Unlimited')+'</strong></div><div><small>SHARED USERS</small><strong>'+esc(shared)+' '+(shared===1?'device':'devices')+'</strong></div><div><small>SESSION TIMEOUT</small><strong>'+esc(timeout)+'</strong></div></div><footer><span class="huh-status online">Loaded from MikroTik</span><span>'+esc(p.validityLabel||p.validity||'Validity not configured')+'</span></footer></article>';
  }).join('')+'</div>';
 }
 function renderBindings(){
  if(!state.bindings)return notice('bindings','IP/MAC bindings');
  var rows=toArray(state.bindings.bindings);
  return table(['MAC ADDRESS','IP ADDRESS','ASSIGNED CUSTOMER','PACKAGE / SPEED','EXPIRY / COUNTDOWN','STATUS','ACTIONS'],rows.map(function(b){
   var expiryAt=b.expiry_date?new Date(b.expiry_date):null,remaining=expiryAt&&!Number.isNaN(expiryAt.getTime())?expiryAt.getTime()-Date.now():null;
   var countdown=remaining===null?'No expiry':remaining<=0?'Expired':duration(Math.floor(remaining/1000))+' left';
   var status=b.status==='expired'?'Expired · Blocked':b.status==='disabled'?'Disabled':b.router_status==='unavailable'?'Active · Sync unknown':b.router_status==='blocked'?'Active · Blocked':b.router_status==='bypassed'?'Active · Bypassed':'Active · '+(b.router_status||'Router pending');
   var cls=b.status==='active'&&b.router_status==='bypassed'?'online':'offline';
   var payload=esc(JSON.stringify({id:b.id,mac_address:b.mac_address,ip_address:b.ip_address||'',customer_name:b.customer_name||'',phone:b.phone||'',comment:b.comment||'',binding_type:b.binding_type||'bypassed',package_id:b.package_id||'',bandwidth_profile:b.bandwidth_profile||'unlimited',expiry_date:b.expiry_date||''}));
   return '<tr><td>'+macCell(b.mac_address)+'</td><td><code>'+esc(b.ip_address||'—')+'</code></td><td>'+avatar(b.customer_name||'Unassigned',b.phone||'')+'</td><td><strong>'+esc(b.package_id||'Custom')+'</strong><small class="huh-subline">'+esc(b.bandwidth_profile||'unlimited')+'</small></td><td>'+esc(expiry(b.expiry_date))+'<small class="huh-subline">'+esc(countdown)+'</small></td><td><span class="huh-status '+cls+'">'+esc(status)+'</span></td><td class="huh-binding-actions"><button type="button" class="huh-binding-btn" data-binding-action="renew" data-binding="'+payload+'">↻ Renew</button><button type="button" class="huh-binding-btn" data-binding-action="edit" data-binding="'+payload+'">⚙ Edit</button><button type="button" class="huh-binding-btn is-danger" data-binding-action="delete" data-id="'+esc(b.id)+'">🗑 Unbind</button></td></tr>';
  }),7);
 }
 function renderSales(){
  if(!state.sales)return notice('sales','voucher sales');
  var items=toArray(state.sales.transactions);
  return '<div class="huh-sales-summary"><strong>'+money(state.sales.totalAmount||0)+'</strong><span>'+Number(state.sales.matchedTransactions||items.length)+' processed matched transactions · '+Number(state.sales.totalVouchersSold||0)+' vouchers sold</span></div>'+table(['DATE','CATEGORY','TRX ID','SENDER','MATCHED USER','AMOUNT','STATUS'],items.map(function(t){return '<tr><td>'+esc(t.created_at?new Date(t.created_at).toLocaleString():'—')+'</td><td>'+esc(t.subscriber_type||t.channel||'—')+'</td><td><code>'+esc(t.trx_id||'—')+'</code></td><td>'+esc(t.sender_phone||'—')+'</td><td>'+esc(t.matched_username||'—')+'</td><td>'+esc(money(t.amount))+'</td><td><span class="huh-status online">'+esc(t.status||'Processed')+'</span></td></tr>'; }),7);
 }
 function table(headers,rows,cols){
  return '<div class="huh-table-wrap"><table class="huh-table"><thead><tr>'+headers.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody>'+(rows.length?rows.join(''):'<tr><td class="huh-empty" colspan="'+cols+'">No records found for this tab.</td></tr>')+'</tbody></table></div><div class="huh-count">'+rows.length+' record'+(rows.length===1?'':'s')+'</div>';
 }
 function avatar(name,sub){return '<div class="huh-person"><span class="huh-avatar" style="--avatar:'+colorFor(name)+'">'+esc(initials(name))+'</span><span><strong>'+esc(name)+'</strong><small>'+esc(sub||'')+'</small></span></div>';}
 function macCell(mac){return '<span class="huh-mac">'+esc(mac||'—')+'</span>'+(mac?'<button type="button" class="huh-copy" data-copy="'+esc(mac)+'" aria-label="Copy MAC">▢</button>':'');}
 function expiry(value){if(!value)return 'Not set';var date=new Date(value);return Number.isNaN(date.getTime())?'Not set':date.toLocaleDateString();}
 function renderVoucherForm(){
  var host=document.getElementById('huhContent');if(!host)return;
  if(state.errors.profiles){host.innerHTML='<div class="huh-alert">Voucher generation needs the existing Hotspot profiles API. '+esc(state.errors.profiles)+'</div>';return;}
  var profiles=toArray(state.profiles&&state.profiles.profiles);
  host.innerHTML='<form id="huhVoucherForm" class="huh-voucher-form"><div><label for="huhProfile">Hotspot profile</label><select id="huhProfile" name="profile" required><option value="">Select profile…</option>'+profiles.map(function(p){return '<option value="'+esc(p.profile_id||p.name)+'" data-price="'+Number(p.price||0)+'">'+esc(p.name)+' — '+esc(money(p.price))+'</option>';}).join('')+'</select></div><div><label for="huhQuantity">Quantity</label><input id="huhQuantity" name="quantity" type="number" min="1" max="500" value="1" required></div><div><label for="huhPrefix">Username prefix</label><input id="huhPrefix" name="userPrefix" maxlength="20" placeholder="Optional"></div><div><label for="huhPrice">Price per voucher (৳)</label><input id="huhPrice" name="price" type="number" min="0" step="0.01" value="0" required></div><button type="submit" class="huh-primary" '+(profiles.length?'':'disabled')+'>Generate vouchers</button><div id="huhVoucherResult" aria-live="polite"></div></form>';
  host.querySelector('#huhProfile').addEventListener('change',function(){var selected=this.options[this.selectedIndex];host.querySelector('#huhPrice').value=selected.dataset.price||'0';});
  host.querySelector('#huhVoucherForm').addEventListener('submit',async function(event){event.preventDefault();var form=event.currentTarget,button=form.querySelector('button[type="submit"]'),result=form.querySelector('#huhVoucherResult'),data=Object.fromEntries(new FormData(form).entries());button.disabled=true;result.textContent='Creating vouchers…';try{var created=await request('/api/hotspot/vouchers/generate',{method:'POST',body:JSON.stringify(data)});var vouchers=toArray(created.vouchers||created.users||created.records);result.innerHTML='<div class="huh-success">Created '+vouchers.length+' voucher'+(vouchers.length===1?'':'s')+'.</div>'+(vouchers.length?'<div class="huh-voucher-print">'+vouchers.map(function(v){return '<article><strong>'+esc(v.username||v.user||'')+'</strong><span>'+esc(v.password||'')+'</span><small>'+esc(v.profile||data.profile)+'</small></article>';}).join('')+'</div><button type="button" class="huh-print" onclick="window.print()">Print vouchers</button>':'');}catch(error){result.innerHTML='<div class="huh-alert">'+esc(error.message)+'</div>';}finally{button.disabled=false;}});
 }
 function exportCurrent(){
  var root=document.getElementById('huhContent');if(!root)return;var rows=Array.from(root.querySelectorAll('table tr')).map(function(row){return Array.from(row.children).map(function(cell){return '"'+String(cell.innerText||'').replace(/"/g,'""')+'"';}).join(',');});
  if(!rows.length)return;var blob=new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='hotspot-'+state.tab+'.csv';a.click();URL.revokeObjectURL(a.href);
 }
 async function handleAction(event){
  var userAction=event.target.closest('[data-user-action]');if(userAction){openAddUserForm();return;}
  var cleanupAction=event.target.closest('[data-ledger-action]');if(cleanupAction){await runCleanup(cleanupAction);return;}
  var filterAction=event.target.closest('[data-ledger-filter]');if(filterAction){state.ledgerFilter=filterAction.dataset.ledgerFilter;state.ledger=null;var ledgerPath=state.ledgerFilter==='cleanup'?'/admin/hotspot/vouchers/cleanup':'/admin/hotspot/vouchers/manage'+(state.ledgerFilter==='all'?'':'?status='+encodeURIComponent(state.ledgerFilter));history.pushState({hotspotHubTab:'ledger'},'',ledgerPath);loadResource('ledger',true);return;}
  var hubTab=event.target.closest('#huhContent [data-hub-tab]');if(hubTab){var targetTab=hubTab.dataset.hubTab;if(targetTab==='ledger'&&state.tab==='dashboard')state.ledgerFilter='all';openTab(targetTab,true);return;}
  var actionButton=event.target.closest('[data-binding-action]');if(actionButton){await bindingAction(actionButton);return;}
  var button=event.target.closest('[data-copy]');if(!button)return;
  try{await navigator.clipboard.writeText(button.dataset.copy);button.textContent='✓';setTimeout(function(){button.textContent='▢';},900);}catch(_){button.title='Clipboard access unavailable';}
 }
 function dhakaDateInput(value){
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return value;
  var date=value?new Date(value):new Date(Date.now()+30*86400000);if(Number.isNaN(date.getTime()))date=new Date(Date.now()+30*86400000);
  var local=new Date(date.getTime()+6*60*60*1000);return local.toISOString().slice(0,16);
 }
 function openBindingForm(binding){
  var current=binding||{},profiles=toArray(state.profiles&&state.profiles.profiles),overlay=document.createElement('div');overlay.className='huh-modal-backdrop';
  overlay.innerHTML='<section class="huh-modal" role="dialog" aria-modal="true" aria-labelledby="huhBindingTitle"><button type="button" class="huh-modal-close" data-modal-close aria-label="Close">×</button><h3 id="huhBindingTitle">'+(binding?'Edit / Renew Binding':'Add Bypassed Device')+'</h3><form id="huhBindingForm"><label>MAC address<input name="mac_address" required placeholder="AA:BB:CC:DD:EE:FF" value="'+esc(current.mac_address||'')+'"></label><label>Static IP address (optional)<input name="ip_address" placeholder="192.168.88.10" value="'+esc(current.ip_address||'')+'"></label><label>Customer name<input name="customer_name" value="'+esc(current.customer_name||'')+'"></label><label>Phone<input name="phone" value="'+esc(current.phone||'')+'"></label><label>Package / profile<select name="package_id"><option value="">Custom / none</option>'+profiles.map(function(p){var name=p.profile_id||p.name,rate=p.rateLimit||p.rate_limit||p['rate-limit']||'unlimited';return '<option value="'+esc(name)+'" data-rate="'+esc(rate)+'" '+(String(current.package_id)===String(name)?'selected':'')+'>'+esc(p.name||name)+'</option>';}).join('')+'</select></label><label>Bandwidth upload/download<input name="bandwidth_profile" placeholder="unlimited or 5M/5M" value="'+esc(current.bandwidth_profile||'unlimited')+'"></label><label>Binding type<select name="binding_type"><option value="bypassed" '+((current.binding_type||'bypassed')==='bypassed'?'selected':'')+'>Bypassed</option><option value="regular" '+(current.binding_type==='regular'?'selected':'')+'>Regular</option><option value="blocked" '+(current.binding_type==='blocked'?'selected':'')+'>Blocked</option></select></label><label>Expiry date & time (Dhaka)<input name="expiry_date" type="datetime-local" required value="'+dhakaDateInput(current.expiry_date)+'"></label><label class="huh-modal-wide">Comment<input name="comment" maxlength="500" value="'+esc(current.comment||'')+'"></label><div class="huh-modal-error" aria-live="polite"></div><footer><button type="button" class="huh-export" data-modal-close>Cancel</button><button type="submit" class="huh-primary">'+(binding?'Save / Extend':'Create binding')+'</button></footer></form></section>';
  document.body.appendChild(overlay);overlay.addEventListener('click',function(event){if(event.target===overlay||event.target.closest('[data-modal-close]'))overlay.remove();});
  var form=overlay.querySelector('#huhBindingForm');
  form.querySelector('[name="package_id"]').addEventListener('change',function(){var option=this.options[this.selectedIndex],rate=option.dataset.rate;if(rate)form.querySelector('[name="bandwidth_profile"]').value=rate;});
  form.addEventListener('submit',async function(event){event.preventDefault();var submit=form.querySelector('[type=submit]'),error=overlay.querySelector('.huh-modal-error'),data=Object.fromEntries(new FormData(form).entries());if(binding)data.package_id=data.package_id||'';submit.disabled=true;error.textContent='Saving and synchronizing with MikroTik…';try{await request(binding?'/api/hotspot/ip-bindings/'+encodeURIComponent(binding.id):'/api/hotspot/ip-bindings',{method:binding?'PATCH':'POST',body:JSON.stringify(data)});overlay.remove();state.bindings=null;await loadResource('bindings',true);}catch(err){error.textContent=err.message;submit.disabled=false;}});
 }
 async function bindingAction(button){
  var action=button.dataset.bindingAction;
  if(action==='add'){if(!state.profiles)await loadResource('profiles',false);openBindingForm(null);return;}
  var row=button.dataset.binding?JSON.parse(button.dataset.binding):null;
  if(action==='edit'){if(!state.profiles)await loadResource('profiles',false);openBindingForm(row);return;}
  if(action==='renew'){if(!state.profiles)await loadResource('profiles',false);row.binding_type='bypassed';row.expiry_date=dhakaDateInput(row.expiry_date&&new Date(row.expiry_date).getTime()>Date.now()?new Date(new Date(row.expiry_date).getTime()+30*86400000):null);openBindingForm(row);return;}
  if(action==='delete'){
   if(!window.confirm('Unbind this device from MikroTik and archive the binding?'))return;
   button.disabled=true;try{await request('/api/hotspot/ip-bindings/'+encodeURIComponent(button.dataset.id),{method:'DELETE'});state.bindings=null;await loadResource('bindings',true);}catch(error){window.alert(error.message);button.disabled=false;}
  }
 }
 function tabFromPath(){
  var path=location.pathname;
  if(/^\/admin\/hotspot\/(?:dashboard|index)\/?$/.test(path))return 'dashboard';
  if(/^\/admin\/hotspot\/ip-bindings\/?$/.test(path))return 'bindings';
  if(/^\/admin\/hotspot\/add-user\/?$/.test(path))return 'add-user';
  if(/^\/admin\/hotspot\/users\/active\/?$/.test(path))return 'sessions';
  if(/^\/admin\/hotspot\/profiles\/?$/.test(path))return 'profiles';
  if(/^\/admin\/hotspot\/vouchers\/generate\/?$/.test(path))return 'vouchers';
  if(/^\/admin\/hotspot\/vouchers\/cleanup\/?$/.test(path)){state.ledgerFilter='cleanup';return 'ledger';}
  if(/^\/admin\/hotspot\/vouchers\/manage\/?$/.test(path)){state.ledgerFilter=new URLSearchParams(location.search).get('status')||'all';return 'ledger';}
  if(/^\/admin\/hotspot\/sales\/?$/.test(path))return 'sales';
  return 'users';
 }
 function boot(){if(!document.getElementById('dynamicPageContent'))return;renderShell(tabFromPath());}
 window.loadHotspotHubTab=function(tab){openTab(tab,true);return false;};
 window.loadHotspotSection=function(filter,titleKey){return openTab(filter==='active'?'sessions':'users',true);};
 window.loadAddHotspotUserView=function(){return openTab('add-user',true);};
 window.loadVoucherGeneratorSection=function(){return openTab('vouchers',true);};
 window.loadHotspotVoucherRecords=function(filter){return openTab(filter==='cleanup'?'ledger-cleanup':'ledger',true);};
 window.loadHotspotProfiles=function(){return openTab('profiles',true);};
 window.loadHotspotVoucherSales=function(){return openTab('sales',true);};
 window.addEventListener('popstate',function(){if(document.getElementById('dynamicPageContent'))openTab(tabFromPath(),false);});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();