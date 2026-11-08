import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultContent,validateContent,ContentValidationError} from '../lib/content-schema';
test('content validates all configurable sections and strips unknown properties',()=>{
 const content=validateContent({...defaultContent,brandName:'Our Stars',maintenanceMode:true,unknown:'ignored'});
 assert.equal(content.brandName,'Our Stars');assert.equal(content.maintenanceMode,true);assert.equal('unknown'in content,false);
 assert.equal(defaultContent.maintenanceMode,false);assert.equal(content.steps.length,3);
});
test('content rejects incomplete copy, invalid controls, flags, email and section counts',()=>{
 for(const patch of [{brandName:''},{heroTitle:'x'.repeat(241)},{contactEmail:'invalid'},{announcement:'hello\u0000'},{maintenanceMode:'false'},{occasions:[]},{faqs:[]},{steps:[{}]}])assert.throws(()=>validateContent({...defaultContent,...patch}),ContentValidationError);
});
