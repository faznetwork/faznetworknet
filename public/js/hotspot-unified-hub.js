(function hotspotUnifiedHub(){
 'use strict';
 var tabNames={users:'All Users',sessions:'Active Sessions',profiles:'Profiles & Packages',bindings:'IP/MAC Binding',vouchers:'Generate / Print Vouchers',sales:'Voucher Sales History'};
 var state={tab:'users',users:null,sessions:null,profiles:null,sales:null,errors:{},loading:{},rateSamples:{}};
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
  var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},12000);
  try{
   var response=await fetch(url,Object.assign({credentials:'include',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json'},signal:controller.signal},options||{}));
   var data={};try{data=await response.json();}catch(_){}
   if(!response.ok||data.success===false)throw new Error(data.message||data.error||('Request failed ('+response.status+').'));
   return data;
  }catch(error){if(error.name==='AbortError')throw new Error('This service did not respond in 12 seconds. Other Hotspot tabs remain available.');throw error;}
  finally{clearTimeout(timer);}
 }
 function endpointFor(key){return {users:'/api/hotspot/users?filter=all',sessions:'/api/hotspot/active',profiles:'/api/hotspot/profiles',sales:'/api/hotspot/voucher-sales'}[key];}
 async function loadResource(key,force){
  if(state.loading[key])return state.loading[key];
  if(state[key]&&!force)return state[key];
  state.errors[key]='';state.loading[key]=(async function(){
   try{var data=await request(endpointFor(key));state[key]=data;state.errors[key]='';}
   catch(error){state.errors[key]=error.message;console.error('[Hotspot hub] '+key+' request failed:',error.message);}
   finally{state.loading[key]=null;if(state.tab===key||state.tab==='bindings'&&(key==='users'||key==='sessions')||state.tab==='sessions'&&key==='users'||state.tab==='vouchers'&&key==='profiles')renderCurrent();}
   return state[key];
  })();
  return state.loading[key];
 }
 function activeCount(){return toArray(state.sessions&&state.sessions.users).length;}
 function onlineCount(){var users=toArray(state.users&&state.users.users);return users.filter(function(u){return u.is_online===true||u.online===true;}).length;}
 function kpis(tab){
  var users=toArray(state.users&&state.users.users),sessions=toArray(state.sessions&&state.sessions.users),profiles=toArray(state.profiles&&state.profiles.profiles),sales=toArray(state.sales&&state.sales.transactions),items=[];
  var online=onlineCount(),today=0,expires=0,now=Date.now();
  users.forEach(function(u){var created=u.created_at&&new Date(u.created_at).getTime();if(created&&new Date(created).toDateString()===new Date().toDateString())today++;var exp=u.expires_at&&new Date(u.expires_at).getTime();if(exp&&exp>now&&exp-now<=86400000)expires++;});
  if(tab==='users')items=[['TOTAL SUBSCRIBERS',users.length,'Saved accounts','blue'],['ONLINE NOW',online,'Active billing sessions','green'],['NEW TODAY',today,'Accounts created today','purple'],['EXPIRING ≤ 24H',expires,'Subscriber package expiry','orange']];
  else if(tab==='sessions')items=[['ACTIVE SESSIONS',sessions.length,'Live RouterOS sessions','blue'],['LIVE BANDWIDTH',hubBandwidth(sessions),'RX / TX from session samples','green'],['NEW SESSIONS TODAY',countStartedToday(sessions),'Estimated from uptime','purple'],['SESSION EXPIRY ≤ 24H',countExpiring(sessions),'Session time remaining','orange']];
  else if(tab==='profiles')items=[['PROFILES',profiles.length,'MikroTik Hotspot profiles','blue'],['SHARED DEVICES',profiles.reduce(function(n,p){return n+Number(p.sharedUsers||p['shared-users']||1);},0),'Total configured shared users','green'],['TIMEOUT SET',profiles.filter(function(p){return !!(p.sessionTimeout||p['session-timeout']);}).length,'Profiles with session timeout','purple'],['PRICED PLANS',profiles.filter(function(p){return Number(p.price||0)>0;}).length,'Profiles with price metadata','orange']];
  else if(tab==='bindings'){items=[['SAVED USERS',users.length,'Subscriber records','blue'],['ONLINE / MAPPED',online,'Current IP and MAC telemetry','green'],['MAC LOCKED',users.filter(function(u){return u.macLock===true||u.mac_lock===true;}).length,'Saved MAC binding enabled','purple'],['MAC NOT SET',users.filter(function(u){return !(u.mac_address||u.macAddress);}).length,'No saved MAC address','orange']];}
  else if(tab==='sales'){var amount=Number(state.sales&&state.sales.totalAmount||0),tx=Number(state.sales&&state.sales.matchedTransactions||sales.length),vouchers=Number(state.sales&&state.sales.totalVouchersSold||0);items=[['TOTAL COLLECTED',money(amount),'Matched processed sales','blue'],['TRANSACTIONS',tx,'Processed matched transactions','green'],['VOUCHERS SOLD',vouchers,'From sales summary','purple'],['RECORDS',sales.length,'Transactions in this result','orange']];}
  else items=[['AVAILABLE PROFILES',profiles.length,'Select a voucher package','blue'],['ACTIVE SESSIONS',activeCount(),'Current RouterOS sessions','green'],['SAVED SUBSCRIBERS',users.length,'Existing Hotspot accounts','purple'],['VOUCHER QUANTITY','1–500','Server-side validated','orange']];
  return items;
 }
 function countStartedToday(sessions){var now=Date.now();return sessions.filter(function(s){var sec=durationSeconds(s.uptime);return sec!==null&&new Date(now-sec*1000).toDateString()===new Date().toDateString();}).length;}
 function countExpiring(sessions){return sessions.filter(function(s){var sec=durationSeconds(s.sessionTimeLeft);return sec!==null&&sec<=86400;}).length;}
 function hubBandwidth(sessions){var totalIn=0,totalOut=0,elapsed=0,now=Date.now();sessions.forEach(function(s){var key=String(s.id||s.user||s.username||''),prev=state.rateSamples[key];if(prev){var dt=Math.max(1,(now-prev.time)/1000);totalIn+=Math.max(0,Number(s.bytesIn||0)-prev.in)*8/dt/1e6;totalOut+=Math.max(0,Number(s.bytesOut||0)-prev.out)*8/dt/1e6;elapsed++;}state.rateSamples[key]={in:Number(s.bytesIn||0),out:Number(s.bytesOut||0),time:now};});return elapsed?('↑ '+totalOut.toFixed(1)+' · ↓ '+totalIn.toFixed(1)+' Mbps'):'Sampling…';}
 function shellMarkup(){
  var tabs=[['users','All Users'],['sessions','Active Sessions'],['profiles','Profiles & Packages'],['bindings','IP/MAC Binding'],['vouchers','Generate / Print Vouchers'],['sales','Voucher Sales History']];
  return '<section id="hotspotUnifiedHub" class="hotspot-dynamic-view admin-view hotspot-unified-hub"><div class="huh-heading"><div><span class="huh-eyebrow">HOTSPOT OPERATIONS</span><h2>Hotspot Master Hub</h2><p>Subscribers, live sessions, packages, bindings and sales</p></div><button type="button" class="huh-refresh" data-hub-refresh>↻ Refresh</button></div><nav class="huh-tabs" role="tablist" aria-label="Hotspot sections">'+tabs.map(function(t){return '<button class="huh-tab" type="button" role="tab" data-hub-tab="'+t[0]+'" aria-selected="false">'+esc(t[1])+'</button>';}).join('')+'</nav><div class="huh-kpis" id="huhKpis"></div><div class="huh-panel"><div class="huh-toolbar"><input id="huhSearch" type="search" placeholder="Search this tab by name, phone, IP, or MAC…" aria-label="Search Hotspot records"><button type="button" class="huh-export" data-hub-export>↓ Export CSV</button></div><div id="huhContent" role="tabpanel" aria-live="polite"></div></div></section>';
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
  if(!tabNames[tab])tab='users';
  state.tab=tab;setPageTitle(tab);
  var dynamic=document.getElementById('dynamicPageContent');if(!dynamic||!dynamic.querySelector('#hotspotUnifiedHub'))renderShell(tab);
  var route={users:'/admin/hotspot/users/all',sessions:'/admin/hotspot/users/active',profiles:'/admin/hotspot/profiles',bindings:'/admin/hotspot/users/all?tab=bindings',vouchers:'/admin/hotspot/vouchers/generate',sales:'/admin/hotspot/sales'}[tab];
  if(push&&route&&location.pathname+location.search!==route)history.pushState({hotspotHubTab:tab},'',route);
  if(rateTimer){clearInterval(rateTimer);rateTimer=null;}
  renderCurrent();
  if(tab==='users')loadResource('users',force);
  if(tab==='sessions'){loadResource('users',force);loadResource('sessions',force);rateTimer=setInterval(function(){if(state.tab==='sessions')loadResource('sessions',true);},5000);}
  if(tab==='profiles')loadResource('profiles',force);
  if(tab==='bindings'){loadResource('users',force);loadResource('sessions',force);}
  if(tab==='sales')loadResource('sales',force);
  if(tab==='vouchers'){loadResource('profiles',force);renderVoucherForm();}
 }
 function notice(key,label){return '<div class="huh-state '+(state.errors[key]?'is-error':'')+'">'+(state.loading[key]?'Loading '+esc(label)+'…':state.errors[key]?esc(state.errors[key]):'No records found.')+'</div>';}
 function renderCurrent(){
  var root=document.getElementById('hotspotUnifiedHub');if(!root)return;
  root.querySelectorAll('[data-hub-tab]').forEach(function(b){b.setAttribute('aria-selected',b.dataset.hubTab===state.tab?'true':'false');b.classList.toggle('is-active',b.dataset.hubTab===state.tab);});
  var cards=kpis(state.tab);root.querySelector('#huhKpis').innerHTML=cards.map(function(c){return '<article class="huh-kpi huh-'+c[3]+'"><div>'+esc(c[0])+'</div><strong>'+esc(c[1])+'</strong><small>'+esc(c[2])+'</small></article>';}).join('');
  var content=root.querySelector('#huhContent');
  if(state.tab==='users')content.innerHTML=renderUsers();
  else if(state.tab==='sessions')content.innerHTML=renderSessions();
  else if(state.tab==='profiles')content.innerHTML=renderProfiles();
  else if(state.tab==='bindings')content.innerHTML=renderBindings();
  else if(state.tab==='sales')content.innerHTML=renderSales();
  else if(state.tab==='vouchers')renderVoucherForm();
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
  if((state.errors.users&&!state.users)||(state.errors.sessions&&!state.sessions))return '<div class="huh-alert">'+esc([state.errors.users,state.errors.sessions].filter(Boolean).join(' · '))+'</div>';
  if(!state.users||!state.sessions)return '<div class="huh-state">Loading saved subscriber records and live sessions independently…</div>';
  var users=toArray(state.users.users),sessions=toArray(state.sessions.users),sessionBy=new Map(sessions.map(function(s){return [String(s.user||s.username||'').toLowerCase(),s];}));
  return '<div class="huh-note">Read-only view combining saved MAC lock records with current RouterOS IP/MAC telemetry. No separate static IP-binding API is configured.</div>'+table(['SUBSCRIBER','USERNAME','SAVED MAC','LIVE MAC','IP ADDRESS','MAC LOCK'],users.map(function(u){
   var key=String(u.username||'').toLowerCase(),s=sessionBy.get(key),mac=u.mac_address||u.macAddress||'',live=s&&(s.macAddress||s.mac_address)||'';
   return '<tr><td>'+avatar(u.customer_name||u.name||u.username,u.phone||'')+'</td><td><strong>'+esc(u.username||'—')+'</strong></td><td>'+macCell(mac)+'</td><td>'+macCell(live)+'</td><td><code>'+esc(s&&(s.address||s.ip)||u.ip||u.address||'—')+'</code></td><td><span class="huh-status '+((u.macLock===true||u.mac_lock===true)?'online':'offline')+'">'+((u.macLock===true||u.mac_lock===true)?'Locked':'Not locked')+'</span></td></tr>';
  }),6);
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
  var button=event.target.closest('[data-copy]');if(!button)return;
  try{await navigator.clipboard.writeText(button.dataset.copy);button.textContent='✓';setTimeout(function(){button.textContent='▢';},900);}catch(_){button.title='Clipboard access unavailable';}
 }
 function tabFromPath(){
  var path=location.pathname;
  if(location.search.indexOf('tab=bindings')>=0)return 'bindings';
  if(/\/users\/active\/?$/.test(path))return 'sessions';
  if(/\/profiles\/?$/.test(path))return 'profiles';
  if(/\/vouchers\/generate\/?$/.test(path))return 'vouchers';
  if(/\/sales\/?$/.test(path))return 'sales';
  if(/\/vouchers\/manage\/?$/.test(path))return 'sales';
  return 'users';
 }
 function boot(){if(!document.getElementById('dynamicPageContent'))return;renderShell(tabFromPath());}
 window.loadHotspotHubTab=function(tab){openTab(tab,true);return false;};
 window.loadHotspotSection=function(filter,titleKey){return openTab(filter==='active'?'sessions':'users',true);};
 window.loadHotspotProfiles=function(){return openTab('profiles',true);};
 window.loadHotspotVoucherSales=function(){return openTab('sales',true);};
 window.addEventListener('popstate',function(){if(document.getElementById('dynamicPageContent'))openTab(tabFromPath(),false);});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();