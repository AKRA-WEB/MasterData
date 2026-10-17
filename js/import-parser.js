(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MasterDataImport = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MAX_ROWS = 10000, MAX_COLUMNS = 100, MAX_FILE_BYTES = 10 * 1024 * 1024;
  const aliases = {
    code: ['product code', 'sku', 'code', 'customer id', 'รหัสสินค้า', 'รหัส vendor', 'รหัสสมาชิก'],
    name: ['product name', 'vendor name', 'name', 'customer name', 'ชื่อสินค้า', 'ชื่อ vendor', 'ชื่อสมาชิก'],
    subname: ['product subname', 'subname', 'ชื่อรอง'], category: ['category', 'หมวดหมู่'], unit: ['unit', 'หน่วย'],
    barcode: ['custom barcode id', 'barcode', 'บาร์โค้ด'], contact_name: ['contact name', 'contact person', 'ผู้ติดต่อ'],
    phone: ['phone number', 'phone', 'เบอร์โทรศัพท์'], email: ['email', 'อีเมล'], address: ['address', 'ที่อยู่'],
    tax_id: ['tax id', 'เลขผู้เสียภาษี'], company: ['company name', 'company', 'ชื่อบริษัท']
  };
  const normalized = value => String(value || '').trim().toLowerCase().replace(/[\s_\-]+/g, ' ');
  function forbiddenHeader(value) {
    return /^(quantity|qty|stock quantity|available quantity|จำนวน|จำนวนคงเหลือ)$/.test(normalized(value));
  }
  function parseCSV(text, delimiter) {
    text = String(text).replace(/^\uFEFF/, '');
    if (!delimiter) {
      const first = text.split(/\r?\n/, 1)[0];
      delimiter = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
    }
    const rows = []; let row = [], value = '', quoted = false, afterQuote = false;
    const finishCell = () => { row.push({t:'s', v:value, w:value}); value = ''; afterQuote = false; };
    const finishRow = () => { finishCell(); rows.push(row); row = []; };
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { value += '"'; i++; }
        else if (char === '"') { quoted = false; afterQuote = true; }
        else value += char;
      } else if (char === delimiter) finishCell();
      else if (char === '\n' || char === '\r') { if (char === '\r' && text[i + 1] === '\n') i++; finishRow(); }
      else if (char === '"' && value === '' && !afterQuote) quoted = true;
      else if (afterQuote && char.trim()) throw new Error('รูปแบบ CSV ไม่ถูกต้อง: มีข้อความหลังเครื่องหมายปิดคำพูด');
      else if (!afterQuote) value += char;
    }
    if (quoted) throw new Error('รูปแบบ CSV ไม่ถูกต้อง: เครื่องหมายคำพูดยังปิดไม่ครบ');
    if (value || row.length || afterQuote) finishRow();
    if (rows.length > MAX_ROWS + 50) throw new Error('ไฟล์มีแถวมากเกินไป รองรับครั้งละ 10,000 รายการ');
    if (rows.some(item => item.length > MAX_COLUMNS)) throw new Error('ไฟล์มีคอลัมน์มากเกินไป รองรับไม่เกิน 100 คอลัมน์');
    return rows;
  }
  function fromWorkbook(workbook, XLSX) {
    if (!workbook.SheetNames.length) throw new Error('ไฟล์ไม่มีแผ่นงาน');
    const sheets = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      if (!sheet['!ref']) return {name, rows:[]};
      const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref']);
      if (range.e.r >= MAX_ROWS + 50 || range.e.c >= MAX_COLUMNS) throw new Error('แผ่นงานใหญ่เกินไป รองรับ 10,000 รายการและ 100 คอลัมน์');
      const rows = [];
      for (let r = 0; r <= range.e.r; r++) {
        const cells = [];
        for (let c = 0; c <= range.e.c; c++) cells.push(sheet[XLSX.utils.encode_cell({r, c})] || {t:'s', v:'', w:''});
        rows.push(cells);
      }
      return {name, rows};
    });
    return {sheets};
  }
  async function readFile(file, XLSX) {
    if (!file) throw new Error('กรุณาเลือกไฟล์');
    if (file.size > MAX_FILE_BYTES) throw new Error('ไฟล์ใหญ่เกิน 10 MB กรุณาแบ่งไฟล์ก่อนนำเข้า');
    if (/\.csv$/i.test(file.name)) return {name:file.name, sheets:[{name:'CSV', rows:parseCSV(await file.text())}]};
    if (!/\.xlsx$/i.test(file.name)) throw new Error('รองรับไฟล์ .xlsx และ .csv');
    if (!XLSX) throw new Error('ตัวอ่าน Excel ยังไม่พร้อม กรุณาโหลดแอปใหม่');
    const workbook = XLSX.read(await file.arrayBuffer(), {type:'array', cellText:true, cellNF:true, cellFormula:true, sheetRows:MAX_ROWS + 51});
    return {...fromWorkbook(workbook, XLSX), name:file.name};
  }
  const text = cell => String(cell?.w ?? cell?.v ?? '').trim();
  function headers(sheet, headerRow) {
    const row = sheet.rows[headerRow - 1] || [];
    return row.map((cell, index) => ({index:String(index), label:text(cell) || `คอลัมน์ ${index + 1}`, excluded:forbiddenHeader(text(cell))}));
  }
  function suggestHeader(sheet) {
    let selected = 1, best = 0;
    for (let index = 0; index < Math.min(sheet.rows.length, 50); index++) {
      const names = sheet.rows[index].map(cell => normalized(text(cell)));
      const score = Object.values(aliases).filter(options => options.some(option => names.includes(option))).length;
      if (score > best) { best = score; selected = index + 1; }
    }
    return selected;
  }
  function suggestMapping(columns, keys, dataset) {
    const mapping = Object.fromEntries(keys.map(key => [key, columns.find(column => !column.excluded && (aliases[key] || []).includes(normalized(column.label)))?.index ?? '']));
    if (dataset === 'members' && !mapping.name && columns.some(column => normalized(column.label) === 'first name')) mapping.name = '@person';
    return mapping;
  }
  function mappedRows(sheet, headerRow, mapping) {
    if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > 50) throw new Error('แถวหัวตารางต้องอยู่ระหว่าง 1 ถึง 50');
    const columns = headers(sheet, headerRow), byName = name => columns.find(column => normalized(column.label) === name)?.index;
    const fieldIndexes = Object.values(mapping).filter(index => index !== '' && !index.startsWith('@'));
    if (fieldIndexes.some(index => !/^\d+$/.test(index) || !columns[Number(index)] || columns[Number(index)].excluded)) throw new Error('เลือกคอลัมน์ที่ใช้ได้ และไม่ใช้ข้อมูล Quantity');
    const mapped = [], notes = {};
    for (let index = headerRow; index < sheet.rows.length; index++) {
      const cells = sheet.rows[index];
      if (!cells.some(cell => text(cell))) continue;
      const record = {}, issues = [];
      for (const [key, column] of Object.entries(mapping)) {
        if (column === '') continue;
        if (key === 'name' && column.startsWith('@person')) {
          const combined = [byName('first name'), byName('last name')].map(position => position === undefined ? '' : text(cells[Number(position)])).filter(Boolean).join(' ');
          const company = byName('company name');
          record.name = combined || (column === '@person-company' && company !== undefined ? text(cells[Number(company)]) : '');
          continue;
        }
        const cell = cells[Number(column)];
        record[key] = text(cell);
        if (key === 'code' && (cell?.f || (cell?.t === 'n' && (!Number.isSafeInteger(cell.v) || cell.v < 0 || /[eE][+-]?\d/.test(record[key]))))) {
          record.code = '';
          issues.push(cell?.f ? 'รหัสเป็นสูตร กรุณาแปลงเป็นข้อความในไฟล์' : 'รหัสเป็นตัวเลขที่อาจสูญเสียความแม่นยำ กรุณาแก้เป็นข้อความในไฟล์');
        }
      }
      const row = index + 1;
      mapped.push({row, record});
      if (issues.length) notes[row] = issues;
    }
    if (!mapped.length) throw new Error('ไม่พบรายการใต้หัวตาราง กรุณาตรวจแผ่นงานและแถวหัวตาราง');
    if (mapped.length > MAX_ROWS) throw new Error('รองรับครั้งละ 10,000 รายการ กรุณาแบ่งไฟล์');
    return {rows:mapped, notes};
  }
  return {MAX_ROWS, MAX_FILE_BYTES, parseCSV, fromWorkbook, readFile, headers, suggestHeader, suggestMapping, mappedRows, forbiddenHeader};
}));
