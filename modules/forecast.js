// Модуль прогноза: forecastCashFlow, cashRunway, minBalance, canAfford, debtSnowball

import { parseD, iso } from './utils.js';
import { salaryDate, cycleStart, cycleEnd } from './cycle.js';
import { allSpends, realBal, calcSafeBalance, calcDailyLimit, nextPay, calcMonthlyFixedPay } from './budget.js';

// Прогноз cash flow на N дней вперёд
function forecastCashFlow(D, daysAhead, fromDate){
  daysAhead = daysAhead || 90;
  fromDate = fromDate || new Date();
  fromDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());

  // 1. Дневной темп гибких трат
  var lookback = 30;
  var fromLook = new Date(fromDate.getTime() - lookback*864e5);
  var allSp = allSpends(D);
  var flexSum = 0, flexDays = 0;
  var fixedCats = ['home', 'subs'];
  var fixedKeywords = ['аренд','жкх','коммунал','подписк','telegram','yandex plus','netflix','ivi','spotify'];

  for(var i=0;i<allSp.length;i++){
    if(allSp[i].d < fromLook || allSp[i].d >= fromDate){ continue; }
    if(fixedCats.indexOf(allSp[i].cat||'other') !== -1){ continue; }
    var nm = (allSp[i].n||'').toLowerCase();
    var isFixed = false;
    for(var f=0;f<fixedKeywords.length;f++){ if(nm.indexOf(fixedKeywords[f])!==-1){ isFixed = true; break; } }
    if(!isFixed){ flexSum += allSp[i].s; }
  }
  flexDays = Math.max(1, Math.round((fromDate - fromLook)/864e5));
  var flexPerDay = flexDays > 0 ? flexSum / flexDays : 0;

  // 2. Поведенческие коэффициенты
  function getBehaviorCoeff(dayFromStart) {
    var currentDate = new Date(fromDate.getTime() + dayFromStart * 864e5);
    var daysSinceSalary = Math.round((currentDate - cycleStart(currentDate, D.cycleMode, D.salaryDay)) / 864e5);
    var cycleLen = Math.round((cycleEnd(cycleStart(currentDate, D.cycleMode, D.salaryDay), D.cycleMode, D.salaryDay) - cycleStart(currentDate, D.cycleMode, D.salaryDay)) / 864e5);
    var phase = cycleLen > 0 ? daysSinceSalary / cycleLen : 0.5;
    if (phase < 0.15) return 1.3;
    if (phase < 0.45) return 1.0;
    if (phase < 0.75) return 0.85;
    return 0.7;
  }

  // 3. Собираем будущие события
  var events = [];
  var i;

  // Подписки
  for(i=0;i<D.subs.length;i++){
    if(D.subs[i].off){ continue; }
    for(var md=1; md<=daysAhead+30; md+=30){
      var subDay = new Date(fromDate.getTime() + md*864e5);
      subDay = new Date(subDay.getFullYear(), subDay.getMonth(), 1);
      if(subDay >= fromDate){ events.push({date:subDay, amt:-D.subs[i].s, n:'\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0430: '+D.subs[i].n}); }
    }
  }

  // Платежи
  for(i=0;i<D.pays.length;i++){
    for(var pmo=0; pmo<=Math.ceil(daysAhead/30)+1; pmo++){
      var pDate = new Date(fromDate.getFullYear(), fromDate.getMonth()+pmo, D.pays[i].d);
      if(pDate >= fromDate && (pDate - fromDate)/864e5 <= daysAhead){
        events.push({date:pDate, amt:-D.pays[i].s, n:'\u041f\u043b\u0430\u0442\u0451\u0436: '+D.pays[i].n});
      }
    }
  }

  // Рассрочки
  for(i=0;i<D.insts.length;i++){
    var id = parseD(D.insts[i].d);
    if(id >= fromDate){ events.push({date:id, amt:-D.insts[i].s, n:'\u0420\u0430\u0441\u0441\u0440\u043e\u0447\u043a\u0430: '+D.insts[i].n}); }
  }

  // Кредиты
  for(i=0;i<(D.credits||[]).length;i++){
    var crF = D.credits[i];
    if(!(crF.pay > 0)){ continue; }
    for(var cmo=0; cmo<=Math.ceil(daysAhead/30)+1; cmo++){
      var cDate = new Date(fromDate.getFullYear(), fromDate.getMonth()+cmo, crF.d || 1);
      if(cDate >= fromDate && (cDate - fromDate)/864e5 <= daysAhead){
        events.push({date:cDate, amt:-crF.pay, n:'\u041a\u0440\u0435\u0434\u0438\u0442: '+crF.n});
      }
    }
  }

  // Зарплата
  for(var mo=0; mo<=Math.ceil(daysAhead/30)+1; mo++){
    var sd = salaryDate(fromDate.getFullYear(), fromDate.getMonth()+mo, D.salaryDay);
    if(sd >= fromDate){ events.push({date:sd, amt: D.income || 0, n:'\u0417\u0430\u0440\u043f\u043b\u0430\u0442\u0430'}); }
  }

  events.sort(function(a,b){ return a.date - b.date; });

  // 4. Прогноз день за днём
  var flow = [];
  var curBal = realBal(D);
  var curDate = new Date(fromDate);

  for(var day=0; day<=daysAhead; day++){
    for(var ei=0; ei<events.length; ei++){
      if(iso(events[ei].date) === iso(curDate)){
        curBal += events[ei].amt;
      }
    }
    if(day > 0){
      var coeff = getBehaviorCoeff(day);
      var dailySpend = flexPerDay * coeff;
      curBal -= dailySpend;
    }
    flow.push({
      date: new Date(curDate),
      balance: Math.round(curBal),
      events: events.filter(function(e){ return iso(e.date) === iso(curDate); })
    });
    curDate = new Date(curDate.getTime() + 864e5);
  }

  return {flow:flow, flexPerDay:Math.round(flexPerDay), events:events};
}

// Сколько дней хватит денег до нуля
function cashRunway(D){
  var f = forecastCashFlow(D, 90);
  for(var i=0;i<f.flow.length;i++){
    if(f.flow[i].balance < 0){ return i; }
  }
  return 90;
}

// Минимальный баланс за N дней
function minBalance(D, days){
  var f = forecastCashFlow(D, days);
  var min = Infinity, minDate = null;
  for(var i=0;i<f.flow.length;i++){
    if(f.flow[i].balance < min){ min = f.flow[i].balance; minDate = f.flow[i].date; }
  }
  return {val:min, date:minDate, daysFromNow: Math.round((minDate - new Date())/864e5)};
}

// Могу ли купить X?
function canAfford(D, amount){
  var daily = calcDailyLimit(D);
  var safe = calcSafeBalance(D);
  var pay3 = nextPay(D, 3);
  var minAfter = minBalance(D, 30);
  var postMin = minAfter.val - amount;

  if(amount <= daily.perDay && postMin >= 0){
    return {verdict:'yes', txt:'\u041c\u043e\u0436\u043d\u043e: \u0432\u043f\u0438\u0441\u044b\u0432\u0430\u0435\u0442\u0441\u044f \u0432 \u0434\u043d\u0435\u0432\u043d\u043e\u0439 \u043b\u0438\u043c\u0438\u0442.', color:'var(--grn)'};
  } else if(postMin >= -5000){
    return {verdict:'warn', txt:'\u041c\u043e\u0436\u043d\u043e, \u043d\u043e \u043e\u0441\u0442\u043e\u0440\u043e\u0436\u043d\u043e.', color:'var(--org)'};
  } else {
    return {verdict:'no', txt:'\u041d\u0435 \u0441\u043e\u0432\u0435\u0442\u0443\u044e: \u043c\u0438\u043d\u0438\u043c\u0443\u043c \u0443\u0439\u0434\u0451\u0442 \u0432 \u043c\u0438\u043d\u0443\u0441.', color:'var(--red)'};
  }
}

// План выхода из долгов
function debtSnowball(D){
  var debts = [];
  for(var i=0;i<D.credits.length;i++){
    if(D.credits[i].cur > 0){ debts.push({n:D.credits[i].n, cur:D.credits[i].cur, total:D.credits[i].total}); }
  }
  if(!debts.length){ return null; }

  var totalDebt = 0;
  for(var j=0;j<debts.length;j++){ totalDebt += debts[j].cur; }

  var lifeMin = typeof D.lifeMin === 'number' ? D.lifeMin : 50000;
  var monthlyExtra = Math.max(0, (D.income||0) - calcMonthlyFixedPay(D) - lifeMin);

  if(monthlyExtra <= 0){
    return {txt:'\u041e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u043f\u043b\u0430\u0442\u0451\u0436\u0438 \u0441\u044a\u0435\u0434\u0430\u044e\u0442 \u0432\u0435\u0441\u044c \u0434\u043e\u0445\u043e\u0434.', debts:debts};
  }

  debts.sort(function(a,b){ return a.cur - b.cur; });
  var months = Math.ceil(totalDebt / monthlyExtra);

  return {
    txt: '\u041f\u0440\u0438 \u043f\u043b\u0430\u0442\u0435\u0436\u0435 '+monthlyExtra+'/\u043c\u0435\u0441 \u0437\u0430\u043a\u0440\u043e\u0435\u0448\u044c \u0432\u0441\u0435 \u0434\u043e\u043b\u0433\u0438 \u0437\u0430 '+months+' \u043c\u0435\u0441.',
    first: debts[0],
    total: totalDebt,
    months: months,
    monthlyExtra: monthlyExtra
  };
}

export { forecastCashFlow, cashRunway, minBalance, canAfford, debtSnowball };
