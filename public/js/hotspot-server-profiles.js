(function () {
  'use strict';

  const loginMethods = [
    ['mac', 'MAC'], ['http-pap', 'HTTP PAP'], ['http-chap', 'HTTP CHAP'],
    ['https', 'HTTPS'], ['cookie', 'Cookie'], ['mac-cookie', 'MAC Cookie'], ['trial', 'Trial']
  ];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const textField = (id, name, label, value, placeholder = '') => '<div class="mb-3"><label class="form-label fw-semibold" for="' + id + '">' + label + '</label><input id="' + id + '" name="' + name + '" class="form-control" maxlength="255" value="' + esc(value || '') + '" placeholder="' + esc(placeholder) + '"></div>';
  const passwordField = (id, name, label, value, placeholder = '') => '<div class="mb-3"><label class="form-label fw-semibold" for="' + id + '">' + label + '</label><input type="password" id="' + id + '" name="' + name + '" class="form-control" maxlength="255" value="' + esc(value || '') + '" placeholder="' + esc(placeholder) + '" autocomplete="new-password"></div>';
  const selectField = (id, name, label, value, options, emptyLabel = 'Select…') => '<div class="mb-3"><label class="form-label fw-semibold" for="' + id + '">' + label + '</label><select id="' + id + '" name="' + name + '" class="form-select"><option value="">' + esc(emptyLabel) + '</option>' + options.map(([key, labelText]) => '<option value="' + esc(key) + '" ' + (String(value || '') === String(key) ? 'selected' : '') + '>' + esc(labelText) + '</option>').join('') + (value && !options.some(([key]) => String(key) === String(value)) ? '<option value="' + esc(value) + '" selected>' + esc(value) + ' (current)</option>' : '') + '</select></div>';
  const toggleField = (name, label, checked) => '<label class="hs-server-login-option"><input type="checkbox" name="' + name + '" data-initial-checked="' + (checked ? 'true' : 'false') + '" ' + (checked ? 'checked' : '') + '><span class="fw-semibold small">' + label + '</span></label>';

  async function api(url, options) {
    const result = await window.jsonFetch(url, options);
    if (!result || result.success !== true) throw new Error(result?.message || result?.error || 'Hotspot server profile request failed.');
    return result;
  }

  function renderCard(profile) {
    if (String(profile.name || '').trim().toLowerCase() === 'default') return '';
    const protectedProfile = profile.protected === true;
    const enabled = new Set(Array.isArray(profile.loginBy) ? profile.loginBy.map(value => String(value).toLowerCase()) : []);
    const methods = loginMethods.map(([value, label]) => '<span class="badge ' + (enabled.has(value) ? '' : 'is-off') + '">' +
      (enabled.has(value) ? '<i class="bi bi-check2 me-1"></i>' : '') + label + '</span>').join('');
    return '<div class="col-12 col-xl-6"><article class="hs-server-profile-card p-3 p-lg-4 ' + (protectedProfile ? 'is-protected' : '') + '">' +
      '<div class="d-flex justify-content-between align-items-start gap-3 mb-3"><div class="d-flex align-items-center gap-3 min-w-0">' +
      '<span class="hs-server-hero-icon flex-shrink-0"><i class="bi bi-router-fill"></i></span><div class="min-w-0">' +
      '<div class="d-flex flex-wrap align-items-center gap-2"><h3 class="h6 fw-bold mb-0 text-break">' + esc(profile.name) + '</h3>' +
      (protectedProfile ? '<span class="badge text-bg-warning-subtle border border-warning-subtle text-warning-emphasis">Protected system profile</span>' : '<span class="badge text-bg-success-subtle border border-success-subtle text-success-emphasis">MikroTik live</span>') +
      '</div><div class="small text-muted mt-1">Hotspot server authentication profile</div></div></div>' +
      (protectedProfile ? '' : '<button type="button" class="btn btn-sm btn-outline-success hs-edit-server-profile" data-id="' + esc(profile.id) + '"><i class="bi bi-pencil-square me-1"></i>Edit</button>') +
      '</div><div class="row g-2 mb-3">' +
      [['Hotspot Address', profile.hotspotAddress], ['DNS Name', profile.dnsName], ['HTML Directory', profile.htmlDirectory]].map(([label, value]) => '<div class="col-12 col-md-4"><div class="hs-server-detail"><small>' + label + '</small><strong>' + esc(value || 'Not set') + '</strong></div></div>').join('') +
      '</div><div><div class="small fw-bold text-secondary mb-2">LOGIN-BY METHODS</div><div class="hs-server-auth">' + methods + '</div></div></article></div>';
  }

  function openEditor(existing) {
    const editing = Boolean(existing), modalId = 'hotspotServerProfileModal';
    document.getElementById(modalId)?.remove();
    const selected = new Set(editing ? existing.loginBy : ['mac', 'http-pap', 'http-chap', 'cookie']);
    const checks = loginMethods.map(([value, label]) => '<label class="hs-server-login-option"><input type="checkbox" name="loginBy" value="' + value + '" ' +
      (selected.has(value) ? 'checked' : '') + '><span class="fw-semibold small">' + label + '</span></label>').join('');
    const modal = document.createElement('div');
    modal.className = 'modal fade hs-server-profiles-modal'; modal.id = modalId; modal.tabIndex = -1;
    const directoryField = (id, name, label, value) => '<div class="mb-3"><label class="form-label fw-semibold" for="' + id + '">' + label + '</label><div class="input-group"><input id="' + id + '" name="' + name + '" class="form-control" maxlength="255" value="' + esc(value || '') + '" placeholder="hotspot or flash/hotspot"><select class="form-select hs-server-directory-picker" data-target="' + id + '" aria-label="Browse MikroTik folders"><option value="">Browse folders…</option></select></div><div class="form-text">Choose a RouterOS folder or enter a custom path.</div></div>';
    const loginChecks = loginMethods.map(([value, label]) => '<label class="hs-server-login-option"><input type="checkbox" name="loginBy" value="' + value + '" ' + (selected.has(value) ? 'checked' : '') + '><span class="fw-semibold small">' + label + '</span></label>').join('');
    modal.innerHTML = '<div class="modal-dialog modal-dialog-centered modal-xl"><form class="modal-content" id="hsServerProfileForm">' +
      '<div class="modal-header"><div><div class="small text-success fw-bold text-uppercase">MikroTik · Hotspot</div><h2 class="modal-title h5 fw-bold mb-0">' + (editing ? 'Edit Server Profile' : 'Create Server Profile') + '</h2></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>' +
      '<div class="modal-body p-3 p-md-4"><div id="hsServerProfileMessage" class="small mb-3" role="status"></div>' +
      '<ul class="nav nav-pills hs-server-tabs mb-3" role="tablist"><li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#hsServerGeneral" type="button" role="tab">General</button></li><li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#hsServerLogin" type="button" role="tab">Login & Authentication</button></li><li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#hsServerRadius" type="button" role="tab">RADIUS & Accounting</button></li><li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#hsServerRate" type="button" role="tab">Queue & Rate Limit</button></li></ul>' +
      '<div class="tab-content"><section class="tab-pane fade show active" id="hsServerGeneral" role="tabpanel"><div class="row g-3"><div class="col-12 col-md-6"><label class="form-label fw-semibold" for="hsServerName">Profile name</label><input id="hsServerName" name="name" class="form-control" maxlength="100" required ' + (editing ? 'readonly' : '') + ' value="' + esc(existing?.name || '') + '" placeholder="e.g. guest-portal"></div><div class="col-12 col-md-6">' + textField('hsServerAddress', 'hotspotAddress', 'Hotspot Address', existing?.hotspotAddress, '10.5.50.1') + '</div><div class="col-12 col-md-6">' + textField('hsServerDns', 'dnsName', 'DNS Name', existing?.dnsName, 'wifi.example.com') + '</div><div class="col-12 col-md-6">' + directoryField('hsServerHtml', 'htmlDirectory', 'HTML Directory', existing?.htmlDirectory) + '</div><div class="col-12 col-md-6">' + directoryField('hsServerHtmlOverride', 'htmlDirectoryOverride', 'HTML Directory Override', existing?.htmlDirectoryOverride) + '</div><div class="col-12 col-md-6">' + textField('hsServerProxy', 'httpProxy', 'HTTP Proxy (IP:Port)', existing?.httpProxy, '192.0.2.1:8080') + '</div><div class="col-12 col-md-6">' + textField('hsServerSmtp', 'smtpServer', 'SMTP Server', existing?.smtpServer, '192.0.2.2') + '</div></div></section>' +
      '<section class="tab-pane fade" id="hsServerLogin" role="tabpanel"><div class="small text-muted mb-2">Select one or more Login-By methods.</div><div class="hs-server-login-grid mb-3">' + loginChecks + '</div><div class="row g-3"><div class="col-12 col-md-6">' + passwordField('hsServerMacAuthPassword','macAuthPassword','MAC Auth Password',existing?.macAuthPassword,'Leave blank to clear') + '</div><div class="col-12 col-md-6">' + textField('hsServerCookieLifetime', 'httpCookieLifetime', 'HTTP Cookie Lifetime', existing?.httpCookieLifetime || '3d', '3d 00:00:00') + '</div><div class="col-12 col-md-6">' + selectField('hsServerCertificate','sslCertificate','SSL Certificate',existing?.sslCertificate,[]) + '</div><div class="col-12 col-md-6">' + textField('hsServerTrialLimit','trialUptimeLimit','Trial Uptime Limit',existing?.trialUptimeLimit,'30m') + '</div><div class="col-12 col-md-6">' + textField('hsServerTrialReset','trialUptimeReset','Trial Uptime Reset',existing?.trialUptimeReset,'1d') + '</div><div class="col-12 col-md-6">' + selectField('hsServerTrialProfile','trialUserProfile','Trial User Profile',existing?.trialUserProfile,[]) + '</div><div class="col-12"><div class="hs-server-login-grid">' + toggleField('splitUserDomain', 'Split User Domain', existing?.splitUserDomain) + '</div></div></div></section>' +
      '<section class="tab-pane fade" id="hsServerRadius" role="tabpanel"><div class="hs-server-login-grid mb-3">' + toggleField('useRadius', 'Use RADIUS', existing?.useRadius) + toggleField('radiusAccounting', 'Accounting', existing?.radiusAccounting) + '</div><div class="row g-3"><div class="col-12 col-md-6">' + textField('hsServerRadiusDomain','radiusDefaultDomain','Default Domain',existing?.radiusDefaultDomain) + '</div><div class="col-12 col-md-6">' + textField('hsServerRadiusLocationId','radiusLocationId','Location ID',existing?.radiusLocationId) + '</div><div class="col-12 col-md-6">' + textField('hsServerRadiusLocationName','radiusLocationName','Location Name',existing?.radiusLocationName) + '</div><div class="col-12 col-md-6">' + selectField('hsServerRadiusMacFormat','radiusMacFormat','MAC Format',existing?.radiusMacFormat,['XX:XX:XX:XX:XX:XX','XX-XX-XX-XX-XX-XX','XXXXXXXXXXXX','XX XX XX XX XX XX','XXXXXX-XXXXXX','XXXX:XXXX:XXXX','XXXXXX:XXXXXX'].map(value=>[value,value])) + '</div><div class="col-12 col-md-6">' + textField('hsServerInterim', 'radiusInterimUpdate', 'Interim Update', existing?.radiusInterimUpdate || 'received', '00:05:00 or received') + '</div><div class="col-12 col-md-6">' + selectField('hsServerNasPortType','nasPortType','NAS Port Type',existing?.nasPortType,[['wireless-802.11','19 — wireless-802.11'],['ethernet','15 — ethernet'],['async','5 — async'],['undefined','0 — undefined']]) + '</div></div></section>' +
      '<section class="tab-pane fade" id="hsServerRate" role="tabpanel"><div class="row g-3"><div class="col-12 col-md-8">' + textField('hsServerRateLimit', 'rateLimit', 'Rate Limit (rx/tx)', existing?.rateLimit, '10M/20M') + '<div class="form-text">Router point of view: rx is client upload and tx is client download.</div></div></div></section></div></div>' +
      '<div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-success" id="hsServerProfileSave"><i class="bi bi-cloud-check me-1"></i>' + (editing ? 'Save changes' : 'Create profile') + '</button></div></form></div>';
    document.body.appendChild(modal);
    const form = modal.querySelector('form');
    form.querySelectorAll('input[type="checkbox"]:not([name="loginBy"])').forEach(input => input.addEventListener('change', () => { input.dataset.touched = 'true'; }));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const message = modal.querySelector('#hsServerProfileMessage'), button = modal.querySelector('#hsServerProfileSave');
      const name = form.elements.name.value.trim();
      const loginBy = Array.from(form.querySelectorAll('input[name="loginBy"]:checked')).map(input => input.value);
      if (name.toLowerCase() === 'default' || !loginBy.length) {
        message.className = 'small mb-3 text-danger fw-semibold';
        message.textContent = name.toLowerCase() === 'default' ? 'The built-in default profile is protected.' : 'Select at least one Login-By method.';
        return;
      }
      const payload = { name, loginBy };
      const addText=(key,value)=>{const normalized=String(value??'').trim();if(normalized)payload[key]=normalized;};
      for(const [key,control] of Object.entries({hotspotAddress:form.elements.hotspotAddress,dnsName:form.elements.dnsName,htmlDirectory:form.elements.htmlDirectory,htmlDirectoryOverride:form.elements.htmlDirectoryOverride,httpProxy:form.elements.httpProxy,smtpServer:form.elements.smtpServer,httpCookieLifetime:form.elements.httpCookieLifetime,rateLimit:form.elements.rateLimit}))addText(key,control.value);
      if(loginBy.includes('mac'))addText('macAuthPassword',form.elements.macAuthPassword.value);
      const certificate=form.elements.sslCertificate.value;if(certificate&&certificate.toLowerCase()!=='none')payload.sslCertificate=certificate;
      const useRadius=form.elements.useRadius;
      if(useRadius.checked||useRadius.dataset.touched==='true')payload.useRadius=useRadius.checked;
      if(useRadius.checked){
        for(const [key,control] of Object.entries({radiusDefaultDomain:form.elements.radiusDefaultDomain,radiusLocationId:form.elements.radiusLocationId,radiusLocationName:form.elements.radiusLocationName,radiusMacFormat:form.elements.radiusMacFormat,radiusInterimUpdate:form.elements.radiusInterimUpdate,nasPortType:form.elements.nasPortType}))addText(key,control.value);
        const accounting=form.elements.radiusAccounting;if(accounting.checked||accounting.dataset.touched==='true')payload.radiusAccounting=accounting.checked;
      }
      const splitDomain=form.elements.splitUserDomain;if(splitDomain.checked||splitDomain.dataset.touched==='true')payload.splitUserDomain=splitDomain.checked;
      if(loginBy.includes('trial')){
        const trialLimit=form.elements.trialUptimeLimit.value.trim(),trialReset=form.elements.trialUptimeReset.value.trim();
        if(trialLimit&&trialReset){payload.trialUptimeLimit=trialLimit;payload.trialUptimeReset=trialReset;}
        addText('trialUserProfile',form.elements.trialUserProfile.value);
      }
      button.disabled = true; message.className = 'small mb-3 text-muted'; message.textContent = 'Synchronizing settings with MikroTik…';
      try {
        await api(editing ? '/api/hotspot/server-profiles/' + encodeURIComponent(existing.id) : '/api/hotspot/server-profiles', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
        bootstrap.Modal.getInstance(modal)?.hide(); await window.renderHotspotServerProfiles();
      } catch (error) { message.className = 'small mb-3 text-danger fw-semibold'; message.textContent = error.message || 'Unable to save profile.'; }
      finally { button.disabled = false; }
    });
    modal.addEventListener('hidden.bs.modal', () => modal.remove(), { once: true });
    bootstrap.Modal.getOrCreateInstance(modal).show();
    api('/api/hotspot/mikrotik-files').then(result => {
      modal.querySelectorAll('.hs-server-directory-picker').forEach(select => {
        const current = modal.querySelector('#' + select.dataset.target)?.value || '';
        select.innerHTML = '<option value="">Browse folders…</option>' + (result.directories || []).map(path => '<option value="' + esc(path) + '">' + esc(path) + '</option>').join('');
        select.value = Array.from(select.options).some(option => option.value === current) ? current : '';
        select.addEventListener('change', () => { if (select.value) modal.querySelector('#' + select.dataset.target).value = select.value; });
      });
    }).catch(error => { const msg = modal.querySelector('#hsServerProfileMessage'); if (msg) { msg.className = 'small mb-3 text-warning'; msg.textContent = 'Folder browser unavailable: ' + error.message + '. You can still enter a custom directory path.'; } });
    api('/api/hotspot/server-profile-options').then(result => {
      const fill=(name,values,current,noneLabel)=>{const select=form.elements[name];if(!select)return;select.innerHTML='<option value="">'+esc(noneLabel)+'</option>'+values.map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join('');if(current&&![...select.options].some(option=>option.value===current))select.insertAdjacentHTML('beforeend','<option value="'+esc(current)+'">'+esc(current)+' (current)</option>');select.value=current||'';};
      fill('sslCertificate',result.certificates||[],existing?.sslCertificate,'none');fill('trialUserProfile',result.userProfiles||[],existing?.trialUserProfile,'Select user profile…');
    }).catch(error=>{const msg=modal.querySelector('#hsServerProfileMessage');if(msg){msg.className='small mb-3 text-warning';msg.textContent='Certificate/profile options unavailable: '+error.message+'.';}});
  }

  window.renderHotspotServerProfiles = async function () {
    if (typeof window.setPageTitleSafe === 'function') window.setPageTitleSafe('Hotspot Server Profiles');
    const html = '<section class="hotspot-dynamic-view admin-view hs-server-profiles"><div class="container-fluid px-0">' +
      '<div class="hs-server-hero p-3 p-md-4 mb-4"><div class="d-flex flex-wrap align-items-center justify-content-between gap-3"><div class="d-flex align-items-center gap-3"><span class="hs-server-hero-icon"><i class="bi bi-router-fill"></i></span><div><div class="small text-success fw-bold text-uppercase">FAZ NETWORK · RouterOS</div><h1 class="h4 fw-bold mb-1">Hotspot Server Profiles</h1><p class="small text-muted mb-0">Manage captive portal identity and authentication methods directly on MikroTik.</p></div></div><div class="d-flex gap-2"><button type="button" class="btn btn-outline-secondary" id="hsServerProfileRefresh"><i class="bi bi-arrow-clockwise me-1"></i>Refresh</button><button type="button" class="btn btn-success" id="hsServerProfileCreate"><i class="bi bi-plus-lg me-1"></i>Create Server Profile</button></div></div></div>' +
      '<div class="d-flex align-items-center justify-content-between gap-3 mb-3"><div><h2 class="h6 fw-bold mb-1">Live Router Profiles</h2><div class="small text-muted" id="hsServerProfileCount">Fetching from MikroTik…</div></div><span class="badge rounded-pill text-bg-light border"><i class="bi bi-lightning-charge-fill text-success me-1"></i>Live configuration</span></div>' +
      '<div class="row g-3" id="hsServerProfileGrid"><div class="col-12 text-center py-5"><span class="spinner-border text-success"></span><div class="small text-muted mt-2">Reading RouterOS server profiles…</div></div></div></div></section>';
    if (typeof window.appendHotspotView === 'function') window.appendHotspotView(html);
    else { document.querySelectorAll('.admin-view').forEach(view => { view.style.display = 'none'; }); const target = document.getElementById('dynamicPageContent'); if (target) { target.style.display = 'block'; target.innerHTML = html; } }
    const grid = document.getElementById('hsServerProfileGrid'), count = document.getElementById('hsServerProfileCount');
    const load = async () => {
      grid.innerHTML = '<div class="col-12 text-center py-5"><span class="spinner-border spinner-border-sm text-success"></span><div class="small text-muted mt-2">Reading RouterOS server profiles…</div></div>';
      try {
        const data = await api('/api/hotspot/server-profiles'), profiles = (Array.isArray(data.profiles) ? data.profiles : []).filter(profile => String(profile.name || '').trim().toLowerCase() !== 'default');
        count.textContent = profiles.length + ' profile' + (profiles.length === 1 ? '' : 's') + ' fetched directly from MikroTik';
        grid.innerHTML = profiles.length ? profiles.map(renderCard).join('') : '<div class="col-12"><div class="alert alert-light border rounded-4">No Hotspot server profiles were returned by MikroTik.</div></div>';
        grid.querySelectorAll('.hs-edit-server-profile').forEach(button => button.addEventListener('click', () => { const profile = profiles.find(item => String(item.id) === button.dataset.id); if (profile && !profile.protected) openEditor(profile); }));
      } catch (error) {
        count.textContent = 'Router profile fetch failed';
        grid.innerHTML = '<div class="col-12"><div class="alert alert-danger rounded-4"><strong>Could not read MikroTik profiles.</strong><div class="small mt-1">' + esc(error.message) + '</div><button class="btn btn-sm btn-outline-danger mt-3" type="button" id="hsServerProfileRetry">Try again</button></div></div>';
        grid.querySelector('#hsServerProfileRetry')?.addEventListener('click', load);
      }
    };
    document.getElementById('hsServerProfileRefresh')?.addEventListener('click', load);
    document.getElementById('hsServerProfileCreate')?.addEventListener('click', () => openEditor(null));
    await load();
  };
})();
