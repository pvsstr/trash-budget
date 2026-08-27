// Модуль зарплатных циклов: salaryDate, cycleStart, cycleEnd, shiftCycle и др.

var MONTHS = ['\u042f\u043d\u0432\u0430\u0440\u044c','\u0424\u0435\u0432\u0440\u0430\u043b\u044c','\u041c\u0430\u0440\u0442','\u0410\u043f\u0440\u0435\u043b\u044c','\u041c\u0430\u0439','\u0418\u044e\u043d\u044c','\u0418\u044e\u043b\u044c','\u0410\u0432\u0433\u0443\u0441\u0442','\u0421\u0435\u043d\u0442\u044f\u0431\u0440\u044c','\u041e\u043a\u0442\u044f\u0431\u0440\u044c','\u041d\u043e\u044f\u0431\u0440\u044c','\u0414\u0435\u043a\u0430\u0431\u0440\u044c'];
var MONTHS_S = ['\u044f\u043d\u0432','\u0444\u0435\u0432','\u043c\u0430\u0440','\u0430\u043f\u0440','\u043c\u0430\u0439','\u0438\u044e\u043d','\u0438\u044e\u043b','\u0430\u0432\u0433','\u0441\u0435\u043d','\u043e\u043a\u0442','\u043d\u043e\u044f','\u0434\u0435\u043a'];
var WEEKDAYS = ['\u0432\u043e\u0441\u043a\u0440\u0435\u0441\u0435\u043d\u044c\u0435','\u043f\u043e\u043d\u0435\u0434\u0435\u043b\u044c\u043d\u0438\u043a','\u0432\u0442\u043e\u0440\u043d\u0438\u043a','\u0441\u0440\u0435\u0434\u0430','\u0447\u0435\u0442\u0432\u0435\u0440\u0433','\u043f\u044f\u0442\u043d\u0438\u0446\u0430','\u0441\u0443\u0431\u0431\u043e\u0442\u0430'];

// Фактическая дата зарплаты с учётом выходных
// salaryDay — день месяца (1-28), если null/0 → 20-е
function salaryDate(y, m, salaryDay){
  var day = salaryDay || 20;
  var wd = new Date(y, m, day).getDay();
  if(wd === 6){ return new Date(y, m, day - 1); }
  if(wd === 0){ return new Date(y, m, day + 1); }
  return new Date(y, m, day);
}

// Последняя дата зарплаты до указанной даты
function getLastSalaryDate(dt, salaryDay){
  dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  for (var i = 0; i < 12; i++) {
    var curDate = new Date(dt.getFullYear(), dt.getMonth() - i, 1);
    var sd = salaryDate(curDate.getFullYear(), curDate.getMonth(), salaryDay);
    if (sd <= dt) { return sd; }
  }
  return new Date(dt.getFullYear(), dt.getMonth(), 1);
}

// Следующая дата зарплаты после указанной даты
function getNextSalaryDate(dt, salaryDay){
  dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  for (var i = 0; i < 12; i++) {
    var curDate = new Date(dt.getFullYear(), dt.getMonth() + i, 1);
    var sd = salaryDate(curDate.getFullYear(), curDate.getMonth(), salaryDay);
    if (sd > dt) { return sd; }
  }
  return new Date(dt.getFullYear(), dt.getMonth() + 1, 1);
}

// Начало зарплатного цикла
// cycleMode: 'salary' (по умолчанию) или 'calendar'
function cycleStart(dt, cycleMode, salaryDay){
  if (cycleMode === 'calendar') {
    return new Date(dt.getFullYear(), dt.getMonth(), 1);
  }
  return getLastSalaryDate(dt, salaryDay);
}

// Конец зарплатного цикла
function cycleEnd(cs, cycleMode, salaryDay){
  if (cycleMode === 'calendar') {
    return new Date(cs.getFullYear(), cs.getMonth() + 1, 1);
  }
  return getNextSalaryDate(cs, salaryDay);
}

// Метка зарплатного цикла
function cycleLabel(cs, cycleMode, salaryDay){
  if (cycleMode === 'calendar') {
    return MONTHS[cs.getMonth()] + ' ' + cs.getFullYear();
  }
  var ce = cycleEnd(cs, cycleMode, salaryDay);
  var ce2 = new Date(ce.getTime() - 864e5);
  var startStr = cs.getDate() + '.' + String(cs.getMonth()+1).padStart(2,'0');
  var endStr = ce2.getDate() + '.' + String(ce2.getMonth()+1).padStart(2,'0');
  return startStr + ' \u2013 ' + endStr;
}

// Дата зарплаты в читаемом виде
function payDateStr(d){
  return d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear()+' ('+WEEKDAYS[d.getDay()]+')';
}

// Короткая метка цикла
function cycLabel(cs, cycleMode, salaryDay){
  var ce = new Date(cycleEnd(cs, cycleMode, salaryDay).getTime() - 864e5);
  return cs.getDate()+'.'+String(cs.getMonth()+1).padStart(2,'0')+' \u2013 '+ce.getDate()+'.'+String(ce.getMonth()+1).padStart(2,'0')+'.'+ce.getFullYear();
}

// Сдвиг цикла на N периодов
function shiftCycle(cs, n, cycleMode, salaryDay){
  if(cycleMode === 'calendar'){ return addM(cs, n); }
  var r = new Date(cs.getFullYear(), cs.getMonth(), cs.getDate());
  for(var i = 0; i < Math.abs(n); i++){
    if(n > 0){ r = getNextSalaryDate(r, salaryDay); }
    else { r = getLastSalaryDate(new Date(r.getTime() - 864e5), salaryDay); }
  }
  return r;
}

// Проверка: попадает ли дата в цикл
function inCycle(dt, cs, cycleMode, salaryDay){
  var ce = cycleEnd(cs, cycleMode, salaryDay);
  return dt >= cs && dt < ce;
}

export {
  MONTHS, MONTHS_S, WEEKDAYS,
  salaryDate, getLastSalaryDate, getNextSalaryDate,
  cycleStart, cycleEnd, cycleLabel, cycLabel,
  payDateStr, shiftCycle, inCycle
};
