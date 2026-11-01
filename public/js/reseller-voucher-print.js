(function(){
'use strict';
function loginUrl(host,username,password){
 const value=String(host||'login.hotspot').trim();
 const origin=/^https?:\/\//i.test(value)?value:'http://'+value;
 return origin.replace(/\/+$/,'')+'/login?username='+encodeURIComponent(username)+'&password='+encodeURIComponent(password);
}
function print(format){
 document.body.classList.remove('print-thermal-58','print-thermal-80');
 if(format!=='a4')document.body.classList.add('print-'+format);
 window.print();
}
document.addEventListener('DOMContentLoaded',function(){
 const sheet=document.querySelector('.sheet[data-login-host]');if(!sheet)return;
 const host=sheet.dataset.loginHost||'login.hotspot';
 document.querySelectorAll('.voucher[data-username]').forEach(function(card){
  const target=card.querySelector('.qr');if(!target)return;
  if(typeof window.QRCode!=='function'){target.textContent='QR unavailable';console.error('[Reseller voucher print] QRCode library did not load.');return;}
  new window.QRCode(target,{text:loginUrl(host,card.dataset.username||'',card.dataset.password||''),width:72,height:72});
 });
 document.querySelectorAll('[data-print-format]').forEach(function(button){
  button.addEventListener('click',function(){print(button.dataset.printFormat||'a4');});
 });
 window.addEventListener('afterprint',function(){document.body.classList.remove('print-thermal-58','print-thermal-80');});
});
})();