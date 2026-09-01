/**
 * МАЯК Copilot v2 — Persona Tests
 * Run: node tests/copilot_test.js
 */
var fs = require('fs');
var vm = require('vm');

// Load copilot.js
var copilotCode = fs.readFileSync(__dirname + '/../copilot.js', 'utf8');
var sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(copilotCode, sandbox);

var Copilot = sandbox.window.Copilot;
var passed = 0, failed = 0;
function assert(c, n) { if(c){ passed++; console.log('  ✓ ' + n); } else { failed++; console.error('  ✗ FAIL: ' + n); } }

console.log('\n=== Copilot v2 Persona Tests ===\n');

// Helper stubs
function fmt(n) { return String(n) + '₽'; }
function esc(s) { return String(s); }
function canAfford(amt) {
  return {verdict: amt < 5000 ? 'yes' : amt < 20000 ? 'warn' : 'no',
    txt: amt < 5000 ? 'Да, потяну' : amt < 20000 ? 'Можно, но осторожно' : 'Не советую',
    riskMin: -5000, safeMin: 10000, color: amt < 5000 ? 'var(--grn)' : 'var(--red)'};
}
function debtSnowball() { return {total: 50000, months: 12, strategy: 'snowball', txt: 'Гаси по 4200/мес', first:'Кредитка', monthlyExtra:8000, interest:12000}; }
function calcDailyLimit() { return {perDay: 1500, daysLeft: 15}; }
function cashRunway() { return 25; }
function getSignals() { return [{sev:7, title:'Долги >30%', desc:'Сократи', benefit:5000, act:{t:'fixed'}}]; }
function whatIf(amt) { return {originalMin: 10000, newMin: 10000 + amt, diff: amt}; }
function setupState() { return {done:3, total:4, st:{inc:true,bal:true,pay:true,env:false}}; }
function calcRiskScore() { return {score:65, grade:'B', factors:[]}; }
function minBalance(d) { return {val: 5000}; }
function allSpends() { return [{d:new Date(),s:500,n:'Кофе',cat:'cafe'},{d:new Date(),s:300,n:'Обед',cat:'cafe'}]; }
function catById(id) { return {n:'Кафе', id:id}; }

var helpers = {fmt:fmt, esc:esc, canAfford:canAfford, debtSnowball:debtSnowball,
  calcDailyLimit:calcDailyLimit, cashRunway:cashRunway, getSignals:getSignals,
  whatIf:whatIf, setupState:setupState, calcRiskScore:calcRiskScore,
  minBalance:minBalance, allSpends:allSpends, catById:catById};

// ===== Persona 1: Newbie (no data) =====
console.log('[Persona 1: Newbie — no data]');
Copilot.resetSession();
var newbie = {income:0, spends:[], subs:[], credits:[], goals:[], pays:[], insts:[], envs:[]};

var r1g = Copilot.process('Привет', newbie, helpers);
assert(r1g.text.indexOf('Привет') !== -1, 'greeting works');
assert(r1g.chips.length > 0, 'has follow-up chips');
assert(r1g.session.userState === 'new', 'detected as new user');
assert(r1g.followUp === 'income_question' || r1g.text.indexOf('доход') !== -1 || r1g.chips[0].query.indexOf('доход') !== -1, 'asks for income or suggests it');

var r1h = Copilot.process('Что ты умеешь?', newbie, helpers);
assert(r1h.text.indexOf('Бюджет') !== -1, 'help lists budget');
assert(r1h.text.indexOf('Долги') !== -1, 'help lists debt');
assert(r1h.text.indexOf('Инвестиции') !== -1, 'help lists invest');

var r1b = Copilot.process('Как составить бюджет?', newbie, helpers);
assert(r1b.text.indexOf('50') !== -1 && r1b.text.indexOf('20') !== -1, 'budget explains 50/30/20');

// Test clarifying question for vague query
var r1v = Copilot.process('расскажи мне что-нибудь', newbie, helpers);
assert(r1v.chips.length >= 2, 'vague query gets chips with options');

// ===== Persona 2: Established user (income + data) =====
console.log('\n[Persona 2: Established — has income]');
Copilot.resetSession();
var saver = {income:80000, spends:[], subs:[], credits:[], goals:[], pays:[{n:'Аренда',s:25000,d:1}], insts:[], envs:[{n:'Продукты',lim:15000}]};

var r2g = Copilot.process('Привет', saver, helpers);
assert(r2g.text.indexOf('Привет') !== -1, 'greeting works for established');
assert(r2g.session.userState === 'established', 'detected as established');

var r2b = Copilot.process('Как мой бюджет?', saver, helpers);
assert(r2b.text.indexOf('бюджет') !== -1 || r2b.text.indexOf('Бюджет') !== -1, 'budget analysis');
assert(r2b.text.indexOf('Обязательные') !== -1 || r2b.text.indexOf('Гибкие') !== -1 || r2b.text.indexOf('50') !== -1, 'mentions budget categories');

var r2s = Copilot.process('Как начать копить?', saver, helpers);
assert(r2s.text.indexOf('копи') !== -1 || r2s.text.indexOf('отклад') !== -1 || r2s.text.indexOf('подушк') !== -1, 'savings advice');

var r2e = Copilot.process('Как создать подушку безопасности?', saver, helpers);
assert(r2e.text.indexOf('подушк') !== -1 || r2e.text.indexOf('Подушк') !== -1, 'emergency fund advice');

// ===== Persona 3: Debtor =====
console.log('\n[Persona 3: Debtor — has debt]');
var debtor = {income:60000, spends:[], subs:[], credits:[{cur:100000,pay:5000,n:'Кредитка'}], goals:[], pays:[], insts:[], envs:[]};

var r3d = Copilot.process('Как быстрее закрыть долги?', debtor, helpers);
assert(r3d.text.indexOf('долг') !== -1 || r3d.text.indexOf('Долг') !== -1, 'debt advice');
assert(r3d.text.indexOf('snowball') !== -1 || r3d.text.indexOf('Сноуболл') !== -1 || r3d.text.indexOf('стратегия') !== -1 || r3d.text.indexOf('Стратегия') !== -1, 'strategy mentioned');

var r3i = Copilot.process('Стоит ли гасить кредит досрочно?', debtor, helpers);
assert(r3i.text.length > 50, 'detailed response');

// ===== Persona 4: Investor-curious =====
console.log('\n[Persona 4: Investor — has income, wants to invest]');
var investor = {income:120000, spends:[], subs:[], credits:[], goals:[{n:'Подушка',cur:200000,target:400000,done:false}], pays:[], insts:[], envs:[]};

var r4i = Copilot.process('С чего начать инвестировать?', investor, helpers);
assert(r4i.text.indexOf('инвест') !== -1 || r4i.text.indexOf('Инвест') !== -1 || r4i.text.indexOf('ИИС') !== -1, 'investment advice');

var r4h = Copilot.process('Оцени моё финансовое состояние', investor, helpers);
assert(r4h.text.indexOf('здоров') !== -1 || r4h.text.indexOf('Здоров') !== -1 || r4h.text.indexOf('балл') !== -1 || r4h.text.indexOf('Score') !== -1 || r4h.text.indexOf('Grade') !== -1 || r4h.text.indexOf('B') !== -1, 'health score');

// ===== Persona 5: Spender =====
console.log('\n[Persona 5: Spender — high expenses]');
var spender = {income:50000, spends:[{d:new Date(),s:2000,n:'Обед',cat:'cafe'}], subs:[{s:2000,n:'Netflix',off:false},{s:1500,n:'Spotify',off:false}], credits:[], goals:[], pays:[], insts:[], envs:[]};

var r5a = Copilot.process('Могу купить за 5000₽?', spender, helpers);
assert(r5a.text.indexOf('5') !== -1, 'amount processed');

var r5s = Copilot.process('Мои подписки', spender, helpers);
assert(r5s.text.indexOf('подписк') !== -1 || r5s.text.indexOf('Подписк') !== -1, 'subscription audit');

var r5f = Copilot.process('Как сократить траты?', spender, helpers);
assert(r5f.text.indexOf('сократ') !== -1 || r5f.text.indexOf('Сократ') !== -1 || r5f.text.indexOf('трат') !== -1 || r5f.text.indexOf('Траты') !== -1 || r5f.text.indexOf('Вердикт') !== -1 || r5f.text.indexOf('доход') !== -1, 'spending advice');

// ===== Session memory tests =====
console.log('\n[Session memory]');
Copilot.resetSession();
var s1 = Copilot.process('Привет', newbie, helpers);
assert(s1.session.lastTopic === 'приветствие', 'first topic recorded');
Copilot.resetSession();
Copilot.process('Привет', saver, helpers);
var s2 = Copilot.process('Как мой бюджет?', saver, helpers);
assert(s2.session.topicsDiscussed.budget >= 1, 'budget topic tracked');
var s3 = Copilot.process('А ещё?', saver, helpers);
assert(s3.text.length > 10, 'general query handled with context');

// ===== Edge cases =====
console.log('\n[Edge cases]');
var rEmpty = Copilot.process('', newbie, helpers);
assert(rEmpty.text.length > 10, 'empty query handled');

var rWeird = Copilot.process('asjdkalfj', newbie, helpers);
assert(rWeird.text.length > 10, 'gibberish handled');

var rScenario = Copilot.process('Что будет, если я урежу кафе на 30%?', saver, helpers);
assert(rScenario.text.indexOf('Сценарий') !== -1 || rScenario.text.indexOf('урезать') !== -1, 'scenario works');

// ===== Intent classification =====
console.log('\n[Intent classification]');
assert(Copilot.classify('Привет').intent === 'greeting', 'greeting');
assert(Copilot.classify('Могу купить за 5000₽?').intent === 'afford', 'afford');
assert(Copilot.classify('Как закрыть долги?').intent === 'debt', 'debt');
assert(Copilot.classify('Как составить бюджет?').intent === 'budget', 'budget');
assert(Copilot.classify('Как копить?').intent === 'savings', 'savings');
assert(Copilot.classify('Мои подписки').intent === 'subscriptions', 'subscriptions');
assert(Copilot.classify('С чего начать инвестировать?').intent === 'invest', 'invest');
assert(Copilot.classify('Оцени здоровье').intent === 'health', 'health');
assert(Copilot.classify('Научи меня').intent === 'education', 'education');
assert(Copilot.classify('Спасибо').intent === 'thanks', 'thanks');
assert(Copilot.classify('Что ты умеешь?').intent === 'help', 'help');
assert(Copilot.classify('Мой доход 80000').intent === 'afford', 'income statement → afford with amount');

// ===== Amount extraction =====
console.log('\n[Amount extraction]');
assert(Copilot.classify('5000₽').amounts[0] === 5000, 'extracts 5000');
assert(Copilot.classify('20 тыс').amounts[0] === 20000, 'extracts 20k');
assert(Copilot.classify('100000').amounts[0] === 100000, 'extracts 100k');

// ===== Dynamic chips =====
console.log('\n[Dynamic chips]');
var rChips = Copilot.process('Как мой бюджет?', saver, helpers);
assert(rChips.chips.length > 0, 'budget response has chips');
assert(rChips.chips.length <= 4, 'max 4 chips');
for(var ci=0; ci<rChips.chips.length; ci++){
  assert(rChips.chips[ci].label && rChips.chips[ci].query, 'chip has label+query: ' + rChips.chips[ci].label);
}

console.log('\n=== RESULTS ===');
console.log('Passed: ' + passed + '/' + (passed + failed));
if(failed > 0) { console.error('FAILED: ' + failed); process.exit(1); }
else { console.log('ALL PERSONA TESTS PASSED'); process.exit(0); }
