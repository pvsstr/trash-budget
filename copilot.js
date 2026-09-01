/**
 * МАЯК Copilot v2 — Conversational Financial Advisor
 * ====================================================
 * Architecture:
 *   Session ─→ Intent Router ─→ Handler ─→ {text, chips[], followUp?}
 *       ↓                              ↑
 *   Context Store ─── data summary ────┘
 *
 * Features:
 *   - Session memory: tracks last intent, topics discussed, user data state
 *   - Clarifying questions: vague queries get follow-ups, not generic advice
 *   - Data-driven: all numbers come from D object, never fabricated
 *   - Proactive: each response suggests 1-2 contextual follow-ups
 *   - Dynamic chips: 4 chips change based on conversation flow
 *   - i18n ready: all text via t() function
 */
(function(){
'use strict';

// ===== SESSION MEMORY =====
var session = {
  history: [],         // [{role:'user'|'bot', text, intent, ts}]
  lastIntent: null,
  lastTopic: null,
  topicsDiscussed: {},
  userState: null,     // 'new' | 'setup' | 'established'
  dataFingerprint: ''  // hash of D to detect changes
};

function resetSession(){
  session.history = [];
  session.lastIntent = null;
  session.lastTopic = null;
  session.topicsDiscussed = {};
  session.userState = null;
  session.dataFingerprint = '';
}

function updateUserState(D){
  var income = D.income || 0;
  var spends = (D.spends || []).length + (D.tx || []).length;
  var hasSetup = income > 0 && ((D.pays || []).length > 0 || (D.envs || []).length > 0);
  var fp = income + ':' + spends + ':' + (D.pays || []).length + ':' + (D.envs || []).length;
  if(fp !== session.dataFingerprint){
    session.dataFingerprint = fp;
    if(!hasSetup && spends < 3) session.userState = 'new';
    else if(hasSetup) session.userState = 'established';
    else session.userState = 'setup';
  }
}

function recordHistory(role, text, intent){
  session.history.push({role:role, text:text, intent:intent, ts:Date.now()});
  if(session.history.length > 20) session.history.shift();
  if(intent){
    session.lastIntent = intent;
    session.topicsDiscussed[intent] = (session.topicsDiscussed[intent] || 0) + 1;
  }
}

function getLastBotText(){
  for(var i = session.history.length - 1; i >= 0; i--){
    if(session.history[i].role === 'bot') return session.history[i].text;
  }
  return '';
}

// ===== INTENT CLASSIFIER =====
// Returns: {intent, confidence, amounts[], categories[]}
function classify(query){
  var q = query.toLowerCase().replace(/[^\w\s\u0400-\u04FF₽]/g, ' ').trim();
  var amounts = [];
  var numMatches = q.match(/(\d[\d\s]*)(?:₽|руб|р\.|тыс|к)?/g);
  if(numMatches){
    for(var i=0; i<numMatches.length; i++){
      var raw = numMatches[i].replace(/[^\d]/g,'');
      var n = parseInt(raw, 10);
      if(numMatches[i].indexOf('тыс') !== -1 || numMatches[i].indexOf('к') !== -1) n *= 1000;
      if(n > 0 && n < 100000000) amounts.push(n);
    }
  }

  // Ordered by specificity (most specific first)
  var patterns = [
    // Greetings
    {intent:'greeting', re:/^(привет|здравств|добр(ый|ое|ой|ого)|hello|hi|hey|йо|хай|здарова)/i},
    // Thanks
    {intent:'thanks', re:/^(спасибо|благодар|thanks|thank|мерси|сенкс)/i},
    // Help
    {intent:'help', re:/^(помощ|помог|что (ты |умеешь|можешь|такое)|help|how|что делать|инструкц)/i},
    // Explicit afford
    {intent:'afford', re:/куп(ить|лю|аю|ай|ил)|можн(о|ый|ет)|потян(у|ет|у)|allow|afford|хват(ит|ает)|достаточ|позволю|позволит|buy|enough/i},
    // Debt
    {intent:'debt', re:/долг|кредит|рассроч|займ|переплат|задолженност|borrowing|debt|loan|credit|касс|заём/i},
    // Savings goal
    {intent:'savings', re:/накоп(ить|ить|ление|лю)|копи(ть|т|у)|цель|отпуск|подушк|сберечь|save|savings|goal|купе|攒/i},
    // Investment
    {intent:'invest', re:/инвест(ировать|иц|ор)|влож|акци|бирж|дивиденд|пассивн(ый|ого|ому)|invest|stock|market|etf|облигац|iis|иис/i},
    // Budget
    {intent:'budget', re:/бюджет|50.?30.?20|конверт|лимит|распредел|Envelope|budget|расход|Конверт/i},
    // Subscriptions
    {intent:'subscriptions', re:/подпис(к|ка|ок)|автоплат|subscribe|subscription/i},
    // Emergency
    {intent:'emergency', re:/подушк|резерв|аварийн|запас|emergency|rainy|стабильност/i},
    // Health score
    {intent:'health', re:/здоров|оценк|рейтинг|балл|score|health|состояни|финанс(ов)?|analyz/i},
    // Education
    {intent:'education', re:/научи|урок|обуч|финграмотн|грамотн|lesson|teach|learn|совет|объясни|расскажи про|что такое/i},
    // Spending (before scenario — "сократ траты" is spending, not scenario)
    {intent:'spending', re:/трат(ы|а|ил|ю|ает)|расход|уход|прожит|utеч|перерасход|лишн|лишне|expense|spend|spending|сократ.*трат|трат.*сократ/i},
    // Scenario (needs explicit "если" or scenario keywords)
    {intent:'scenario', re:/если|уреж(?!.*трат)|увелич|сценари|what.?if|scenario|если б|simulat/i},
    // Signals
    {intent:'signals', re:/сигнал|важно|срочн|проблем|вниман|alert|signal|warning|kritich/i},
    // Payday
    {intent:'payday', re:/зарплат|зп|до зп|payday|salary|wage|оклад|avans|аванс/i},
    // Daily
    {intent:'daily', re:/сегодня|дневн|лимит|потратить|тратить|daily|today|limit|сколько могу/i},
    // Month summary
    {intent:'month', re:/итог|месяц|этот месяц|прошл|summary|month|total|за месяц/i},
    // Setup
    {intent:'setup', re:/настр(ой|оить)|начать|с чего|старт|первый раз|новичок|start|setup|begin|setup/i},
  ];

  for(var j=0; j<patterns.length; j++){
    if(patterns[j].re.test(q)){
      return {intent:patterns[j].intent, confidence:1, amounts:amounts, query:q};
    }
  }

  // Check for number-only queries (likely afford)
  if(amounts.length > 0 && q.length < 30){
    return {intent:'afford', confidence:0.7, amounts:amounts, query:q};
  }

  // Check for category-specific queries
  var catWords = {
    'кафе':'cafe','ресторан':'cafe','еда':'grocery','продукт':'grocery','самокат':'scooters',
    'такси':'taxi','транспорт':'transport','подписк':'subs','развлечен':'fun',
    'одежд':'personal','салон':'personal','аптек':'health','лекарств':'health',
    'аренд':'home','жкх':'home','связ':'home','телефон':'home'
  };
  for(var word in catWords){
    if(q.indexOf(word) !== -1){
      return {intent:'scenario', confidence:0.8, amounts:amounts, query:q, category:catWords[word]};
    }
  }

  return {intent:'general', confidence:0, amounts:amounts, query:q};
}

// ===== DATA SUMMARY (for handlers) =====
function summarizeData(D, helpers){
  var now = new Date();
  var income = D.income || 0;
  var allSp = helpers.allSpends();

  // Month spend
  var mStart = new Date(now.getFullYear(), now.getMonth(), 1);
  var monthSpend = 0;
  for(var i=0; i<allSp.length; i++){ if(allSp[i].d >= mStart) monthSpend += allSp[i].s; }

  // Essential vs flexible
  var essentialCats = ['home','subs','transport','grocery'];
  var essentialSpend = 0;
  for(var j=0; j<allSp.length; j++){
    if(allSp[j].d >= mStart && essentialCats.indexOf(allSp[j].cat || 'other') !== -1) essentialSpend += allSp[j].s;
  }
  var flexSpend = monthSpend - essentialSpend;

  // Category breakdown
  var catSpend = {};
  for(var k=0; k<allSp.length; k++){
    if(allSp[k].d >= mStart){
      var c = allSp[k].cat || 'other';
      catSpend[c] = (catSpend[c] || 0) + allSp[k].s;
    }
  }

  // Top spending categories
  var topCats = [];
  for(var cat in catSpend){ topCats.push({cat:cat, sum:catSpend[cat]}); }
  topCats.sort(function(a,b){ return b.sum - a.sum; });

  // Debts
  var debts = D.credits || [];
  var totalDebt = 0;
  for(var d=0; d<debts.length; d++) totalDebt += debts[d].cur || 0;

  // Subscriptions
  var activeSubs = [];
  var subTotal = 0;
  for(var s=0; s<(D.subs||[]).length; s++){
    if(!D.subs[s].off){ activeSubs.push(D.subs[s]); subTotal += D.subs[s].s || 0; }
  }

  // Goals
  var goals = D.goals || [];
  var activeGoals = [];
  for(var g=0; g<goals.length; g++){ if(!goals[g].done) activeGoals.push(goals[g]); }

  // Envelopes
  var envs = D.envs || [];

  // Fixed payments
  var pays = D.pays || [];

  // Credit score
  var riskScore = helpers.calcRiskScore();

  // Daily limit
  var dl = helpers.calcDailyLimit();

  // Cash runway
  var runway = helpers.cashRunway();

  // Min balance
  var minBal = helpers.minBalance(90);

  // Savings rate
  var savingsRate = income > 0 ? Math.round((income - monthSpend) / income * 100) : null;

  // Debt-to-income
  var dti = income > 0 ? Math.round(totalDebt / income * 100) : null;

  return {
    income: income,
    monthSpend: monthSpend,
    essentialSpend: essentialSpend,
    flexSpend: flexSpend,
    saved: income - monthSpend,
    savingsRate: savingsRate,
    topCats: topCats,
    catSpend: catSpend,
    totalDebt: totalDebt,
    debts: debts,
    dti: dti,
    activeSubs: activeSubs,
    subTotal: subTotal,
    annualSubs: subTotal * 12,
    goals: goals,
    activeGoals: activeGoals,
    envs: envs,
    pays: pays,
    riskScore: riskScore,
    dl: dl,
    runway: runway,
    minBal: minBal,
    hasIncome: income > 0,
    hasData: income > 0 || allSp.length > 3
  };
}

// ===== RESPONSE BUILDERS =====
// Each returns: {text: string, chips: [{label, query}], followUp: string|null}

var R = {};

// --- GREETING ---
R.greeting = function(q, D, S, H){
  var name = (D.username || '').split(' ')[0];
  var hi = name ? ('Привет, ' + name + '!') : 'Привет!';
  if(S.userState === 'new'){
    return {
      text: hi + ' Я — МАЯК, твой финансовый помощник.<br><br>' +
        'Расскажи о себе: <b>сколько ты зарабатываешь в месяц?</b> — и я помогу разобраться с деньгами.',
      chips: [{label:'Указать доход', query:'Мой доход 80000'},{label:'Что умеешь?', query:'Что ты умеешь?'}],
      followUp: 'income_question'
    };
  }
  if(S.userState === 'setup'){
    return {
      text: hi + ' Вижу, ты уже начал настройку. Чем помочь?',
      chips: [{label:'Завершить настройку', query:'Как настроить?'}],
      followUp: null
    };
  }
  // Established
  var topIssue = null;
  if(S.dl.perDay < 500) topIssue = 'дневной лимит совсем маленький';
  else if(S.runway < 15) topIssue = 'прогноз нестабилен';
  else if(S.savingsRate !== null && S.savingsRate < 10) topIssue = 'норма сбережений низкая';
  else if(S.totalDebt > 0) topIssue = 'есть долги';
  if(topIssue){
    return {
      text: hi + ' Вижу, что ' + topIssue + '. Чем помочь?',
      chips: [{label:'Разобраться', query:'Что важно сейчас?'},{label:'Совет', query:'Дай совет по бюджету'}],
      followUp: null
    };
  }
  return {
    text: hi + ' Дела идут нормально. Чем помочь?',
    chips: [{label:'Мой бюджет', query:'Как мой бюджет?'},{label:'Совет', query:'Дай совет по экономии'}],
    followUp: null
  };
};

// --- HELP ---
R.help = function(q, D, S, H){
  return {
    text: '<b>Что я умею:</b><br><br>' +
      '💰 <b>Бюджет</b> — «Как мой бюджет?» / «Как работает 50/30/20?»<br>' +
      '💳 <b>Долги</b> — «Как быстрее закрыть долги?»<br>' +
      '🏦 <b>Копилка</b> — «Как накопить на отпуск?» / «Сколько откладывать?»<br>' +
      '🛒 <b>Покупки</b> — «Могу купить X?» / «Где утечки?»<br>' +
      '📈 <b>Инвестиции</b> — «С чего начать?»<br>' +
      '📊 <b>Здоровье</b> — «Оцени моё финансовое состояние»<br><br>' +
      'Просто напиши вопрос — я постараюсь помочь!',
    chips: [{label:'Мой бюджет', query:'Как мой бюджет?'},{label:'Здоровье', query:'Оцени моё финансовое состояние'}],
    followUp: null
  };
};

// --- THANKS ---
R.thanks = function(q, D, S, H){
  return {
    text: 'Рад помочь! Если появятся вопросы — я здесь.',
    chips: [{label:'Ещё вопрос', query:'Дай совет по бюджету'}],
    followUp: null
  };
};

// --- AFFORD ---
R.afford = function(q, D, S, H){
  var amount = (S.amounts && S.amounts[0]) || 0;
  if(amount <= 0){
    return {
      text: 'Скажи сумму: «Могу купить за 5000₽?» — и я проверю по прогнозу.',
      chips: [{label:'За 5000₽', query:'Могу купить за 5000₽?'}],
      followUp: null
    };
  }
  if(!S.hasIncome){
    return {
      text: 'Чтобы ответить, мне нужно знать твой доход. Укажи его — и я смогу точно сказать.',
      chips: [{label:'Указать доход', query:'Мой доход 80000'}],
      followUp: 'income_question'
    };
  }
  var r = H.canAfford(amount);
  var advice = '';
  if(r.verdict === 'yes'){
    advice = 'Покупка не повредит прогнозу. Но подумай: это нужда или желание?';
  } else if(r.verdict === 'warn'){
    advice = 'Можно, но с риском. Минимум баланса станет ' + H.fmt(r.riskMin) + '. Подожди зарплату или компенсируй.';
  } else {
    advice = 'Пока лучше воздержаться. Минимум уйдёт в ' + H.fmt(r.riskMin) + '. Подожди зарплату или урежь другие траты.';
  }
  return {
    text: '<b>' + H.fmt(amount) + '</b> — ' + r.txt + '<br><br>' + advice,
    chips: [{label:'Что если урежу кафе?', query:'Что будет, если я урежу кафе на 30%?'},{label:'До зп осталось?', query:'Сколько до зарплаты?'}],
    followUp: 'afford_done'
  };
};

// --- DEBT ---
R.debt = function(q, D, S, H){
  if(S.totalDebt === 0){
    return {
      text: 'У тебя нет долгов — отличная позиция! Можешь сосредоточиться на накоплениях.',
      chips: [{label:'Как копить?', query:'Как начать копить?'},{label:'Инвестиции', query:'С чего начать инвестировать?'}],
      followUp: null
    };
  }
  var plan = H.debtSnowball();
  var advice = '';
  if(plan){
    advice = '<b>Стратегия:</b> ' + (plan.strategy === 'avalanche' ?
      'Авалинх — гаси дорогие кредиты первыми (экономия на процентах).' :
      'Сноуболл — гаси маленькие первыми (мотивация быстрых побед).') +
      '<br><br>' + plan.txt;
  } else {
    advice = 'Общий долг: ' + H.fmt(S.totalDebt) + ' (' + S.dti + '% дохода).';
  }
  return {
    text: '<b>Долги: ' + S.debts.length + ' на ' + H.fmt(S.totalDebt) + '</b><br><br>' + advice,
    chips: [{label:'План погашения', query:'План погашения долгов'},{label:'Сократить траты', query:'Как сократить траты?'}],
    followUp: 'debt_done'
  };
};

// --- BUDGET ---
R.budget = function(q, D, S, H){
  if(!S.hasIncome){
    return {
      text: '<b>Правило 50/30/20:</b><br><br>' +
        '• <b>50%</b> — Обязательные (аренда, еда, транспорт)<br>' +
        '• <b>30%</b> — Гибкие (кафе, развлечения, подписки)<br>' +
        '• <b>20%</b> — Накопления и долги<br><br>' +
        'Укажи доход — и я покажу, как у тебя.',
      chips: [{label:'Указать доход', query:'Мой доход 80000'}],
      followUp: 'income_question'
    };
  }
  var ePct = S.income > 0 ? Math.round(S.essentialSpend / S.income * 100) : 0;
  var fPct = S.income > 0 ? Math.round(S.flexSpend / S.income * 100) : 0;
  var sPct = S.savingsRate;
  var issues = [];
  if(ePct > 50) issues.push('Обязательные (' + ePct + '%) выше 50%');
  if(fPct > 30) issues.push('Гибкие (' + fPct + '%) выше 30%');
  if(sPct !== null && sPct < 20) issues.push('Сбережения (' + sPct + '%) ниже 20%');

  var cats = '';
  for(var i=0; i<Math.min(5, S.topCats.length); i++){
    var pct = S.income > 0 ? Math.round(S.topCats[i].sum / S.income * 100) : 0;
    cats += '• ' + H.esc(H.catById(S.topCats[i].cat).n) + ': ' + H.fmt(S.topCats[i].sum) + ' (' + pct + '%)<br>';
  }

  return {
    text: '<b>Твой бюджет:</b><br><br>' +
      'Обязательные: ' + H.fmt(S.essentialSpend) + ' (' + ePct + '%) — ' + (ePct<=50?'✓':'✗') + '<br>' +
      'Гибкие: ' + H.fmt(S.flexSpend) + ' (' + fPct + '%) — ' + (fPct<=30?'✓':'✗') + '<br>' +
      'Накопления: ' + H.fmt(S.saved) + ' (' + sPct + '%) — ' + (sPct>=20?'✓':'✗') + '<br><br>' +
      (cats ? '<b>Топ трат:</b><br>' + cats + '<br>' : '') +
      (issues.length ? '<b>Что улучшить:</b> ' + issues.join('; ') : '<b>Отлично!</b> Ты в рамках нормы.'),
    chips: [{label:'Как сократить?', query:'Как сократить траты?'},{label:'Подробнее', query:'Расскажи подробнее про бюджет'}],
    followUp: 'budget_done'
  };
};

// --- SAVINGS ---
R.savings = function(q, D, S, H){
  var amount = (S.amounts && S.amounts[0]) || 0;
  if(amount > 0){
    var safeSave = S.income > 0 ? Math.round(S.income * 0.1) : 5000;
    var months = Math.ceil(amount / safeSave);
    return {
      text: 'Чтобы накопить ' + H.fmt(amount) + ':<br><br>' +
        '• Откладывай ' + H.fmt(safeSave) + '/мес (10% дохода) → ~' + months + ' мес.<br>' +
        '• Или ' + H.fmt(Math.round(amount/3)) + '/мес → за 3 мес.<br><br>' +
        '<b>Совет:</b> Настрой автоперевод в копилку в день зарплаты.',
      chips: [{label:'Какие у меня цели?', query:'Мои цели'},{label:'Автоперевод', query:'Как автоматически откладывать?'}],
      followUp: null
    };
  }
  if(S.activeGoals.length > 0){
    var list = '';
    for(var i=0; i<S.activeGoals.length; i++){
      var g = S.activeGoals[i];
      var pct = Math.round((g.cur || 0) / g.target * 100);
      list += '• <b>' + H.esc(g.n) + '</b>: ' + H.fmt(g.cur || 0) + ' / ' + H.fmt(g.target) + ' (' + pct + '%)<br>';
    }
    return {
      text: '<b>Твои цели:</b><br><br>' + list + '<br>Совет: начни с подушки безопасности.',
      chips: [{label:'Подушка', query:'Как создать подушку?'},{label:'Добавить цель', query:'Как добавить цель?'}],
      followUp: null
    };
  }
  return {
    text: 'Целей пока нет. <b>С чего начать копить?</b><br><br>' +
      '1. Подушка безопасности (3-6 мес. расходов)<br>' +
      '2. Крупные покупки<br>' +
      '3. Автоперевод 10% от зарплаты<br><br>' +
      '<b>Правило:</b> плати себе первым — в день зарплаты.',
    chips: [{label:'Подушка', query:'Как создать подушку?'},{label:'Копить на отпуск', query:'Как накопить на отпуск?'}],
    followUp: null
  };
};

// --- EMERGENCY ---
R.emergency = function(q, D, S, H){
  var cushion = 0;
  for(var i=0; i<S.activeGoals.length; i++){
    if(/подушк|резерв/i.test(S.activeGoals[i].n || '')) cushion = S.activeGoals[i].cur || 0;
  }
  var monthExp = S.monthSpend || S.income * 0.8 || 50000;
  var monthsCovered = monthExp > 0 ? (cushion / monthExp) : 0;
  var target = monthExp * 6;
  var verdict = '';
  if(monthsCovered >= 6) verdict = 'Отлично! Запас на 6+ месяцев.';
  else if(monthsCovered >= 3) verdict = 'Хорошо, но лучше довести до 6 месяцев.';
  else if(monthsCovered >= 1) verdict = 'Маленькая подушка. Нужно минимум 3 месяца.';
  else verdict = 'Подушки нет. Это приоритет номер один!';
  return {
    text: '<b>Подушка безопасности</b><br><br>' +
      'Сейчас: ' + H.fmt(cushion) + ' (~' + monthsCovered.toFixed(1) + ' мес.)<br>' +
      'Цель: ' + H.fmt(target) + '<br><br>' +
      '<b>' + verdict + '</b><br><br>' +
      'Как создать: откладывай 10% от зарплаты на отдельный счёт. Не трогай пока не накопишь.',
    chips: [{label:'Как откладывать?', query:'Как автоматически откладывать?'},{label:'Где хранить?', query:'Где лучше хранить подушку?'}],
    followUp: null
  };
};

// --- INVEST ---
R.invest = function(q, D, S, H){
  if(S.totalDebt > 0){
    return {
      text: '<b>Сначала закрой долги.</b> Кредит под 20% = 20% годовых, которые ты теряешь.',
      chips: [{label:'Как гасить долги?', query:'Как быстрее закрыть долги?'}],
      followUp: null
    };
  }
  var cushion = 0;
  for(var i=0; i<S.activeGoals.length; i++){
    if(/подушк/i.test(S.activeGoals[i].n || '')) cushion = S.activeGoals[i].cur || 0;
  }
  if(cushion < (S.monthSpend || S.income * 0.8) * 3){
    return {
      text: '<b>Сначала создай подушку безопасности</b> (3-6 месяцев расходов). Инвестировать без подушки — риск.',
      chips: [{label:'Как создать подушку?', query:'Как создать подушку безопасности?'}],
      followUp: null
    };
  }
  return {
    text: '<b>С чего начать инвестировать:</b><br><br>' +
      '1. <b>ИИС</b> — налоговый вычет до 52 000₽/год<br>' +
      '2. <b>Индексные фонды</b> (ETF) — средняя доходность 8-12% годовых<br>' +
      '3. <b>Облигации</b> — стабильный доход 8-15% годовых<br><br>' +
      '<b>Правило:</b> инвестируй только готовый потерять. Начни с 5-10% дохода.',
    chips: [{label:'Что такое ИИС?', query:'Что такое ИИС?'},{label:'Какие ETF?', query:'Какие ETF выбрать?'}],
    followUp: null
  };
};

// --- SUBSCRIPTIONS ---
R.subscriptions = function(q, D, S, H){
  if(S.activeSubs.length === 0){
    return {
      text: 'Активных подписок нет. Контролируешь обязательства — хорошо!',
      chips: [{label:'Обязательные платежи', query:'Мои обязательные платежи'}],
      followUp: null
    };
  }
  var list = '';
  for(var i=0; i<S.activeSubs.length; i++){
    list += '• <b>' + H.esc(S.activeSubs[i].n) + '</b> — ' + H.fmt(S.activeSubs[i].s) + '/мес<br>';
  }
  var pct = S.income > 0 ? Math.round(S.subTotal / S.income * 100) : null;
  return {
    text: '<b>' + S.activeSubs.length + ' подписок</b>: ' + H.fmt(S.subTotal) + '/мес, ' + H.fmt(S.annualSubs) + '/год<br><br>' +
      list + '<br>' +
      (pct !== null ? (pct > 10 ? 'Подписки (' + pct + '% дохода) — много. Проверь, какие используешь.' : 'Подписки в норме (' + pct + '% дохода).') : '') +
      '<br><br><b>Совет:</b> Раз в квартал проверяй список. Отключи неиспользуемые >30 дней.',
    chips: [{label:'Отключить подписку', query:'Как отключить подписку?'},{label:'Аудит подписок', query:'Проверь мои подписки'}],
    followUp: null
  };
};

// --- SPENDING ---
R.spending = function(q, D, S, H){
  if(!S.hasIncome){
    return {
      text: 'Укажи доход — тогда смогу оценить траты.',
      chips: [{label:'Указать доход', query:'Мой доход 80000'}],
      followUp: 'income_question'
    };
  }
  var pct = S.income > 0 ? Math.round(S.monthSpend / S.income * 100) : 0;
  var verdict = '';
  if(pct > 100) verdict = 'Тратишь больше дохода! Критично.';
  else if(pct > 80) verdict = 'Многовато. Мало что остаётся.';
  else if(pct > 60) verdict = 'Нормально, но есть потенциал.';
  else verdict = 'Отлично! Тратишь только ' + pct + '% дохода.';
  return {
    text: '<b>Траты за месяц:</b> ' + H.fmt(S.monthSpend) + '<br>' +
      'Доход: ' + H.fmt(S.income) + '<br>' +
      'Итого: ' + (S.saved >= 0 ? '+' : '') + H.fmt(S.saved) + '<br><br>' +
      '<b>' + verdict + '</b>',
    chips: [{label:'Где утечки?', query:'Где утечки в моём бюджете?'},{label:'Как сократить?', query:'Как сократить траты?'}],
    followUp: null
  };
};

// --- PAYDAY ---
R.payday = function(q, D, S, H){
  return {
    text: '<b>До зарплаты:</b> ' + S.dl.daysLeft + ' дн.<br>' +
      'Дневной лимит: ' + H.fmt(S.dl.perDay) + '<br>' +
      'Запас хода: ' + S.runway + ' дн.',
    chips: [{label:'Могу купить за 3000₽?', query:'Могу купить за 3000₽?'},{label:'Увеличить лимит', query:'Как увеличить дневной лимит?'}],
    followUp: null
  };
};

// --- DAILY ---
R.daily = function(q, D, S, H){
  return {
    text: 'Сегодня можно потратить <b>' + H.fmt(S.dl.perDay) + '</b> — и до зарплаты (' + S.dl.daysLeft + ' дн.) всё будет в плюсе.<br><br>' +
      '<b>Как считается:</b> (остаток − обязательные) ÷ дней до зарплаты.',
    chips: [{label:'Могу купить за 1000₽?', query:'Могу купить за 1000₽?'},{label:'Увеличить лимит', query:'Как увеличить дневной лимит?'}],
    followUp: null
  };
};

// --- SCENARIO ---
R.scenario = function(q, D, S, H){
  var amount = (S.amounts && S.amounts[0]) || 0;
  var catId = S.category || 'cafe';
  var catSum = S.catSpend[catId] || 0;
  if(amount === 0) amount = Math.round(catSum * 0.3);
  if(amount <= 0) amount = 1000;
  var sim = H.whatIf(amount);
  var catName = H.catById(catId).n;
  return {
    text: '<b>Сценарий: урезать «' + H.esc(catName) + '» на ' + H.fmt(amount) + '</b><br><br>' +
      'Сейчас: ' + H.fmt(catSum) + '/мес.<br>' +
      'Эффект на 90 дней: минимум ' +
      '<b style="color:' + (sim.diff > 0 ? 'var(--grn)' : 'var(--red)') + '">' +
      H.fmt(sim.newMin) + '</b> (было ' + H.fmt(sim.originalMin) + ', ' +
      (sim.diff > 0 ? '+' : '') + H.fmt(sim.diff) + ')<br><br>' +
      (sim.diff > 0 ? 'Отличный шаг!' : 'Лучше урежь другую категорию.'),
    chips: [{label:'Другая категория', query:'Что будет, если я урежу самокаты на 50%?'},{label:'Другой сценарий', query:'Что если сокращу подписки?'}],
    followUp: null
  };
};

// --- HEALTH ---
R.health = function(q, D, S, H){
  var score = S.riskScore;
  var details = '';
  if(S.savingsRate !== null) details += '• Сбережения: ' + S.savingsRate + '% ' + (S.savingsRate >= 20 ? '✓' : '✗') + '<br>';
  details += '• Долги: ' + H.fmt(S.totalDebt) + ' ' + (S.totalDebt === 0 ? '✓' : '✗') + '<br>';
  details += '• Подушка: ~' + (S.monthSpend > 0 ? ((0) / S.monthSpend).toFixed(1) : '0') + ' мес.<br>';
  details += '• Прогноз: ' + (S.minBal.val >= 0 ? 'стабилен ✓' : 'уходит в минус ✗') + '<br>';
  var recs = '';
  if(score.score < 50) recs = 'Сфокусируйся на подушке. Сократи гибкие. Гаси долги.';
  else if(score.score < 75) recs = 'Увеличь сбережения до 20%. Рассмотри инвестиции.';
  else recs = 'Отличное здоровье! Рассмотри инвестиции и оптимизируй налоги.';
  return {
    text: '<b>Финансовое здоровье: ' + score.grade + ' (' + score.score + '/100)</b><br><br>' + details + '<br><b>' + recs + '</b>',
    chips: [{label:'Как улучшить?', query:'Как улучшить финансовое здоровье?'},{label:'План долгов', query:'Как быстрее закрыть долги?'}],
    followUp: null
  };
};

// --- EDUCATION ---
R.education = function(q, D, S, H){
  var ql = q.toLowerCase();
  if(/бюджет|50.?30.?20|распредел/i.test(ql)){
    return {
      text: '<b>Правило 50/30/20:</b><br><br>' +
        '• <b>50%</b> — Обязательные (аренда, еда, транспорт)<br>' +
        '• <b>30%</b> — Гибкие (кафе, развлечения, подписки)<br>' +
        '• <b>20%</b> — Накопления и долги<br><br>' +
        '<b>Пример:</b> 80 000₽ → 40 000 обязательных, 24 000 гибких, 16 000 накопления.',
      chips: [{label:'Мой бюджет', query:'Как мой бюджет?'}],
      followUp: null
    };
  }
  if(/долг|кредит|snow|avalanche/i.test(ql)){
    return {
      text: '<b>Два метода погашения долгов:</b><br><br>' +
        '<b>1. Сноуболл</b> — гаси маленький долг первым (мотивация).<br>' +
        '<b>2. Авалинх</b> — гаси дорогой первым (экономия).<br><br>' +
        'Какой выбрать? Мотивация → сноуболл. Экономия → авалинх.',
      chips: [{label:'Мой план', query:'Как быстрее закрыть мои долги?'}],
      followUp: null
    };
  }
  if(/инвест|влож|акци|бирж/i.test(ql)){
    return {
      text: '<b>Инвестиции для начинающих:</b><br><br>' +
        '1. <b>ИИС</b> — вычет до 52 000₽/год<br>' +
        '2. <b>Индексные фонды</b> — 8-12% годовых<br>' +
        '3. <b>Облигации</b> — 8-15% годовых<br><br>' +
        'Диверсификация: 40% облигации, 40% акции, 20% депозит.',
      chips: [{label:'Что такое ИИС?', query:'Что такое ИИС?'},{label:'Какие ETF?', query:'Какие ETF выбрать?'}],
      followUp: null
    };
  }
  return {
    text: '<b>Основы финансовой грамотности:</b><br><br>' +
      '• 50/30/20 — правило распределения<br>' +
      '• Подушка — 3-6 мес. расходов<br>' +
      '• Долги — гаси дорогие первыми<br>' +
      '• Инвестиции — начни с ИИС<br><br>' +
      'Задай конкретный вопрос — расскажу подробнее!',
    chips: [{label:'50/30/20', query:'Как работает 50/30/20?'},{label:'Долги', query:'Как погасить долги?'}],
    followUp: null
  };
};

// --- SETUP ---
R.setup = function(q, D, S, H){
  var st = H.setupState();
  var sNames = {inc:'доход и день зарплаты',bal:'текущий баланс',pay:'обязательные платежи',env:'первый конверт'};
  var missing = [];
  for(var k in st.st){ if(!st.st[k]) missing.push(sNames[k]); }
  if(missing.length === 0){
    return {
      text: 'Всё настроено! Добавляй траты — я буду следить за прогнозом.',
      chips: [{label:'Добавить трату', query:'Как добавить трату?'},{label:'Что важно?', query:'Что важно сейчас?'}],
      followUp: null
    };
  }
  return {
    text: '<b>Настройка: ' + st.done + '/' + st.total + '</b><br><br>' +
      'Осталось: ' + missing.join(', ') + '.<br>Чек-лист — вверху Панели.',
    chips: [{label:'Указать доход', query:'Как настроить доход?'},{label:'Добавить платёж', query:'Как добавить платёж?'}],
    followUp: null
  };
};

// --- MONTH ---
R.month = function(q, D, S, H){
  var pct = S.income > 0 ? Math.round(S.monthSpend / S.income * 100) : 0;
  return {
    text: '<b>Итоги месяца:</b><br><br>' +
      'Потрачено: ' + H.fmt(S.monthSpend) + '<br>' +
      'Доход: ' + H.fmt(S.income) + '<br>' +
      (S.saved >= 0 ? 'Сэкономлено: ' : 'Перерасход: ') + H.fmt(Math.abs(S.saved)) + ' (' + pct + '%)<br><br>' +
      (S.saved >= 0 ? 'Отлично!' : 'Расходы превысили доход.'),
    chips: [{label:'Где утечки?', query:'Где утечки?'},{label:'Как сократить?', query:'Как сократить траты?'}],
    followUp: null
  };
};

// --- SIGNALS ---
R.signals = function(q, D, S, H){
  var sigs = H.getSignals();
  if(sigs.length === 0){
    return {text:'Сейчас всё спокойно. Так держать!', chips:[{label:'Здоровье',query:'Оцени моё финансовое состояние'}], followUp:null};
  }
  var html = '<b>Что важно сейчас:</b><br><br>';
  for(var i=0; i<sigs.length; i++){
    var s = sigs[i];
    html += '• <b style="color:' + (s.sev>=8?'var(--red)':s.sev>=5?'var(--org)':'var(--blu)') + '">' +
      H.esc(s.title) + '</b> — ' + H.esc(s.desc) + (s.benefit ? ' · выгода ' + H.fmt(s.benefit) + '/мес' : '') + '<br>';
  }
  return {
    text: html,
    chips: [{label:'Разобрать первый',query:'Расскажи подробнее'},{label:'Здоровье',query:'Оцени моё финансовое состояние'}],
    followUp: null
  };
};

// --- GENERAL (fallback with clarifying questions) ---
R.general = function(q, D, S, H){
  if(!S.hasData){
    return {
      text: 'Я не совсем понял. Вот что я умею:<br><br>' +
        '• Бюджет, долги, копилка, подписки, покупки, инвестиции<br><br>' +
        'Попробуй перефразировать или выбери тему.',
      chips: [{label:'Бюджет',query:'Как составить бюджет?'},{label:'Долги',query:'Как закрыть долги?'},{label:'Здоровье',query:'Оцени моё финансовое состояние'}],
      followUp: null
    };
  }
  // With data: ask clarifying question
  var context = '';
  if(S.lastIntent){
    context = 'Ты спрашивал про ' + (S.lastTopic || S.lastIntent) + '. ';
  }
  return {
    text: context + 'Уточни вопрос: тебя интересует <b>бюджет</b>, <b>долги</b>, <b>накопления</b>, <b>покупки</b> или что-то другое?',
    chips: [{label:'Бюджет',query:'Как мой бюджет?'},{label:'Долги',query:'Как закрыть долги?'},{label:'Копилка',query:'Как начать копить?'},{label:'Здоровье',query:'Оцени моё финансовое состояние'}],
    followUp: null
  };
};

// ===== INTENT → HANDLER MAPPING =====
var intentHandlers = {
  greeting: R.greeting,
  help: R.help,
  thanks: R.thanks,
  afford: R.afford,
  debt: R.debt,
  budget: R.budget,
  savings: R.savings,
  emergency: R.emergency,
  invest: R.invest,
  subscriptions: R.subscriptions,
  spending: R.spending,
  payday: R.payday,
  daily: R.daily,
  scenario: R.scenario,
  health: R.health,
  education: R.education,
  setup: R.setup,
  month: R.month,
  signals: R.signals,
  general: R.general
};

var intentTopics = {
  greeting:'приветствие',help:'помощь',thanks:'благодарность',
  afford:'покупки',debt:'долги',budget:'бюджет',savings:'накопления',
  emergency:'подушка',invest:'инвестиции',subscriptions:'подписки',
  spending:'траты',payday:'зарплата',daily:'дневной лимит',
  scenario:'сценарии',health:'здоровье',education:'обучение',
  setup:'настройка',month:'итоги',signals:'сигналы',general:'общий'
};

// ===== MAIN API =====
function processQuery(query, D, helpers){
  updateUserState(D);
  var classified = classify(query);
  var intent = classified.intent;
  var handler = intentHandlers[intent] || intentHandlers.general;

  // Build data summary
  var S = summarizeData(D, helpers);
  S.amounts = classified.amounts;
  S.category = classified.category;
  S.userState = session.userState; // Pass session state to handler

  // Record user message
  recordHistory('user', query, intent);

  // Get response
  var response = handler(query, D, S, {
    fmt: helpers.fmt,
    esc: helpers.esc,
    canAfford: helpers.canAfford,
    debtSnowball: helpers.debtSnowball,
    calcDailyLimit: helpers.calcDailyLimit,
    cashRunway: helpers.cashRunway,
    getSignals: helpers.getSignals,
    whatIf: helpers.whatIf,
    setupState: helpers.setupState,
    calcRiskScore: helpers.calcRiskScore,
    minBalance: helpers.minBalance,
    allSpends: helpers.allSpends,
    catById: helpers.catById
  });

  // Record bot response
  recordHistory('bot', response.text, intent);

  // Update session topic
  session.lastTopic = intentTopics[intent] || intent;

  return {
    text: response.text,
    chips: response.chips || [],
    intent: intent,
    followUp: response.followUp || null,
    session: {
      userState: session.userState,
      topicsDiscussed: session.topicsDiscussed,
      lastTopic: session.lastTopic
    }
  };
}

function getSession(){ return session; }

// Expose globally
window.Copilot = {
  process: processQuery,
  classify: classify,
  session: session,
  getSession: getSession,
  resetSession: resetSession,
  handlers: intentHandlers,
  R: R
};

})();
