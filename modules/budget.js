// Модуль бюджетных расчётов: calcSafeBalance, calcDailyLimit, calcHealthScore, calcLifeMin

import { parseD } from './utils.js';
import { salaryDate, cycleStart, cycleEnd, shiftCycle } from './cycle.js';
import { TX2CAT } from './categories.js';

// Объединённый список всех трат (ручные + из выписки банка)
function allSpends(D){
  var arr = []; var i;
  for(i=0;i<(D.spends||[]).length;i++){
    var sp = D.spends[i];
    var spAmt = typeof sp.s === 'number' ? sp.s : (parseFloat(sp.s) || 0);
    if(!(spAmt > 0) || isNaN(spAmt)) continue;
    arr.push({d:parseD(sp.d), s:spAmt, n:sp.n, cat:sp.cat, id:sp.id, manual:1, src:'sp', sid:sp.id, tag:sp.tag||'normal'});
  }
  for(i=0;i<(D.tx||[]).length;i++){
    var t = D.tx[i];
    var txAmt = typeof t.s === 'number' ? t.s : (parseFloat(t.s) || 0);
    if(isNaN(txAmt)) continue;
    if(txAmt < 0 || t.refund){ arr.push({d:parseD(t.d), s:Math.abs(txAmt), n:t.n, cat:TX2CAT[t.c]||t.c||'other', src:'tx', sid:i}); }
  }
  return arr;
}

// Суммы доходов и расходов
function sums(D){
  var si=0, ss=0, i;
  for(i=0;i<(D.incomes||[]).length;i++){ si += D.incomes[i].s; }
  var all = allSpends(D);
  for(i=0;i<all.length;i++){ ss += all[i].s; }
  return {inc:si, spend:ss};
}

// Реальный баланс
function realBal(D){
  var t = sums(D);
  return (D.baseBalance||0) + t.inc - t.spend;
}

// Ближайшие платежи в ближайшие N дней
function nextPay(D, days){
  var now = new Date(); var sum = 0; var i;
  for(i=0;i<D.pays.length;i++){
    var diff = (D.pays[i].d - now.getDate() + 31) % 31;
    if(diff <= days && diff > 0){ sum += D.pays[i].s; }
  }
  for(i=0;i<D.insts.length;i++){
    var dd = parseD(D.insts[i].d);
    var d2 = Math.round((dd - now) / 864e5);
    if(d2 >= 0 && d2 <= days){ sum += D.insts[i].s; }
  }
  var paid = D.paid || {};
  for(i=0;i<(D.credits||[]).length;i++){
    var crN = D.credits[i];
    if(!(crN.pay > 0)){ continue; }
    var cd = crN.d || 1;
    var diffC = (cd - now.getDate() + 31) % 31;
    var payKey = 'cr_' + i + '_' + now.getFullYear() + '-' + (now.getMonth()+1);
    if(diffC <= days && diffC > 0 && !paid[payKey]){ sum += crN.pay; }
  }
  return sum;
}

// Сумма ежемесячных обязательных платежей
function calcMonthlyFixedPay(D){
  var paysSum = 0;
  for (var i = 0; i < D.pays.length; i++) { paysSum += D.pays[i].s; }
  for (var j = 0; j < D.subs.length; j++) { if (!D.subs[j].off) paysSum += D.subs[j].s; }
  for (var k = 0; k < (D.credits||[]).length; k++) {
    if ((D.credits[k].pay||0) > 0) { paysSum += D.credits[k].pay; }
  }
  return paysSum;
}

// Безопасный баланс: реальный минус платежи на 30 дней
function calcSafeBalance(D){
  var real = realBal(D);
  var upcomingPay = nextPay(D, 30);
  return Math.max(0, real - upcomingPay);
}

// Дневной лимит: безопасный баланс / дней до зарплаты
function calcDailyLimit(D){
  var safe = calcSafeBalance(D);
  var now = new Date();
  var cur = salaryDate(now.getFullYear(), now.getMonth(), D.salaryDay);
  var next = now < cur ? cur : cycleEnd(cur, D.cycleMode, D.salaryDay);
  var daysLeft = Math.max(1, Math.round((next - now) / 864e5));
  return { perDay: Math.round(safe / daysLeft), daysLeft: daysLeft };
}

// Индекс прочности бюджета (10-100)
function calcHealthScore(D){
  var score = 50;
  var safe = calcSafeBalance(D);
  var cushGoal = null;
  for(var ig=0;ig<(D.goals||[]).length;ig++){
    if(/подушк/i.test(D.goals[ig].n) && !D.goals[ig].done){ cushGoal = D.goals[ig]; break; }
  }
  var cushion = cushGoal ? (cushGoal.cur||0) : 0;
  var cushionTarget = cushGoal ? cushGoal.target : 100000;
  score += Math.min(30, Math.round((cushion / cushionTarget) * 30));
  if (safe > 0) score += 20;
  // activeLeaks подсчитывается отдельно; здесь заглушка
  return Math.max(10, Math.min(100, score));
}

// Минимум на жизнь: базовые траты за 3 цикла + 10%
function calcLifeMin(D) {
  if (!D) return 50000;
  if(D.lifeMinManual && typeof D.lifeMin === 'number' && D.lifeMin > 0){ return D.lifeMin; }
  var now = new Date();
  var base = 0, cycles = 0;
  var spends = allSpends(D);
  for(var c=1;c<=3;c++){
    var cs = shiftCycle(cycleStart(now, D.cycleMode, D.salaryDay), -c, D.cycleMode, D.salaryDay);
    var ce = cycleEnd(cs, D.cycleMode, D.salaryDay);
    var list = spends.filter(function(x){ return x.d >= cs && x.d < ce; });
    var s = 0;
    for(var i=0;i<list.length;i++){
      var ct = list[i].cat || 'other';
      if(ct==='grocery'||ct==='transport'||ct==='health'){ s += list[i].s; }
    }
    if(s > 0){ base += s; cycles++; }
  }
  var baseAvg = cycles ? base / cycles : Math.round((D.income||0)*0.2);
  var v = Math.round(baseAvg * 1.1);
  if(v < 15000){ v = 15000; }
  if(D.income && v > D.income * 0.45){ v = Math.round(D.income * 0.45); }
  D.lifeMin = v;
  return D.lifeMin;
}

// Автозаполнение зарплаты
function ensureSalary(D, cycleStartFn, isoFn, saveFn){
  if(!D.income){ return; }
  if(!D.incomes){ D.incomes = []; }
  var cs = cycleStartFn(new Date());
  var ck = cs.getFullYear()+'-'+cs.getMonth();
  if(D.removedAuto && D.removedAuto.indexOf(ck) !== -1){ return; }
  var has = false;
  for(var i=0;i<D.incomes.length;i++){ if(D.incomes[i].auto && D.incomes[i].ck === ck){ has = true; } }
  if(!has){
    D.incomes.push({id:Date.now(), d:isoFn(cs), n:'\u0417\u0430\u0440\u0430\u0431\u043e\u0442\u043d\u0430\u044f \u043f\u043b\u0430\u0442\u0430', s:D.income, auto:1, ck:ck});
    if(saveFn) saveFn();
  }
}

export {
  allSpends, sums, realBal, nextPay, calcMonthlyFixedPay,
  calcSafeBalance, calcDailyLimit, calcHealthScore, calcLifeMin, ensureSalary
};
