import test from 'node:test'; import assert from 'node:assert/strict'; import {defineWorkspace} from '../src/velocity.js';
test('plans dependencies first',()=>{const g=defineWorkspace({projects:{web:{deps:['api'],command:'build web'},api:{command:'build api'}}});assert.deepEqual(g.plan(['web']).map(x=>x.name),['api','web']);});
test('rejects cycles',()=>{const g=defineWorkspace({projects:{a:{deps:['b']},b:{deps:['a']}}});assert.throws(()=>g.order(['a']),/cycle/);});
