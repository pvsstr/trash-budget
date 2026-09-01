// Модуль валидации входных данных

var VALID_CATEGORIES = ['grocery','cafe','scooters','transport','taxi','home','subs','health','fun','clothes','personal','other'];
var VALID_CYCLE_MODES = ['salary', 'calendar'];
var VALID_TAGS = ['normal','plan','impulse','need'];
var VALID_INCOME_KINDS = ['salary','freelance','cashback','transfer','other'];

// Валидация дня зарплаты (1-28)
function validateSalaryDay(val){
  var n = parseInt(val, 10);
  if(isNaN(n) || n < 1 || n > 28){ return {valid:false, error:'День зарплаты должен быть от 1 до 28'}; }
  return {valid:true, value:n};
}

// Валидация суммы
function validateAmount(val, opts){
  opts = opts || {};
  var n = parseFloat(val);
  if(isNaN(n)){ return {valid:false, error:'Сумма должна быть числом'}; }
  if(opts.allowNegative !== true && n < 0){ return {valid:false, error:'Сумма не может быть отрицательной'}; }
  if(opts.max && n > opts.max){ return {valid:false, error:'Сумма слишком большая (макс. ' + opts.max + ')'}; }
  if(opts.min != null && n < opts.min){ return {valid:false, error:'Сумма слишком маленькая (мин. ' + opts.min + ')'}; }
  return {valid:true, value:Math.round(n)};
}

// Валидация дохода
function validateIncome(val){
  return validateAmount(val, {allowNegative:false, max:100000000, min:0});
}

// Валидация баланса (может быть отрицательным)
function validateBalance(val){
  var n = parseFloat(val);
  if(isNaN(n)){ return {valid:false, error:'Баланс должен быть числом'}; }
  if(Math.abs(n) > 100000000){ return {valid:false, error:'Баланс слишком большой'}; }
  return {valid:true, value:Math.round(n)};
}

// Валидация категории
function validateCategory(catId){
  if(VALID_CATEGORIES.indexOf(catId) === -1){
    return {valid:false, error:'Неизвестная категория: ' + catId};
  }
  return {valid:true, value:catId};
}

// Валидация режима цикла
function validateCycleMode(mode){
  if(VALID_CYCLE_MODES.indexOf(mode) === -1){
    return {valid:false, error:'Режим цикла: только "salary" или "calendar"'};
  }
  return {valid:true, value:mode};
}

// Валидация тега операции
function validateTag(tag){
  if(VALID_TAGS.indexOf(tag) === -1){
    return {valid:false, error:'Неизвестный тег: ' + tag};
  }
  return {valid:true, value:tag};
}

// Валидация имени (непустое, без опасных символов)
function validateName(name, maxLen){
  maxLen = maxLen || 200;
  if(typeof name !== 'string'){ return {valid:false, error:'Имя должно быть строкой'}; }
  name = name.trim();
  if(name.length === 0){ return {valid:false, error:'Имя не может быть пустым'}; }
  if(name.length > maxLen){ return {valid:false, error:'Имя слишком длинное (макс. '+maxLen+' символов)'}; }
  return {valid:true, value:name};
}

// Валидация объекта D (весь набор данных)
function validateDataObject(D){
  var errors = [];
  if(!D || typeof D !== 'object'){ return {valid:false, errors:['Данные должны быть объектом']}; }

  // Обязательные массивы
  var arrays = ['spends','incomes','tx','envs','pays','subs','credits','insts','goals','events','learned'];
  for(var i=0;i<arrays.length;i++){
    if(D[arrays[i]] && !Array.isArray(D[arrays[i]])){
      errors.push(arrays[i] + ' должен быть массивом');
    }
  }

  // income — число >= 0
  if(typeof D.income !== 'number' && D.income != null){
    errors.push('income должно быть числом');
  }
  if(D.income < 0){ errors.push('income не может быть отрицательным'); }

  // salaryDay — 1-28 или null
  if(D.salaryDay != null){
    var sd = parseInt(D.salaryDay, 10);
    if(isNaN(sd) || sd < 1 || sd > 28){ errors.push('salaryDay должен быть от 1 до 28'); }
  }

  // baseBalance — число
  if(typeof D.baseBalance !== 'number' && D.baseBalance != null){
    errors.push('baseBalance должно быть числом');
  }

  // cycleMode
  if(D.cycleMode && VALID_CYCLE_MODES.indexOf(D.cycleMode) === -1){
    errors.push('cycleMode: только "salary" или "calendar"');
  }

  // lifeMin — положительное число
  if(typeof D.lifeMin === 'number' && D.lifeMin < 0){
    errors.push('lifeMin не может быть отрицательным');
  }

  return {valid: errors.length === 0, errors: errors};
}

// Валидация при импорте JSON-бэкапа
function validateBackupImport(data){
  if(!data || typeof data !== 'object'){
    return {valid:false, error:'Файл не является валидным JSON-объектом'};
  }
  if(!data.spends || !Array.isArray(data.spends)){
    return {valid:false, error:'Отсутствует массив spends (неверный формат файла)'};
  }
  if(!data.incomes || !Array.isArray(data.incomes)){
    return {valid:false, error:'Отсутствует массив incomes (неверный формат файла)'};
  }

  // Проверяем критичные поля
  var result = validateDataObject(data);
  if(!result.valid){
    return {valid:false, error:'Ошибки в данных: ' + result.errors.join('; ')};
  }

  return {valid:true, data:data};
}

// Очистка и нормализация данных при импорте
function sanitizeImportedData(D){
  var MAX_ITEMS = 10000;
  var arrays = ['spends','incomes','tx','pays','subs','credits','insts','goals','events','learned'];
  for(var i=0;i<arrays.length;i++){
    if(D[arrays[i]] && D[arrays[i]].length > MAX_ITEMS){
      D[arrays[i]] = D[arrays[i]].slice(0, MAX_ITEMS);
    }
  }
  var MAX_STR = 500;
  function truncateStr(s){ return typeof s === 'string' ? s.substring(0, MAX_STR) : s; }
  for(var j=0;j<(D.spends||[]).length;j++){
    var sp = D.spends[j];
    if(sp.n) sp.n = truncateStr(sp.n);
    if(sp.cat && VALID_CATEGORIES.indexOf(sp.cat) === -1) sp.cat = 'other';
    if(sp.s && typeof sp.s === 'number') sp.s = Math.abs(sp.s);
  }
  // Validate envs[].lim
  if(D.envs && Array.isArray(D.envs)){
    for(var e=0;e<D.envs.length;e++){
      if(D.envs[e] && typeof D.envs[e].lim === 'number' && (isNaN(D.envs[e].lim) || D.envs[e].lim < 0)){
        D.envs[e].lim = Math.abs(D.envs[e].lim) || 0;
      }
    }
  }
  // Validate pays[].d
  if(D.pays && Array.isArray(D.pays)){
    for(var p=0;p<D.pays.length;p++){
      if(D.pays[p] && typeof D.pays[p].d === 'number'){
        D.pays[p].d = Math.max(1, Math.min(28, Math.round(D.pays[p].d)));
      }
    }
  }
  // Validate subs[].s
  if(D.subs && Array.isArray(D.subs)){
    for(var s=0;s<D.subs.length;s++){
      if(D.subs[s] && typeof D.subs[s].s === 'number' && (isNaN(D.subs[s].s) || D.subs[s].s < 0)){
        D.subs[s].s = Math.abs(D.subs[s].s) || 0;
      }
    }
  }
  // Validate credits[].rate and credits[].pay
  if(D.credits && Array.isArray(D.credits)){
    for(var c=0;c<D.credits.length;c++){
      if(D.credits[c]){
        if(typeof D.credits[c].rate !== 'number' || isNaN(D.credits[c].rate) || D.credits[c].rate < 0) D.credits[c].rate = 0;
        if(D.credits[c].rate > 100) D.credits[c].rate = 100;
        if(typeof D.credits[c].pay !== 'number' || isNaN(D.credits[c].pay) || D.credits[c].pay < 0) D.credits[c].pay = 0;
        if(typeof D.credits[c].cur !== 'number' || isNaN(D.credits[c].cur) || D.credits[c].cur < 0) D.credits[c].cur = 0;
        if(typeof D.credits[c].d !== 'number' || D.credits[c].d < 1 || D.credits[c].d > 28) D.credits[c].d = 1;
      }
    }
  }
  return D;
}

export {
  VALID_CATEGORIES, VALID_CYCLE_MODES, VALID_TAGS, VALID_INCOME_KINDS,
  validateSalaryDay, validateAmount, validateIncome, validateBalance,
  validateCategory, validateCycleMode, validateTag, validateName,
  validateDataObject, validateBackupImport, sanitizeImportedData
};
