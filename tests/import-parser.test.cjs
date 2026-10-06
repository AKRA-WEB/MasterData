const test = require('node:test');
const assert = require('node:assert/strict');
const parser = require('../js/import-parser.js');
const XLSX = require('../assets/vendor/xlsx-0.20.3.full.min.js');
const sheet = rows => ({name:'ข้อมูล', rows:rows.map(row => row.map(value => ({t:'s', v:String(value), w:String(value)})))});

test('CSV preserves BOM, leading zeros, quoted multiline contacts and escaped quotes', () => {
  const rows = parser.parseCSV('\uFEFFCustomer ID,Name,Address\r\n000314,"ชื่อ ""เอ""","หนึ่ง\r\nสอง"\r\n');
  assert.equal(rows[1][0].v, '000314'); assert.equal(rows[1][1].v, 'ชื่อ "เอ"'); assert.equal(rows[1][2].v, 'หนึ่ง\r\nสอง');
  assert.throws(() => parser.parseCSV('Code,Name\n01,"unfinished'), /คำพูด/);
});
test('CSV semicolon and tab headers are detected without coercing identifier text', () => {
  assert.equal(parser.parseCSV('Code;Name\n001;ตัวอย่าง')[1][0].v, '001');
  assert.equal(parser.parseCSV('Code\tName\n002\tตัวอย่าง')[1][0].v, '002');
});
test('report title row is detected and composed personal name is explicit', () => {
  const input = sheet([['รายงานสมาชิก'],['Customer ID','First name','Last name','Company name'],['000314','เอ','ตัวอย่าง','บริษัทตัวอย่าง'],['000315','','','ร้านสมมติ']]);
  assert.equal(parser.suggestHeader(input), 2);
  const mapping = parser.suggestMapping(parser.headers(input, 2), ['code','name','company'], 'members');
  assert.equal(mapping.name, '@person');
  const personal = parser.mappedRows(input, 2, mapping);
  assert.equal(personal.rows[0].row, 3); assert.equal(personal.rows[0].record.code, '000314');
  assert.equal(personal.rows[0].record.name, 'เอ ตัวอย่าง'); assert.equal(personal.rows[1].record.name, '');
  mapping.name = '@person-company';
  assert.equal(parser.mappedRows(input, 2, mapping).rows[1].record.name, 'ร้านสมมติ');
});
test('mapped blank remains an explicit clear; unmapped optional fields are omitted', () => {
  const input = sheet([['Code','Name','Phone','Address'],['001','สมาชิก','','ที่อยู่']]);
  assert.deepEqual(parser.mappedRows(input,1,{code:'0',name:'1',phone:'2',address:''}).rows[0].record,{code:'001',name:'สมาชิก',phone:''});
});
test('Quantity cannot be mapped to any field or sent in parsed records', () => {
  const input = sheet([['Product code','Product name','Quantity','Unit'],['P01','สินค้า','99','ถุง']]);
  const columns = parser.headers(input, 1), mapping = parser.suggestMapping(columns,['code','name','unit'],'products');
  assert(columns[2].excluded); assert.deepEqual(parser.mappedRows(input,1,mapping).rows[0].record,{code:'P01',name:'สินค้า',unit:'ถุง'});
  assert.throws(() => parser.mappedRows(input,1,{code:'2',name:'1'}), /Quantity/);
});
test('real XLSX reader retains text and numeric format zeros and rejects formula/unsafe codes', async () => {
  const ws = XLSX.utils.aoa_to_sheet([['Customer ID','Name'],['000314','สมาชิกเอ'],[315,'สมาชิกบี'],[1,'สูตร'],[9007199254740992,'เลขยาว']]);
  ws.A3.z = '000000'; ws.A4.f = '1+0';
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'MemberList');
  const bytes = XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
  const file = {name:'fictional.xlsx',size:bytes.length,arrayBuffer:async()=>bytes};
  const imported = await parser.readFile(file,XLSX);
  const result = parser.mappedRows(imported.sheets[0],1,{code:'0',name:'1'});
  assert.equal(result.rows[0].record.code,'000314'); assert.equal(result.rows[1].record.code,'000315');
  assert.equal(result.rows[2].record.code,''); assert.equal(result.rows[3].record.code,'');
  assert.equal(Object.keys(result.notes).length,2);
});
test('unsafe exponential, fractional and negative numeric codes require source correction', () => {
  const input = sheet([['Code','Name'],['x','สมมติ'],['x','สมมติ'],['x','สมมติ']]);
  input.rows[1][0]={t:'n',v:10000000000,w:'1E+10'};input.rows[2][0]={t:'n',v:1.5,w:'1.5'};input.rows[3][0]={t:'n',v:-1,w:'-1'};
  const result=parser.mappedRows(input,1,{code:'0',name:'1'});
  assert(result.rows.every(row=>row.record.code==='')); assert.equal(Object.keys(result.notes).length,3);
});
test('large, unsupported, empty and malformed worksheet inputs fail visibly', async () => {
  await assert.rejects(parser.readFile({name:'large.xlsx',size:parser.MAX_FILE_BYTES+1},XLSX),/10 MB/);
  await assert.rejects(parser.readFile({name:'wrong.xls',size:1},XLSX),/xlsx/);
  assert.throws(()=>parser.mappedRows(sheet([['Code','Name']]),1,{code:'0',name:'1'}),/ไม่พบรายการ/);
  assert.throws(()=>parser.fromWorkbook({SheetNames:['Huge'],Sheets:{Huge:{'!ref':'A1:B10052'}}},XLSX),/ใหญ่เกิน/);
  assert.throws(()=>parser.mappedRows(sheet([['Code'],['001']]),0,{code:'0'}),/หัวตาราง/);
});
