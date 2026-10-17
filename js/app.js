(function () {
  'use strict';
  const CURRENT_VERSION = '20261013.03';
  const APP_ID = 'app-master-data', PORTAL = 'https://akra-web.github.io/Main/', STORAGE_KEY = 'akra_master_data_token';
  const meta = {
    products: {label:'สินค้า', singular:'สินค้า', manage:'manageProducts', import:'importProducts',
      fields:[['code','รหัสสินค้า (SKU)',true],['name','ชื่อสินค้า',true],['subname','ชื่อรอง'],['category','หมวดหมู่'],['unit','หน่วย',true],['barcode','บาร์โค้ด']],
      note:'ไฟล์สินค้าไม่มีความสัมพันธ์ Vendor ระบบจะไม่เดา Vendor จากชื่อสินค้า'},
    vendors: {label:'Vendor', singular:'Vendor', manage:'manageVendors', import:'importVendors',
      fields:[['code','รหัส Vendor',true],['name','ชื่อ Vendor',true],['contact_name','ชื่อผู้ติดต่อ'],['phone','เบอร์โทรศัพท์'],['email','อีเมล'],['address','ที่อยู่'],['tax_id','เลขผู้เสียภาษี']],
      note:'Vendor เดิมที่ยังไม่มีรหัสต้องเลือกจับคู่กับรายการเดิมอย่างชัดเจนก่อนยืนยัน'},
    members: {label:'สมาชิก', singular:'สมาชิก', manage:'manageMembers', import:'importMembers',
      fields:[['code','รหัสสมาชิกจาก POS',true],['name','ชื่อสมาชิก / ลูกค้า',true],['phone','เบอร์โทรศัพท์'],['email','อีเมล'],['address','ที่อยู่'],['company','ชื่อบริษัท']],
      note:'ใช้รหัสเดิมจาก POS เป็นข้อความ ชื่อซ้ำกันได้เมื่อรหัสต่างกัน'}
  };
  const paths = {products:'<path d="m12 3 9 5-9 5-9-5zM3 8v9l9 5 9-5V8M12 13v9"/>', vendors:'<path d="M3 21h18M5 21V5h10v16M15 11h4v10M8 8h4M8 12h4M8 16h4"/>', members:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3c0-6 12-6 12 0v3M16 5a3 3 0 0 1 0 6M18 14c2 1 3 2 3 5v2"/>', search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>', plus:'<path d="M12 5v14M5 12h14"/>', import:'<path d="M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6"/>', back:'<path d="m10 5-7 7 7 7M3 12h18"/>', check:'<path d="m5 12 4 4L19 6"/>', chevron:'<path d="m9 5 7 7-7 7"/>'};
  const icon = key => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[key] || paths.products}</svg>`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const byId = id => document.getElementById(id), number = value => Number(value || 0).toLocaleString('en-US');
  const rowErrorMessages = {
    invalid_code:'รหัสไม่ถูกต้อง กรุณาตรวจรหัสในไฟล์และเก็บเป็นข้อความ',
    missing_code:'ไม่มีรหัส กรุณาระบุรหัสจากระบบเดิม',
    duplicate_code:'รหัสซ้ำในไฟล์ กรุณาแก้ให้แต่ละรายการมีรหัสเดียว',
    invalid_name:'ชื่อไม่ถูกต้องหรือยาวเกินไป กรุณาตรวจชื่อในไฟล์',
    missing_name:'ไม่มีชื่อ กรุณาระบุชื่อรายการ',
    invalid_unit:'หน่วยไม่ถูกต้อง กรุณาระบุหน่วยสินค้า',
    invalid_email:'รูปแบบอีเมลไม่ถูกต้อง กรุณาแก้ไขหรือเว้นว่าง',
    vendor_binding_required:'พบ Vendor เดิมที่ชื่อตรงกัน กรุณาเลือกใช้รายการเดิมก่อนยืนยัน',
    invalid_binding:'การจับคู่ Vendor ใช้ไม่ได้ กรุณาเปรียบเทียบและเลือกใหม่',
    vendor_name_conflict:'ชื่อนี้ใช้กับ Vendor อีกรายแล้ว กรุณาตรวจรายการเดิม',
    duplicate_name:'ชื่อนี้ใช้กับ Vendor อีกรายแล้ว กรุณาตรวจรายการเดิม',
    unknown_field:'ไฟล์มีข้อมูลที่ไม่รองรับ กรุณาจับคู่เฉพาะช่องข้อมูลที่แอปมี',
    protected_field:'ไฟล์มีข้อมูลที่แก้ไขไม่ได้ กรุณาจับคู่เฉพาะช่องที่แอปอนุญาต',
    invalid_record:'ข้อมูลแถวนี้ไม่ถูกต้อง กรุณาตรวจรหัส ชื่อ และช่องที่จับคู่',
    invalid_required_fields:'ข้อมูลจำเป็นไม่ครบ กรุณาระบุรหัส ชื่อ และหน่วยสินค้าเมื่อเป็นสินค้า',
    invalid_vendor_binding:'การจับคู่ Vendor ใช้ไม่ได้ กรุณาเปรียบเทียบและเลือกใหม่',
    invalid_row:'เลขแถวไม่ถูกต้อง กรุณาจับคู่คอลัมน์แล้วเปรียบเทียบใหม่',
    invalid_field:'มีช่องข้อมูลที่ไม่รองรับ กรุณาจับคู่เฉพาะช่องที่แอปมี',
    invalid_text:'ข้อมูลควรเป็นข้อความและไม่ยาวเกินไป กรุณาตรวจค่าในไฟล์',
    invalid_address:'ที่อยู่ยาวเกินไป กรุณาลดความยาวในไฟล์',
    invalid_phone:'เบอร์โทรศัพท์ยาวเกินไป กรุณาตรวจค่าในไฟล์',
    invalid_tax_id:'เลขผู้เสียภาษียาวเกินไป กรุณาตรวจค่าในไฟล์',
    invalid_contact_name:'ชื่อผู้ติดต่อยาวเกินไป กรุณาลดความยาวในไฟล์',
    invalid_subname:'ชื่อรองยาวเกินไป กรุณาลดความยาวในไฟล์',
    invalid_category:'หมวดหมู่ยาวเกินไป กรุณาลดความยาวในไฟล์',
    invalid_barcode:'บาร์โค้ดยาวเกินไป กรุณาตรวจค่าในไฟล์',
    invalid_company:'ชื่อบริษัทยาวเกินไป กรุณาลดความยาวในไฟล์',
    value_too_long:'ข้อความยาวเกินไป กรุณาลดความยาวในไฟล์',
    invalid_active:'สถานะไม่ถูกต้อง กรุณาแก้ไขสถานะผ่านรายละเอียดรายการ'
  };
  function rowError(error) { const code = typeof error === 'string' ? error : error?.code; return rowErrorMessages[code] || 'ข้อมูลแถวนี้ยังใช้ไม่ได้ กรุณาตรวจค่าในไฟล์หรือจับคู่คอลัมน์ใหม่'; }
  let session = null, accessRetry = null, authGeneration = 0, navigationGeneration = 0, listGeneration = 0, historyGeneration = 0, toastTimer, searchTimer;
  const state = {dataset:'products', records:[], totals:{}, total:0, counts:{}, offset:0, limit:100, selected:null, savedRecord:null, search:'', status:'active', loading:false, listError:null, busy:false, mode:'view', draft:null, editRecord:null, errors:{}, confirm:false, pending:null, mobileDetail:false, history:[], historyLoading:false, historyError:'', view:'catalog', import:null};
  const api = MasterDataAPI.create(() => session, invalidate);
  const permitted = key => MasterDataAPI.hasAdminRole(session) && Boolean(session?.perms?.[APP_ID]?.includes(key));
  const canManage = dataset => permitted(meta[dataset].manage);
  const canImport = dataset => canManage(dataset) && permitted(meta[dataset].import);
  const current = () => state.mode === 'edit' && state.editRecord ? state.editRecord : state.savedRecord?.id === state.selected ? state.savedRecord : state.records.find(record => record.id === state.selected);
  const fields = () => meta[state.dataset].fields;
  const optionalLegacyCode = key => key === 'code' && state.dataset === 'vendors' && state.mode === 'edit' && !current()?.code;
  const dirty = () => Boolean(state.draft && fields().some(([key]) => String(state.draft[key] ?? '') !== String((state.mode === 'add' ? '' : current()?.[key]) ?? '')));
  function syncDirty() { if (dirty() || (state.view === 'import' && state.import?.file && state.import.step !== 4)) window.AkraModule.markDirty(); else window.AkraModule.markSaved(); }
  function toast(message) { clearTimeout(toastTimer); byId('toast').textContent = message; byId('toast').hidden = false; toastTimer = setTimeout(() => { byId('toast').hidden = true; }, 5000); }
  function message(text) { byId('app-message').textContent = text || ''; byId('app-message').hidden = !text; }
  function invalidate(text, failure) {
    session = null; accessRetry = null; ++authGeneration; ++listGeneration; ++historyGeneration;
    clearTimeout(searchTimer); clearTimeout(toastTimer);
    Object.assign(state, {records:[], draft:null, editRecord:null, import:null, history:[], selected:null, savedRecord:null, totals:{}, total:0, counts:{}, offset:0, search:'', status:'active', busy:false, loading:false, listError:null, mode:'view', view:'catalog', pending:null, confirm:false, errors:{}, mobileDetail:false, historyLoading:false, historyError:''});
    ['record-list','detail-panel','import-view','dataset-tabs','app-message','user-name'].forEach(id => { byId(id).replaceChildren(); });
    byId('catalog-search').value = ''; byId('toast').replaceChildren(); byId('toast').hidden = true;
    byId('app-content').hidden = true; byId('session-screen').hidden = false;
    byId('session-message').textContent = text || 'กรุณาเปิดแอปจาก Main อีกครั้ง'; byId('session-message').setAttribute('role', 'alert'); byId('auth-retry').hidden = Boolean(failure?.home);
    window.AkraModule?.stopWatchingSession?.();
  }
  async function verifyAccess() {
    const generation = ++authGeneration;
    let attempt = null;
    byId('auth-retry').hidden = true; byId('session-message').setAttribute('role', 'status'); byId('session-message').textContent = 'กำลังตรวจสอบเซสชัน Main…';
    try {
      const bridge = window.AkraModule;
      if (!bridge) throw Object.assign(new Error('bridge_unavailable'), {code:'service_unavailable'});
      const params = new URLSearchParams(location.search), sso = params.get('sso');
      let saved = ''; try { saved = localStorage.getItem(STORAGE_KEY) || ''; } catch (_) {}
      if (sso) { params.delete('sso'); history.replaceState({}, '', `${location.pathname}${params.size ? '?' + params : ''}${location.hash}`); }
      const stamp = bridge.sessionStamp?.();
      const retryToken = accessRetry?.saved === saved && accessRetry.stamp === stamp ? accessRetry.token : '';
      const token = bridge.embedded ? bridge.getToken() : sso || retryToken || saved;
      if (!token) throw Object.assign(new Error('no_token'), {code:'no_token'});
      attempt = {token, saved, stamp};
      const user = await bridge.verifySession(APP_ID, token);
      if (generation !== authGeneration) return;
      if (!bridge.embedded) { let latest = ''; try { latest = localStorage.getItem(STORAGE_KEY) || ''; } catch (_) {} if (latest !== saved) throw Object.assign(new Error('session_changed'), {code:'session_changed'}); }
      if (!MasterDataAPI.hasAdminRole(user)) throw Object.assign(new Error('permission_denied'), {code:'permission_denied'});
      if (user.mustChangePassword || !user.perms?.[APP_ID]?.includes('viewMasterData')) throw Object.assign(new Error('permission_denied'), {code:'permission_denied'});
      const response = await fetch('version.json', {cache:'no-store'});
      if (!response.ok) throw Object.assign(new Error('version_unavailable'), {status:response.status});
      if ((await response.json()).version !== CURRENT_VERSION) throw Object.assign(new Error('app_version_changed'), {code:'app_version_changed'});
      if (generation !== authGeneration) return;
      session = {...user, token};
      accessRetry = null;
      if (!bridge.embedded) { try { localStorage.setItem(STORAGE_KEY, token); } catch (_) {} }
      bridge.watchSession({appId:APP_ID, user:session, token, invalidated:() => invalidate('เซสชัน Main เปลี่ยนแล้ว กรุณาเปิดแอปจาก Main อีกครั้ง'), refreshed:(nextToken, nextUser) => { session = {...nextUser, token:nextToken}; if (!MasterDataAPI.hasAdminRole(session)) invalidate('ข้อมูลกลางเปิดให้ใช้งานเฉพาะ ADMIN กรุณากลับ Main'); else if (!permitted('viewMasterData')) invalidate('สิทธิ์ดูข้อมูลกลางเปลี่ยนแล้ว กรุณาเปิดจาก Main อีกครั้ง'); else { render(); loadList(); } }});
      byId('user-name').textContent = user.name || 'ผู้ใช้งาน'; byId('app-version').textContent = CURRENT_VERSION;
      byId('session-screen').hidden = true; byId('app-content').hidden = false;
      state.dataset = hashDataset() || 'products'; render(); await loadList();
    } catch (error) {
      if (generation !== authGeneration) return;
      const failure = error.code === 'app_version_changed' ? {title:'แอปมีเวอร์ชั่นใหม่', body:'กรุณาโหลดหน้านี้ใหม่ก่อนใช้งาน', home:true} : listFailure(error);
      invalidate(`${failure.title} · ${failure.body}`, failure);
      if (!failure.home) accessRetry = attempt;
      if (failure.session) window.AkraModule?.authRequired?.(PORTAL);
    }
  }
  const hashDataset = () => Object.keys(meta).find(dataset => location.hash === '#tab-' + dataset);
  function renderTabs() {
    const focused = Boolean(document.activeElement?.closest('#dataset-tabs'));
    byId('dataset-tabs').innerHTML = Object.entries(meta).map(([dataset, item]) => `<button class="dataset-tab" id="tab-${dataset}" type="button" role="tab" aria-selected="${state.dataset === dataset}" tabindex="${state.dataset === dataset ? 0 : -1}" data-action="dataset" data-dataset="${dataset}">${icon(dataset)}<span><span class="tab-label">${item.label}</span><span class="tab-total">${state.totals[dataset] == null ? 'เปิดรายการ' : number(state.totals[dataset]) + ' รายการ'}</span></span></button>`).join('');
    if (focused) byId('tab-' + state.dataset).focus();
  }
  function renderList() {
    byId('record-list').setAttribute('aria-busy', String(state.loading));
    byId('list-count').textContent = state.loading ? 'กำลังโหลดรายการ…' : state.listError ? 'โหลดรายการไม่สำเร็จ' : `แสดง ${number(state.records.length ? state.offset + 1 : 0)}–${number(state.offset + state.records.length)} จาก ${number(state.total)} รายการ`;
    byId('source-caption').textContent = `ใช้งานอยู่ ${number(state.counts.active)} · ปิดใช้งาน ${number(state.counts.inactive)}`;
    byId('page-number').textContent = `หน้า ${Math.floor(state.offset / state.limit) + 1}`;
    document.querySelector('[data-action="previous-page"]').disabled = state.loading || !state.offset;
    document.querySelector('[data-action="next-page"]').disabled = state.loading || state.offset + state.limit >= state.total;
    if (state.loading) { byId('record-list').innerHTML = '<div class="list-skeleton" role="status"><span>กำลังโหลดข้อมูล</span><div></div><div></div><div></div></div>'; return; }
    let notice = '';
    if (state.listError) {
      const error = state.listError, retained = state.records.length && !error.home;
      notice = `<div class="empty-state list-error${retained ? ' list-error-notice' : ''}" role="alert"><h3>${esc(error.title)}</h3><p>${esc(error.body)}</p>${retained ? '<p>แสดงข้อมูลที่โหลดสำเร็จครั้งก่อน</p>' : ''}<button class="button button-secondary" type="button" data-action="${error.home ? 'home' : 'reload'}">${error.home ? 'กลับหน้าหลัก' : 'ลองอีกครั้ง'}</button></div>`;
      if (!retained) { byId('record-list').innerHTML = notice; return; }
    }
    if (!state.records.length) { byId('record-list').innerHTML = `<div class="empty-state">${icon('search')}<h3>${state.search ? 'ไม่พบรายการที่ตรงกัน' : 'ยังไม่มีรายการในสถานะนี้'}</h3><p>ลองค้นหาด้วยรหัสหรือชื่อ เปลี่ยนสถานะ หรือเพิ่มรายการใหม่เมื่อมีสิทธิ์</p><button class="button button-secondary" type="button" data-action="reset-search">ล้างการค้นหาและตัวกรอง</button><button class="button button-subtle" type="button" data-action="reload">โหลดข้อมูลอีกครั้ง</button></div>`; return; }
    const product = state.dataset === 'products', vendor = state.dataset === 'vendors';
    const columns = product ? ['รหัสสินค้า','ชื่อสินค้า / ชื่อรอง','หมวดหมู่','หน่วย','สถานะ'] : vendor ? ['รหัส','ชื่อ Vendor','ข้อมูลติดต่อ','สถานะ'] : ['รหัสสมาชิก','ชื่อสมาชิก / ลูกค้า','เบอร์โทรศัพท์','สถานะ'];
    const rows = state.records.map(record => {
      const code = `<button type="button" class="record-code-button" data-action="select" data-id="${esc(record.id)}">${esc(record.code || 'ยังไม่ได้กำหนดรหัส')}</button>`;
      const name = `<span class="record-name">${esc(record.name)}</span>${product ? `<span class="record-subname">${esc(record.subname || 'ไม่มีชื่อรอง')}</span>` : ''}`;
      const status = `<span class="status-badge ${record.active ? '' : 'inactive'}">${record.active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}</span>`;
      const values = product ? [code,name,esc(record.category || '—'),esc(record.unit || '—'),status] : [code,name,esc(record.phone || record.email || 'ยังไม่ระบุ'),status];
      return `<tr class="${state.selected === record.id ? 'selected' : ''}" data-action="select" data-id="${esc(record.id)}">${values.map(value => `<td>${value}</td>`).join('')}</tr>`;
    }).join('');
    byId('record-list').innerHTML = notice + `<table class="record-table ${product ? 'product' : vendor ? 'vendor' : 'member'}-table"><thead><tr>${columns.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
  }
  function fieldControl(key, label, required) {
    if (optionalLegacyCode(key)) required = false;
    const value = state.draft?.[key] || '', error = state.errors[key], locked = key === 'code' && state.mode === 'edit' && current()?.code;
    const id = 'field-' + key, max = key === 'code' ? 200 : key === 'address' ? 4000 : key === 'email' ? 254 : key === 'unit' ? 100 : 1000;
    let hint = locked ? 'รหัสเป็นตัวระบุรายการ จึงแก้ไขไม่ได้' : optionalLegacyCode(key) ? 'Vendor เดิมยังไม่มีรหัส เว้นว่างไว้ได้ เมื่อกำหนดรหัสแล้วจะแก้รหัสไม่ได้' : key === 'code' ? state.dataset === 'members' ? 'ใช้รหัสเดิมจาก POS และเก็บเลขศูนย์ด้านหน้า' : 'กำหนดรหัสที่ไม่ซ้ำ เมื่อบันทึกแล้วแก้รหัสไม่ได้' : required ? 'จำเป็นต้องระบุ' : 'ไม่บังคับ';
    const control = key === 'address' ? `<textarea id="${id}" name="${key}" maxlength="${max}" rows="3" ${state.busy ? 'disabled' : ''} aria-describedby="${id}-hint">${esc(value)}</textarea>` : `<input id="${id}" name="${key}" value="${esc(value)}" maxlength="${max}" type="${key === 'email' ? 'email' : 'text'}" ${state.busy ? 'disabled' : ''} ${locked ? 'readonly aria-readonly="true"' : ''} ${key === 'phone' ? 'inputmode="tel"' : ''} ${key === 'code' ? 'autocomplete="off"' : ''} ${error ? 'aria-invalid="true"' : ''} aria-describedby="${id}-hint${error ? ' ' + id + '-error' : ''}">`;
    return `<div class="form-field" data-name="${key}"><label for="${id}">${label}${required ? '<span class="required" aria-hidden="true">*</span>' : ''}</label>${control}<span class="field-hint" id="${id}-hint">${hint}</span>${error ? `<span id="${id}-error" class="field-error" role="alert">${esc(error)}</span>` : ''}</div>`;
  }
  function renderHistory() {
    if (state.historyLoading) return '<section class="history"><h3>ประวัติการแก้ไขข้อมูลกลาง</h3><p>กำลังโหลดประวัติ…</p></section>';
    if (state.historyError) return `<section class="history"><h3>ประวัติการแก้ไขข้อมูลกลาง</h3><p class="field-error">${esc(state.historyError)}</p><button class="button button-subtle" data-action="reload-history">ลองโหลดประวัติอีกครั้ง</button></section>`;
    return `<section class="history"><h3>ประวัติการแก้ไขข้อมูลกลาง</h3>${!state.history.length ? '<p>ยังไม่มีประวัติการแก้ไขผ่านแอปนี้</p>' : `<ul>${state.history.map(entry => `<li>${esc({create:'สร้างรายการ',update:'แก้ไขรายละเอียด',import:'นำเข้าข้อมูล',deactivate:'ปิดใช้งาน',reactivate:'เปิดใช้งาน'}[entry.action] || entry.action)}<small>${esc(entry.actor || 'ผู้ใช้งาน')} · ${esc(new Date(entry.createdAt).toLocaleString('th-TH'))}</small></li>`).join('')}</ul>`}</section>`;
  }
  function renderDetail() {
    const panel = byId('detail-panel'), record = current(), item = meta[state.dataset];
    const editing = state.mode !== 'view';
    byId('catalog-search').disabled = editing || state.busy;
    byId('status-filter').disabled = editing || state.busy;
    document.querySelector('[data-action="previous-page"]').disabled = editing || state.busy || state.loading || !state.offset;
    document.querySelector('[data-action="next-page"]').disabled = editing || state.busy || state.loading || state.offset + state.limit >= state.total;
    byId('catalog-grid').classList.toggle('mobile-detail', state.mobileDetail);
    const back = `<button type="button" class="button button-subtle detail-back" data-action="back-list">${icon('back')}กลับรายการ${item.label}</button>`;
    const pending = state.pending ? '<div class="inline-confirm" role="alert"><strong>มีข้อมูลที่ยังไม่ได้บันทึก</strong><p>ต้องการทิ้งสิ่งที่แก้ไขและไปต่อหรือไม่?</p><div class="form-actions"><button class="button button-secondary" data-action="keep-editing">แก้ไขต่อ</button><button class="button button-danger" data-action="discard-and-go">ทิ้งการแก้ไข</button></div></div>' : '';
    if (state.mode === 'add' || state.mode === 'edit') {
      panel.innerHTML = `${back}<div class="detail-icon">${icon(state.dataset)}</div><h2>${state.mode === 'add' ? 'เพิ่ม' + item.singular : 'แก้ไขรายละเอียด'}</h2><p class="detail-subtitle">${esc(state.mode === 'add' ? 'กำหนดรหัสจากระบบเดิม' : record?.code || 'Vendor เดิมยังไม่มีรหัส')}</p><form class="detail-form" id="record-form" novalidate><div class="form-fields">${fields().map(field => fieldControl(...field)).join('')}</div><p class="field-error" id="save-error" role="alert">${esc(state.errors._form || '')}</p><div class="form-actions"><button class="button button-secondary" type="button" data-action="cancel-edit" ${state.busy ? 'disabled' : ''}>ยกเลิก</button><button class="button button-primary" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></div>${state.errors._form ? '<button type="button" class="button button-subtle" data-action="reload-record">โหลดข้อมูลล่าสุดก่อนลองอีกครั้ง</button>' : ''}</form>${pending}`;
      return;
    }
    if (!record) { panel.innerHTML = `${back}<div class="empty-detail"><h2>เลือกรายการเพื่อดูรายละเอียด</h2><p>คลิกที่รหัสหรือแถวในรายการด้านซ้าย</p></div>`; return; }
    const statusConfirm = state.confirm ? `<div class="inline-confirm" role="alert"><strong>${record.active ? 'ปิดใช้งานรายการนี้?' : 'เปิดใช้งานรายการนี้อีกครั้ง?'}</strong><p>รายการและประวัติเดิมจะยังอยู่ในระบบ</p><div class="form-actions"><button class="button button-secondary" data-action="cancel-status" ${state.busy ? 'disabled' : ''}>ยกเลิก</button><button class="button button-primary" data-action="confirm-status" ${state.busy ? 'disabled' : ''}>${state.busy ? 'กำลังบันทึก…' : 'ยืนยัน' + (record.active ? 'ปิด' : 'เปิด') + 'ใช้งาน'}</button></div></div>` : '';
    panel.innerHTML = `${back}<div class="detail-topline"><span>รายละเอียด${item.singular}</span><span class="status-badge ${record.active ? '' : 'inactive'}">${record.active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}</span></div><div class="detail-icon">${icon(state.dataset)}</div><h2>${esc(record.name)}</h2><p class="detail-subtitle">${esc(record.code || 'ยังไม่ได้กำหนดรหัส')}</p>${canManage(state.dataset) ? '<button class="button button-secondary detail-primary-action" data-action="edit-record">แก้ไขรายละเอียด</button>' : '<p class="detail-help">คุณมีสิทธิ์ดูรายการนี้ หากต้องการแก้ไขให้ติดต่อผู้ดูแลใน Main</p>'}<dl class="detail-info">${fields().map(([key,label]) => `<div class="detail-field"><dt>${label}</dt><dd>${esc(record[key] || 'ยังไม่ระบุ')}</dd></div>`).join('')}${state.dataset === 'products' ? `<div class="detail-field"><dt>Vendor เดิม</dt><dd>${esc(record.vendor || 'ยังไม่ระบุ')}</dd></div>` : ''}</dl><p class="detail-help">${esc(item.note)}</p>${renderHistory()}${canManage(state.dataset) ? `<button class="deactivate-button" data-action="toggle-status">${record.active ? 'ปิดใช้งานรายการนี้' : 'เปิดใช้งานอีกครั้ง'}</button>` : ''}${statusConfirm}${pending}`;
  }
  function render() {
    if (!session) return;
    const importing = state.view === 'import';
    byId('catalog-view').hidden = importing; byId('import-view').hidden = !importing;
    byId('add-record').hidden = importing || !canManage(state.dataset); byId('open-import').hidden = importing || !canImport(state.dataset);
    byId('add-record').disabled = state.busy || state.loading; byId('open-import').disabled = state.busy || state.loading;
    byId('add-record').innerHTML = icon('plus') + 'เพิ่ม' + meta[state.dataset].singular; byId('open-import').innerHTML = icon('import') + 'นำเข้าข้อมูล'; byId('search-icon').innerHTML = icon('search');
    if (importing) renderImport(); else { renderTabs(); renderList(); renderDetail(); byId('catalog-search').value = state.search; byId('status-filter').value = state.status; }
  }
  async function loadList() {
    if (!session) return;
    const generation = ++listGeneration, dataset = state.dataset;
    state.loading = true; state.listError = null; message(''); render();
    try {
      const result = await api.request('list', {dataset, search:state.search, status:state.status, offset:state.offset, limit:state.limit});
      if (generation !== listGeneration || !session) return;
      state.records = result.records; state.total = result.total; state.counts = result.counts; state.totals[dataset] = result.counts.all;
      if (state.records.some(record => record.id === state.selected)) state.savedRecord = null;
      else if (state.savedRecord?.id !== state.selected) state.selected = state.records[0]?.id || null;
      state.loading = false; render(); loadHistory();
    } catch (error) {
      if (generation !== listGeneration || !session) return;
      if (error.code === 'session_changed') { const failure = listFailure(error); invalidate(`${failure.title} · ${failure.body}`, failure); window.AkraModule?.authRequired?.(PORTAL); return; }
      state.loading = false; state.listError = listFailure(error); render();
    }
  }
  function listFailure(error) {
    const reason = error.code || error.reason || error.message;
    const sessionFailure = {title:'เซสชันหมดอายุหรือเปลี่ยนแล้ว', body:'เข้าสู่ระบบ BUYMORETH อีกครั้ง', home:true, session:true};
    const permissionFailure = {title:'ไม่มีสิทธิ์ใช้ส่วนนี้', body:'ติดต่อผู้ดูแลใน BUYMORETH เพื่อขอสิทธิ์', home:true};
    const networkFailure = {title:'เชื่อมต่อไม่ได้', body:'ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง'};
    const serverFailure = {title:'ระบบขัดข้องชั่วคราว', body:'ลองอีกครั้งในอีกสักครู่ ถ้ายังไม่ได้ให้แจ้งผู้ดูแล'};
    if (['invalid_or_expired_token','invalid_session','session_changed','session_revoked','session_expired','main_signed_out','no_token','missing_token','shell_session_unavailable'].includes(reason)) return sessionFailure;
    if (['stale_record','stale_review','review_expired','duplicate_code'].includes(reason)) return {title:'โหลดข้อมูลไม่สำเร็จ', body:error.message};
    if (reason === 'permission_denied') return permissionFailure;
    if (['network_error','request_timeout','session_verify_timeout'].includes(reason)) return networkFailure;
    if (['internal_error','service_unavailable'].includes(reason)) return serverFailure;
    if (error.status === 401) return sessionFailure;
    if (error.status === 403) return permissionFailure;
    if (error.status >= 500) return serverFailure;
    if (error.name === 'AbortError' || error.name === 'TypeError') return networkFailure;
    if (error.status === 429) return {title:'โหลดข้อมูลไม่สำเร็จ', body:'มีคำขอจำนวนมาก กรุณารอสักครู่แล้วลองอีกครั้ง'};
    return {title:'โหลดข้อมูลไม่สำเร็จ', body:'ลองโหลดรายการอีกครั้ง'};
  }
  async function loadHistory() {
    const record = current(), generation = ++historyGeneration;
    state.history = []; state.historyError = ''; state.historyLoading = Boolean(record); renderDetail();
    if (!record) return;
    try { const result = await api.request('history', {dataset:state.dataset, id:record.id}); if (generation !== historyGeneration || !session) return; state.history = result.history; }
    catch (error) { if (generation !== historyGeneration || !session) return; state.historyError = error.message; }
    state.historyLoading = false; renderDetail();
  }
  function navigate(action) {
    if (state.busy) return;
    if (dirty()) { state.pending = action; renderDetail(); return; }
    runNavigation(action);
  }
  function runNavigation(action) {
    ++navigationGeneration;
    state.mode = 'view'; state.draft = null; state.editRecord = null; state.savedRecord = null; state.errors = {}; state.confirm = false; state.pending = null;
    if (action.kind === 'dataset') {
      state.dataset = action.dataset; state.offset = 0; state.search = ''; state.status = 'active'; state.selected = null; state.mobileDetail = false; state.records = [];
      history.replaceState({}, '', location.pathname + location.search + '#tab-' + action.dataset); render(); loadList();
    }
    if (action.kind === 'select') { state.selected = action.id; state.mobileDetail = true; renderDetail(); loadHistory(); }
    if (action.kind === 'add' && canManage(state.dataset)) { state.mode = 'add'; state.draft = Object.fromEntries(fields().map(([key]) => [key,''])); state.mobileDetail = true; renderDetail(); byId('field-code').focus(); }
    if (action.kind === 'back') { state.mobileDetail = false; render(); }
    if (action.kind === 'reload') { state.mobileDetail = false; loadList(); }
    if (action.kind === 'import' && canImport(state.dataset)) { state.view = 'import'; state.import = {dataset:state.dataset, step:1, file:null, sheet:0, header:1, mapping:{}, review:null, bindings:{}, notes:{}, error:'', skipErrors:false, result:null, uncertain:false}; render(); }
    syncDirty();
  }
  async function saveRecord(event) {
    event.preventDefault(); if (state.busy || !canManage(state.dataset)) return;
    const values = Object.fromEntries(fields().map(([key]) => [key,String(state.draft[key] || '').trim()]));
    const errors = {}; fields().forEach(([key,label,required]) => { if (required && !optionalLegacyCode(key) && !values[key]) errors[key] = 'กรุณาระบุ' + label; });
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'กรุณาตรวจรูปแบบอีเมล';
    state.errors = errors; state.draft = values;
    if (Object.keys(errors).length) { renderDetail(); byId('field-' + Object.keys(errors)[0]).focus(); return; }
    const adding = state.mode === 'add', record = current(), generation = authGeneration, navigation = navigationGeneration;
    state.busy = true; renderDetail();
    try {
      const payload = {...values}; if (optionalLegacyCode('code') && !payload.code) delete payload.code;
      const saved = await api.request('save', {dataset:state.dataset, ...(adding ? {} : {id:record.id, version:record.version}), record:payload});
      if (generation !== authGeneration) return;
      state.mode = 'view'; state.draft = null; state.editRecord = null; state.pending = null; state.errors = {}; state.selected = saved.id; state.savedRecord = saved; state.search = saved.code || saved.name; state.offset = 0; state.status = saved.active ? 'active' : 'all'; state.busy = false; syncDirty();
      await loadList(); if (generation !== authGeneration || navigation !== navigationGeneration) return; state.mobileDetail = true; renderDetail(); toast('บันทึก' + meta[state.dataset].singular + 'แล้ว');
    } catch (error) { if (generation !== authGeneration) return; state.busy = false; state.errors._form = error.message; renderDetail(); }
  }
  async function changeStatus() {
    if (state.busy || !canManage(state.dataset)) return;
    const record = current(), generation = authGeneration, navigation = navigationGeneration; state.busy = true; renderDetail();
    try { await api.request('save', {dataset:state.dataset, id:record.id, version:record.version, record:{active:!record.active}}); if (generation !== authGeneration) return; state.savedRecord = null; state.busy = false; state.confirm = false; await loadList(); if (generation !== authGeneration || navigation !== navigationGeneration) return; toast('บันทึกสถานะแล้ว'); }
    catch (error) { if (generation !== authGeneration) return; state.busy = false; renderDetail(); message(error.message); }
  }
  function importColumns() { return MasterDataImport.headers(state.import.file.sheets[state.import.sheet], state.import.header); }
  function configureMapping() {
    const imp = state.import, sheet = imp.file.sheets[imp.sheet]; imp.header = MasterDataImport.suggestHeader(sheet);
    imp.mapping = MasterDataImport.suggestMapping(importColumns(), meta[imp.dataset].fields.map(([key]) => key), imp.dataset); imp.review = null; imp.bindings = {}; imp.error = '';
  }
  function renderDiff(changes, dataset) {
    return changes.map(change => `<div class="import-diff"><strong class="import-diff-label">${esc(meta[dataset].fields.find(([key]) => key === change.key)?.[1] || change.key)}</strong><div class="import-diff-values"><div><span>เดิม</span><p>${esc(change.oldValue == null || change.oldValue === '' ? 'ยังไม่ระบุ' : change.oldValue)}</p></div><span class="import-diff-arrow" aria-label="เปลี่ยนเป็น">${icon('chevron')}</span><div><span>จากไฟล์</span><p>${esc(change.newValue == null || change.newValue === '' ? 'เว้นว่าง' : change.newValue)}</p></div></div></div>`).join('');
  }
  function renderImport() {
    const imp = state.import; if (!imp) return;
    const item = meta[imp.dataset], steps = ['เลือกไฟล์','จับคู่คอลัมน์','ตรวจการเปลี่ยนแปลง','ผลนำเข้า']; let body = '';
    if (imp.step === 1) body = `<h3>เลือกข้อมูลที่ต้องการนำเข้า</h3><div class="import-datasets">${Object.entries(meta).filter(([key]) => canImport(key)).map(([key,dataset]) => `<button class="import-dataset ${imp.dataset === key ? 'selected' : ''}" data-action="import-dataset" data-dataset="${key}">${icon(key)}<span>${dataset.label}</span></button>`).join('')}</div><label class="file-picker" for="import-file">ไฟล์ Excel หรือ CSV<input type="file" id="import-file" accept=".xlsx,.csv" ${state.busy ? 'disabled' : ''}></label><p class="import-footnote">รองรับ .xlsx/.csv ขนาดไม่เกิน 10 MB และไม่เกิน 10,000 รายการต่อครั้ง</p>${imp.file ? `<div class="sample-file"><div><strong>${esc(imp.file.name)}</strong><p>${number(imp.file.sheets.length)} แผ่นงาน · ยังไม่ได้บันทึกข้อมูล</p></div></div>` : ''}<div class="import-actions"><button class="button button-secondary" data-action="close-import">ยกเลิก</button><button class="button button-primary" data-action="import-next" ${!imp.file || state.busy ? 'disabled' : ''}>${state.busy ? 'กำลังอ่านไฟล์…' : 'จับคู่คอลัมน์'}</button></div>`;
    if (imp.step === 2) {
      const columns = importColumns(), missing = item.fields.some(([key,,required]) => required && !imp.mapping[key]);
      body = `<h3>จับคู่คอลัมน์ในไฟล์</h3><p>คอลัมน์ที่ไม่จับคู่จะเก็บค่าเดิม ช่องว่างในคอลัมน์ที่จับคู่จะล้างค่านั้น</p><div class="source-controls"><label>แผ่นงาน<select id="import-sheet" ${state.busy ? 'disabled' : ''}>${imp.file.sheets.map((sheet,index) => `<option value="${index}" ${imp.sheet === index ? 'selected' : ''}>${esc(sheet.name)}</option>`).join('')}</select></label><label>แถวหัวตาราง<input id="import-header" type="number" min="1" max="50" value="${imp.header}" ${state.busy ? 'disabled' : ''}></label></div><div class="mapping-scroll"><table class="mapping-table"><thead><tr><th scope="col">ข้อมูลกลาง</th><th scope="col">คอลัมน์จากไฟล์</th></tr></thead><tbody>${item.fields.map(([key,label,required]) => `<tr><td><label for="mapping-${key}">${label}${required ? ' *' : ''}</label></td><td><select id="mapping-${key}" data-mapping="${key}" ${state.busy ? 'disabled' : ''}><option value="">${required ? 'เลือกคอลัมน์' : 'ไม่ใช้คอลัมน์นี้'}</option>${columns.filter(column => !column.excluded).map(column => `<option value="${column.index}" ${imp.mapping[key] === column.index ? 'selected' : ''}>${esc(column.label)} (คอลัมน์ ${Number(column.index) + 1})</option>`).join('')}${imp.dataset === 'members' && key === 'name' ? `<option value="@person" ${imp.mapping.name === '@person' ? 'selected' : ''}>รวม First name + Last name</option><option value="@person-company" ${imp.mapping.name === '@person-company' ? 'selected' : ''}>รวมชื่อบุคคล หรือใช้ Company name เมื่อชื่อว่าง</option>` : ''}</select></td></tr>`).join('')}</tbody></table></div><p class="mapping-note">${esc(item.note)}</p><div class="import-actions"><button class="button button-secondary" data-action="import-back" ${state.busy ? 'disabled' : ''}>ย้อนกลับ</button><button class="button button-primary" data-action="compare-import" ${missing || state.busy ? 'disabled' : ''}>${state.busy ? 'กำลังเปรียบเทียบ…' : 'เปรียบเทียบข้อมูลเดิม'}</button></div>`;
    }
    if (imp.step === 3) {
      const review = imp.review, summary = review.summary, changeCount = summary.new + summary.changed;
      const candidates = review.rows.filter(row => row.type === 'error' && row.candidate), expired = Date.parse(review.expiresAt) <= Date.now();
      body = `<h3>ตรวจการเปลี่ยนแปลงก่อนยืนยัน</h3><p>ยังไม่ได้บันทึกข้อมูล ตรวจค่าเดิมและค่าจากไฟล์ก่อนกดยืนยัน</p><div class="review-summary" id="import-review-summary">${[['new','เพิ่มใหม่'],['changed','เปลี่ยนแปลง'],['unchanged','ไม่เปลี่ยนแปลง'],['error','มีข้อผิดพลาด']].map(([key,label]) => `<span><strong>${number(summary[key])}</strong> ${label}</span>`).join('')}</div>${candidates.length ? `<div class="binding-choice"><p>พบ Vendor เดิมที่ชื่อเดียวกันแต่ยังไม่มีรหัส เลือกใช้รายการเดิมแล้วเปรียบเทียบอีกครั้ง</p><button class="button button-secondary" data-action="bind-all" ${state.busy ? 'disabled' : ''}>เลือกจับคู่ Vendor ชื่อตรง ${number(candidates.length)} รายการ แล้วเปรียบเทียบใหม่</button></div>` : ''}<div class="review-scroll"><table class="review-table"><thead><tr><th scope="col">แถว</th><th scope="col">รหัส / ชื่อ</th><th scope="col">ผลเทียบข้อมูลเดิม</th></tr></thead><tbody>${review.rows.map(row => `<tr data-import-row="${row.row}" data-import-type="${row.type}"><td>${row.row}</td><td><span class="code-text">${esc(row.code || 'ไม่มีรหัส')}</span><span class="record-name">${esc(row.name)}</span></td><td><strong class="result-${row.type === 'changed' ? 'change' : row.type === 'unchanged' ? 'skip' : row.type}">${{new:'เพิ่มใหม่',changed:'เปลี่ยนแปลง',unchanged:'ไม่เปลี่ยนแปลง',error:'มีข้อผิดพลาด'}[row.type]}</strong>${(imp.notes[row.row] || []).map(note => `<p class="field-error">${esc(note)}</p>`).join('')}${(row.errors || []).map(error => `<p class="field-error">${esc(rowError(error))}</p>`).join('')}${row.candidate ? `<p class="mapping-note">รายการเดิม: ${esc(row.candidate.name)}</p><button class="button button-secondary" data-action="bind-vendor" data-code="${esc(row.code)}" data-id="${esc(row.candidate.id)}" ${state.busy ? 'disabled' : ''}>ใช้ Vendor เดิมนี้ แล้วเปรียบเทียบใหม่</button>` : ''}${renderDiff(row.changes || [], imp.dataset)}</td></tr>`).join('')}</tbody></table></div>${summary.error ? `<label class="skip-errors"><input type="checkbox" id="skip-import-errors" ${imp.skipErrors ? 'checked' : ''} ${state.busy ? 'disabled' : ''}><span>ข้ามแถวที่มีข้อผิดพลาด<small>ไม่บันทึก ${number(summary.error)} แถวที่มีปัญหา แก้ไขในไฟล์แล้วนำเข้าใหม่ได้</small></span></label>` : ''}${!changeCount ? '<p class="import-no-changes">ไม่มีรายการใหม่หรือการเปลี่ยนแปลงที่พร้อมบันทึก</p>' : ''}${expired ? '<p class="field-error">ผลเปรียบเทียบหมดอายุ กรุณาเปรียบเทียบใหม่</p>' : ''}<p class="import-footnote">บันทึกเฉพาะรายการใหม่และช่องที่เปลี่ยนแปลง ข้อมูลที่เหมือนเดิมและรายการที่ไม่มีในไฟล์จะยังอยู่ตามเดิม</p><div class="import-actions"><button class="button button-secondary" data-action="import-back" ${state.busy ? 'disabled' : ''}>ย้อนกลับ</button><button class="button button-primary" data-action="apply-import" ${state.busy || !changeCount || (summary.error && !imp.skipErrors) || expired || !canImport(imp.dataset) ? 'disabled' : ''}>${state.busy ? 'กำลังยืนยัน…' : imp.uncertain ? 'ตรวจผลการยืนยันอีกครั้ง' : 'ยืนยันบันทึก ' + number(changeCount) + ' รายการ'}</button></div><button class="button button-subtle" data-action="compare-import" ${state.busy ? 'disabled' : ''}>เปรียบเทียบใหม่</button>`;
    }
    if (imp.step === 4) body = `<div class="import-success"><div class="success-icon">${icon('check')}</div><h3>บันทึกการเปลี่ยนแปลงแล้ว</h3><div class="result-totals" id="import-result-summary">${[['added','เพิ่มใหม่'],['changed','ปรับรายละเอียด'],['unchanged','ไม่เปลี่ยนแปลง'],['skipped','ข้ามข้อผิดพลาด']].map(([key,label]) => `<div><strong>${number(imp.result[key])}</strong><span>${label}</span></div>`).join('')}</div><p>รายการที่ตรงกับข้อมูลเดิมไม่ได้บันทึกซ้ำ</p></div><div class="import-actions"><button class="button button-secondary" data-action="import-again">ตรวจไฟล์เดิมอีกครั้ง</button><button class="button button-primary" data-action="finish-import">ดูรายการ${item.label}</button></div>`;
    byId('import-view').innerHTML = `<div class="import-top"><h2 id="import-title" tabindex="-1">นำเข้าข้อมูล${item.singular}</h2><button class="button button-subtle" data-action="close-import" ${state.busy ? 'disabled' : ''}>กลับรายการ</button></div><ol class="import-steps" aria-label="ขั้นตอนนำเข้า">${steps.map((step,index) => `<li class="${imp.step === index + 1 ? 'current' : imp.step > index + 1 ? 'done' : ''}" ${imp.step === index + 1 ? 'aria-current="step"' : ''}><span class="step-number">${index + 1}</span>${step}</li>`).join('')}</ol><div class="import-body">${body}</div>${imp.error ? `<p class="field-error import-error" role="alert">${esc(imp.error)}</p>` : ''}`;
  }
  async function compareImport() {
    const imp = state.import, generation = authGeneration; if (state.busy || !canImport(imp.dataset)) return;
    state.busy = true; imp.error = ''; renderImport();
    try {
      const parsed = MasterDataImport.mappedRows(imp.file.sheets[imp.sheet], imp.header, imp.mapping);
      const data = {dataset:imp.dataset, rows:parsed.rows, bindings:imp.bindings};
      if (new TextEncoder().encode(JSON.stringify(data)).length > 5 * 1024 * 1024) throw new Error('ข้อมูลหลังจับคู่ใหญ่เกิน 5 MB กรุณาแบ่งไฟล์');
      const review = await api.request('reviewImport', data); if (generation !== authGeneration || state.import !== imp) return; imp.review = review; imp.notes = parsed.notes; imp.skipErrors = false; imp.uncertain = false; imp.step = 3;
    } catch (error) { if (generation !== authGeneration || state.import !== imp) return; imp.error = error.message; }
    state.busy = false; renderImport(); syncDirty(); byId('import-title')?.focus();
  }
  async function applyImport() {
    const imp = state.import, generation = authGeneration; if (state.busy || !canImport(imp.dataset) || !imp.review || (!imp.skipErrors && imp.review.summary.error) || !(imp.review.summary.new + imp.review.summary.changed)) return;
    state.busy = true; imp.error = ''; renderImport();
    try { const result = await api.request('commitImport', {dataset:imp.dataset, reviewId:imp.review.reviewId, skipErrors:imp.skipErrors}); if (generation !== authGeneration || state.import !== imp) return; imp.result = result; imp.step = 4; imp.uncertain = false; syncDirty(); }
    catch (error) { if (generation !== authGeneration || state.import !== imp) return; imp.error = error.message; imp.uncertain = ['network_error','session_changed'].includes(error.code); }
    state.busy = false; renderImport(); byId('import-title')?.focus();
  }
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action]'); if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === 'home') { if (!state.busy) window.AkraModule.home(PORTAL); return; }
    if (state.busy) return;
    if (action === 'dataset') navigate({kind:'dataset', dataset:target.dataset.dataset});
    if (action === 'select') navigate({kind:'select', id:target.dataset.id});
    if (action === 'back-list') navigate({kind:'back'});
    if (action === 'edit-record' && canManage(state.dataset)) { state.editRecord = {...current()}; state.mode = 'edit'; state.draft = Object.fromEntries(fields().map(([key]) => [key,current()[key] || ''])); state.errors = {}; state.confirm = false; renderDetail(); byId('field-name').focus(); }
    if (action === 'cancel-edit') navigate({kind:'back'});
    if (action === 'keep-editing') { state.pending = null; renderDetail(); }
    if (action === 'discard-and-go') runNavigation(state.pending);
    if (action === 'reset-search') { state.savedRecord = null; state.search = ''; state.status = 'all'; state.offset = 0; loadList(); }
    if (action === 'reload' || action === 'reload-record') navigate({kind:'reload'});
    if (action === 'reload-history') loadHistory();
    if (action === 'previous-page' || action === 'next-page') { state.savedRecord = null; state.offset = Math.max(0, state.offset + (action === 'next-page' ? state.limit : -state.limit)); loadList(); }
    if (action === 'toggle-status') { state.confirm = true; renderDetail(); }
    if (action === 'cancel-status') { state.confirm = false; renderDetail(); }
    if (action === 'confirm-status') changeStatus();
    if (action === 'import-dataset') { state.import.dataset = target.dataset.dataset; state.import.file = null; state.import.bindings = {}; state.import.error = ''; renderImport(); syncDirty(); }
    if (action === 'import-next' && state.import.file) { configureMapping(); state.import.step = 2; renderImport(); }
    if (action === 'import-back') { state.import.step = Math.max(1, state.import.step - 1); state.import.review = null; state.import.error = ''; renderImport(); }
    if (action === 'close-import' || action === 'finish-import') { ++navigationGeneration; state.dataset = state.import.dataset; state.view = 'catalog'; state.import = null; state.mode = 'view'; state.offset = 0; state.search = ''; state.status = 'active'; state.selected = null; state.savedRecord = null; state.records = []; state.counts = {}; state.mobileDetail = false; history.replaceState({}, '', location.pathname + location.search + '#tab-' + state.dataset); syncDirty(); render(); loadList(); }
    if (action === 'compare-import') compareImport();
    if (action === 'apply-import') applyImport();
    if (action === 'bind-vendor') { state.import.bindings[target.dataset.code] = target.dataset.id; compareImport(); }
    if (action === 'bind-all') { state.import.review.rows.filter(row => row.type === 'error' && row.candidate).forEach(row => { state.import.bindings[row.code] = row.candidate.id; }); compareImport(); }
    if (action === 'import-again') { state.import.step = 2; state.import.review = null; state.import.result = null; state.import.skipErrors = false; renderImport(); syncDirty(); }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'catalog-search' && state.mode === 'view' && !state.busy) { state.savedRecord = null; state.search = event.target.value; state.offset = 0; clearTimeout(searchTimer); ++listGeneration; searchTimer = setTimeout(loadList, 250); }
    if (event.target.closest('#record-form') && event.target.name && !state.busy) { state.draft[event.target.name] = event.target.value; syncDirty(); }
  });
  document.addEventListener('change', async event => {
    if (state.busy) return;
    const target = event.target;
    if (target.id === 'status-filter' && state.mode === 'view' && !state.busy) { state.savedRecord = null; state.status = target.value; state.offset = 0; loadList(); }
    if (target.id === 'import-file' && target.files[0]) {
      const imp = state.import; state.busy = true; imp.error = ''; renderImport();
      try { imp.file = await MasterDataImport.readFile(target.files[0], window.XLSX); }
      catch (error) { imp.file = null; imp.error = error.message; }
      if (state.import === imp && session) { state.busy = false; renderImport(); syncDirty(); }
    }
    if (target.id === 'import-sheet') { state.import.sheet = Number(target.value); configureMapping(); renderImport(); }
    if (target.id === 'import-header') {
      const value = Number(target.value); if (!Number.isInteger(value) || value < 1 || value > 50) { state.import.error = 'แถวหัวตารางต้องอยู่ระหว่าง 1 ถึง 50'; renderImport(); return; }
      state.import.header = value; state.import.mapping = MasterDataImport.suggestMapping(importColumns(), meta[state.import.dataset].fields.map(([key]) => key), state.import.dataset); state.import.bindings = {}; state.import.error = ''; renderImport();
    }
    if (target.dataset.mapping) { state.import.mapping[target.dataset.mapping] = target.value; state.import.bindings = {}; renderImport(); byId('mapping-' + target.dataset.mapping)?.focus(); }
    if (target.id === 'skip-import-errors') { state.import.skipErrors = target.checked; renderImport(); byId('skip-import-errors')?.focus(); }
  });
  document.addEventListener('submit', event => { if (event.target.id === 'record-form') saveRecord(event); });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && state.view === 'catalog') { event.preventDefault(); byId('catalog-search').focus(); }
    if (event.target.closest('#dataset-tabs') && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const keys = Object.keys(meta), index = keys.indexOf(state.dataset), next = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length; navigate({kind:'dataset', dataset:keys[next]}); }
  });
  window.addEventListener('hashchange', () => { const dataset = hashDataset(); if (dataset && dataset !== state.dataset && state.view === 'catalog') navigate({kind:'dataset', dataset}); });
  window.addEventListener('storage', event => { if ((event.key === STORAGE_KEY || event.key === null) && event.oldValue !== event.newValue) invalidate('บัญชีในแท็บอื่นเปลี่ยนแล้ว กรุณาเปิดจาก Main อีกครั้ง'); });
  byId('add-record').addEventListener('click', () => navigate({kind:'add'})); byId('open-import').addEventListener('click', () => navigate({kind:'import'})); byId('auth-retry').addEventListener('click', verifyAccess);
  document.body.classList.toggle('master-data-embedded', window.AkraModule?.embedded === true);
  verifyAccess();
}());
