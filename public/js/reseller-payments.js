(function () {
  'use strict';
  const {api,escapeHtml,money,date,getJson,showError,clearError}=window.ResellerWorkspace;
  const customerSelect=document.getElementById('paymentCustomer');const rows=document.getElementById('paymentRows');
  async function loadPayments(customerId) {
    clearError();rows.innerHTML='<tr><td colspan="5" class="text-center text-secondary py-4">Loading payment history…</td></tr>';
    if(!customerId){rows.innerHTML='<tr><td colspan="5" class="text-center text-secondary py-4">Select a customer to view payment history.</td></tr>';return;}
    try {
      const result=await getJson(api+'/customers/'+encodeURIComponent(customerId)+'/payments');const payments=result.payments||[];
      if(!payments.length){rows.innerHTML='<tr><td colspan="5" class="text-center text-secondary py-4">No PPPoE payment records found for this customer.</td></tr>';return;}
      rows.innerHTML=payments.map(payment=>'<tr><td>'+date(payment.created_at)+'</td><td class="font-monospace">'+escapeHtml(payment.trx_id||'—')+'</td><td>'+escapeHtml(payment.channel||'—')+'</td><td>'+money(payment.amount)+'</td><td><span class="badge '+(String(payment.status).toUpperCase()==='PAID'?'badge-soft':'badge-muted')+'">'+escapeHtml(payment.status)+'</span></td></tr>').join('');
    } catch(error) { rows.innerHTML='<tr><td colspan="5" class="text-center text-danger py-4">Payment history could not be loaded.</td></tr>';showError(error.message); }
  }
  async function initialize() {
    try {
      const [overview,customers]=await Promise.all([getJson(api+'/overview'),getJson(api+'/customers')]);const metrics=overview.metrics||{};
      document.getElementById('paymentMonthlyCollection').textContent=money(metrics.monthlyCollectionAmount);
      document.getElementById('paymentMonthlyRenewals').textContent=metrics.monthlyRenewalCount??0;
      document.getElementById('paymentAssignedPops').textContent=metrics.assignedPopCount??0;
      const list=customers.customers||[];
      customerSelect.innerHTML='<option value="">Select a customer</option>'+list.map(customer=>'<option value="'+escapeHtml(customer.id)+'">'+escapeHtml(customer.full_name)+' · '+escapeHtml(customer.username)+'</option>').join('');
      if(list.length){customerSelect.value=String(list[0].id);await loadPayments(list[0].id);}
      else rows.innerHTML='<tr><td colspan="5" class="text-center text-secondary py-4">No assigned customers are available.</td></tr>';
    } catch(error) { showError(error.message);rows.innerHTML='<tr><td colspan="5" class="text-center text-danger py-4">Reports data could not be loaded.</td></tr>'; }
  }
  document.addEventListener('DOMContentLoaded',()=>{customerSelect.addEventListener('change',()=>loadPayments(customerSelect.value));document.getElementById('refreshPayments').addEventListener('click',()=>loadPayments(customerSelect.value));initialize();});
})();
