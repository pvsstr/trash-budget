
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

var app = initializeApp({apiKey:"AIzaSyBrK9eZknNE3UBniVU2cnKUtwSOXnl_y2g",authDomain:"trash-budget-737fd.firebaseapp.com",projectId:"trash-budget-737fd",storageBucket:"trash-budget-737fd.firebasestorage.app",messagingSenderId:"996241413300",appId:"1:996241413300:web:ca7c0668e67f570c7373e1"});
var auth = getAuth(app);
var db = getFirestore(app);
var prov = new GoogleAuthProvider();
var uid = null;
var viewOff = 0;
var pMode = 'm';
var pOff = 0;
var catTouched = false;
var MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
var MONTHS_S = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

function $(id){ return document.getElementById(id); }
function fmt(n){ return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Math.round(n)) + ' ₽'; }
function iso(dt){ return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
function parseD(s){
  if(!s){ return new Date(2026,0,1); }
  if(s.length <= 5){ var p=s.split('.'); return new Date(2026, +p[1]-1, +p[0]); }
  var q=s.split('-'); return new Date(+q[0], +q[1]-1, +q[2]);
}
function addM(dt, k){ return new Date(dt.getFullYear(), dt.getMonth()+k, dt.getDate()); }
function cycleStart(dt){
  if(dt.getDate() >= 20){ return new Date(dt.getFullYear(), dt.getMonth(), 20); }
  return new Date(dt.getFullYear(), dt.getMonth()-1, 20);
}
function cycLabel(cs){
  var ce = addM(cs,1);
  return cs.getDate()+'.'+String(cs.getMonth()+1).padStart(2,'0')+' – '+String(ce.getDate()-1).padStart(2,'0')+'.'+String(ce.getMonth()+1).padStart(2,'0')+'.'+ce.getFullYear();
}
function toast(m){ var t=document.createElement('div'); t.className='toast'; t.textContent=m; document.body.appendChild(t); setTimeout(function(){ t.remove(); },2500); }

var CATS = [
 {id:'grocery', n:'Продукты', i:'i-cart', k:'c-grn'},
 {id:'cafe', n:'Кафе и доставка', i:'i-coffee', k:'c-red'},
 {id:'scooters', n:'Самокаты / каршеринг', i:'i-scoot', k:'c-org'},
 {id:'transport', n:'Транспорт / электричка', i:'i-train', k:'c-blu'},
 {id:'taxi', n:'Такси', i:'i-taxi', k:'c-blu'},
 {id:'home', n:'Жильё и коммунальные', i:'i-home', k:'c-pur'},
 {id:'subs', n:'Подписки', i:'i-sub', k:'c-blu'},
 {id:'health', n:'Здоровье', i:'i-med', k:'c-red'},
 {id:'fun', n:'Развлечения', i:'i-fun', k:'c-pur'},
 {id:'clothes', n:'Одежда', i:'i-shirt', k:'c-org'},
 {id:'personal', n:'Личное', i:'i-user', k:'c-pur'},
 {id:'other', n:'Прочее', i:'i-gift', k:'c-pur'}];
function catById(id){ for(var i=0;i<CATS.length;i++){ if(CATS[i].id===id){ return CATS[i]; } } return CATS[11]; }
var CAT2ENV = {grocery:'Продукты',cafe:'Кафе',scooters:'Самокаты',taxi:'Такси',transport:'Тройка',home:'Аренда',subs:'Личное',health:'Личное',fun:'Личное',clothes:'Личное',personal:'Личное',other:'Личное'};
var TX2CAT = {'КАФЕ':'cafe','ПРОДУКТЫ':'grocery','УТЕЧКИ':'scooters','ТРАНСПОРТ':'transport','ТАКСИ':'taxi','ЖИЛЬЁ':'home','ЛИЧНОЕ':'personal','ПОДПИСКИ':'subs','ПЕРЕВОДЫ':'home'};
var KEYCAT = [
 ['scooters',['самокат','scooter','whoosh','urent','урент','citydrive','ситидрайв']],
 ['taxi',['такси','taxi','бериза','bamboo']],
 ['transport',['тройк','troika','tutu','туту','электрич','поезд','автобус','метро']],
 ['subs',['подписк','telegram','телеграм','иви','yandex plus','яндекс плюс','netflix','spotify']],
 ['health',['аптек','aptek','pharmacy','лекарств','врач','клиник','больниц']],
 ['clothes',['одежд','обув','sportmaster','спортмастер','new yorker','куртк','футболк']],
 ['cafe',['кафе','cafe','кофейн','coffee','пышк','пицц','pizza','dodo','додо','ресторан','столов','доставк','бургер','burger','суши','шаурм','вкусно и точка','хочу пышку','еда']],
 ['grocery',['пятероч','pyateroch','магнит','magnit','перекрест','perekrest','ашан','auchan','вкуствил','vkusvill','мерко','merko','fix price','фикс','продукт','маркет','market','лента','дикси']],
 ['home',['аренд','коммунал','жкх','квартплат']],
 ['personal',['подарк','цвет','салон','барбер','парикм','космет','книг']]];

function autoCat(t){
  var s = (' '+t.toLowerCase()+' ');
  for(var i=0;i<KEYCAT.length;i++){
    var kw = KEYCAT[i][1];
    for(var j=0;j<kw.length;j++){ if(s.indexOf(kw[j]) !== -1){ return KEYCAT[i][0]; } }
  }
  return 'other';
}

var LESSONS = [
{id:1,t:'Подушка безопасности',x:'Это 3–6 месяцев обязательных трат (аренда, еда, транспорт) на отдельном счёте. Она защищает от кредиток при форс-мажоре. Начните с 10% дохода в месяц — первые 20 000 ₽ дают спокойствие.'},
{id:2,t:'Платите себе первыми',x:'В день зарплаты сразу переводите план в накопления, до любых трат. Тратите то, что осталось — а не наоборот. Это главное правило богатства.'},
{id:3,t:'Лавина долгов',x:'Гасите сначала долг с самой высокой ставкой. Кредитка выгодна только при полном погашении в грейс-период, иначе ~40% годовых съедают бюджет.'},
{id:4,t:'Метод конвертов',x:'Разделите деньги по категориям с лимитами сразу после зарплаты. Конверт пуст — траты в категории стоп до следующего цикла. В этом приложении конверты живут в разделе «Бюджет».'},
{id:5,t:'Правило 24 часов',x:'Любое незапланированное желание дороже 500 ₽ — ждите сутки и согласуйте с Копилотом. В 70% случаев желание уходит, деньги остаются на отпуске.'},
{id:6,t:'Аудит подписок',x:'Раз в месяц смотрите все автоплатежи. Треть не используется — это до 10 000 ₽ в год скрытых потерь. Отключайте прямо в разделе «Бюджет».'},
{id:7,t:'Обязательное и гибкое',x:'Аренда и подписки урезать трудно. Кафе, самокаты, такси — гибкие траты, именно там живёт экономия. Управляйте ими дневным лимитом из утреннего дайджеста.'},
{id:8,t:'Рассрочка без ловушек',x:'Рассрочка безопасна, только если платёж уже вписан в бюджет и не вытесняет конверты. Проверяйте до, а не после. График ваших рассрочек — в разделе «Бюджет».'}];

var DEMO = {demo:true, income:114493, salaryDay:20, baseBalance:0,
goals:{cushion:0, cushionT:100000, vacation:0, vacationT:200000},
spends:[], incomes:[],
envs:[
{n:'Аренда + КУ', ic:'i-home', k:'c-pur', lim:65000},
{n:'Электричка экспресс', ic:'i-train', k:'c-blu', lim:8100},
{n:'Продукты', ic:'i-cart', k:'c-grn', lim:18000},
{n:'Кафе и рестораны', ic:'i-coffee', k:'c-red', lim:3000},
{n:'Самокаты и каршеринг', ic:'i-scoot', k:'c-red', lim:2500},
{n:'Такси', ic:'i-taxi', k:'c-blu', lim:1500},
{n:'Тройка и транспорт', ic:'i-train', k:'c-blu', lim:1500},
{n:'Личное и прочее', ic:'i-gift', k:'c-pur', lim:3000},
{n:'Погашение кредитки Альфа', ic:'i-shield', k:'c-grn', lim:6000},
{n:'Микро-подушка', ic:'i-target', k:'c-pur', lim:2000}],
pays:[
{d:20, n:'Аренда + КУ', s:63500},
{d:21, n:'Симка своя', s:300},
{d:22, n:'Симка жены', s:300},
{d:23, n:'Интернет', s:610}],
subs:[{n:'Telegram Premium', s:299, off:0},{n:'Яндекс Плюс', s:449, off:0},{n:'Getcontact', s:299, off:1},{n:'ivi.ru', s:99, off:1},{n:'Привилегии M', s:399, off:1}],
leaks:[
{n:'Самокаты и каршеринг', s:4700, tx:96, adv:'Лимит 2 500 ₽/мес: часть поездок заменяйте электричкой и Тройкой.'},
{n:'Кафе сверх лимита', s:7600, tx:41, adv:'Правило 24 часов: желания дороже 500 ₽ согласовывайте с Копилотом.'},
{n:'Подписки к отключению', s:797, tx:3, adv:'Getcontact, ivi и Привилегии M отключаются в разделе «Бюджет» за минуту.'}],
tx:[]};
var D = DEMO;

var TIPS = [
'Подушка безопасности = 3–6 месяцев обязательных трат. Начните с 10%.',
'Мелкие траты 100–200 ₽ незаметны, но 5 таких в день = 15 000 ₽ в месяц.',
'Подписки — тихая утечка. Раз в месяц просматривайте автоплатежи.',
'Платите себе первыми: в день зарплаты сразу переводите 10% в накопления.',
'Кредитка выгодна только при полном погашении в грейс-период.',
'Конверт пуст — трата стоп. Правило работает без силы воли.'];

function save(){ if(uid){ setDoc(doc(db,'users',uid), {data:D}, {merge:true}); } }

function normalize(){
  D.spends=D.spends||[]; D.incomes=D.incomes||[]; D.tx=D.tx||[];
  D.subs=D.subs||[]; D.pays=D.pays||[]; D.envs=D.envs||[]; D.leaks=D.leaks||[];
  var i;
  for(i=0;i<D.subs.length;i++){ D.subs[i].id=D.subs[i].id||i+1; }
  for(i=0;i<D.pays.length;i++){ D.pays[i].id=D.pays[i].id||i+100; }
  for(i=0;i<D.envs.length;i++){ D.envs[i].id=D.envs[i].id||i+1; }
  for(i=0;i<D.leaks.length;i++){ D.leaks[i].id=D.leaks[i].id||i+1; D.leaks[i].fixed=D.leaks[i].fixed||0; }
  D.pays = D.pays.filter(function(x){ return x.n.indexOf('Рассрочка')===-1; });
  if(!D.credits){
    D.credits=[{id:1,n:'Кредитка Т-Банк',total:105766,cur:(D.debts&&D.debts.b)||105766},{id:2,n:'Кредитка Альфа',total:18200,cur:(D.debts&&D.debts.a)||18200}];
  }
  if(!D.insts){
    D.insts=[{id:1,n:'Рассрочка',d:'2026-08-23',s:5000},{id:2,n:'Рассрочка',d:'2026-09-23',s:12000},{id:3,n:'Рассрочка',d:'2026-10-23',s:12000},{id:4,n:'Рассрочка',d:'2026-11-23',s:12000},{id:5,n:'Рассрочка',d:'2026-12-23',s:12000},{id:6,n:'Рассрочка (финал)',d:'2027-01-23',s:4624}];
  }
  D.learned=D.learned||[];
  D.goals=D.goals||{cushion:0,cushionT:100000,vacation:0,vacationT:200000};
}

function allSpends(){
  var arr = []; var i;
  for(i=0;i<(D.spends||[]).length;i++){
    var sp = D.spends[i];
    arr.push({d:parseD(sp.d), s:sp.s, n:sp.n, cat:sp.cat, id:sp.id, manual:1});
  }
  for(i=0;i<(D.tx||[]).length;i++){
    var t = D.tx[i];
    if(t.s < 0 || t.refund){ arr.push({d:parseD(t.d), s:-t.s, n:t.n, cat:TX2CAT[t.c]||t.c||'other'}); }
  }
  return arr;
}
function sums(){
  var si=0, ss=0, i;
  for(i=0;i<(D.incomes||[]).length;i++){ si += D.incomes[i].s; }
  for(i=0;i<(D.spends||[]).length;i++){ ss += D.spends[i].s; }
  return {inc:si, spend:ss};
}
function realBal(){ var t = sums(); return (D.baseBalance||0) + t.inc - t.spend; }
function inCycle(dt, cs){ var ce = addM(cs,1); return dt >= cs && dt < ce; }

function nextPay(days){
  var now = new Date(); var sum = 0; var i;
  for(i=0;i<D.pays.length;i++){
    var diff = (D.pays[i].d - now.getDate() + 31) % 31;
    if(diff <= days){ sum += D.pays[i].s; }
  }
  for(i=0;i<D.insts.length;i++){
    var dd = parseD(D.insts[i].d);
    var d2 = Math.round((dd - now) / 864e5);
    if(d2 >= 0 && d2 <= days){ sum += D.insts[i].s; }
  }
  return sum;
}

// РАСЧЕТЫ ДЛЯ НОВОГО ДАШБОРДА
function calcMonthlyFixedPay() {
  var paysSum = 0;
  for (var i = 0; i < D.pays.length; i++) { paysSum += D.pays[i].s; }
  for (var j = 0; j < D.subs.length; j++) { if (!D.subs[j].off) paysSum += D.subs[j].s; }
  return paysSum;
}

function calcSafeBalance() {
  var real = realBal();
  var upcomingPay = nextPay(30);
  return Math.max(0, real - upcomingPay);
}

function calcDailyLimit() {
  var safe = calcSafeBalance();
  var now = new Date();
  var salaryDay = D.salaryDay || 20;
  var daysLeft = ((salaryDay - now.getDate()) + 30) % 30 || 30;
  return { perDay: Math.round(safe / daysLeft), daysLeft: daysLeft };
}

function calcHealthScore() {
  var score = 50;
  var safe = calcSafeBalance();
  var cushion = (D.goals && D.goals.cushion) || 0;
  var cushionTarget = (D.goals && D.goals.cushionT) || 100000;
  score += Math.min(30, Math.round((cushion / cushionTarget) * 30));
  if (safe > 0) score += 20;
  var activeLeaks = D.leaks ? D.leaks.filter(function(x) { return !x.fixed; }).length : 0;
  score -= (activeLeaks * 7);
  return Math.max(10, Math.min(100, score));
}

function ensureSalary(){
  if(!D.incomes){ D.incomes = []; }
  var cs = cycleStart(new Date());
  var ck = cs.getFullYear()+'-'+cs.getMonth();
  if(D.removedAuto && D.removedAuto.indexOf(ck) !== -1){ return; }
  var has = false;
  for(var i=0;i<D.incomes.length;i++){ if(D.incomes[i].auto && D.incomes[i].ck === ck){ has = true; } }
  if(!has){
    D.incomes.push({id:Date.now(), d:iso(cs), n:'Заработная плата', s:D.income, auto:1, ck:ck});
    save();
  }
}
function periodRange(){
  var now = new Date(); var y = now.getFullYear(), m = now.getMonth();
  var from, to, label;
  if(pMode === 'm'){ from = new Date(y, m+pOff, 1); to = new Date(y, m+pOff+1, 1); label = MONTHS[from.getMonth()]+' '+from.getFullYear(); }
  else if(pMode === 'q'){ from = new Date(y, m+pOff-2, 1); to = new Date(y, m+pOff+1, 1); label = MONTHS_S[from.getMonth()]+' – '+MONTHS_S[(to.getMonth()+11)%12]+' '+to.getFullYear(); }
  else if(pMode === 'y'){ var yy = y+pOff; from = new Date(yy,0,1); to = new Date(yy+1,0,1); label = ''+yy; }
  else { from = new Date(2026,0,1); to = new Date(y+1,0,1); label = 'Всё время'; }
  return {from:from, to:to, label:label};
}

function rowHtml(k, v){ return '<div class="sh-row"><span>'+k+'</span><b>'+v+'</b></div>'; }
function tipHtml(t){ return '<div class="sh-tip">'+t+'</div>'; }
function sheetHead(ic, k, t, s){
  return '<div class="sh-h"><div class="sic '+k+'"><svg class="ic"><use href="#'+ic+'"/></svg></div><div><b>'+t+'</b><span>'+s+'</span></div><button class="sh-x" data-act="close"><svg class="ic" style="width:16px;height:16px"><use href="#i-x"/></svg></button></div>';
}
function closeSheet(){ $('sheet').classList.remove('on'); $('shb').classList.remove('on'); }

function openSheet(t, i){
  var h = '';
  if(t === 'balance'){
    h = sheetHead('i-wallet','c-blu','Реальный остаток','поступления − траты')
      + rowHtml('Сейчас', fmt(realBal()))
      + rowHtml('Платежи на 30 дней', fmt(nextPay(30)))
      + rowHtml('Безопасно к трате', fmt(calcSafeBalance()))
      + '<button class="sh-btn" data-act="balance-edit">Обновить базовый баланс</button>';
  } else if(t === 'cycle-detail'){
    var now = new Date();
    var cs = cycleStart(now);
    var daily = calcDailyLimit();
    h = sheetHead('i-cal','c-pur','Цикл зарплаты', cycLabel(cs))
      + rowHtml('Дней до зарплаты', daily.daysLeft + ' дн.')
      + rowHtml('Дневной лимит', fmt(daily.perDay))
      + rowHtml('Чистый остаток', fmt(calcSafeBalance()))
      + tipHtml('Расчёт привязан к вашей зарплате '+D.salaryDay+'-го числа.');
  } else if(t === 'upcoming-detail'){
    h = sheetHead('i-card','c-blu','Платежи на 3 дня', fmt(nextPay(3)))
      + rowHtml('Ближайшие 3 дня', fmt(nextPay(3)))
      + rowHtml('За весь текущий месяц', fmt(nextPay(30)))
      + tipHtml('Контролируйте списания, чтобы не выходить за лимиты.');
  } else if(t === 'goals'){
    var cushion = (D.goals && D.goals.cushion) || 0;
    var vacation = (D.goals && D.goals.vacation) || 0;
    h = sheetHead('i-target','c-pur','Цели и копилки','накопления')
      + rowHtml('Подушка безопасности', fmt(cushion))
      + rowHtml('Копилка на отпуск', fmt(vacation))
      + rowHtml('Всего накоплено', fmt(cushion + vacation))
      + '<button class="sh-btn" data-act="edit" data-t="goal">Изменить цели</button>';
  } else if(t === 'income'){
    h = sheetHead('i-wallet','c-grn','Доход', fmt(D.income)+' в месяц')
      + rowHtml('Зарплата', D.salaryDay+'-го числа, авто')
      + '<div class="form" style="margin-top:12px"><input class="inp" id="in1" type="number" value="'+D.income+'" placeholder="Зарплата, ₽"><input class="inp" id="in2" type="number" value="'+D.salaryDay+'" placeholder="День зарплаты"></div>'
      + '<button class="sh-btn" data-act="income-edit">Сохранить</button>';
  } else if(t === 'leaks'){
    var act = D.leaks.filter(function(x){ return !x.fixed; });
    var ls = 0; var lr = '';
    for(var l=0;l<act.length;l++){ ls += act[l].s; lr += rowHtml(act[l].n, fmt(act[l].s)+'/мес'); }
    h = sheetHead('i-shield','c-red','Утечки', fmt(ls)+' в месяц активных') + (lr || rowHtml('Активных утечек нет','—'));
  } else if(t === 'tip'){
    h = sheetHead('i-cap','c-pur','Финграмотность','совет дня')
      + '<p style="font-size:14px">'+TIPS[new Date().getDate() % TIPS.length]+'</p>'
      + '<button class="sh-btn" data-act="nexttip">Следующий совет</button>';
  }
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on');
  $('shb').classList.add('on');
}

function openEdit(t, i){
  var it = null; var h = ''; var title = '';
  function get(arr){ for(var k=0;k<arr.length;k++){ if(arr[k].id === i){ return arr[k]; } } return null; }
  if(t==='sub'){ it = i?get(D.subs):null; title = it?'Подписка':'Новая подписка';
    h = '<div class="form"><input class="inp" id="in1" placeholder="Название" value="'+(it?it.n:'')+'"><input class="inp" id="in2" type="number" placeholder="Сумма в месяц, ₽" value="'+(it?it.s:'')+'"></div>';
  }
  if(t==='pay'){ it = i?get(D.pays):null; title = it?'Платёж':'Новый платёж';
    h = '<div class="form"><input class="inp" id="in1" placeholder="Название" value="'+(it?it.n:'')+'"><div class="row2"><input class="inp" id="in2" type="number" placeholder="Сумма, ₽" value="'+(it?it.s:'')+'"><input class="inp" id="in3" type="number" placeholder="День (1-31)" value="'+(it?it.d:'')+'"></div></div>';
  }
  if(t==='cred'){ it = i?get(D.credits):null; title = it?'Кредит':'Новый кредит';
    h = '<div class="form"><input class="inp" id="in1" placeholder="Название" value="'+(it?it.n:'')+'"><div class="row2"><input class="inp" id="in2" type="number" placeholder="Текущий долг, ₽" value="'+(it?it.cur:'')+'"><input class="inp" id="in3" type="number" placeholder="Итоговая сумма, ₽" value="'+(it?it.total:'')+'"></div></div>';
  }
  if(t==='inst'){ it = i?get(D.insts):null; title = it?'Рассрочка':'Новая рассрочка';
    h = '<div class="form"><input class="inp" id="in1" placeholder="Название" value="'+(it?it.n:'')+'"><div class="row2"><input class="inp" id="in2" type="number" placeholder="Платёж, ₽" value="'+(it?it.s:'')+'"><input class="inp" id="in3" type="date" value="'+(it?it.d:'')+'"></div></div>';
  }
  if(t==='env'){ it = i?get(D.envs):null; title = it?it.n:'Конверт';
    h = '<div class="form"><input class="inp" id="in2" type="number" placeholder="Лимит в месяц, ₽" value="'+(it?it.lim:'')+'"></div>';
  }
  if(t==='goal'){ title = 'Цели и копилки';
    h = '<div class="form"><div class="row2"><input class="inp" id="in1" type="number" placeholder="Подушка: есть, ₽" value="'+D.goals.cushion+'"><input class="inp" id="in2" type="number" placeholder="Подушка: цель, ₽" value="'+D.goals.cushionT+'"></div><div class="row2"><input class="inp" id="in3" type="number" placeholder="Отпуск: есть, ₽" value="'+D.goals.vacation+'"><input class="inp" id="in4" type="number" placeholder="Отпуск: цель, ₽" value="'+D.goals.vacationT+'"></div></div>';
  }
  window._ef = {t:t, id:i};
  $('sheetBody').innerHTML = sheetHead('i-target','c-pur', title, 'редактирование')
    + h
    + '<button class="sh-btn" data-act="form-save">Сохранить</button>'
    + (i ? '<button class="sh-btn danger" data-act="form-del">Удалить</button>' : '');
  $('sheet').classList.add('on');
  $('shb').classList.add('on');
}
function saveEdit(){
  var f = window._ef; if(!f){ return; }
  function g(id){ return $(id) ? $(id).value : ''; }
  function find(arr){ for(var k=0;k<arr.length;k++){ if(arr[k].id === f.id){ return arr[k]; } } return null; }
  var it;
  if(f.t==='sub'){
    if(f.id){ it=find(D.subs); if(it){ it.n=g('in1')||it.n; it.s=parseFloat(g('in2'))||it.s; } }
    else { D.subs.push({id:Date.now(), n:g('in1')||'Подписка', s:parseFloat(g('in2'))||0, off:0}); }
  }
  if(f.t==='pay'){
    if(f.id){ it=find(D.pays); if(it){ it.n=g('in1')||it.n; it.s=parseFloat(g('in2'))||it.s; it.d=parseInt(g('in3'))||it.d; } }
    else { D.pays.push({id:Date.now(), n:g('in1')||'Платёж', s:parseFloat(g('in2'))||0, d:parseInt(g('in3'))||1}); }
  }
  if(f.t==='cred'){
    if(f.id){ it=find(D.credits); if(it){ it.n=g('in1')||it.n; it.cur=parseFloat(g('in2'))||0; it.total=parseFloat(g('in3'))||it.cur; } }
    else { var c0=parseFloat(g('in2'))||0; D.credits.push({id:Date.now(), n:g('in1')||'Кредит', cur:c0, total:parseFloat(g('in3'))||c0}); }
  }
  if(f.t==='inst'){
    if(f.id){ it=find(D.insts); if(it){ it.n=g('in1')||it.n; it.s=parseFloat(g('in2'))||it.s; it.d=g('in3')||it.d; } }
    else { D.insts.push({id:Date.now(), n:g('in1')||'Рассрочка', s:parseFloat(g('in2'))||0, d:g('in3')||iso(new Date())}); }
  }
  if(f.t==='env'){ it=find(D.envs); if(it){ it.lim=parseFloat(g('in2'))||it.lim; } }
  if(f.t==='goal'){ D.goals={cushion:parseFloat(g('in1'))||0, cushionT:parseFloat(g('in2'))||100000, vacation:parseFloat(g('in3'))||0, vacationT:parseFloat(g('in4'))||200000}; }
  save(); closeSheet(); render(); toast('Сохранено');
}
function delEdit(){
  var f = window._ef; if(!f || !f.id){ return; }
  if(!confirm('Удалить запись?')){ return; }
  function rm(key){ var arr=D[key]; for(var k=0;k<arr.length;k++){ if(arr[k].id===f.id){ arr.splice(k,1); break; } } }
  if(f.t==='sub'){ rm('subs'); }
  if(f.t==='pay'){ rm('pays'); }
  if(f.t==='cred'){ rm('credits'); }
  if(f.t==='inst'){ rm('insts'); }
  save(); closeSheet(); render(); toast('Удалено');
}

function envMatch(e, x){
  var isTrain = /tutu|электрич|kryukovo/i.test(x.n || '');
  if(e.n.indexOf('Электричка') === 0){ return (x.cat === 'transport') && isTrain; }
  if(e.n.indexOf('Тройка') === 0){ return (x.cat === 'transport') && !isTrain; }
  var key = CAT2ENV[x.cat] || 'Личное';
  return e.n.indexOf(key) === 0;
}

function renderEnv(){
  var cs = cycleStart(new Date());
  var list = allSpends().filter(function(x){ return inCycle(x.d, cs); });
  var h = '';
  for(var i=0;i<D.envs.length;i++){
    var e = D.envs[i];
    var f = 0;
    for(var a=0;a<list.length;a++){ if(envMatch(e, list[a])){ f += list[a].s; } }
    var p = e.lim > 0 ? Math.round(f / e.lim * 100) : 0;
    var cls = p > 100 ? 'var(--red)' : (p > 85 ? 'var(--org)' : 'var(--grn)');
    h += '<div class="env glass hov" data-act="env" data-i="'+e.id+'">'
      + '<header><div class="env-name"><div class="sic '+e.k+'" style="width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center"><svg class="ic"><use href="#'+e.ic+'"/></svg></div>'+e.n+'</div>'
      + '<b class="'+(f > e.lim ? 'over' : '')+'">'+fmt(f)+' / '+fmt(e.lim)+'</b></header>'
      + '<div class="bar-large" style="height:6px;margin-top:8px"><i style="width:'+Math.min(100,p)+'%;background:'+cls+'"></i></div>'
      + '<div class="note">'+p+'% лимита · нажмите: траты и смена лимита</div></div>';
  }
  $('envList').innerHTML = h;
}

function openEnv(i){
  var e = null;
  for(var k=0;k<D.envs.length;k++){ if(D.envs[k].id === i){ e = D.envs[k]; } }
  if(!e){ return; }
  var cs = cycleStart(new Date());
  var list = allSpends().filter(function(x){ return inCycle(x.d, cs) && envMatch(e, x); });
  list.sort(function(a,b){ return b.d - a.d; });
  var f = 0;
  var rows = '';
  for(var r=0;r<list.length;r++){
    f += list[r].s;
    rows += '<div class="dig-item"><span>'+list[r].d.getDate()+'.'+String(list[r].d.getMonth()+1).padStart(2,'0')+'.'+list[r].d.getFullYear()+' · '+list[r].n+'</span><b>-'+fmt(list[r].s)+'</b></div>';
  }
  if(!rows){ rows = '<div class="dig-item"><span>Трат в этом цикле нет</span><b>—</b></div>'; }
  $('sheetBody').innerHTML = sheetHead(e.ic, e.k, e.n, 'конверт · цикл '+cycLabel(cs))
    + rowHtml('Лимит', fmt(e.lim))
    + rowHtml('Потрачено', fmt(f))
    + rowHtml('Остаток', fmt(e.lim - f))
    + '<div class="cap" style="margin:14px 4px 6px">Все траты конверта ('+list.length+')</div>'
    + '<div style="max-height:300px;overflow-y:auto">'+rows+'</div>'
    + '<button class="sh-btn" data-act="edit" data-t="env" data-i="'+e.id+'">Изменить лимит</button>';
  $('sheet').classList.add('on');
  $('shb').classList.add('on');
}

function renderPays(){
  var h = '';
  for(var i=0;i<D.pays.length;i++){
    var p = D.pays[i];
    h += '<div class="env glass hov" data-act="edit" data-t="pay" data-i="'+p.id+'"><header><div class="env-name"><div class="sic c-blu" style="width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center"><svg class="ic"><use href="#i-cal"/></svg></div>'+p.n+'</div><b>'+fmt(p.s)+' · '+p.d+'-го</b></header><div class="note">ежемесячно · нажмите для изменения</div></div>';
  }
  $('paysList').innerHTML = h || '<p style="color:var(--mut);font-size:12px;padding:4px 8px 12px">Платежей нет — добавьте первый</p>';
}
function renderSubs(){
  var h = '';
  for(var i=0;i<D.subs.length;i++){
    var s = D.subs[i];
    h += '<div class="env glass hov" data-act="edit" data-t="sub" data-i="'+s.id+'"><header><div class="env-name"><div class="sic '+(s.off?'':'c-blu')+'" style="width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;'+(s.off?'opacity:.4':'')+'"><svg class="ic"><use href="#i-sub"/></svg></div>'+s.n+'</div><b style="'+(s.off?'opacity:.4;text-decoration:line-through':'')+'">'+fmt(s.s)+'/мес</b></header><div class="note">'+(s.off?'отключена · нажмите для управления':'активна · нажмите для изменения')+'</div></div>';
  }
  $('subsList').innerHTML = h || '<p style="color:var(--mut);font-size:12px;padding:4px 8px 12px">Подписок нет</p>';
}
function renderCredits(){
  var h = '';
  for(var i=0;i<D.credits.length;i++){
    var c = D.credits[i];
    var paid = Math.max(0, Math.round((1 - c.cur / Math.max(1,c.total)) * 100));
    h += '<div class="env glass hov" data-act="edit" data-t="cred" data-i="'+c.id+'"><header><div class="env-name"><div class="sic c-red" style="width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center"><svg class="ic"><use href="#i-card"/></svg></div>'+c.n+'</div><b>'+fmt(c.cur)+'</b></header><div class="bar-large" style="height:6px;margin-top:8px"><i style="width:'+paid+'%;background:var(--grn)"></i></div><div class="note">погашено '+paid+'% · нажмите: изменить долг или внести платёж</div></div>';
  }
  $('credList').innerHTML = h || '<p style="color:var(--mut);font-size:12px;padding:4px 8px 12px">Кредитов нет — отлично!</p>';
}
function renderInsts(){
  var now = new Date();
  var h = '';
  for(var i=0;i<D.insts.length;i++){
    var x = D.insts[i];
    var d = parseD(x.d);
    var past = d < now;
    h += '<div class="env glass hov" data-act="edit" data-t="inst" data-i="'+x.id+'"><header><div class="env-name"><div class="sic '+(past?'c-grn':'c-org')+'" style="width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center"><svg class="ic"><use href="#i-cal"/></svg></div>'+x.n+'</div><b>'+fmt(x.s)+'</b></header><div class="note">'+d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear()+(past?' · прошло':' · впереди')+' · нажмите для изменения</div></div>';
  }
  $('instsList').innerHTML = h || '<p style="color:var(--mut);font-size:12px;padding:4px 8px 12px">Рассрочек нет</p>';
}

function catAgg(cs){
  var list = allSpends();
  var map = {};
  for(var i=0;i<list.length;i++){
    if(!inCycle(list[i].d, cs)){ continue; }
    var key = list[i].cat || 'other';
    map[key] = (map[key]||0) + list[i].s;
  }
  var out = [];
  for(var k in map){ out.push({id:k, n:catById(k).n, s:map[k]}); }
  out.sort(function(a,b){ return b.s - a.s; });
  return out;
}

function drawDonutWith(agg, tot){
  var cv = $('donut'); if(!cv){ return; }
  var x = cv.getContext('2d');
  x.clearRect(0,0,170,170);
  if(tot <= 0){
    x.fillStyle = '#8b91a7'; x.font = '600 11px Manrope, sans-serif'; x.textAlign = 'center';
    x.fillText('Нет трат за период', 85, 85);
    $('legend').innerHTML = '';
    return;
  }
  var cols = ['#30d158','#bf5af2','#ff453a','#ff9f0a','#0a84ff','#64d2ff'];
  var a = -Math.PI/2;
  for(var i=0;i<agg.length;i++){
    var w = agg[i].s / tot * Math.PI * 2;
    x.beginPath();
    x.arc(85,85,66,a+0.03,a+w-0.03);
    x.strokeStyle = cols[i % 6];
    x.lineWidth = 22;
    x.lineCap = 'round';
    x.stroke();
    a += w;
  }
  x.fillStyle = '#f2f4ff'; x.font = '800 17px Manrope, sans-serif'; x.textAlign = 'center';
  x.fillText(Math.round(tot/1000) + 'k', 85, 82);
  x.fillStyle = '#8b91a7'; x.font = '600 10px Manrope, sans-serif';
  x.fillText('₽ за период', 85, 98);
  var lg = '';
  for(i=0;i<agg.length;i++){
    lg += '<div><i style="background:'+cols[i % 6]+'"></i>'+agg[i].n+'<b>'+Math.round(agg[i].s/tot*100)+'%</b></div>';
  }
  $('legend').innerHTML = lg;
}

function drawBarsFor(sp, r){
  var b = $('bars'); if(!b){ return; }
  var y = b.getContext('2d');
  var W = b.clientWidth || 320;
  b.width = W * 2; b.height = 180;
  y.clearRect(0,0,b.width,180);
  var buckets = []; var i;
  var days = Math.round((r.to - r.from) / 864e5);
  if(days <= 32){
    for(i=0;i<days;i++){ buckets.push(0); }
    for(i=0;i<sp.length;i++){ var idx = Math.floor((sp[i].d - r.from) / 864e5); if(idx >= 0 && idx < days){ buckets[idx] += sp[i].s; } }
  } else {
    var m0 = new Date(r.from.getFullYear(), r.from.getMonth(), 1);
    var cur = new Date(m0);
    while(cur < r.to){ buckets.push(0); cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1); }
    for(i=0;i<sp.length;i++){ var mi = (sp[i].d.getFullYear()-m0.getFullYear())*12 + (sp[i].d.getMonth()-m0.getMonth()); if(mi >= 0 && mi < buckets.length){ buckets[mi] += sp[i].s; } }
  }
  var mx = 1;
  for(i=0;i<buckets.length;i++){ if(buckets[i] > mx){ mx = buckets[i]; } }
  var bw = b.width / Math.max(1, buckets.length);
  for(i=0;i<buckets.length;i++){
    var h = buckets[i] / mx * 140;
    y.fillStyle = (i === buckets.length-1) ? '#0a84ff' : 'rgba(100,210,255,.35)';
    y.fillRect(i*bw+4, 170-h, Math.max(4, bw-8), Math.max(2, h));
  }
}

function renderAnalytics(){
  var r = periodRange();
  $('pLabel').textContent = r.label;
  var sp = allSpends().filter(function(x){ return x.d >= r.from && x.d < r.to; });
  var inc = 0; var i;
  for(i=0;i<(D.incomes||[]).length;i++){ var d = parseD(D.incomes[i].d); if(d >= r.from && d < r.to){ inc += D.incomes[i].s; } }
  var tot = 0;
  for(i=0;i<sp.length;i++){ tot += sp[i].s; }
  var len = r.to - r.from;
  var pf = new Date(r.from.getTime() - len);
  var psp = allSpends().filter(function(x){ return x.d >= pf && x.d < r.from; });
  var ptot = 0;
  for(i=0;i<psp.length;i++){ ptot += psp[i].s; }
  var delta = ptot > 0 ? Math.round((tot - ptot) / ptot * 100) : 0;
  var now = new Date();
  var end = r.to > now ? now : r.to;
  var days = Math.max(1, Math.round((end - r.from) / 864e5));
  var map = {};
  for(i=0;i<sp.length;i++){ var k = sp[i].cat || 'other'; map[k] = (map[k]||0) + sp[i].s; }
  var agg = [];
  for(k in map){ agg.push({id:k, n:catById(k).n, s:map[k]}); }
  agg.sort(function(a,b){ return b.s - a.s; });
  $('anSum').innerHTML =
    '<div class="dig-item"><span>Потрачено</span><b>'+fmt(tot)+'</b></div>'
    + '<div class="dig-item"><span>Получено</span><b style="color:var(--grn)">+'+fmt(inc)+'</b></div>'
    + '<div class="dig-item"><span>В день</span><b>'+fmt(tot/days)+'</b></div>'
    + '<div class="dig-item"><span>Топ-категория</span><b>'+(agg.length ? agg[0].n : '—')+'</b></div>'
    + '<div class="dig-item"><span>К прошлому периоду</span><b class="'+(delta>0?'soon':'')+'">'+(delta>0?'+':'')+delta+'%</b></div>';
  drawDonutWith(agg.slice(0,6), tot);
  drawBarsFor(sp, r);
}

function renderTx(){
  var q = ($('q').value || '').toLowerCase();
  var list = allSpends();
  var incs = [];
  for(var k=0;k<(D.incomes||[]).length;k++){
    var inc = D.incomes[k];
    incs.push({d:parseD(inc.d), s:-inc.s, n:inc.n, cat:'income'});
  }
  var all = list.concat(incs);
  all.sort(function(a,b){ return b.d - a.d; });
  var h = ''; var cnt = 0;
  for(var i=0;i<all.length && cnt<25;i++){
    var t = all[i];
    if(t.n.toLowerCase().indexOf(q) === -1){ continue; }
    var isInc = t.s < 0 && t.cat === 'income';
    var cc = isInc ? catById('grocery') : catById(t.cat || 'other');
    h += '<div class="tx"><div class="tx-ic '+(isInc?'c-grn':cc.k)+'"><svg class="ic"><use href="#'+(isInc?'i-in':cc.i)+'"/></svg></div>'
      + '<div class="tx-body"><b>'+t.n+'</b><span>'+t.d.getDate()+'.'+String(t.d.getMonth()+1).padStart(2,'0')+'.'+t.d.getFullYear()+'</span></div>'
      + '<div class="tx-right"><b class="'+(isInc?'pos':'')+'">'+(isInc?'+':'-')+fmt(Math.abs(t.s))+'</b><span>'+(isInc?'ДОХОД':cc.n)+'</span></div></div>';
    cnt++;
  }
  $('txList').innerHTML = h || '<p style="color:var(--mut);font-size:13px;padding:12px">Пока пусто — добавьте траты или импортируйте выписку</p>';
}

function renderRec(){
  var act = D.leaks.filter(function(x){ return !x.fixed; });
  if(act.length === 0){
    $('recList').innerHTML = '<div class="rec glass"><header><div class="sic c-grn"><svg class="ic"><use href="#i-check"/></svg></div><div><h5>Все утечки устранены!</h5><span>Отличная работа — деньги остаются у вас</span></div></header></div>';
    return;
  }
  var h = '';
  for(var i=0;i<act.length;i++){
    var l = act[i];
    h += '<div class="rec glass hov" data-act="sheet" data-t="leak" data-i="'+l.id+'">'
      + '<header><div class="sic c-red"><svg class="ic"><use href="#i-shield"/></svg></div><div><h5>'+l.n+'</h5><span>'+l.tx+' транзакций за период</span></div><svg class="ic chev"><use href="#i-chev"/></svg></header>'
      + '<p>'+l.adv+'</p><footer><span>Потери бюджета</span><b>~ '+fmt(l.s)+' / мес</b><button class="chip" style="background:rgba(48,209,88,.15);color:var(--grn)" data-act="leak-fix" data-i="'+l.id+'">Устранено</button></footer></div>';
  }
  $('recList').innerHTML = h;
}

function renderGoals(){
  var g = D.goals;
  var p1 = Math.min(100, Math.round(g.cushion / Math.max(1,g.cushionT) * 100));
  var p2 = Math.min(100, Math.round(g.vacation / Math.max(1,g.vacationT) * 100));
  $('goalCard').innerHTML = '<div class="env glass hov" data-act="edit" data-t="goal" style="margin-bottom:16px">'
    + '<header><div class="env-name"><div class="sic c-pur" style="width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center"><svg class="ic"><use href="#i-target"/></svg></div>Подушка безопасности</div><b>'+fmt(g.cushion)+' / '+fmt(g.cushionT)+'</b></header>'
    + '<div class="bar-large" style="height:6px;margin-top:8px"><i style="width:'+p1+'%;background:linear-gradient(90deg,var(--pur),var(--pink))"></i></div>'
    + '<div class="note">'+p1+'% · нажмите, чтобы изменить цель или пополнить</div></div>'
    + '<div class="env glass hov" data-act="edit" data-t="goal" style="margin-bottom:16px">'
    + '<header><div class="env-name"><div class="sic c-org" style="width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center"><svg class="ic"><use href="#i-beach"/></svg></div>Копилка на отпуск</div><b>'+fmt(g.vacation)+' / '+fmt(g.vacationT)+'</b></header>'
    + '<div class="bar-large" style="height:6px;margin-top:8px"><i style="width:'+p2+'%;background:linear-gradient(90deg,var(--org),var(--red))"></i></div>'
    + '<div class="note">'+p2+'% · нажмите, чтобы изменить или пополнить</div></div>';
}

function renderLearn(){
  var done = D.learned.length;
  var tot = LESSONS.length;
  $('learnProg').innerHTML = '<div class="cap" style="margin:0 0 8px">Ваш прогресс</div>'
    + '<div style="font-size:22px;font-weight:800">'+done+' / '+tot+' уроков</div>'
    + '<div class="bar-large" style="height:8px;margin-top:6px"><i style="width:'+Math.round(done/tot*100)+'%;background:linear-gradient(90deg,var(--pur),var(--pink))"></i></div>'
    + '<div class="note" style="margin-top:6px">'+(done===tot?'Курс пройден! Вы управляете деньгами, а не они вами.':'Каждый урок — 1 минута. Знания экономят тысячи рублей.')+'</div>';
  var h = '';
  for(var i=0;i<LESSONS.length;i++){
    var l = LESSONS[i];
    var dn = D.learned.indexOf(l.id) !== -1;
    h += '<div class="rec glass hov" data-act="sheet" data-t="learn" data-i="'+l.id+'">'
      + '<header><div class="sic '+(dn?'c-grn':'c-pur')+'"><svg class="ic"><use href="#'+(dn?'i-check':'i-book')+'"/></svg></div><div><h5>'+l.t+'</h5><span>урок '+(i+1)+' · '+(dn?'изучено':'1 минута')+'</span></div><svg class="ic chev"><use href="#i-chev"/></svg></header></div>';
  }
  $('learnList').innerHTML = h;
}

function renderSpend(){
  var cur = cycleStart(new Date());
  var cs = addM(cur, viewOff);
  $('spLabel').textContent = cycLabel(cs);
  var list = allSpends().filter(function(x){ return inCycle(x.d, cs) && x.manual; }).sort(function(a,b){ return b.d - a.d; });
  var all = allSpends().filter(function(x){ return inCycle(x.d, cs); });
  var total = 0;
  for(var i=0;i<all.length;i++){ total += all[i].s; }
  var agg = catAgg(cs);
  $('spSum').innerHTML = '<div class="cap" style="margin:0 0 8px">Итог периода (все операции)</div>'
    + rowHtml('Потрачено', fmt(total))
    + rowHtml('В день', fmt(total / 30))
    + rowHtml('Топ-категория', agg.length ? agg[0].n+' · '+fmt(agg[0].s) : '—');
  var h = '';
  for(var j=0;j<list.length;j++){
    var t = list[j];
    var cc = catById(t.cat || 'other');
    h += '<div class="tx" data-act="edit-spend" data-id="'+t.id+'"><div class="tx-ic '+cc.k+'"><svg class="ic"><use href="#'+cc.i+'"/></svg></div>'
      + '<div class="tx-body"><b>'+t.n+'</b><span>'+t.d.getDate()+'.'+String(t.d.getMonth()+1).padStart(2,'0')+' · '+cc.n+'</span></div>'
      + '<div class="tx-right"><b>-'+fmt(t.s)+'</b></div>'
      + '<button class="del" data-act="del-spend" data-id="'+t.id+'"><svg class="ic" style="width:14px;height:14px"><use href="#i-x"/></svg></button></div>';
  }
  $('spList').innerHTML = h || '<p style="color:var(--mut);font-size:13px;padding:12px">Ручных трат в этом периоде нет — добавьте первую выше</p>';
}

function renderIncome(){
  var cs = cycleStart(new Date());
  var list = (D.incomes||[]).filter(function(x){ return inCycle(parseD(x.d), cs); }).sort(function(a,b){ return parseD(b.d) - parseD(a.d); });
  var total = 0;
  for(var i=0;i<list.length;i++){ total += list[i].s; }
  $('incSum').textContent = fmt(total);
  var h = '';
  for(var j=0;j<list.length;j++){
    var t = list[j];
    var d = parseD(t.d);
    h += '<div class="tx"><div class="tx-ic c-grn"><svg class="ic"><use href="#i-in"/></svg></div>'
      + '<div class="tx-body"><b>'+t.n+(t.auto?' · авто':'')+'</b><span>'+d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0')+'</span></div>'
      + '<div class="tx-right"><b class="pos">+'+fmt(t.s)+'</b></div>'
      + '<button class="del" data-act="del-income" data-id="'+t.id+'"><svg class="ic" style="width:14px;height:14px"><use href="#i-x"/></svg></button></div>';
  }
  $('incList').innerHTML = h || '<p style="color:var(--mut);font-size:13px;padding:12px">Поступлений пока нет</p>';
}

function renderDigest(){
  var now = new Date();
  var items = []; var sum = 0; var i;
  for(i=0;i<D.pays.length;i++){
    var diff = (D.pays[i].d - now.getDate() + 31) % 31;
    if(diff <= 3){ items.push({n:D.pays[i].n, s:D.pays[i].s, diff:diff}); sum += D.pays[i].s; }
  }
  for(i=0;i<D.insts.length;i++){
    var dd = parseD(D.insts[i].d);
    var d2 = Math.round((dd - now) / 864e5);
    if(d2 >= 0 && d2 <= 3){ items.push({n:D.insts[i].n, s:D.insts[i].s, diff:d2}); sum += D.insts[i].s; }
  }
  var h = '';
  if(items.length === 0){ h = '<div class="dig-item"><span>Ближайших платежей нет</span><b>—</b></div>'; }
  for(var j=0;j<items.length;j++){
    var when = items[j].diff === 0 ? 'сегодня' : (items[j].diff === 1 ? 'завтра' : 'через '+items[j].diff+' дн.');
    h += '<div class="dig-item"><span>'+items[j].n+' · '+when+'</span><b class="'+(items[j].diff<=1?'soon':'')+'">'+fmt(items[j].s)+'</b></div>';
  }
  $('digList').innerHTML = h;
  $('digSum').textContent = fmt(sum);
}

function renderBanner(){
  var act = D.leaks.filter(function(x){ return !x.fixed; });
  if(act.length === 0){
    $('bannerBox').innerHTML = '<div class="banner ok glass"><div class="sic"><svg class="ic"><use href="#i-check"/></svg></div><div><b>Все утечки устранены</b><p>Деньги остаются у вас. Так держать!</p></div></div>';
    return;
  }
  var ls = 0;
  for(var i=0;i<act.length;i++){ ls += act[i].s; }
  $('bannerBox').innerHTML = '<div class="banner glass hov" data-act="sheet" data-t="leaks">'
    + '<div class="sic"><svg class="ic"><use href="#i-alert"/></svg></div>'
    + '<div><b>Обнаружены утечки бюджета</b><p>'+act.length+' зоны перерасхода съедают '+fmt(ls)+' в месяц.</p></div>'
    + '<button data-act="nav" data-p="budget">В бюджет</button></div>';
}

function renderDashboardNew() {
  var now = new Date();
  var safeBal = calcSafeBalance();
  var daily = calcDailyLimit();
  var health = calcHealthScore();
  
  if ($('healthScore')) $('healthScore').textContent = health + ' / 100';
  if ($('safeBalanceHint')) $('safeBalanceHint').textContent = 'Безопасно: ' + fmt(safeBal);
  if ($('dailyLimitVal')) $('dailyLimitVal').textContent = fmt(daily.perDay) + ' / день';
  
  if ($('dailyLimitProgress')) {
    var maxDailyBudget = Math.max(1, daily.perDay * 1.5);
    var limitPct = Math.min(100, Math.round((daily.perDay / maxDailyBudget) * 100));
    $('dailyLimitProgress').style.width = limitPct + '%';
  }

  var cs = cycleStart(now);
  var ce = addM(cs, 1);
  var totalDaysInCycle = Math.round((ce - cs) / 864e5);
  var daysPassed = Math.round((now - cs) / 864e5);
  var cyclePct = Math.min(100, Math.max(0, Math.round((daysPassed / totalDaysInCycle) * 100)));
  
  if ($('cycleProgressBar')) $('cycleProgressBar').style.width = cyclePct + '%';
  if ($('cycleDaysLeft')) $('cycleDaysLeft').textContent = 'Осталось ' + daily.daysLeft + ' дн.';
  if ($('cycleDates')) $('cycleDates').textContent = cycLabel(cs);

  var fixedPay = calcMonthlyFixedPay();
  if ($('sFixedPay')) $('sFixedPay').textContent = fmt(fixedPay);
  
  var goalsTotal = ((D.goals && D.goals.cushion) || 0) + ((D.goals && D.goals.vacation) || 0);
  if ($('sGoalsVal')) $('sGoalsVal').textContent = fmt(goalsTotal);
}

function render(){
  var now = new Date();
  if ($('curDate')) $('curDate').textContent = now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'});
  if ($('demoTag')) $('demoTag').classList.toggle('hidden', !D.demo);
  if ($('hBal')) $('hBal').textContent = fmt(realBal());
  if ($('sInc')) $('sInc').textContent = fmt(D.income);
  if ($('sIncP')) $('sIncP').textContent = 'зарплата, '+D.salaryDay+'-го числа';
  
  var act = D.leaks.filter(function(x){ return !x.fixed; });
  var leakSum = 0;
  for(var j=0;j<act.length;j++){ leakSum += act[j].s; }
  if ($('sLeakV')) $('sLeakV').textContent = fmt(leakSum);
  if ($('sLeakP')) $('sLeakP').textContent = act.length+' зоны перерасхода';
  if ($('tipText')) $('tipText').textContent = TIPS[now.getDate() % TIPS.length];
  
  // Вызываем функции отрисовки в try/catch, чтобы ошибка в одном блоке не ломала всё приложение
  try { renderDashboardNew(); } catch(e) { console.error('Ошибка в renderDashboardNew:', e); }
  try { renderGoals(); } catch(e) { console.error('Ошибка в renderGoals:', e); }
  try { renderBanner(); } catch(e) { console.error('Ошибка в renderBanner:', e); }
  try { renderAnalytics(); } catch(e) { console.error('Ошибка в renderAnalytics:', e); }
  try { renderDigest(); } catch(e) { console.error('Ошибка в renderDigest:', e); }
  try { renderRec(); } catch(e) { console.error('Ошибка в renderRec:', e); }
  try { renderTx(); } catch(e) { console.error('Ошибка в renderTx:', e); }
  try { renderEnv(); } catch(e) { console.error('Ошибка в renderEnv:', e); }
  try { renderPays(); } catch(e) { console.error('Ошибка в renderPays:', e); }
  try { renderSubs(); } catch(e) { console.error('Ошибка в renderSubs:', e); }
  try { renderCredits(); } catch(e) { console.error('Ошибка в renderCredits:', e); }
  try { renderInsts(); } catch(e) { console.error('Ошибка в renderInsts:', e); }
  try { renderSpend(); } catch(e) { console.error('Ошибка в renderSpend:', e); }
  try { renderIncome(); } catch(e) { console.error('Ошибка в renderIncome:', e); }
  try { renderLearn(); } catch(e) { console.error('Ошибка в renderLearn:', e); }
}

function go(p){
  var pages = document.querySelectorAll('.page');
  for(var i=0;i<pages.length;i++){ pages[i].classList.remove('on'); }
  var el = $('p-'+p);
  if(el){ el.classList.add('on'); }
  var btns = document.querySelectorAll('[data-act="nav"]');
  for(var j=0;j<btns.length;j++){ btns[j].classList.toggle('on', btns[j].getAttribute('data-p') === p); }
  closeSheet();
  window.scrollTo({top:0, behavior:'smooth'});
}

function addMsg(cls, html){
  var log = $('chatLog');
  log.insertAdjacentHTML('beforeend', '<div class="msg '+cls+'">'+html+'</div>');
  log.scrollTop = 1000000;
}
function answer(t){
  var s = t.toLowerCase();
  if(s.indexOf('сегодня') !== -1){
    var days = ((D.salaryDay - new Date().getDate()) + 30) % 30 || 30;
    var free = calcSafeBalance();
    return 'До зарплаты <b>'+days+' дн</b>. Свободный лимит: <b>'+fmt(free/days)+' в день</b>. Крупнее 500 ₽ — согласовывайте со мной.';
  }
  if(s.indexOf('утеч') !== -1){
    var act = D.leaks.filter(function(x){ return !x.fixed; });
    if(act.length === 0){ return 'Активных утечек нет — вы молодец!'; }
    return 'Главная утечка: <b>'+act[0].n+'</b> — '+fmt(act[0].s)+'/мес. '+act[0].adv;
  }
  if(s.indexOf('долг') !== -1 || s.indexOf('кредит') !== -1){
    var cs = D.credits.slice().sort(function(a,b){ return a.cur - b.cur; });
    if(cs.length === 0){ return 'Долгов нет — отличная база для накоплений!'; }
    return 'Стратегия «лавина»: сначала маленький долг <b>'+cs[0].n+'</b> ('+fmt(cs[0].cur)+'), затем остальные.';
  }
  return 'Спросите: «сколько можно сегодня», «могу купить», «где утечки», «как закрыть долги».';
}
function ask(q){
  var t = q || $('chatIn').value.trim();
  if(!t){ return; }
  $('chatIn').value = '';
  addMsg('me', t);
  setTimeout(function(){ addMsg('bot', answer(t)); }, 400);
}

document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-act]') : null;
  if(!el){ return; }
  var act = el.getAttribute('data-act');
  if(act === 'nav'){ go(el.getAttribute('data-p')); }
  else if(act === 'sheet'){ openSheet(el.getAttribute('data-t'), parseInt(el.getAttribute('data-i') || '0', 10)); }
  else if(act === 'env'){ openEnv(parseInt(el.getAttribute('data-i'), 10)); }
  else if(act === 'edit'){ openEdit(el.getAttribute('data-t'), parseInt(el.getAttribute('data-i') || '0', 10)); }
  else if(act === 'add'){ openEdit(el.getAttribute('data-t'), 0); }
  else if(act === 'form-save'){ saveEdit(); }
  else if(act === 'form-del'){ delEdit(); }
  else if(act === 'leak-fix'){
    var id1 = parseInt(el.getAttribute('data-i'), 10);
    for(var s1=0;s1<D.leaks.length;s1++){ if(D.leaks[s1].id === id1){ D.leaks[s1].fixed = 1; } }
    save(); render(); toast('Утечка устранена!');
  }
  else if(act === 'close'){ closeSheet(); }
  else if(act === 'nexttip'){ TIPS.push(TIPS.shift()); $('tipText').textContent = TIPS[0]; closeSheet(); }
  else if(act === 'balance-edit'){
    var v = prompt('Текущая сумма на всех картах, ₽:');
    if(v === null){ return; }
    var n = parseFloat(v);
    if(isNaN(n)){ return; }
    var t = sums();
    D.baseBalance = n - (t.inc - t.spend);
    save(); closeSheet(); render(); toast('Баланс обновлён');
  }
  else if(act === 'income-edit'){
    D.income = parseFloat($('in1').value) || D.income;
    D.salaryDay = parseInt($('in2').value) || D.salaryDay;
    save(); closeSheet(); render(); toast('Доход обновлён');
  }
  else if(act === 'spend-add'){
    var amt = parseFloat($('spAmt').value);
    if(isNaN(amt) || amt <= 0){ alert('Введите сумму траты.'); return; }
    var cat = $('spCat').value || 'other';
    var note = $('spNote').value.trim();
    var d = $('spDate').value || iso(new Date());
    D.spends.push({id:Date.now(), d:d, n: note || catById(cat).n, cat:cat, s:amt});
    $('spAmt').value = ''; $('spNote').value = '';
    catTouched = false;
    save(); render(); toast('Трата добавлена: −'+fmt(amt));
  }
  else if(act === 'del-spend'){
    var id5 = parseInt(el.getAttribute('data-id'), 10);
    if(!confirm('Удалить трату?')){ return; }
    D.spends = D.spends.filter(function(x){ return x.id !== id5; });
    save(); closeSheet(); render(); toast('Трата удалена');
  }
  else if(act === 'addincome'){
    $('sheetBody').innerHTML = sheetHead('i-in','c-grn','Добавить поступление','сумма попадёт в реальный остаток')
      + '<div class="form"><div class="row2"><input class="inp" id="incAmt" type="number" placeholder="Сумма, ₽"><input class="inp" id="incDate" type="date" value="'+iso(new Date())+'"></div>'
      + '<input class="inp" id="incNote" placeholder="Что это (подработка, кэшбэк...)"></div>'
      + '<button class="sh-btn" data-act="income-save">Сохранить</button>';
    $('sheet').classList.add('on'); $('shb').classList.add('on');
  }
  else if(act === 'income-save'){
    var a2 = parseFloat($('incAmt').value);
    if(isNaN(a2) || a2 <= 0){ alert('Введите сумму поступления.'); return; }
    D.incomes.push({id:Date.now(), d: $('incDate').value || iso(new Date()), n: $('incNote').value.trim() || 'Поступление', s:a2});
    save(); closeSheet(); render(); toast('Поступление +'+fmt(a2));
  }
  else if(act === 'p-set'){ pMode = el.getAttribute('data-v'); pOff = 0; renderAnalytics(); }
  else if(act === 'chip'){ ask(el.getAttribute('data-q')); }
  else if(act === 'send'){ ask(); }
  else if(act === 'exit'){ signOut(auth); }
});

$('shb').addEventListener('click', closeSheet);


var gbtn = $('googleBtn');
gbtn.addEventListener('click', function(){
  gbtn.textContent = 'Подключаюсь...';
  signInWithPopup(auth, prov).catch(function(err){
    return signInWithRedirect(auth, prov);
  }).catch(function(err2){
    gbtn.textContent = 'Войти через Google';
    alert('Не удалось войти: ' + ((err2 && err2.code) || err2));
  });
});

// Функция для скрытой загрузки HTML-страниц из папки pages/
function loadPages() {
  var pages = ['dash', 'spend', 'income', 'budget', 'learn', 'chat'];
  var container = document.getElementById('pageContent');
  if (!container) return Promise.resolve();
  
  var promises = pages.map(function(pageName) {
    return fetch('pages/' + pageName + '.html')
      .then(function(response) { return response.text(); })
      .then(function(html) {
        var div = document.createElement('div');
        div.innerHTML = html.trim();
        var pageDiv = div.firstElementChild;
        if (pageDiv && pageDiv.classList.contains('page')) {
          pageDiv.id = 'p-' + pageName; // Автоматически добавляем нужный ID
          container.appendChild(pageDiv);
        }
      });
  });
  
  return Promise.all(promises);
}

// Сохраняем промис, чтобы дождаться загрузки перед авторизацией
window._pagesLoaded = loadPages();

onAuthStateChanged(auth, function(u){
  if(!u){
    $('login').classList.remove('hidden');
    $('app').classList.add('hidden');
    return;
  }
  uid = u.uid;
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  
  // Ждем, пока все страницы подгрузятся в DOM
  (window._pagesLoaded || Promise.resolve()).then(function() {
    var name = (u.displayName || 'друг').split(' ')[0];
    if ($('hello')) $('hello').textContent = 'Привет, ' + name + '!';
    if ($('mMail')) $('mMail').textContent = name;
    
    getDoc(doc(db,'users',uid)).then(function(s){
      if(s.exists() && s.data() && s.data().data){ D = s.data().data; }
      normalize();
      ensureSalary();
      var sel = $('spCat');
      if (sel) {
        sel.innerHTML = '';
        for(var i=0;i<CATS.length;i++){
          var o = document.createElement('option');
          o.value = CATS[i].id; o.textContent = CATS[i].n;
          sel.appendChild(o);
        }
      }
      var spDate = $('spDate');
      if (spDate) spDate.value = iso(new Date());
      
      $('q').addEventListener('input', renderTx);
      $('chatIn').addEventListener('keydown', function(e){ if(e.key === 'Enter'){ ask(); } });
      $('spCat').addEventListener('change', function(){ catTouched = true; });
      $('spNote').addEventListener('input', function(){ if(!catTouched){ $('spCat').value = autoCat(this.value); } });

      render(); // Запускаем отрисовку данных
      go('dash'); // И переключаемся на главную
    }).catch(function(){ normalize(); render(); go('dash'); });
  });
});

if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(function(){}); }
// ВЕРСИЯ СБОРКИ: перед каждым коммитом меняй дату и время в кавычках ниже
var BUILD = '06.08 15:21';
function showBuildInfo(){
  var el = $('buildInfo');
  if (el) el.textContent = 'обновлено: ' + BUILD;
}
showBuildInfo();
