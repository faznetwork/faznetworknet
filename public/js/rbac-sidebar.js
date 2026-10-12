'use strict';
(function(){
  const body=document.body;
  const role=String(body.dataset.userRole||'super_admin');
  const currentUserId=Number(body.dataset.adminId||0);
  const allowedTopMenus=role==='super_admin'?null:role==='admin'
    ?new Set(['Dashboard','Customer','Report','Payments','Account & Support','Staff Management'])
    :new Set(['Dashboard','Customer','Account & Support']);
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function applyRoleNavigation(){
    document.querySelectorAll('#sidebar > .sidebar-menu > .menu-item').forEach(item=>{
      const label=(item.querySelector(':scope > a span, :scope > button span')?.textContent||'').trim();
      if(allowedTopMenus&&!allowedTopMenus.has(label)) item.hidden=true;
      if(role==='staff'){
        item.querySelectorAll('a,button').forEach(control=>{
          const text=(control.textContent||'').trim().toLowerCase();
          if(/add customer|due collection|add expenses|delete|edit|sync|push exp|restore missing|settings|manage|payment|invoice|billing/.test(text)) control.hidden=true;
        });
        if(label==='Customer') item.querySelectorAll('.submenu > li').forEach(li=>{
          if(/add customer|due collection/i.test(li.textContent||'')) li.hidden=true;
        });
      }
    });
    document.querySelectorAll('[data-rbac-roles]').forEach(el=>{
      const allowed=String(el.dataset.rbacRoles||'').split(',').map(x=>x.trim());
      el.hidden=!allowed.includes(role);
    });
    const roleSelect=document.getElementById('rbacRole');
    if(roleSelect&&role!=='super_admin'){
      roleSelect.querySelector('[data-super-admin-only]')?.remove();
      if(role==='admin'){roleSelect.innerHTML='<option value="staff">Staff</option>';roleSelect.value='staff';}
    }
  }
  window.loadStaffInvitations=async function(){
    const tbody=document.getElementById('rbacInvitationsBody');
    if(!tbody)return;
    tbody.innerHTML='<tr><td colspan="6" class="text-center text-muted py-4">Loading invitations…</td></tr>';
    try{
      const response=await fetch('/api/admin/users/invitations',{credentials:'same-origin',headers:{Accept:'application/json'}});
      const data=await response.json();
      if(!response.ok||!data.success)throw new Error(data.message||'Unable to load invitations.');
      tbody.innerHTML=(data.invitations||[]).map(inv=>{
        const created=inv.created_at?new Date(inv.created_at).toLocaleString('en-GB',{timeZone:'Asia/Dhaka'}):'—';
        const expires=inv.expires_at?new Date(inv.expires_at).toLocaleString('en-GB',{timeZone:'Asia/Dhaka'}):'—';
        const canCancel=inv.status==='pending';
        return '<tr><td class="fw-semibold">'+esc(inv.username)+'</td><td>'+esc(inv.email)+'</td><td>'+esc(inv.role)+'</td><td>'+esc(created)+'</td><td>'+esc(expires)+'</td><td>'+(canCancel?'<button class="btn btn-sm btn-outline-danger" type="button" data-cancel-invitation="'+Number(inv.id)+'" data-invitation-email="'+esc(inv.email)+'"><i class="bi bi-x-circle me-1"></i>Cancel</button>':'<span class="badge text-bg-danger">Email failed</span>')+'</td></tr>';
      }).join('')||'<tr><td colspan="6" class="text-center text-muted py-4">No pending invitations.</td></tr>';
      tbody.querySelectorAll('[data-cancel-invitation]').forEach(button=>button.addEventListener('click',async()=>{
        if(!window.confirm('Cancel the invitation for '+button.dataset.invitationEmail+'? The link will stop working.'))return;
        button.disabled=true;
        try{
          const response=await fetch('/api/admin/users/invitations/'+button.dataset.cancelInvitation,{method:'DELETE',credentials:'same-origin',headers:{Accept:'application/json'}});
          const data=await response.json();
          if(!response.ok||!data.success)throw new Error(data.message||'Unable to cancel invitation.');
          window.alert(data.message||'Invitation cancelled.');
          await window.loadStaffInvitations();
        }catch(error){window.alert(error.message);button.disabled=false;}
      }));
    }catch(error){tbody.innerHTML='<tr><td colspan="6" class="text-danger text-center py-4">'+esc(error.message)+'</td></tr>';}
  };
  window.loadStaffManagement=async function(){
    if(!['super_admin','admin'].includes(role)){window.alert('You do not have permission to view staff management.');return;}
    if(typeof window.switchView==='function') window.switchView('staff-management');
    const tbody=document.getElementById('rbacUsersBody');
    if(!tbody)return;
    tbody.innerHTML='<tr><td colspan="7" class="text-center text-muted py-4">Loading accounts…</td></tr>';
    try{
      const response=await fetch('/api/admin/users',{credentials:'same-origin',headers:{Accept:'application/json'}});
      const data=await response.json();
      if(!response.ok||!data.success)throw new Error(data.message||'Unable to load accounts.');
      tbody.innerHTML=(data.users||[]).map(user=>{
        const created=user.created_at?new Date(user.created_at).toLocaleDateString('en-GB',{timeZone:'Asia/Dhaka'}):'—';
        const active=String(user.status)==='active';
        const userId=Number(user.id);
        const isSelf=currentUserId>0&&userId===currentUserId;
        // The owner's separate legacy login is not stored in admin_users.
        // Only that owner session may manage DB-backed Super Admin rows.
        const canManage=!isSelf&&(role==='super_admin'||(role==='admin'&&user.role==='staff'));
        const canDelete=canManage;
        const canResend=canManage&&user.is_first_login===true;
        const actionLabel=isSelf?'<span class="badge text-bg-light border">Current account</span>':!canManage?'—':'';
        return '<tr><td class="fw-semibold">'+esc(user.username)+'</td><td>'+esc(user.email)+'</td><td><span class="badge text-bg-'+(user.role==='super_admin'?'dark':user.role==='admin'?'primary':'secondary')+'">'+esc(user.role)+'</span></td><td>'+(user.is_first_login?'Pending verification':'Verified')+'</td><td><span class="badge text-bg-'+(active?'success':'secondary')+'">'+esc(user.status)+'</span></td><td>'+esc(created)+'</td><td><div class="d-flex flex-wrap gap-1">'+(canResend?'<button type="button" class="btn btn-sm btn-outline-primary" data-resend-invitation="'+userId+'" data-resend-email="'+esc(user.email)+'">Send invitation</button>':'')+(canManage?'<button type="button" class="btn btn-sm '+(active?'btn-outline-danger':'btn-outline-success')+'" data-user-id="'+userId+'" data-next-status="'+(active?'disabled':'active')+'">'+(active?'Disable':'Enable')+'</button>':'')+(canDelete?'<button type="button" class="btn btn-sm btn-danger" data-delete-user-id="'+userId+'" data-delete-username="'+esc(user.username)+'"><i class="bi bi-trash3 me-1"></i>Delete</button>':'')+actionLabel+'</div></td></tr>';
      }).join('')||'<tr><td colspan="7" class="text-center text-muted py-4">No accounts found.</td></tr>';
      tbody.querySelectorAll('button[data-resend-invitation]').forEach(button=>button.addEventListener('click',async()=>{
        if(!window.confirm('Send a secure invitation link to '+button.dataset.resendEmail+'?'))return;
        button.disabled=true;
        try{
          const response=await fetch('/api/admin/users/'+button.dataset.resendInvitation+'/resend-invitation',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json'}});
          const data=await response.json();
          if(!response.ok||!data.success)throw new Error(data.message||'Unable to send invitation.');
          window.alert(data.message||'Invitation sent.');
          await window.loadStaffInvitations();
        }catch(error){window.alert(error.message);button.disabled=false;}
      }));
      tbody.querySelectorAll('button[data-delete-user-id]').forEach(button=>button.addEventListener('click',async()=>{
        const username=button.dataset.deleteUsername||'this account';
        if(!window.confirm('Permanently delete '+username+'? This cannot be undone.'))return;
        button.disabled=true;
        try{
          const response=await fetch('/api/admin/users/'+button.dataset.deleteUserId,{method:'DELETE',credentials:'same-origin',headers:{Accept:'application/json'}});
          const data=await response.json();
          if(!response.ok||!data.success)throw new Error(data.message||'Unable to delete account.');
          window.alert(data.message||'Account deleted.');
          await window.loadStaffManagement();
        }catch(error){window.alert(error.message);button.disabled=false;}
      }));
      window.loadStaffInvitations();
      tbody.querySelectorAll('button[data-user-id]').forEach(button=>button.addEventListener('click',async()=>{
        if(!window.confirm('Change this account status?'))return;
        button.disabled=true;
        try{
          const response=await fetch('/api/admin/users/'+button.dataset.userId+'/status',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({status:button.dataset.nextStatus})});
          const data=await response.json();
          if(!response.ok||!data.success)throw new Error(data.message||'Unable to update account.');
          await window.loadStaffManagement();
        }catch(error){window.alert(error.message);button.disabled=false;}
      }));
    }catch(error){tbody.innerHTML='<tr><td colspan="7" class="text-danger text-center py-4">'+esc(error.message)+'</td></tr>';}
  };
  document.addEventListener('DOMContentLoaded',applyRoleNavigation,{once:true});
  if(document.readyState!=='loading')applyRoleNavigation();
  if(role==='staff'){
    const hideMutationControls=root=>{
      (root||document).querySelectorAll('button,a,[role="button"]').forEach(control=>{
        const label=(control.getAttribute('title')||control.getAttribute('aria-label')||control.textContent||'').trim().toLowerCase();
        if(/\b(edit|delete|remove|renew|kick|provision|sync|restore|change package|mark paid|manual match|push exp)\b/.test(label)) control.hidden=true;
      });
      (root||document).querySelectorAll('input[type="submit"],button[type="submit"]').forEach(control=>{
        const label=(control.textContent||control.value||'').trim().toLowerCase();
        if(/save|create|update|delete|renew|provision|sync/.test(label)) control.hidden=true;
      });
    };
    hideMutationControls();
    const dynamicContent=document.getElementById('dynamicPageContent');
    if(dynamicContent&&typeof MutationObserver!=='undefined'){
      new MutationObserver(()=>hideMutationControls(dynamicContent)).observe(dynamicContent,{childList:true,subtree:true});
    }
  }
  const form=document.getElementById('rbacCreateUserForm');
  if(form)form.addEventListener('submit',async event=>{
    event.preventDefault();
    const result=document.getElementById('rbacCreateUserResult');
    const button=document.getElementById('rbacCreateUserBtn');
    result.className='small text-muted';result.textContent='Sending invitation email…';button.disabled=true;
    try{
      const payload=Object.fromEntries(new FormData(form).entries());
      const response=await fetch('/api/admin/users',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json();
      if(!response.ok||!data.success)throw new Error(data.message||'Unable to create account.');
      result.className='small text-success';result.textContent=data.message||'Invitation sent.';form.reset();
      await window.loadStaffInvitations();
      await window.loadStaffManagement();
    }catch(error){result.className='small text-danger';result.textContent=error.message;}
    finally{button.disabled=false;}
  });
  window.loadSupportTickets=async function(){
    if(typeof window.switchView==='function')window.switchView('support-tickets');
    const tbody=document.getElementById('rbacTicketsBody');
    if(!tbody)return;
    const createCard=document.getElementById('rbacTicketCreateCard');
    if(createCard)createCard.hidden=role==='staff';
    tbody.innerHTML='<tr><td colspan="7" class="text-center text-muted py-4">Loading tickets…</td></tr>';
    try{
      const response=await fetch('/api/admin/security/tickets',{credentials:'same-origin',headers:{Accept:'application/json'}});
      const data=await response.json();
      if(!response.ok||!data.success)throw new Error(data.message||'Unable to load tickets.');
      let staff=[];
      if(role!=='staff'){
        const staffResponse=await fetch('/api/admin/security/staff',{credentials:'same-origin',headers:{Accept:'application/json'}});
        const staffData=await staffResponse.json();
        if(staffResponse.ok&&staffData.success)staff=staffData.staff||[];
        const assignee=document.getElementById('ticketAssignee');
        if(assignee)assignee.innerHTML='<option value="">Unassigned</option>'+staff.map(s=>'<option value="'+Number(s.id)+'">'+esc(s.username)+'</option>').join('');
      }
      const statusOptions=['open','in_progress','resolved','closed'];
      tbody.innerHTML=(data.tickets||[]).map(ticket=>{
        const created=ticket.created_at?new Date(ticket.created_at).toLocaleString('en-GB',{timeZone:'Asia/Dhaka'}):'—';
        const actions=role==='staff'?'—':'<div class="d-flex flex-wrap gap-1"><select class="form-select form-select-sm" data-ticket-status="'+Number(ticket.id)+'">'+statusOptions.map(s=>'<option value="'+s+'" '+(s===ticket.status?'selected':'')+'>'+s.replace('_',' ')+'</option>').join('')+'</select><select class="form-select form-select-sm" data-ticket-assignee="'+Number(ticket.id)+'"><option value="">Unassigned</option>'+staff.map(s=>'<option value="'+Number(s.id)+'" '+(Number(s.id)===Number(ticket.assigned_to_user_id)?'selected':'')+'>'+esc(s.username)+'</option>').join('')+'</select><button class="btn btn-sm btn-outline-success" data-ticket-save="'+Number(ticket.id)+'">Save</button></div>';
        return '<tr><td><strong>#'+Number(ticket.id)+' '+esc(ticket.title)+'</strong><div class="small text-muted">'+esc(ticket.description)+'</div></td><td>'+esc(ticket.customer_username||'—')+'</td><td><span class="badge text-bg-'+(ticket.priority==='urgent'?'danger':ticket.priority==='high'?'warning':'secondary')+'">'+esc(ticket.priority)+'</span></td><td>'+esc(ticket.status)+'</td><td>'+esc(ticket.assigned_to_username||'Unassigned')+'</td><td>'+esc(created)+'</td><td>'+actions+'</td></tr>';
      }).join('')||'<tr><td colspan="7" class="text-center text-muted py-4">No tickets found.</td></tr>';
      tbody.querySelectorAll('[data-ticket-save]').forEach(button=>button.addEventListener('click',async()=>{
        button.disabled=true;
        try{
          const id=button.dataset.ticketSave;
          const status=tbody.querySelector('[data-ticket-status="'+id+'"]').value;
          const assigned=tbody.querySelector('[data-ticket-assignee="'+id+'"]').value;
          const response=await fetch('/api/admin/security/tickets/'+id,{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({status,assigned_to_user_id:assigned})});
          const data=await response.json();
          if(!response.ok||!data.success)throw new Error(data.message||'Unable to update ticket.');
          await window.loadSupportTickets();
        }catch(error){window.alert(error.message);button.disabled=false;}
      }));
    }catch(error){tbody.innerHTML='<tr><td colspan="7" class="text-danger text-center py-4">'+esc(error.message)+'</td></tr>';}
  };
  window.loadAuditLogs=async function(){
    if(role!=='super_admin'){window.alert('Only Super Admin can view audit logs.');return;}
    if(typeof window.switchView==='function')window.switchView('audit-logs');
    const tbody=document.getElementById('rbacAuditBody');
    if(!tbody)return;
    tbody.innerHTML='<tr><td colspan="7" class="text-center text-muted py-4">Loading audit logs…</td></tr>';
    try{
      const response=await fetch('/api/admin/security/audit-logs?limit=100',{credentials:'same-origin',headers:{Accept:'application/json'}});
      const data=await response.json();
      if(!response.ok||!data.success)throw new Error(data.message||'Unable to load audit logs.');
      tbody.innerHTML=(data.logs||[]).map(log=>'<tr><td>'+esc(log.created_at?new Date(log.created_at).toLocaleString('en-GB',{timeZone:'Asia/Dhaka'}):'—')+'</td><td>'+esc(log.actor_username)+'</td><td>'+esc(log.actor_role)+'</td><td>'+esc(log.action)+'</td><td>'+esc(log.target_user_id||'—')+'</td><td><code class="text-wrap">'+esc(JSON.stringify(log.details||{}))+'</code></td><td>'+esc(log.ip_address||'—')+'</td></tr>').join('')||'<tr><td colspan="7" class="text-center text-muted py-4">No audit events recorded yet.</td></tr>';
    }catch(error){tbody.innerHTML='<tr><td colspan="7" class="text-danger text-center py-4">'+esc(error.message)+'</td></tr>';}
  };
  // This deferred script replaces the main admin loaders after their initial route wrappers
  // are installed. Re-wrap these entry points so reload/back/forward retain the selected page.
  ['loadStaffManagement','loadSupportTickets','loadAuditLogs'].forEach(name=>{
    if(typeof window.__fazWrapAdminNavigation==='function')window.__fazWrapAdminNavigation(name);
  });

  const ticketForm=document.getElementById('rbacTicketForm');
  if(ticketForm)ticketForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const result=document.getElementById('rbacTicketResult'),button=document.getElementById('rbacTicketSubmit');
    result.className='small text-muted';result.textContent='Creating ticket…';button.disabled=true;
    try{
      const payload=Object.fromEntries(new FormData(ticketForm).entries());
      if(!payload.assigned_to_user_id)payload.assigned_to_user_id=null;
      const response=await fetch('/api/admin/security/tickets',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json();
      if(!response.ok||!data.success)throw new Error(data.message||'Unable to create ticket.');
      result.className='small text-success';result.textContent='Ticket #'+data.ticket.id+' created.';ticketForm.reset();
      await window.loadSupportTickets();
    }catch(error){result.className='small text-danger';result.textContent=error.message;}
    finally{button.disabled=false;}
  });

})();
