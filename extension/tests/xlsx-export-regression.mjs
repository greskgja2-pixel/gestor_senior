import assert from 'node:assert/strict';
import {buildXlsxBlob} from '../src/lib/xlsx-export.js';

const blob=buildXlsxBlob(['Produto','GMV','ROAS'],[['Teste',123.45,4.2]],'Anuncios');
assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
const bytes=new Uint8Array(await blob.arrayBuffer());
assert.ok(bytes.length>500,'arquivo XLSX deve ter conteúdo');
assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);assert.equal(bytes[2],0x03);assert.equal(bytes[3],0x04);
console.log('xlsx-export-regression: OK');
