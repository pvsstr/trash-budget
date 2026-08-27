// Тесты для budget-модулей
// Запуск: node tests/budget.test.js

import { salaryDate, getLastSalaryDate, getNextSalaryDate, cycleStart, cycleEnd, shiftCycle, inCycle } from '../modules/cycle.js';
import { autoCat, CATS, catById } from '../modules/categories.js';
import { allSpends, sums, realBal, nextPay, calcSafeBalance, calcDailyLimit, calcMonthlyFixedPay, calcLifeMin } from '../modules/budget.js';
import { forecastCashFlow, cashRunway, minBalance, canAfford, debtSnowball } from '../modules/forecast.js';
import { validateSalaryDay, validateAmount, validateIncome, validateBalance, validateCategory, validateCycleMode, validateName, validateDataObject, validateBackupImport } from '../modules/validation.js';

var passed = 0;
var failed = 0;
var total = 0;

function assert(condition, msg){
  total++;
  if(condition){
    passed++;
  } else {
    failed++;
    console.error('  FAIL: ' + msg);
  }
}

function assertEq(actual, expected, msg){
  total++;
  if(actual === expected){
    passed++;
  } else {
    failed++;
    console.error('  FAIL: ' + msg + ' (got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected) + ')');
  }
}

function suite(name, fn){
  console.log('\n=== ' + name + ' ===');
  fn();
}

// ===== Тесты cycle.js =====

suite('salaryDate — пятница 20-го (выходной)', function(){
  // 20 августа 2026 — четверг → 20-е
  var d = salaryDate(2026, 7, 20);
  assertEq(d.getDate(), 20, '20.08.2026 —周四 → 20-е');
  assertEq(d.getMonth(), 7, 'месяц август');

  // 20 сентября 2026 — воскресенье → 21-е
  var d2 = salaryDate(2026, 8, 20);
  assertEq(d2.getDate(), 21, '20.09.2026 — воскресенье → 21-е');

  // 20 февраля 2027 — суббота → 19-е (пятница)
  var d3 = salaryDate(2027, 1, 20);
  assertEq(d3.getDate(), 19, '20.02.2027 — суббота → 19-е');

  // 20 июня 2026 — суббота → 19-е
  var d4 = salaryDate(2026, 5, 20);
  assertEq(d4.getDate(), 19, '20.06.2026 — суббота → 19-е');
});

suite('salaryDate — другой день зарплаты', function(){
  // 10-е число, 10 октября 2026 — суббота → 9-е
  var d = salaryDate(2026, 9, 10);
  assertEq(d.getDate(), 9, '10.10.2026 — суббота → 9-е');

  // 15-е, 15 июля 2026 — среда → 15-е
  var d2 = salaryDate(2026, 6, 15);
  assertEq(d2.getDate(), 15, '15.07.2026 — среда → 15-е');
});

suite('getLastSalaryDate', function(){
  // 25 августа 2026 → последняя зарплата 20 августа (четверг)
  var dt = new Date(2026, 7, 25);
  var last = getLastSalaryDate(dt, 20);
  assertEq(last.getDate(), 20, '25.08 → 20.08');
  assertEq(last.getMonth(), 7, 'август');

  // 19 августа 2026 → последняя зарплата 20 июля (20-е — понедельник)
  var dt2 = new Date(2026, 7, 19);
  var last2 = getLastSalaryDate(dt2, 20);
  assertEq(last2.getDate(), 20, '19.08 → 20.07');
  assertEq(last2.getMonth(), 6, 'июль');
});

suite('getNextSalaryDate', function(){
  // 25 августа 2026 → следующая зарплата 21 сентября (20-е — воскресенье)
  var dt = new Date(2026, 7, 25);
  var next = getNextSalaryDate(dt, 20);
  assertEq(next.getDate(), 21, '25.08 → 21.09');
  assertEq(next.getMonth(), 8, 'сентябрь');

  // 15 августа → следующая 20 августа (четверг)
  var dt2 = new Date(2026, 7, 15);
  var next2 = getNextSalaryDate(dt2, 20);
  assertEq(next2.getDate(), 20, '15.08 → 20.08');
  assertEq(next2.getMonth(), 7, 'август');
});

suite('cycleStart / cycleEnd — salary mode', function(){
  var dt = new Date(2026, 7, 25); // 25 августа
  var cs = cycleStart(dt, 'salary', 20);
  var ce = cycleEnd(cs, 'salary', 20);
  assertEq(cs.getDate(), 20, 'cycleStart 25.08 → 20.08');
  assertEq(ce.getDate(), 21, 'cycleEnd от 20.08 → 21.09');
  assertEq(ce.getMonth(), 8, 'конец цикла — сентябрь');
});

suite('cycleStart / cycleEnd — calendar mode', function(){
  var dt = new Date(2026, 7, 25);
  var cs = cycleStart(dt, 'calendar', 20);
  var ce = cycleEnd(cs, 'calendar', 20);
  assertEq(cs.getDate(), 1, 'calendar: начало — 1-е число');
  assertEq(cs.getMonth(), 7, 'calendar: август');
  assertEq(ce.getDate(), 1, 'calendar: конец — 1-е следующего');
  assertEq(ce.getMonth(), 8, 'calendar: сентябрь');
});

suite('shiftCycle', function(){
  var cs = new Date(2026, 7, 20);
  var next = shiftCycle(cs, 1, 'salary', 20);
  assertEq(next.getMonth(), 8, 'следующий цикл — сентябрь');
  assertEq(next.getDate(), 21, 'следующий цикл — 21-е (воскресенье→пн)');

  var prev = shiftCycle(cs, -1, 'salary', 20);
  assertEq(prev.getMonth(), 6, 'предыдущий цикл — июль');
});

suite('inCycle', function(){
  var cs = new Date(2026, 7, 20);
  var ce = cycleEnd(cs, 'salary', 20);
  assert(inCycle(new Date(2026, 7, 25), cs, 'salary', 20), '25.08 в цикле 20.08-21.09');
  assert(!inCycle(new Date(2026, 8, 21), cs, 'salary', 20), '21.09 не в цикле 20.08-21.09');
  assert(inCycle(new Date(2026, 7, 20), cs, 'salary', 20), '20.08 (начало) в цикле');
});

// ===== Тесты categories.js =====

suite('autoCat — ключевые слова', function(){
  assertEq(autoCat('Пятёрочка'), 'grocery', 'Пятёрочка → Продукты');
  assertEq(autoCat('Яндекс Такси'), 'taxi', 'Яндекс Такси → Такси');
  assertEq(autoCat('Самокат Whoosh'), 'scooters', 'Самокат Whoosh → Самокаты');
  assertEq(autoCat('Тройка地铁'), 'transport', 'Тройка → Транспорт');
  assertEq(autoCat('Кафе Лучшее'), 'cafe', 'Кафе Лучшее → Кафе');
  assertEq(autoCat('Netflix'), 'subs', 'Netflix → Подписки');
  assertEq(autoCat('Аптека'), 'health', 'Аптека → Здоровье');
  assertEq(autoCat('Ничего'), 'other', 'Ничего не подходит → Прочее');
});

suite('autoCat — правила мерчантов', function(){
  var rules = {'мой магазин':'grocery', 'квизо':'cafe'};
  assertEq(autoCat('Покупка в мой магазин', rules), 'grocery', 'Правило мерчанта → Продукты');
  assertEq(autoCat('Квизо обед', rules), 'cafe', 'Правило мерчанта → Кафе');
});

suite('catById', function(){
  assertEq(catById('grocery').n, 'Продукты', 'grocery → Продукты');
  assertEq(catById('unknown').n, 'Прочее', 'unknown → Прочее (default)');
});

// ===== Тесты budget.js =====

suite('realBal', function(){
  var D = {baseBalance:100000, incomes:[{s:50000},{s:10000}], spends:[{d:'2026-08-01',s:30000,n:'Аренда',cat:'home'}], tx:[]};
  assertEq(realBal(D), 130000, '100000 + 60000 - 30000 = 130000');
});

suite('calcSafeBalance', function(){
  // Баланс 100000, нет платежей → безопасный = 100000
  var D1 = {baseBalance:100000, incomes:[], spends:[], tx:[], pays:[], subs:[], credits:[], insts:[]};
  assertEq(calcSafeBalance(D1), 100000, 'Нет платежей → safe = real');

  // Баланс 100000, платёж 50000 → безопасный = 50000
  var D2 = {baseBalance:100000, incomes:[], spends:[], tx:[], pays:[{d:15,s:50000,n:'Аренда'}], subs:[], credits:[], insts:[]};
  var safe = calcSafeBalance(D2);
  assert(safe <= 50000, 'Платёж 50000 → safe <= 50000, got ' + safe);
  assert(safe >= 40000, 'Платёж 50000 → safe >= 40000, got ' + safe);
});

suite('calcMonthlyFixedPay', function(){
  var D = {
    pays:[{s:30000},{s:5000}],
    subs:[{s:500,off:false},{s:200,off:true}],
    credits:[{pay:10000}]
  };
  assertEq(calcMonthlyFixedPay(D), 45500, '30000+5000+500+10000 = 45500 (отключённая подписка не считается)');
});

suite('calcDailyLimit', function(){
  // Баланс 100000, нет платежей, зарплата 20-го → дней ~25
  var D = {baseBalance:100000, income:60000, salaryDay:20, cycleMode:'salary', incomes:[], spends:[], tx:[], pays:[], subs:[], credits:[], insts:[]};
  var lim = calcDailyLimit(D);
  assert(lim.perDay > 0, 'Дневной лимит > 0');
  assert(lim.daysLeft > 0, 'Дней > 0');
  assert(lim.perDay < 10000, 'Дневной лимит < 10000 для баланса 100000');
});

// ===== Тесты forecast.js =====

suite('forecastCashFlow — базовый', function(){
  var D = {baseBalance:100000, income:60000, salaryDay:20, cycleMode:'salary',
    incomes:[], spends:[], tx:[], pays:[], subs:[], credits:[], insts:[]};
  var f = forecastCashFlow(D, 30);
  assert(f.flow.length === 31, 'Прогноз на 30 дней = 31 точка');
  assert(f.flow[0].balance >= 0, 'Начальный баланс >= 0');
  assert(typeof f.flexPerDay === 'number', 'flexPerDay — число');
});

suite('forecastCashFlow — с подпиской', function(){
  var D = {baseBalance:100000, income:60000, salaryDay:20, cycleMode:'salary',
    incomes:[], spends:[], tx:[], pays:[], subs:[{s:500,off:false,n:'Тест'}], credits:[], insts:[]};
  var f = forecastCashFlow(D, 60);
  assert(f.flow.length === 61, 'Прогноз на 60 дней = 61 точка');
  // Сравниваем с прогнозом без подписки
  var D2 = {baseBalance:100000, income:60000, salaryDay:20, cycleMode:'salary',
    incomes:[], spends:[], tx:[], pays:[], subs:[], credits:[], insts:[]};
  var f2 = forecastCashFlow(D2, 60);
  assert(f.flow[f.flow.length-1].balance < f2.flow[f2.flow.length-1].balance, 'Баланс с подпиской меньше без подписки');
});

suite('cashRunway', function(){
  var D = {baseBalance:100000, income:60000, salaryDay:20, cycleMode:'salary',
    incomes:[], spends:[], tx:[], pays:[], subs:[], credits:[], insts:[]};
  var rw = cashRunway(D);
  assert(rw > 30, 'Runway > 30 дней при балансе 100k и доходе 60k');
  assert(rw <= 90, 'Runway <= 90 дней');
});

// ===== Тесты validation.js =====

suite('validateSalaryDay', function(){
  assert(validateSalaryDay(1).valid, '1 — валидно');
  assert(validateSalaryDay(28).valid, '28 — валидно');
  assert(validateSalaryDay(15).valid, '15 — валидно');
  assert(!validateSalaryDay(0).valid, '0 — невалидно');
  assert(!validateSalaryDay(29).valid, '29 — невалидно');
  assert(!validateSalaryDay('abc').valid, 'abc — невалидно');
  assert(!validateSalaryDay(-5).valid, '-5 — невалидно');
});

suite('validateAmount', function(){
  assert(validateAmount(100).valid, '100 — валидно');
  assert(validateAmount(0).valid, '0 — валидно');
  assert(!validateAmount(-1).valid, '-1 — невалидно (без allowNegative)');
  assert(validateAmount(-1, {allowNegative:true}).valid, '-1 — валидно с allowNegative');
  assert(!validateAmount('abc').valid, 'abc — невалидно');
  assert(!validateAmount(100000001, {max:100000000}).valid, '100M+ с max=100M — невалидно');
  assert(validateAmount(50, {max:100}).valid, '50 с max=100 — валидно');
  assert(!validateAmount(150, {max:100}).valid, '150 с max=100 — невалидно');
});

suite('validateIncome', function(){
  assert(validateIncome(50000).valid, '50000 — валидно');
  assert(!validateIncome(-1).valid, '-1 — невалидно');
  assert(!validateIncome('abc').valid, 'abc — невалидно');
});

suite('validateBalance', function(){
  assert(validateBalance(100000).valid, '100000 — валидно');
  assert(validateBalance(-50000).valid, '-50000 — валидно (отрицательный баланс)');
  assert(!validateBalance('abc').valid, 'abc — невалидно');
});

suite('validateCategory', function(){
  assert(validateCategory('grocery').valid, 'grocery — валидно');
  assert(validateCategory('other').valid, 'other — валидно');
  assert(!validateCategory('invalid').valid, 'invalid — невалидно');
});

suite('validateCycleMode', function(){
  assert(validateCycleMode('salary').valid, 'salary — валидно');
  assert(validateCycleMode('calendar').valid, 'calendar — валидно');
  assert(!validateCycleMode('monthly').valid, 'monthly — невалидно');
});

suite('validateName', function(){
  assert(validateName('Тест').valid, 'Тест — валидно');
  assert(validateName('  Тест  ').valid, 'Тест с пробелами — валидно');
  assertEq(validateName('  Тест  ').value, 'Тест', 'Trim работает');
  assert(!validateName('').valid, 'Пустое — невалидно');
  assert(!validateName('   ').valid, 'Только пробелы — невалидно');
  assert(!validateName(null).valid, 'null — невалидно');
});

suite('validateDataObject', function(){
  var valid = {spends:[], incomes:[], tx:[], envs:[], pays:[], subs:[], credits:[], insts:[], goals:[], events:[], income:50000, salaryDay:20, baseBalance:100000, cycleMode:'salary'};
  assert(validateDataObject(valid).valid, 'Валидный объект');

  var invalid = {spends:'not array', income:'abc', salaryDay:30};
  var r = validateDataObject(invalid);
  assert(!r.valid, 'Невалидный объект');
  assert(r.errors.length >= 2, 'Несколько ошибок');
});

suite('validateBackupImport', function(){
  var good = {spends:[{d:'2026-08-01',s:100,n:'Тест',cat:'grocery'}], incomes:[{s:50000}]};
  assert(validateBackupImport(good).valid, 'Валидный бэкап');

  var bad1 = {incomes:[]};
  assert(!validateBackupImport(bad1).valid, 'Нет spends');

  var bad2 = {spends:[]};
  assert(!validateBackupImport(bad2).valid, 'Нет incomes');

  assert(!validateBackupImport(null).valid, 'null');
  assert(!validateBackupImport('string').valid, 'string');
});

// ===== Итоги =====

console.log('\n' + '='.repeat(40));
console.log('Результаты: ' + passed + '/' + total + ' прошли, ' + failed + ' провалились');
if(failed > 0){
  process.exit(1);
} else {
  console.log('Все тесты пройдены!');
}
