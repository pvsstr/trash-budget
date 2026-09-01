/**
 * МАЯК Copilot — 5 Persona Tests
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

console.log('\n=== Copilot Persona Tests ===\n');

// Helper stubs
function fmt(n) { return String(n) + '₽'; }
function esc(s) { return String(s); }
function canAfford(amt) {
  return {verdict: amt < 5000 ? 'yes' : amt < 20000 ? 'risk' : 'no',
    txt: amt < 5000 ? 'Да, потяну' : 'Лучше подождать',
    riskMin: -5000, safeMin: 10000};
}
function debtSnowball() { return {total: 50000, months: 12, strategy: 'snowball', txt: 'Гаси по 4200/мес'}; }
function calcDailyLimit() { return {perDay: 1500, daysLeft: 15}; }
function cashRunway() { return 25; }
function getSignals() { return [{sev:7, title:'Долги >30%', desc:'Сократи', benefit:5000}]; }
function whatIf(amt) { return {originalMin: 10000, newMin: 10000 + amt, diff: amt}; }
function setupState() { return {done:3, total:4, st:{inc:true,bal:true,pay:true,env:false}}; }
function calcRiskScore() { return {score:65, grade:'B', factors:[]}; }
function minBalance(d) { return {val: 5000}; }
function allSpends() { return [{d:new Date(),s:500,n:'Кофе',cat:'cafe'}]; }
function catById(id) { return {n:'Кафе'}; }

var helpers = {fmt:fmt, esc:esc, canAfford:canAfford, debtSnowball:debtSnowball,
  calcDailyLimit:calcDailyLimit, cashRunway:cashRunway, getSignals:getSignals,
  whatIf:whatIf, setupState:setupState, calcRiskScore:calcRiskScore,
  minBalance:minBalance, allSpends:allSpends, catById:catById};

// ===== Persona 1: Newbie (no data) =====
console.log('[Persona 1: Newbie]');
var newbie = {income:0, spends:[], subs:[], credits:[], goals:[], pays:[], insts:[]};
var r1g = Copilot.process('Привет', newbie, helpers);
assert(r1g.html.indexOf('финансовый копилот') !== -1 || r1g.html.indexOf('Привет') !== -1, 'greeting works');
assert(r1g.chips.length > 0, 'has follow-up chips');

var r1h = Copilot.process('Что ты умеешь?', newbie, helpers);
assert(r1h.html.indexOf('Бюджет') !== -1, 'help lists budget');
assert(r1h.html.indexOf('Долги') !== -1, 'help lists debt');

var r1b = Copilot.process('Как составить бюджет?', newbie, helpers);
assert(r1b.html.indexOf('50') !== -1 && r1b.html.indexOf('30') !== -1 && r1b.html.indexOf('20') !== -1, 'budget explains 50/30/20');

// ===== Persona 2: Saver (has income, no debt) =====
console.log('\n[Persona 2: Saver]');
var saver = {income:80000, spends:[], subs:[], credits:[], goals:[], pays:[], insts:[]};
var r2m = Copilot.process('Как мой бюджет?', saver, helpers);
assert(r2m.html.indexOf('бюджет') !== -1 || r2m.html.indexOf('Бюджет') !== -1, 'budget check works');

var r2s = Copilot.process('Как начать копить?', saver, helpers);
assert(r2s.html.indexOf('копи') !== -1 || r2s.html.indexOf('отклад') !== -1 || r2s.html.indexOf('накоп') !== -1 || r2s.html.indexOf('подушк') !== -1, 'savings advice given');

var r2e = Copilot.process('Как создать подушку безопасности?', saver, helpers);
assert(r2e.html.indexOf('подушк') !== -1 || r2e.html.indexOf('Подушк') !== -1 || r2e.html.indexOf('резерв') !== -1, 'emergency fund advice');

// ===== Persona 3: Debtor (has income + debt) =====
console.log('\n[Persona 3: Debtor]');
var debtor = {income:60000, spends:[], subs:[], credits:[{cur:100000,pay:5000}], goals:[], pays:[], insts:[]};
var r3d = Copilot.process('Как быстрее закрыть долги?', debtor, helpers);
assert(r3d.html.indexOf('долг') !== -1 || r3d.html.indexOf('Долг') !== -1, 'debt advice given');
assert(r3d.html.indexOf('snowball') !== -1 || r3d.html.indexOf('Сноуболл') !== -1 || r3d.html.indexOf('стратегия') !== -1 || r3d.html.indexOf('Стратегия') !== -1, 'strategy mentioned');

var r3i = Copilot.process('Стоит ли гасить кредит досрочно?', debtor, helpers);
assert(r3i.html.length > 50, 'detailed response for debt question');

// ===== Persona 4: Investor-curious (has income, wants to invest) =====
console.log('\n[Persona 4: Investor]');
var investor = {income:120000, spends:[], subs:[], credits:[], goals:[], pays:[], insts:[]};
var r4i = Copilot.process('С чего начать инвестировать?', investor, helpers);
assert(r4i.html.indexOf('инвест') !== -1 || r4i.html.indexOf('Инвест') !== -1 || r4i.html.indexOf('подушк') !== -1, 'investment or prerequisite advice');
assert(r4i.html.indexOf('ИИС') !== -1 || r4i.html.indexOf('ETF') !== -1 || r4i.html.indexOf('фонд') !== -1 || r4i.html.indexOf('подушк') !== -1, 'mentions instruments or prerequisites');

var r4h = Copilot.process('Оцени моё финансовое состояние', investor, helpers);
assert(r4h.html.indexOf('здоров') !== -1 || r4h.html.indexOf('Здоров') !== -1 || r4h.html.indexOf('балл') !== -1, 'health score provided');

// ===== Persona 5: Spender (high expenses, asking about affordability) =====
console.log('\n[Persona 5: Spender]');
var spender = {income:50000, spends:[{d:new Date(),s:2000,n:'Обед',cat:'cafe'}], subs:[{s:2000,n:'Netflix',off:false},{s:1500,n:'Spotify',off:false}], credits:[], goals:[], pays:[], insts:[]};
var r5a = Copilot.process('Могу купить за 5000₽?', spender, helpers);
assert(r5a.html.indexOf('5') !== -1, 'amount processed');

var r5s = Copilot.process('Мои подписки', spender, helpers);
assert(r5s.html.indexOf('подписк') !== -1 || r5s.html.indexOf('Подписк') !== -1, 'subscription audit');

var r5f = Copilot.process('Как сократить траты?', spender, helpers);
assert(r5f.html.indexOf('сократ') !== -1 || r5f.html.indexOf('Сократ') !== -1 || r5f.html.indexOf('совет') !== -1 || r5f.html.indexOf('Траты') !== -1 || r5f.html.indexOf('Вердикт') !== -1, 'spending reduction advice');

// ===== Edge cases =====
console.log('\n[Edge cases]');
var rEmpty = Copilot.process('', newbie, helpers);
assert(rEmpty.html.length > 10, 'empty query handled');

var rWeird = Copilot.process('asjdkalfj', newbie, helpers);
assert(rWeird.html.length > 10, 'gibberish handled with fallback');

var rScenario = Copilot.process('Что будет, если я урежу кафе на 30%?', saver, helpers);
assert(rScenario.html.indexOf('Сценарий') !== -1 || rScenario.html.indexOf('урезать') !== -1, 'scenario works');

// ===== Intent classification =====
console.log('\n[Intent classification]');
assert(Copilot.classify('Привет') === 'greeting', 'greeting intent');
assert(Copilot.classify('Могу купить за 5000₽?') === 'afford', 'afford intent');
assert(Copilot.classify('Как закрыть долги?') === 'debt', 'debt intent');
assert(Copilot.classify('Как составить бюджет?') === 'budget', 'budget intent');
assert(Copilot.classify('Как копить?') === 'savings', 'savings intent');
assert(Copilot.classify('Мои подписки') === 'subscriptions', 'subscriptions intent');
assert(Copilot.classify('С чего начать инвестировать?') === 'invest', 'invest intent');
assert(Copilot.classify('Оцени здоровье') === 'health', 'health intent');
assert(Copilot.classify('Научи меня') === 'education', 'education intent');
assert(Copilot.classify('Спасибо') === 'thanks', 'thanks intent');
assert(Copilot.classify('Что ты умеешь?') === 'help', 'help intent');

console.log('\n=== RESULTS ===');
console.log('Passed: ' + passed + '/' + (passed + failed));
if(failed > 0) { console.error('FAILED: ' + failed); process.exit(1); }
else { console.log('ALL PERSONA TESTS PASSED'); process.exit(0); }
