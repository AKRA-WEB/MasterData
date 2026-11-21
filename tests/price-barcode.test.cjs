const test=require('node:test');
const assert=require('node:assert/strict');
const parser=require('../js/import-parser.js');
const XLSX=require('../assets/vendor/xlsx-0.20.3.full.min.js');
const sheet=rows=>({name:'Products',rows:rows.map(row=>row.map(v=>({t:'s',v,w:String(v)})))});
test('POS Price and Custom barcode id auto-map separately from Cost/Barcode type/Quantity',()=>{
 const input=sheet([['Product code','Product name','Cost','Quantity','Price','Unit','Barcode type (1=Product code, 2=Custom code)','Custom barcode id'],['0001','Fictional','99','100','0','แพ็ค','2','001234']]);
 const mapping=parser.suggestMapping(parser.headers(input,1),['code','name','unit','price','barcode'],'products');
 assert.deepEqual(mapping,{code:'0',name:'1',unit:'5',price:'4',barcode:'7'});
 const record=parser.mappedRows(input,1,mapping).rows[0].record;
 assert.equal(record.price,0);assert.equal(record.barcode,'001234');assert(!('quantity' in record));
});
test('price accepts zero and two decimals, blanks clear, missing mapping preserves',()=>{
 for(const [input,want] of [['0',0],['12.50',12.5],['1,234.50',1234.5],['',null],['999999999999.99',999999999999.99]])assert.equal(parser.parsePrice(input),want);
 for(const bad of ['-1','1.001','NaN','Infinity','1e3','1,23','1000000000000','฿12','12x'])assert.throws(()=>parser.parsePrice(bad));
 const input=sheet([['SKU','Price','Barcode'],['A','','']]);
 assert.deepEqual(parser.mappedRows(input,1,{code:'0',price:'1',barcode:'2'}).rows[0].record,{code:'A',price:null,barcode:''});
 assert.deepEqual(parser.mappedRows(input,1,{code:'0',price:'',barcode:''}).rows[0].record,{code:'A'});
});
test('XLSX uses raw price numeric precision and formatted barcode zeros',async()=>{
 const ws=XLSX.utils.aoa_to_sheet([['SKU','Price','Custom barcode id'],['A',12.5,123],['B',12.345,'0000123']]);
 ws.B2.z='"฿"#,##0.00';ws.C2.z='000000';ws.B3.z='0.00';
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Products');const bytes=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
 const input=await parser.readFile({name:'fictional.xlsx',size:bytes.length,arrayBuffer:async()=>bytes},XLSX);
 const result=parser.mappedRows(input.sheets[0],1,{code:'0',price:'1',barcode:'2'});
 assert.equal(result.rows[0].record.price,12.5);assert.equal(result.rows[0].record.barcode,'000123');
 assert.equal(result.rows[1].record.price,'12.345','invalid raw precision must reach row validation without rounding');
});
test('barcode formulas and unsafe numeric identifiers fail visibly, no cleared barcode sent',()=>{
 for(const cell of [{t:'n',v:9007199254740992,w:'9007199254740992'},{t:'n',v:1,w:'1',f:'1+0'},{t:'n',v:1.5,w:'1.5'},{t:'n',v:1e10,w:'1E+10'},{t:'n',v:-1,w:'-1'}]){
  const input=sheet([['SKU','Barcode'],['A','x']]);input.rows[1][1]=cell;
  assert.throws(()=>parser.mappedRows(input,1,{code:'0',barcode:'1'}),/บาร์โค้ด/);
 }
 const input=sheet([['SKU','Price'],['A','10']]);input.rows[1][1]={t:'n',v:10,w:'10',f:'5+5'};
 assert.throws(()=>parser.mappedRows(input,1,{code:'0',price:'1'}),/ราคา/);
});
