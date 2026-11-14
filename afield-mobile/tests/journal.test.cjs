const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript'),vm=require('vm');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/journal.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require,Date,Math,Set});
const {saveJournal,deleteJournal,validJournalEntry}=m.exports;
const trips=[{id:'t',name:'Trip',city:'Tokyo',start:'2026-11-20',end:'2026-11-20',candidates:['p'],days:[{date:'2026-11-20',items:[{id:'e',name:'Museum',time:'10:00',must:true,customTag:'art'}]}]}];
test('journal records preserve all schedule data, update one stable record, reject unrelated entries, and delete only the record',()=>{
 const original=JSON.stringify(trips);
 let r=saveJournal(trips,'t',{date:'2026-11-20',entryId:'e',note:' A short memory '});assert.equal(r.ok,true);
 const record=r.trips[0].journal[0];assert.equal(record.note,'A short memory');assert.equal(JSON.stringify(r.trips[0].days),JSON.stringify(trips[0].days));assert.equal(JSON.stringify(trips),original);
 assert.equal(saveJournal(r.trips,'t',{date:'2026-11-20',entryId:'unknown',note:'no'}).ok,false);
 const edited=saveJournal(r.trips,'t',{id:record.id,date:record.date,entryId:record.entryId,note:'Updated'});assert.equal(edited.ok,true);assert.equal(edited.trips[0].journal.length,1);assert.equal(edited.trips[0].journal[0].id,record.id);assert.equal(edited.trips[0].journal[0].createdAt,record.createdAt);
 assert.equal(deleteJournal(edited.trips,'t','unknown').ok,false);
 assert.equal(deleteJournal(edited.trips,'t',record.id).trips[0].journal.length,0);
});
test('journal requires photo or bounded memo and accepts only private local photo copies',()=>{
 const fields={date:'2026-11-20',entryId:'e'};
 for(const input of [{...fields,note:''},{...fields,note:'x'.repeat(281)},{...fields,note:'memo',photoUri:'https://unknown.test/image.jpg'}])assert.equal(saveJournal(trips,'t',input).ok,false);
 const r=saveJournal(trips,'t',{...fields,note:'',photoUri:'file:///documents/journal-photos/a.jpg'});assert.equal(r.ok,true);assert.equal(validJournalEntry(r.trips[0].journal[0]),true);
});
