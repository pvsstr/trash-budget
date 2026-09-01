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

  // 2. Поведенческие коэффициенты (адаптивные + сезонные)
  function getBehaviorCoeff(dayFromStart) {
    var currentDate = new Date(fromDate.getTime() + dayFromStart * 864e5);
    var daysSinceSalary = Math.round((currentDate - cycleStart(currentDate, D.cycleMode, D.salaryDay)) / 864e5);
    var cycleLen = Math.round((cycleEnd(cycleStart(currentDate, D.cycleMode, D.salaryDay), D.cycleMode, D.salaryDay) - cycleStart(currentDate, D.cycleMode, D.salaryDay)) / 864e5);
    var phase = cycleLen > 0 ? daysSinceSalary / cycleLen : 0.5;
    var coeff;
    if (phase < 0.15) coeff = 1.3;
    else if (phase < 0.45) coeff = 1.0;
    else if (phase < 0.75) coeff = 0.85;
    else coeff = 0.7;
    // Adaptive: calibrate with real user data if available
    if(flexDays >= 14 && flexPerDay > 0){
      var actualAvg = flexSum / flexDays;
      var defaultAvg = (D.income || 0) / 30;
      if(defaultAvg > 0){
        var ratio = actualAvg / defaultAvg;
        if(ratio > 0) coeff *= Math.max(0.5, Math.min(2.0, ratio));
      }
    }
    // Seasonal adjustments
    var month = currentDate.getMonth();
    if(month === 11) coeff *= 1.25; // December — New Year
    if(month === 1) coeff *= 1.10;  // February — Valentine's, post-NY
    if(month === 2) coeff *= 1.08;  // March — 8th March
    if(month === 7) coeff *= 1.12;  // August — summer vacations
    if(month === 8) coeff *= 1.06;  // September — back to school
    return coeff;
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

// План выхода из долгов (с учётом процентных ставок)
function debtSnowball(D, strategy){
  strategy = strategy || D.debtStrategy || 'snowball';
  var debts = [];
  for(var i=0;i<D.credits.length;i++){
    if(D.credits[i].cur > 0){
      debts.push({
        n:D.credits[i].n,
        cur:D.credits[i].cur,
        total:D.credits[i].total,
        rate: D.credits[i].rate || 0,
        pay: D.credits[i].pay || 0
      });
    }
  }
  if(!debts.length){ return null; }

  var totalDebt = 0;
  for(var j=0;j<debts.length;j++){ totalDebt += debts[j].cur; }

  var lifeMin = typeof D.lifeMin === 'number' ? D.lifeMin : 50000;
  var monthlyExtra = Math.max(0, (D.income||0) - calcMonthlyFixedPay(D) - lifeMin);

  if(monthlyExtra <= 0){
    return {txt:'\u041e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u043f\u043b\u0430\u0442\u0451\u0436\u0438 \u0441\u044a\u0435\u0434\u0430\u044e\u0442 \u0432\u0435\u0441\u044c \u0434\u043e\u0445\u043e\u0434.', debts:debts, strategy:strategy};
  }

  // Simulate month-by-month with interest
  function simulate(debtsCopy, order){
    var sim = debtsCopy.map(function(d){ return {n:d.n, cur:d.cur, rate:d.rate, pay:d.pay}; });
    sim.sort(order);
    var months = 0;
    var totalPaid = 0;
    var maxMonths = 120;
    while(sim.length > 0 && months < maxMonths){
      months++;
      // Apply interest to all debts
      for(var k=0;k<sim.length;k++){
        var monthlyRate = (sim[k].rate || 0) / 100 / 12;
        sim[k].cur += sim[k].cur * monthlyRate;
      }
      // Pay minimums first
      var fixedLeft = monthlyExtra;
      for(var p=0;p<sim.length;p++){
        var minPay = Math.min(sim[p].pay || 0, sim[p].cur);
        sim[p].cur -= minPay;
        fixedLeft -= minPay;
        totalPaid += minPay;
      }
      // Extra payment goes to first debt (smallest or highest rate)
      if(fixedLeft > 0 && sim.length > 0){
        var extraPay = Math.min(fixedLeft, sim[0].cur);
        sim[0].cur -= extraPay;
        totalPaid += extraPay;
      }
      // Remove paid off debts
      sim = sim.filter(function(d){ return d.cur > 0.01; });
    }
    return {months: months, totalPaid: totalPaid, totalInterest: totalPaid - totalDebt};
  }

  var snowballResult = simulate(debts, function(a,b){ return a.cur - b.cur; });
  var avalancheResult = simulate(debts, function(a,b){ return (b.rate||0) - (a.rate||0); });

  var hasRates = debts.some(function(d){ return (d.rate || 0) > 0; });
  var result = strategy === 'avalanche' ? avalancheResult : snowballResult;
  var savings = hasRates ? Math.abs(avalancheResult.totalInterest - snowballResult.totalInterest) : 0;

  var txt = '\u041f\u0440\u0438 \u043f\u043b\u0430\u0442\u0435\u0436\u0435 '+monthlyExtra+'/\u043c\u0435\u0441 \u0437\u0430\u043a\u0440\u043e\u0435\u0448\u044c \u0432\u0441\u0435 \u0434\u043e\u043b\u0433\u0438 \u0437\u0430 '+result.months+' \u043c\u0435\u0441.';
  if(hasRates){
    txt += ' \u041f\u0435\u0440\u0435\u043f\u043b\u0430\u0442\u0430 \u043f\u043e \u043f\u0440\u043e\u0446\u0435\u043d\u0442\u0430\u043c: \u044d\u043a\u043e\u043d\u043e\u043c\u0438\u044f \u0430\u0432\u0430\u043b\u0438\u043d\u0445\u0430: '+fmt(savings)+'.';
  }

  return {
    txt: txt,
    first: debts.slice().sort(strategy === 'avalanche' ? function(a,b){ return (b.rate||0)-(a.rate||0); } : function(a,b){ return a.cur-b.cur; })[0],
    total: totalDebt,
    months: result.months,
    monthlyExtra: monthlyExtra,
    strategy: strategy,
    snowball: snowballResult,
    avalanche: avalancheResult,
    savings: savings,
    hasRates: hasRates
  };
}

// P3-17: Simple spending prediction model (moving average + trend)
function predictSpending(D, category, monthsAhead){
  monthsAhead = monthsAhead || 3;
  var allSp = allSpends(D);
  var now = new Date();
  var monthlyTotals = [];
  // Collect last 6 months of data
  for(var m = 0; m < 6; m++){
    var cs = new Date(now.getFullYear(), now.getMonth() - m, 1);
    var ce = new Date(cs.getFullYear(), cs.getMonth() + 1, 1);
    var monthTotal = 0;
    for(var i = 0; i < allSp.length; i++){
      if(allSp[i].d >= cs && allSp[i].d < ce){
        if(!category || allSp[i].cat === category) monthTotal += allSp[i].s;
      }
    }
    monthlyTotals.unshift(monthTotal);
  }
  if(monthlyTotals.length < 3) return {forecast: [], confidence: 0};
  // Simple weighted moving average (recent months weighted more)
  var weights = [1, 2, 3, 4, 5, 6];
  var totalWeight = 0;
  var weightedSum = 0;
  for(var w = 0; w < monthlyTotals.length; w++){
    weightedSum += monthlyTotals[w] * weights[w];
    totalWeight += weights[w];
  }
  var wma = totalWeight > 0 ? weightedSum / totalWeight : 0;
  // Trend: simple linear regression
  var n = monthlyTotals.length;
  var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for(var t = 0; t < n; t++){
    sumX += t;
    sumY += monthlyTotals[t];
    sumXY += t * monthlyTotals[t];
    sumX2 += t * t;
  }
  var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
  var intercept = (sumY - slope * sumX) / n;
  var forecast = [];
  for(var f = 1; f <= monthsAhead; f++){
    var predicted = Math.max(0, Math.round(intercept + slope * (n + f - 1)));
    var actualIdx = n - 1 + f;
    var confidence = Math.max(0.3, 1 - (f * 0.15));
    forecast.push({month: f, predicted: predicted, confidence: Math.round(confidence * 100)});
  }
  return {forecast: forecast, trend: Math.round(slope), wma: Math.round(wma), history: monthlyTotals};
}

// P3-18: Credit score simulator
function creditScoreSim(D, scenario){
  var score = 50;
  var factors = [];
  // Payment history (35%)
  var onTime = 0, total = 0;
  for(var i = 0; i < (D.credits||[]).length; i++){
    if(D.credits[i].pay > 0){
      total++;
      if(!D.paid || !D.paid['missed_' + i]) onTime++;
    }
  }
  var paymentScore = total > 0 ? (onTime / total) * 35 : 35;
  score += paymentScore - 17.5;
  factors.push({name: '\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439', score: Math.round(paymentScore)});
  // Credit utilization (30%)
  var totalLimit = 0, totalUsed = 0;
  for(var j = 0; j < (D.credits||[]).length; j++){
    totalLimit += D.credits[j].total || 0;
    totalUsed += D.credits[j].cur || 0;
  }
  var utilization = totalLimit > 0 ? totalUsed / totalLimit : 0;
  var utilScore = Math.max(0, 30 - utilization * 60);
  score += utilScore - 15;
  factors.push({name: '\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435 \u043B\u0438\u043C\u0438\u0442\u043E\u0432', score: Math.round(utilScore)});
  // Apply scenario modifications
  if(scenario){
    if(scenario.payOff) score += 10;
    if(scenario.reduceUtil) score += Math.round(scenario.reduceUtil * 20);
  }
  score = Math.max(300, Math.min(850, Math.round(score * 8.5)));
  var grade = '';
  if(score >= 800) grade = '\u041E\u0442\u043B\u0438\u0447\u043D\u044B\u0439';
  else if(score >= 740) grade = '\u0425\u043E\u0440\u043E\u0448\u0438\u0439';
  else if(score >= 670) grade = '\u0425\u043E\u0440\u043E\u0448\u0438\u0439';
  else if(score >= 580) grade = '\u0421\u0440\u0435\u0434\u043D\u0438\u0439';
  else grade = '\u041D\u0438\u0437\u043A\u0438\u0439';
  return {score: score, grade: grade, factors: factors};
}

// P3-19: Tax calculator (NDFL, IIS, deductions)
function calcTax(income, opts){
  opts = opts || {};
  var ndfl = 0;
  var iisDeduction = 0;
  var propertyDeduction = 0;
  var ndflRate = opts.ndflRate || 13;
  // NDFL
  ndfl = Math.round(income * ndflRate / 100);
  // IIS deduction (Type B: tax refund up to 52000/year)
  if(opts.iis){
    iisDeduction = Math.min(52000, Math.round(income * ndflRate / 100));
  }
  // Property deduction (up to 260000 for purchase, 390000 for mortgage interest)
  if(opts.propertyDeduction){
    propertyDeduction = Math.min(260000, opts.propertyDeduction);
  }
  // Social deductions (education, treatment, etc.)
  var socialDeduction = Math.min(120000, opts.socialDeduction || 0);
  // Total deductions
  var totalDeduction = iisDeduction + propertyDeduction + socialDeduction;
  var taxableIncome = Math.max(0, income - totalDeduction);
  var finalTax = Math.round(taxableIncome * ndflRate / 100);
  var savings = ndfl - finalTax;
  return {
    income: income,
    ndfl: ndfl,
    ndflRate: ndflRate,
    iisDeduction: iisDeduction,
    propertyDeduction: propertyDeduction,
    socialDeduction: socialDeduction,
    totalDeduction: totalDeduction,
    taxableIncome: taxableIncome,
    finalTax: finalTax,
    savings: savings
  };
}

// P3-20: Open banking data import parser (OFX-like format)
function parseOpenBankingData(txt){
  var lines = txt.split('\n');
  var transactions = [];
  for(var i = 0; i < lines.length; i++){
    var line = lines[i].trim();
    if(line.indexOf('TRN') === 0 || line.indexOf('STMTTRN') >= 0){
      var tx = {};
      // Parse fields
      for(var j = i; j < Math.min(i + 10, lines.length); j++){
        var l = lines[j].trim();
        if(l.indexOf('DTPOSTED') === 0) tx.d = l.substring(9, 17);
        if(l.indexOf('TRNAMT') === 0) tx.s = parseFloat(l.substring(7)) || 0;
        if(l.indexOf('NAME') === 0) tx.n = l.substring(5);
        if(l.indexOf('MEMO') === 0) tx.memo = l.substring(5);
      }
      if(tx.d && tx.s) transactions.push(tx);
    }
  }
  return transactions;
}

// P3-21: Multi-user support framework (family budget)
function mergeUserData(mainD, partnerD){
  var merged = JSON.parse(JSON.stringify(mainD));
  // Merge spends
  if(partnerD.spends) merged.spends = (merged.spends || []).concat(partnerD.spends.map(function(s){ s._owner = 'partner'; return s; }));
  if(partnerD.incomes) merged.incomes = (merged.incomes || []).concat(partnerD.incomes.map(function(i){ i._owner = 'partner'; return i; }));
  // Keep main user's goals, pays, envs
  return merged;
}

export { forecastCashFlow, cashRunway, minBalance, canAfford, debtSnowball, predictSpending, creditScoreSim, calcTax, parseOpenBankingData, mergeUserData };
