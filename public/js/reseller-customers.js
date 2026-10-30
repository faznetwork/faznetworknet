(function () {
  'use strict';
  const {api,escapeHtml,money,date,getJson,showError,clearError} = window.ResellerWorkspace;
  const state={customers:[],pops:[],packages:[]};const byId=id=>document.getElementById(id);
  function activePops(){return state.pops.filter(pop=>String(pop.status||'active').toLowerCase()==='active');}
  function renderDirectory() {
    const query=byId('customerSearch').value.trim().toLowerCase();const popId=byId('popFilter').value;
    const rows=state.customers.filter(customer=>(!popId||String(customer.pop_id)===popId)&&(!query||[customer.full_name,customer.username,customer.package_name,customer.pop_name].some(value=>String(value||'').toLowerCase().includes(query))));
    const body=byId('customerRows');
    if(!rows.length)body.innerHTML='<tr><td colspan="8"><div class="empty-state"><i class="bi bi-search d-block mb-2"></i>No matching customers found.</div></td></tr>';
    else body.innerHTML=rows.map(customer=>'<tr data-customer-id="'+escapeHtml(customer.id)+'"><td class="fw-semibold">'+escapeHtml(customer.full_name)+'</td><td class="font-monospace small">'+escapeHtml(customer.username)+'</td><td>'+escapeHtml(customer.package_name)+'</td><td>'+date(customer.expiration_date)+'</td><td>'+escapeHtml(customer.pop_name)+'</td><td class="live-cell"><span class="text-secondary small">Checking…</span></td><td><span class="badge '+(String(customer.status||'').toLowerCase()==='active'?'badge-soft':'badge-muted')+'">'+escapeHtml(customer.status)+'</span></td><td><a class="btn btn-sm btn-outline-success" href="/reseller/customers/'+encodeURIComponent(customer.id)+'">View profile</a></td></tr>').join('');
    byId('customerCount').textContent='Showing '+rows.length+' of '+state.customers.length+' assigned customers';
    refreshLiveStatuses(rows);
  }
  async function refreshLiveStatuses(rows) {
    const queue=[...rows];const worker=async()=>{while(queue.length){const customer=queue.shift();const cell=document.querySelector('tr[data-customer-id="'+CSS.escape(String(customer.id))+'"] .live-cell');if(!cell)continue;try{const result=await getJson(api+'/customers/'+encodeURIComponent(customer.id)+'/live-session');if(!result.liveStatusAvailable){cell.innerHTML='<span class="badge text-bg-secondary">Status Unavailable</span>';continue;}const online=Boolean(result.live?.online);cell.innerHTML='<span class="small"><span class="status-dot '+(online?'online':'offline')+'"></span>'+(online?'Online':'Offline')+'</span>';}catch(error){cell.innerHTML='<span class="badge text-bg-secondary">Status Unavailable</span>';}}};await Promise.all(Array.from({length:Math.min(4,queue.length)},worker));
  }
  function renderPopOptions() {
    const select=byId('newCustomerPop');const packageSelect=byId('newCustomerPackage');const pops=activePops();
    select.innerHTML='<option value="">Select an active POP</option>'+pops.map(pop=>'<option value="'+escapeHtml(pop.id)+'">'+escapeHtml(pop.name)+'</option>').join('');
    select.disabled=!pops.length;
    packageSelect.innerHTML='<option value="">Select an internet package</option>'+state.packages.map(pkg=>'<option value="'+escapeHtml(pkg.name)+'" data-profile="'+escapeHtml(pkg.profileName)+'">'+escapeHtml(pkg.name)+' · '+money(pkg.price)+' / month</option>').join('');
    packageSelect.disabled=!state.packages.length;byId('submitCustomerCreate').disabled=!pops.length||!state.packages.length;updateInheritedFields();
  }
  function updateInheritedFields() {
    const selected=activePops().find(pop=>String(pop.id)===byId('newCustomerPop').value);
    byId('newCustomerVlan').value=selected?.vlan_id??'Not configured';
    byId('newCustomerIpPool').value=selected?.mikrotik_ip_pool||'Not configured';
  }
  function showFormError(message) {
    const box=byId('customerCreateError');box.textContent=message;box.classList.remove('d-none');
  }
  async function loadCustomerData() {
    clearError();
    try {
      const [overview,directory]=await Promise.all([getJson(api+'/overview'),getJson(api+'/customers')]);
      state.pops=overview.pops||[];state.customers=directory.customers||[];
      if(byId('customerRows')) {
        const filter=byId('popFilter');filter.innerHTML='<option value="">All assigned POPs</option>'+state.pops.map(pop=>'<option value="'+escapeHtml(pop.id)+'">'+escapeHtml(pop.name)+'</option>').join('');
        renderDirectory();
      }
    } catch(error) { showError(error.message);if(byId('customerRows'))byId('customerRows').innerHTML='<tr><td colspan="8" class="text-center text-danger py-4">Customer directory could not be loaded.</td></tr>'; }
  }
  async function loadCreateCatalog() {
    try {
      const [overview,catalog]=await Promise.all([getJson(api+'/overview'),getJson(api+'/packages')]);
      state.pops=overview.pops||[];state.packages=catalog.packages||[];renderPopOptions();
    } catch(error) { showError(error.message);byId('newCustomerPop').disabled=true;byId('newCustomerPackage').disabled=true;byId('submitCustomerCreate').disabled=true; }
  }
  async function submitCustomer(event) {
    event.preventDefault();clearError();const form=event.currentTarget;const button=byId('submitCustomerCreate');
    if(!form.reportValidity())return;
    const popId=byId('newCustomerPop').value;const selectedPop=activePops().find(pop=>String(pop.id)===popId);const packageOption=byId('newCustomerPackage').selectedOptions[0];
    if(!selectedPop||!packageOption?.value){showFormError('Select an active assigned POP and a configured internet package.');return;}
    const payload=Object.fromEntries(new FormData(form).entries());payload.pop_id=popId;payload.packageProfile=packageOption.dataset.profile;payload.profile=packageOption.dataset.profile;payload.areaZone=selectedPop.area_zone||'';
    button.disabled=true;button.innerHTML='<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Creating…';
    try {
      const response=await fetch(api+'/customers',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(payload)});
      let result;try{result=await response.json();}catch(error){throw new Error('The server returned an invalid response.');}
      if(response.status!==201||!result.success)throw new Error(result.message||'Customer creation failed.');
      byId('customerCreateSuccess').textContent=result.message||'Customer created successfully.';byId('customerCreateSuccess').classList.remove('d-none');form.reset();updateInheritedFields();
    } catch(error) { showFormError(error.message); }
    finally { button.innerHTML='<i class="bi bi-person-check me-1"></i>Create customer';button.disabled=!activePops().length||!state.packages.length; }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(byId('customerRows')){byId('customerSearch').addEventListener('input',renderDirectory);byId('popFilter').addEventListener('change',renderDirectory);loadCustomerData();}
    if(byId('customerCreateForm')){byId('newCustomerPop').addEventListener('change',updateInheritedFields);byId('customerCreateForm').addEventListener('submit',submitCustomer);loadCreateCatalog();}
  });
})();
