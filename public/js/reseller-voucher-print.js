(function(){
'use strict';
function print(format){
 document.body.classList.remove('print-thermal-58','print-thermal-80');
 if(format!=='a4')document.body.classList.add('print-'+format);
 window.print();
}
document.addEventListener('DOMContentLoaded',function(){
 const voucherGrid=document.querySelector('.voucher-grid');
 const templateSelect=document.getElementById('voucherTemplate');
 const validTemplate=value=>['basic','standard','pro'].includes(value)?value:'standard';
 const applyTemplate=function(value){
  const template=validTemplate(value);
  document.body.dataset.template=template;
  if(templateSelect)templateSelect.value=template;
  if(voucherGrid){
   voucherGrid.classList.remove('template-basic','template-standard','template-pro');
   voucherGrid.classList.add('template-'+template);
   voucherGrid.querySelectorAll('.voucher').forEach(function(card){
    card.classList.remove('voucher-basic','voucher-standard','voucher-pro');
    card.classList.add('voucher-'+template);
   });
  }
 };
 applyTemplate(document.body.dataset.template);
 if(templateSelect)templateSelect.addEventListener('change',function(){applyTemplate(templateSelect.value);});
 document.querySelectorAll('[data-print-format]').forEach(function(button){
  button.addEventListener('click',function(){print(button.dataset.printFormat||'a4');});
 });
 window.addEventListener('afterprint',function(){document.body.classList.remove('print-thermal-58','print-thermal-80');});
});
})();
