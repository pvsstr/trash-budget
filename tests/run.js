#!/usr/bin/env node
/**
 * МАЯК — Node.js Self-Test Runner
 * Tests critical financial functions extracted from app.js
 * Run: node tests/run.js
 */

var passed = 0, failed = 0, total = 0;
function assert(c, n) { total++; if(c){passed++;console.log('  ✓ '+n)} else {failed++;console.error('  ✗ FAIL: '+n)} }
function assertEq(a, b, n) { total++; if(a===b){passed++;console.log('  ✓ '+n)} else {failed++;console.error('  ✗ FAIL: '+n+' (got '+JSON.stringify(a)+', expected '+JSON.stringify(b)+')')} }

console.log('\n=== МАЯК Self-Tests ===\n');

// --- parseD ---
function parseD(s){
  if(!s){ return new Date(new Date().getFullYear(),0,1); }
  var curYear=new Date().getFullYear();
  if(s.length<=5){ var p=s.split('.'); var m=+p[1]-1; var d=+p[0]; if(m<0||m>11)m=0; if(d<1||d>31)d=1; return new Date(curYear,m,d); }
  var q=s.split('-'); var yr=+q[0]||curYear; var mo=(+q[1]||1)-1; var dy=+q[2]||1;
  if(mo<0)mo=0; if(mo>11)mo=11; if(dy<1)dy=1; if(dy>31)dy=31;
  return new Date(yr,mo,dy);
}
console.log('[parseD]');
assertEq(parseD('15.03').getDate(),15,'day=15');
assertEq(parseD('15.03').getMonth(),2,'month=2 (March)');
assert(parseD('15.03').getFullYear()===new Date().getFullYear(),'year=current');
assertEq(parseD('2025-06-20').getFullYear(),2025,'full date year');
assertEq(parseD('2025-06-20').getMonth(),5,'full date month');
assertEq(parseD('2025-06-20').getDate(),20,'full date day');
assert(parseD('').getFullYear()===new Date().getFullYear(),'empty=current year');
assert(parseD(null).getFullYear()===new Date().getFullYear(),'null=current year');
var d4=parseD('32.13'); assert(d4.getMonth()<=11&&d4.getDate()<=31,'clamps safely');

// --- addM ---
function addM(dt,k){
  var y=dt.getFullYear(); var m=dt.getMonth()+k; var d=dt.getDate();
  var lastDay=new Date(y,m+1,0).getDate();
  if(d>lastDay)d=lastDay;
  return new Date(y,m,d);
}
console.log('\n[addM]');
assertEq(addM(new Date(2026,0,31),1).getDate(),28,'Jan31+1=Feb28');
assertEq(addM(new Date(2026,0,31),1).getMonth(),1,'Jan31+1 month=Feb');
assertEq(addM(new Date(2026,11,31),1).getMonth(),0,'Dec31+1=Jan');
assertEq(addM(new Date(2026,11,31),1).getFullYear(),2027,'Dec31+1 year=2027');

// --- esc ---
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/`/g,'&#96;');}
console.log('\n[esc]');
assertEq(esc('<script>'),'&lt;script&gt;','HTML');
assertEq(esc('a&b'),'a&amp;b','ampersand');
assertEq(esc('"x"'),'&quot;x&quot;','double quote');
assertEq(esc("it's"),'it&#39;s','single quote');
assertEq(esc('`t`'),'&#96;t&#96;','backtick');
assertEq(esc(''),'','empty');
assertEq(esc(null),'','null');
assertEq(esc(42),'42','number');

// --- fmt ---
function fmt(n){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Math.round(n))+'\u00A0₽';}
console.log('\n[fmt]');
assert(fmt(12345).indexOf('1')!==-1,'formats thousands');
assertEq(fmt(0),'0\u00A0₽','zero');

// --- validateBackupImport ---
function validateBackupImport(data){
  if(!data||typeof data!=='object')return{valid:false,error:'not object'};
  var dk=['__proto__','constructor','prototype'];
  for(var i=0;i<dk.length;i++)if(Object.prototype.hasOwnProperty.call(data,dk[i]))return{valid:false,error:'dangerous'};
  if(!data.spends||!Array.isArray(data.spends))return{valid:false,error:'no spends'};
  if(!data.incomes||!Array.isArray(data.incomes))return{valid:false,error:'no incomes'};
  if(typeof data.income!=='number'&&data.income!=null)return{valid:false,error:'income'};
  if(typeof data.baseBalance!=='number'&&data.baseBalance!=null)return{valid:false,error:'baseBalance'};
  for(var j=0;j<data.spends.length;j++){var sp=data.spends[j];if(sp.s!==undefined&&typeof sp.s!=='number')return{valid:false,error:'spend#'+(j+1)};if(isNaN(sp.s))return{valid:false,error:'NaN#'+(j+1)};}
  return{valid:true};
}
console.log('\n[validateBackupImport]');
assert(!validateBackupImport(null).valid,'rejects null');
assert(!validateBackupImport({__proto__:{h:1}}).valid,'rejects __proto__');
assert(!validateBackupImport({constructor:{}}).valid,'rejects constructor');
assert(!validateBackupImport({spends:'x',incomes:[]}).valid,'rejects non-array');
assert(!validateBackupImport({spends:[{s:'x'}],incomes:[]}).valid,'rejects NaN spend');
assert(validateBackupImport({spends:[],incomes:[]}).valid,'accepts valid');
assert(validateBackupImport({spends:[{s:100}],incomes:[{s:5000}],income:80000,baseBalance:50000}).valid,'accepts full');

// --- sanitizeImportedData ---
function sanitizeImportedData(data){
  var MAX=10000,arrays=['spends','incomes','tx','pays','subs','credits','insts','goals','events','learned'];
  for(var i=0;i<arrays.length;i++)if(data[arrays[i]]&&data[arrays[i]].length>MAX)data[arrays[i]]=data[arrays[i]].slice(0,MAX);
  for(var j=0;j<(data.spends||[]).length;j++){var sp=data.spends[j];if(sp.n&&typeof sp.n==='string')sp.n=sp.n.substring(0,500);if(typeof sp.s!=='number'||isNaN(sp.s))sp.s=0;}
  for(var k=0;k<(data.incomes||[]).length;k++){var inc=data.incomes[k];if(typeof inc.s!=='number'||isNaN(inc.s))inc.s=0;}
  if(data.merchRules){var safe={};for(var r in data.merchRules){if(Object.prototype.hasOwnProperty.call(data.merchRules,r)){if(r==='__proto__'||r==='constructor'||r==='prototype')continue;if(typeof data.merchRules[r]==='string')safe[r]=data.merchRules[r];}}data.merchRules=safe;}
  return data;
}
console.log('\n[sanitizeImportedData]');
var sd1=sanitizeImportedData({spends:[{s:NaN,n:'t'}],incomes:[]});assertEq(sd1.spends[0].s,0,'fixes NaN');
var sd2=sanitizeImportedData({spends:[],incomes:[],merchRules:{'__proto__':'x','ok':'y'}});assert(!sd2.merchRules.hasOwnProperty('__proto__'),'removes proto');
assertEq(sd2.merchRules['ok'],'y','keeps valid');

// --- autoCat ---
var KEYCAT=[['scooters',['самокат','scooter']],['taxi',['такси','taxi']],['transport',['метро','автобус']],['subs',['подписк','netflix']],['health',['аптек','врач']],['cafe',['кафе','ресторан']],['grocery',['пятёроч','пятероч','продукт']],['home',['аренд','жкх']],['personal',['подарк','салон']]];
var merchRules={};
function autoCat(t){
  var s=(' '+t.toLowerCase()+' ');
  for(var r in merchRules){if(!Object.prototype.hasOwnProperty.call(merchRules,r))continue;if(r==='__proto__'||r==='constructor'||r==='prototype')continue;if(s.indexOf(r)!==-1)return merchRules[r];}
  for(var i=0;i<KEYCAT.length;i++){var kw=KEYCAT[i][1];for(var j=0;j<kw.length;j++)if(s.indexOf(kw[j])!==-1)return KEYCAT[i][0];}
  return 'other';
}
console.log('\n[autoCat]');
assertEq(autoCat('Пятёрочка'),'grocery','Пятёрочка=grocery');
assertEq(autoCat('Такси'),'taxi','Такси=taxi');
assertEq(autoCat('Метро'),'transport','Метро=transport');
assertEq(autoCat('Netflix'),'subs','Netflix=subs');
assertEq(autoCat('Аптека'),'health','Аптека=health');
assertEq(autoCat('Кафе'),'cafe','Кафе=cafe');
assertEq(autoCat('Неизвестно'),'other','unknown=other');
merchRules['моя пекарня']='cafe';assertEq(autoCat('Моя Пекарня'),'cafe','merchRules works');
merchRules['__proto__']='x';assertEq(autoCat('test __proto__'),'other','ignores proto');delete merchRules['__proto__'];

// --- calcLifeMin ---
function calcLifeMin(income,baseAvg){
  var v=Math.round(baseAvg*1.1);var f=Math.round(income*0.05);if(f<5000)f=5000;if(v<f)v=f;if(income&&v>income*0.45)v=Math.round(income*0.45);return v;
}
console.log('\n[calcLifeMin]');
assertEq(calcLifeMin(80000,20000),22000,'normal');
assertEq(calcLifeMin(80000,2000),5000,'floor 5000');
assertEq(calcLifeMin(100000,50000),45000,'cap 45%');
assertEq(calcLifeMin(20000,5000),5500,'5% floor low income');

// --- debtSnowball with interest ---
function debtSnowballCalc(debts,income,fixedPay,lifeMin){
  if(!debts||debts.length===0)return null;
  var totalDebt=0;for(var j=0;j<debts.length;j++)totalDebt+=debts[j].cur;
  var monthlyExtra=Math.max(0,income-fixedPay-lifeMin);
  if(monthlyExtra<=0)return null;
  var hasRates=false;for(var ri=0;ri<debts.length;ri++)if(debts[ri].rate>0){hasRates=true;break;}
  function sim(sorted,extra){
    var t=[];for(var i=0;i<sorted.length;i++)t.push({cur:sorted[i].cur,rate:sorted[i].rate,pay:sorted[i].pay});
    var m=0;while(t.length>0&&m<360){m++;for(var ti=0;ti<t.length;ti++){var interest=Math.round(t[ti].cur*(t[ti].rate/100/12));t[ti].cur+=interest;var p=Math.min(t[ti].cur,t[ti].pay||0);t[ti].cur-=p;}
    var freed=0;var nt=[];for(var ti2=0;ti2<t.length;ti2++){if(t[ti2].cur<=1)freed+=t[ti2].pay||0;else nt.push(t[ti2]);}t=nt;if(t.length>0){t[0].cur-=extra+freed;if(t[0].cur<0)t[0].cur=0;}}return m;}
  var sb=debts.slice().sort(function(a,b){return a.cur-b.cur;});
  var av=debts.slice().sort(function(a,b){return(b.rate||0)-(a.rate||0);});
  var msb=hasRates?sim(sb,monthlyExtra):Math.ceil(totalDebt/monthlyExtra);
  var mav=hasRates?sim(av,monthlyExtra):msb;
  return{months:Math.min(msb,mav),strategy:mav<msb?'avalanche':'snowball',hasInterest:hasRates};
}
console.log('\n[debtSnowball]');
assert(debtSnowballCalc([],80000,30000,20000)===null,'null with no debts');
var ds2=debtSnowballCalc([{cur:50000,rate:25,pay:5000}],80000,30000,20000);assert(ds2!==null,'returns result');assert(ds2.months>0,'months>0');assert(ds2.hasInterest===true,'detects interest');
var ds3=debtSnowballCalc([{cur:5000,rate:40,pay:2000},{cur:50000,rate:10,pay:8000}],80000,30000,20000);assert(ds3.strategy==='avalanche'||ds3.strategy==='snowball','valid strategy');

// --- whatIf ---
function whatIf(perDay,len){var nm=Infinity;for(var j=0;j<len;j++){var v=100000+Math.round(perDay*j);if(v<nm)nm=v;}return{originalMin:100000,newMin:nm,diff:nm-100000};}
console.log('\n[whatIf]');
assert(whatIf(100,90).diff>=0,'positive perDay');
assert(whatIf(-100,90).diff<0,'negative perDay');

// --- salaryDate ---
function salaryDateCalc(y,m,day){if(!day)day=20;var wd=new Date(y,m,day).getDay();if(wd===6)return new Date(y,m,day-1);if(wd===0)return new Date(y,m,day+1);return new Date(y,m,day);}
console.log('\n[salaryDate]');
var sd1=salaryDateCalc(2026,0,20);assert(sd1.getDay()>=1&&sd1.getDay()<=5,'weekday');
assertEq(salaryDateCalc(2026,3,19).getDay(),1,'Sun→Mon');
assertEq(salaryDateCalc(2026,7,22).getDay(),5,'Sat→Fri');

// --- cycle ---
function getLast(dt,day){dt=new Date(dt.getFullYear(),dt.getMonth(),dt.getDate());for(var i=0;i<12;i++){var c=new Date(dt.getFullYear(),dt.getMonth()-i,1);var sd=salaryDateCalc(c.getFullYear(),c.getMonth(),day);if(sd&&sd<=dt)return sd;}return new Date(dt.getFullYear(),dt.getMonth(),1);}
function getNext(dt,day){dt=new Date(dt.getFullYear(),dt.getMonth(),dt.getDate());for(var i=0;i<12;i++){var c=new Date(dt.getFullYear(),dt.getMonth()+i,1);var sd=salaryDateCalc(c.getFullYear(),c.getMonth(),day);if(sd&&sd>dt)return sd;}return new Date(dt.getFullYear(),dt.getMonth()+1,1);}
console.log('\n[cycle]');
var dt1=new Date(2026,0,15);assert(getLast(dt1,20)<=dt1,'last<=input');assert(getNext(dt1,20)>dt1,'next>input');

// --- calcDailyLimit remainder ---
function calcDL(safe,days){var r=safe%days;return{perDay:Math.round((safe-r)/days),daysLeft:days,remainder:r};}
console.log('\n[calcDailyLimit]');
var dl=calcDL(10001,30);assertEq(dl.perDay,333,'perDay=333');assertEq(dl.remainder,11,'remainder=11');

// --- Summary ---
console.log('\n=== RESULTS ===');
console.log('Passed: '+passed+'/'+total);
if(failed>0){console.error('FAILED: '+failed);process.exit(1);}
else{console.log('ALL TESTS PASSED');process.exit(0);}
