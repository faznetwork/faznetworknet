(function(){
'use strict';
const api='/api/reseller-portal';
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>'৳'+Number(value||0).toLocaleString('en-BD',{minimumFractionDigits:2,maximumFractionDigits:2});
const date=value=>{if(!value)return'—';const raw=String(value).slice(0,10),m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:escapeHtml(raw);};
function bangladeshToday(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),get=t=>p.find(x=>x.type===t)?.value;return get('year')+'-'+get('month')+'-'+get('day');}
function addCalendarMonths(value,monthsValue){const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/),months=Number(monthsValue);if(!m||!Number.isSafeInteger(months)||months<1||months>120)return'';const y=Number(m[1]),mo=Number(m[2]),day=Number(m[3]),source=new Date(Date.UTC(y,mo-1,day));if(source.getUTCFullYear()!==y||source.getUTCMonth()!==mo-1||source.getUTCDate()!==day)return'';const target=new Date(Date.UTC(y,mo-1+months,1)),last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();target.setUTCDate(Math.min(day,last));return target.toISOString().slice(0,10);}
function formatDate(value){const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:'';}
async function getJson(url){const response=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});let data;try{data=await response.json();}catch(error){throw new Error('The server returned an invalid response.');}if(!response.ok||!data.success){const failure=new Error(data.message||'Unable to load reseller data.');failure.code=data.code||'RESELLER_REQUEST_FAILED';failure.status=response.status;throw failure;}return data;}
function showError(message){const box=document.getElementById('workspaceError');if(!box)return;box.textContent=String(message||'An unexpected error occurred.');box.classList.remove('d-none');}
function clearError(){const box=document.getElementById('workspaceError');if(box){box.textContent='';box.classList.add('d-none');}}
async function signOut(){const button=document.getElementById('logoutButton');if(!button)return;button.disabled=true;try{const response=await fetch('/api/resellers/logout',{method:'POST',headers:{Accept:'application/json'}});let result;try{result=await response.json();}catch(error){throw new Error('The server returned an invalid sign-out response.');}if(!response.ok||!result.success)throw new Error(result.message||'Sign out failed.');window.location.assign('/reseller/login');}catch(error){showError(error.message);button.disabled=false;}}
function initializeSidebar(){
 const toggle=document.getElementById('resellerSidebarToggle'),backdrop=document.getElementById('resellerSidebarBackdrop'),sidebar=document.getElementById('resellerSidebar');let lockedScrollY=0,isOpen=false;
 const lock=()=>{lockedScrollY=window.scrollY||window.pageYOffset||0;Object.assign(document.body.style,{position:'fixed',top:'-'+lockedScrollY+'px',left:'0',right:'0',width:'100%'});};
 const unlock=()=>{Object.assign(document.body.style,{position:'',top:'',left:'',right:'',width:''});window.scrollTo(0,lockedScrollY);};
 const close=()=>{if(!isOpen)return;isOpen=false;document.body.classList.remove('reseller-sidebar-open');backdrop?.classList.remove('show');toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Open navigation');unlock();};
 const open=()=>{if(isOpen)return;isOpen=true;lock();document.body.classList.add('reseller-sidebar-open');backdrop?.classList.add('show');toggle?.setAttribute('aria-expanded','true');toggle?.setAttribute('aria-label','Close navigation');sidebar?.querySelector('a,button')?.focus({preventScroll:true});};
 toggle?.addEventListener('click',()=>isOpen?close():open());backdrop?.addEventListener('click',close);document.querySelectorAll('.reseller-nav a').forEach(link=>link.addEventListener('click',close));document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});window.addEventListener('resize',()=>{if(window.innerWidth>991.98)close();});
}
window.ResellerWorkspace={api,escapeHtml,money,date,getJson,showError,clearError,bangladeshToday,addCalendarMonths,formatDate};
document.addEventListener('DOMContentLoaded',()=>{initializeSidebar();document.getElementById('logoutButton')?.addEventListener('click',signOut);});
})();
