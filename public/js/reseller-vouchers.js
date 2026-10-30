(function () {
  'use strict';
  const {api,escapeHtml,money,date,getJson,showError} = window.ResellerWorkspace;
  const state = {catalog:null,pendingIdempotencyKey:null};
  const byId = id => document.getElementById(id);
  function alertBox(id,message) { const box=byId(id); if(box){box.textContent=message;box.classList.remove('d-none');} }
  function clearAlert(id) { const box=byId(id); if(box){box.textContent='';box.classList.add('d-none');} }
  function selectedPop() { return (state.catalog?.pops||[]).find(pop=>String(pop.id)===byId('voucherPop')?.value)||null; }
  function selectedPackage() { const pop=selectedPop();return pop?.packages.find(pkg=>String(pkg.id)===byId('voucherPackage')?.value)||null; }
  function renderAccount() {
    const box=byId('voucherAccount');const account=state.catalog?.account;if(!box)return;
    if(!account){box.textContent='No active reseller billing account is configured. Voucher issuance is unavailable; contact FAZ NETWORK support.';return;}
    if(account.status!=='active'){box.textContent='Your reseller billing account is '+account.status+'. Voucher issuance is unavailable.';return;}
    box.textContent=account.billingMode==='prepaid'?'Prepaid wallet balance: '+money(account.walletBalance)+' · Currency: '+escapeHtml(account.currency):'Postpaid receivable: '+money(account.receivableBalance)+' · Credit limit: '+money(account.creditLimit)+' · Available credit: '+money(Math.max(0,Number(account.creditLimit)-Number(account.receivableBalance)));
  }
  function updatePricing() {
    const pkg=selectedPackage();const quantity=Number(byId('voucherQuantity').value);const valid=Number.isSafeInteger(quantity)&&quantity>=1&&quantity<=500;
    const retail=pkg?Number(pkg.retailPrice):0;const wholesale=pkg?Number(pkg.wholesalePrice):0;const margin=retail-wholesale;const fmt=value=>pkg?money(value):'৳—';
    byId('voucherRetail').textContent=fmt(retail);byId('voucherWholesale').textContent=fmt(wholesale);byId('voucherMargin').textContent=fmt(margin);
    byId('voucherRetailTotal').textContent=fmt(retail*(valid?quantity:0));byId('voucherCostTotal').textContent=fmt(wholesale*(valid?quantity:0));byId('voucherMarginTotal').textContent=fmt(margin*(valid?quantity:0));
    const account=state.catalog?.account;const total=wholesale*(valid?quantity:0);
    const shortfall=account?.billingMode==='prepaid'&&Number(account.walletBalance)<total;
    const overLimit=account?.billingMode==='postpaid'&&(Number(account.receivableBalance)+total>Number(account.creditLimit));
    const canIssue=Boolean(pkg&&valid&&account&&account.status==='active'&&margin>=0&&wholesale>0&&!shortfall&&!overLimit);
    byId('generateVouchersButton').disabled=!canIssue;
    const impact=byId('voucherImpact');
    if(!pkg||!valid)impact.textContent='Select an eligible package and a whole quantity from 1 to 500 to preview your account impact.';
    else if(!account||account.status!=='active')impact.textContent='No active billing account is available. Voucher issuance is blocked.';
    else if(account.billingMode==='prepaid')impact.textContent='Confirmation: '+quantity+' vouchers will debit '+money(total)+' from your prepaid wallet. Current balance: '+money(account.walletBalance)+' · Estimated balance after issue: '+money(Number(account.walletBalance)-total)+'.';
    else impact.textContent='Confirmation: '+quantity+' vouchers will add '+money(total)+' to your postpaid receivable. Current receivable: '+money(account.receivableBalance)+' · Estimated receivable after issue: '+money(Number(account.receivableBalance)+total)+' · Credit limit: '+money(account.creditLimit)+'.';
    if(pkg&&wholesale<=0)alertBox('voucherError','This package is not available for reseller issuance because wholesale price must be greater than ৳0. Promotional and free vouchers are issued by an administrator.');
    else if(pkg&&margin<0)alertBox('voucherError','This package is not eligible because wholesale cost exceeds retail price.');
    else if(!valid)alertBox('voucherError','Quantity must be a whole number from 1 to 500.');
    else if(shortfall)alertBox('voucherError','Your prepaid wallet balance is insufficient for this batch.');
    else if(overLimit)alertBox('voucherError','This batch would exceed your available postpaid credit limit.');
    else clearAlert('voucherError');
  }
  function renderPackageOptions() {
    const pop=selectedPop();const select=byId('voucherPackage');const packages=pop?.packages||[];
    select.innerHTML=packages.length?packages.map(pkg=>'<option value="'+escapeHtml(pkg.id)+'">'+escapeHtml(pkg.name)+' · '+escapeHtml(pkg.validity)+'</option>').join(''):'<option value="">No active packages for this POP</option>';
    select.disabled=!packages.length;updatePricing();
  }
  function renderPopOptions() {
    const select=byId('voucherPop');const pops=state.catalog?.pops||[];
    select.innerHTML=pops.length?pops.map(pop=>'<option value="'+escapeHtml(pop.id)+'">'+escapeHtml(pop.name)+'</option>').join(''):'<option value="">No eligible active POPs</option>';
    select.disabled=!pops.length;renderPackageOptions();renderAccount();
  }
  async function loadCatalog() {
    try { state.catalog=await getJson(api+'/hotspot/catalog');renderPopOptions(); }
    catch(error) { alertBox('voucherError',error.message);byId('voucherPop').innerHTML='<option value="">Catalog unavailable</option>';byId('voucherPackage').disabled=true; }
  }
  function renderIssued(result) {
    const target=byId('voucherIssuedResult');const vouchers=result.vouchers||[];const batch=result.batch||{};
    target.innerHTML='<div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3"><div><h3 class="h6 fw-bold mb-1">Voucher batch issued</h3><div class="small text-secondary">Reference: '+escapeHtml(batch.batchKey||'')+'</div></div><a class="btn btn-sm btn-outline-success" target="_blank" rel="noopener" href="/reseller/hotspot/voucher-batches/'+encodeURIComponent(batch.batchKey)+'/print"><i class="bi bi-printer me-1"></i>Print / Reprint</a></div><div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th>#</th><th>Username / PIN</th><th>Password</th><th>Validity</th></tr></thead><tbody>'+vouchers.map((v,i)=>'<tr><td>'+(i+1)+'</td><td class="font-monospace">'+escapeHtml(v.username)+'</td><td class="font-monospace">'+escapeHtml(v.password)+'</td><td>'+escapeHtml(v.validity||batch.validity||'—')+'</td></tr>').join('')+'</tbody></table></div>';
    target.classList.remove('d-none');
  }
  async function loadHistory() {
    const body=byId('voucherHistoryRows');clearAlert('voucherHistoryError');body.innerHTML='<tr><td colspan="8" class="text-center text-secondary py-4">Loading voucher history…</td></tr>';
    try {
      const result=await getJson(api+'/hotspot/voucher-batches?limit=100');const batches=result.batches||[];
      if(!batches.length){body.innerHTML='<tr><td colspan="8" class="text-center text-secondary py-4">No voucher batches have been issued yet.</td></tr>';return;}
      body.innerHTML=batches.map(batch=>'<tr><td>'+date(batch.createdAt)+'</td><td class="font-monospace small">'+escapeHtml(batch.batchKey)+'</td><td>POP #'+escapeHtml(batch.popId)+'</td><td>'+escapeHtml(batch.profileKey)+'</td><td>'+escapeHtml(batch.issuedCount)+' / '+escapeHtml(batch.quantity)+'</td><td>'+money(batch.wholesaleTotal)+'</td><td class="text-success fw-semibold">'+money(batch.marginTotal)+'</td><td><a class="btn btn-sm btn-outline-success" target="_blank" rel="noopener" href="/reseller/hotspot/voucher-batches/'+encodeURIComponent(batch.batchKey)+'/print"><i class="bi bi-printer me-1"></i>View / Print</a></td></tr>').join('');
    } catch(error) { body.innerHTML='<tr><td colspan="8" class="text-center text-danger py-4">Voucher history could not be loaded.</td></tr>';alertBox('voucherHistoryError',error.message); }
  }
  async function issueBatch() {
    clearAlert('voucherError');clearAlert('voucherSuccess');
    const pop=selectedPop();const pkg=selectedPackage();const quantity=Number(byId('voucherQuantity').value);const button=byId('generateVouchersButton');
    if(!pop||!pkg||!Number.isSafeInteger(quantity)||quantity<1||quantity>500){alertBox('voucherError','Select an eligible POP and package, and enter a whole quantity from 1 to 500.');return;}
    if(!state.pendingIdempotencyKey){if(!window.crypto?.randomUUID){alertBox('voucherError','Secure request identifiers are unavailable in this browser. Refresh the page or contact support.');return;}state.pendingIdempotencyKey=window.crypto.randomUUID();}
    button.disabled=true;button.innerHTML='<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Issuing…';
    try {
      const response=await fetch(api+'/hotspot/voucher-batches',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','Idempotency-Key':state.pendingIdempotencyKey},body:JSON.stringify({popId:pop.id,packageId:pkg.id,quantity})});
      let result;try{result=await response.json();}catch(error){throw new Error('The server returned an invalid response.');}
      if(!response.ok||!result.success)throw new Error(result.message||'Voucher issuance failed.');
      state.pendingIdempotencyKey=null;renderIssued(result);alertBox('voucherSuccess',result.message||'Voucher batch issued successfully.');
      if(result.account&&state.catalog?.account)Object.assign(state.catalog.account,{walletBalance:result.account.walletBalance,receivableBalance:result.account.receivableBalance,creditLimit:result.account.creditLimit});
      renderAccount();
    } catch(error) { alertBox('voucherError',error.message); }
    finally { button.innerHTML='<i class="bi bi-ticket-perforated me-2"></i>Generate voucher batch';updatePricing(); }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(byId('voucherPop')) {
      byId('voucherPop').addEventListener('change',()=>{state.pendingIdempotencyKey=null;renderPackageOptions();});
      byId('voucherPackage').addEventListener('change',()=>{state.pendingIdempotencyKey=null;updatePricing();});
      byId('voucherQuantity').addEventListener('input',()=>{state.pendingIdempotencyKey=null;updatePricing();});
      byId('generateVouchersButton').addEventListener('click',issueBatch);
      loadCatalog();
    }
    if(byId('voucherHistoryRows')) {
      byId('refreshVoucherHistory').addEventListener('click',loadHistory);
      loadHistory();
    }
  });
})();
