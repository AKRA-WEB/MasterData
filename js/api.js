(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MasterDataAPI = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const API_URL = 'https://hgxrrskztbpejirrdpbq.supabase.co/functions/v1/master-data-api';
  function hasAdminRole(user) { return Array.isArray(user?.roles) && user.roles.includes('ADMIN'); }
  const messages = {
    stale_record:'รายการนี้มีการแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก',
    stale_review:'ข้อมูลเปลี่ยนหลังจากที่ตรวจไฟล์ กรุณาเปรียบเทียบใหม่ก่อนยืนยัน',
    review_expired:'ผลเปรียบเทียบหมดอายุ กรุณาเปรียบเทียบใหม่',
    permission_denied:'สิทธิ์ของคุณไม่อนุญาตให้ทำรายการนี้ ติดต่อผู้ดูแลผ่าน Main',
    invalid_session:'เซสชันหมดอายุ กรุณาเปิดแอปจาก Main อีกครั้ง',
    duplicate_code:'รหัสนี้มีอยู่แล้ว กรุณาค้นหารายการเดิมก่อนเพิ่ม',
    session_changed:'เซสชันหรือบัญชีเปลี่ยนแล้ว กรุณาเปิดแอปจาก Main และตรวจผลก่อนทำซ้ำ'
  };
  function create(getSession, invalidated) {
    async function request(action, data) {
      const owner = getSession();
      const bridge = typeof window !== 'undefined' ? window.AkraModule : null;
      const token = bridge?.embedded ? bridge.getToken() : owner?.token;
      if (!owner || !token) throw Object.assign(new Error(messages.invalid_session), {code:'invalid_session'});
      if (!hasAdminRole(owner)) throw Object.assign(new Error('ข้อมูลกลางเปิดให้ใช้งานเฉพาะ ADMIN'), {code:'permission_denied', status:403});
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ['reviewImport', 'commitImport'].includes(action) ? 60000 : 25000);
      const operation = async () => {
        try {
          const response = await fetch(API_URL, {method:'POST', cache:'no-store', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action, data, token}), signal:controller.signal});
          const payload = await response.json().catch(() => ({}));
          let current = getSession() === owner;
          try { if (bridge?.embedded && bridge.getToken() !== token) current = false; } catch (_) { current = false; }
          if (!current) throw Object.assign(new Error(messages.session_changed), {code:'session_changed'});
          if (!response.ok || payload.success !== true) {
            const code = payload.error || 'api_error';
            if (response.status === 401) invalidated(messages.invalid_session);
            throw Object.assign(new Error(messages[code] || payload.message || 'ทำรายการไม่สำเร็จ กรุณาลองใหม่'), {code, status:response.status});
          }
          return payload.data;
        } catch (error) {
          if (error.name === 'AbortError' || error instanceof TypeError) throw Object.assign(new Error(action === 'commitImport' ? 'ยังไม่ทราบผลการยืนยัน กรุณาตรวจผลการยืนยันอีกครั้ง ระบบจะไม่บันทึกรายการเดิมซ้ำ' : 'เชื่อมต่อไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองใหม่'), {code:'network_error'});
          throw error;
        } finally { clearTimeout(timeout); }
      };
      return bridge && ['save', 'commitImport'].includes(action) ? bridge.runMutation(operation) : operation();
    }
    return {request};
  }
  return {create, API_URL, hasAdminRole};
}));
