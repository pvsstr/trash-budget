/**
 * МАЯК Copilot — Universal Financial Advisor
 * ===========================================
 * Architecture:
 *   1. Intent Classifier: keyword + context matching → intent type
 *   2. Response Handlers: each intent → {text, chips[], followUp}
 *   3. Proactive System: vague queries → clarifying questions
 *   4. Personalization: uses D object data when available
 *   5. i18n: all responses via t() function
 *
 * Intents: afford, debt, budget, savings, emergency, invest,
 *          subscriptions, spending, payday, daily, scenario,
 *          health, education, setup, month, signals, greeting,
 *          thanks, help, general
 *
 * Each handler returns: {html: string, chips: [{label, query}]}
 */
(function(){
'use strict';

var intentMap = [
  // Order matters: more specific patterns first
  {intent:'afford',    re:/куп(ить|лю|аю|ай)|можн(о|ый)|потян(у|ет)|afford|хват(ит|ит ли|аем)|достаточ|позволю|bu(?:y|dget)/i, needsNum:true},
  {intent:'debt',      re:/долг|кредит|рассроч|закрыть кредит|займ|переплат| borrowing|debt|loan|credit/i},
  {intent:'budget',    re:/бюджет|50.?30.?20|конверт|лимит|распредел|Envelope|budget|К播нверт/i},
  {intent:'savings',   re:/накоп(ить|ить|ление)|копи(ть|т)|цель|отпуск|подушк|сберечь|save|savings|goal/i},
  {intent:'emergency', re:/подушк|резерв|аварийн|запас|emergency|rainy.?day|стабильн/i},
  {intent:'invest',    re:/инвест|влож|акци|бирж|дивиденд|процент|ставк|пассивн|invest|stock|market|return/i},
  {intent:'subscriptions', re:/подпис(к|ка|ок)|автоплат|subscribe|subscription/i},
  {intent:'spending',  re:/трат(ы|а|ил|ю)|расход|уход|прожит|utеч|перерасход|лишн|лишне|expense|spend|spending/i},
  {intent:'payday',    re:/зарплат|зп|до зп|payday|salary|wage|оклад/i},
  {intent:'daily',     re:/сегодня|дневн|лимит|потратить|тратить|daily|today|limit/i},
  {intent:'scenario',  re:/если|уреж|сократ|увелич|сценари|what.?if|scenario|если бы/i},
  {intent:'health',    re:/здоров|оценк|рейтинг|балл|score|health|состояни|финанс(ов)?/i},
  {intent:'education', re:/научи|урок|обуч|финграмотн|грамотн|lesson|teach|learn|совет/i},
  {intent:'setup',     re:/настр(ой|оить)|начать|с чего|старт|первый раз|новичок|start|setup|begin/i},
  {intent:'month',     re:/итог|месяц|этот месяц|прошл|summary|month|total/i},
  {intent:'signals',   re:/сигнал|важно|срочн|проблем|вниман|alert|signal|warning/i},
  {intent:'thanks',    re:/спасибо|благодар|thanks|thank|merci/i},
  {intent:'greeting',  re:/привет|здравств|добр(ый|ое|ой)|hello|hi|hey|день|вечер|утр/i},
  {intent:'help',      re:/помощ|помог|что (ты |умеешь|можешь)|help|how (do|does)|что делать/i},
];

function classifyIntent(query) {
  var q = query.toLowerCase().trim();
  for (var i = 0; i < intentMap.length; i++) {
    if (intentMap[i].re.test(q)) {
      return intentMap[i].intent;
    }
  }
  // Check if query contains a number (might be afford or savings with amount)
  if (/\d[\d\s]*[₽руб]|^\d[\d\s]*$/i.test(q)) {
    return 'afford';
  }
  return 'general';
}

function extractAmount(query) {
  var m = query.match(/(\d[\d\s]*)/);
  if (!m) return 0;
  return parseInt(m[1].replace(/\s/g, ''), 10) || 0;
}

// ===== RESPONSE HANDLERS =====
// Each returns {html: string, chips: [{label: string, query: string}]}

var handlers = {};

// --- GREETING ---
handlers.greeting = function(q, D, ctx) {
  var name = (D.username || '').split(' ')[0] || null;
  var hello = name ? ('Привет, ' + name + '!') : 'Привет!';
  var hasData = (D.income || 0) > 0 || (D.spends || []).length > 3;
  if (!hasData) {
    return {
      html: hello + ' Я — твой финансовый копилот.<br><br>' +
        'Я помогу разобраться с деньгами: посчитаю, сколько можно тратить, найду утечки, подскажу, как копить и выходить из долгов.<br><br>' +
        'Расскажи о себе: <b>какой у тебя доход в месяц?</b> — и я дам персональные советы.',
      chips: [
        {label: 'Указать доход', query: 'Как настроить доход?'},
        {label: 'Что умеешь?', query: 'Что ты умеешь?'},
        {label: 'Совет по бюджету', query: 'Как составить бюджет?'}
      ]
    };
  }
  return {
    html: hello + ' Вижу, ты уже пользуешься МАЯКом. Чем помочь?',
    chips: [
      {label: 'Как дела с бюджетом?', query: 'Как мой бюджет?'},
      {label: 'Что важно сейчас?', query: 'Что важно сейчас?'},
      {label: 'Совет по экономии', query: 'Как сэкономить?'}
    ]
  };
};

// --- HELP ---
handlers.help = function(q, D, ctx) {
  return {
    html: '<b>Что я умею:</b><br><br>' +
      '• <b>Бюджет</b> — «Как составить бюджет?» / «Как работает 50/30/20?»<br>' +
      '• <b>Долги</b> — «Как быстрее закрыть долги?» / «Стоит ли гасить кредит досрочно?»<br>' +
      '• <b>Копилка</b> — «Как накопить на отпуск?» / «Сколько откладывать?»<br>' +
      '• <b>Траты</b> — «Могу купить X?» / «Где утечки?»<br>' +
      '• <b>Инвестиции</b> — «С чего начать инвестировать?»<br>' +
      '• <b>Подписки</b> — «Мои подписки» / «Стоит ли отключить подписку?»<br>' +
      '• <b>Здоровье</b> — «Оцени моё финансовое состояние»<br><br>' +
      'Просто напиши вопрос — я постараюсь помочь!',
    chips: [
      {label: 'Как составить бюджет?', query: 'Как составить бюджет?'},
      {label: 'Могу купить машину?', query: 'Могу купить машину за 500000?'},
      {label: 'Финансовое здоровье', query: 'Оцени моё финансовое состояние'}
    ]
  };
};

// --- THANKS ---
handlers.thanks = function(q, D, ctx) {
  return {
    html: 'Рад помочь! Если появятся вопросы — я здесь. Удачи с финансами!',
    chips: [
      {label: 'Ещё вопрос', query: 'Помоги с бюджетом'},
      {label: 'Что важно сейчас?', query: 'Что важно сейчас?'}
    ]
  };
};

// --- AFFORD ---
handlers.afford = function(q, D, ctx) {
  var amount = extractAmount(q);
  if (amount <= 0) {
    return {
      html: 'Скажи сумму: «Могу купить X за Y₽?» — и я проверю по прогнозу.',
      chips: [
        {label: 'Могу купить за 5000₽?', query: 'Могу купить за 5000₽?'},
        {label: 'Могу купить за 20000₽?', query: 'Могу купить за 20000₽?'}
      ]
    };
  }
  if (!ctx.hasIncome) {
    return {
      html: 'Чтобы ответить, мне нужно знать твой доход. Укажи его на Панели — и я смогу точно сказать, потянешь ли покупку.',
      chips: [
        {label: 'Указать доход', query: 'Как настроить доход?'}
      ]
    };
  }
  var r = ctx.canAfford(amount);
  var advice = '';
  if (r.verdict === 'yes') {
    advice = 'Покупка не повредит прогнозу. Но подумай: это нужда или желание? ' +
      'Если откладываешь на цель — проверь, не сдвинет ли это срок.';
  } else if (r.verdict === 'risk') {
    advice = 'Можно, но с риском. Минимум баланса станет ' + ctx.fmt(r.riskMin) + '. ' +
      'Лучше подождать до зарплаты или найти способ компенсировать.';
  } else {
    advice = 'Пока лучше воздержаться. Без этой покупки минимум баланса будет ' + ctx.fmt(r.safeMin) + ', ' +
      'а с ней — ' + ctx.fmt(r.riskMin) + '. Подожди зарплату или урежь другие траты.';
  }
  return {
    html: '<b>' + ctx.fmt(amount) + '</b> — ' + r.txt + '<br><br>' + advice,
    chips: [
      {label: 'Что если урежу кафе?', query: 'Что будет, если я урежу кафе на 30%?'},
      {label: 'Сколько осталось до зп?', query: 'Сколько до зарплаты?'}
    ]
  };
};

// --- DEBT ---
handlers.debt = function(q, D, ctx) {
  var debts = D.credits || [];
  var totalDebt = 0;
  for (var i = 0; i < debts.length; i++) totalDebt += debts[i].cur || 0;
  if (debts.length === 0 || totalDebt === 0) {
    return {
      html: 'У тебя нет долгов — это отличная позиция! ' +
        'Можешь сосредоточиться на накоплениях и инвестициях.<br><br>' +
        '<b>Совет:</b> Если появится возможность взять кредит — помни правило: ' +
        'ежемесячный платёж не должен превышать 30% дохода.',
      chips: [
        {label: 'Как копить?', query: 'Как начать копить?'},
        {label: 'Инвестиции', query: 'С чего начать инвестировать?'}
      ]
    };
  }
  var plan = ctx.debtSnowball();
  var income = D.income || 1;
  var dti = Math.round(totalDebt / income * 100);
  var advice = '';
  if (plan) {
    advice = '<b>Стратегия:</b> ' + (plan.strategy === 'avalanche' ? 'Авалинх — гаси самые дорогие кредиты первыми (экономия на процентах).' :
      'Сноуболл — гаси самые маленькие кредиты первыми (мотивация быстрых побед).') +
      '<br><br><b>План:</b> ' + plan.txt +
      '<br><br><b>Совет:</b> Не гаси все деньги в долг одновременно. Оставляй подушку безопасности хотя бы 1 месяц расходов.';
  } else {
    advice = 'Общий долг: ' + ctx.fmt(totalDebt) + ' (' + dti + '% дохода). ' +
      (dti > 50 ? 'Это критически много — нужна срочная стратегия.' :
       dti > 30 ? 'Много, но управляемо.' : 'В пределах нормы.') +
      '<br><br><b>Правило 50/30/20:</b> Не более 20% дохода должно уходить на погашение долгов.';
  }
  return {
    html: 'Долгов: ' + debts.length + ' на ' + ctx.fmt(totalDebt) + ' (' + dti + '% дохода).<br><br>' + advice,
    chips: [
      {label: 'План погашения', query: 'План погашения долгов'},
      {label: 'Стоит ли гасить досрочно?', query: 'Стоит ли гасить кредит досрочно?'},
      {label: 'Как сократить траты?', query: 'Как сократить траты?'}
    ]
  };
};

// --- BUDGET ---
handlers.budget = function(q, D, ctx) {
  var income = D.income || 0;
  if (!income) {
    return {
      html: '<b>Правило 50/30/20</b> — простой способ распределить доход:<br><br>' +
        '• <b>50%</b> — Обязательные (аренда, еда, транспорт, связь)<br>' +
        '• <b>30%</b> — Гибкие (кафе, развлечения, подписки, одежда)<br>' +
        '• <b>20%</b> — Накопления и долги<br><br>' +
        'Укажи доход на Панели — и я покажу, как у тебя распределены траты.',
      chips: [
        {label: 'Указать доход', query: 'Как настроить доход?'},
        {label: 'Что такое конверты?', query: 'Как работают конверты?'}
      ]
    };
  }
  var monthSpend = ctx.monthSpend;
  var saved = income - monthSpend;
  var essential = ctx.essentialSpend;
  var flex = monthSpend - essential;
  var ePct = Math.round(essential / income * 100);
  var fPct = Math.round(flex / income * 100);
  var sPct = Math.round(saved / income * 100);
  var verdict = '';
  if (ePct > 50) verdict = 'Обязательные траты (' + ePct + '%) превышают норму 50%. Ищи, где сократить: связи, транспорт, продукты.';
  else if (fPct > 30) verdict = 'Гибкие траты (' + fPct + '%) выше нормы 30%. Посмотри на кафе, развлечения, подписки.';
  else if (sPct < 20) verdict = 'Норма сбережений (' + sPct + '%) ниже рекомендованных 20%. Попробуй автоматически откладывать 10% в день зарплаты.';
  else verdict = 'Отличное распределение! Ты в рамках рекомендаций 50/30/20.';
  return {
    html: '<b>Твой бюджет:</b><br><br>' +
      '• Обязательные: ' + ctx.fmt(essential) + ' (' + ePct + '%) — ' + (ePct <= 50 ? '✓' : '✗') + '<br>' +
      '• Гибкие: ' + ctx.fmt(flex) + ' (' + fPct + '%) — ' + (fPct <= 30 ? '✓' : '✗') + '<br>' +
      '• Накопления: ' + ctx.fmt(saved) + ' (' + sPct + '%) — ' + (sPct >= 20 ? '✓' : '✗') + '<br><br>' +
      '<b>Вердикт:</b> ' + verdict,
    chips: [
      {label: 'Как сократить гибкие?', query: 'Как сократить траты?'},
      {label: 'Настроить конверты', query: 'Как работают конверты?'},
      {label: 'Автосбережения', query: 'Как автоматически откладывать?'}
    ]
  };
};

// --- SAVINGS ---
handlers.savings = function(q, D, ctx) {
  var amount = extractAmount(q);
  var goals = D.goals || [];
  var activeGoals = [];
  for (var i = 0; i < goals.length; i++) {
    if (!goals[i].done) activeGoals.push(goals[i]);
  }
  if (amount > 0) {
    var income = D.income || 1;
    var safeSave = Math.round(income * 0.1);
    if (safeSave < 1000) safeSave = 1000;
    var months = Math.ceil(amount / safeSave);
    return {
      html: 'Чтобы накопить ' + ctx.fmt(amount) + ':<br><br>' +
        '• Откладывай ' + ctx.fmt(safeSave) + '/мес (10% дохода) → накопишь за ~' + months + ' мес.<br>' +
        '• Или ' + ctx.fmt(Math.round(amount / 3)) + '/мес → за 3 мес.<br><br>' +
        '<b>Совет:</b> Настрой автоперевод в копилку в день зарплаты — так не потратишь случайно.',
      chips: [
        {label: 'Какие у меня цели?', query: 'Мои цели'},
        {label: 'Как откладывать автоматически?', query: 'Как автоматически откладывать?'}
      ]
    };
  }
  if (activeGoals.length > 0) {
    var list = '';
    for (var j = 0; j < activeGoals.length; j++) {
      var g = activeGoals[j];
      var pct = Math.round((g.cur || 0) / g.target * 100);
      list += '• <b>' + ctx.esc(g.n) + '</b>: ' + ctx.fmt(g.cur || 0) + ' из ' + ctx.fmt(g.target) + ' (' + pct + '%)<br>';
    }
    return {
      html: '<b>Твои цели:</b><br><br>' + list + '<br>' +
        'Совет: начни с подушки безопасности (3-6 месяцев расходов), потом — инвестиции.',
      chips: [
        {label: 'Добавить цель', query: 'Как добавить цель?'},
        {label: 'Подушка безопасности', query: 'Как создать подушку?'}
      ]
    };
  }
  return {
    html: 'Целей пока нет. <b>С чего начать копить?</b><br><br>' +
      '1. Создай подушку безопасности (3-6 месяцев расходов)<br>' +
      '2. Определи крупные покупки (машина, отпуск, жильё)<br>' +
      '3. Настрой автоперевод 10% от зарплаты<br><br>' +
      '<b>Правило:</b> плати себе первым — в день зарплаты переводи 10-20% в копилку.',
    chips: [
      {label: 'Создать подушку', query: 'Как создать подушку безопасности?'},
      {label: 'Копить на отпуск', query: 'Как накопить на отпуск?'}
    ]
  };
};

// --- EMERGENCY ---
handlers.emergency = function(q, D, ctx) {
  var income = D.income || 0;
  var monthSpend = ctx.monthSpend || income * 0.8;
  var cush = null;
  var goals = D.goals || [];
  for (var i = 0; i < goals.length; i++) {
    if (/подушк|резерв|аварийн/i.test(goals[i].n || '')) { cush = goals[i]; break; }
  }
  var cushion = cush ? (cush.cur || 0) : 0;
  var monthsCovered = monthSpend > 0 ? (cushion / monthSpend) : 0;
  var target = monthSpend * 6;
  var verdict = '';
  if (monthsCovered >= 6) verdict = 'Отлично! У тебя запас на 6+ месяцев. Ты финансово защищён.';
  else if (monthsCovered >= 3) verdict = 'Хорошая подушка! Но лучше довести до 6 месяцев.';
  else if (monthsCovered >= 1) verdict = 'Подушка есть, но маленькая. Нужно как минимум 3 месяца.';
  else verdict = 'Подушки нет или она почти пустая. Это приоритет номер один!';
  return {
    html: '<b>Подушка безопасности</b><br><br>' +
      'Сейчас: ' + ctx.fmt(cushion) + ' (~' + monthsCovered.toFixed(1) + ' мес.)<br>' +
      'Цель: ' + ctx.fmt(target) + ' (6 мес. расходов)<br><br>' +
      '<b>Вердикт:</b> ' + verdict + '<br><br>' +
      '<b>Как создать:</b> откладывай 10% от зарплаты на отдельный счёт. Не трогай пока не накопишь нужную сумму.',
    chips: [
      {label: 'Как откладывать 10%?', query: 'Как автоматически откладывать?'},
      {label: 'Где хранить подушку?', query: 'Где лучше хранить подушку безопасности?'}
    ]
  };
};

// --- INVEST ---
handlers.invest = function(q, D, ctx) {
  var income = D.income || 0;
  var hasDebt = false;
  var debts = D.credits || [];
  for (var i = 0; i < debts.length; i++) { if ((debts[i].cur || 0) > 0) hasDebt = true; }
  var cushion = 0;
  var goals = D.goals || [];
  for (var j = 0; j < goals.length; j++) {
    if (/подушк/i.test(goals[j].n || '')) cushion = goals[j].cur || 0;
  }
  var monthSpend = ctx.monthSpend || income * 0.8;
  var advice = '';
  if (hasDebt) {
    advice = 'Сначала закрой долги — это «безрисковая доходность» равная процентной ставке кредита. ' +
      'Кредит под 20% = 20% годовых, которые ты теряешь.';
  } else if (cushion < monthSpend * 3) {
    advice = 'Сначала создай подушку безопасности (3-6 месяцев расходов). Инвестировать без подушки — риск.';
  } else {
    advice = '<b>С чего начать:</b><br>' +
      '1. ИИС (индивидуальный инвестиционный счёт) — налоговый вычет<br>' +
      '2. Индексные фонды (ETF) — низкий риск, средняя доходность 8-12% годовых<br>' +
      '3. Диверсификация — не клади всё в один актив<br><br>' +
      '<b>Правило:</b> инвестируй только то, что готов потерять. Начни с 5-10% дохода.';
  }
  return {
    html: '<b>Инвестиции</b><br><br>' + advice,
    chips: [
      {label: 'Что такое ИИС?', query: 'Что такое ИИС?'},
      {label: 'Какие ETF выбрать?', query: 'Какие ETF выбрать?'},
      {label: 'Сначала подушка', query: 'Как создать подушку безопасности?'}
    ]
  };
};

// --- SUBSCRIPTIONS ---
handlers.subscriptions = function(q, D, ctx) {
  var subs = D.subs || [];
  var active = [];
  var total = 0;
  for (var i = 0; i < subs.length; i++) {
    if (!subs[i].off) {
      active.push(subs[i]);
      total += subs[i].s || 0;
    }
  }
  if (active.length === 0) {
    return {
      html: 'Активных подписок нет. Это хорошо — ты контролируешь свои обязательства.',
      chips: [
        {label: 'Мои обязательные платежи', query: 'Мои обязательные платежи'},
        {label: 'Как сократить расходы?', query: 'Как сократить траты?'}
      ]
    };
  }
  var annual = total * 12;
  var income = D.income || 1;
  var pct = Math.round(total / income * 100);
  var list = '';
  for (var j = 0; j < active.length; j++) {
    list += '• <b>' + ctx.esc(active[j].n) + '</b> — ' + ctx.fmt(active[j].s) + '/мес<br>';
  }
  var advice = pct > 10 ?
    'Подписки (' + pct + '% дохода) — много. Проверь, какие реально используешь.' :
    'Подписки в норме (' + pct + '% дохода).';
  return {
    html: '<b>' + active.length + ' активных подписок</b>: ' + ctx.fmt(total) + '/мес, ' + ctx.fmt(annual) + '/год<br><br>' +
      list + '<br>' + advice + '<br><br>' +
      '<b>Совет:</b> Раз в квартал проверяй список подписок. Отключи те, которыми не пользовался >30 дней.',
    chips: [
      {label: 'Отключить подписку', query: 'Как отключить подписку?'},
      {label: 'Аудит подписок', query: 'Проверь мои подписки'}
    ]
  };
};

// --- SPENDING ---
handlers.spending = function(q, D, ctx) {
  var monthSpend = ctx.monthSpend;
  var income = D.income || 0;
  var saved = income - monthSpend;
  var pct = income > 0 ? Math.round(monthSpend / income * 100) : 0;
  var verdict = '';
  if (income === 0) {
    verdict = 'Укажи доход — тогда смогу оценить, насколько адекватны твои траты.';
  } else if (pct > 100) {
    verdict = 'Тратишь больше дохода! Это критично — нужно срочно сокращать расходы.';
  } else if (pct > 80) {
    verdict = 'Тратишь ' + pct + '% дохода — многовато. Мало что остаётся на накопления.';
  } else if (pct > 60) {
    verdict = 'Нормально, но есть потенциал для оптимизации.';
  } else {
    verdict = 'Отлично! Тратишь только ' + pct + '% дохода.';
  }
  return {
    html: '<b>Траты за месяц:</b> ' + ctx.fmt(monthSpend) + '<br>' +
      'Доход: ' + ctx.fmt(income) + '<br>' +
      'Итого: ' + (saved >= 0 ? '+' : '') + ctx.fmt(saved) + ' (' + (saved >= 0 ? 'экономия' : 'дефицит') + ')<br><br>' +
      '<b>Вердикт:</b> ' + verdict,
    chips: [
      {label: 'Где утечки?', query: 'Где утечки в моём бюджете?'},
      {label: 'Как сократить?', query: 'Как сократить траты?'},
      {label: 'Правило 50/30/20', query: 'Как работает 50/30/20?'}
    ]
  };
};

// --- PAYDAY ---
handlers.payday = function(q, D, ctx) {
  var dl = ctx.calcDailyLimit();
  var rw = ctx.cashRunway();
  return {
    html: '<b>До зарплаты:</b> ' + dl.daysLeft + ' дн.<br>' +
      'Дневной лимит: ' + ctx.fmt(dl.perDay) + '<br>' +
      'Запас хода: ' + rw + ' дн.<br><br>' +
      '<b>Совет:</b> ' + (dl.perDay > 2000 ? 'Можешь позволить себе чуть больше, но не забывай про цели.' :
      'Экономь — дни до зарплаты длинные. Придержи крупные покупки.'),
    chips: [
      {label: 'Могу купить за 3000₽?', query: 'Могу купить за 3000₽?'},
      {label: 'Что если сокращу кафе?', query: 'Что будет, если я урежу кафе на 30%?'}
    ]
  };
};

// --- DAILY ---
handlers.daily = function(q, D, ctx) {
  var dl = ctx.calcDailyLimit();
  return {
    html: 'Сегодня можно потратить <b>' + ctx.fmt(dl.perDay) + '</b> — и до зарплаты (' + dl.daysLeft + ' дн.) всё будет в плюсе.<br><br>' +
      '<b>Как считается:</b> (остаток − обязательные платежи на оставшиеся дни) ÷ дней до зарплаты.',
    chips: [
      {label: 'Могу купить за 1000₽?', query: 'Могу купить за 1000₽?'},
      {label: 'Как увеличить лимит?', query: 'Как увеличить дневной лимит?'}
    ]
  };
};

// --- SCENARIO ---
handlers.scenario = function(q, D, ctx) {
  var amount = extractAmount(q);
  var catMatch = q.match(/(кафе|ресторан|продукт|самокат|такси|подписк|развлечен|личн|одежд|транспорт|связ)/i);
  var catMap = {
    'кафе':'cafe','ресторан':'cafe','продукт':'grocery','самокат':'scooters',
    'такси':'taxi','подписк':'subs','развлечен':'fun','личн':'personal',
    'одежд':'personal','транспорт':'transport','связ':'home'
  };
  var catId = catMatch ? (catMap[catMatch[1].toLowerCase()] || 'cafe') : 'cafe';
  var catSum = 0;
  var mNow = new Date(); mNow = new Date(mNow.getFullYear(), mNow.getMonth(), 1);
  var allSp = ctx.allSpends();
  for (var i = 0; i < allSp.length; i++) {
    if (allSp[i].d >= mNow && (allSp[i].cat || 'other') === catId) catSum += allSp[i].s;
  }
  if (amount === 0) amount = Math.round(catSum * 0.3);
  if (amount <= 0) amount = 1000;
  var sim = ctx.whatIf(amount);
  var catName = ctx.catById(catId);
  return {
    html: '<b>Сценарий: урезать «' + catName + '» на ' + ctx.fmt(amount) + '</b><br><br>' +
      'Сейчас: ' + ctx.fmt(catSum) + ' за месяц.<br>' +
      'Эффект на 90 дней: минимум баланса ' +
      '<b style="color:' + (sim.diff > 0 ? 'var(--grn)' : 'var(--red)') + '">' +
      ctx.fmt(sim.newMin) + '</b> (было ' + ctx.fmt(sim.originalMin) + ', ' +
      (sim.diff > 0 ? '+' : '') + ctx.fmt(sim.diff) + ')<br><br>' +
      (sim.diff > 0 ?
        'Это добавит ' + ctx.fmt(sim.diff) + ' к минимальному балансу. Хороший шаг!' :
        'Это ухудшит ситуацию на ' + ctx.fmt(Math.abs(sim.diff)) + '. Лучше урежь другую категорию.'),
    chips: [
      {label: 'Другая категория', query: 'Что будет, если я урежу самокаты на 50%?'},
      {label: 'Могу ли я это?', query: 'Могу ли я это потянуть?'}
    ]
  };
};

// --- HEALTH ---
handlers.health = function(q, D, ctx) {
  var score = ctx.calcRiskScore();
  var income = D.income || 0;
  var debts = D.credits || [];
  var totalDebt = 0;
  for (var i = 0; i < debts.length; i++) totalDebt += debts[i].cur || 0;
  var cushion = 0;
  var goals = D.goals || [];
  for (var j = 0; j < goals.length; j++) {
    if (/подушк/i.test(goals[j].n || '')) cushion = goals[j].cur || 0;
  }
  var monthSpend = ctx.monthSpend || income * 0.8;
  var details = '';
  if (income > 0) {
    var savingsRate = Math.round((income - monthSpend) / income * 100);
    details += '• Норма сбережений: ' + savingsRate + '% ' + (savingsRate >= 20 ? '✓' : '✗') + '<br>';
  }
  details += '• Долги: ' + ctx.fmt(totalDebt) + ' ' + (totalDebt === 0 ? '✓' : '✗') + '<br>';
  details += '• Подушка: ' + ctx.fmt(cushion) + ' (~' + (monthSpend > 0 ? (cushion / monthSpend).toFixed(1) : '0') + ' мес.)<br>';
  details += '• Прогноз: ' + (ctx.minBalance(90).val >= 0 ? 'стабилен ✓' : 'уходит в минус ✗') + '<br>';
  return {
    html: '<b>Финансовое здоровье: ' + score.grade + ' (' + score.score + '/100)</b><br><br>' + details + '<br>' +
      '<b>Рекомендации:</b><br>' +
      (score.score < 50 ? '• Сфокусируйся на подушке безопасности<br>• Сократи гибкие траты<br>• Погашай долги агрессивнее' :
       score.score < 75 ? '• Увеличь норму сбережений до 20%<br>• Рассмотри инвестиции<br>• Проверь подписки' :
       '• Отличное здоровье! Рассмотри инвестиции<br>• Оптимизируй налоги<br>• Поставь амбициозные финансовые цели'),
    chips: [
      {label: 'Как улучшить?', query: 'Как улучшить финансовое здоровье?'},
      {label: 'План погашения долгов', query: 'Как быстрее закрыть долги?'},
      {label: 'Инвестиции', query: 'С чего начать инвестировать?'}
    ]
  };
};

// --- EDUCATION ---
handlers.education = function(q, D, ctx) {
  var qLower = q.toLowerCase();
  if (/бюджет|50.?30.?20|распредел/i.test(qLower)) {
    return {
      html: '<b>Правило 50/30/20</b><br><br>' +
        'Распредели свой доход:<br>' +
        '• <b>50%</b> — Обязательные: аренда/ипотека, еда, транспорт, связь, страхование<br>' +
        '• <b>30%</b> — Гибкие: кафе, развлечения, подписки, одежда, хобби<br>' +
        '• <b>20%</b> — Накопления и долги: подушка, инвестиции, досрочное погашение<br><br>' +
        '<b>Пример:</b> Доход 80 000₽ → 40 000 обязательных, 24 000 гибких, 16 000 накопления.',
      chips: [
        {label: 'Мой бюджет', query: 'Как мой бюджет?'},
        {label: 'Как сократить обязательные?', query: 'Как сократить расходы?'}
      ]
    };
  }
  if (/долг|кредит|snow|avalanche/i.test(qLower)) {
    return {
      html: '<b>Два метода погашения долгов:</b><br><br>' +
        '<b>1. Сноуболл (Snowball)</b> — гаси самый маленький долг первым.<br>' +
        'Плюс: быстрые победы мотивируют.<br><br>' +
        '<b>2. Авалинх (Avalanche)</b> — гаси самый дорогой долг (с высоким %) первым.<br>' +
        'Плюс: меньше переплат.<br><br>' +
        '<b>Какой выбрать?</b> Если нужна мотивация — сноуболл. Если хочешь сэкономить — авалинх.',
      chips: [
        {label: 'Мой план погашения', query: 'Как быстрее закрыть мои долги?'},
        {label: 'Стоит ли гасить досрочно?', query: 'Стоит ли гасить кредит досрочно?'}
      ]
    };
  }
  if (/инвест|влож|акци|бирж/i.test(qLower)) {
    return {
      html: '<b>Инвестиции для начинающих:</b><br><br>' +
        '1. <b>ИИС</b> — налоговый вычет до 52 000₽/год<br>' +
        '2. <b>Индексные фонды</b> (S&P 500, MOEX) — средняя доходность 8-12% годовых<br>' +
        '3. <b>Облигации</b> — стабильный доход 8-15% годовых<br>' +
        '4. <b>Депозит</b> —.safe, но доходность ниже инфляции<br><br>' +
        '<b>Правило диверсификации:</b> не клади всё в один актив. Раздели: 40% облигации, 40% акции, 20% депозит.',
      chips: [
        {label: 'Что такое ИИС?', query: 'Что такое ИИС?'},
        {label: 'Какие ETF выбрать?', query: 'Какие ETF выбрать?'}
      ]
    };
  }
  // Default education
  return {
    html: '<b>Основы финансовой грамотности:</b><br><br>' +
      '• <b>50/30/20</b> — правило распределения дохода<br>' +
      '• <b>Подушка безопасности</b> — 3-6 месяцев расходов на всякий случай<br>' +
      '• <b>Долги</b> — гаси дорогие первыми<br>' +
      '• <b>Инвестиции</b> — начни с ИИС и индексных фондов<br>' +
      '• <b>Автоплатежи</b> — настрой автоматические переводы на сбережения<br><br>' +
      'Задай конкретный вопрос — расскажу подробнее!',
    chips: [
      {label: '50/30/20', query: 'Как работает правило 50/30/20?'},
      {label: 'Долги', query: 'Как погасить долги?'},
      {label: 'Инвестиции', query: 'С чего начать инвестировать?'}
    ]
  };
};

// --- SETUP ---
handlers.setup = function(q, D, ctx) {
  var st = ctx.setupState();
  var sNames = {
    inc: 'доход и день зарплаты',
    bal: 'текущий баланс',
    pay: 'обязательные платежи',
    env: 'первый конверт'
  };
  var missing = [];
  for (var k in st.st) { if (!st.st[k]) missing.push(sNames[k]); }
  if (missing.length === 0) {
    return {
      html: 'Всё настроено! Дальше просто: добавляй траты кнопкой «Трата», а я буду держать прогноз и предупреждать о рисках.',
      chips: [
        {label: 'Добавить трату', query: 'Как добавить трату?'},
        {label: 'Что важно сейчас?', query: 'Что важно сейчас?'}
      ]
    };
  }
  return {
    html: '<b>Настройка: ' + st.done + ' из ' + st.total + '</b><br><br>' +
      'Осталось указать: ' + missing.join(', ') + '.<br><br>' +
      'Чек-лист — вверху Панели, каждый шаг занимает секунды.',
    chips: [
      {label: 'Указать доход', query: 'Как настроить доход?'},
      {label: 'Добавить платёж', query: 'Как добавить платёж?'}
    ]
  };
};

// --- MONTH ---
handlers.month = function(q, D, ctx) {
  var income = D.income || 0;
  var spent = ctx.monthSpend;
  var saved = income - spent;
  var pct = income > 0 ? Math.round(spent / income * 100) : 0;
  return {
    html: '<b>Итоги месяца:</b><br><br>' +
      'Потрачено: ' + ctx.fmt(spent) + '<br>' +
      'Доход: ' + ctx.fmt(income) + '<br>' +
      (saved >= 0 ? 'Сэкономлено: ' : 'Перерасход: ') + ctx.fmt(Math.abs(saved)) + ' (' + pct + '%)<br><br>' +
      (saved >= 0 ? 'Отличный результат! Продолжай в том же духе.' :
       'Расходы превысили доход. Посмотри, где можно сократить.'),
    chips: [
      {label: 'Где утечки?', query: 'Где утечки в моём бюджете?'},
      {label: 'Как сократить?', query: 'Как сократить траты?'}
    ]
  };
};

// --- SIGNALS ---
handlers.signals = function(q, D, ctx) {
  var sigs = ctx.getSignals();
  if (sigs.length === 0) {
    return {
      html: 'Сейчас всё спокойно. Так держать!',
      chips: [
        {label: 'Финансовое здоровье', query: 'Оцени моё финансовое состояние'},
        {label: 'Совет по бюджету', query: 'Как составить бюджет?'}
      ]
    };
  }
  var html = '<b>Что важно сейчас:</b><br><br>';
  for (var i = 0; i < sigs.length; i++) {
    var s = sigs[i];
    html += '• <b style="color:' + (s.sev >= 8 ? 'var(--red)' : s.sev >= 5 ? 'var(--org)' : 'var(--blu)') + '">' +
      ctx.esc(s.title) + '</b> — ' + ctx.esc(s.desc) +
      (s.benefit ? ' · выгода ' + ctx.fmt(s.benefit) + '/мес' : '') + '<br>';
  }
  return {
    html: html,
    chips: [
      {label: 'Разобрать первый', query: 'Расскажи подробнее о первом сигнале'},
      {label: 'Финансовое здоровье', query: 'Оцени моё финансовое состояние'}
    ]
  };
};

// --- GENERAL (fallback) ---
handlers.general = function(q, D, ctx) {
  var hasData = (D.income || 0) > 0 || (D.spends || []).length > 3;
  if (!hasData) {
    return {
      html: 'Я не совсем понял вопрос. Вот что я умею:<br><br>' +
        '• Помочь с бюджетом<br>• Разобраться с долгами<br>• Научить копить<br>• Оценить подписки<br>• Спросить «могу ли я купить?»<br><br>' +
        'Попробуй перефразировать или выбери тему ниже.',
      chips: [
        {label: 'Как составить бюджет?', query: 'Как составить бюджет?'},
        {label: 'Помоги с долгами', query: 'Как быстрее закрыть долги?'},
        {label: 'Финансовое здоровье', query: 'Оцени моё финансовое состояние'}
      ]
    };
  }
  // With data: ask a clarifying question
  var questions = [
    'Расскажи подробнее: тебя интересует бюджет, долги, накопления или что-то другое?',
    'Хочешь обсудить конкретную ситуацию? Например: «Могу ли я купить X?» или «Как сократить траты?»',
    'Мне нужен чуть более конкретный вопрос. Попробуй: «Как мой бюджет?», «Как закрыть долги?» или «Что важно сейчас?»'
  ];
  var qIdx = Math.floor(Math.random() * questions.length);
  return {
    html: questions[qIdx],
    chips: [
      {label: 'Как мой бюджет?', query: 'Как мой бюджет?'},
      {label: 'Что важно сейчас?', query: 'Что важно сейчас?'},
      {label: 'Могу ли я купить?', query: 'Могу купить за 5000₽?'}
    ]
  };
};

// ===== MAIN API =====
function processQuery(query, D, helpers) {
  var intent = classifyIntent(query);
  var handler = handlers[intent] || handlers.general;

  // Build context from D and helpers
  var ctx = {
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
    catById: helpers.catById,
    hasIncome: (D.income || 0) > 0,
    monthSpend: (function() {
      var now = new Date();
      var from = new Date(now.getFullYear(), now.getMonth(), 1);
      var total = 0;
      var all = helpers.allSpends();
      for (var i = 0; i < all.length; i++) { if (all[i].d >= from) total += all[i].s; }
      return total;
    })(),
    essentialSpend: (function() {
      var now = new Date();
      var from = new Date(now.getFullYear(), now.getMonth(), 1);
      var total = 0;
      var all = helpers.allSpends();
      var fixedCats = ['home', 'subs', 'transport', 'grocery'];
      for (var i = 0; i < all.length; i++) {
        if (all[i].d >= from && fixedCats.indexOf(all[i].cat || 'other') !== -1) total += all[i].s;
      }
      return total;
    })()
  };

  return handler(query, D, ctx);
}

// Expose globally
window.Copilot = {
  process: processQuery,
  classify: classifyIntent,
  handlers: handlers
};

})();
