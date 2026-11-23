import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {validSignerName,missingDocumentTypes,validDisclosures} from './official-submission.js';
test('name must match borrower',()=>{assert.equal(validSignerName(' Jane   Doe ','Jane','Doe'),true);assert.equal(validSignerName('Other Person','Jane','Doe'),false);});
test('documents depend on loan type',()=>{let docs=[{document_type:'identity'},{document_type:'income'}];assert.deepEqual(missingDocumentTypes(docs,'Personal'),[]);assert.deepEqual(missingDocumentTypes(docs,'Business'),['business']);});
test('disclosures require content and version',()=>{assert.equal(validDisclosures([{type:'application_attestation',version:'1',text:'Client approved text'}]),true);assert.equal(validDisclosures([]),false);assert.equal(validDisclosures([{type:'a',version:'',text:'x'}]),false);});
