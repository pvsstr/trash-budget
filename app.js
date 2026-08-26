//restart deploy
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
var calOff = 0;
var herOff = 0;
var calSel = [];
var calSelectMode = false;
var leakOff = 0;
var MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
var MONTHS_S = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

function $(id){ return document.getElementById(id); }
function fmt(n){ return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Math.round(n)) + '\u00A0₽'; }
function iso(dt){ return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
function parseD(s){
  if(!s){ return new Date(2026,0,1); }
  if(s.length <= 5){ var p=s.split('.'); return new Date(2026, +p[1]-1, +p[0]); }
  var q=s.split('-'); return new Date(+q[0], +q[1]-1, +q[2]);
}
function addM(dt, k){ return new Date(dt.getFullYear(), dt.getMonth()+k, dt.getDate()); }
function salaryDate(y, m){
  var day = D.salaryDay || 20;
  var wd = new Date(y, m, day).getDay();
  if(wd === 6){ return new Date(y, m, day - 1); }
  if(wd === 0){ return new Date(y, m, day + 1); }
  return new Date(y, m, day);
}
// Находит последнюю дату зарплаты (фактическую) до указанной даты
function getLastSalaryDate(dt) {
  dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  // Проверяем до 12 месяцев назад
  for (var i = 0; i < 12; i++) {
    var curDate = new Date(dt.getFullYear(), dt.getMonth() - i, 1);
    var sd = salaryDate(curDate.getFullYear(), curDate.getMonth());
    if (sd <= dt) {
      return sd;
    }
  }
  // fallback – возвращаем 1-е число текущего месяца
  return new Date(dt.getFullYear(), dt.getMonth(), 1);
}

// Находит следующую дату зарплаты (фактическую) после указанной даты
function getNextSalaryDate(dt) {
  dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  // Проверяем до 12 месяцев вперёд
  for (var i = 0; i < 12; i++) {
    var curDate = new Date(dt.getFullYear(), dt.getMonth() + i, 1);
    var sd = salaryDate(curDate.getFullYear(), curDate.getMonth());
    if (sd > dt) {
      return sd;
    }
  }
  // fallback – возвращаем 1-е число следующего месяца
  return new Date(dt.getFullYear(), dt.getMonth() + 1, 1);
}

// Начало зарплатного цикла (по умолчанию – от фактической даты зарплаты)
function cycleStart(dt) {
  if (D.cycleMode === 'calendar') {
    // Календарный режим – начало месяца
    return new Date(dt.getFullYear(), dt.getMonth(), 1);
  }
  // Зарплатный режим – последняя зарплата до этой даты
  return getLastSalaryDate(dt);
}

// Конец зарплатного цикла
function cycleEnd(cs) {
  if (D.cycleMode === 'calendar') {
    // Календарный режим – конец месяца
    return new Date(cs.getFullYear(), cs.getMonth() + 1, 1);
  }
  // Зарплатный режим – следующая зарплата после начала цикла
  return getNextSalaryDate(cs);
}

// Человекочитаемая метка зарплатного цикла
function cycleLabel(cs) {
  if (D.cycleMode === 'calendar') {
    return MONTHS[cs.getMonth()] + ' ' + cs.getFullYear();
  }
  var ce = cycleEnd(cs);
  var ce2 = new Date(ce.getTime() - 864e5);
  var startStr = cs.getDate() + '.' + String(cs.getMonth()+1).padStart(2,'0');
  var endStr = ce2.getDate() + '.' + String(ce2.getMonth()+1).padStart(2,'0');
  return startStr + ' – ' + endStr;
}
var WEEKDAYS = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
function payDateStr(d){
  return d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear()+' ('+WEEKDAYS[d.getDay()]+')';
}
function cycLabel(cs){
  var ce = new Date(cycleEnd(cs).getTime() - 864e5);
  return cs.getDate()+'.'+String(cs.getMonth()+1).padStart(2,'0')+' – '+ce.getDate()+'.'+String(ce.getMonth()+1).padStart(2,'0')+'.'+ce.getFullYear();
}
function shiftCycle(cs, n){
  if(D.cycleMode === 'calendar'){ return addM(cs, n); }
  var r = new Date(cs.getFullYear(), cs.getMonth(), cs.getDate());
  for(var i = 0; i < Math.abs(n); i++){
    if(n > 0){ r = getNextSalaryDate(r); }
    else { r = getLastSalaryDate(new Date(r.getTime() - 864e5)); }
  }
  return r;
}
function esc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function toast(m){ var t=document.createElement('div'); t.className='toast'; t.textContent=m; document.body.appendChild(t); setTimeout(function(){ t.remove(); },2500); }
// Тост с кнопкой-действием (например, «Отменить» после удаления)
function dToast(msg, btnTxt, cb){
  var t = document.createElement('div'); t.className = 'toast';
  var sp = document.createElement('span'); sp.textContent = msg; t.appendChild(sp);
  if(btnTxt && cb){
    var b = document.createElement('button'); b.className = 'undo-btn'; b.textContent = btnTxt;
    b.addEventListener('click', function(){ t.remove(); cb(); });
    t.appendChild(b);
  }
  document.body.appendChild(t);
  setTimeout(function(){ t.remove(); }, 6000);
}

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
  // 1. Сначала смотрим выученные правила
  if(D.merchRules){
    for(var rule in D.merchRules){ if(s.indexOf(rule)!==-1){ return D.merchRules[rule]; } }
  }
  // 2. Потом ключевые слова
  for(var i=0;i<KEYCAT.length;i++){
    var kw = KEYCAT[i][1];
    for(var j=0;j<kw.length;j++){ if(s.indexOf(kw[j]) !== -1){ return KEYCAT[i][0]; } }
  }
  return 'other';
}

var LESSONS = [
{id:1,g:'Основы',t:'Подушка безопасности',x:'Это 3–6 месяцев обязательных трат (аренда, еда, транспорт) на отдельном счёте.'},
{id:2,g:'Основы',t:'Платите себе первыми',x:'В день зарплаты сразу переводите план в накопления, до любых трат.'},
{id:3,g:'Основы',t:'Лавина долгов',x:'Гасите сначала долг с самой высокой ставкой.'},
{id:4,g:'Основы',t:'Метод конвертов',x:'Разделите деньги по категориям с лимитами сразу после зарплаты.'},
{id:5,g:'Основы',t:'Правило 24 часов',x:'Любое незапланированное желание дороже 500 ₽ — ждите сутки.'},
{id:6,g:'Основы',t:'Аудит подписок',x:'Раз в месяц смотрите все автоплатежи.'},
{id:7,g:'Основы',t:'Обязательное и гибкое',x:'Аренда и подписки урезать трудно. Кафе, самокаты, такси — гибкие траты.'},
{id:8,g:'Основы',t:'Рассрочка без ловушек',x:'Рассрочка безопасна, только если платёж уже вписан в бюджет.'},
{id:9,g:'Мастерская МАЯК',t:'Реальный и безопасный остаток',x:'Реальный остаток — сколько денег всего. Безопасный — минус все платежи ближайших 30 дней. Тратить можно только безопасный.'},
{id:10,g:'Мастерская МАЯК',t:'Дневной лимит',x:'(Безопасный остаток) ÷ (дней до зарплаты). Честная цифра: если держаться её, деньги гарантированно доживут до зарплаты.'},
{id:11,g:'Мастерская МАЯК',t:'Цикл зарплаты',x:'Приложение считает цикл от фактической даты прихода зарплаты, а не с 1-го числа. Если 20-е выпало на воскресенье — цикл начнётся 21-го.'},
{id:12,g:'Мастерская МАЯК',t:'Прогноз на 90 дней',x:'График показывает баланс на каждый день вперёд: платежи, подписки, кредиты, зарплаты и ваш темп трат. Красная зона — уход в минус. Тапни по любому дню для разбора.'},
{id:13,g:'Мастерская МАЯК',t:'Конверты в приложении',x:'Бюджет → Конверты. Лимит на цикл, темп и перерасход видны сразу. Утечка = конверт, вышедший за лимит.'},
{id:14,g:'Мастерская МАЯК',t:'Подписки: аудит факта',x:'Приложение сравнивает заявленную цену подписки с реальными списаниями. Подорожала — увидите. Списаний нет 90 дней — пора отключать.'},
{id:15,g:'Мастерская МАЯК',t:'Кредиты в прогнозе',x:'Укажите платёж и день списания в карточке кредита — и прогноз станет честным. План долгов покажет срок свободы от кредитов.'},
{id:16,g:'Мастерская МАЯК',t:'«Могу купить?» и список желаний',x:'Перед покупкой жмите «Могу купить?» — честный вердикт по цифрам. Импульсивное желание запишите на 24 часа: утром решение будет холоднее.'},
{id:17,g:'Мастерская МАЯК',t:'Выписка банка за 30 секунд',x:'Траты → Инструменты → «Вставить выписку». Вставьте текст из приложения банка — операции распознаются и разложатся по категориям автоматически.'},
{id:18,g:'Мастерская МАЯК',t:'Бэкап: страховка данных',x:'Настройки → «Скачать копию данных». Делайте копию раз в месяц и перед большими изменениями. Восстановление — из того же места.'}];

function lessonApply(id){
  var map = {
    1:'создай цель «Подушка» на 3× обязательных трат — панель «Цели и копилки». Прогноз покажет срок.',
    2:'в день зарплаты жми «В копилку» и откладывай 10% до любых трат.',
    3:'открой «План выхода из долгов» — приложение посчитает срок свободы при твоём доходе.',
    4:'заведи конверты с лимитами во вкладке «Бюджет» — трата сверх лимита станет видна мгновенно.',
    5:'захотелось крупное — запиши в «Могу купить?» на 24 часа. Утром решение будет холоднее.',
    6:'карточка «Подписки» внизу панели: сумма в месяц и в год. Отключи то, чем не пользовался неделю.',
    7:'в аналитике смотри «Структуру трат»: если гибкая часть выше 20% дохода — там ваш запас.',
    8:'каждый платёж рассрочки должен быть в списке «Рассрочки» — иначе прогноз будет врать.',
    9:'карточка «Реальный остаток» на панели: нажми и посмотри, сколько из них безопасно.',
    10:'следи за карточкой «Сегодня» на панели: потрачено из лимита. Вечерний перерасход = минус завтра.',
    11:'шторка «Цикл зарплаты» на панели: даты цикла, дней осталось, дневной лимит.',
    12:'панель → карточка прогноза: график, минимум («дно») и что делать, если оно ниже нуля.',
    13:'Бюджет → «+ Конверт». Начни с трёх: Продукты, Кафе, Транспорт.',
    14:'Бюджет → Подписки: у каждой карточки факт списаний против заявленной цены.',
    15:'Бюджет → Кредиты → «Указать платёж»: два числа — и прогноз учитывает кредит сам.',
    16:'Панель → «Могу купить?»: проверка покупки и список желаний с 24-часовой выдержкой.',
    17:'Траты → Инструменты → «Вставить выписку». Потом «Разобрать Прочее» для точной статистики.',
    18:'Настройки → «Скачать копию данных». Файл .json храни где угодно — восстановление из него же.'
  };
  return map[id] || 'Применяй на практике — знание без действия не экономит ни рубля.';
}

var DEMO = {demo:true, income:0, salaryDay:null, baseBalance:0,
goals:{},
spends:[], incomes:[],
envs:[],
pays:[],
subs:[],
leaks:[],
tx:[],
credits:[], insts:[], learned:[], removedAuto:[], events:[], her:{}, cancelled:[], leakFixed:{}, paid:{}, merchRules:{}, lifeMin:50000};
var D = DEMO;

var TIPS = [
'Подушка безопасности = 3–6 месяцев обязательных трат. Начните с 10%.',
'Мелкие траты 100–200 ₽ незаметны, но 5 таких в день = 15 000 ₽ в месяц.',
'Подписки — тихая утечка. Раз в месяц просматривайте автоплатежи.',
'Платите себе первыми: в день зарплаты сразу переводите 10% в накопления.',
'Кредитка выгодна только при полном погашении в грейс-период.',
'Конверт пуст — трата стоп. Правило работает без силы воли.'];

function save(){ if(uid){ D.lastSave = new Date().getTime(); _allSpendsCache = null; setDoc(doc(db,'users',uid), {data:D}, {merge:true}); } }

function exportBackup(){
  var json = JSON.stringify(D, null, 2);
  var blob = new Blob([json], {type:'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'trash-budget-backup-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  D.lastBackup = Date.now();
  save();
  toast('Копия данных сохранена');
}

function importBackupFromFile(el){
  var file = el.files[0];
  if(!file){ return; }
  var reader = new FileReader();
  reader.onload = function(e){
    try{
      var data = JSON.parse(e.target.result);
      if(!data.spends || !data.incomes){ throw new Error('Неверный формат файла'); }
      dConfirm('Все текущие данные будут заменены данными из копии. Продолжить?', 'Восстановление данных').then(function(ok){
        if(!ok){ return; }
        D = data;
        save();
        render();
        toast('Данные восстановлены');
        setTimeout(function(){ location.reload(); }, 1500);
      });
    }catch(err){
      dAlert('Ошибка импорта: ' + err.message, 'Ошибка');
    }
  };
  reader.readAsText(file);
}

function resetAllData(){
  dConfirm('Вы уверены? Все данные будут безвозвратно удалены.', 'Сброс данных').then(function(ok){
    if(!ok){ return; }
    D = {
      spends:[], incomes:[], tx:[], envs:[], pays:[], subs:[], credits:[], insts:[], goals:[], events:[], her:{},
            learned:[], leaks:[], merchRules:{}, paid:{}, removedAuto:[], cancelled:[], leakFixed:{},
      baseBalance:0, income:0, salaryDay:null, demo:false, cycleMode:'salary', decisions:[]
    };
    normalize();
    save();
    render();
    toast('Все данные сброшены');
    setTimeout(function(){ location.reload(); }, 1500);
  });
}

function normalize(){
  D.spends=D.spends||[]; D.incomes=D.incomes||[]; D.tx=D.tx||[];
    // Добавляем теги к тратам, если их нет
  for(var i=0;i<D.spends.length;i++){
    if(!D.spends[i].tag) D.spends[i].tag = 'normal';
  }
  D.subs=D.subs||[]; D.pays=D.pays||[]; D.envs=D.envs||[]; D.leaks=D.leaks||[];
  D.wishes=D.wishes||[]; D.transfers=D.transfers||[]; D.recurHide=D.recurHide||[];
  if(!D.lastBalCheck){ D.lastBalCheck = 0; }
  if(!D.lastBackup){ D.lastBackup = 0; }
  var i;
  for(i=0;i<D.subs.length;i++){ D.subs[i].id=D.subs[i].id||i+1; }
  for(i=0;i<D.pays.length;i++){ D.pays[i].id=D.pays[i].id||i+100; }
  for(i=0;i<D.envs.length;i++){
    D.envs[i].id=D.envs[i].id||i+1;
    if(!D.envs[i].cats){ D.envs[i].cats = envCatsFromName(D.envs[i].n); }
    if(!D.envs[i].ic){ D.envs[i].ic='i-gift'; }
    if(!D.envs[i].k){ D.envs[i].k='c-pur'; }
  }
  for(i=0;i<D.leaks.length;i++){ D.leaks[i].id=D.leaks[i].id||i+1; D.leaks[i].fixed=D.leaks[i].fixed||0; }
  D.pays = D.pays.filter(function(x){ return x.n.indexOf('Рассрочка')===-1; });
  if(!D.credits) D.credits=[];
if(!D.insts) D.insts=[];
  D.learned=D.learned||[];
  D.removedAuto=D.removedAuto||[];
  D.events=D.events||[]; D.her=D.her||{}; D.cancelled=D.cancelled||[]; D.leakFixed=D.leakFixed||{}; D.paid=D.paid||{};  D.merchRules = D.merchRules || {};
    D.decisions = D.decisions || [];
  if(typeof D.lifeMin !== 'number'){ D.lifeMin = 50000; }
  // Цели теперь инициализируются только из Firebase, без демо-значений
     D.goals = D.goals || [];
  if (typeof D.cycleMode !== 'string') D.cycleMode = 'salary';
  calcLifeMin();
}

var _allSpendsCache = null;
function allSpends(){
  if(_allSpendsCache){ return _allSpendsCache; }
  var arr = []; var i;
  for(i=0;i<(D.spends||[]).length;i++){
    var sp = D.spends[i];
    arr.push({d:parseD(sp.d), s:sp.s, n:sp.n, cat:sp.cat, id:sp.id, manual:1, src:'sp', sid:sp.id, tag:sp.tag||'normal'});
  }
  for(i=0;i<(D.tx||[]).length;i++){
    var t = D.tx[i];
    if(t.s < 0 || t.refund){ arr.push({d:parseD(t.d), s:-t.s, n:t.n, cat:TX2CAT[t.c]||t.c||'other', src:'tx', sid:i}); }
  }
  _allSpendsCache = arr;
  return arr;
}
function sums(){
  var si=0, ss=0, i;
  for(i=0;i<(D.incomes||[]).length;i++){ si += D.incomes[i].s; }
  var all = allSpends();
  for(i=0;i<all.length;i++){ ss += all[i].s; }
  return {inc:si, spend:ss};
}
function realBal(){ var t = sums(); return (D.baseBalance||0) + t.inc - t.spend; }
function inCycle(dt, cs){ var ce = cycleEnd(cs); return dt >= cs && dt < ce; }

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
  // Ежемесячные платежи по кредитам — участвуют как обязательные
  for(i=0;i<(D.credits||[]).length;i++){
    var crN = D.credits[i];
    if(!(crN.pay > 0)){ continue; }
    var cd = crN.d || 1;
    var diffC = (cd - now.getDate() + 31) % 31;
    if(diffC <= days){ sum += crN.pay; }
  }
  return sum;
}

function calcMonthlyFixedPay() {
  var paysSum = 0;
  for (var i = 0; i < D.pays.length; i++) { paysSum += D.pays[i].s; }
  for (var j = 0; j < D.subs.length; j++) { if (!D.subs[j].off) paysSum += D.subs[j].s; }
  // Ежемесячные платежи по кредитам
  for (var k = 0; k < (D.credits||[]).length; k++) {
    if ((D.credits[k].pay||0) > 0) { paysSum += D.credits[k].pay; }
  }
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
  var cur = salaryDate(now.getFullYear(), now.getMonth());
  var next = now < cur ? cur : cycleEnd(cur);
  var daysLeft = Math.max(1, Math.round((next - now) / 864e5));
  return { perDay: Math.round(safe / daysLeft), daysLeft: daysLeft };
}
function calcHealthScore() {
  var score = 50;
  var safe = calcSafeBalance();
  var cushGoal = null;
  for(var ig=0;ig<(D.goals||[]).length;ig++){
    if(/подушк/i.test(D.goals[ig].n) && !D.goals[ig].done){ cushGoal = D.goals[ig]; break; }
  }
  var cushion = cushGoal ? cushGoal.cur : 0;
  var cushionTarget = cushGoal ? cushGoal.target : 100000;
  score += Math.min(30, Math.round((cushion / cushionTarget) * 30));
  if (safe > 0) score += 20;
  var actLeakN = activeLeaks().length;
  score -= (actLeakN * 7);
  return Math.max(10, Math.min(100, score));
}

function ensureSalary(){
  if(!D.income){ return; }
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
  
  // Если режим зарплатного цикла и период "месяц" – показываем текущий зарплатный цикл
  if(D.cycleMode === 'salary' && pMode === 'm'){
    var from = shiftCycle(cycleStart(now), pOff);
    var to = cycleEnd(from);
    label = cycleLabel(from);
    return {from:from, to:to, label:label};
  }
  
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
function closeSheetCore(){ $('sheet').classList.remove('on'); $('shb').classList.remove('on'); }
function closeSheet(){ closeSheetCore(); }
// Системная кнопка «Назад»: сначала закрываем шторку/диалог/меню, и только потом приложение
function closeTopOverlay(){
  var dlg = document.getElementById('dlgBox');
  if(dlg && dlg.classList.contains('on')){ dlgClose(null); return true; }
  var sh = $('sheet');
  if(sh && sh.classList.contains('on')){ closeSheetCore(); return true; }
  var dds = document.querySelectorAll('.dd.on');
  if(dds.length){ for(var i=0;i<dds.length;i++){ dds[i].classList.remove('on'); } return true; }
  return false;
}
try{
  history.replaceState({tbRoot:1}, '');
  history.pushState({tbRoot:2}, '');
  window.addEventListener('popstate', function(){
    if(closeTopOverlay()){
      setTimeout(function(){ try{ history.pushState({tbRoot:2}, ''); }catch(e){} }, 0);
    }
  });
}catch(e){}

// ===== МОБИЛЬНЫЕ ОЩУЩЕНИЯ (Xiaomi/Android) =====
function vib(ms){ try{ if(navigator.vibrate){ navigator.vibrate(ms); } }catch(e){} }
// Поиск по истории: рендер не чаще 4 раз в секунду при наборе
function debRerender(){ var t=null; return function(){ clearTimeout(t); var s=this; t=setTimeout(function(){ renderTx(); },180); }; }
function debRerender2(){ var t=null; return function(){ clearTimeout(t); var s=this; t=setTimeout(function(){ renderTx('2'); },180); }; }
(function(){
  var sh = $('sheet');
  if(!sh){ return; }
  // Свайп вниз по «ручке» шторки закрывает её
  var sy = 0, tracking = false;
  sh.addEventListener('touchstart', function(e){
    var t = e.touches[0];
    var rect = sh.getBoundingClientRect();
    tracking = (sh.scrollTop <= 4 && t.clientY - rect.top < 64);
    sy = t.clientY;
  }, {passive:true});
  sh.addEventListener('touchmove', function(e){
    if(!tracking){ return; }
    var dy = e.touches[0].clientY - sy;
    if(dy > 90){
      tracking = false;
      vib(8);
      closeSheet();
    }
  }, {passive:true});
  // Клавиатура убирается при прокрутке шторки
  var blT = null;
  sh.addEventListener('scroll', function(){
    if(blT){ return; }
    blT = setTimeout(function(){ blT = null; }, 300);
    var ae = document.activeElement;
    if(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && ae.blur){ ae.blur(); }
  }, {passive:true});
})();

var dlgResolve = null;
function dlgBuild(){
  if($('dlgBox')){ return; }
  var b = document.createElement('div');
  b.id = 'dlgb';
  var box = document.createElement('div');
  box.id = 'dlgBox';
  box.className = 'glass';
  box.innerHTML = '<div class="dlg-ic"><svg class="ic"><use href="#i-alert"/></svg></div>'
    + '<div class="dlg-title" id="dlgTitle"></div>'
    + '<div class="dlg-text" id="dlgText"></div>'
    + '<input class="inp dlg-inp" id="dlgInp" style="display:none">'
    + '<div class="dlg-btns"><button class="sh-btn ghost" id="dlgNo">Отмена</button><button class="sh-btn" id="dlgYes">ОК</button></div>';
  document.body.appendChild(b);
  document.body.appendChild(box);
  var inp = $('dlgInp');
  // Свайп вниз по диалогу закрывает его
  var dlgSy = null;
  box.addEventListener('touchstart', function(e){ dlgSy = e.touches[0].clientY; }, {passive:true});
  box.addEventListener('touchmove', function(e){
    if(dlgSy !== null && (e.touches[0].clientY - dlgSy) > 80){ dlgSy = null; vib(8); dlgClose(null); }
  }, {passive:true});
  $('dlgb').addEventListener('click', function(){ dlgClose(null); });
  $('dlgNo').addEventListener('click', function(){ dlgClose(null); });
  $('dlgYes').addEventListener('click', function(){
    dlgClose(inp.style.display !== 'none' ? inp.value : true);
  });
  inp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ dlgClose(inp.value); } });
}
function dlgClose(val){
  $('dlgb').classList.remove('on');
  $('dlgBox').classList.remove('on');
  if(dlgResolve){ var r = dlgResolve; dlgResolve = null; r(val); }
}
function dlgShow(o){
  dlgBuild();
  $('dlgTitle').textContent = o.title || '';
  $('dlgText').textContent = o.text || '';
  var inp = $('dlgInp');
  if(o.input){ inp.style.display = ''; inp.placeholder = o.placeholder || ''; inp.value = o.value || ''; }
  else { inp.style.display = 'none'; }
  $('dlgNo').style.display = (o.confirm || o.input) ? '' : 'none';
  var yes = $('dlgYes');
  yes.textContent = o.btn || 'ОК';
  yes.className = 'sh-btn' + (o.danger ? ' danger' : '');
  $('dlgb').classList.add('on');
  $('dlgBox').classList.add('on');
  if(o.input){ setTimeout(function(){ inp.focus(); }, 120); }
  return new Promise(function(res){ dlgResolve = res; });
}
function dAlert(text, title){ return dlgShow({text:text, title:title||'Внимание', btn:'Понятно'}); }
function dConfirm(text, title, danger){ return dlgShow({text:text, title:title||'Подтверждение', confirm:true, btn:'Да', danger:danger}); }
function dPrompt(text, title, placeholder){ return dlgShow({text:text, title:title||'Ввод', input:true, placeholder:placeholder}); }

function leakCat(l){
  var s = (l.n||'').toLowerCase();
  if(s.indexOf('самокат') !== -1 || s.indexOf('каршер') !== -1){ return 'scooters'; }
  if(s.indexOf('кафе') !== -1){ return 'cafe'; }
  if(s.indexOf('подписк') !== -1){ return 'subs'; }
  if(s.indexOf('такси') !== -1){ return 'taxi'; }
  if(s.indexOf('аренд') !== -1 || s.indexOf('жиль') !== -1){ return 'home'; }
  if(s.indexOf('продукт') !== -1){ return 'grocery'; }
  return l.cat || 'other';
}
function leaksFor(y, m){
  var from = new Date(y, m, 1), to = new Date(y, m+1, 1);
  var list = allSpends().filter(function(x){ return x.d >= from && x.d < to; });
  var fixed = D.leakFixed || {};
  var fkey = y+'-'+m;
  var out = [];
  for(var i=0;i<D.envs.length;i++){
    var e = D.envs[i];
    if(e.lim <= 0){ continue; }
    var f = 0, cnt = 0;
    for(var a=0;a<list.length;a++){ if(envMatch(e, list[a])){ f += list[a].s; cnt++; } }
    if(f > e.lim){
      out.push({id:e.id, n:e.n, s:f, lim:e.lim, over:f-e.lim, tx:cnt, fixed:((fixed[fkey]||[]).indexOf(e.id)!==-1)?1:0, ic:e.ic, k:e.k});
    }
  }
  out.sort(function(a,b){ return b.over - a.over; });
  return out;
}
function curLeaks(){ var n = new Date(); return leaksFor(n.getFullYear(), n.getMonth()); }
function activeLeaks(){ return curLeaks().filter(function(x){ return !x.fixed; }); }

function fixDel(t, i){
  dConfirm('Удалить эту обязательную трату?', 'Удаление', true).then(function(ok){
    if(!ok){ return; }
    var key = t==='pay' ? 'pays' : (t==='sub' ? 'subs' : (t==='cred' ? 'credits' : 'insts'));
    var arr = D[key];
    for(var k=0;k<arr.length;k++){ if(arr[k].id===i){ arr.splice(k,1); break; } }
    save(); render(); openSheet('fixed'); toast('Удалено');
  });
}
function fixPostpone(t, i){
  dPrompt('До какой даты отложить платёж?', 'Отложить платёж', '2026-09-20').then(function(v){
    if(!v){ return; }
    var key = t==='pay' ? 'pays' : 'subs';
    var arr = D[key];
    for(var k=0;k<arr.length;k++){ if(arr[k].id===i){ arr[k].postponed = v; logDecision('postpone_pay', {name:arr[k].n, amount:arr[k].s, until:v}); break; } }
    save(); render(); openSheet('fixed'); toast('Платёж отложен до '+v);
  });
}

function envMatch(e, x){
  // Конверты с явным списком категорий (новые/настраиваемые)
  if(e.cats && e.cats.length){ return e.cats.indexOf(x.cat||'other') !== -1; }
  // Устаревшие конверты — по имени
  var isTrain = /tutu|электрич|kryukovo/i.test(x.n || '');
  if(e.n.indexOf('Электричка') === 0){ return (x.cat === 'transport') && isTrain; }
  if(e.n.indexOf('Тройка') === 0){ return (x.cat === 'transport') && !isTrain; }
  var key = CAT2ENV[x.cat] || 'Личное';
  return e.n.indexOf(key) === 0;
}

// Категории по умолчанию для конверта по его имени (для старых данных)
function envCatsFromName(n){
  var s = (n||'').toLowerCase();
  if(s.indexOf('электричка') === 0){ return ['transport']; }
  if(s.indexOf('тройка') === 0){ return ['transport']; }
  var out = [];
  for(var c=0;c<CATS.length;c++){
    var base = (CAT2ENV[CATS[c].id]||'').toLowerCase();
    if(base && s.indexOf(base) === 0){ out.push(CATS[c].id); }
  }
  return out.length ? out : null;
}

// Палитра и иконки для конвертов
var ENV_COLORS = [['c-grn','Зелёный'],['c-blu','Синий'],['c-red','Красный'],['c-pur','Фиолетовый'],['c-org','Оранжевый'],['c-cyn','Голубой'],['c-pnk','Розовый'],['c-yel','Жёлтый'],['c-mnt','Мятный']];
var ENV_ICONS = ['i-cart','i-coffee','i-scoot','i-taxi','i-train','i-home','i-med','i-shirt','i-gift','i-sub','i-card','i-beach','i-target','i-user','i-fun','i-wallet'];

function openSheet(t, i){
  window._sheetCur = t;
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
    var curPay = salaryDate(now.getFullYear(), now.getMonth());
    var nextPayDate = now < curPay ? curPay : cycleEnd(curPay);
        h = sheetHead('i-cal','c-pur','Цикл зарплаты', cycleLabel(cs))
      + rowHtml('Ближайшая зарплата', payDateStr(nextPayDate))
      + rowHtml('Дней до зарплаты', daily.daysLeft + ' дн.')
      + rowHtml('Дневной лимит', fmt(daily.perDay))
      + rowHtml('Чистый остаток', fmt(calcSafeBalance()))
      + tipHtml('Зарплата '+D.salaryDay+'-го числа; если выпадает на выходные — приходит в пятницу или понедельник. Цикл считается от реальной даты поступления.');
  } else if(t === 'upcoming-detail'){
    var nowU = new Date();
    function itemsUp(days){
      var arr = [], iu;
      for(iu=0;iu<D.pays.length;iu++){
        var dff = (D.pays[iu].d - nowU.getDate() + 31) % 31;
        if(dff <= days){ arr.push({n:D.pays[iu].n, s:D.pays[iu].s, diff:dff, type:'pay', id:D.pays[iu].id}); }
      }
      for(iu=0;iu<D.insts.length;iu++){
        var dd = parseD(D.insts[iu].d);
        var d2 = Math.round((dd - nowU) / 864e5);
        if(d2 >= 0 && d2 <= days){ arr.push({n:D.insts[iu].n, s:D.insts[iu].s, diff:d2, type:'inst', id:D.insts[iu].id}); }
      }
      for(iu=0;iu<(D.credits||[]).length;iu++){
        if(!((D.credits[iu].pay||0) > 0)){ continue; }
        var dc = ((D.credits[iu].d || 1) - nowU.getDate() + 31) % 31;
        if(dc <= days){ arr.push({n:'Кредит: '+D.credits[iu].n, s:D.credits[iu].pay, diff:dc, type:'cred', id:D.credits[iu].id}); }
      }
      arr.sort(function(a,b){ return a.diff - b.diff; });
      return arr;
    }
    var up3 = itemsUp(3);
    var upUse = up3.length ? up3 : itemsUp(7);
    var upSum = 0;
    for(var us=0;us<upUse.length;us++){ upSum += upUse[us].s; }
    h = sheetHead('i-card','c-blu', up3.length ? 'Платежи на 3 дня' : 'Платежи на 7 дней', fmt(upSum))
      + '<div class="cap" style="margin:8px 4px 4px">По порядку · отметка записывает трату</div>';
    for(var uv=0;uv<upUse.length;uv++){
      var ui2 = upUse[uv];
      var whenU = ui2.diff === 0 ? 'сегодня' : (ui2.diff === 1 ? 'завтра' : 'через '+ui2.diff+' дн.');
      h += '<div class="dig-item" style="flex-wrap:wrap"><span style="flex:1;min-width:120px">'+esc(ui2.n)+' <span style="font-size:11px">· '+whenU+'</span></span>'
        + '<span class="row-actions"><b>'+fmt(ui2.s)+'</b>';
      if(ui2.type === 'pay'){ h += '<button class="mini-btn" data-act="pay-paid" data-i="'+ui2.id+'" title="Отметить оплаченным"><svg class="ic"><use href="#i-check"/></svg></button>'; }
      else if(ui2.type === 'inst'){ h += '<button class="mini-btn" data-act="inst-pay" data-i="'+ui2.id+'" title="Оплатить"><svg class="ic"><use href="#i-check"/></svg></button>'; }
      else { h += '<button class="mini-btn" data-act="nav" data-p="budget" title="Кредиты"><svg class="ic"><use href="#i-chev"/></svg></button>'; }
      h += '</span></div>';
    }
    if(!upUse.length){ h += '<div class="dig-item"><span>Ближайших платежей нет</span><b>—</b></div>'; }
    h += tipHtml('Галочка у платежа — «оплатил»: запишется трата и платёж станет отмеченным в этом цикле.');
  } 
  else if(t === 'goals'){
    var total = 0, actN = 0, doneN = 0;
    for(var ig3=0;ig3<(D.goals||[]).length;ig3++){
      total += D.goals[ig3].cur || 0;
      if(D.goals[ig3].done){ doneN++; } else { actN++; }
    }
    h = sheetHead('i-target','c-pur','Цели и копилки', actN+' активн. · '+doneN+' выполн. · '+fmt(total)+' накоплено')
      + '<div id="goalChartsContainer" style="margin:8px 0;display:flex;flex-direction:column;gap:12px"></div>'
      + goalsHtml();
  }
  else if(t === 'income'){
    h = sheetHead('i-wallet','c-grn','Доход', fmt(D.income)+' в месяц')
      + rowHtml('Зарплата', D.salaryDay+'-го числа, авто')
      + '<div class="form" style="margin-top:12px"><input class="inp" id="in1" type="number" value="'+D.income+'" placeholder="Зарплата, ₽"><input class="inp" id="in2" type="number" value="'+D.salaryDay+'" placeholder="День зарплаты"></div>'
      + '<button class="sh-btn" data-act="income-edit">Сохранить</button>';
  } 
  else if(t === 'leaks'){
    var nowL = new Date();
    var dL = new Date(nowL.getFullYear(), nowL.getMonth() + leakOff, 1);
    var listLk = leaksFor(dL.getFullYear(), dL.getMonth());
    var ls2 = 0; var lr2 = '';
    for(var l2=0;l2<listLk.length;l2++){
      if(!listLk[l2].fixed){ ls2 += listLk[l2].over; }
      lr2 += '<div class="dig-item" style="cursor:pointer" data-act="sheet" data-t="leak" data-i="'+listLk[l2].id+'" data-m="'+leakOff+'"><span>'+listLk[l2].n+(listLk[l2].fixed?' · устранено':'')+'</span><b>+'+fmt(listLk[l2].over)+' ›</b></div>';
    }
    h = sheetHead('i-shield','c-red','Утечки','перерасход '+fmt(ls2)+' за месяц')
      + '<div class="msw" style="margin:0 0 10px"><button data-act="leak-prev">‹</button><b>'+MONTHS[dL.getMonth()]+' '+dL.getFullYear()+'</b><button data-act="leak-next">›</button></div>'
      + (lr2 || rowHtml('В этом месяце утечек нет','—'))
      + tipHtml('Утечка = категория, где траты превысили лимит. Нажми на строку, чтобы увидеть транзакции.');
  } else if(t === 'leak'){
    var env2 = null;
    for(var q2=0;q2<D.envs.length;q2++){ if(D.envs[q2].id === i){ env2 = D.envs[q2]; } }
    if(env2){
      var mOff = window._sheetM || 0;
      var nowL2 = new Date();
      var dL2 = new Date(nowL2.getFullYear(), nowL2.getMonth() + mOff, 1);
      var from2 = new Date(dL2.getFullYear(), dL2.getMonth(), 1);
      var to2 = new Date(dL2.getFullYear(), dL2.getMonth()+1, 1);
      var txs = allSpends().filter(function(x){ return envMatch(env2, x) && x.d >= from2 && x.d < to2; }).sort(function(a,b){ return b.d - a.d; });
      var tot2 = 0; for(var t2=0;t2<txs.length;t2++){ tot2 += txs[t2].s; }
      h = sheetHead('i-shield','c-red', env2.n, txs.length+' транзакций · '+MONTHS[dL2.getMonth()]+' '+dL2.getFullYear())
        + rowHtml('Потрачено', fmt(tot2))
        + rowHtml('Лимит', fmt(env2.lim))
        + rowHtml('Перерасход', fmt(Math.max(0, tot2 - env2.lim)))
        + '<div class="cap" style="margin:10px 4px 6px">Все транзакции категории</div>';
      for(var t3=0;t3<txs.length;t3++){
        h += '<div class="dig-item"><span>'+txs[t3].d.getDate()+'.'+String(txs[t3].d.getMonth()+1).padStart(2,'0')+' · '+txs[t3].n+'</span><b>-'+fmt(txs[t3].s)+'</b></div>';
      }
      if(!txs.length){ h += '<div class="dig-item"><span>Транзакций за месяц нет</span><b>—</b></div>'; }
      if(mOff === 0){ h += '<button class="sh-btn" style="margin-top:12px;background:rgba(48,209,88,.15);color:var(--grn)" data-act="leak-fix" data-i="'+env2.id+'" data-m="0">Устранено</button>'; }
    }
    } else if(t === 'tip'){
    var tl2 = smartTips();
    h = sheetHead('i-cap','c-pur','Умный совет','на основе твоих данных')
      + '<p style="font-size:14px">'+tl2[(window._tipIdx != null ? window._tipIdx : new Date().getDate()) % tl2.length]+'</p>'
      + '<button class="sh-btn" data-act="nexttip">Еще совет</button>';

  } else if(t === 'learn'){
    var les = null;
    for(var la=0;la<LESSONS.length;la++){ if(LESSONS[la].id === i){ les = LESSONS[la]; break; } }
    if(les){
      var dnL = (D.learned||[]).indexOf(les.id) !== -1;
      h = sheetHead('i-book', dnL?'c-grn':'c-pur', les.t, dnL?'урок изучён':'урок · 1 минута')
        + '<p style="font-size:14px;line-height:1.6;margin:4px 0 10px">'+les.x+'</p>'
        + '<div class="sh-tip"><b>Как применить сегодня:</b><br>'+lessonApply(les.id)+'</div>'
        + (dnL ? '' : '<button class="sh-btn" style="margin-top:12px;background:rgba(48,209,88,.15);color:var(--grn)" data-act="learn-done" data-i="'+les.id+'">Изучено</button>');
    }
  } else if(t === 'health'){
    var safeH = calcSafeBalance();
    var cushH = null;
    for(var gh=0;gh<(D.goals||[]).length;gh++){ if(/подушк/i.test(D.goals[gh].n) && !D.goals[gh].done){ cushH = D.goals[gh]; break; } }
    var cush = cushH ? (cushH.cur||0) : 0;
    var cushT = cushH ? cushH.target : 100000;
    var actL = activeLeaks().length;
    var pCush = Math.min(30, Math.round((cush / cushT) * 30));
    var pSafe = safeH > 0 ? 20 : 0;
    var pLeak = actL * 7;
    var score = Math.max(10, Math.min(100, 50 + pCush + pSafe - pLeak));
    h = sheetHead('i-shield','c-pur','Индекс прочности','как считается балл')
      + rowHtml('База каждого', '50 баллов')
      + rowHtml('Подушка: '+fmt(cush)+' из '+fmt(cushT), '+'+pCush+' баллов')
      + rowHtml('Свободные деньги после платежей', pSafe > 0 ? '+20 баллов' : '0 баллов')
      + rowHtml('Активные утечки ('+actL+')', '−'+pLeak+' баллов')
      + rowHtml('Твой индекс', score+' / 100')
      + tipHtml('Индекс показывает, насколько бюджет устойчив к форс-мажорам. Растёт от подушки безопасности и свободных денег, падает от активных утечек.');
  } else if(t === 'daily'){
    var realD = realBal();
    var payD = nextPay(30);
    var safeD = calcSafeBalance();
    var dailyD = calcDailyLimit();
    h = sheetHead('i-cal','c-blu','Дневной лимит','откуда берётся цифра')
      + rowHtml('Реальный остаток', fmt(realD))
      + rowHtml('Платежи на 30 дней', '−'+fmt(payD))
      + rowHtml('Безопасно к трате', fmt(safeD))
      + rowHtml('Дней до зарплаты', dailyD.daysLeft+' дн.')
      + rowHtml('Лимит на день', fmt(dailyD.perDay))
      + tipHtml('Формула: (остаток − платежи на 30 дней) ÷ дней до зарплаты. Столько можно тратить каждый день, чтобы денег гарантированно хватило до зарплаты.');
  } else if(t === 'fixed'){
    var paysSum = 0, subsSum = 0;
    for(var a1=0;a1<D.pays.length;a1++){ paysSum += D.pays[a1].s; }
    for(var a2=0;a2<D.subs.length;a2++){ if(!D.subs[a2].off){ subsSum += D.subs[a2].s; } }
    h = sheetHead('i-card','c-blu','Обязательные траты','из чего складывается сумма на панели')
      + rowHtml('Платежи в месяц', fmt(paysSum))
      + rowHtml('Активные подписки', fmt(subsSum))
      + rowHtml('Итого / мес', fmt(paysSum + subsSum))
      + tipHtml('Карточка «Обязательства / мес» на панели = платежи + активные подписки. Кредиты и рассрочки показаны ниже отдельным списком и в эту сумму не входят.')
      + '<div class="cap" style="margin:10px 4px 6px">Платежи</div>';
    for(var fp=0;fp<D.pays.length;fp++){
      var pp=D.pays[fp];
      h += '<div class="dig-item"><span>'+pp.n+' · '+pp.d+'-го'+(pp.postponed?' · отложен до '+pp.postponed:'')+'</span><span class="row-actions"><b>'+fmt(pp.s)+'</b>'
        + '<button class="mini-btn" data-act="edit" data-t="pay" data-i="'+pp.id+'"><svg class="ic"><use href="#i-pen"/></svg></button>'
        + '<button class="mini-btn" data-act="postpone" data-t="pay" data-i="'+pp.id+'"><svg class="ic"><use href="#i-cal"/></svg></button>'
        + '<button class="mini-btn danger" data-act="fix-del" data-t="pay" data-i="'+pp.id+'"><svg class="ic"><use href="#i-trash"/></svg></button></span></div>';
    }
    h += '<div class="cap" style="margin:10px 4px 6px">Подписки</div>';
    for(var fs=0;fs<D.subs.length;fs++){
      var ss=D.subs[fs];
      h += '<div class="dig-item"><span>'+ss.n+(ss.off?' · отключена':'')+'</span><span class="row-actions"><b>'+fmt(ss.s)+'/мес</b>'
        + '<button class="mini-btn" data-act="edit" data-t="sub" data-i="'+ss.id+'"><svg class="ic"><use href="#i-pen"/></svg></button>'
        + '<button class="mini-btn danger" data-act="fix-del" data-t="sub" data-i="'+ss.id+'"><svg class="ic"><use href="#i-trash"/></svg></button></span></div>';
    }
    h += '<div class="cap" style="margin:10px 4px 6px">Кредиты и рассрочки (вне итога)</div>';
    for(var fc=0;fc<D.credits.length;fc++){
      var cc=D.credits[fc];
      var credInfo = (cc.pay>0) ? ' · платёж '+fmt(cc.pay)+'/'+(cc.d||1)+'-го' : ' · платёж не задан';
      h += '<div class="dig-item"><span>'+cc.n+credInfo+'</span><span class="row-actions"><b>'+fmt(cc.cur)+'</b>'
        + '<button class="mini-btn" data-act="edit" data-t="cred" data-i="'+cc.id+'"><svg class="ic"><use href="#i-pen"/></svg></button>'
        + '<button class="mini-btn danger" data-act="fix-del" data-t="cred" data-i="'+cc.id+'"><svg class="ic"><use href="#i-trash"/></svg></button></span></div>';
    }
    for(var fi=0;fi<D.insts.length;fi++){
      var ii=D.insts[fi];
      h += '<div class="dig-item"><span>'+ii.n+' · '+ii.d+'</span><span class="row-actions"><b>'+fmt(ii.s)+'</b>'
        + '<button class="mini-btn" data-act="edit" data-t="inst" data-i="'+ii.id+'"><svg class="ic"><use href="#i-pen"/></svg></button>'
        + '<button class="mini-btn danger" data-act="fix-del" data-t="inst" data-i="'+ii.id+'"><svg class="ic"><use href="#i-trash"/></svg></button></span></div>';
    }
    h += '<div class="dlg-btns" style="margin-top:14px"><button class="sh-btn" style="margin:0" data-act="add" data-t="pay">+ Платёж</button><button class="sh-btn ghost" style="margin:0" data-act="add" data-t="sub">+ Подписка</button></div>';
   } else if(t === 'runway'){
    var f = forecastCashFlow(90);
    var rw3 = cashRunway();
    var minB3 = minBalance(90);
    var h = sheetHead('i-cal','c-blu','Прогноз баланса','прогноз на 90 дней')
      + rowHtml('Денег хватит на', rw3 >= 90 ? '90+ дней' : rw3+' дн')
      + rowHtml('Минимум за 90 дней', fmt(minB3.val)+' · через '+minB3.daysFromNow+' дн')
      + rowHtml('Дневной темп гибких', fmt(f.flexPerDay)+'/день')
      + '<div class="cap" style="margin:10px 4px 6px">График прогноза</div>'
      + '<div class="sh-tip" style="margin-bottom:8px">Линия показывает, сколько денег останется на счету в каждый день. Вверх — пришла зарплата, вниз — уходят платежи и повседневные траты. Красная зона внизу — деньги кончились и ты в долгу.</div>'
      + '<div style="position:relative;background:rgba(255,255,255,.03);border-radius:12px;padding:8px;margin-bottom:6px"><canvas id="forecastChart" style="width:100%;display:block"></canvas></div>'
+ '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">'
+ '<button class="mini-btn" data-act="fc-zoom" data-t="out" style="min-width:32px">−</button>'
+ '<button class="mini-btn" data-act="fc-zoom" data-t="in" style="min-width:32px">+</button>'
+ '<button class="mini-btn" data-act="fc-zoom" data-t="reset">весь период</button>'
+ '<span id="fcRange" style="font-size:10px;color:var(--mut);margin-left:auto"></span></div>'
+ '<div style="display:flex;flex-wrap:wrap;gap:4px 12px;font-size:10px;color:var(--mut);margin-bottom:8px">'
+ '<span><i style="display:inline-block;width:12px;height:3px;background:#64d2ff;border-radius:2px;vertical-align:middle"></i> деньги на счету</span>'
+ '<span><i style="display:inline-block;width:12px;height:3px;background:#ff453a;border-radius:2px;vertical-align:middle"></i> уход в минус</span>'
+ '<span style="color:#30d158">ЗП — приход зарплаты</span>'
+ '<span style="color:#ff9f0a">стрелка вниз — крупное списание</span>'
+ '<span>дно — самый бедный день</span></div>'
+ '<div id="fcInfo" class="sh-tip" style="margin-top:6px">Тапни по любому дню — покажу, сколько останется, из чего сложилась эта цифра и что делать. Щипок двумя пальцами приближает, перетаскивание двигает по датам.</div>'
+ '<div class="cap" style="margin:10px 4px 6px">Что произойдёт в ближайшие 30 дней</div>'
+ '<div id="fcExplain"></div>'
+ '<div class="cap" style="margin:10px 4px 6px">Ближайшие события</div>';
    var shown = 0;
    for(var ei=0;ei<f.events.length && shown<8;ei++){
      if(f.events[ei].date < new Date()){ continue; }
      h += '<div class="dig-item"><span>'+f.events[ei].date.getDate()+'.'+String(f.events[ei].date.getMonth()+1).padStart(2,'0')+' · '+f.events[ei].n+'</span><b class="'+(f.events[ei].amt>0?'pos':'')+'">'+(f.events[ei].amt>0?'+':'−')+fmt(Math.abs(f.events[ei].amt))+'</b></div>';
      shown++;
    }
    h += '<div style="margin-top:14px;display:flex;gap:8px">'
      + '<button class="sh-btn" style="margin:0;flex:1" data-act="whatif">Что если…</button>'
      + '<button class="sh-btn ghost" style="margin:0;flex:1" data-act="debt-plan">План выхода из долгов</button>'
      + '</div>';
    h += tipHtml(minB3.val < 0 ? 'Через '+minB3.daysFromNow+' дн баланс уйдёт в минус. Открой «Что если» и посмотри, что срезать.' : 'Прогноз стабильный — минимум положительный.');
    $('sheetBody').innerHTML = h;
        // После отрисовки целей добавляем мини-графики
    setTimeout(function() {
        var container = document.getElementById('goalChartsContainer');
        if (!container) return;
        container.innerHTML = '';
        var goals = D.goals || [];
        var activeGoals = goals.filter(function(g) { return !g.done; });
        // Рисуем графики только для активных целей (не более 5)
        var toShow = activeGoals.slice(0, 5);
        for (var i = 0; i < toShow.length; i++) {
            var wrapper = document.createElement('div');
            wrapper.style.cssText = 'background:rgba(255,255,255,.03);border-radius:8px;padding:4px 8px;margin-bottom:4px';
            var label = document.createElement('div');
            label.style.cssText = 'display:flex;justify-content:space-between;font-size:10px;color:var(--mut);margin-bottom:2px';
            label.innerHTML = '<span>' + toShow[i].n + '</span><span>' + Math.round((toShow[i].cur||0)/Math.max(1,toShow[i].target)*100) + '%</span>';
            wrapper.appendChild(label);
            var chartContainer = document.createElement('div');
            chartContainer.style.cssText = 'width:100%;height:60px';
            wrapper.appendChild(chartContainer);
            container.appendChild(wrapper);
            drawGoalMiniChart(chartContainer, toShow[i]);
        }
        if (toShow.length === 0) {
            container.innerHTML = '<div style="font-size:11px;color:var(--mut);text-align:center;padding:8px">Нет активных целей для отображения</div>';
        }
    }, 100);
    $('sheet').classList.add('on'); $('shb').classList.add('on');
setTimeout(function(){ drawForecastChart(f); explainForecast(f); }, 60);
} else if(t === 'saverate'){
    var nowS = new Date();
    var mF = new Date(nowS.getFullYear(), nowS.getMonth(), 1), mT = new Date(nowS.getFullYear(), nowS.getMonth()+1, 1);
    var incS = 0;
    for(var iS=0;iS<(D.incomes||[]).length;iS++){ var dS = parseD(D.incomes[iS].d); if(dS >= mF && dS < mT){ incS += D.incomes[iS].s; } }
    var spS = 0; var allS = allSpends();
    for(var jS=0;jS<allS.length;jS++){ if(allS[jS].d >= mF && allS[jS].d < mT){ spS += allS[jS].s; } }
    var rateS = incS > 0 ? Math.round((incS - spS)/incS*100) : 0;
    h = sheetHead('i-in','c-grn','Норма сбережений','доля дохода, которую ты не тратишь')
      + rowHtml('Поступило в этом месяце', fmt(incS))
      + rowHtml('Потрачено', fmt(spS))
      + rowHtml('Сберегаешь', rateS+'%')
      + tipHtml(rateS >= 10 ? 'Отличный результат: финансово здоровая норма — от 10%. Продолжай платить себе первым.' : 'Старайся держать от 10%. Начни с автоперевода в копилку в день зарплаты — кнопка «В копилку» на панели.');
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
    h = '<div class="form"><input class="inp" id="in1" placeholder="Название" value="'+(it?it.n:'')+'">'
      + '<div class="row2"><input class="inp" id="in2" type="number" placeholder="Текущий долг, ₽" value="'+(it?it.cur:'')+'"><input class="inp" id="in3" type="number" placeholder="Итоговая сумма, ₽" value="'+(it?it.total:'')+'"></div>'
      + '<div class="row2"><input class="inp" id="in4" type="number" placeholder="Платёж в месяц, ₽" value="'+(it&&it.pay?it.pay:'')+'"><input class="inp" id="in5" type="number" placeholder="День списания" value="'+(it&&it.d?it.d:'')+'"></div>'
      + '<div class="hint">Платёж и день нужны, чтобы прогноз честно учитывал кредит. Останется долг — платежи прекратятся.</div></div>';
  }
  if(t==='inst'){ it = i?get(D.insts):null; title = it?'Рассрочка':'Новая рассрочка';
    h = '<div class="form"><input class="inp" id="in1" placeholder="Название" value="'+(it?it.n:'')+'"><div class="row2"><input class="inp" id="in2" type="number" placeholder="Платёж, ₽" value="'+(it?it.s:'')+'"><input class="inp" id="in3" type="date" value="'+(it?it.d:'')+'"></div></div>';
  }
  if(t==='env'){
    it = i?get(D.envs):null;
    if(it){
      window._ef = {t:'env', id:i};
      window._envDraft = {name:it.n, lim:it.lim, cats:(it.cats&&it.cats.length)?it.cats.slice():(envCatsFromName(it.n)||['other']), ic:it.ic||'i-gift', k:it.k||'c-pur', _save:'form-save-env', _saveTxt:'Сохранить конверт', _title:'Конверт · '+it.n, _id:it.id};
    } else {
      openEnvAdd(); return;
    }
    renderEnvForm();
    return;
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
    if(f.id){ it=find(D.credits); if(it){ it.n=g('in1')||it.n; it.cur=parseFloat(g('in2'))||0; it.total=parseFloat(g('in3'))||it.cur; it.pay=parseFloat(g('in4'))||0; it.d=parseInt(g('in5'),10)||it.d||1; } }
    else { var c0=parseFloat(g('in2'))||0; D.credits.push({id:Date.now(), n:g('in1')||'Кредит', cur:c0, total:parseFloat(g('in3'))||c0, pay:parseFloat(g('in4'))||0, d:parseInt(g('in5'),10)||1}); }
  }
  if(f.t==='inst'){
    if(f.id){ it=find(D.insts); if(it){ it.n=g('in1')||it.n; it.s=parseFloat(g('in2'))||it.s; it.d=g('in3')||it.d; } }
    else { D.insts.push({id:Date.now(), n:g('in1')||'Рассрочка', s:parseFloat(g('in2'))||0, d:g('in3')||iso(new Date())}); }
  }
  if(f.t==='env'){
    envDraftSyncInputs();
    var dE = window._envDraft;
    it = find(D.envs);
    if(it && dE){
      if(dE.name){ it.n = dE.name; }
      it.lim = parseFloat(dE.lim) || it.lim;
      it.cats = dE.cats;
      it.ic = dE.ic; it.k = dE.k;
    }
  }
  save(); closeSheet(); render(); toast('Сохранено');
}

function delEdit(){
  var f = window._ef; if(!f || !f.id){ return; }
  dConfirm('Удалить запись?', 'Удаление', true).then(function(ok){
    if(!ok){ return; }
    function rm(key){ var arr=D[key]; for(var k=0;k<arr.length;k++){ if(arr[k].id===f.id){ arr.splice(k,1); break; } } }
    if(f.t==='sub'){ rm('subs'); }
    if(f.t==='pay'){ rm('pays'); }
    if(f.t==='cred'){ rm('credits'); }
    if(f.t==='inst'){ rm('insts'); }
    if(f.t==='env'){ rm('envs'); }
    save(); closeSheet(); render(); toast('Удалено');
  });
}

function cycleKey(){ var cs = cycleStart(new Date()); return cs.getFullYear()+'-'+cs.getMonth(); }
function renderBudSummary(){
  var el = $('budSummary');
  if(!el){ return; }
  if(!(D.income > 0)){
    el.innerHTML = '<div class="cap-title"><span>Бюджет цикла</span><b style="font-size:11px;color:var(--mut)">ждёт дохода</b></div>'
      + '<div class="note" style="margin:0">Укажите доход в карточке «Доход в месяц» на Панели — и здесь появится план: сколько занимают обязательные платежи, конверты и что остаётся.</div>';
    return;
  }
  var paysSum = 0, subsSum = 0, envSum = 0, i;
  for(i=0;i<D.pays.length;i++){ paysSum += D.pays[i].s; }
  for(i=0;i<D.subs.length;i++){ if(!D.subs[i].off){ subsSum += D.subs[i].s; } }
  for(i=0;i<D.envs.length;i++){ envSum += D.envs[i].lim; }
  var fixed = paysSum + subsSum;
  var used = fixed + envSum;
  var inc = D.income || 1;
  var pct = Math.min(100, Math.round(used/inc*100));
  var col = pct > 100 ? 'var(--red)' : (pct > 85 ? 'var(--org)' : 'var(--grn)');
  var free = calcSafeBalance();
    var label = D.cycleMode === 'salary' ? 'Бюджет цикла' : 'Бюджет месяца';
  var unalloc = (D.income||0) - fixed - envSum;
  var unallocHtml = '';
  if((D.income||0) > 0){
    if(unalloc < 0){
      unallocHtml = '<span style="color:var(--red)">Перебор: <b style="color:var(--red)">'+fmt(-unalloc)+'</b></span>';
    } else {
      unallocHtml = '<span>Не распределено: <b style="color:var(--grn)">'+fmt(unalloc)+'</b></span>';
    }
  }
  el.innerHTML = '<div class="cap-title"><span>'+label+'</span><b style="color:'+col+'">занято '+pct+'% дохода</b></div>'
    + '<div class="bar-large" style="height:8px;margin:8px 0"><i style="width:'+pct+'%;background:'+col+'"></i></div>'
    + '<div class="hist-sum" style="margin:0"><span>Обязательные: <b>'+fmt(fixed)+'</b></span><span>Конверты: <b>'+fmt(envSum)+'</b></span><span>Свободно: <b style="color:var(--grn)">'+fmt(free)+'</b></span>'+unallocHtml+'</div>'
    + (unalloc > 0 && (D.income||0) > 0 ? '<div class="note" style="margin-top:6px">Эти деньги не получили задачу. Направь их в цель — «В копилку» на панели, иначе они растворятся в мелких тратах.</div>' : (unalloc < 0 ? '<div class="note" style="margin-top:6px;color:var(--red)">План тратит больше дохода — сократи конверты или обязательные.</div>' : ''));
}
function renderEnv(){
  var now = new Date();
  var cs = cycleStart(now); var ce = cycleEnd(cs);
  var totalDays = Math.max(1, Math.round((ce - cs)/864e5));
  var elapsed = Math.max(1, Math.round((now - cs)/864e5));
  var list = allSpends().filter(function(x){ return inCycle(x.d, cs); });
  var h = '';
  for(var i=0;i<D.envs.length;i++){
    var e = D.envs[i];
    var f = 0;
    for(var a=0;a<list.length;a++){ if(envMatch(e, list[a])){ f += list[a].s; } }
    var p = e.lim > 0 ? Math.round(f / e.lim * 100) : 0;
    var cls = p > 100 ? 'var(--red)' : (p > 85 ? 'var(--org)' : 'var(--grn)');
    var prog = Math.round(f / elapsed * totalDays);
    var paceTxt = e.lim > 0 ? (prog > e.lim ? 'темп '+fmt(prog)+' к концу цикла · перебор '+fmt(prog - e.lim) : 'вписываешься · темп '+fmt(prog)+' к концу цикла') : '';
    var paceCol = e.lim > 0 ? (prog > e.lim ? 'var(--red)' : 'var(--grn)') : 'var(--mut)';
      h += '<div class="env glass hov" data-act="env" data-i="'+e.id+'">'
      + '<header><div class="env-name"><div class="sic '+e.k+'" style="width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center"><svg class="ic"><use href="#'+e.ic+'"/></svg></div>'+esc(e.n)+'</div>'
      + '<b class="'+(f > e.lim ? 'over' : '')+'">'+fmt(f)+' / '+fmt(e.lim)+'</b></header>'
      + '<div class="bar-large" style="height:6px;margin-top:8px"><i style="width:'+Math.min(100,p)+'%;background:'+cls+'"></i></div>'
      + '<div class="note">'+p+'% лимита · <span style="color:'+paceCol+'">'+paceTxt+'</span></div></div>';
  }
  $('envList').innerHTML = h || '<p style="color:var(--mut);font-size:12px;padding:4px 8px 12px">Конвертов нет. Начните с одного: например, «Продукты» с лимитом на цикл.</p>';
}

function openEnv(i){
  var e = null;
  for(var k=0;k<D.envs.length;k++){ if(D.envs[k].id === i){ e = D.envs[k]; } }
  if(!e){ return; }
  window._envOpenId = i;
  var cs = cycleStart(new Date());
  var list = allSpends().filter(function(x){ return inCycle(x.d, cs) && envMatch(e, x); });
  list.sort(function(a,b){ return b.d - a.d; });
  var f = 0;
  var rows = '';
  for(var r=0;r<list.length;r++){
    f += list[r].s;
    rows += '<div class="dig-item"><span>'+list[r].d.getDate()+'.'+String(list[r].d.getMonth()+1).padStart(2,'0')+'.'+list[r].d.getFullYear()+' · '+esc(list[r].n)+'</span><b>-'+fmt(list[r].s)+'</b></div>';
  }
  if(!rows){ rows = '<div class="dig-item"><span>Трат в этом цикле нет</span><b>—</b></div>'; }
  // Частые покупки этого конверта за 60 дней — шаблоны в один тап
  var fromT = new Date(Date.now() - 60*864e5);
  var tMap = {};
  var allE = allSpends();
  for(var te=0;te<allE.length;te++){
    var xe = allE[te];
    if(xe.d < fromT || !envMatch(e, xe)){ continue; }
    var mk = merchName(xe.n).toLowerCase();
    if(!tMap[mk]){ tMap[mk] = {n:merchName(xe.n), s:xe.s, c:0}; }
    tMap[mk].c++; tMap[mk].s = xe.s;
  }
  var tArr = [];
  for(var tk in tMap){ tArr.push(tMap[tk]); }
  tArr.sort(function(a,b){ return b.c - a.c; });
  var tplH = '';
  for(var tt=0;tt<tArr.length && tt<3;tt++){
    tplH += '<button class="chip" data-act="env-tpl" data-n="'+esc(tArr[tt].n)+'" data-s="'+tArr[tt].s+'">'+esc(tArr[tt].n)+' · '+fmt(tArr[tt].s)+'</button>';
  }
  $('sheetBody').innerHTML = sheetHead(e.ic, e.k, esc(e.n), 'конверт · цикл '+cycLabel(cs))
    + rowHtml('Лимит', fmt(e.lim))
    + rowHtml('Потрачено', fmt(f))
    + rowHtml('Остаток', fmt(e.lim - f))
    + '<div class="cap" style="margin:14px 4px 6px">Добавить трату в конверт</div>'
    + '<div class="form">'
    + '<input class="inp" id="envQaAmt" type="number" inputmode="decimal" placeholder="Сумма, ₽">'
    + '<input class="inp" id="envQaNote" placeholder="Что это? Например: Пятёрочка">'
    + '</div>'
    + (tplH ? '<div class="h-actions" style="margin:8px 0 0">'+tplH+'</div>' : '')
    + '<div class="dlg-btns" style="margin-top:10px">'
    + '<button class="sh-btn ghost" style="margin:0;flex:1" data-act="env-qa-more">Сохранить и ещё</button>'
    + '<button class="sh-btn" style="margin:0;flex:1" data-act="env-qa-add">Добавить</button>'
    + '</div>'
    + '<div class="cap" style="margin:14px 4px 6px">Все траты конверта ('+list.length+')</div>'
    + '<div style="max-height:260px;overflow-y:auto">'+rows+'</div>'
    + '<button class="sh-btn ghost" data-act="env-edit-open" data-i="'+e.id+'">Настроить конверт — лимит, значок, цвет</button>';
  $('sheet').classList.add('on');
  $('shb').classList.add('on');
}

function renderPays(){
  var key = cycleKey();
  D.paid = D.paid || {};
  var marks = D.paid[key] || {};
  var h = '';
  for(var i=0;i<D.pays.length;i++){
    var p = D.pays[i];
    var paid = marks[p.id];
    h += '<div class="env glass hov" data-act="edit" data-t="pay" data-i="'+p.id+'" style="'+(paid?'opacity:.65':'')+'">'
      + '<header><div class="env-name"><div class="sic '+(paid?'c-grn':'c-blu')+'" style="width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center"><svg class="ic"><use href="#'+(paid?'i-check':'i-cal')+'"/></svg></div>'+esc(p.n)+(paid?' · оплачено':'')+'</div><b>'+fmt(p.s)+' · '+p.d+'-го</b></header>'
      + '<div class="note">ежемесячно · тап по карточке — изменить</div>'
      + (paid ? '<button class="sh-btn ghost" style="margin-top:8px" data-act="pay-unpaid" data-i="'+p.id+'">Снять отметку</button>' : '<button class="sh-btn" style="margin-top:8px;background:rgba(48,209,88,.15);color:var(--grn)" data-act="pay-paid" data-i="'+p.id+'">Отметить оплаченным</button>')
      + '</div>';
  }
  $('paysList').innerHTML = h || '<p style="color:var(--mut);font-size:12px;padding:4px 8px 12px">Платежей нет — добавьте первый</p>';
}

function renderSubs(){
  var aud = subAudit();
  var audMap = {};
  for(var a=0;a<aud.length;a++){ audMap[aud[a].sub.id] = aud[a]; }
  var h = '';
  for(var i=0;i<D.subs.length;i++){
    var s = D.subs[i];
    var fact = '';
    if(!s.off && audMap[s.id]){
      var au = audMap[s.id];
      if(au.rose){ fact = '<span style="color:var(--org)">подорожала: было '+fmt(s.s)+', по факту '+fmt(au.lastAmt)+'</span>'; }
      else if(!au.found){ fact = '<span style="color:var(--mut)">списаний не найдено 90+ дней</span>'; }
      else if(au.lastAmt > 0){ fact = 'по факту '+fmt(au.lastAmt)+' · '+fmt(s.s*12)+' в год'; }
      else { fact = 'активна · '+fmt(s.s*12)+' в год'; }
    } else {
      fact = s.off ? 'отключена' : 'активна · '+fmt(s.s*12)+' в год';
    }
    h += '<div class="env glass hov" data-act="edit" data-t="sub" data-i="'+s.id+'"><header><div class="env-name"><div class="sic '+(s.off?'':'c-blu')+'" style="width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;'+(s.off?'opacity:.4':'')+'"><svg class="ic"><use href="#i-sub"/></svg></div>'+esc(s.n)+'</div><b style="'+(s.off?'opacity:.4;text-decoration:line-through':'')+'">'+fmt(s.s)+'/мес</b></header>'
      + '<div class="note">'+fact+'</div>'
      + '<button class="sh-btn '+(s.off?'':'ghost')+'" style="margin-top:8px" data-act="sub-toggle" data-i="'+s.id+'">'+(s.off?'Включить':'Отключить')+'</button></div>';
  }
  $('subsList').innerHTML = h || '<p style="color:var(--mut);font-size:12px;padding:4px 8px 12px">Подписок нет</p>';
}

function renderCredits(){
  var h = '';
  for(var i=0;i<D.credits.length;i++){
    var c = D.credits[i];
    var paid = Math.max(0, Math.round((1 - c.cur / Math.max(1,c.total)) * 100));
    var noteC;
    if((c.pay||0) > 0){
      var mLeft = Math.ceil(c.cur / c.pay);
      noteC = 'платёж '+fmt(c.pay)+' · '+(c.d||1)+'-го · закроете за ~'+mLeft+' мес · погашено '+paid+'%';
    } else {
      noteC = 'платёж не задан — прогноз его не учитывает';
    }
    h += '<div class="env glass hov" data-act="edit" data-t="cred" data-i="'+c.id+'"><header><div class="env-name"><div class="sic c-red" style="width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center"><svg class="ic"><use href="#i-card"/></svg></div>'+esc(c.n)+'</div><b>'+fmt(c.cur)+'</b></header><div class="bar-large" style="height:6px;margin-top:8px"><i style="width:'+paid+'%;background:var(--grn)"></i></div>'
      + '<div class="note">'+noteC+'</div>'
      + ((c.pay||0) > 0
        ? '<button class="sh-btn" style="margin-top:8px;background:rgba(48,209,88,.15);color:var(--grn)" data-act="cred-pay" data-i="'+c.id+'">Внести платёж</button>'
        : '<div class="dlg-btns" style="margin-top:8px"><button class="sh-btn" style="margin:0;flex:1;background:rgba(255,159,10,.15);color:var(--org)" data-act="cred-setpay" data-i="'+c.id+'">Указать платёж</button></div>')
      + '</div>';
  }
  $('credList').innerHTML = h || '<p style="color:var(--mut);font-size:12px;padding:4px 8px 12px">Кредитов нет — отлично!</p>';
}

function renderInsts(){
  if(!$('instsList')){ return; }
  var now = new Date();
  var h = '';
  for(var i=0;i<D.insts.length;i++){
    var x = D.insts[i];
    var d = parseD(x.d);
    var past = d < now;
    h += '<div class="env glass hov" data-act="edit" data-t="inst" data-i="'+x.id+'"><header><div class="env-name"><div class="sic '+(past?'c-grn':'c-org')+'" style="width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center"><svg class="ic"><use href="#i-cal"/></svg></div>'+x.n+'</div><b>'+fmt(x.s)+'</b></header><div class="note">'+d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear()+(past?' · прошло':' · впереди')+' · тап по карточке — изменить</div><button class="sh-btn" style="margin-top:8px;background:rgba(48,209,88,.15);color:var(--grn)" data-act="inst-pay" data-i="'+x.id+'">Оплатить '+fmt(x.s)+'</button></div>';  }
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
  var cols = ['#30d158','#bf5af2','#ff453a','#ff9f0a','#0a84ff','#64d2ff'];
  cv._segs = [];
  cv._hover = -1;
  function paint(hover){
    var x = cv.getContext('2d');
    x.clearRect(0,0,170,170);
    if(tot <= 0){
      x.fillStyle = '#8b91a7'; x.font = '600 11px Manrope, sans-serif'; x.textAlign = 'center';
      x.fillText('Нет трат за период', 85, 85);
      return;
    }
    var a = -Math.PI/2;
    for(var i=0;i<agg.length;i++){
      var w = agg[i].s / tot * Math.PI * 2;
      var lift = (i === hover) ? 4 : 0;
      x.beginPath();
      x.arc(85,85,66+lift,a+0.03,a+w-0.03);
      x.strokeStyle = cols[i % 6];
      x.lineWidth = 22 + lift;
      x.lineCap = 'round';
      if(i === hover){ x.shadowColor = cols[i % 6]; x.shadowBlur = 12; } else { x.shadowBlur = 0; }
      x.stroke();
      x.shadowBlur = 0;
      cv._segs[i] = {id:agg[i].id, a0:a, a1:a+w};
      a += w;
    }
    x.fillStyle = '#f2f4ff'; x.font = '800 17px Manrope, sans-serif'; x.textAlign = 'center';
    x.fillText(Math.round(tot/1000) + 'k', 85, 82);
    x.fillStyle = '#8b91a7'; x.font = '600 10px Manrope, sans-serif';
    x.fillText('₽ за период', 85, 98);
  }
  cv._paint = paint;
  paint(-1);
  if(tot <= 0){ cv.style.cursor = 'default'; $('legend').innerHTML = ''; return; }
  cv.style.cursor = 'pointer';
  function segAt(e){
    var rect = cv.getBoundingClientRect();
    var px = (e.clientX - rect.left) * (170 / rect.width) - 85;
    var py = (e.clientY - rect.top) * (170 / rect.height) - 85;
    var dist = Math.sqrt(px*px + py*py);
    if(dist < 48 || dist > 82){ return -1; }
    var ang = Math.atan2(py, px);
    if(ang < -Math.PI/2){ ang += Math.PI*2; }
    for(var s=0;s<cv._segs.length;s++){
      if(ang >= cv._segs[s].a0 && ang < cv._segs[s].a1){ return s; }
    }
    return -1;
  }
  if(!cv._bound){
    cv._bound = true;
    cv.addEventListener('mousemove', function(e){
      var idx = segAt(e);
      if(idx !== cv._hover){ cv._hover = idx; cv._paint(idx); }
    });
    cv.addEventListener('mouseleave', function(){
      if(cv._hover !== -1){ cv._hover = -1; cv._paint(-1); }
    });
    cv.addEventListener('click', function(e){
      var idx = segAt(e);
      if(idx >= 0 && cv._segs[idx]){ openCatSheet(cv._segs[idx].id); }
    });
  }
  var lg = '';
  for(var i=0;i<agg.length;i++){
    lg += '<div style="cursor:pointer" data-act="an-cat" data-c="'+agg[i].id+'"><i style="background:'+cols[i % 6]+'"></i>'+agg[i].n+'<b>'+Math.round(agg[i].s/tot*100)+'% ›</b></div>';
  }
  $('legend').innerHTML = lg;
}

function drawBarsFor(sp, r){
  var b = $('bars'); if(!b){ return; }
  var y = b.getContext('2d');
  var W = b.clientWidth || 320;
  var H = 150;
  b.width = W * 2; b.height = H * 2;
  b.style.height = H + 'px';
  y.setTransform(2,0,0,2,0,0);
  y.clearRect(0,0,W,H);
  var buckets = []; var labels = []; var i;
  var days = Math.round((r.to - r.from) / 864e5);
  if(days <= 32){
    for(i=0;i<days;i++){ buckets.push(0); labels.push(i+1); }
    for(i=0;i<sp.length;i++){ var idx = Math.floor((sp[i].d - r.from) / 864e5); if(idx >= 0 && idx < days){ buckets[idx] += sp[i].s; } }
  } else {
    var m0 = new Date(r.from.getFullYear(), r.from.getMonth(), 1);
    var cur = new Date(m0);
    while(cur < r.to){ buckets.push(0); labels.push(MONTHS_S[cur.getMonth()]); cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1); }
    for(i=0;i<sp.length;i++){ var mi = (sp[i].d.getFullYear()-m0.getFullYear())*12 + (sp[i].d.getMonth()-m0.getMonth()); if(mi >= 0 && mi < buckets.length){ buckets[mi] += sp[i].s; } }
  }
  var tot = 0, mx = 1;
  for(i=0;i<buckets.length;i++){ tot += buckets[i]; if(buckets[i] > mx){ mx = buckets[i]; } }
  var avg = tot / Math.max(1, buckets.length);
  var bw = W / Math.max(1, buckets.length);
  var now = new Date();
  for(i=0;i<buckets.length;i++){
    var h = buckets[i] / mx * (H - 30);
    var isNow = days <= 32
      ? (r.from.getFullYear()===now.getFullYear() && r.from.getMonth()===now.getMonth() && (i+1)===now.getDate())
      : (i === buckets.length-1);
    y.fillStyle = buckets[i] === 0 ? 'rgba(255,255,255,.07)' : (isNow ? '#30d158' : 'rgba(100,210,255,.45)');
    y.fillRect(i*bw+2, H-14-h, Math.max(3, bw-4), Math.max(2, h));
  }
  var ay = H - 14 - (avg / mx * (H - 30));
  y.strokeStyle = 'rgba(191,90,242,.8)';
  y.setLineDash([4,4]);
  y.beginPath(); y.moveTo(0, ay); y.lineTo(W, ay); y.stroke();
  y.setLineDash([]);
  y.fillStyle = '#8b91a7'; y.font = '600 9px Manrope, sans-serif';
  y.textAlign = 'left';
  y.fillText('среднее '+fmt(avg), 4, ay - 4);
  y.textAlign = 'right';
  y.fillText('макс '+fmt(mx), W - 4, 10);
  y.textAlign = 'center';
  if(days <= 32){
    y.fillText('1', bw/2, H-2);
    y.fillText(String(Math.round(days/2)), (Math.round(days/2)-0.5)*bw, H-2);
    y.fillText(String(days), (days-0.5)*bw, H-2);
    } else {
    for(i=0;i<Math.min(6,buckets.length);i++){
      var li = Math.round(i*(buckets.length-1)/Math.min(5,buckets.length-1));
      y.fillText(labels[li], (li+0.5)*bw, H-2);
    }
  }
  var bm = $('barsMode');
  if(bm){ bm.textContent = days <= 32 ? 'траты по дням · нажми на столбик — откроется день' : 'траты по месяцам'; }
  b._click = {days: days, from: r.from, n: buckets.length};
  if(!b._bound){
    b._bound = true;
    b.addEventListener('click', function(e){
      var info = b._click; if(!info){ return; }
      var rect = b.getBoundingClientRect();
      var idx = Math.floor((e.clientX - rect.left) / (rect.width / info.n));
      if(idx < 0 || idx >= info.n){ return; }
      if(info.days <= 32){
        var d = new Date(info.from.getFullYear(), info.from.getMonth(), info.from.getDate() + idx);
        openDaySheet(iso(d));
      } else {
        toast('Выбери период «Месяц», чтобы открывать дни');
      }
    });
  }
}

function openCompareSheet(){
  var r = periodRange();
  var len = r.to - r.from;
  var pf = new Date(r.from.getTime() - len);
  var cur = allSpends().filter(function(x){ return x.d >= r.from && x.d < r.to; });
  var prev = allSpends().filter(function(x){ return x.d >= pf && x.d < r.from; });
  var cm = {}, pm = {}, totC = 0, totP = 0, i;
  for(i=0;i<cur.length;i++){ var k1 = cur[i].cat||'other'; cm[k1]=(cm[k1]||0)+cur[i].s; totC+=cur[i].s; }
  for(i=0;i<prev.length;i++){ var k2 = prev[i].cat||'other'; pm[k2]=(pm[k2]||0)+prev[i].s; totP+=prev[i].s; }
  var keys = {};
  for(var a in cm){ keys[a]=1; }
  for(var b in pm){ keys[b]=1; }
  var rows = [];
  for(var k in keys){ rows.push({id:k, c:cm[k]||0, p:pm[k]||0}); }
  rows.sort(function(x,y){ return Math.abs(y.c-y.p) - Math.abs(x.c-x.p); });
  function per(d){ return MONTHS_S[d.getMonth()]+' '+d.getFullYear(); }
  var diff = totC - totP;
  var pct = totP>0 ? Math.round(diff/totP*100) : (totC>0?100:0);
  var h = sheetHead('i-chev','c-blu','Сравнение периодов', per(pf)+' → '+per(r.from))
    + rowHtml(per(pf), fmt(totP))
    + rowHtml(per(r.from), fmt(totC))
    + '<div class="sh-row"><span>Итог</span><b style="color:'+(diff>0?'var(--red)':'var(--grn)')+'">'+(diff>0?'+':'−')+fmt(Math.abs(diff))+' ('+(diff>0?'+':'')+pct+'%)</b></div>'
    + '<div class="cap" style="margin:10px 4px 6px">По категориям · самые большие изменения</div>';
   for(i=0;i<rows.length && i<12;i++){
    var d2 = rows[i].c - rows[i].p;
    if(rows[i].c === 0 && rows[i].p === 0){ continue; }
    var dCol = d2 > 0 ? 'var(--red)' : (d2 < 0 ? 'var(--grn)' : 'var(--mut)');
    var dSign = d2 > 0 ? '+' : (d2 < 0 ? '-' : '');
    h += '<div class="dig-item"><span>' + catById(rows[i].id).n + '</span><b>' + fmt(rows[i].p) + ' &rarr; ' + fmt(rows[i].c) + ' <span style="color:' + dCol + '">' + dSign + fmt(Math.abs(d2)) + '</span></b></div>';
  }
  var grow = null, shrink = null;
  for(i=0;i<rows.length;i++){
    var dd = rows[i].c - rows[i].p;
    if(dd > 0 && (!grow || dd > grow.d)){ grow = {n:catById(rows[i].id).n, d:dd}; }
    if(dd < 0 && (!shrink || dd < shrink.d)){ shrink = {n:catById(rows[i].id).n, d:dd}; }
  }
  var tip = '';
  if(grow){ tip += 'Больше всего выросло: <b>'+grow.n+'</b> (+'+fmt(grow.d)+'). '; }
  if(shrink){ tip += 'Больше всего снизилось: <b>'+shrink.n+'</b> (−'+fmt(Math.abs(shrink.d))+').'; }
  if(tip){ h += '<div class="sh-tip">'+tip+'</div>'; }
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on');
  $('shb').classList.add('on');
}

function openDaySheet(dstr){
  var d = parseD(dstr);
  var list = allSpends().filter(function(x){ return iso(x.d) === dstr; }).sort(function(a,b){ return b.s - a.s; });
  var incs = (D.incomes||[]).filter(function(x){ return x.d === dstr; });
  var tot = 0;
  for(var i2=0;i2<list.length;i2++){ tot += list[i2].s; }
  var h = sheetHead('i-cal','c-blu', d.getDate()+' '+MONTHS[d.getMonth()]+' '+d.getFullYear(), (list.length+incs.length)+' операций на '+fmt(tot));
  for(var j2=0;j2<incs.length;j2++){
    h += '<div class="dig-item"><span>'+incs[j2].n+'</span><b style="color:var(--grn)">+'+fmt(incs[j2].s)+'</b></div>';
  }
  if(list.length){
    for(var t4=0;t4<list.length;t4++){
      var cc2 = catById(list[t4].cat || 'other');
      h += '<div class="dig-item"><span>'+list[t4].n+' · '+cc2.n+'</span><b>-'+fmt(list[t4].s)+'</b></div>';
    }
  } else if(!incs.length){
    h += '<div class="dig-item"><span>Операций нет</span><b>—</b></div>';
  }
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on');
  $('shb').classList.add('on');
}

function openCatSheet(catId){
  var r = periodRange();
  var len = r.to - r.from;
  var pf = new Date(r.from.getTime() - len);
  var list = allSpends().filter(function(x){ return (x.cat||'other') === catId && x.d >= r.from && x.d < r.to; }).sort(function(a,b){ return b.d - a.d; });
  var plist = allSpends().filter(function(x){ return (x.cat||'other') === catId && x.d >= pf && x.d < r.from; });
  var tot = 0, ptot = 0, mx = 0;
  for(var i=0;i<list.length;i++){ tot += list[i].s; if(list[i].s > mx){ mx = list[i].s; } }
  for(var j=0;j<plist.length;j++){ ptot += plist[j].s; }
  var delta = ptot > 0 ? Math.round((tot - ptot) / ptot * 100) : (tot > 0 ? 100 : 0);
  var c = catById(catId);
  var h = sheetHead(c.i, c.k, c.n, r.label)
    + rowHtml('Потрачено', fmt(tot))
    + rowHtml('Транзакций', list.length)
    + rowHtml('Средний чек', fmt(list.length ? tot / list.length : 0))
    + rowHtml('Крупнейшая трата', fmt(mx))
    + rowHtml('Прошлый период', fmt(ptot))
    + '<div class="sh-row"><span>Изменение</span><b style="color:'+(delta>0?'var(--red)':'var(--grn)')+'">'+(delta>0?'+':'')+delta+'%</b></div>'
    + '<div class="cap" style="margin:10px 4px 6px">Все операции категории</div>'
    + '<div style="max-height:300px;overflow-y:auto">';
  if(list.length){
    for(var t=0;t<list.length;t++){
      h += '<div class="dig-item"><span>'+list[t].d.getDate()+'.'+String(list[t].d.getMonth()+1).padStart(2,'0')+' · '+list[t].n+'</span><b>-'+fmt(list[t].s)+'</b></div>';
    }
  } else {
    h += '<div class="dig-item"><span>Операций за период нет</span><b>—</b></div>';
  }
  h += '</div>';
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on');
  $('shb').classList.add('on');
}

// Статистика «выходные vs будни» для списка трат
function wkndStats(sp){
  var dayTot = {}, i;
  for(i=0;i<sp.length;i++){
    var k = iso(sp[i].d);
    dayTot[k] = (dayTot[k]||0) + sp[i].s;
  }
  var weS = 0, weDays = 0, wdS = 0, wdDays = 0;
  var wCat = {}, worstKey = null;
  for(var dk in dayTot){
    var dw = parseD(dk).getDay();
    if(dw === 6 || dw === 0){ weS += dayTot[dk]; weDays++; if(!worstKey || dayTot[dk] > dayTot[worstKey]){ worstKey = dk; } }
    else { wdS += dayTot[dk]; wdDays++; }
  }
  for(i=0;i<sp.length;i++){
    var dw2 = sp[i].d.getDay();
    if(dw2 === 6 || dw2 === 0){ wCat[sp[i].cat||'other'] = (wCat[sp[i].cat||'other']||0) + sp[i].s; }
  }
  var wArr = [];
  for(var kc in wCat){ wArr.push({id:kc, s:wCat[kc]}); }
  wArr.sort(function(a,b){ return b.s - a.s; });
  var wePer = weDays ? weS/weDays : 0;
  var wdPer = wdDays ? wdS/wdDays : 0;
  return {
    wePer: wePer, wdPer: wdPer,
    ratio: wdPer > 0 ? wePer/wdPer : (wePer > 0 ? 99 : 0),
    top: wArr.slice(0,3),
    worst: worstKey, worstSum: worstKey ? dayTot[worstKey] : 0
  };
}

function openHabitSheet(kind){
  var r = periodRange();
  var sp = allSpends().filter(function(x){ return x.d >= r.from && x.d < r.to; });
  if(!sp.length){ dAlert('За этот период операций нет.', 'Привычки'); return; }
  var tot = 0, i;
  for(i=0;i<sp.length;i++){ tot += sp[i].s; }
  var h = '';
  if(kind === 'avg'){
    var mx = 0, mn = Infinity, mxN = '', mnN = '';
    for(i=0;i<sp.length;i++){
      if(sp[i].s > mx){ mx = sp[i].s; mxN = sp[i].n; }
      if(sp[i].s < mn){ mn = sp[i].s; mnN = sp[i].n; }
    }
    h = sheetHead('i-card','c-blu','Средний чек', r.label)
      + rowHtml('Транзакций', sp.length)
      + rowHtml('Потрачено', fmt(tot))
      + rowHtml('Средний чек', fmt(tot / sp.length))
      + rowHtml('Минимальная', fmt(mn) + ' - ' + mnN)
      + rowHtml('Максимальная', fmt(mx) + ' - ' + mxN)
      + '<div class="cap" style="margin:10px 4px 6px">Чеки выше среднего</div>';
    var above = sp.filter(function(x){ return x.s > tot / sp.length; }).sort(function(a,b){ return b.s - a.s; });
    for(i=0;i<above.length && i<15;i++){
      h += '<div class="dig-item"><span>'+above[i].d.getDate()+'.'+String(above[i].d.getMonth()+1).padStart(2,'0')+' - '+above[i].n+'</span><b>-'+fmt(above[i].s)+'</b></div>';
    }
    if(!above.length){ h += '<div class="dig-item"><span>Нет чеков выше среднего</span><b>-</b></div>'; }
    h += '<div class="sh-tip">Всё, что выше среднего чека, - кандидат на правило 24 часов. Средний чек растёт из-за крупных импульсивных покупок.</div>';
  } else if(kind === 'max'){
    var sorted = sp.slice().sort(function(a,b){ return b.s - a.s; });
    var top = sorted[0];
    var c = catById(top.cat || 'other');
    h = sheetHead('i-alert','c-red','Крупнейшая трата', r.label)
      + rowHtml('Что', top.n)
      + rowHtml('Когда', top.d.getDate()+'.'+String(top.d.getMonth()+1).padStart(2,'0')+'.'+top.d.getFullYear())
      + rowHtml('Категория', c.n)
      + rowHtml('Сумма', fmt(top.s))
      + rowHtml('Доля от всех трат', Math.round(top.s / tot * 100) + '%')
      + '<div class="cap" style="margin:10px 4px 6px">Топ-5 трат за период</div>';
    for(i=0;i<sorted.length && i<5;i++){
      h += '<div class="dig-item"><span>'+sorted[i].d.getDate()+'.'+String(sorted[i].d.getMonth()+1).padStart(2,'0')+' - '+sorted[i].n+'</span><b>-'+fmt(sorted[i].s)+'</b></div>';
    }
    h += '<div class="sh-tip">Одна эта трата = '+Math.round(top.s / tot * 100)+'% всех расходов периода. Проверь, была ли она запланирована.</div>';
  } else if(kind === 'wd'){
    var WD = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
    var wdTot = [0,0,0,0,0,0,0], wdCnt = [0,0,0,0,0,0,0];
    for(i=0;i<sp.length;i++){ var w = sp[i].d.getDay(); wdTot[w] += sp[i].s; wdCnt[w]++; }
    var maxW = 0;
    for(i=1;i<7;i++){ if(wdTot[i] > wdTot[maxW]){ maxW = i; } }
    h = sheetHead('i-cal','c-org','Дорогие дни недели', r.label);
    for(i=0;i<7;i++){
      var p = tot > 0 ? Math.round(wdTot[i] / tot * 100) : 0;
      h += '<div class="g-row"><div class="g-head"><span>'+WD[i]+(i===maxW?' - максимум':'')+'</span><b>'+fmt(wdTot[i])+' - '+wdCnt[i]+' оп.</b></div>'
        + '<div class="bar-large" style="height:6px"><i style="width:'+p+'%;background:'+(i===maxW?'var(--org)':'var(--blu)')+'"></i></div></div>';
    }
    h += '<div class="sh-tip">По '+WD[maxW].toLowerCase()+' траты максимальные ('+fmt(wdTot[maxW])+'). Крупные покупки планируй на другие дни недели.</div>';
  } else if(kind === 'wknd'){
    var wst = wkndStats(sp);
    var pctW = Math.round(wst.ratio * 100);
    h = sheetHead('i-cal','c-red','Выходные против будней', r.label)
      + rowHtml('Средний день выходных', fmt(Math.round(wst.wePer)))
      + rowHtml('Средний будний день', fmt(Math.round(wst.wdPer)))
      + '<div class="sh-row"><span>Разница</span><b style="color:'+(wst.ratio>1.15?'var(--red)':(wst.ratio<0.95?'var(--grn)':'var(--txt)'))+'">'+(wst.ratio>=1?'+':'')+pctW+'%</b></div>';
    if(wst.top.length){
      h += '<div class="cap" style="margin:12px 4px 6px">Куда утекают выходные</div>';
      for(var wt2=0;wt2<wst.top.length;wt2++){
        h += '<div class="dig-item"><span>'+catById(wst.top[wt2].id).n+'</span><b>'+fmt(wst.top[wt2].s)+'</b></div>';
      }
    }
    if(wst.worst){
      var wd3 = parseD(wst.worst);
      h += rowHtml('Самый дорогой выходной', wd3.getDate()+'.'+String(wd3.getMonth()+1).padStart(2,'0')+' · '+fmt(wst.worstSum));
    }
    var advW;
    if(wst.ratio > 1.25){
      advW = 'Выходные дороже будней на '+pctW+'%. Введите «бюджет выходного дня» — примерно '+fmt(Math.round(wst.wePer))+' на субботу и воскресенье, и крупные покупки планируйте на будни.';
    } else if(wst.ratio >= 0.95){
      advW = 'Темп в выходные ровный — дисциплина на уровне. Так держать.';
    } else {
      advW = 'Выходные выходят даже дешевле будней. Редкий навык — не теряйте его.';
    }
    h += tipHtml(advW);
  }
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on');
  $('shb').classList.add('on');
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
  var ptot = 0; var pmap = {};
  for(i=0;i<psp.length;i++){ ptot += psp[i].s; var pk2 = psp[i].cat || 'other'; pmap[pk2] = (pmap[pk2]||0) + psp[i].s; }
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
  var cols = ['#30d158','#bf5af2','#ff453a','#ff9f0a','#0a84ff','#64d2ff'];
  var rank = '';
  for(i=0;i<agg.length;i++){
    var prev = pmap[agg[i].id] || 0;
    var diff = agg[i].s - prev;
    var dTxt, dCls;
    if(prev === 0){ dTxt = 'новое'; dCls = 'zero'; }
    else if(diff > 0){ dTxt = '↑ +'+fmt(diff); dCls = 'up'; }
    else if(diff < 0){ dTxt = '↓ −'+fmt(Math.abs(diff)); dCls = 'down'; }
    else { dTxt = '= 0'; dCls = 'zero'; }
    rank += '<div class="rank-row" data-act="an-cat" data-c="'+agg[i].id+'"><i style="background:'+cols[i % 6]+'"></i><span class="rank-name">'+agg[i].n+'</span><b>'+fmt(agg[i].s)+'</b><span class="rank-delta '+dCls+'">'+dTxt+'</span></div>';
  }
   var rankBox = $('catRank');
  if(!rankBox){
    rankBox = document.createElement('div');
    rankBox.id = 'catRank';
    var anR = $('anRight');
    if(anR){ anR.appendChild(rankBox); }
  }
  rankBox.innerHTML = '<div class="cap" style="margin:14px 4px 6px">Рейтинг категорий · к прошлому периоду</div>'
    + (rank || '<div class="dig-item"><span>Нет трат за период</span><b>—</b></div>');
  var groups = {must:0, life:0, flex:0};
  for(i=0;i<agg.length;i++){
    var cid = agg[i].id;
    if(cid==='home'||cid==='subs'||cid==='transport'){ groups.must += agg[i].s; }
    else if(cid==='grocery'){ groups.life += agg[i].s; }
    else { groups.flex += agg[i].s; }
  }
  var pot = 0;
  for(i=0;i<D.envs.length;i++){
    var ev = D.envs[i];
    if(ev.lim <= 0){ continue; }
    var f2 = 0;
    for(var a3=0;a3<sp.length;a3++){ if(envMatch(ev, sp[a3])){ f2 += sp[a3].s; } }
    if(f2 > ev.lim){ pot += f2 - ev.lim; }
  }
  function gRow(name, val, color){
    var p2 = tot > 0 ? Math.round(val / tot * 100) : 0;
    return '<div class="g-row"><div class="g-head"><span>'+name+'</span><b>'+fmt(val)+' · '+p2+'%</b></div>'
      + '<div class="bar-large" style="height:6px"><i style="width:'+Math.min(100,p2)+'%;background:'+color+'"></i></div></div>';
  }
  var struct = '<div class="cap" style="margin:14px 4px 6px">Структура трат</div>'
    + gRow('Обязательное · жильё, подписки, транспорт', groups.must, 'var(--blu)')
    + gRow('Бытовое · продукты', groups.life, 'var(--grn)')
    + gRow('Гибкое · кафе, самокаты, развлечения', groups.flex, 'var(--pur)')
    + (pot > 0
      ? '<div class="sh-tip">Потенциал экономии: <b>'+fmt(pot)+'</b> за период — настолько траты вышли за лимиты. Урежь гибкую часть, и эти деньги освободятся под цели.</div>'
      : '<div class="sh-tip">Отлично: перерасхода за период нет — гибкая часть в рамках лимитов.</div>')
    + '<div class="sh-tip">Гибкие траты = '+((D.income||0) > 0 ? Math.round(groups.flex / D.income * 100) : 0)+'% дохода. Здоровая норма — до 20%.</div>';
  var structBox = $('structBox');
  if(!structBox){
    structBox = document.createElement('div');
    structBox.id = 'structBox';
    var rankEl = $('catRank');
    if(rankEl && rankEl.parentNode){ rankEl.parentNode.insertBefore(structBox, rankEl.nextSibling); }
  }
  structBox.innerHTML = struct;
  var LEAKCATS = [
    ['scooters','Самокаты / каршеринг','i-scoot','c-org'],
    ['cafe','Кафе и доставка','i-coffee','c-red'],
    ['taxi','Такси','i-taxi','c-blu'],
    ['fun','Развлечения','i-fun','c-pur']];
  var leakRows = ''; var leakSum2 = 0; var leakList = [];
  for(i=0;i<LEAKCATS.length;i++){
    var ltot = 0, lcnt = 0;
    for(var s2=0;s2<sp.length;s2++){ if((sp[s2].cat||'other') === LEAKCATS[i][0]){ ltot += sp[s2].s; lcnt++; } }
    if(ltot > 0){ leakList.push({id:LEAKCATS[i][0], n:LEAKCATS[i][1], ic:LEAKCATS[i][2], k:LEAKCATS[i][3], t:ltot, c:lcnt}); leakSum2 += ltot; }
  }
  leakList.sort(function(a,b){ return b.t - a.t; });
  for(i=0;i<leakList.length;i++){
    var L = leakList[i];
    leakRows += '<div class="leak-row" data-act="an-cat" data-c="'+L.id+'">'
      + '<div class="sic '+L.k+'" style="width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none"><svg class="ic"><use href="#'+L.ic+'"/></svg></div>'
      + '<div class="leak-info"><b>'+L.n+'</b><span>'+L.c+' транзакций · средний чек '+fmt(L.t / L.c)+'</span></div>'
      + '<b class="leak-sum">'+fmt(L.t)+'</b></div>';
  }
  var leakBox = $('leakTop');
  if(!leakBox){
    leakBox = document.createElement('div');
    leakBox.id = 'leakTop';
    var sEl = $('structBox');
    if(sEl && sEl.parentNode){ sEl.parentNode.insertBefore(leakBox, sEl.nextSibling); }
  }
  leakBox.innerHTML = leakRows
    ? '<div class="cap" style="margin:14px 4px 6px">Топ утечек за период</div>' + leakRows
      + '<div class="sh-tip">Утечки = '+fmt(leakSum2)+' · '+(tot>0?Math.round(leakSum2/tot*100):0)+'% всех трат за период. Нажми на строку — откроются все операции категории.</div>'
    : '';
  var hmMonths = [];
  if(pMode === 'm'){ hmMonths.push(new Date(r.from.getFullYear(), r.from.getMonth(), 1)); }
  else if(pMode === 'q'){ for(var hm3=0;hm3<3;hm3++){ hmMonths.push(new Date(r.from.getFullYear(), r.from.getMonth()+hm3, 1)); } }
  else if(pMode === 'y'){ var hmEnd = new Date(r.to.getFullYear(), r.to.getMonth()-1, 1); for(var hm12=11;hm12>=0;hm12--){ hmMonths.push(new Date(hmEnd.getFullYear(), hmEnd.getMonth()-hm12, 1)); } }
  else { var nowM = new Date(); for(var hma=11;hma>=0;hma--){ hmMonths.push(new Date(nowM.getFullYear(), nowM.getMonth()-hma, 1)); } }
  var dayMap = {};
  for(i=0;i<sp.length;i++){ var dk = iso(sp[i].d); dayMap[dk] = (dayMap[dk]||0) + sp[i].s; }
  var maxDay = 1;
  for(var kk in dayMap){ if(dayMap[kk] > maxDay){ maxDay = dayMap[kk]; } }
  var hm = '';
  for(var mi=0;mi<hmMonths.length;mi++){
    var mo = hmMonths[mi];
    hm += '<div class="hm-month"><b>'+MONTHS_S[mo.getMonth()]+' '+mo.getFullYear()+'</b><div class="hm-grid">';
    var blank2 = (new Date(mo.getFullYear(), mo.getMonth(), 1).getDay()+6)%7;
    for(var b2=0;b2<blank2;b2++){ hm += '<span></span>'; }
    var dnum = new Date(mo.getFullYear(), mo.getMonth()+1, 0).getDate();
    for(var dd2=1;dd2<=dnum;dd2++){
      var key2 = mo.getFullYear()+'-'+String(mo.getMonth()+1).padStart(2,'0')+'-'+String(dd2).padStart(2,'0');
      var v2 = dayMap[key2] || 0;
      var lvl = v2 <= 0 ? 0 : (v2 < maxDay*0.15 ? 1 : (v2 < maxDay*0.35 ? 2 : (v2 < maxDay*0.6 ? 3 : 4)));
      var al = [0.06,0.22,0.4,0.62,0.9][lvl];
      hm += '<span class="hm-day" data-act="an-day" data-d="'+key2+'" style="background:rgba(10,132,255,'+al+')"></span>';
    }
    hm += '</div></div>';
  }
   var heatBox = $('heatBox');
  if(!heatBox){
    heatBox = document.createElement('div');
    heatBox.id = 'heatBox';
    var lEl = $('anLeft');
    if(lEl){ lEl.appendChild(heatBox); }
  }
  heatBox.innerHTML = '<div class="cap" style="margin:14px 4px 6px">Тепловая карта трат · нажми на день</div>' + hm;
   var cmpBox = $('cmpBtnBox');
  if(!cmpBox){
    cmpBox = document.createElement('div');
    cmpBox.id = 'cmpBtnBox';
    var hEl = $('anLeft');
    if(hEl){ hEl.appendChild(cmpBox); }
  }
  cmpBox.innerHTML = '<button class="sh-btn ghost" style="margin-top:12px" data-act="an-compare">⇄ Сравнить с прошлым периодом</button>';

  // ИДЕЯ 7: ПРИВЫЧКИ В ЦИФРАХ
  var avgCheck = sp.length ? tot / sp.length : 0;
  var maxOp = null;
  for(i=0;i<sp.length;i++){
    if(!maxOp || sp[i].s > maxOp.s){ maxOp = sp[i]; }
  }
  var wdTot = [0,0,0,0,0,0,0];
  var wdCnt = [0,0,0,0,0,0,0];
  var dayTot = {};
  for(i=0;i<sp.length;i++){
    var wdIdx = sp[i].d.getDay();
    wdTot[wdIdx] += sp[i].s;
    wdCnt[wdIdx]++;
    var dKey = iso(sp[i].d);
    dayTot[dKey] = (dayTot[dKey]||0) + sp[i].s;
  }
  var maxWd = 0, maxWdVal = 0;
  for(i=0;i<7;i++){
    if(wdTot[i] > maxWdVal){ maxWdVal = wdTot[i]; maxWd = i; }
  }
  var maxDayKey = null, maxDayVal = 0;
  for(var dk3 in dayTot){
    if(dayTot[dk3] > maxDayVal){ maxDayVal = dayTot[dk3]; maxDayKey = dk3; }
  }
  var scootCnt = 0, cafeCnt = 0;
  for(i=0;i<sp.length;i++){
    if(sp[i].cat === 'scooters'){ scootCnt++; }
    if(sp[i].cat === 'cafe'){ cafeCnt++; }
  }
  var WD_SHORT = ['вс','пн','вт','ср','чт','пт','сб'];
  var WD_LONG = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  var hRow = '';
  if(sp.length){
       hRow += '<div class="habit-row" data-act="an-habit" data-h="avg"><div class="habit-ic c-blu"><svg class="ic"><use href="#i-card"/></svg></div><div class="habit-info"><b>Средний чек</b><span>'+sp.length+' транзакций за период</span></div><b>'+fmt(avgCheck)+' ›</b></div>';
    if(maxOp){
      hRow += '<div class="habit-row" data-act="an-habit" data-h="max"><div class="habit-ic c-red"><svg class="ic"><use href="#i-alert"/></svg></div><div class="habit-info"><b>Крупнейшая трата</b><span>'+maxOp.n+' · '+maxOp.d.getDate()+'.'+String(maxOp.d.getMonth()+1).padStart(2,'0')+'</span></div><b>'+fmt(maxOp.s)+' ›</b></div>';
    }
    hRow += '<div class="habit-row" data-act="an-habit" data-h="wd"><div class="habit-ic c-org"><svg class="ic"><use href="#i-cal"/></svg></div><div class="habit-info"><b>Самый дорогой день недели</b><span>всего '+fmt(wdTot[maxWd])+' за период</span></div><b>'+WD_LONG[maxWd]+' ›</b></div>';
    var wstA = wkndStats(sp);
    if(wstA.wdPer > 0){
      hRow += '<div class="habit-row" data-act="an-habit" data-h="wknd"><div class="habit-ic '+(wstA.ratio>1.15?'c-red':'c-grn')+'"><svg class="ic"><use href="#i-cal"/></svg></div><div class="habit-info"><b>Выходные против будней</b><span>'+fmt(Math.round(wstA.wePer))+' против '+fmt(Math.round(wstA.wdPer))+' в день</span></div><b>'+(wstA.ratio>=1?'+':'')+Math.round(wstA.ratio*100)+'% ›</b></div>';
    }
    if(maxDayKey){
      var md3 = parseD(maxDayKey);
      hRow += '<div class="habit-row" data-act="an-day" data-d="'+maxDayKey+'"><div class="habit-ic c-pur"><svg class="ic"><use href="#i-cal"/></svg></div><div class="habit-info"><b>Самый дорогой день</b><span>'+md3.getDate()+' '+MONTHS[md3.getMonth()]+' · '+WD_SHORT[md3.getDay()]+'</span></div><b>'+fmt(maxDayVal)+'</b></div>';
    }
    if(scootCnt > 0){
      hRow += '<div class="habit-row" data-act="an-cat" data-c="scooters"><div class="habit-ic c-org"><svg class="ic"><use href="#i-scoot"/></svg></div><div class="habit-info"><b>Поездок на самокатах</b><span>средний чек '+fmt(map.scooters ? map.scooters/scootCnt : 0)+'</span></div><b>'+scootCnt+' ›</b></div>';
    }
    if(cafeCnt > 0){
      hRow += '<div class="habit-row" data-act="an-cat" data-c="cafe"><div class="habit-ic c-red"><svg class="ic"><use href="#i-coffee"/></svg></div><div class="habit-info"><b>Чеков в кафе</b><span>средний чек '+fmt(map.cafe ? map.cafe/cafeCnt : 0)+'</span></div><b>'+cafeCnt+' ›</b></div>';
    }
  }
   var habBox = $('habitBox');
  if(!habBox){
    habBox = document.createElement('div');
    habBox.id = 'habitBox';
    var cEl = $('anRight');
    if(cEl){ cEl.appendChild(habBox); }
  }
    habBox.innerHTML = hRow ? '<div class="cap" style="margin:14px 4px 6px">Привычки в цифрах · твоё зеркало за период</div>' + hRow + '<div class="sh-tip">Нажми на "крупнейшую трату" или "самый дорогой день" — откроются все операции. Нажми на самокаты или кафе — увидишь полный список.</div>' : '';
}

var hFrom = null, hTo = null, hCat = 'all';

var hMode2 = 'cal', cycOff2 = 0;
var hGroup = 'day';
var iFrom = null, iTo = null, iMode = 'cal', iCycOff = 0, iKind = 'all';
var INCOME_KINDS = [
  ['salary','Зарплата','c-grn','i-wallet'],
  ['side','Подработка','c-blu','i-card'],
  ['cash','Кэшбэк','c-org','i-gift'],
  ['transfer','Перевод','c-pur','i-in'],
  ['other','Прочее','c-red','i-gift']
];
function kindById(k){ for(var i=0;i<INCOME_KINDS.length;i++){ if(INCOME_KINDS[i][0]===k){ return INCOME_KINDS[i]; } } return INCOME_KINDS[4]; }
function incomeKind(x){
  if(x.k){ return x.k; }
  var s = (x.n||'').toLowerCase();
  if(x.auto || s.indexOf('заработн')!==-1){ return 'salary'; }
  if(s.indexOf('кэшбэк')!==-1 || s.indexOf('cashback')!==-1 || s.indexOf('лояльн')!==-1){ return 'cash'; }
  if(s.indexOf('перевод')!==-1 || s.indexOf('sbp')!==-1){ return 'transfer'; }
  if(s.indexOf('подработ')!==-1 || s.indexOf('фриланс')!==-1){ return 'side'; }
  return 'other';
}
function incRange(){
  if(iMode === 'cyc'){ var now = new Date(); var cs = shiftCycle(cycleStart(now), iCycOff); return {from:cs, to:cycleEnd(cs)}; }
  if(iFrom && iTo && iTo > iFrom){ return {from:iFrom, to:iTo}; }
  var n = new Date();
  return {from:new Date(n.getFullYear(), n.getMonth(), 1), to:new Date(n.getFullYear(), n.getMonth()+1, 1)};
}


function histRange2(){
  if(hMode2 === 'cyc'){
    var cs = shiftCycle(cycleStart(new Date()), cycOff2);
    return {from: cs, to: cycleEnd(cs)};
  }
  return histRange();
}

function histRange(){
  if(hFrom && hTo && hTo > hFrom){ return {from:hFrom, to:hTo}; }
  var n = new Date();
  return {from:new Date(n.getFullYear(), n.getMonth(), 1), to:new Date(n.getFullYear(), n.getMonth()+1, 1)};
}
function openPeriodSheet(){
  var r = histRange();
  $('sheetBody').innerHTML = sheetHead('i-cal','c-blu','Период истории','любые даты — хоть за прошлые годы')
    + '<div class="form"><div class="row2"><input class="inp" type="date" id="hpFrom" value="'+iso(r.from)+'"><input class="inp" type="date" id="hpTo" value="'+iso(new Date(r.to.getTime()-864e5))+'"></div></div>'
       + '<div class="dd-list static">'
    + '<button data-act="h-quick" data-v="m">Этот месяц</button>'
    + '<button data-act="h-quick" data-v="pm">Прошлый месяц</button>'
    + '<button data-act="h-quick" data-v="q">3 месяца</button>'
    + '<button data-act="h-quick" data-v="y">Год</button>'
    + '</div>'
    + '<button class="sh-btn" data-act="h-period-save">Показать</button>';
  $('sheet').classList.add('on');
  $('shb').classList.add('on');
}
function txRowHtml(t){
  if(t.xfer){
    return '<div class="tx" style="opacity:.75" data-act="xfer-del" data-i="'+(t.id!=null?t.id:'')+'"><div class="tx-ic" style="background:rgba(255,255,255,.08);color:var(--mut)"><svg class="ic"><use href="#i-in"/></svg></div><div class="tx-body"><b>'+esc(t.n)+'</b><span>'+t.d.getDate()+'.'+String(t.d.getMonth()+1).padStart(2,'0')+' · перевод себе · тап — удалить запись</span></div><div class="tx-right"><b style="color:var(--mut)">±'+fmt(t.s)+'</b></div></div>';
  }
  if(t.inc){
    return '<div class="tx"><div class="tx-ic c-grn"><svg class="ic"><use href="#i-in"/></svg></div><div class="tx-body"><b>'+t.n+'</b><span>'+t.d.getDate()+'.'+String(t.d.getMonth()+1).padStart(2,'0')+' · поступление</span></div><div class="tx-right"><b class="pos">+'+fmt(t.s)+'</b></div></div>';
  }
  var cc = catById(t.cat || 'other');
  var fix = (t.cat||'other')==='other' ? '<span class="tx-fix"></span>' : '';
  var ca = (window._catAvg && window._catAvg[t.cat||'other']) || 0;
  var anom = (ca > 0 && t.s > 3*ca) ? '<span class="tx-anom"></span>' : '';
  return '<div class="tx" data-act="tx-edit" data-src="'+(t.src||'sp')+'" data-i="'+(t.sid!=null?t.sid:'')+'" style="cursor:pointer"><div class="tx-ic '+cc.k+'"><svg class="ic"><use href="#'+cc.i+'"/></svg></div><div class="tx-body"><b>'+esc(t.n)+'</b><span>'+t.d.getDate()+'.'+String(t.d.getMonth()+1).padStart(2,'0')+' · '+cc.n+'</span></div><div class="tx-right">'+anom+fix+'<b>-'+fmt(t.s)+'</b></div></div>';
}
function renderTx(suffix){
  var sfx = suffix || '';
  function E(id){ return $(id + sfx); }
  var r = (sfx==='2') ? histRange2() : histRange();
  var lbl = E('hLabel');
  if(lbl){
    if(r.from.getDate() === 1 && r.to.getDate() === 1 && (r.to - r.from) < 32*864e5){
      lbl.textContent = MONTHS[r.from.getMonth()]+' '+r.from.getFullYear();
    } else {
      lbl.textContent = r.from.getDate()+'.'+String(r.from.getMonth()+1).padStart(2,'0')+'.'+r.from.getFullYear()+' – '+r.to.getDate()+'.'+String(r.to.getMonth()+1).padStart(2,'0')+'.'+r.to.getFullYear();
    }
  }
  var q = E('q') ? (E('q').value || '').toLowerCase() : '';
  var spends = allSpends().filter(function(x){ return x.d >= r.from && x.d < r.to; });
  var incs = (D.incomes||[]).map(function(x){ return {d:parseD(x.d), s:x.s, n:x.n, inc:1}; }).filter(function(x){ return x.d >= r.from && x.d < r.to; });
  var xfers = (D.transfers||[]).map(function(x){ return {d:parseD(x.d), s:x.s, n:x.n, xfer:1, id:x.id}; }).filter(function(x){ return x.d >= r.from && x.d < r.to; });
  var fSp = spends.filter(function(x){ return (hCat==='all' || (x.cat||'other')===hCat) && x.n.toLowerCase().indexOf(q)!==-1; });
  var fIn = incs.filter(function(x){ return hCat==='all' && x.n.toLowerCase().indexOf(q)!==-1; });
  var totSp = 0, totIn = 0, i;
  for(i=0;i<fSp.length;i++){ totSp += fSp[i].s; }
  for(i=0;i<fIn.length;i++){ totIn += fIn[i].s; }
  var hs = E('hSum');
  if(hs){
    hs.innerHTML = '<span class="hs-sp">Расходы: <b>'+fmt(totSp)+'</b></span>'
      + '<span class="hs-in">Поступления: <b>+'+fmt(totIn)+'</b></span>'
      + (hCat!=='all' ? '<span class="hs-cat">'+catById(hCat).n+'</span>' : '');
  }
  var cl = E('ddCatList');
  if(cl){
    var opts = '<button class="'+(hCat==='all'?'on':'')+'" data-act="h-cat" data-c="all">Все категории</button>';
    for(i=0;i<CATS.length;i++){
      opts += '<button class="'+(hCat===CATS[i].id?'on':'')+'" data-act="h-cat" data-c="'+CATS[i].id+'"><span class="sic '+CATS[i].k+'"><svg class="ic"><use href="#'+CATS[i].i+'"/></svg></span>'+CATS[i].n+'</button>';
    }
    cl.innerHTML = opts;
  }
  var clbl = E('ddCatLbl');
  if(clbl){ clbl.textContent = hCat==='all' ? 'Все категории' : catById(hCat).n; }
  var catAvg = {};
  var ct2 = {}, cn2 = {};
  for(i=0;i<spends.length;i++){ var c2 = spends[i].cat||'other'; ct2[c2]=(ct2[c2]||0)+spends[i].s; cn2[c2]=(cn2[c2]||0)+1; }
  for(var k2 in ct2){ catAvg[k2] = ct2[k2]/cn2[k2]; }
  window._catAvg = catAvg;
  var all = fSp.concat(fIn).concat(xfers.filter(function(x){ return hCat==='all' && x.n.toLowerCase().indexOf(q)!==-1; })).sort(function(a,b){ return b.d - a.d; });
  var h = '';
  if(sfx==='2' && hGroup !== 'day'){
    var groups = {}; var gOrder = [];
    for(i=0;i<all.length;i++){
      var t = all[i];
      var gk = t.xfer ? 'Переводы себе' : (t.inc ? 'Поступления' : (hGroup==='cat' ? catById(t.cat||'other').n : merchName(t.n)));
      if(!groups[gk]){ groups[gk] = {n:gk, s:0, c:0, inc:!!t.inc}; gOrder.push(gk); }
      if(!t.xfer){ groups[gk].s += t.s; }
      groups[gk].c++;
    }
    gOrder.sort(function(a,b){ return (groups[b].inc?1:0)-(groups[a].inc?1:0) || groups[b].s - groups[a].s; });
    for(i=0;i<gOrder.length;i++){
      var g = groups[gOrder[i]];
      h += '<div class="hist-day" style="display:flex;justify-content:space-between;align-items:center"><span>'+esc(g.n)+'</span><b>'+g.c+' шт.'+(g.n==='Переводы себе'?'':' · '+(g.inc?'+':'-')+fmt(g.s))+'</b></div>';
      for(var gi=0;gi<all.length;gi++){
        var t2 = all[gi];
        var gk2 = t2.inc ? 'Поступления' : (hGroup==='cat' ? catById(t2.cat||'other').n : merchName(t2.n));
        if(gk2 === g.n){ h += txRowHtml(t2); }
      }
    }
  } else {
    var lastKey = '';
    for(i=0;i<all.length;i++){
      var t3 = all[i];
      var k = iso(t3.d);
      if(k !== lastKey){
        lastKey = k;
        h += '<div class="hist-day">'+t3.d.getDate()+' '+MONTHS[t3.d.getMonth()]+' · '+WEEKDAYS[t3.d.getDay()]+'</div>';
      }
      h += txRowHtml(t3);
    }
  }
  var tl = E('txList');
  if(tl){ tl.innerHTML = h || '<p style="color:var(--mut);font-size:13px;padding:12px">За выбранный период операций нет</p>'; }
  if(sfx==='2'){
    var mc1 = $('hmCal'), mc2 = $('hmCyc');
    if(mc1){ mc1.classList.toggle('on', hMode2==='cal'); }
    if(mc2){ mc2.classList.toggle('on', hMode2==='cyc'); }
    var hg1 = $('hgDay'), hg2b = $('hgCat'), hg3 = $('hgMerch');
    if(hg1){ hg1.classList.toggle('on', hGroup==='day'); }
    if(hg2b){ hg2b.classList.toggle('on', hGroup==='cat'); }
    if(hg3){ hg3.classList.toggle('on', hGroup==='merch'); }
    var aggS = {};
    for(i=0;i<spends.length;i++){ var ck3 = spends[i].cat||'other'; aggS[ck3]=(aggS[ck3]||0)+spends[i].s; }
    var arrS = []; for(var k3 in aggS){ arrS.push({id:k3, s:aggS[k3]}); }
    arrS.sort(function(a,b){ return b.s - a.s; });
    var colsS = ['#30d158','#bf5af2','#ff453a','#ff9f0a','#0a84ff','#64d2ff'];
    var hs2 = '';
    for(i=0;i<arrS.length && i<6;i++){
      var envKey = CAT2ENV[arrS[i].id] || '';
      var env9 = null;
      for(var e9=0;e9<D.envs.length;e9++){ if(envKey && D.envs[e9].n.indexOf(envKey)===0){ env9 = D.envs[e9]; break; } }
      var barCol = colsS[i%6];
      var limTxt = '';
      var penBtn = '';
      if(env9){
        var pct2 = arrS[i].s/Math.max(1,env9.lim)*100;
        barCol = pct2>100 ? 'var(--red)' : (pct2>85 ? 'var(--org)' : colsS[i%6]);
        limTxt = ' / '+fmt(env9.lim);
        penBtn = '<button class="mini-btn" data-act="edit" data-t="env" data-i="'+env9.id+'" style="margin-left:4px"><svg class="ic"><use href="#i-pen"/></svg></button>';
      }
      var pS = totSp>0 ? Math.round(arrS[i].s/totSp*100) : 0;
      hs2 += '<div class="catsum-row" data-act="h-cat" data-c="'+arrS[i].id+'"><span class="catsum-name">'+catById(arrS[i].id).n+'</span><div class="bar-large" style="height:6px;flex:1"><i style="width:'+Math.min(100,pS)+'%;background:'+barCol+'"></i></div><b>'+fmt(arrS[i].s)+limTxt+'</b>'+penBtn+'</div>';
    }
    var csEl = $('hCatSum2');
    if(csEl){ csEl.innerHTML = hs2 ? '<div class="cap" style="margin:10px 4px 6px">Траты по категориям · тап фильтрует историю, карандаш меняет лимит</div>'+hs2 : ''; }
    var allT = allSpends();
    var grp = {};
    for(i=0;i<allT.length;i++){
      var key4 = (allT[i].n||'').toLowerCase()+'|'+Math.round(allT[i].s);
      if(!grp[key4]){ grp[key4] = {cnt:0, n:allT[i].n, s:allT[i].s}; }
      grp[key4].cnt++;
    }
    var cand = [];
    var hideList = D.recurHide || [];
    for(var k4 in grp){
      var g4 = grp[k4];
      if(g4.cnt >= 3){
        var inPay = false;
        for(i=0;i<D.pays.length;i++){ if((D.pays[i].n||'').toLowerCase() === g4.n.toLowerCase()){ inPay = true; break; } }
        var isHide = hideList.indexOf(g4.n.toLowerCase()+'|'+Math.round(g4.s)) !== -1;
        if(!inPay && !isHide){ cand.push(g4); }
      }
    }
    cand.sort(function(a,b){ return b.cnt - a.cnt; });
    window._recurList = cand.slice(0,2);
    var rh = '';
    for(i=0;i<window._recurList.length;i++){
      rh += '<div class="sh-tip" style="display:flex;align-items:center;gap:8px"><span style="flex:1">Похоже на регулярный платёж: <b>'+window._recurList[i].n+'</b> '+fmt(window._recurList[i].s)+' ('+window._recurList[i].cnt+' раза)</span>'
        + '<button class="chip" data-act="recur-add" data-i="'+i+'">В обязательные</button>'
        + '<button class="mini-btn" data-act="recur-hide" data-i="'+i+'" title="Это не обязательный платёж"><svg class="ic"><use href="#i-x"/></svg></button></div>';
    }
    var rcEl = $('hRecur2');
    if(rcEl){ rcEl.innerHTML = rh; }
    var fcEl = $('hForecast2');
    if(fcEl){
      var daysN = Math.round((r.to - r.from)/864e5);
      var nowD = new Date();
      if(daysN <= 32 && nowD >= r.from && nowD < r.to){
        var elapsed = Math.max(1, Math.round((nowD - r.from)/864e5));
        var perDay = totSp / elapsed;
        fcEl.innerHTML = '<div class="cap" style="margin:10px 4px 6px">Прогноз до конца месяца</div><div class="sh-tip">С текущим темпом ('+fmt(Math.round(perDay))+'/день) будет <b>'+fmt(Math.round(perDay*daysN))+'</b>. Осталось дней: '+(daysN-elapsed)+'.</div>';
      } else { fcEl.innerHTML = ''; }
    }
    var mg = {};
    for(i=0;i<spends.length;i++){
      var mn = merchName(spends[i].n);
      if(!mg[mn]){ mg[mn] = {n:mn, s:0, c:0}; }
      mg[mn].s += spends[i].s; mg[mn].c++;
    }
    var mArr = []; for(var k6 in mg){ mArr.push(mg[k6]); }
    mArr.sort(function(a,b){ return b.s - a.s; });
    window._merchList = mArr.slice(0,5);
    var mh = '';
    for(i=0;i<window._merchList.length;i++){
      mh += '<div class="merch-row" data-act="merch-open" data-i="'+i+'"><span class="m-name">'+window._merchList[i].n+'</span><span class="m-cnt">'+window._merchList[i].c+' чеков</span><b>'+fmt(window._merchList[i].s)+'</b></div>';
    }
    var mEl2 = $('hMerch2');
    if(mEl2){ mEl2.innerHTML = mh ? '<div class="cap" style="margin:10px 4px 6px">Топ продавцов · тап откроет все чеки</div>'+mh : ''; }
    var tplMap = {};
    var cutoff = new Date(Date.now() - 60*864e5);
    for(i=0;i<allT.length;i++){
      if(allT[i].d < cutoff){ continue; }
      var tk2 = (allT[i].n||'').toLowerCase()+'|'+Math.round(allT[i].s);
      if(!tplMap[tk2]){ tplMap[tk2] = {n:allT[i].n, s:Math.round(allT[i].s), c:0}; }
      tplMap[tk2].c++;
    }
    var tplArr = []; for(var k7 in tplMap){ if(tplMap[k7].c >= 3){ tplArr.push(tplMap[k7]); } }
    tplArr.sort(function(a,b){ return b.c - a.c; });
    window._tplList = tplArr.slice(0,4);
    var th = '';
    for(i=0;i<window._tplList.length;i++){
      th += '<button class="chip" data-act="tpl-add" data-i="'+i+'">'+esc(window._tplList[i].n)+' · '+fmt(window._tplList[i].s)+'</button>';
    }
    var tpEl = $('hTpl2');
    if(tpEl){ tpEl.innerHTML = th ? '<div class="cap" style="margin:10px 4px 6px">Частые траты · тап запишет сегодня</div>'+th : ''; }
    var roundSum = 0;
    for(i=0;i<spends.length;i++){ roundSum += Math.ceil(spends[i].s/10)*10 - spends[i].s; }
    window._roundAmt = Math.round(roundSum);
    var rdEl = $('hRound2');
    if(rdEl){ rdEl.innerHTML = window._roundAmt > 0 ? '<div class="cap" style="margin:10px 4px 6px">Сдача в копилку · округление каждой траты до 10 ₽</div><div class="sh-tip">Накопилось за период: <b>'+fmt(window._roundAmt)+'</b> <button class="chip" style="margin-left:6px" data-act="round-add">Закинуть в цель</button></div>' : ''; }
    var nowW = new Date();
    var wd2 = (nowW.getDay()+6)%7;
    var ws2 = new Date(nowW.getFullYear(), nowW.getMonth(), nowW.getDate()-wd2);
    var we2 = new Date(ws2.getTime()+7*864e5);
    var lwS = new Date(ws2.getTime()-7*864e5);
    var sumThis = 0, sumLast = 0;
    for(i=0;i<allT.length;i++){
      if(allT[i].d >= ws2 && allT[i].d < we2){ sumThis += allT[i].s; }
      else if(allT[i].d >= lwS && allT[i].d < ws2){ sumLast += allT[i].s; }
    }
    var wkEl = $('hWeek2');
    if(wkEl){
      var dPct = sumLast > 0 ? Math.round((sumThis-sumLast)/sumLast*100) : 0;
      wkEl.innerHTML = '<div class="cap" style="margin:10px 4px 6px">Неделя · эта vs прошлая</div><div class="sh-tip">Потрачено: эта <b>'+fmt(sumThis)+'</b> · прошлая '+fmt(sumLast)+' ('+(dPct>0?'+':'')+dPct+'%)</div>';
    }
    var dayTot3 = {}, scootDays = {};
    for(i=0;i<allT.length;i++){
      var dk3 = iso(allT[i].d);
      dayTot3[dk3] = (dayTot3[dk3]||0)+allT[i].s;
      if(allT[i].cat==='scooters'){ scootDays[dk3]=1; }
    }
    var lim3 = calcDailyLimit().perDay;
    var stLim = 0, stScoot = 0, dd3;
    for(dd3=0; dd3<365; dd3++){ var dx = new Date(); dx.setDate(dx.getDate()-dd3); if((dayTot3[iso(dx)]||0) <= lim3){ stLim++; } else { break; } }
    for(dd3=0; dd3<365; dd3++){ var dy = new Date(); dy.setDate(dy.getDate()-dd3); if(!scootDays[iso(dy)]){ stScoot++; } else { break; } }
    var stEl = $('hStreak2');
    if(stEl){ stEl.innerHTML = '<div class="cap" style="margin:10px 4px 6px">Серии без перерасхода</div><div class="sh-tip"><b>'+stLim+' дн.</b> в рамках дневного лимита · <b>'+stScoot+' дн.</b> без самокатов.</div>'; }
    var otherN = 0;
    for(i=0;i<spends.length;i++){ if((spends[i].cat||'other')==='other'){ otherN++; } }
    var aEl2 = $('hActions2');
    if(aEl2){
      var memN = 0; for(var mk2 in (D.merchRules||{})){ memN++; }
      var btns2 = (otherN>0 ? '<button class="chip" data-act="other-bulk">Разобрать Прочее ('+otherN+')</button>' : '')
        + '<button class="chip" data-act="stmt-import">Вставить выписку</button>'
        + '<button class="chip" data-act="dup-find">Найти дубликаты</button>'
        + '<button class="chip" data-act="recr-find">Регулярные платежи</button>'
        + (memN>0 ? '<button class="chip" data-act="mem-apply">Применить память ('+memN+')</button>' : '')
        + (hMode2==='cyc' ? '<button class="chip" data-act="cyc-compare">Сравнить с прошлым циклом</button>' : '');
      aEl2.innerHTML = '<div class="cap" style="margin:10px 4px 6px">Инструменты</div><div class="h-actions" style="margin:0 0 10px">'+btns2+'</div>';
    }
  }
}
function renderAllTx(){ renderTx(); renderTx('2'); }

function renderRec(){
  var act = activeLeaks();
  if(act.length === 0){
    $('recList').innerHTML = '<div class="rec glass"><header><div class="sic c-grn"><svg class="ic"><use href="#i-check"/></svg></div><div><h5>Все утечки устранены!</h5><span>Отличная работа — деньги остаются у вас</span></div></header></div>';
    return;
  }
  var h = '';
  for(var i=0;i<act.length;i++){
    var l = act[i];
    h += '<div class="rec glass hov" data-act="sheet" data-t="leak" data-i="'+l.id+'" data-m="0">'
      + '<header><div class="sic c-red"><svg class="ic"><use href="#i-shield"/></svg></div><div><h5>'+esc(l.n)+'</h5><span>'+l.tx+' транзакций за месяц</span></div><svg class="ic chev"><use href="#i-chev"/></svg></header>'
      + '<p>Перерасход '+fmt(l.over)+' при лимите '+fmt(l.lim)+'. Нажми, чтобы увидеть транзакции.</p>'
      + '<footer><span>Потрачено в этом месяце</span><b>'+fmt(l.s)+'</b><button class="chip" style="background:rgba(48,209,88,.15);color:var(--grn)" data-act="leak-fix" data-i="'+l.id+'" data-m="0">Устранено</button></footer></div>';
  }
  $('recList').innerHTML = h;
}

function goalEta(g){
var need = (g.target||0) - (g.cur||0);
if(need <= 0){ return null; }
var now = new Date();
var pace = 0;
for(var m=0;m<3;m++){
var f = new Date(now.getFullYear(), now.getMonth()-m, 1), t = new Date(now.getFullYear(), now.getMonth()-m+1, 1);
var inc = 0, sp = 0;
for(var i=0;i<(D.incomes||[]).length;i++){ var d = parseD(D.incomes[i].d); if(d >= f && d < t){ inc += D.incomes[i].s; } }
var all = allSpends();
for(var j=0;j<all.length;j++){ if(all[j].d >= f && all[j].d < t){ sp += all[j].s; } }
pace += Math.max(0, inc - sp);
}
pace = pace / 3;
if(pace <= 0){ return null; }
var months = Math.ceil(need / pace);
var d = new Date(now.getFullYear(), now.getMonth()+months, 1);
return d.toLocaleDateString('ru-RU',{month:'short', year:'2-digit'}).replace('.','');
}

function goalsHtml(){
  var act = (D.goals||[]).filter(function(g){ return !g.done; });
  var done = (D.goals||[]).filter(function(g){ return g.done; });
  var h = '';
  if(act.length === 0 && done.length === 0){
    h = '<div class="rec glass"><header><div class="sic c-pur"><svg class="ic"><use href="#i-target"/></svg></div><div><h5>Целей пока нет</h5><span>Добавь первую — и начни копить</span></div></header></div>';
  } else {
    for(var i=0;i<act.length;i++){
      var g = act[i];
      var p = Math.min(100, Math.round((g.cur||0) / Math.max(1,g.target||1) * 100));
var dl = g.deadline ? ' · до '+parseD(g.deadline).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}) : '';
var eta = goalEta(g);
if(eta){ dl += ' · при темпе — '+eta; }
      h += '<div class="env glass hov" style="margin-bottom:12px">'
        + '<header><div class="env-name"><div class="sic c-pur" style="width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center"><svg class="ic"><use href="#i-target"/></svg></div>'+esc(g.n)+'</div><b>'+fmt(g.cur||0)+' / '+fmt(g.target)+'</b></header>'
        + '<div class="bar-large" style="height:6px;margin-top:8px"><i style="width:'+p+'%;background:linear-gradient(90deg,var(--pur),var(--pink))"></i></div>'
        + '<div class="note">'+p+'%'+dl+'</div>'
        + '<div class="row-actions" style="margin-top:8px;gap:6px">'
        + '<button class="sh-btn" style="margin:0;flex:1;background:rgba(48,209,88,.15);color:var(--grn)" data-act="goal-fund" data-i="'+g.id+'">+ Пополнить</button>'
        + '<button class="mini-btn" data-act="goal-edit" data-i="'+g.id+'"><svg class="ic"><use href="#i-pen"/></svg></button>'
        + '<button class="mini-btn danger" data-act="goal-del" data-i="'+g.id+'"><svg class="ic"><use href="#i-trash"/></svg></button>'
        + '</div></div>';
    }
    if(done.length > 0){
      h += '<div class="cap" style="margin:16px 4px 8px;color:var(--grn)">✓ Выполненные цели</div>';
      for(var j=0;j<done.length;j++){
        var g2 = done[j];
          h += '<div class="env glass hov" style="margin-bottom:8px;opacity:.85">'
          + '<header><div class="env-name"><div class="sic c-grn" style="width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center"><svg class="ic"><use href="#i-check"/></svg></div>'+esc(g2.n)+'</div><b>'+fmt(g2.cur||0)+' / '+fmt(g2.target)+'</b></header>'
          + '<div class="row-actions" style="margin-top:8px;gap:6px">'
          + '<button class="sh-btn ghost" style="margin:0;flex:1" data-act="goal-uncomplete" data-i="'+g2.id+'">Вернуть в активные</button>'
          + '<button class="mini-btn" data-act="goal-edit" data-i="'+g2.id+'"><svg class="ic"><use href="#i-pen"/></svg></button>'
          + '<button class="mini-btn danger" data-act="goal-del" data-i="'+g2.id+'"><svg class="ic"><use href="#i-trash"/></svg></button>'
          + '</div></div>';
      }
    }
  }
  return h + '<div class="dlg-btns" style="margin-top:14px"><button class="sh-btn" style="margin:0" data-act="goal-add">+ Добавить цель</button></div>';
}

function renderGoals(){
  var el = $('goalCard');
  if(el){ el.innerHTML = ''; }
}

function renderLearn(){
  var done = D.learned.length;
  var tot = LESSONS.length;
  $('learnProg').innerHTML = '<div class="cap" style="margin:0 0 8px">Ваш прогресс</div>'
    + '<div style="font-size:22px;font-weight:800">'+done+' / '+tot+' уроков</div>'
    + '<div class="bar-large" style="height:8px;margin-top:6px"><i style="width:'+Math.round(done/tot*100)+'%;background:linear-gradient(90deg,var(--pur),var(--pink))"></i></div>'
    + '<div class="note" style="margin-top:6px">'+(done===tot?'Курс пройден! Вы управляете деньгами, а не они вами.':'Каждый урок — 1 минута. Знания экономят тысячи рублей.')+'</div>';
  var h = '';
  var lastG = '';
  for(var i=0;i<LESSONS.length;i++){
    var l = LESSONS[i];
    if(l.g && l.g !== lastG){
      lastG = l.g;
      var gDone = 0, gTot = 0;
      for(var gc=0;gc<LESSONS.length;gc++){ if(LESSONS[gc].g === l.g){ gTot++; if(D.learned.indexOf(LESSONS[gc].id) !== -1){ gDone++; } } }
      h += '<div class="cap" style="margin:16px 4px 8px">'+l.g+' · '+gDone+'/'+gTot+'</div>';
    }
    var dn = D.learned.indexOf(l.id) !== -1;
    h += '<div class="rec glass hov" data-act="sheet" data-t="learn" data-i="'+l.id+'">'
      + '<header><div class="sic '+(dn?'c-grn':'c-pur')+'"><svg class="ic"><use href="#'+(dn?'i-check':'i-book')+'"/></svg></div><div><h5>'+l.t+'</h5><span>урок '+(i+1)+' · '+(dn?'изучено':'1 минута')+'</span></div><svg class="ic chev"><use href="#i-chev"/></svg></header></div>';
  }
  $('learnList').innerHTML = h;
}

function renderSpend(){
  if(!$('spList')){ return; }
  var cur = cycleStart(new Date());
  var cs = shiftCycle(cur, viewOff);
  $('spLabel').textContent = cycleLabel(cs);
  var list = allSpends().filter(function(x){ return inCycle(x.d, cs) && x.manual; }).sort(function(a,b){ return b.d - a.d; });
  var all = allSpends().filter(function(x){ return inCycle(x.d, cs); });
  var total = 0;
  for(var i=0;i<all.length;i++){ total += all[i].s; }
  var agg = catAgg(cs);
  var spElapsed = Math.max(1, Math.round((new Date() - cs)/864e5));
  $('spSum').innerHTML = '<div class="cap" style="margin:0 0 8px">Итог периода (все операции)</div>'
    + rowHtml('Потрачено', fmt(total))
    + rowHtml('В день', fmt(total / spElapsed))
    + rowHtml('Топ-категория', agg.length ? agg[0].n+' · '+fmt(agg[0].s) : '—');
  var h = '';
  for(var j=0;j<list.length;j++){
    var t = list[j];
    var cc = catById(t.cat || 'other');
        var tagIcon = '';
    if(t.tag === 'impulse') tagIcon = '<span class="tagb tag-imp">импульс</span>';
    else if(t.tag === 'planned') tagIcon = '<span class="tagb tag-plan">план</span>';
    else if(t.tag === 'needed') tagIcon = '<span class="tagb tag-need">нужно</span>';
    h += '<div class="tx" data-act="edit-spend" data-id="'+t.id+'"><div class="tx-ic '+cc.k+'"><svg class="ic"><use href="#'+cc.i+'"/></svg></div>'
      + '<div class="tx-body"><b>'+esc(t.n)+tagIcon+'</b><span>'+t.d.getDate()+'.'+String(t.d.getMonth()+1).padStart(2,'0')+' · '+cc.n+'</span></div>'
      + '<div class="tx-right"><b>-'+fmt(t.s)+'</b></div>'
      + '<button class="del" data-act="del-spend" data-id="'+t.id+'"><svg class="ic" style="width:14px;height:14px"><use href="#i-x"/></svg></button></div>';
  }
  $('spList').innerHTML = h || '<p style="color:var(--mut);font-size:13px;padding:12px">Ручных трат в этом периоде нет — добавьте первую выше</p>';
}

function renderIncome(){
  var r = incRange();
  var lbl = $('iLabel');
  if(lbl){
    if(r.from.getDate() === 1 && r.to.getDate() === 1 && (r.to - r.from) < 32*864e5){
      lbl.textContent = MONTHS[r.from.getMonth()]+' '+r.from.getFullYear();
    } else {
      lbl.textContent = r.from.getDate()+'.'+String(r.from.getMonth()+1).padStart(2,'0')+'.'+r.from.getFullYear()+' – '+r.to.getDate()+'.'+String(r.to.getMonth()+1).padStart(2,'0')+'.'+r.to.getFullYear();
    }
  }
  var mc1 = $('imCal'), mc2 = $('imCyc');
  if(mc1){ mc1.classList.toggle('on', iMode==='cal'); }
  if(mc2){ mc2.classList.toggle('on', iMode==='cyc'); }
  var items = [];
  var i;
  for(i=0;i<(D.incomes||[]).length;i++){
    var x = D.incomes[i];
    var d = parseD(x.d);
    if(d >= r.from && d < r.to){ items.push({id:x.id, d:d, s:x.s, n:x.n, k:incomeKind(x), auto:x.auto}); }
  }
  var totAll = 0;
  for(i=0;i<items.length;i++){ totAll += items[i].s; }
  var fItems = items.filter(function(x){ return iKind==='all' || x.k===iKind; });
  var tot = 0;
  for(i=0;i<fItems.length;i++){ tot += fItems[i].s; }
  var hs = $('iSum');
  if(hs){ hs.innerHTML = '<span class="hs-in">Поступило: <b>+'+fmt(tot)+'</b></span><span>операций: '+fItems.length+'</span>'+(iKind!=='all'?'<span class="hs-cat">'+kindById(iKind)[1]+'</span>':''); }
  var kl = $('iKindList');
  if(kl){
    var kh = '<button class="'+(iKind==='all'?'on':'')+'" data-act="i-kind" data-c="all">Все типы</button>';
    for(i=0;i<INCOME_KINDS.length;i++){
      kh += '<button class="'+(iKind===INCOME_KINDS[i][0]?'on':'')+'" data-act="i-kind" data-c="'+INCOME_KINDS[i][0]+'">'+INCOME_KINDS[i][1]+'</button>';
    }
    kl.innerHTML = kh;
  }
  var klbl = $('iKindLbl');
  if(klbl){ klbl.textContent = iKind==='all' ? 'Все типы' : kindById(iKind)[1]; }
  var ab = $('iAvgBox');
  if(ab){
    var now = new Date();
    var avg6 = 0;
    for(var m=1;m<=6;m++){
      var f6 = new Date(now.getFullYear(), now.getMonth()-m, 1), t6 = new Date(now.getFullYear(), now.getMonth()-m+1, 1);
      for(i=0;i<(D.incomes||[]).length;i++){ var dd6 = parseD(D.incomes[i].d); if(dd6 >= f6 && dd6 < t6){ avg6 += D.incomes[i].s; } }
    }
    avg6 = Math.round(avg6/6);
    if(avg6 > 0){
      var curM = 0;
      var cf = new Date(now.getFullYear(), now.getMonth(), 1);
      for(i=0;i<(D.incomes||[]).length;i++){ var dd2 = parseD(D.incomes[i].d); if(dd2 >= cf){ curM += D.incomes[i].s; } }
      var tr = Math.round((curM-avg6)/avg6*100);
      ab.innerHTML = '<div class="sh-tip">Средний доход за 6 мес: <b>'+fmt(avg6)+'</b> · этот месяц '+(tr>=0?'+':'')+tr+'% к среднему</div>';
    } else { ab.innerHTML = ''; }
  }
  var sb = $('iStructBox');
  if(sb){
    var byK = {};
    for(i=0;i<items.length;i++){ byK[items[i].k] = (byK[items[i].k]||0)+items[i].s; }
    var arrK = []; for(var k2 in byK){ arrK.push({k:k2, s:byK[k2]}); }
    arrK.sort(function(a,b){ return b.s-a.s; });
    var sh = '';
    var colsK = ['#30d158','#0a84ff','#ff9f0a','#bf5af2','#ff453a'];
    for(i=0;i<arrK.length;i++){
      var kk = kindById(arrK[i].k);
      var p = totAll>0 ? Math.round(arrK[i].s/totAll*100) : 0;
      sh += '<div class="catsum-row" data-act="i-kind" data-c="'+arrK[i].k+'"><span class="catsum-name">'+kk[1]+'</span><div class="bar-large" style="height:6px;flex:1"><i style="width:'+p+'%;background:'+colsK[i%5]+'"></i></div><b>'+fmt(arrK[i].s)+'</b></div>';
    }
    sb.innerHTML = sh ? '<div class="cap" style="margin:10px 4px 6px">Структура доходов · тап фильтрует список</div>'+sh : '';
    var cashSum = byK['cash']||0;
    var cb = $('iCashbackBox');
    if(cb){ cb.innerHTML = cashSum>0 ? '<div class="sh-tip">Кэшбэк за период: <b>'+fmt(cashSum)+'</b> <button class="chip" style="margin-left:6px" data-act="cashback-add">В копилку</button></div>' : ''; }
  }
  var tb = $('iTplBox');
  if(tb){
    tb.innerHTML = ((D.income||0) > 0 ? '<button class="chip" data-act="i-tpl" data-k="salary">Зарплата · '+fmt(D.income)+'</button>' : '')
      + '<button class="chip" data-act="i-tpl" data-k="side">Подработка</button>'
      + '<button class="chip" data-act="i-tpl" data-k="cash">Кэшбэк</button>';
  }
  fItems.sort(function(a,b){ return b.d - a.d; });
  var h = ''; var lastKey = '';
  for(i=0;i<fItems.length;i++){
    var t = fItems[i];
    var k = iso(t.d);
    if(k !== lastKey){ lastKey = k; h += '<div class="hist-day">'+t.d.getDate()+' '+MONTHS[t.d.getMonth()]+' · '+WEEKDAYS[t.d.getDay()]+'</div>'; }
    var kk2 = kindById(t.k);
    h += '<div class="tx" data-act="i-edit" data-i="'+t.id+'" style="cursor:pointer"><div class="tx-ic '+kk2[2]+'"><svg class="ic"><use href="#'+kk2[3]+'"/></svg></div><div class="tx-body"><b>'+t.n+'</b><span>'+kk2[1]+(t.auto?' · авто':'')+'</span></div><div class="tx-right"><b class="pos">+'+fmt(t.s)+'</b></div></div>';
  }
  $('incList').innerHTML = h || '<p style="color:var(--mut);font-size:13px;padding:12px">За выбранный период поступлений нет</p>';
}

function renderDigest(){
  var now = new Date();
  function itemsFor(days){
    var items = []; var sum = 0; var i;
    for(i=0;i<D.pays.length;i++){
      var diff = (D.pays[i].d - now.getDate() + 31) % 31;
      if(diff <= days){ items.push({n:D.pays[i].n, s:D.pays[i].s, diff:diff}); sum += D.pays[i].s; }
    }
    for(i=0;i<D.insts.length;i++){
      var dd = parseD(D.insts[i].d);
      var d2 = Math.round((dd - now) / 864e5);
      if(d2 >= 0 && d2 <= days){ items.push({n:D.insts[i].n, s:D.insts[i].s, diff:d2}); sum += D.insts[i].s; }
    }
    return {items:items, sum:sum};
  }
  var r3 = itemsFor(3);
  var use7 = r3.items.length === 0;
  var r = use7 ? itemsFor(7) : r3;
  var h = '';
  if(r.items.length === 0){ h = '<div class="dig-item"><span>Ближайших платежей нет</span><b>—</b></div>'; }
  for(var j=0;j<r.items.length;j++){
    var when = r.items[j].diff === 0 ? 'сегодня' : (r.items[j].diff === 1 ? 'завтра' : 'через '+r.items[j].diff+' дн.');
    h += '<div class="dig-item"><span>'+esc(r.items[j].n)+' · '+when+'</span><b class="'+(r.items[j].diff<=1?'soon':'')+'">'+fmt(r.items[j].s)+'</b></div>';
  }
  $('digList').innerHTML = h;
  $('digSum').textContent = fmt(r.sum);
  var dl = document.querySelector('[data-t="upcoming-detail"] .cap-title span');
  if(dl){ dl.textContent = use7 ? 'Платежи на 7 дней' : 'Платежи на 3 дня'; }
}

function renderBanner(){
  var box = $('bannerBox');
  if(!box){ return; }
  // Баннер отчёта — первые 5 дней НОВОГО ЦИКЛА (отчёт за предыдущий)
  var nowB = new Date();
  var csB = cycleStart(nowB);
  var daysInto = Math.round((nowB - csB)/864e5);
  if(daysInto <= 5){
    var prevCs = shiftCycle(csB, -1);
    box.innerHTML = '<div class="glass card-padding hov" data-act="month-report" style="margin:0 0 14px;background:linear-gradient(135deg, rgba(10,132,255,.18), rgba(191,90,242,.18));border:1px solid rgba(10,132,255,.35);cursor:pointer"><b style="font-size:13px">Отчёт за цикл '+cycleLabel(prevCs)+' готов</b><p style="font-size:11.5px;color:var(--mut);margin:4px 0 0">Траты, доходы, топ-категории и утечки — открой сводку</p></div>';
  } else { box.innerHTML = ''; }
}

// Состояние первичной настройки (для новичка)
function setupState(){
  var st = {};
  st.inc = (D.income||0) > 0 && !!D.salaryDay;
  st.bal = (D.setupBal === 1) || ((D.baseBalance||0) !== 0);
  st.pay = (D.pays||[]).length > 0 || (D.credits||[]).length > 0 || (D.insts||[]).length > 0;
  st.env = (D.envs||[]).length > 0;
  var n = 0, total = 0, firstMiss = '';
  for(var k in st){
    total++;
    if(st[k]){ n++; } else if(!firstMiss){ firstMiss = k; }
  }
  return {st:st, done:n, total:total, ready:n === total, firstMiss:firstMiss};
}

function renderDashboardNew() {
  var now = new Date();
  var su = setupState();
  var safeBal = calcSafeBalance();
  var daily = calcDailyLimit();
  var health = calcHealthScore();

  // ===== ЧЕК-ЛИСТ НАСТРОЙКИ ДЛЯ НОВИЧКА =====
  var sb2 = $('setupBox');
  if(sb2){
    if(su.ready){
      if(window._setupWasReady === false){ toast('Настройка завершена — дальше я слежу за деньгами сам'); }
      window._setupWasReady = true;
      sb2.innerHTML = '';
    } else {
      window._setupWasReady = false;
      var stepDefs = [
        {k:'inc', act:'sheet', extra:' data-t="income"', t:'Доход и день зарплаты', d:'две цифры — и лимиты оживут'},
        {k:'bal', act:'sheet', extra:' data-t="balance"', t:'Текущий баланс', d:'сколько денег на всех картах сейчас'},
        {k:'pay', act:'nav', extra:' data-p="budget"', t:'Обязательные платежи', d:'аренда, связь, кредиты — чтобы прогноз им верил'},
        {k:'env', act:'nav', extra:' data-p="budget"', t:'Первый конверт', d:'лимит на еду или кафе'}
      ];
      var sh2 = '<div class="glass card-padding" style="margin:0 0 14px;border-left:3px solid var(--acc);border-radius:18px">'
        + '<div class="cap-title"><span>Настройка · '+su.done+' из '+su.total+'</span><b style="font-size:11px;color:var(--mut)">2 минуты</b></div>';
      for(var sd=0;sd<stepDefs.length;sd++){
        var dfn = stepDefs[sd];
        var okS = su.st[dfn.k];
        sh2 += '<div class="dig-item hov-click" style="cursor:pointer;border-radius:10px;padding-left:6px" data-act="'+dfn.act+'"'+dfn.extra+'>'
          + '<span><b>'+(okS?'✓ ':'')+(sd+1)+'. '+dfn.t+'</b><br><span style="font-size:11px">'+dfn.d+(okS?' · готово':'')+'</span></span>'
          + '<b style="color:'+(okS?'var(--grn)':'var(--teal)')+'">'+(okS?'готово':'начать ›')+'</b></div>';
      }
      sh2 += '<div class="note" style="margin-top:8px">Быстрый старт: Траты → Инструменты → «Вставить выписку» — история заполнится сама.</div></div>';
      sb2.innerHTML = sh2;
    }
  }

  // ===== БРИФИНГ ДНЯ =====
  var bb = $('briefBox');
  if(bb){
    if(!su.ready){
      bb.innerHTML = '<div class="glass card-padding" style="margin:0 0 14px;border-radius:18px">'
        + '<div class="cap-title"><span>Брифинг на сегодня</span><b style="font-size:11px;color:var(--mut)">ждёт настройки</b></div>'
        + '<div class="note" style="margin:0">Здесь будет ваш лимит на день и главный риск. Заполните чек-лист выше — цифры появятся сами.</div></div>';
    } else {
    var bLeft = Math.max(0, daily.perDay - (function(){
      var sB = 0; var tk = iso(now); var aB = allSpends();
      for(var q=0;q<aB.length;q++){ if(iso(aB[q].d) === tk){ sB += aB[q].s; } }
      return sB;
    })());
    var sigsB = getSignals();
    var topSig = sigsB.length ? sigsB[0] : null;
    var riskTxt = topSig ? topSig.title : 'рисков нет';
    var riskCol = topSig ? (topSig.sev >= 8 ? 'var(--red)' : (topSig.sev >= 5 ? 'var(--org)' : 'var(--blu)')) : 'var(--grn)';
    // ближайший крупный платёж
    var nearTxt = 'крупных списаний близко нет';
    var nearDiff = 999;
    var np;
    for(var bp=0;bp<D.pays.length;bp++){
      var dff = (D.pays[bp].d - now.getDate() + 31) % 31;
      if(dff <= 3 && dff < nearDiff){ nearDiff = dff; nearTxt = D.pays[bp].n+' −'+fmt(D.pays[bp].s)+(dff===0?' · сегодня':(dff===1?' · завтра':' · через '+dff+' дн.')); }
    }
    for(var bi=0;bi<D.insts.length;bi++){
      var dI = Math.round((parseD(D.insts[bi].d) - now)/864e5);
      if(dI >= 0 && dI <= 3 && dI < nearDiff){ nearDiff = dI; nearTxt = D.insts[bi].n+' −'+fmt(D.insts[bi].s)+(dI===0?' · сегодня':(dI===1?' · завтра':' · через '+dI+' дн.')); }
    }
    for(var bc=0;bc<(D.credits||[]).length;bc++){
      if(!((D.credits[bc].pay||0) > 0)){ continue; }
      var dC = ((D.credits[bc].d || 1) - now.getDate() + 31) % 31;
      if(dC <= 3 && dC < nearDiff){ nearDiff = dC; nearTxt = D.credits[bc].n+' −'+fmt(D.credits[bc].pay)+(dC===0?' · сегодня':(dC===1?' · завтра':' · через '+dC+' дн.')); }
    }
    bb.innerHTML = '<div class="glass card-padding hov" data-act="sheet" data-t="daily" style="margin:0 0 14px;border-left:3px solid '+riskCol+';border-radius:18px">'
      + '<div class="cap-title"><span>Брифинг на сегодня</span><b style="color:'+riskCol+';font-size:11px">'+riskTxt+'</b></div>'
      + '<div style="display:flex;align-items:baseline;gap:8px;margin:4px 0 6px"><b style="font-size:24px">'+fmt(bLeft)+'</b><span style="font-size:11px;color:var(--mut)">осталось на сегодня из '+fmt(daily.perDay)+'</span></div>'
      + '<div class="note" style="margin:0">'+nearTxt+'</div></div>';
    }
  }

  // ===== ПРЕДУПРЕЖДЕНИЯ ЗАРАНЕЕ =====
  var wb2 = $('warnBox');
  if(wb2){
    var fW = forecastCashFlow(90);
    var incW = D.income || 0;
    var outW = '';
    var shownW = 0;
    for(var wi=0; wi<fW.events.length && shownW < 3; wi++){
      var evW = fW.events[wi];
      if(evW.amt >= 0){ continue; }
      var dW = Math.round((evW.date - now)/864e5);
      if(dW < 0 || dW > 14){ continue; }
      if(incW > 0 && Math.abs(evW.amt) < incW*0.1){ continue; }
      var balIdx = Math.min(fW.flow.length-1, Math.max(0, dW));
      var balW = fW.flow[balIdx].balance;
      var bufW = Math.floor(balW / Math.max(1, fW.flexPerDay));
      var isRisk = balW < 0 || bufW < 10;
      if(!isRisk){ continue; }
      var colW = balW < 0 ? 'var(--red)' : 'var(--org)';
      var moodW = balW < 0 ? 'не хватит' : (bufW < 7 ? 'впритык' : 'узко');
      outW += '<div class="glass hov" data-act="sheet" data-t="runway" style="margin:0 0 10px;padding:12px 16px;border-left:3px solid '+colW+';border-radius:16px;cursor:pointer">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-size:12.5px"><b style="color:'+colW+'">Через '+dW+' дн. — '+esc(evW.n.replace('Платёж: ','').replace('Кредит: ','кредит '))+'</b> −'+fmt(Math.abs(evW.amt))+'</span><svg class="ic chev" style="width:14px;height:14px"><use href="#i-chev"/></svg></div>'
        + '<div class="note" style="margin-top:3px">К этому дню на счету ≈ '+fmt(balW)+' — '+moodW+'. Запас: '+Math.max(0,bufW)+' дн. жизни текущим темпом.</div></div>';
      shownW++;
    }
    wb2.innerHTML = outW;
  }

  if ($('healthScore')) $('healthScore').textContent = su.ready ? health + ' / 100' : '—';
  if ($('safeBalanceHint')) $('safeBalanceHint').textContent = su.ready ? 'Безопасно: ' + fmt(safeBal) : 'Заполните настройку';
    var spentToday = 0; var tkNow = iso(now); var allNow = allSpends();
  for(var st2=0; st2<allNow.length; st2++){ if(iso(allNow[st2].d) === tkNow){ spentToday += allNow[st2].s; } }
  if ($('dailyLimitVal')) $('dailyLimitVal').textContent = su.ready ? (fmt(spentToday) + ' из ' + fmt(daily.perDay)) : '—';
  if ($('dailyLimitProgress')) {
    var pT = Math.min(100, Math.round(spentToday / Math.max(1, daily.perDay) * 100));
    $('dailyLimitProgress').style.width = (su.ready ? pT : 0) + '%';
    $('dailyLimitProgress').style.background = (spentToday > daily.perDay) ? 'var(--red)' : 'var(--grn)';
  }
  if ($('todayLine')){
    var tp2 = 0;
    for(var t7=0;t7<D.pays.length;t7++){ var df7 = (D.pays[t7].d - now.getDate() + 31) % 31; if(df7 === 0){ tp2 += D.pays[t7].s; } }
    for(var t8=0;t8<D.insts.length;t8++){ var df8 = Math.round((parseD(D.insts[t8].d) - new Date(now.getFullYear(), now.getMonth(), now.getDate()))/864e5); if(df8 === 0){ tp2 += D.insts[t8].s; } }
    var yd2 = new Date(now.getFullYear(), now.getMonth(), now.getDate()-1);
    var ySpent = 0;
    var allY = allSpends();
    for(var t9=0;t9<allY.length;t9++){ if(iso(allY[t9].d) === iso(yd2)){ ySpent += allY[t9].s; } }
    var scootD2 = {};
    for(var tA=0;tA<allY.length;tA++){ if(allY[tA].cat === 'scooters'){ scootD2[iso(allY[tA].d)] = 1; } }
    var stS = 0;
    for(var ds2=0; ds2<365; ds2++){ var dxx = new Date(); dxx.setDate(dxx.getDate()-ds2); if(!scootD2[iso(dxx)]){ stS++; } else { break; } }
    $('todayLine').textContent = su.ready ? 'Можно '+fmt(daily.perDay)+'/день · сегодня платежей: '+fmt(tp2)+' · вчера −'+fmt(ySpent)+' · без самокатов: '+stS+' дн.' : 'Заполните настройку выше — и здесь появятся живые цифры';
  }    var cs = cycleStart(now);
  var ce = cycleEnd(cs);
  var totalDaysInCycle = Math.max(1, Math.round((ce - cs) / 864e5));
  var daysPassed = Math.max(0, Math.round((now - cs) / 864e5));
  var cyclePct = Math.min(100, Math.max(0, Math.round((daysPassed / totalDaysInCycle) * 100)));
  if ($('cycleProgressBar')) $('cycleProgressBar').style.width = cyclePct + '%';
  if ($('cycleDaysLeft')) $('cycleDaysLeft').textContent = 'Осталось ' + daily.daysLeft + ' дн.';
  if ($('cycleDates')) $('cycleDates').textContent = cycLabel(cs);
  var fixedPay = calcMonthlyFixedPay();
  if ($('sFixedPay')) $('sFixedPay').textContent = fmt(fixedPay);
  var goalsTotal = 0, goalsActive = 0;
  for(var ig2=0;ig2<(D.goals||[]).length;ig2++){
    goalsTotal += D.goals[ig2].cur || 0;
    if(!D.goals[ig2].done){ goalsActive++; }
  }
    if ($('sGoalsVal')) $('sGoalsVal').textContent = fmt(goalsTotal);
  var cushG = null;
  for(var ig4=0;ig4<(D.goals||[]).length;ig4++){ if(/подушк/i.test(D.goals[ig4].n)){ cushG = D.goals[ig4]; break; } }
  var gp2 = $('goalProgress');
  if(gp2 && cushG){ gp2.style.width = Math.min(100, Math.round((cushG.cur||0)/Math.max(1,cushG.target)*100)) + '%'; }
  var pill2 = $('sGoalsPill');
  if(pill2){ pill2.textContent = cushG ? 'подушка '+Math.min(100, Math.round((cushG.cur||0)/Math.max(1,cushG.target)*100))+'% · '+goalsActive+' активн.' : goalsActive+' активн. · нажми'; }
  var csP = cycleStart(now);
  var ceP = cycleEnd(csP);
  var dtp = Math.max(1, Math.round((ceP - now)/864e5));
  var allP = allSpends();
  var cycSp = 0;
  for(var pp2=0;pp2<allP.length;pp2++){ if(allP[pp2].d >= csP && allP[pp2].d < ceP){ cycSp += allP[pp2].s; } }
  var elp2 = Math.max(1, Math.round((now - csP)/864e5));
  var pace2 = cycSp / elp2;
  var left2 = Math.round(realBal() - pace2 * dtp);
  if ($('rhythmTxt')){
    var rCol = '';
    if(cycSp <= 0){ $('rhythmTxt').textContent = 'Ритм трат: —'; $('rhythmTxt').style.color = ''; }
    else {
      var rk = pace2 / Math.max(1, daily.perDay);
      if(rk > 1.15){ $('rhythmTxt').textContent = 'Ритм трат: выше темпа'; rCol = 'var(--red)'; }
      else if(rk >= 0.85){ $('rhythmTxt').textContent = 'Ритм трат: норма'; rCol = ''; }
      else { $('rhythmTxt').textContent = 'Ритм трат: экономия'; rCol = 'var(--grn)'; }
      $('rhythmTxt').style.color = rCol;
    }
  }
  var rwNow = cashRunway();
  var minB = minBalance(90);
  var paydayDays = calcDailyLimit().daysLeft;
  if($('runwayVal')){
    if(!su.ready){
      $('runwayVal').textContent = '—';
      $('runwayVal').style.color = '';
    }
    else if(rwNow >= 90){ $('runwayVal').textContent = '90+ дн'; $('runwayVal').style.color = 'var(--grn)'; }
    else { $('runwayVal').textContent = rwNow + ' дн'; $('runwayVal').style.color = rwNow >= paydayDays ? 'var(--grn)' : (rwNow > 7 ? 'var(--org)' : 'var(--red)'); }
  }
  if($('runwayLbl')){ $('runwayLbl').textContent = (!su.ready) ? 'Прогноз' : (rwNow < paydayDays ? 'Денег хватит на' : 'Прогноз баланса'); }
  if($('runwayHint')){
    if(!su.ready){
      $('runwayHint').textContent = 'появится после настройки';
      $('runwayHint').style.color = 'var(--mut)';
    } else if(minB.val < 0){
      $('runwayHint').textContent = 'мин. баланс '+fmt(minB.val)+' через '+minB.daysFromNow+' дн';
      $('runwayHint').style.color = 'var(--red)';
    } else {
      $('runwayHint').textContent = 'минимум '+fmt(minB.val)+' через '+minB.daysFromNow+' дн';
      $('runwayHint').style.color = 'var(--mut)';
    }
  }
  var mini = $('forecastMini');
  if(mini){
    var fMini = forecastCashFlow(90);
    var Wm = mini.clientWidth || 200;
    mini.width = Wm * 2; mini.height = 60;
    mini.style.height = '30px';
    var ym = mini.getContext('2d');
    ym.setTransform(2,0,0,2,0,0);
    var vals = [];
    for(var vi=0;vi<fMini.flow.length;vi++){ vals.push(fMini.flow[vi].balance); }
    var mnV = Math.min.apply(null, vals), mxV = Math.max.apply(null, vals);
    var rng = mxV - mnV || 1;
    ym.strokeStyle = 'rgba(100,210,255,.6)';
    ym.lineWidth = 1.5;
    ym.beginPath();
    for(var pi=0;pi<vals.length;pi++){
      var px = pi/(vals.length-1)*Wm;
      var py = 30 - ((vals[pi]-mnV)/rng)*26 - 2;
      if(pi===0){ ym.moveTo(px,py); } else { ym.lineTo(px,py); }
    }
    ym.stroke();
    // красная точка на минимуме
    var minI = 0; for(var mi=1;mi<vals.length;mi++){ if(vals[mi] < vals[minI]){ minI = mi; } }
    var mpx = minI/(vals.length-1)*Wm;
    var mpy = 30 - ((vals[minI]-mnV)/rng)*26 - 2;
    ym.fillStyle = vals[minI] < 0 ? '#ff453a' : '#30d158';
    ym.beginPath(); ym.arc(mpx, mpy, 3, 0, 6.28); ym.fill();
  }


  
  var plbl = document.querySelector('[data-t="payday"] span');
  if(plbl){ plbl.textContent = left2 >= 0 ? 'До зарплаты останется' : 'До зарплаты не хватит'; }
  if($('paydayHint')){ $('paydayHint').textContent = 'темп '+fmt(Math.round(pace2))+'/день · зарплата '+ceP.getDate()+'.'+String(ceP.getMonth()+1).padStart(2,'0'); }
  var debtsCur = 0, debtsTot = 0;
  for(var dc2=0;dc2<D.credits.length;dc2++){ debtsCur += D.credits[dc2].cur||0; debtsTot += (D.credits[dc2].total||D.credits[dc2].cur||0); }
  for(var di2=0;di2<D.insts.length;di2++){ if(parseD(D.insts[di2].d) >= now){ debtsCur += D.insts[di2].s; debtsTot += D.insts[di2].s; } }
  var paidPct = debtsTot > 0 ? Math.round((debtsTot - debtsCur)/debtsTot*100) : 0;
  if($('sDebtsVal')){ $('sDebtsVal').textContent = fmt(debtsCur); }
  if($('debtsProgress')){ $('debtsProgress').style.width = paidPct + '%'; }
  if($('sDebtsPill')){ $('sDebtsPill').textContent = 'погашено '+paidPct+'% · нажми'; }
  var mFrom2 = new Date(now.getFullYear(), now.getMonth(), 1), mTo2 = new Date(now.getFullYear(), now.getMonth()+1, 1);
  var mInc = 0;
  for(var mi2=0;mi2<(D.incomes||[]).length;mi2++){ var di3 = parseD(D.incomes[mi2].d); if(di3 >= mFrom2 && di3 < mTo2){ mInc += D.incomes[mi2].s; } }
  var mSp2 = 0;
  for(var ms2=0;ms2<allP.length;ms2++){ if(allP[ms2].d >= mFrom2 && allP[ms2].d < mTo2){ mSp2 += allP[ms2].s; } }
  var rate2 = mInc > 0 ? Math.round((mInc - mSp2)/mInc*100) : 0;
  if($('sSaveRate')){ $('sSaveRate').textContent = rate2 + '%'; $('sSaveRate').style.color = rate2 >= 10 ? 'var(--grn)' : 'var(--red)'; }
  if($('sSaveHint')){ $('sSaveHint').textContent = rate2 >= 10 ? 'отлично · норма 10%+' : 'норма — от 10%'; }
  var wb = $('weekBudgetBox');
  if(wb){
    var wd0 = (now.getDay()+6)%7;
    var ws3 = new Date(now.getFullYear(), now.getMonth(), now.getDate()-wd0);
    var we3 = new Date(ws3.getTime()+7*864e5);
    var wSpent = 0;
    for(var ww=0;ww<allP.length;ww++){ if(allP[ww].d >= ws3 && allP[ww].d < we3){ wSpent += allP[ww].s; } }
    var wLimit = daily.perDay * 7;
    var wPct = Math.min(100, Math.round(wSpent/Math.max(1,wLimit)*100));
    var wCol = wPct > 100 ? 'var(--red)' : (wPct > 85 ? 'var(--org)' : 'var(--grn)');
    wb.innerHTML = !su.ready
      ? '<div class="subs-audit glass" style="margin-bottom:14px"><div class="note">Цель недели появится после настройки</div></div>'
      : '<div class="subs-audit glass hov" data-act="sheet" data-t="daily" style="margin-bottom:14px;flex-direction:column;align-items:stretch;gap:8px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:12.5px">Цель недели · потрачено '+fmt(wSpent)+' из '+fmt(wLimit)+'</b><span style="font-size:11px;color:var(--mut)">'+wPct+'%</span></div>'
      + '<div class="limit-status-bar"><i style="width:'+wPct+'%;background:'+wCol+'"></i></div></div>';
      // План на месяц
  var planBox = $('monthPlanBox');
  if(!planBox){
    planBox = document.createElement('div');
    planBox.id = 'monthPlanBox';
    planBox.className = 'subs-audit glass hov';
    planBox.style.cssText = 'margin-bottom:14px;flex-direction:column;align-items:stretch;gap:6px;cursor:pointer';
    planBox.setAttribute('data-act','sheet');
    planBox.setAttribute('data-t','fixed');
      // Лог решений и их эффект
  var decBox = $('decisionBox');
  if(!decBox){
    decBox = document.createElement('div');
    decBox.id = 'decisionBox';
    decBox.className = 'subs-audit glass hov';
    decBox.style.cssText = 'margin-bottom:14px;flex-direction:column;align-items:stretch;gap:6px';
    decBox.setAttribute('data-act','sheet');
    decBox.setAttribute('data-t','fixed');
    var dashContainer = document.querySelector('.dash-grid');
    if(dashContainer){ dashContainer.insertBefore(decBox, dashContainer.firstChild); }
  }
  
  var decisions = getRecentDecisions();
  if(decisions.length){
    var decHtml = '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<b style="font-size:12.5px">Твои решения</b>' +
      '<span style="font-size:11px;color:var(--mut)">последние 5</span>' +
      '</div>';
    
    for(var i=0;i<Math.min(3, decisions.length);i++){
      var d = decisions[i];
      var effect = getDecisionEffect(d.id);
      var txt = '';
      if(d.type === 'cut_spend'){
        txt = 'Урезал "'+catById(d.data.cat).n+'"';
        if(effect && effect.success){
          txt += ' — сэкономил '+fmt(effect.saved);
        } else if(effect && !effect.success) {
          txt += ' — эффекта пока нет';
        } else {
          txt += ' — оценим через месяц';
        }
      } else if(d.type === 'save_money'){
        txt = 'Отложил '+fmt(d.data.amount)+' в копилку';
      } else if(d.type === 'cancel_sub'){
        txt = 'Отключил подписку "'+esc(d.data.name)+'"';
      } else if(d.type === 'postpone_pay'){
        txt = 'Отложил платёж "'+esc(d.data.name)+'"';
      }
      var dateLabel = new Date(d.date).toLocaleDateString('ru-RU', {day:'numeric', month:'short'});
      decHtml += '<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0">' +
        '<span>'+dateLabel+' · '+txt+'</span>' +
        '</div>';
    }
    decBox.innerHTML = decHtml;
  } else {
    decBox.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<b style="font-size:12.5px">Твои решения</b>' +
      '<span style="font-size:11px;color:var(--mut)">пока нет</span>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--mut)">Сделай первый шаг: урежь траты или отложи деньги в копилку</div>';
  }
    var dashContainer = document.querySelector('.dash-grid');
    if(dashContainer){ dashContainer.insertBefore(planBox, dashContainer.firstChild); }
  }
  
  var plan = calcMonthlyPlan();
  var topCats = [];
  for(var cat in plan){
    if(cat === '_saveTarget' || cat === '_available' || cat === '_fixedCosts') continue;
    topCats.push({cat:cat, limit:plan[cat]});
  }
  topCats.sort(function(a,b){ return b.limit - a.limit; });
  topCats = topCats.slice(0,3);
  
  var planHtml = '<div style="display:flex;justify-content:space-between;align-items:center">' +
    '<b style="font-size:12.5px">План на месяц</b>' +
    '<span style="font-size:11px;color:var(--mut)">'+fmt(plan._available)+' после обязательных</span>' +
    '</div>';
  
  for(var i=0;i<topCats.length;i++){
    var pc = topCats[i];
    var pct = plan._available > 0 ? Math.round(pc.limit / plan._available * 100) : 0;
    planHtml += '<div style="display:flex;justify-content:space-between;font-size:11px">' +
      '<span>'+catById(pc.cat).n+'</span>' +
      '<b>'+fmt(pc.limit)+'</b>' +
      '</div>' +
      '<div class="limit-status-bar"><i style="width:'+Math.min(100,pct)+'%;background:var(--blu)"></i></div>';
  }
  
  planHtml += '<div style="display:flex;justify-content:space-between;font-size:11px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.05)">' +
    '<span style="color:var(--grn)">Отложить</span>' +
    '<b style="color:var(--grn)">'+fmt(plan._saveTarget)+'</b>' +
    '</div>' +
    '<div style="font-size:10px;color:var(--mut);text-align:center;margin-top:4px">Нажми, чтобы настроить лимиты</div>';
  
  planBox.innerHTML = planHtml;
      // Кнопка перераспределения (если есть перерасход)
  var rebalance = rebalanceBudget();
  if(rebalance && rebalance.suggestions.length){
    var btnHtml = '<button class="sh-btn" style="margin-top:8px;width:100%;background:rgba(255,159,10,.15);color:var(--org)" data-act="rebalance-show">Перераспределить бюджет ('+fmt(rebalance.totalOver)+' перерасход)</button>';
    planBox.insertAdjacentHTML('beforeend', btnHtml);
  }
  }
}

var RU_HOLIDAYS = ['01-01','01-02','01-03','01-04','01-05','01-06','01-07','01-08','02-23','03-08','05-01','05-09','06-12','11-04','12-31'];
function isRuWeekend(d){
  var wd = d.getDay();
  if(wd === 0 || wd === 6){ return true; }
  var md = String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  return RU_HOLIDAYS.indexOf(md) !== -1;
}

function myDayData(y, m, day){
  var rings = [];
  var plans = [];
  var md2 = String(m+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  var iso2 = y+'-'+md2;
  var sd = salaryDate(y, m);
  if(sd.getFullYear() === y && sd.getMonth() === m && sd.getDate() === day){
    var ck0 = 'salary-'+iso2;
    if((D.cancelled||[]).indexOf(ck0) === -1){ rings.push({c:'#30d158', n:'Зарплата', id:'salary', type:'salary', date:iso2}); }
  }
  for(var i=0;i<(D.pays||[]).length;i++){
    if((D.pays[i].d||0) === day){
      var ck1 = 'pay-'+D.pays[i].id+'-'+iso2;
      if((D.cancelled||[]).indexOf(ck1) === -1){ rings.push({c:'#ff453a', n:'Платёж: '+D.pays[i].n, id:D.pays[i].id, type:'pay', date:iso2}); }
    }
  }
  for(var j=0;j<(D.insts||[]).length;j++){
    var dd = parseD(D.insts[j].d);
    if(dd.getFullYear() === y && dd.getMonth() === m && dd.getDate() === day){
      var ck2 = 'inst-'+D.insts[j].id+'-'+iso2;
      if((D.cancelled||[]).indexOf(ck2) === -1){ rings.push({c:'#ff9f0a', n:'Рассрочка: '+D.insts[j].n, id:D.insts[j].id, type:'inst', date:iso2}); }
    }
  }
  for(var k=0;k<(D.events||[]).length;k++){
    var e2 = D.events[k];
    if(e2.d === iso2 || (e2.yearly && e2.d === md2)){ plans.push({c:e2.c||'#bf5af2', n:e2.n, id:e2.id, personal:1}); }
  }
  return {rings:rings, plans:plans, bg: bgFor(plans)};
}

function herDayData(y, m, day){
  return {rings: herDayEvents(y, m, day), plans: [], bg: ''};
}
function herDayEvents(y, m, day){
  var ev = [];
  if(day === 1 || day === 16){ ev.push({c:'#30d158', n:'ЗП любимой'}); }
  var key = y+'-'+String(m+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  var st = (D.her||{})[key];
  if(st === 1){ ev.push({c:'#0a84ff', n:'Работа'}); }
  if(st === 0){ ev.push({c:'#bf5af2', n:'Выходной'}); }
  return ev;
}

function ringStyle(ev){
  if(!ev.length){ return ''; }
  if(ev.length === 1){ return 'background:'+ev[0].c+';'; }
  var seg = 100 / ev.length;
  var parts = [];
  for(var i=0;i<ev.length;i++){
    parts.push(ev[i].c+' '+(i*seg).toFixed(1)+'% '+((i+1)*seg).toFixed(1)+'%');
  }
  return 'background:conic-gradient('+parts.join(',')+');';
}
function bgFor(list){
  if(!list.length){ return ''; }
  return ringStyle(list).substring('background:'.length);
}
function rgba(hex, a){
  var h = hex.replace('#','');
  if(h.length === 3){ h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; }
  var r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
  return 'rgba('+r+','+g+','+b+','+a+')';
}
function semiGrad(list){
  var a = 0.25;
  if(list.length === 1){ return 'linear-gradient('+rgba(list[0].c,a)+','+rgba(list[0].c,a)+')'; }
  var seg = 100 / list.length;
  var parts = [];
  for(var i=0;i<list.length;i++){
    parts.push(rgba(list[i].c,a)+' '+(i*seg).toFixed(1)+'% '+((i+1)*seg).toFixed(1)+'%');
  }
  return 'conic-gradient('+parts.join(',')+')';
}

var EV_COLORS = ['#a3e635','#f5c518','#0a84ff','#bf5af2','#ff375f','#ff9f0a','#64d2ff','#30d158','#ff6b35','#e0aaff','#4cc9f0','#f72585','#80ed99','#ffd60a','#9d4edd','#48bfe3'];
var planColor = null;
function freeColor(){
  for(var i=0;i<EV_COLORS.length;i++){
    var used = false;
    for(var j=0;j<(D.events||[]).length;j++){ if(D.events[j].c === EV_COLORS[i]){ used = true; break; } }
    if(!used){ return EV_COLORS[i]; }
  }
  return EV_COLORS[(D.events||[]).length % EV_COLORS.length];
}
function autoColor(name){
  var s = (name||'').toLowerCase();
  if(s.indexOf('отпуск') !== -1 || s.indexOf('каникул') !== -1){ return '#a3e635'; }
  if(s.indexOf('день рожд') !== -1 || s.indexOf('др ') !== -1 || s === 'др'){ return '#f5c518'; }
  return null;
}

function calGridHtml(y, m, dataFn, which, ruWeekend){
  var h = '';
  var dows = ['пн','вт','ср','чт','пт','сб','вс'];
  for(var w=0;w<7;w++){ h += '<div class="cal-dow">'+dows[w]+'</div>'; }
  var first = new Date(y, m, 1);
  var blank = (first.getDay()+6)%7;
  for(var b=0;b<blank;b++){ h += '<div class="cal-day empty"></div>'; }
  var days = new Date(y, m+1, 0).getDate();
  var now = new Date();
  for(var d=1;d<=days;d++){
    var dt = new Date(y, m, d);
    var cls = 'cal-day';
    var dayOfWeek = dt.getDay();
    if(ruWeekend && isRuWeekend(dt)){ cls += ' wknd'; }
    else if(dayOfWeek === 0 || dayOfWeek === 6){ cls += ' wknd'; }
    var isToday = (dt.getFullYear()===now.getFullYear() && dt.getMonth()===now.getMonth() && dt.getDate()===now.getDate());
    if(isToday){ cls += ' today'; }
    var key = y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    if(which==='my' && calSel.indexOf(key) !== -1){ cls += ' sel'; }
    var data = dataFn(y, m, d);
    var layers = [];
    if(data.plans.length){ layers.push(semiGrad(data.plans)); }
    if(isToday){ layers.push('linear-gradient(rgba(10,132,255,.25),rgba(10,132,255,.25))'); }
    var numStyle = layers.length ? ' style="background:'+layers.join(',')+' #10121a;'+(isToday?'color:var(--teal);':'')+'"' : '';
    var inner = '<span class="cal-num"'+numStyle+'>'+d+'</span>';
    if(data.rings.length){ inner = '<span class="cal-ring" style="'+ringStyle(data.rings)+'">'+inner+'</span>'; }
    h += '<div class="'+cls+'" data-act="cal-day" data-w="'+which+'" data-d="'+key+'">'+inner+'</div>';
  }
  return h;
}

function renderMyCal(){
  var now = new Date();
  var dt = new Date(now.getFullYear(), now.getMonth() + calOff, 1);
  var y = dt.getFullYear(), m = dt.getMonth();
  $('myCalTitle').textContent = MONTHS[m]+' '+y;
  $('myCal').innerHTML = calGridHtml(y, m, myDayData, 'my', true);
  var lg = '<span><i style="background:#30d158"></i>ЗП</span>'
    + '<span><i style="background:#ff453a"></i>Платёж</span>'
    + '<span><i style="background:#ff9f0a"></i>Рассрочка</span>';
  var seen = {};
  var daysInM = new Date(y, m+1, 0).getDate();
  for(var d=1; d<=daysInM; d++){
    var dd2 = myDayData(y, m, d);
    var evs = dd2.plans;
    for(var i=0;i<evs.length;i++){
      var e = evs[i];
      var c = e.c || '#bf5af2';
      if(!seen[c]){ seen[c] = []; }
      if(seen[c].indexOf(e.n) === -1 && seen[c].length < 2){ seen[c].push(e.n); }
    }
  }
  for(var c2 in seen){
    lg += '<span><i style="background:'+c2+'"></i>'+seen[c2].join(', ')+'</span>';
  }
  $('myCalLegend').innerHTML = lg;
}

function renderHerCal(){
  var now = new Date();
  var dt = new Date(now.getFullYear(), now.getMonth() + herOff, 1);
  $('herCalTitle').textContent = MONTHS[dt.getMonth()]+' '+dt.getFullYear();
  $('herCal').innerHTML = calGridHtml(dt.getFullYear(), dt.getMonth(), herDayData, 'her', false);
}

function openCalSheet(dstr, noHl){
  var p = dstr.split('-');
  window._calSheetDate = dstr;
  var y = +p[0], m = +p[1]-1, day = noHl ? -1 : +p[2];
  var daysInM = new Date(y, m+1, 0).getDate();
  var rows = '';
  for(var d=1; d<=daysInM; d++){
    var dd2 = myDayData(y, m, d);
    var evs = dd2.rings.concat(dd2.plans);
    for(var i=0;i<evs.length;i++){
      var e = evs[i];
      var left = String(d).padStart(2,'0')+'.'+String(m+1).padStart(2,'0')+' · '+e.n;
      var right;
      if(e.personal){
        right = '<button class="del" data-act="cal-event-del" data-i="'+e.id+'"><svg class="ic" style="width:14px;height:14px"><use href="#i-x"/></svg></button>';
      } else if(e.type){
        right = '<button class="del" data-act="cal-auto-del" data-t="'+e.type+'" data-i="'+e.id+'" data-d="'+e.date+'"><svg class="ic" style="width:14px;height:14px"><use href="#i-x"/></svg></button>';
      } else {
        right = '<span style="color:var(--mut);font-size:10px">авто</span>';
      }
      var hl = (d === day) ? ' style="background:rgba(10,132,255,.08);border-radius:8px;padding-left:6px"' : '';
      rows += '<div class="dig-item"'+hl+'><span>'+left+'</span>'+right+'</div>';
    }
  }
  if(!rows){ rows = '<div class="dig-item"><span>В этом месяце пока пусто</span><b>—</b></div>'; }
  $('sheetBody').innerHTML = sheetHead('i-cal','c-pur','Планы на '+MONTHS[m]+' '+y,'авто — зарплата, платежи и рассрочки; свои события можно удалять')
    + '<div style="max-height:300px;overflow-y:auto">'+rows+'</div>'
    + '<button class="sh-btn" data-act="cal-select-from-sheet">Выбрать дни и добавить план</button>';
  $('sheet').classList.add('on');
  $('shb').classList.add('on');
}

function calEventAdd(){
  var dv = $('evDate').value;
  var nm = $('evName').value.trim();
  if(!dv || !nm){ dAlert('Укажи дату и название события.', 'Событие'); return; }
  var yearly = $('evYear').checked ? 1 : 0;
  D.events.push({id:Date.now(), d: yearly ? dv.slice(5) : dv, n:nm, yearly:yearly});
  save(); render();
  openCalSheet(dv);
  toast('Событие добавлено');
}

function calEventDel(id){
  dConfirm('Удалить это событие из календаря?', 'Удаление плана', true).then(function(ok){
    if(!ok){ return; }
    var before = (D.events||[]).length;
    D.events = (D.events||[]).filter(function(x){ return String(x.id) !== String(id); });
    if((D.events||[]).length === before){
      var nid = parseInt(id,10);
      D.events = (D.events||[]).filter(function(x){ return x.id !== nid; });
    }
    save(); render();
    var now = new Date();
    var dt = new Date(now.getFullYear(), now.getMonth()+calOff, 1);
    openCalSheet(dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-01');
    toast('Событие удалено');
  });
}

function openHerSheet(dstr){
  var p = dstr.split('-');
  var d = new Date(+p[0], +p[1]-1, +p[2]);
  var st = (D.her||{})[dstr];
  var stTxt = st === 1 ? 'рабочий день' : (st === 0 ? 'выходной' : 'не отмечено');
  var dateTxt = String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();
  $('sheetBody').innerHTML = sheetHead('i-user','c-pur','Календарь любимой', dateTxt+' · '+stTxt)
    + rowHtml('Зарплата', '1 и 16 числа')
    + '<div class="row2" style="margin-top:12px">'
    + '<button class="sh-btn" style="margin-top:0" data-d="'+dstr+'" data-act="her-set" data-v="1">Рабочий</button>'
    + '<button class="sh-btn ghost" style="margin-top:0" data-d="'+dstr+'" data-act="her-set" data-v="0">Выходной</button>'
    + '</div>'
    + '<button class="sh-btn ghost" data-d="'+dstr+'" data-act="her-set" data-v="x">Снять отметку с этого дня</button>'
    + '<button class="sh-btn" data-d="'+dstr+'" data-act="her-fill">График 3/3 с этого дня (60 дней)</button>';
  $('sheet').classList.add('on');
  $('shb').classList.add('on');
}

function herSet(dstr, v){
  D.her = D.her || {};
  if(v === 'x'){ delete D.her[dstr]; }
  else { D.her[dstr] = (v === '1') ? 1 : 0; }
  save(); render();
  openHerSheet(dstr);
}

function herFill(dstr){
  var p = dstr.split('-');
  var start = new Date(+p[0], +p[1]-1, +p[2]);
  D.her = D.her || {};
  for(var i=0;i<60;i++){
    var d = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i);
    var key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    D.her[key] = (i % 6) < 3 ? 1 : 0;
  }
  save(); render();
  openHerSheet(dstr);
  toast('График 3/3 заполнен на 60 дней');
}

function findGoal(id){
  for(var i=0;i<(D.goals||[]).length;i++){ if(D.goals[i].id === id){ return D.goals[i]; } }
  return null;
}
function openGoalAdd(){
  $('sheetBody').innerHTML = sheetHead('i-target','c-pur','Новая цель','накопить на что-то важное')
    + '<div class="form">'
    + '<input class="inp" id="gName" placeholder="Название (машина, ремонт, MacBook...)">'
    + '<div class="row2"><input class="inp" id="gTarget" type="number" placeholder="Цель, ₽"><input class="inp" id="gCur" type="number" placeholder="Уже есть, ₽" value="0"></div>'
    + '<input class="inp" id="gDeadline" type="date" placeholder="Срок (необязательно)">'
    + '</div>'
    + '<button class="sh-btn" data-act="goal-add-save">Создать цель</button>';
  $('sheet').classList.add('on');
  $('shb').classList.add('on');
}
function openGoalEdit(id){
  var g = findGoal(id);
  if(!g){ return; }
  $('sheetBody').innerHTML = sheetHead('i-pen','c-pur','Редактировать цель', g.n)
    + '<div class="form">'
    + '<input class="inp" id="gName" placeholder="Название" value="'+g.n+'">'
    + '<div class="row2"><input class="inp" id="gTarget" type="number" placeholder="Цель, ₽" value="'+(g.target||0)+'"><input class="inp" id="gCur" type="number" placeholder="Уже есть, ₽" value="'+(g.cur||0)+'"></div>'
    + '<input class="inp" id="gDeadline" type="date" value="'+(g.deadline||'')+'">'
    + '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--mut);margin-top:8px"><input type="checkbox" id="gDone" '+(g.done?'checked':'')+'> отметить как выполненную</label>'
    + '</div>'
    + '<button class="sh-btn" data-act="goal-edit-save" data-i="'+g.id+'">Сохранить</button>';
  $('sheet').classList.add('on');
  $('shb').classList.add('on');
}
function goalFund(id){
  var g = findGoal(id);
  if(!g){ return; }
  dPrompt('Сколько откладываешь на «'+g.n+'», ₽?', 'Пополнить цель', '10000').then(function(v){
    if(!v){ return; }
    var amt = parseFloat(v);
    if(isNaN(amt) || amt === 0){ return; }
    g.cur = (g.cur||0) + amt;
if(g.cur >= g.target && g.target > 0){ g.done = true; toast('Цель «'+g.n+'» выполнена!'); }
    else { toast('Пополнение цели «'+g.n+'» на '+fmt(amt)); }
    logDecision('save_money', {amount:amt, goal:g.n});
    save(); render();
  });
}
function goalAddSave(){
  var n = $('gName').value.trim();
  var t = parseFloat($('gTarget').value) || 0;
  var c = parseFloat($('gCur').value) || 0;
  var dl = $('gDeadline').value;
  if(!n){ dAlert('Дай цели название.', 'Новая цель'); return; }
  if(t <= 0){ dAlert('Укажи целевую сумму.', 'Новая цель'); return; }
  D.goals.push({id:Date.now(), n:n, cur:c, target:t, deadline:dl||null, done: c >= t});
  save(); closeSheet(); render();
  toast('Цель «'+n+'» создана');
}
function goalEditSave(id){
  var g = findGoal(id);
  if(!g){ return; }
  var n = $('gName').value.trim();
  var t = parseFloat($('gTarget').value) || 0;
  var c = parseFloat($('gCur').value) || 0;
  var dl = $('gDeadline').value;
  var done = $('gDone').checked;
  if(!n){ dAlert('Дай цели название.', 'Редактирование'); return; }
  if(t <= 0){ dAlert('Укажи целевую сумму.', 'Редактирование'); return; }
  g.n = n; g.target = t; g.cur = c; g.deadline = dl||null;
  if(c >= t && t > 0){ g.done = true; }
  else if(done){ g.done = true; }
  else { g.done = false; }
  save(); closeSheet(); render();
  toast('Цель обновлена');
}
function goalDel(id){
  var g = findGoal(id);
  if(!g){ return; }
  dConfirm('Удалить цель «'+g.n+'»? Накопления исчезнут.', 'Удаление цели', true).then(function(ok){
    if(!ok){ return; }
    D.goals = (D.goals||[]).filter(function(x){ return x.id !== id; });
    save(); render(); toast('Цель удалена');
  });
}
function goalUncomplete(id){
  var g = findGoal(id);
  if(!g){ return; }
  dPrompt('Новая целевая сумма для «'+g.n+'», ₽ (если больше текущей — вернётся в активные):', 'Вернуть в активные', String(g.target)).then(function(v){
    if(!v){ return; }
    var nt = parseFloat(v);
    if(isNaN(nt) || nt <= 0){ return; }
    g.target = nt;
    g.done = (g.cur||0) >= nt;
    save(); render(); toast('Цель возвращена');
  });
}

function openPlanSheet(){
  planColor = freeColor();
  var dates = calSel.slice().sort();
  function hum(s){ var p = s.split('-'); return p[2]+'.'+p[1]+'.'+p[0]; }
  var listTxt = dates.length === 1 ? hum(dates[0]) : dates.length+' дн.: '+hum(dates[0])+' – '+hum(dates[dates.length-1]);
  $('sheetBody').innerHTML = sheetHead('i-target','c-pur','Новый план', listTxt)
    + '<div class="form">'
    + '<input class="inp" id="evName" placeholder="Название (отпуск, ДР, проект...)">'
    + '<div class="hint">Отпуск — всегда салатовый, день рождения — всегда золотой. Для остального выбери цвет ниже.</div>'
    + '<div class="ev-pal" id="evPal"></div>'
    + '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--mut)"><input type="checkbox" id="evYear" style="width:18px;height:18px"> повторять ежегодно</label>'
    + '</div>'
    + '<button class="sh-btn" data-act="plan-save">Сохранить план</button>'
    + '<button class="sh-btn ghost" data-act="cal-cancel">Отмена</button>';
  paintPal();
  $('sheet').classList.add('on');
  $('shb').classList.add('on');
  $('evName').addEventListener('input', function(){
    var ac = autoColor(this.value);
    if(ac){ planColor = ac; paintPal(); }
  });
}

function paintPal(){
  var h = '';
  var found = false;
  for(var i=0;i<EV_COLORS.length;i++){
    if(EV_COLORS[i] === planColor){ found = true; }
    h += '<button data-act="ev-color" data-c="'+EV_COLORS[i]+'" class="'+(EV_COLORS[i]===planColor?'on':'')+'" style="background:'+EV_COLORS[i]+'"></button>';
  }
  if(!found){ h += '<button data-act="ev-color" data-c="'+planColor+'" class="on" style="background:'+planColor+'"></button>'; }
  $('evPal').innerHTML = h;
}

function applySeed(S){
  D.tx = (S.tx||[]).map(function(r){ return {d:r[0], n:r[1], s:r[2], c:r[3]}; });
  if(S.subs){ D.subs = S.subs; }
  if(S.credits){ D.credits = S.credits; }
  D.seedVersion = S.version;
  save();
}

function smartTips(){
  var now = new Date();
  var tips = [];
  var act = activeLeaks();
  if(act.length){ tips.push('Главная утечка месяца - "'+act[0].n+'": перерасход '+fmt(act[0].over)+'. Открой рекомендации и проверь лимиты.'); }
  var cush = null;
  for(var i=0;i<(D.goals||[]).length;i++){ if(/подушк/i.test(D.goals[i].n)){ cush = D.goals[i]; break; } }
  if(cush && !cush.done){
    var p = Math.min(100, Math.round((cush.cur||0)/Math.max(1,cush.target)*100));
    if(p < 10){ tips.push('Подушка безопасности всего '+p+'%. Стартуй с 10% дохода - это '+fmt((D.income||0)*0.1)+' в месяц.'); }
    else { tips.push('Подушка на '+p+'%. До цели не хватает '+fmt(Math.max(0,(cush.target||0)-(cush.cur||0)))+' - держи темп.'); }
  }
  var np = nextPay(3);
  if(np > 0){ tips.push('В ближайшие 3 дня списания на '+fmt(np)+'. Держи эту сумму в резерве.'); }
  var daily = calcDailyLimit();
  var spent = 0; var tk = iso(now); var all = allSpends();
  for(var j=0;j<all.length;j++){ if(iso(all[j].d) === tk){ spent += all[j].s; } }
  if(spent > daily.perDay){ tips.push('Сегодня потрачено '+fmt(spent)+' при лимите '+fmt(daily.perDay)+' - день в перерасходе. Вечер без трат.'); }
  var sn = 0, ss = 0;
  for(var s=0;s<D.subs.length;s++){ if(!D.subs[s].off){ ss += D.subs[s].s; sn++; } }
  if(sn){ tips.push(sn+' активных подписок = '+fmt(ss)+' в месяц. Месячная ревизия освобождает до трети суммы.'); }
  if(!tips.length){ tips.push('Перерасхода нет, лимиты в порядке. Отличная неделя - так держать!'); }
  return tips;
}

function rememberRule(name, cat){
  var nm = String(name||'').toLowerCase().trim();
  if(!nm || nm.length < 3 || !cat || cat === 'other'){ return; }
  D.merchRules = D.merchRules || {};
  D.merchRules[merchName(nm).toLowerCase()] = cat;
}

function merchName(n){
  var s = (n||'').toLowerCase();
  if(s.indexOf('пятероч')!==-1 || s.indexOf('pyateroch')!==-1){ return 'Пятерочка'; }
  if(s.indexOf('перекрест')!==-1 || s.indexOf('perekrest')!==-1){ return 'Перекресток'; }
  if(s.indexOf('малинк')!==-1 || s.indexOf('malinka')!==-1){ return 'Малинка'; }
  if(s.indexOf('scooters')!==-1){ return 'Яндекс Самокаты'; }
  if(s.indexOf('tutu')!==-1 || s.indexOf('туту')!==-1){ return 'TUTU'; }
  if(s.indexOf('пышку')!==-1 || s.indexOf('pyshku')!==-1){ return 'Хочу пышку'; }
  if(s.indexOf('вкусно')!==-1){ return 'Вкусно и точка'; }
  if(s.indexOf('тройк')!==-1 || s.indexOf('troika')!==-1){ return 'Тройка'; }
  if(s.indexOf('whoosh')!==-1){ return 'WHOOSH'; }
  if(s.indexOf('4121 go')!==-1){ return 'Яндекс Такси'; }
  if(s.indexOf('yota')!==-1){ return 'Yota'; }
  if(s.indexOf('telegram')!==-1){ return 'Telegram'; }
  if(s.indexOf('mayachok')!==-1){ return 'Маячок'; }
  return n;
}
function saveTxEdit(){
  var f = window._txef; if(!f){ return; }
  var amt = parseFloat($('teAmt').value);
  if(isNaN(amt) || amt <= 0){ dAlert('Введите сумму.', 'Операция'); return; }
  var cat = $('teCat').value, dtv = $('teDate').value, note = $('teNote').value.trim();
  var savedItem = null;
  if(f.src === 'sp'){
    for(var i6=0;i6<D.spends.length;i6++){ if(String(D.spends[i6].id) === String(f.i)){ savedItem = D.spends[i6]; break; } }
    if(savedItem){ savedItem.s = amt; savedItem.cat = cat; if(dtv){ savedItem.d = dtv; } if(note){ savedItem.n = note; } }
  } else {
    var t6 = D.tx[+f.i];
    if(t6){ savedItem = t6; t6.s = -amt; t6.c = cat; if(dtv){ t6.d = dtv; } if(note){ t6.n = note; } }
  }
  if(savedItem){ rememberRule(savedItem.n, cat); }
  save(); closeSheet(); render();
  toast(savedItem && cat !== 'other' ? 'Сохранено · '+merchName(String(savedItem.n).toLowerCase())+' → '+catById(cat).n : 'Операция обновлена');
}
function getTxItem(src, i){
  if(src === 'sp'){
    for(var k=0;k<D.spends.length;k++){ if(String(D.spends[k].id) === String(i)){ return {d:D.spends[k].d, n:D.spends[k].n, s:D.spends[k].s, cat:D.spends[k].cat||'other'}; } }
  } else {
    var t = D.tx[+i];
    if(t){ return {d:t.d, n:t.n, s:-t.s, cat:TX2CAT[t.c]||t.c||'other'}; }
  }
  return null;
}
function openTxEdit(src, i){
  var cur = getTxItem(src, i);
  if(!cur){ return; }
  window._txef = {src:src, i:i};
  var sugg = '';
  if(cur.cat === 'other'){
    var mg2 = merchName(cur.n);
    var votes = {};
    var all2 = allSpends();
    for(var v=0;v<all2.length;v++){
      if((all2[v].cat||'other') !== 'other' && merchName(all2[v].n) === mg2){ votes[all2[v].cat] = (votes[all2[v].cat]||0)+1; }
    }
    var best = '', bv = 0;
    for(var b3 in votes){ if(votes[b3] > bv){ bv = votes[b3]; best = b3; } }
    if(!best){ best = autoCat(cur.n); }
    if(best && best !== 'other'){ sugg = best; }
  }
  var opts = '';
  for(var j=0;j<CATS.length;j++){ opts += '<option value="'+CATS[j].id+'"'+(CATS[j].id===cur.cat?' selected':'')+'>'+CATS[j].n+'</option>'; }
  $('sheetBody').innerHTML = sheetHead('i-pen','c-blu','Операция','сумма, категория, дата и комментарий')
    + '<div class="form"><input class="inp" id="teAmt" type="number" value="'+cur.s+'">'
    + '<select class="inp" id="teCat">'+opts+'</select>'
    + '<input class="inp" id="teDate" type="date" value="'+cur.d+'">'
    + '<input class="inp" id="teNote" value="'+String(cur.n||'').replace(/"/g,'&quot;')+'"></div>'
    + (sugg ? '<button class="sh-btn ghost" data-act="tx-apply-suggest" data-c="'+sugg+'">Похожие операции обычно в категории "'+catById(sugg).n+'" - применить</button>' : '')
    + '<button class="sh-btn" data-act="tx-edit-save">Сохранить</button>'
    + '<button class="sh-btn ghost" data-act="tx-split">Разделить на 2 категории</button>'
    + '<button class="sh-btn danger" data-act="tx-del">Удалить операцию</button>';
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}
function openMerchSheet(idx){
  var m = (window._merchList||[])[idx];
  if(!m){ return; }
  var r = histRange2();
  var list = allSpends().filter(function(x){ return x.d >= r.from && x.d < r.to && merchName(x.n) === m.n; }).sort(function(a,b){ return b.d - a.d; });
  var h = sheetHead('i-cart','c-blu', m.n, list.length+' чеков на '+fmt(m.s));
  for(var i=0;i<list.length;i++){
    h += '<div class="dig-item"><span>'+list[i].d.getDate()+'.'+String(list[i].d.getMonth()+1).padStart(2,'0')+' - '+list[i].n+'</span><b>-'+fmt(list[i].s)+'</b></div>';
  }
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}
function openOtherBulk(){
  var r = histRange2();
  var list = allSpends().filter(function(x){ return x.d >= r.from && x.d < r.to && (x.cat||'other')==='other'; }).sort(function(a,b){ return b.d - a.d; });
  window._otherList = list;
  var h = sheetHead('i-grid','c-org','Разбор Прочего', list.length+' операций - тапни категорию');
  if(!list.length){ h += '<div class="dig-item"><span>Всё разобрано!</span><b>-</b></div>'; }
  var cats = ['grocery','cafe','transport','personal','fun','subs'];
  for(var i=0;i<list.length;i++){
          h += '<div class="bulk-row"><div class="b-info"><b>'+list[i].d.getDate()+'.'+String(list[i].d.getMonth()+1).padStart(2,'0')+'</b> - '+esc(list[i].n)+' - '+fmt(list[i].s)+'</div>';
    for(var j=0;j<cats.length;j++){
      h += '<button class="chip" data-act="bulk-set" data-i="'+i+'" data-c="'+cats[j]+'">'+catById(cats[j]).n+'</button>';
    }
    h += '<button class="mini-btn" data-act="tx-edit" data-src="'+(list[i].src||'sp')+'" data-i="'+(list[i].sid!=null?list[i].sid:'')+'"><svg class="ic"><use href="#i-pen"/></svg></button></div>';
  }
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}

function openWhatIf(){
  var f = forecastCashFlow(90);
  var minB = minBalance(90);
  var cats = {};
  var allSp = allSpends();
  var mNow = new Date(); mNow = new Date(mNow.getFullYear(), mNow.getMonth(), 1);
  for(var i=0;i<allSp.length;i++){
    if(allSp[i].d < mNow){ continue; }
    var c = allSp[i].cat || 'other';
    cats[c] = (cats[c]||0) + allSp[i].s;
  }
  var arr = []; for(var k in cats){ arr.push({id:k, s:cats[k]}); }
  arr.sort(function(a,b){ return b.s - a.s; });
  var h = sheetHead('i-cal','c-org','Что если…','симулятор будущего баланса')
    + '<div class="sh-tip" style="margin-bottom:10px">Сейчас минимум за 90 дней: <b>'+fmt(minB.val)+'</b></div>'
    + '<div class="cap" style="margin:10px 4px 6px">Урезать категорию</div>'
    + '<select class="inp" id="wiCat">';
  for(var i=0;i<arr.length;i++){
    h += '<option value="'+arr[i].id+'" data-s="'+arr[i].s+'">'+catById(arr[i].id).n+' ('+fmt(arr[i].s)+' за месяц)</option>';
  }
  h += '</select>'
    + '<div class="form"><label style="font-size:11px;color:var(--mut)">На сколько % урезать: <b id="wiPctVal">30</b>%</label>'
    + '<input type="range" id="wiPct" min="10" max="100" step="10" value="30" style="width:100%"></div>'
    + '<button class="sh-btn" data-act="wi-calc">Посмотреть эффект</button>'
    + '<div class="cap" style="margin:14px 4px 6px">Или: взять ещё долг</div>'
    + '<div class="form"><input class="inp" id="wiDebt" type="number" placeholder="Сумма кредита, ₽">'
    + '<input class="inp" id="wiDebtPay" type="number" placeholder="Ежемесячный платёж, ₽"></div>'
    + '<button class="sh-btn ghost" data-act="wi-calc-debt">Посмотреть эффект</button>'
    + '<div id="wiResult"></div>';
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on'); $('shb').classList.add('on');
  var sl = $('wiPct'); var lb = $('wiPctVal');
  if(sl && lb){ sl.addEventListener('input', function(){ lb.textContent = sl.value; }); }
}
function openDebtPlan(){
  var plan = debtSnowball();
  var debts = [];
  for(var i=0;i<D.credits.length;i++){ if((D.credits[i].cur||0)>0){ debts.push(D.credits[i]); } }
  if(!debts.length){
    $('sheetBody').innerHTML = sheetHead('i-card','c-grn','Долги','у тебя их нет — отлично!')
      + '<div class="sh-tip">Кредитов и рассрочек с долгом нет. Продолжай так!</div>';
    $('sheet').classList.add('on'); $('shb').classList.add('on');
    return;
  }
  debts.sort(function(a,b){ return a.cur - b.cur; });
  var h = sheetHead('i-card','c-red','План выхода из долгов','метод снежного кома')
    + (plan ? '<div class="sh-tip">'+plan.txt+'</div>' : '')
    + '<div class="cap" style="margin:10px 4px 6px">Порядок погашения</div>';
  for(var i=0;i<debts.length;i++){
    h += '<div class="dig-item"><span>'+(i+1)+'. '+debts[i].n+'</span><b>'+fmt(debts[i].cur)+'</b></div>';
  }
  if(plan && plan.monthlyExtra > 0){
    h += '<div class="cap" style="margin:14px 4px 6px">Твои цифры</div>'
      + rowHtml('Всего долгов', fmt(plan.total))
      + rowHtml('Свободно в месяц', fmt(plan.monthlyExtra))
            + rowHtml('Закроешь всё за', plan.months+' мес');
  }
  h += '<div class="cap" style="margin:14px 4px 6px">Минимум на жизнь</div>'
    + '<div class="dig-item"><span>Оставляю себе в месяц</span><span class="row-actions"><b>'+fmt(typeof D.lifeMin === 'number' ? D.lifeMin : 50000)+'</b>'
    + '<button class="mini-btn" data-act="life-min"><svg class="ic"><use href="#i-pen"/></svg></button></span></div>';
  h += tipHtml('Сначала гаси самый маленький долг полностью — это даёт психологическую победу и мотивацию на следующий.');
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}

function openStmtSheet(){
  $('sheetBody').innerHTML = sheetHead('i-import','c-blu','Вставить выписку','текст из Альфы или Т-Банка')
    + '<div class="form"><textarea class="inp" id="stmtTxt" style="min-height:160px" placeholder="Вставь текст выписки сюда..."></textarea></div>'
    + '<button class="sh-btn" data-act="stmt-parse">Распознать</button>';
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}
function parseStatement(txt){
  var out = [];
 var t = txt.replace(/\r/g,'').replace(/\n/g,' ');
  var m;
  var re1 = /CRD_[A-Z0-9]+ Операция по карте: \d+\++\d+, на сумму: ([\d.]+) RUR, дата совершения операции: (\d{2})\.(\d{2})\.(\d{2}), место совершения операции: (.+?) MCC\d+/g;
  while((m = re1.exec(t)) !== null){
    var nm = m[5].split('\\').pop().trim();
    out.push({d:'20'+m[4]+'-'+m[3]+'-'+m[2], n:nm, s:Math.round(parseFloat(m[1])), c:autoCat(nm)});
  }
  var re2 = /(\d{2})\.(\d{2})\.(\d{4}) \d{2}:\d{2} \d{2}\.\d{2}\.\d{4} \d{2}:\d{2} -([\d\s]+,\d{2}) ₽ -[\d\s]+,\d{2} ₽ (.+?)(?: \d{4}| —|$)/g;
  while((m = re2.exec(t)) !== null){
    var n2 = m[5].trim();
    if(n2.indexOf('Внутренний')===-1 && n2.indexOf('Перевод')===-1 && n2.indexOf('Внешний')===-1 && n2.indexOf('Плата')===-1 && n2.indexOf('Комиссия')===-1){
      out.push({d:m[3]+'-'+m[2]+'-'+m[1], n:n2, s:Math.round(parseFloat(m[4].replace(/\s/g,'').replace(',','.'))), c:autoCat(n2)});
    }
  }
  return out;
}

// Кандидаты в регулярные платежи: одинаковые название+сумма 2+ раза за 180 дней
function recCandidates(){
  var map = {};
  var cutoff = new Date(Date.now() - 180*864e5);
  var all = allSpends();
  for(var i=0;i<all.length;i++){
    var x = all[i];
    if(x.d < cutoff){ continue; }
    var k = (x.n||'').toLowerCase()+'|'+Math.round(x.s);
    if(!map[k]){ map[k] = {n:x.n, s:x.s, dates:[]}; }
    map[k].dates.push(x.d);
  }
  var out = [];
  for(var kk in map){
    var g = map[kk];
    if(g.dates.length < 2){ continue; }
    g.dates.sort(function(a,b){ return a - b; });
    var spanDays = Math.round((g.dates[g.dates.length-1] - g.dates[0]) / 864e5);
    if(spanDays < 35){ continue; }
    // уже есть в платежах/подписках?
    var exists = false;
    for(var p=0;p<D.pays.length;p++){ if((D.pays[p].n||'').toLowerCase() === g.n.toLowerCase()){ exists = true; break; } }
    for(var s2=0;s2<D.subs.length && !exists;s2++){ if((D.subs[s2].n||'').toLowerCase() === g.n.toLowerCase()){ exists = true; break; } }
    if(exists){ continue; }
    var hk = g.n.toLowerCase()+'|'+Math.round(g.s);
    if((D.recurHide||[]).indexOf(hk) !== -1){ continue; }
    out.push({n:g.n, s:g.s, cnt:g.dates.length, last:g.dates[g.dates.length-1]});
  }
  out.sort(function(a,b){ return b.cnt - a.cnt; });
  return out;
}
function openRecrSheet(){
  var list = recCandidates();
  window._recrList = list.slice(0,6);
  var h = sheetHead('i-cal','c-blu','Регулярные платежи','найдено по повторам в истории');
  if(!window._recrList.length){
    h += '<div class="dig-item"><span>Новых повторов не найдено</span><b>—</b></div>'
      + '<div class="sh-tip">Импортируйте выписку за пару месяцев — здесь появятся регулярные списания, которые стоит внести в бюджет.</div>';
  }
  for(var i=0;i<window._recrList.length;i++){
    var r = window._recrList[i];
    h += '<div class="dig-item" style="flex-wrap:wrap"><span style="flex:1;min-width:140px">'+esc(r.n)+' · '+fmt(r.s)+'<br><span style="font-size:10.5px">'+r.cnt+' раза · последний '+r.last.getDate()+'.'+String(r.last.getMonth()+1).padStart(2,'0')+'</span></span>'
      + '<span class="row-actions">'
      + '<button class="chip" data-act="recr-add-pay" data-i="'+i+'">В платежи</button>'
      + '<button class="mini-btn" data-act="recr-add-sub" data-i="'+i+'" title="В подписки"><svg class="ic"><use href="#i-sub"/></svg></button>'
      + '<button class="mini-btn danger" data-act="recr-hide" data-i="'+i+'" title="Скрыть"><svg class="ic"><use href="#i-x"/></svg></button>'
      + '</span></div>';
  }
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}

function openDupSheet(){
  var map = {};
  var all = allSpends();
  for(var i=0;i<all.length;i++){
    var t = all[i];
    if(t.inc){ continue; }
    var k = iso(t.d)+'|'+Math.round(t.s)+'|'+(t.n||'').toLowerCase();
    if(!map[k]){ map[k] = []; }
    map[k].push(t);
  }
  var dups = [];
  for(var k2 in map){ if(map[k2].length > 1){ dups.push(map[k2]); } }
  window._dupGroups = dups;
  var h = sheetHead('i-alert','c-org','Дубликаты', dups.length+' подозрительных групп');
  if(!dups.length){ h += '<div class="dig-item"><span>Дубликатов не найдено</span><b>-</b></div>'; }
  for(var g=0;g<dups.length;g++){
    for(var m=0;m<dups[g].length;m++){
      var it = dups[g][m];
      h += '<div class="dig-item"><span>'+it.d.getDate()+'.'+String(it.d.getMonth()+1).padStart(2,'0')+' · '+it.n+' · '+fmt(it.s)+(m>0?' <b style="color:var(--red)">дубль?</b>':'')+'</span><span class="row-actions"><button class="mini-btn danger" data-act="dup-del" data-g="'+g+'" data-i="'+m+'"><svg class="ic"><use href="#i-trash"/></svg></button></span></div>';
    }
  }
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}
function openCycCompareSheet(){
  var now = new Date();
  var cs1 = shiftCycle(cycleStart(now), cycOff2);
  var ce1 = cycleEnd(cs1);
  var cs0 = shiftCycle(cycleStart(now), cycOff2 - 1);
  var ce0 = cycleEnd(cs0);
  function aggR(from, to){
    var m = {}; var t = 0;
    var l = allSpends().filter(function(x){ return x.d >= from && x.d < to; });
    for(var i=0;i<l.length;i++){ var k = l[i].cat||'other'; m[k]=(m[k]||0)+l[i].s; t+=l[i].s; }
    return {m:m, t:t};
  }
  var a1 = aggR(cs1, ce1), a0 = aggR(cs0, ce0);
  var keys = {};
  for(var k in a1.m){ keys[k]=1; } for(k in a0.m){ keys[k]=1; }
  var rows = [];
  for(k in keys){ rows.push({id:k, c:a1.m[k]||0, p:a0.m[k]||0}); }
  rows.sort(function(x,y){ return Math.abs(y.c-y.p) - Math.abs(x.c-x.p); });
  var diff = a1.t - a0.t;
  var h = sheetHead('i-chev','c-blu','Сравнение циклов', cycLabel(cs0)+' → '+cycLabel(cs1))
    + rowHtml(cycLabel(cs0), fmt(a0.t))
    + rowHtml(cycLabel(cs1), fmt(a1.t))
    + '<div class="sh-row"><span>Итог</span><b style="color:'+(diff>0?'var(--red)':'var(--grn)')+'">'+(diff>0?'+':'-')+fmt(Math.abs(diff))+'</b></div>'
    + '<div class="cap" style="margin:10px 4px 6px">По категориям</div>';
  for(var i2=0;i2<rows.length;i2++){
    var d2 = rows[i2].c - rows[i2].p;
    h += '<div class="dig-item"><span>'+catById(rows[i2].id).n+'</span><b>'+fmt(rows[i2].p)+' → '+fmt(rows[i2].c)+' <span style="color:'+(d2>0?'var(--red)':(d2<0?'var(--grn)':'var(--mut)'))+'">'+(d2>0?'+':(d2<0?'-':''))+fmt(Math.abs(d2))+'</span></b></div>';
  }
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}
function openRoundSheet(){
  var act = (D.goals||[]).filter(function(g){ return !g.done; });
  if(!act.length){ dAlert('Нет активных целей.', 'Копилка'); return; }
  var opts = '';
  for(var i=0;i<act.length;i++){ opts += '<option value="'+act[i].id+'">'+act[i].n+'</option>'; }
  $('sheetBody').innerHTML = sheetHead('i-target','c-grn','Сдача в копилку','округление каждой траты до 10 ₽')
    + rowHtml('Накоплено за период', fmt(window._roundAmt||0))
    + '<div class="form"><select class="inp" id="rdGoal">'+opts+'</select></div>'
    + '<button class="sh-btn" data-act="round-save">Закинуть</button>';
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}
function openSplitSheet(src, i){
  var cur = getTxItem(src, i);
  if(!cur){ return; }
  window._txef = {src:src, i:i};
  var opts1 = '', opts2 = '';
  for(var j=0;j<CATS.length;j++){
    opts1 += '<option value="'+CATS[j].id+'"'+(CATS[j].id===cur.cat?' selected':'')+'>'+CATS[j].n+'</option>';
    opts2 += '<option value="'+CATS[j].id+'"'+(CATS[j].id===cur.cat?' selected':'')+'>'+CATS[j].n+'</option>';
  }
  var half = Math.round(cur.s/2);
  $('sheetBody').innerHTML = sheetHead('i-pen','c-blu','Разделить операцию', cur.n+' · всего '+fmt(cur.s))
    + '<div class="form">'
    + '<div class="row2"><input class="inp" id="spAmt1" type="number" value="'+half+'"><input class="inp" id="spAmt2" type="number" value="'+(cur.s-half)+'"></div>'
    + '<div class="row2"><select class="inp" id="spCat1">'+opts1+'</select><select class="inp" id="spCat2">'+opts2+'</select></div>'
    + '</div>'
    + '<button class="sh-btn" data-act="tx-split-save">Разделить</button>';
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}

function leaksForRange(from, to){
  var list = allSpends().filter(function(x){ return x.d >= from && x.d < to; });
  var out = [];
  for(var i=0;i<D.envs.length;i++){
    var e = D.envs[i];
    if(e.lim <= 0){ continue; }
    var f = 0, cnt = 0;
    for(var a=0;a<list.length;a++){ if(envMatch(e, list[a])){ f += list[a].s; cnt++; } }
    if(f > e.lim){ out.push({id:e.id, n:e.n, s:f, lim:e.lim, over:f-e.lim, tx:cnt, ic:e.ic, k:e.k}); }
  }
  out.sort(function(a,b){ return b.over - a.over; });
  return out;
}

function openMonthReport(){
    var now = new Date();
  var from, to, pf;
  if (D.cycleMode === 'salary') {
    // Отчёт за прошедший зарплатный цикл
    var cs0 = cycleStart(now);
    from = shiftCycle(cs0, -1);
    to = cycleEnd(from);
    pf = shiftCycle(from, -1);
  } else {
    // Календарный режим – предыдущий месяц
    var y0 = now.getMonth() === 0 ? now.getFullYear()-1 : now.getFullYear();
    var m0 = now.getMonth() === 0 ? 11 : now.getMonth()-1;
    from = new Date(y0, m0, 1);
    to = new Date(y0, m0+1, 1);
    pf = new Date(y0, m0-1, 1);
  }
  var y = from.getFullYear(), m = from.getMonth();
  var sp = allSpends().filter(function(x){ return x.d >= from && x.d < to; });
  var psp = allSpends().filter(function(x){ return x.d >= pf && x.d < from; });
  var tot = 0, ptot = 0, i;
  for(i=0;i<sp.length;i++){ tot += sp[i].s; }
  for(i=0;i<psp.length;i++){ ptot += psp[i].s; }
  var inc = 0;
  for(i=0;i<(D.incomes||[]).length;i++){ var d = parseD(D.incomes[i].d); if(d >= from && d < to){ inc += D.incomes[i].s; } }
  var saved = inc - tot;
  var rate = inc > 0 ? Math.round(saved/inc*100) : 0;
  var cm = {}, pm = {};
  for(i=0;i<sp.length;i++){ var k = sp[i].cat||'other'; cm[k]=(cm[k]||0)+sp[i].s; }
  for(i=0;i<psp.length;i++){ var k2 = psp[i].cat||'other'; pm[k2]=(pm[k2]||0)+psp[i].s; }
  var arr = []; for(var k3 in cm){ arr.push({id:k3, s:cm[k3]}); }
  arr.sort(function(a,b){ return b.s-a.s; });
  var maxOp = null;
  for(i=0;i<sp.length;i++){ if(!maxOp || sp[i].s > maxOp.s){ maxOp = sp[i]; } }
  var leaks = leaksForRange(from, to);
  var leakSum = 0; for(i=0;i<leaks.length;i++){ leakSum += leaks[i].over; }
  var delta = tot - ptot;
  var h = sheetHead('i-grid','c-blu','Отчёт · '+MONTHS[m]+' '+y, sp.length+' операций')
    + rowHtml('Потрачено', fmt(tot)+' ('+(delta>0?'+':'−')+fmt(Math.abs(delta))+' к '+MONTHS_S[pf.getMonth()]+')')
    + rowHtml('Поступило', '+'+fmt(inc))
    + rowHtml('Сэкономлено', (saved>=0?'+':'−')+fmt(Math.abs(saved)))
    + rowHtml('Норма сбережений', rate+'%')
    + '<div class="cap" style="margin:10px 4px 6px">Топ-3 категории</div>';
  for(i=0;i<arr.length && i<3;i++){
    var pd = pm[arr[i].id] || 0;
    var dd = arr[i].s - pd;
    h += '<div class="dig-item"><span>'+catById(arr[i].id).n+'</span><b>'+fmt(arr[i].s)+' <span style="color:'+(dd>0?'var(--red)':'var(--grn)')+'">'+(dd>0?'+':'−')+fmt(Math.abs(dd))+'</span></b></div>';
  }
  if(maxOp){ h += rowHtml('Крупнейшая трата', esc(maxOp.n)+' · '+fmt(maxOp.s)); }
  h += rowHtml('Утечки', leaks.length ? leaks.length+' шт. на '+fmt(leakSum) : 'нет');
  // Текст для отправки/копирования
  var rl = [];
  rl.push('Отчёт МАЯК · '+cycleLabel(from));
  rl.push('Потрачено: '+fmt(tot)+(delta ? ((delta>0?' (+':' (−')+fmt(Math.abs(delta))+')') : ''));
  rl.push('Поступило: +'+fmt(inc));
  rl.push((saved>=0?'Сэкономлено: +':'Перерасход: −')+fmt(Math.abs(saved))+' · норма '+rate+'%');
  if(arr.length){
    rl.push('Топ категории:');
    for(i=0;i<arr.length && i<3;i++){
      var pdR = pm[arr[i].id] || 0;
      var ddR = arr[i].s - pdR;
      rl.push('  '+catById(arr[i].id).n+': '+fmt(arr[i].s)+(ddR>0?' (+'+(ddR<1000&&ddR>-1000?Math.round(ddR/Math.max(1,pdR)*100)+'%':fmt(ddR))+')':''));
    }
  }
  if(maxOp){ rl.push('Крупнейшая: '+maxOp.n+' — '+fmt(maxOp.s)); }
  rl.push('Утечки: '+(leaks.length ? leaks.length+' шт., перерасход '+fmt(leakSum) : 'нет'));
  window._reportText = rl.join('\n');
  h += '<div class="dlg-btns" style="margin-top:14px">'
    + '<button class="sh-btn ghost" style="margin:0;flex:1" data-act="report-copy">Скопировать</button>'
    + '<button class="sh-btn" style="margin:0;flex:1" data-act="report-share">Поделиться</button>'
    + '</div>'
    + '<button class="sh-btn ghost" data-act="year-report">Год одним экраном</button>'
    + tipHtml(saved >= 0 ? 'Месяц закрыт в плюс — переведи остаток в цели кнопкой «В копилку».' : 'Месяц закрыт в минус — посмотри гибкие траты в аналитике и урежь их.');
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}
// Год одним экраном: 12 последних циклов/месяцев лентой
function openYearReport(){
  var now = new Date();
  var rows = [];
  var totS = 0, totI = 0, firstFrom = null, lastTo = null;
  for(var i=12;i>=1;i--){
    var from, to, label;
    if(D.cycleMode === 'calendar'){
      var f0 = new Date(now.getFullYear(), now.getMonth()-i, 1);
      from = f0; to = new Date(f0.getFullYear(), f0.getMonth()+1, 1);
      label = MONTHS_S[from.getMonth()] + ' ' + String(from.getFullYear()).slice(2);
    } else {
      from = shiftCycle(cycleStart(now), -i);
      to = cycleEnd(from);
      var toIn = new Date(to.getTime() - 864e5);
      label = from.getDate()+'.'+String(from.getMonth()+1).padStart(2,'0')+'–'+toIn.getDate()+'.'+String(toIn.getMonth()+1).padStart(2,'0');
    }
    var spL = allSpends().filter(function(x){ return x.d >= from && x.d < to; });
    var s = 0, j;
    for(j=0;j<spL.length;j++){ s += spL[j].s; }
    var inc = 0;
    for(j=0;j<(D.incomes||[]).length;j++){ var dd = parseD(D.incomes[j].d); if(dd >= from && dd < to){ inc += D.incomes[j].s; } }
    totS += s; totI += inc;
    if(!firstFrom){ firstFrom = from; }
    lastTo = to;
    rows.push({label:label, s:s, i:inc, v:inc - s});
  }
  // топ-категории года
  var catY = {};
  var yrAll = allSpends().filter(function(x){ return x.d >= firstFrom && x.d < lastTo; });
  for(var y2=0;y2<yrAll.length;y2++){
    var ck2 = yrAll[y2].cat || 'other';
    catY[ck2] = (catY[ck2]||0) + yrAll[y2].s;
  }
  var yArr = [];
  for(var cy in catY){ yArr.push({id:cy, s:catY[cy]}); }
  yArr.sort(function(a,b){ return b.s - a.s; });
  var mxR = 1;
  for(var r2=0;r2<rows.length;r2++){ if(rows[r2].s > mxR){ mxR = rows[r2].s; } }
  // лучший и худший период по сбережениям
  var best = null, worst = null;
  for(r2=0;r2<rows.length;r2++){
    if(rows[r2].i <= 0){ continue; }
    if(!best || rows[r2].v > best.v){ best = rows[r2]; }
    if(!worst || rows[r2].v < worst.v){ worst = rows[r2]; }
  }
  // тренд: первые 4 против последних 4
  var head4 = 0, tail4 = 0;
  for(i=0;i<rows.length;i++){
    if(i < 4){ head4 += rows[i].s; }
    if(i >= rows.length-4){ tail4 += rows[i].s; }
  }
  head4 /= Math.min(4, rows.length); tail4 /= Math.min(4, rows.length);
  var trendPct = head4 > 0 ? Math.round((tail4-head4)/head4*100) : 0;
  var rate = totI > 0 ? Math.round((totI-totS)/totI*100) : 0;
  var rl = ['Отчёт МАЯК · год одним экраном'];
  for(var ri=0;ri<rows.length;ri++){
    rl.push(rows[ri].label+': −'+fmt(rows[ri].s)+(rows[ri].v>=0?' · в плюс +':' · в минус −')+fmt(Math.abs(rows[ri].v)));
  }
  rl.push('За год: доход '+fmt(totI)+', расход '+fmt(totS)+', норма '+rate+'%');
  if(best){ rl.push('Лучший период: '+best.label+' (+'+fmt(best.v)+')'); }
  if(worst){ rl.push('Худший: '+worst.label+' (−'+fmt(Math.abs(worst.v))+')'); }
  rl.push('Тренд: последние 4 периода '+(trendPct>=0?'дороже':'дешевле')+' первых на '+Math.abs(trendPct)+'%');
  window._reportText = rl.join('\n');
  var h = sheetHead('i-grid','c-pur','Год одним экраном','12 циклов · доход '+fmt(totI)+' · расход '+fmt(totS));
  for(r2=0;r2<rows.length;r2++){
    var rr = rows[r2];
    var colR = rr.v >= 0 ? 'var(--grn)' : 'var(--red)';
    h += '<div style="margin:7px 0"><div style="display:flex;justify-content:space-between;font-size:12px"><span>'+rr.label+'</span><span><b>−'+fmt(rr.s)+'</b> <b style="color:'+colR+'">'+(rr.v>=0?'+':'−')+fmt(Math.abs(rr.v))+'</b></span></div>'
      + '<div class="bar-large" style="height:5px;margin-top:3px"><i style="width:'+Math.round(rr.s/mxR*100)+'%;background:'+(rr.v>=0?'rgba(48,209,88,.55)':'rgba(255,69,58,.55)')+'"></i></div></div>';
  }
  h += '<div class="sh-row"><span>Норма сбережений за год</span><b style="color:'+(rate>=10?'var(--grn)':(rate>=0?'var(--org)':'var(--red)'))+'">'+rate+'%</b></div>';
  if(best){ h += rowHtml('Лучший период', best.label+' · +'+fmt(best.v)); }
  if(worst){ h += rowHtml('Худший период', worst.label+' · −'+fmt(Math.abs(worst.v))); }
  h += '<div class="cap" style="margin:14px 4px 6px">Куда ушёл год</div>';
  for(i=0;i<yArr.length && i<5;i++){
    h += gRowLocal(catById(yArr[i].id).n, yArr[i].s, totS);
  }
  var trendTxt = trendPct > 5 ? 'Тратишь на '+trendPct+'% больше, чем в начале года. Посмотри топ-категории — там и рост.' : (trendPct < -5 ? 'Тратишь на '+Math.abs(trendPct)+'% меньше, чем в начале года. Год закрыт лучше, чем открыт.' : 'Темп трат стабильный весь год.');
  h += tipHtml(trendTxt)
    + '<div class="dlg-btns" style="margin-top:12px">'
    + '<button class="sh-btn ghost" style="margin:0;flex:1" data-act="report-copy">Скопировать</button>'
    + '<button class="sh-btn" style="margin:0;flex:1" data-act="report-share">Поделиться</button>'
    + '</div>';
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}
function gRowLocal(name, val, tot){
  var p2 = tot > 0 ? Math.round(val/tot*100) : 0;
  return '<div class="g-row"><div class="g-head"><span>'+esc(name)+'</span><b>'+fmt(val)+' · '+p2+'%</b></div>'
    + '<div class="bar-large" style="height:6px"><i style="width:'+Math.min(100,p2)+'%;background:var(--pur)"></i></div></div>';
}
function fallbackCopy(t){
  var ta = document.createElement('textarea');
  ta.value = t;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try{ document.execCommand('copy'); toast('Скопировано'); }catch(e){ dAlert('Не удалось скопировать автоматически.', 'Копирование'); }
  document.body.removeChild(ta);
}
function openCanBuy(){
  var ws = (D.wishes||[]).filter(function(w){ return w.st === 'wait'; }).sort(function(a,b){ return a.d < b.d ? -1 : 1; });
  var nowT = Date.now();
  var h = sheetHead('i-card','c-grn','Могу купить?','честная проверка по твоим цифрам')
    + '<div class="form"><input class="inp" id="cbName" placeholder="Что хотим? (необязательно)"><input class="inp" id="cbPrice" type="number" placeholder="Цена, ₽"></div>'
    + '<div class="dlg-btns" style="margin-top:12px">'
    + '<button class="sh-btn ghost" style="margin:0;flex:1" data-act="canbuy-go">Проверить сейчас</button>'
    + '<button class="sh-btn" style="margin:0;flex:1;background:rgba(191,90,242,.2);color:var(--pur)" data-act="wish-add">Записать на 24 ч</button>'
    + '</div>'
    + '<div id="cbVerdict"></div>';
  if(ws.length){
    h += '<div class="cap" style="margin:16px 4px 6px">Список желаний · правило 24 часов</div>';
    for(var j=0;j<ws.length;j++){
      var w = ws[j];
      var hrs = Math.ceil(24 - (nowT - new Date(w.d).getTime())/36e5);
      var ripe = hrs <= 0;
      h += '<div class="dig-item" style="flex-wrap:wrap"><span style="flex:1;min-width:120px">'+esc(w.n)+' · '+fmt(w.amt)
        + (ripe ? ' <b style="color:var(--grn)">· время вышло</b>' : ' <span style="font-size:11px">· ждать ещё '+hrs+' ч</span>') + '</span>'
        + '<span class="row-actions">'
        + (ripe ? '<button class="mini-btn" data-act="wish-buy" data-i="'+w.id+'" title="Решил купить"><svg class="ic"><use href="#i-check"/></svg></button>' : '')
        + '<button class="mini-btn danger" data-act="wish-skip" data-i="'+w.id+'" title="Передумал"><svg class="ic"><use href="#i-x"/></svg></button>'
        + '</span></div>';
    }
    h += '<div class="sh-tip">Желание нельзя купить раньше 24 часов — фильтр от импульсов. Когда время выйдет, появится галочка: открой прогноз, проверь вердикт и решай холодной головой.</div>';
  }
  $('sheetBody').innerHTML = h;
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}

// Редактор конверта: имя + лимит + категории + значок + цвет
function envDraftSyncInputs(){
  if($('enName')){ window._envDraft.name = $('enName').value; }
  if($('enLim')){ window._envDraft.lim = $('enLim').value; }
}
function renderEnvForm(){
  var d = window._envDraft;
  var catChips = '';
  for(var c=0;c<CATS.length;c++){
    catChips += '<button type="button" class="cat-chip'+(d.cats.indexOf(CATS[c].id) !== -1?' on':'')+'" data-act="env-cat" data-c="'+CATS[c].id+'">'+CATS[c].n+'</button>';
  }
  var icBtns = '';
  for(var g=0;g<ENV_ICONS.length;g++){
    icBtns += '<button type="button" class="env-ic-btn'+(d.ic === ENV_ICONS[g]?' on':'')+'" data-act="env-icon" data-c="'+ENV_ICONS[g]+'"><svg class="ic"><use href="#'+ENV_ICONS[g]+'"/></svg></button>';
  }
  var colBtns = '';
  for(var k=0;k<ENV_COLORS.length;k++){
    colBtns += '<button type="button" class="env-col-btn '+(d.k === ENV_COLORS[k][0]?'on ':'')+ENV_COLORS[k][0]+'" data-act="env-col" data-c="'+ENV_COLORS[k][0]+'">'+(d.k === ENV_COLORS[k][0]?'выбран':'&nbsp;')+'</button>';
  }
  $('sheetBody').innerHTML = sheetHead('i-target','c-pur', d._title || 'Конверт', 'категории, значок и цвет — на ваш вкус')
    + '<div class="form">'
    + '<input class="inp" id="enName" placeholder="Название конверта" value="'+esc(d.name||'')+'">'
    + '<input class="inp" id="enLim" type="number" inputmode="decimal" placeholder="Лимит на цикл, ₽" value="'+(d.lim||'')+'">'
    + '<div class="hint">Категории, которые наполняют конверт (можно несколько):</div>'
    + '<div class="chip-grid">'+catChips+'</div>'
    + '<div class="hint">Значок:</div><div class="chip-grid">'+icBtns+'</div>'
    + '<div class="hint">Цвет:</div><div class="chip-grid">'+colBtns+'</div>'
    + '</div>'
    + '<button class="sh-btn" data-act="'+(d._save||'env-add-save')+'">'+(d._saveTxt||'Сохранить')+'</button>'
    + (d._id ? '<button class="sh-btn danger" data-act="form-del">Удалить конверт</button>' : '');
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}
function openEnvAdd(){
  window._envDraft = {name:'', lim:'', cats:['grocery'], ic:'i-cart', k:'c-grn', _save:'env-add-save', _saveTxt:'Создать конверт', _title:'Новый конверт'};
  renderEnvForm();
}

function openQuickSpend(){
  window._qsCatTouched = false;
  var chips = '';
  for(var i=0;i<CATS.length;i++){
    chips += '<button class="cat-chip'+(CATS[i].id==='grocery'?' on':'')+'" data-act="qs-cat" data-c="'+CATS[i].id+'">'+CATS[i].n+'</button>';
  }
  var tags = [['normal','Обычная'],['planned','План'],['impulse','Импульс'],['needed','Нужно']];
  var tchips = '';
  for(var t=0;t<tags.length;t++){ tchips += '<button class="cat-chip sm'+(t===0?' on':'')+'" data-act="qs-tag" data-c="'+tags[t][0]+'">'+tags[t][1]+'</button>'; }
  $('sheetBody').innerHTML = sheetHead('i-out','c-red','Новая трата','сумма, категория — и готово')
    + '<input class="inp" id="qsAmt" type="number" inputmode="decimal" placeholder="Сумма, ₽">'
    + '<div class="cap" style="margin:12px 4px 0">Категория</div><div class="chip-grid">'+chips+'</div>'
    + '<input class="inp" id="qsNote" placeholder="Что это? Необязательно — подставлю категорию сам">'
    + '<div class="cap" style="margin:10px 4px 0">Метка</div><div class="chip-grid">'+tchips+'</div>'
    + '<input type="hidden" id="qsCat" value="grocery"><input type="hidden" id="qsTag" value="normal">'
    + '<div class="row2" style="margin-top:10px"><input class="inp" id="qsDate" type="date" value="'+iso(new Date())+'">'
    + '<label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--mut);padding:0 4px"><input type="checkbox" id="qsXfer"> перевод себе</label></div>'
    + '<div class="dlg-btns" style="margin-top:14px">'
    + '<button class="sh-btn ghost" style="margin:0;flex:1" data-act="qa-spend-save-more">Сохранить и ещё</button>'
    + '<button class="sh-btn" style="margin:0;flex:1" data-act="qa-spend-save">Сохранить</button>'
    + '</div>';
  $('sheet').classList.add('on'); $('shb').classList.add('on');
  setTimeout(function(){ if($('qsAmt')){ $('qsAmt').focus(); } }, 250);
  setTimeout(function(){
    if($('qsNote')){
      $('qsNote').addEventListener('input', function(){
        if(!window._qsCatTouched){
          var ac = autoCat(this.value);
          if(ac && ac !== 'other'){ $('qsCat').value = ac; paintQsCats(); }
        }
      });
    }
  }, 100);
}
function paintQsCats(){
  var cur = $('qsCat') ? $('qsCat').value : '';
  var btns = document.querySelectorAll('.chip-grid .cat-chip');
  for(var i=0;i<btns.length;i++){
    if(btns[i].getAttribute('data-act') === 'qs-cat'){
      btns[i].classList.toggle('on', btns[i].getAttribute('data-c') === cur);
    }
  }
}

// Похоже ли название на платёж по одному из кредитов
var BANK_ALIASES = {
  'тбанк':['тбанк','тинькофф','tinkoff','tbank'],
  'альфа':['альфа','альфабанк','alfa','alpha'],
  'сбер':['сбер','сбербанк','sber'],
  'втб':['втб','vtb'],
  'озон':['озон','ozon']
};
function normKey(s){ return String(s||'').toLowerCase().replace(/[^a-zа-я0-9]/g,''); }
function detectCreditIntent(n){
  var key = normKey(n);
  if(!key || key.length < 3){ return null; }
  for(var i=0;i<(D.credits||[]).length;i++){
    var cr = D.credits[i];
    var nk = normKey(cr.n);
    if(!nk || nk.length < 2){ continue; }
    if(key.indexOf(nk) !== -1 || nk.indexOf(key) !== -1){ return {cr:cr}; }
    var al = BANK_ALIASES[nk] || [];
    for(var a=0;a<al.length;a++){
      if(key.indexOf(al[a]) !== -1){ return {cr:cr}; }
    }
  }
  return null;
}
function applyCreditPay(cr, amt, d){
  cr.cur = Math.max(0, (cr.cur||0) - amt);
  D.spends.push({id:Date.now(), d:d, n:'Платёж: '+cr.n, cat:'other', s:amt, tag:'planned'});
  save(); render(); vib(12);
  toast(cr.cur <= 0 ? 'Кредит «'+cr.n+'» закрыт!' : 'Платёж по «'+cr.n+'»: −'+fmt(amt));
}
function finishPush(o, after){
  D.spends.push({id:Date.now(), d:o.d, n:o.n || catById(o.cat).n, cat:o.cat, s:o.amt, tag:o.tag || 'normal'});
  save(); render(); vib(10); toast('Трата добавлена: −'+fmt(o.amt));
  if(after){ after(); }
}
// Умная запись: сначала проверяем, не платёж ли это по кредиту
function pushSpendSmart(o, after){
  var det = o.n ? detectCreditIntent(o.n) : null;
  if(det){
    dConfirm('«'+o.n+'» похоже на платёж по кредиту «'+det.cr.n+'».\n\nДа — долг уменьшится на '+fmt(o.amt)+' и появится запись платежа. Нет — обычная трата.', 'Это платёж по кредиту?').then(function(ok){
      if(ok){ applyCreditPay(det.cr, o.amt, o.d); if(after){ after(); } return; }
      finishPush(o, after);
    });
    return;
  }
  finishPush(o, after);
}

function saveQuickSpend(again){
  if(document.activeElement && document.activeElement.blur){ document.activeElement.blur(); }
  var qa = parseFloat($('qsAmt').value);
  if(isNaN(qa) || qa <= 0){ dAlert('Введите сумму траты.', 'Трата'); return; }
  var qd = $('qsDate').value || iso(new Date());
  var qn = $('qsNote') ? $('qsNote').value.trim() : '';
  // Внутренний перевод: в историю, но без влияния на баланс и статистику
  if($('qsXfer') && $('qsXfer').checked){
    D.transfers.push({id:Date.now(), d:qd, n: qn || 'Перевод себе', s:qa});
    save(); render();
    toast('Перевод записан · на баланс не влияет');
    if(again){ openQuickSpend(); } else { closeSheet(); }
    return;
  }
  var qc = $('qsCat').value || 'other';
  var tag = $('qsTag') ? $('qsTag').value : 'normal';
  pushSpendSmart({amt:qa, d:qd, n:qn, cat:qc, tag:tag}, function(){
    runSpendAlerts(qa, qc);
    if(again){ openQuickSpend(); } else { closeSheet(); }
  });
}
// Живая проверка после записи: аномальный чек или пробой дневного лимита
function runSpendAlerts(qa, qc){
  var avgQ = 0, cntQ = 0;
  var fromQ = new Date(Date.now() - 60*864e5);
  var aQ = allSpends();
  var todayKey = iso(new Date());
  for(var zq=0;zq<aQ.length;zq++){
    if((aQ[zq].cat||'other') === qc && aQ[zq].d >= fromQ && iso(aQ[zq].d) !== todayKey){ avgQ += aQ[zq].s; cntQ++; }
  }
  avgQ = cntQ ? avgQ/cntQ : 0;
  var msgsQ = [];
  if(avgQ > 0 && qa >= avgQ*3){
    msgsQ.push('Обычный чек по этой категории — '+fmt(Math.round(avgQ))+'. Эта трата в '+Math.round(qa/avgQ)+' раза больше.');
  }
  var dlQ = calcDailyLimit();
  if(dlQ.perDay > 0 && qa > dlQ.perDay){
    msgsQ.push('Сумма выше дневного лимита ('+fmt(dlQ.perDay)+'). Сегодня лучше больше не тратить.');
  }
  if(msgsQ.length){ dAlert(msgsQ.join('\n'), 'Проверка траты'); }
}
function openIncomeSheet(){
  var ko = '';
  for(var ki=0;ki<INCOME_KINDS.length;ki++){ ko += '<option value="'+INCOME_KINDS[ki][0]+'">'+INCOME_KINDS[ki][1]+'</option>'; }
  $('sheetBody').innerHTML = sheetHead('i-in','c-grn','Добавить поступление','сумма попадёт в реальный остаток')
    + '<div class="form"><div class="row2"><input class="inp" id="incAmt" type="number" placeholder="Сумма, ₽"><input class="inp" id="incDate" type="date" value="'+iso(new Date())+'"></div>'
    + '<select class="inp" id="incKind">'+ko+'</select>'
    + '<input class="inp" id="incNote" placeholder="Что это (подработка, кэшбэк...)"></div>'
    + '<button class="sh-btn" data-act="income-save">Сохранить</button>';
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}
function openIncEdit(id){
  var it = null;
  for(var i=0;i<(D.incomes||[]).length;i++){ if(String(D.incomes[i].id) === String(id)){ it = D.incomes[i]; break; } }
  if(!it){ return; }
  window._incEf = id;
  var opts = '';
  var curK = incomeKind(it);
  for(var j=0;j<INCOME_KINDS.length;j++){ opts += '<option value="'+INCOME_KINDS[j][0]+'"'+(INCOME_KINDS[j][0]===curK?' selected':'')+'>'+INCOME_KINDS[j][1]+'</option>'; }
  $('sheetBody').innerHTML = sheetHead('i-pen','c-grn','Поступление','сумма, тип, дата и название')
    + '<div class="form"><input class="inp" id="ieAmt" type="number" value="'+it.s+'">'
    + '<select class="inp" id="ieKind">'+opts+'</select>'
    + '<input class="inp" id="ieDate" type="date" value="'+it.d+'">'
    + '<input class="inp" id="ieNote" value="'+String(it.n||'').replace(/"/g,'&quot;')+'"></div>'
    + '<button class="sh-btn" data-act="i-edit-save">Сохранить</button>'
    + '<button class="sh-btn danger" data-act="i-del">Удалить</button>';
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}
function openIncPeriodSheet(){
  var r = incRange();
  $('sheetBody').innerHTML = sheetHead('i-cal','c-blu','Период доходов','любые даты')
    + '<div class="form"><div class="row2"><input class="inp" type="date" id="ipFrom" value="'+iso(r.from)+'"><input class="inp" type="date" id="ipTo" value="'+iso(new Date(r.to.getTime()-864e5))+'"></div></div>'
    + '<button class="sh-btn" data-act="i-period-save">Показать</button>';
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}
function openCashbackSheet(){
  var act = (D.goals||[]).filter(function(g){ return !g.done; });
  if(!act.length){ dAlert('Нет активных целей.', 'Копилка'); return; }
  var r = incRange();
  var cashSum = 0;
  for(var i=0;i<(D.incomes||[]).length;i++){ var x = D.incomes[i]; var d = parseD(x.d); if(d >= r.from && d < r.to && incomeKind(x)==='cash'){ cashSum += x.s; } }
  window._cashAmt = Math.round(cashSum);
  var opts = '';
  for(var j=0;j<act.length;j++){ opts += '<option value="'+act[j].id+'">'+act[j].n+'</option>'; }
  $('sheetBody').innerHTML = sheetHead('i-gift','c-org','Кэшбэк в копилку','пусть работает на цель')
    + rowHtml('Кэшбэк за период', fmt(window._cashAmt))
    + '<div class="form"><select class="inp" id="cbGoal">'+opts+'</select></div>'
    + '<button class="sh-btn" data-act="cashback-save">Закинуть</button>';
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}
function openQuickGoal(){
  var act = (D.goals||[]).filter(function(g){ return !g.done; });
  if(!act.length){ dAlert('Нет активных целей. Создай цель в окошке "Цели и копилки".', 'Копилка'); return; }
  var opts = '';
  for(var i=0;i<act.length;i++){ opts += '<option value="'+act[i].id+'">'+act[i].n+'</option>'; }
  $('sheetBody').innerHTML = sheetHead('i-target','c-pur','В копилку','отложить деньги в цель')
    + '<div class="form"><select class="inp" id="qgGoal">'+opts+'</select>'
    + '<input class="inp" id="qgAmt" type="number" placeholder="Сумма, ₽"></div>'
    + '<button class="sh-btn" data-act="qa-goal-save">Отложить</button>';
  $('sheet').classList.add('on'); $('shb').classList.add('on');
}

function render(){
  _allSpendsCache = null;
  _fcCache = null;
  var now = new Date();
  if ($('curDate')) $('curDate').textContent = now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'});
  if ($('appVersion')) $('appVersion').textContent = '1.0.0';
  if ($('lastSaveTime')) {
    var lastSave = D.lastSave || now;
    var saveDate = new Date(lastSave);
    $('lastSaveTime').textContent = saveDate.toLocaleDateString('ru-RU') + ' ' + saveDate.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
  }
  if ($('demoTag')) $('demoTag').classList.toggle('hidden', !D.demo);
    // Обновляем метку цикла в настройках
  var cycleLabel = document.getElementById('cycleModeLabel');
  if(cycleLabel) {
    cycleLabel.textContent = D.cycleMode === 'salary' ? 'Зарплатный' : 'Календарный';
  }
  if ($('hBal')) $('hBal').textContent = fmt(realBal());
  if ($('sInc')) $('sInc').textContent = fmt(D.income);
  if ($('sIncP')) $('sIncP').textContent = D.salaryDay ? 'зарплата, '+D.salaryDay+'-го числа' : 'доход не задан';
  var suMain = setupState();
  if ($('healthScore')) $('healthScore').textContent = suMain.ready ? health + ' / 100' : '—';
  var act = activeLeaks();
  var leakSum = 0;
  for(var j=0;j<act.length;j++){ leakSum += act[j].over; }
  if ($('sLeakV')) $('sLeakV').textContent = fmt(leakSum);
  if ($('sLeakP')) $('sLeakP').textContent = act.length+' зоны перерасхода';
  var badge = $('leakBadge');
  if(badge){
    if(act.length > 0){ badge.classList.remove('hidden'); badge.innerHTML = '<svg class="ic"><use href="#i-alert"/></svg> '+act.length; }
    else { badge.classList.add('hidden'); badge.innerHTML = ''; }
  }
  if ($('tipText')) $('tipText').textContent = smartTips()[(window._tipIdx != null ? window._tipIdx : now.getDate()) % smartTips().length];
  var saV = $('subsAuditVal');
  if(saV){
    var ssN = 0, ssS = 0;
    for(var s3=0;s3<D.subs.length;s3++){ if(!D.subs[s3].off){ ssS += D.subs[s3].s; ssN++; } }
    saV.textContent = ssN+' активных подписок = '+fmt(ssS)+' в месяц';
  }

  var csA = cycleStart(now);
  var listA = allSpends().filter(function(x){ return inCycle(x.d, csA); });
  var overEnvs = [];
  for(var ae=0;ae<D.envs.length;ae++){
    var evA = D.envs[ae];
    if(evA.lim <= 0){ continue; }
    var fA = 0;
    for(var ae2=0;ae2<listA.length;ae2++){ if(envMatch(evA, listA[ae2])){ fA += listA[ae2].s; } }
    if(fA > evA.lim){ overEnvs.push({id:evA.id, n:evA.n, over:fA-evA.lim}); }
  }
  var ea = $('envAlerts');
  if(ea){
    var eh = '';
    for(var e5=0;e5<overEnvs.length;e5++){
      eh += '<div class="sh-tip" style="background:rgba(255,69,58,.12);border:1px solid rgba(255,69,58,.3);display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px" data-act="env" data-i="'+overEnvs[e5].id+'"><span style="flex:1">Конверт "'+esc(overEnvs[e5].n)+'" превышен на <b>'+fmt(overEnvs[e5].over)+'</b></span><b style="color:var(--red)">посмотреть ›</b></div>';
    }
    ea.innerHTML = eh;
  }
    var acEl = $('attCenter');
  if(acEl){
    var sigs = getSignals();
    var ih = '';
    for(var si=0;si<sigs.length;si++){
      var s = sigs[si];
      var col = s.sev >= 8 ? 'var(--red)' : (s.sev >= 5 ? 'var(--org)' : 'var(--blu)');
      var actAttr = s.act.t ? 'data-act="sheet" data-t="'+s.act.t+'"' : 'data-act="'+s.act.act+'"'+(s.act.h ? ' data-h="'+s.act.h+'"' : '')+(s.act.p ? ' data-p="'+s.act.p+'"' : '');
      ih += '<div class="dig-item" style="cursor:pointer;border-left:3px solid '+col+'" '+actAttr+'><span><b style="color:'+col+'">'+esc(s.title)+'</b> — '+esc(s.desc)+(s.benefit?' · выгода '+fmt(s.benefit)+'/мес':'')+'</span><b>›</b></div>';
    }
    acEl.innerHTML = '<div class="cap-title"><span>Что важно сейчас</span><span class="pill '+(sigs.length?'c-org':'c-grn')+'" style="font-size:10px">'+(sigs.length?sigs.length+' сигналов':'всё спокойно')+'</span></div>'
      + (ih || '<div class="dig-item"><span>Требующих внимания задач нет — так держать</span><b>✓</b></div>');
  }
  
  
  try { renderDashboardNew(); } catch(e) { console.error('Ошибка в renderDashboardNew:', e); }
  try { renderGoals(); } catch(e) { console.error('Ошибка в renderGoals:', e); }
  try { renderBanner(); } catch(e) { console.error('Ошибка в renderBanner:', e); }
  try { renderAnalytics(); } catch(e) { console.error('Ошибка в renderAnalytics:', e); }
  try { renderDigest(); } catch(e) { console.error('Ошибка в renderDigest:', e); }
  try { renderRec(); } catch(e) { console.error('Ошибка в renderRec:', e); }
  try { renderAllTx(); } catch(e) { console.error('Ошибка в renderTx:', e); }
   try { renderBudSummary(); } catch(e) { console.error('Ошибка в renderBudSummary:', e); }
  try { renderEnv(); } catch(e) { console.error('Ошибка в renderEnv:', e); }
  try { renderPays(); } catch(e) { console.error('Ошибка в renderPays:', e); }
  try { renderSubs(); } catch(e) { console.error('Ошибка в renderSubs:', e); }
  try { renderCredits(); } catch(e) { console.error('Ошибка в renderCredits:', e); }
  try { renderInsts(); } catch(e) { console.error('Ошибка в renderInsts:', e); }
  try { renderSpend(); } catch(e) { console.error('Ошибка в renderSpend:', e); }
  try { renderIncome(); } catch(e) { console.error('Ошибка в renderIncome:', e); }
  try { renderLearn(); } catch(e) { console.error('Ошибка в renderLearn:', e); }
  try { renderMyCal(); } catch(e) { console.error('Ошибка в renderMyCal:', e); }
  try { renderHerCal(); } catch(e) { console.error('Ошибка в renderHerCal:', e); }
}

function go(p){
  var pages = document.querySelectorAll('.page');
  for(var i=0;i<pages.length;i++){ pages[i].classList.remove('on'); }
  var el = $('p-'+p);
  if(el){ el.classList.add('on'); }
  var btns = document.querySelectorAll('[data-act="nav"]');
  for(var j=0;j<btns.length;j++){ btns[j].classList.toggle('on', btns[j].getAttribute('data-p') === p); }
    if(p === 'dash'){ setTimeout(function(){ try{ renderAnalytics(); }catch(e){} }, 60); }
  if(p === 'chat' && $('chatLog') && !$('chatLog').children.length){
    addMsg('bot', 'Привет! Я твой финансовый копилот — считаю только по твоим цифрам.<br>Спроси: «сколько можно сегодня?», «могу купить X?», «где утечки?», «как закрыть долги?», «что важно сейчас?»');
  }
  closeSheet();
  window.scrollTo({top:0, behavior:'smooth'});
}

function placeTip(){
  var tip = $('tipText');
  if(!tip){ return; }
  var card = tip.closest('.glass');
  var hello = $('hello');
  if(!card || !hello){ return; }
  var hero = hello.closest('.glass');
  if(!hero || card === hero){ return; }
  hero.parentNode.insertBefore(card, hero.nextSibling);
}

function addMsg(cls, html){
  var log = $('chatLog');
  log.insertAdjacentHTML('beforeend', '<div class="msg '+cls+'">'+html+'</div>');
  log.scrollTop = 1000000;
}

function answer(t){
  return agentAnswer(t);
}

function ask(q){
  var t = q || $('chatIn').value.trim();
  if(!t){ return; }
  $('chatIn').value = '';
  addMsg('me', esc(t));
  setTimeout(function(){ addMsg('bot', answer(t)); }, 400);
}

document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-act]') : null;
  if(!el){ return; }
  var act = el.getAttribute('data-act');
    if(act === 'h-mode'){ hMode2 = el.getAttribute('data-v'); cycOff2 = 0; renderTx('2'); return; }
  if(act === 'h-prev' && el.closest && el.closest('#p-spend') && hMode2==='cyc'){ cycOff2--; renderTx('2'); return; }
  if(act === 'h-next' && el.closest && el.closest('#p-spend') && hMode2==='cyc'){ cycOff2++; renderTx('2'); return; }
  if(act === 'whatif'){ openWhatIf(); return; }
if(act === 'debt-plan'){ openDebtPlan(); return; }
  if(act === 'fc-zoom'){ fcZoom(el.getAttribute('data-t')); return; }
  if(act === 'life-min'){
    dPrompt('Сколько оставляешь себе на жизнь в месяц, ₽:', 'Минимум на жизнь', 'Например: 50000').then(function(v){
      var n = parseInt(String(v||'').replace(/\D/g,''), 10);
      if(!n && n !== 0){ return; }
      D.lifeMin = n;
      D.lifeMinManual = true;
      save(); render(); toast('Минимум на жизнь: '+fmt(n));
      openDebtPlan();
    });
    return;
  }
if(act === 'wi-calc'){
var selW = $('wiCat'); var pctW = parseInt($('wiPct').value,10);
if(!selW || isNaN(pctW)){ return; }
var optW = selW.options[selW.selectedIndex];
var catAmtW = parseFloat(optW ? optW.getAttribute('data-s') : '');
if(isNaN(catAmtW)){ dAlert('Выбери категорию.', 'Что если'); return; }
var cutW = Math.round(catAmtW * pctW / 100);
var simW = whatIf(cutW);
var colW = simW.diff > 0 ? 'var(--grn)' : 'var(--red)';
$('wiResult').innerHTML = '<div class="sh-tip" style="margin-top:12px;border-left:3px solid '+colW+'">Минимум за 90 дней станет: <b style="color:'+colW+'">'+fmt(simW.newMin)+'</b> '
+ '(было '+fmt(simW.originalMin)+', '+(simW.diff>0?'+':'')+fmt(simW.diff)+')<br>'
+ 'Экономия: '+fmt(cutW)+'/мес.</div>';
return;
}
if(act === 'wi-calc-debt'){
var payW = parseFloat($('wiDebtPay').value);
if(isNaN(payW) || payW <= 0){ dAlert('Введи ежемесячный платёж.', 'Что если'); return; }
var simD = whatIf(-payW);
var colD = simD.diff < 0 ? 'var(--red)' : 'var(--org)';
$('wiResult').innerHTML = '<div class="sh-tip" style="margin-top:12px;border-left:3px solid '+colD+'">С новым кредитом минимум за 90 дней: <b style="color:'+colD+'">'+fmt(simD.newMin)+'</b> '
+ '(было '+fmt(simD.originalMin)+', '+(simD.diff>0?'+':'')+fmt(simD.diff)+')<br>'
+ 'Нагрузка: '+fmt(payW)+'/мес.</div>';
return;
}
  if(act === 'nav'){ go(el.getAttribute('data-p')); }
  else if(act === 'sheet'){ window._sheetM = parseInt(el.getAttribute('data-m')||'0',10); openSheet(el.getAttribute('data-t'), parseInt(el.getAttribute('data-i') || '0', 10)); }
      else if(act === 'rebalance-show'){
    var rebalance = rebalanceBudget();
    if(!rebalance || !rebalance.suggestions.length){
      toast('Перерасхода нет — бюджет сбалансирован');
      return;
    }
    
    var h = sheetHead('i-chev','c-org','Перераспределение бюджета','автоматическая коррекция');
    h += '<div class="sh-tip" style="margin-bottom:10px">Общий перерасход: <b style="color:var(--red)">'+fmt(rebalance.totalOver)+'</b></div>';
    h += '<div class="cap" style="margin:10px 4px 6px">Предлагаю перенести:</div>';
    
    for(var i=0;i<rebalance.suggestions.length;i++){
      var s = rebalance.suggestions[i];
      var fromName = catById(s.from).n || s.from;
      var toName = catById(s.to).n || s.to;
      h += '<div class="dig-item"><span>Из "'+fromName+'" → в "'+toName+'"</span><b>'+fmt(s.amount)+'</b></div>';
    }
    
    if(rebalance.remaining > 0){
      h += '<div class="sh-tip" style="border-left:3px solid var(--org)">Остаток перерасхода: <b>'+fmt(rebalance.remaining)+'</b> — рекомендуем урезать гибкие траты.</div>';
    }
    
    h += '<div class="dlg-btns" style="margin-top:14px">' +
      '<button class="sh-btn" style="margin:0;flex:1" data-act="rebalance-apply">Применить</button>' +
      '<button class="sh-btn ghost" style="margin:0;flex:1" data-act="close">Отмена</button>' +
      '</div>';
    
    $('sheetBody').innerHTML = h;
    $('sheet').classList.add('on');
    $('shb').classList.add('on');
  }
  else if(act === 'env'){ openEnv(parseInt(el.getAttribute('data-i'), 10)); }
  else if(act === 'env-edit-open'){
    var eo = parseInt(el.getAttribute('data-i'),10);
    var eItem = null;
    for(var ee2=0;ee2<D.envs.length;ee2++){ if(D.envs[ee2].id === eo){ eItem = D.envs[ee2]; break; } }
    if(eItem){
      window._envDraft = {name:eItem.n, lim:eItem.lim, cats:(eItem.cats&&eItem.cats.length)?eItem.cats.slice():(envCatsFromName(eItem.n)||['other']), ic:eItem.ic||'i-gift', k:eItem.k||'c-pur', _save:'form-save-env', _saveTxt:'Сохранить конверт', _title:'Конверт · '+eItem.n, _id:eItem.id};
      renderEnvForm();
    }
  }
  else if(act === 'env-tpl'){
    if($('envQaAmt')){ $('envQaAmt').value = el.getAttribute('data-s'); }
    if($('envQaNote')){ $('envQaNote').value = el.getAttribute('data-n'); }
    toast('Подставлено — жмите «Добавить»');
  }
  else if(act === 'env-qa-add' || act === 'env-qa-more'){
    var eqId = window._envOpenId;
    var eQ = null;
    for(var eq2=0;eq2<D.envs.length;eq2++){ if(D.envs[eq2].id === eqId){ eQ = D.envs[eq2]; break; } }
    if(!eQ){ return; }
    var qaE = parseFloat($('envQaAmt') ? $('envQaAmt').value : '');
    var qnE = $('envQaNote') ? $('envQaNote').value.trim() : '';
    if(isNaN(qaE) || qaE <= 0){ dAlert('Введите сумму.', 'Конверт'); return; }
    var catE = (eQ.cats && eQ.cats.length) ? eQ.cats[0] : 'other';
    pushSpendSmart({amt:qaE, d:iso(new Date()), n:qnE, cat:catE, tag:'normal'}, function(){
      openEnv(eqId);
    });
  }
  else if(act === 'edit'){ openEdit(el.getAttribute('data-t'), parseInt(el.getAttribute('data-i') || '0', 10)); }
  else if(act === 'add'){ openEdit(el.getAttribute('data-t'), 0); }
  else if(act === 'form-save'){ saveEdit(); }
  else if(act === 'form-del'){ delEdit(); }
  else if(act === 'leak-fix'){
    var id1 = parseInt(el.getAttribute('data-i'), 10);
    var m1 = parseInt(el.getAttribute('data-m')||'0', 10);
    var n1 = new Date();
    var d1 = new Date(n1.getFullYear(), n1.getMonth()+m1, 1);
    var fkey1 = d1.getFullYear()+'-'+d1.getMonth();
    D.leakFixed = D.leakFixed || {};
    D.leakFixed[fkey1] = D.leakFixed[fkey1] || [];
    if(D.leakFixed[fkey1].indexOf(id1) === -1){ D.leakFixed[fkey1].push(id1); }
    save(); render(); openSheet('leaks'); toast('Утечка устранена!');
  }
  else if(act === 'leak-prev'){ leakOff--; openSheet('leaks'); }
  else if(act === 'leak-next'){ if(leakOff < 0){ leakOff++; openSheet('leaks'); } }
  else if(act === 'close'){ closeSheet(); }
      else if(act === 'rebalance-apply'){
    var rebalance = rebalanceBudget();
    if(!rebalance || !rebalance.suggestions.length){
      toast('Нет предложений для перераспределения');
      closeSheet();
      return;
    }
    var updated = applyRebalance(rebalance.suggestions);
    closeSheet();
    if(updated > 0){
      toast('Бюджет перераспределён: обновлено '+updated+' конвертов');
    } else {
      toast('Не удалось обновить конверты — проверьте лимиты');
    }
    render();
  }
  else if(act === 'nexttip'){ var tl = smartTips(); window._tipIdx = ((window._tipIdx != null ? window._tipIdx : new Date().getDate()) + 1) % tl.length; $('tipText').textContent = tl[window._tipIdx]; closeSheet(); }
  else if(act === 'balance-edit'){
    dPrompt('Текущая сумма на всех картах, ₽:', 'Базовый баланс', 'Например: 150000').then(function(v){
      if(v === null){ return; }
      var n = parseFloat(v);
      if(isNaN(n)){ return; }
      var t = sums();
      D.baseBalance = n - (t.inc - t.spend);
      D.setupBal = 1;
      D.lastBalCheck = Date.now();
      save(); closeSheet(); render(); vib(8); toast('Баланс обновлён · прогноз снова точен');
    });
  }
  else if(act === 'income-edit'){
    D.income = parseFloat($('in1').value) || D.income;
    var sdIn = parseInt($('in2').value, 10);
    if(sdIn >= 1 && sdIn <= 31){ D.salaryDay = sdIn; }
    save(); closeSheet(); render(); toast('Доход обновлён');
  }
  else if(act === 'spend-add'){
    var amt = parseFloat($('spAmt').value);
    if(isNaN(amt) || amt <= 0){ dAlert('Введите сумму траты.', 'Новая трата'); return; }
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
    dConfirm('Удалить трату?', 'Удаление', true).then(function(ok){
      if(!ok){ return; }
      var removed5 = null, removedIdx = -1;
      for(var r5=0;r5<D.spends.length;r5++){ if(D.spends[r5].id === id5){ removed5 = D.spends[r5]; removedIdx = r5; break; } }
      D.spends = D.spends.filter(function(x){ return x.id !== id5; });
      save(); closeSheet(); render();
      if(removed5){
        dToast('Трата удалена', 'Отменить', function(){
          D.spends.splice(Math.min(removedIdx, D.spends.length), 0, removed5);
          save(); render();
        });
      } else { toast('Трата удалена'); }
    });
  }
    else if(act === 'addincome'){ openIncomeSheet(); }
    else if(act === 'income-save'){
    var a2 = parseFloat($('incAmt').value);
    if(isNaN(a2) || a2 <= 0){ dAlert('Введите сумму поступления.', 'Поступление'); return; }
    var k2b = $('incKind') ? $('incKind').value : 'other';
    var dateVal = $('incDate').value || iso(new Date());
    D.incomes.push({id:Date.now(), d: dateVal, n: $('incNote').value.trim() || kindById(k2b)[1], s:a2, k:k2b});
    // Если это зарплата и день зарплаты ещё не задан, запоминаем день месяца
    if (k2b === 'salary' && !D.salaryDay) {
        var d = new Date(dateVal);
        D.salaryDay = d.getDate();
    }
    save(); closeSheet(); render(); toast('Поступление +'+fmt(a2));
}

  else if(act === 'del-income'){
    var idD = el.getAttribute('data-id');
    dConfirm('Удалить поступление?', 'Удаление', true).then(function(ok){
      if(!ok){ return; }
      var delIt2 = null, delIdx2 = -1;
      for(var x3=0;x3<D.incomes.length;x3++){ if(String(D.incomes[x3].id) === String(idD)){ delIt2 = D.incomes[x3]; delIdx2 = x3; break; } }
      if(delIt2 && delIt2.auto && delIt2.ck){
        D.removedAuto = D.removedAuto || [];
        if(D.removedAuto.indexOf(delIt2.ck) === -1){ D.removedAuto.push(delIt2.ck); }
      }
      D.incomes = D.incomes.filter(function(x){ return String(x.id) !== String(idD); });
      save(); closeSheet(); render();
      if(delIt2){
        dToast('Поступление удалено', 'Отменить', function(){
          if(delIt2.auto && delIt2.ck){
            var pi2 = D.removedAuto.indexOf(delIt2.ck);
            if(pi2 !== -1){ D.removedAuto.splice(pi2, 1); }
          }
          D.incomes.splice(Math.min(delIdx2, D.incomes.length), 0, delIt2);
          save(); render();
        });
      } else { toast('Поступление удалено'); }
    });
  }
      
  else if(act === 'p-set'){ pMode = el.getAttribute('data-v'); pOff = 0; renderAnalytics(); }
  else if(act === 'p-prev'){ pOff--; renderAnalytics(); }
  else if(act === 'p-next'){ if(pOff < 0){ pOff++; renderAnalytics(); } }
  else if(act === 'an-cat'){ openCatSheet(el.getAttribute('data-c')); }
  else if(act === 'an-day'){ openDaySheet(el.getAttribute('data-d')); }
  else if(act === 'an-compare'){ openCompareSheet(); }
      else if(act === 'an-habit'){ openHabitSheet(el.getAttribute('data-h')); }
           else if(act === 'dd-toggle'){
    var dd3 = el.closest('.dd');
    var wasOn = dd3.classList.contains('on');
    var dd4 = document.querySelectorAll('.dd.on');
    for(var d3=0;d3<dd4.length;d3++){ dd4[d3].classList.remove('on'); }
    if(!wasOn){ dd3.classList.add('on'); }
  }
  else if(act === 'h-prev'){
    if(el.closest && el.closest('#p-spend') && hMode2==='cyc'){ cycOff2--; }
    else { var r0 = histRange(); hFrom = addM(r0.from,-1); hTo = addM(r0.to,-1); }
    renderAllTx();
  }
  else if(act === 'h-next'){
    if(el.closest && el.closest('#p-spend') && hMode2==='cyc'){ cycOff2++; }
    else { var r1 = histRange(); hFrom = addM(r1.from,1); hTo = addM(r1.to,1); }
    renderAllTx();
  }
  else if(act === 'h-cat'){ hCat = el.getAttribute('data-c'); var dd5 = document.querySelectorAll('.dd.on'); for(var d5=0;d5<dd5.length;d5++){ dd5[d5].classList.remove('on'); } renderAllTx(); }
  else if(act === 'h-period'){ var dd6 = document.querySelectorAll('.dd.on'); for(var d6=0;d6<dd6.length;d6++){ dd6[d6].classList.remove('on'); } openPeriodSheet(); }
  else if(act === 'h-quick'){
    var n2 = new Date();
    var v2 = el.getAttribute('data-v');
    if(v2==='m'){ hFrom = new Date(n2.getFullYear(), n2.getMonth(), 1); hTo = new Date(n2.getFullYear(), n2.getMonth()+1, 1); }
    else if(v2==='pm'){ hFrom = new Date(n2.getFullYear(), n2.getMonth()-1, 1); hTo = new Date(n2.getFullYear(), n2.getMonth(), 1); }
    else if(v2==='q'){ hFrom = new Date(n2.getFullYear(), n2.getMonth()-2, 1); hTo = new Date(n2.getFullYear(), n2.getMonth()+1, 1); }
    else if(v2==='y'){ hFrom = new Date(n2.getFullYear(), 0, 1); hTo = new Date(n2.getFullYear()+1, 0, 1); }
    else if(v2==='all'){ hFrom = new Date(2020, 0, 1); hTo = new Date(n2.getFullYear()+1, 0, 1); }
        var dd7 = document.querySelectorAll('.dd.on'); for(var d7=0;d7<dd7.length;d7++){ dd7[d7].classList.remove('on'); }
    hMode2 = 'cal';
    closeSheet(); renderAllTx();
  }
  else if(act === 'h-period-save'){
    var f2 = $('hpFrom').value, t2 = $('hpTo').value;
    if(f2 && t2){
      var dF = parseD(f2), dT = parseD(t2);
      if(dT >= dF){ hFrom = dF; hTo = new Date(dT.getFullYear(), dT.getMonth(), dT.getDate()+1); }
    }
    closeSheet(); renderAllTx();
  }

  else if(act === 'qa-spend'){ openQuickSpend(); }
  else if(act === 'qs-cat'){
    window._qsCatTouched = true;
    var qcEl = $('qsCat'); if(qcEl){ qcEl.value = el.getAttribute('data-c'); }
    paintQsCats();
  }
  else if(act === 'qs-tag'){
    var qtEl = $('qsTag'); if(qtEl){ qtEl.value = el.getAttribute('data-c'); }
    var btns2q = document.querySelectorAll('.chip-grid .cat-chip');
    for(var bq=0;bq<btns2q.length;bq++){
      if(btns2q[bq].getAttribute('data-act') === 'qs-tag'){
        btns2q[bq].classList.toggle('on', btns2q[bq].getAttribute('data-c') === el.getAttribute('data-c'));
      }
    }
  }
  else if(act === 'qa-spend-save-more'){ saveQuickSpend(true); }
  else if(act === 'qa-spend-save'){ saveQuickSpend(false); }
  else if(act === 'qa-income'){ openIncomeSheet(); }
  else if(act === 'qa-goal'){ openQuickGoal(); }
  else if(act === 'qa-goal-save'){
    var qg = findGoal(parseInt($('qgGoal').value,10));
    var qga = parseFloat($('qgAmt').value);
    if(!qg || isNaN(qga) || qga <= 0){ dAlert('Укажи сумму пополнения.', 'Копилка'); return; }
    qg.cur = (qg.cur||0) + qga;
    if(qg.cur >= qg.target && qg.target > 0){ qg.done = true; toast('Цель "'+qg.n+'" выполнена!'); }
    else { toast('+'+fmt(qga)+' к цели "'+qg.n+'"'); }
    save(); closeSheet(); render();
  }
  else if(act === 'h-export'){
    var r2 = histRange();
    var rows2 = [['Дата','Описание','Категория','Сумма','Тип']];
    var sp2 = allSpends().filter(function(x){ return x.d >= r2.from && x.d < r2.to; }).sort(function(a,b){ return a.d - b.d; });
    // защита от автозамены на формулы в Excel/Google Sheets (=, +, -, @ в начале)
    function csvSafe(v){ var s = String(v); if(s.length > 0 && ('=+-@'.indexOf(s.charAt(0)) !== -1)){ return "'" + s; } return s; }
    for(var e2=0;e2<sp2.length;e2++){ rows2.push([iso(sp2[e2].d), csvSafe(sp2[e2].n), csvSafe(catById(sp2[e2].cat||'other').n), String(-sp2[e2].s), 'расход']); }
    var in2 = (D.incomes||[]).filter(function(x){ var d = parseD(x.d); return d >= r2.from && d < r2.to; });
    for(var e3=0;e3<in2.length;e3++){ rows2.push([in2[e3].d, csvSafe(in2[e3].n), 'Доход', String(in2[e3].s), 'поступление']); }
    var csv = rows2.map(function(r){ return r.map(function(c){ return '"'+String(c).replace(/"/g,'""')+'"'; }).join(';'); }).join('\n');
    var blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'});
    var a4 = document.createElement('a');
    a4.href = URL.createObjectURL(blob);
    a4.download = 'istoriya_'+iso(r2.from)+'_'+iso(new Date(r2.to.getTime()-864e5))+'.csv';
    document.body.appendChild(a4); a4.click(); a4.remove();
      toast('CSV выгружен');
  }
  else if(act === 'tx-edit'){ openTxEdit(el.getAttribute('data-src'), el.getAttribute('data-i')); }
   else if(act === 'tx-edit-save'){ saveTxEdit(); }
  else if(act === 'tx-apply-suggest'){ if($('teCat')){ $('teCat').value = el.getAttribute('data-c'); } saveTxEdit(); }
  else if(act === 'merch-open'){ openMerchSheet(parseInt(el.getAttribute('data-i'),10)); }
  else if(act === 'other-bulk'){ openOtherBulk(); }
 else if(act === 'mem-apply'){
var rules = D.merchRules || {};
var changed = 0;
for(var i=0;i<D.tx.length;i++){
var mk = merchName(D.tx[i].n || '').toLowerCase();
if(rules[mk]){
var newCat = rules[mk];
var curCat = TX2CAT[D.tx[i].c] || D.tx[i].c || 'other';
if(curCat !== newCat){ D.tx[i].c = newCat; changed++; }
}
}
save(); render(); toast('Память применена: обновлено операций: '+changed);
}
  else if(act === 'bulk-set'){
    var bi = parseInt(el.getAttribute('data-i'),10);
    var bc = el.getAttribute('data-c');
    var bit = (window._otherList||[])[bi];
    if(bit){
            if(bit.src === 'tx'){ var bt = D.tx[bit.sid]; if(bt){ bt.c = bc; } }
      else { for(var b4=0;b4<D.spends.length;b4++){ if(String(D.spends[b4].id) === String(bit.sid)){ D.spends[b4].cat = bc; break; } } }
      rememberRule(bit.n, bc);
      save(); render(); openOtherBulk(); toast('Категория присвоена · память: '+merchName(String(bit.n).toLowerCase())+' → '+catById(bc).n);
    }
  }
  else if(act === 'stmt-import'){ openStmtSheet(); }
  else if(act === 'stmt-parse'){
    var plist = parseStatement($('stmtTxt').value || '');
    var seen = {};
    var exist = {};
    var exA = allSpends();
    for(var e4=0;e4<exA.length;e4++){ exist[iso(exA[e4].d)+'|'+Math.round(exA[e4].s)+'|'+(exA[e4].n||'').toLowerCase()] = 1; }
    var fresh = [];
    for(var p2=0;p2<plist.length;p2++){
      var kk = plist[p2].d+'|'+plist[p2].s+'|'+(plist[p2].n||'').toLowerCase();
      if(!exist[kk] && !seen[kk]){ seen[kk] = 1; fresh.push(plist[p2]); }
    }
    window._stmtList = fresh;
    var tot2 = 0; for(var q3=0;q3<fresh.length;q3++){ tot2 += fresh[q3].s; }
    $('sheetBody').innerHTML = sheetHead('i-import','c-grn','Распознано', fresh.length+' новых операций на '+fmt(tot2))
      + (fresh.length ? '<div class="sh-tip">Дубли и переводы исключены. Нажми "Добавить" - операции появятся в истории.</div><button class="sh-btn" data-act="stmt-add">Добавить</button>' : '<div class="sh-tip">Новых операций не найдено - все уже в истории.</div>');
  }
  else if(act === 'stmt-add'){
    var add2 = window._stmtList || [];
    for(var a6=0;a6<add2.length;a6++){ D.tx.push({d:add2[a6].d, n:add2[a6].n, s:-add2[a6].s, c:add2[a6].c}); }
    window._stmtList = [];
    save(); closeSheet(); render(); toast('Добавлено операций: '+add2.length);
    // Сразу ищем регулярные платежи среди импортированного
    if(recCandidates().length){ setTimeout(function(){ openRecrSheet(); }, 400); }
  }

  else if(act === 'h-group'){ hGroup = el.getAttribute('data-v'); renderTx('2'); }
  else if(act === 'tpl-add'){
    var tp = (window._tplList||[])[parseInt(el.getAttribute('data-i'),10)];
    if(tp){
      D.spends.push({id:Date.now(), d:iso(new Date()), n:tp.n, cat:autoCat(tp.n), s:tp.s});
      save(); render(); toast('Трата записана: -'+fmt(tp.s));
    }
  }
  else if(act === 'dup-find'){ openDupSheet(); }
  else if(act === 'dup-del'){
    var dg = (window._dupGroups||[])[parseInt(el.getAttribute('data-g'),10)];
    var di = dg ? dg[parseInt(el.getAttribute('data-i'),10)] : null;
    if(di){
      dConfirm('Удалить дубликат?', 'Удаление', true).then(function(ok){
        if(!ok){ return; }
        if(di.src === 'tx'){ D.tx.splice(di.sid,1); }
        else { D.spends = D.spends.filter(function(x){ return String(x.id) !== String(di.sid); }); }
        save(); render(); openDupSheet(); toast('Дубликат удалён');
      });
    }
  }
  else if(act === 'cyc-compare'){ openCycCompareSheet(); }
  else if(act === 'round-add'){ openRoundSheet(); }
  else if(act === 'round-save'){
    var rg = findGoal(parseInt($('rdGoal').value,10));
    if(rg && (window._roundAmt||0) > 0){
      rg.cur = (rg.cur||0) + window._roundAmt;
      if(rg.cur >= rg.target && rg.target > 0){ rg.done = true; toast('Цель "'+rg.n+'" выполнена!'); }
      else { toast('+'+fmt(window._roundAmt)+' к цели "'+rg.n+'"'); }
      save(); closeSheet(); render();
    }
  }
  else if(act === 'tx-split'){ if(window._txef){ openSplitSheet(window._txef.src, window._txef.i); } }
  else if(act === 'tx-split-save'){
    var f3 = window._txef; if(!f3){ return; }
    var a1 = parseFloat($('spAmt1').value), a2 = parseFloat($('spAmt2').value);
    if(isNaN(a1) || a1 <= 0 || isNaN(a2) || a2 <= 0){ dAlert('Введите обе суммы.', 'Разделение'); return; }
    var c1 = $('spCat1').value, c2 = $('spCat2').value;
    if(f3.src === 'sp'){
      var it3 = null;
      for(var s3=0;s3<D.spends.length;s3++){ if(String(D.spends[s3].id) === String(f3.i)){ it3 = D.spends[s3]; break; } }
      if(it3){
        D.spends.push({id:Date.now(), d:it3.d, n:it3.n, cat:c2, s:a2});
        it3.s = a1; it3.cat = c1;
      }
    } else {
      var t3 = D.tx[+f3.i];
      if(t3){
        D.tx.push({d:t3.d, n:t3.n, s:-a2, c:c2});
        t3.s = -a1; t3.c = c1;
      }
    }
    save(); closeSheet(); render(); toast('Разделено на 2 операции');
  }

  else if(act === 'report-copy'){
    var rcT = window._reportText || '';
    if(!rcT){ toast('Отчёт ещё не открыт'); return; }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(rcT).then(function(){ vib(10); toast('Отчёт скопирован'); }, function(){ fallbackCopy(rcT); });
    } else { fallbackCopy(rcT); }
  }
  else if(act === 'report-share'){
    var rsT = window._reportText || '';
    if(!rsT){ toast('Отчёт ещё не открыт'); return; }
    if(navigator.share){
      navigator.share({title:'Отчёт МАЯК', text:rsT}).catch(function(){});
    } else {
      fallbackCopy(rsT);
      toast('Скопировано — вставьте куда нужно');
    }
  }
  else if(act === 'year-report'){ openYearReport(); }
  else if(act === 'month-report'){ openMonthReport(); }
  else if(act === 'xfer-del'){
    var xdId = parseFloat(el.getAttribute('data-i'));
    dConfirm('Удалить запись о переводе?', 'Перевод', true).then(function(ok){
      if(!ok){ return; }
      D.transfers = (D.transfers||[]).filter(function(x){ return x.id !== xdId; });
      save(); closeSheet(); render(); toast('Запись удалена');
    });
  }
  else if(act === 'canbuy'){ openCanBuy(); }
  else if(act === 'wish-add'){
    var wa = parseFloat($('cbPrice') ? $('cbPrice').value : '');
    var wn = ($('cbName') && $('cbName').value.trim()) || 'Покупка';
    if(isNaN(wa) || wa <= 0){ dAlert('Укажи цену.', 'Список желаний'); return; }
    D.wishes = D.wishes || [];
    D.wishes.push({id:Date.now(), n:wn, amt:wa, d:new Date().toISOString(), st:'wait'});
    save(); render(); openCanBuy();
    toast('Записано. Решение — через 24 часа.');
  }
  else if(act === 'wish-skip'){
    var wsId = parseFloat(el.getAttribute('data-i'));
    for(var wq=0;wq<(D.wishes||[]).length;wq++){ if(D.wishes[wq].id === wsId){ D.wishes[wq].st = 'skip'; break; } }
    save(); render(); openCanBuy();
    toast('Передумал — это тоже победа над импульсом');
  }
  else if(act === 'wish-buy'){
    var wbId = parseFloat(el.getAttribute('data-i'));
    var wItem = null;
    for(var wr=0;wr<(D.wishes||[]).length;wr++){ if(D.wishes[wr].id === wbId){ wItem = D.wishes[wr]; break; } }
    if(!wItem){ return; }
    var vW = canAfford(wItem.amt);
    dConfirm(vW.txt + '\n\nЗаписать трату ' + fmt(wItem.amt) + '?', 'Решение по «' + wItem.n + '»', vW.verdict === 'no').then(function(ok){
      if(!ok){ return; }
      wItem.st = 'bought';
      D.spends.push({id:Date.now(), d:iso(new Date()), n:wItem.n, cat:autoCat(wItem.n), s:wItem.amt, tag:'planned'});
      save(); render(); closeSheet();
      toast(vW.verdict === 'no' ? 'Куплено вопреки прогнозу — теперь ты знаешь цену' : 'Куплено осознанно: −'+fmt(wItem.amt));
    });
  }
  else if(act === 'canbuy-go'){
    var price = parseFloat($('cbPrice').value);
    if(isNaN(price) || price <= 0){ dAlert('Введите цену.', 'Проверка'); return; }
    var dailyC = calcDailyLimit(); var safeC = calcSafeBalance(); var pay3C = nextPay(3);
    var freeC = Math.max(0, safeC - pay3C);
    var vTxt, vCol;
    if(price <= dailyC.perDay && price <= freeC){ vTxt = 'Можно: вписывается в дневной лимит, и до зарплаты хватит.'; vCol = 'var(--grn)'; }
    else if(price <= freeC){ vTxt = 'Можно, но сверх дневного лимита на '+fmt(price - dailyC.perDay)+' — сегодня больше не трать.'; vCol = 'var(--org)'; }
    else if(price <= safeC){ vTxt = 'Лучше подождать: впереди платежи на '+fmt(pay3C)+', после покупки останется '+fmt(safeC - price)+'.'; vCol = 'var(--org)'; }
    else { vTxt = 'Нет: свободных денег '+fmt(freeC)+' с учётом платежей ближайших дней.'; vCol = 'var(--red)'; }
    $('cbVerdict').innerHTML = '<div class="sh-tip" style="margin-top:12px;border-left:3px solid '+vCol+'"><b style="color:'+vCol+'">'+vTxt+'</b><br>Свободно: '+fmt(freeC)+' · Дневной лимит: '+fmt(dailyC.perDay)+' · Платежи на 3 дня: '+fmt(pay3C)+'</div>';
  }
    
  else if(act === 'tx-del'){
    var f2 = window._txef; if(!f2){ return; }
    dConfirm('Удалить эту операцию?', 'Удаление', true).then(function(ok){
      if(!ok){ return; }
      var undoFn = null;
      if(f2.src === 'sp'){
        var remT = null, remI = -1;
        for(var rt=0;rt<D.spends.length;rt++){ if(String(D.spends[rt].id) === String(f2.i)){ remT = D.spends[rt]; remI = rt; break; } }
        D.spends = D.spends.filter(function(x){ return String(x.id) !== String(f2.i); });
        if(remT){ undoFn = function(){ D.spends.splice(Math.min(remI, D.spends.length), 0, remT); save(); render(); }; }
      } else {
        var txI = +f2.i;
        if(D.tx[txI]){
          var remX = D.tx[txI];
          D.tx.splice(txI, 1);
          undoFn = function(){ D.tx.splice(Math.min(txI, D.tx.length), 0, remX); save(); render(); };
        }
      }
      save(); closeSheet(); render();
      if(undoFn){ dToast('Операция удалена', 'Отменить', undoFn); } else { toast('Операция удалена'); }
    });
  }
    else if(act === 'recur-hide'){
    var c6 = (window._recurList||[])[parseInt(el.getAttribute('data-i'),10)];
    if(c6){
      D.recurHide = D.recurHide || [];
      var hk = c6.n.toLowerCase()+'|'+Math.round(c6.s);
      if(D.recurHide.indexOf(hk) === -1){ D.recurHide.push(hk); }
      save(); renderTx('2');
      toast('Скрыто — больше не предложу');
    }
  }
  // Детектор регулярных платежей по всей истории (после импорта выписки)
  else if(act === 'recr-find'){ openRecrSheet(); }
  else if(act === 'recr-add-pay'){
    var rpI = parseInt(el.getAttribute('data-i'),10);
    var rcP = (window._recrList||[])[rpI];
    if(rcP){
      var ldP = rcP.last;
      D.pays.push({id:Date.now(), n:rcP.n, s:rcP.s, d:ldP.getDate()});
      save(); render(); openRecrSheet(); toast('«'+rcP.n+'» — в обязательные платежи, '+ldP.getDate()+'-го');
    }
  }
  else if(act === 'recr-add-sub'){
    var rsI = parseInt(el.getAttribute('data-i'),10);
    var rcS = (window._recrList||[])[rsI];
    if(rcS){
      D.subs.push({id:Date.now(), n:rcS.n, s:rcS.s, off:0});
      save(); render(); openRecrSheet(); toast('«'+rcS.n+'» — в подписки');
    }
  }
  else if(act === 'recr-hide'){
    var rhI = parseInt(el.getAttribute('data-i'),10);
    var rcH = (window._recrList||[])[rhI];
    if(rcH){
      D.recurHide = D.recurHide || [];
      var hk2 = rcH.n.toLowerCase()+'|'+Math.round(rcH.s);
      if(D.recurHide.indexOf(hk2) === -1){ D.recurHide.push(hk2); }
      save(); openRecrSheet();
    }
  }
    
  else if(act === 'cal-prev'){ if(el.getAttribute('data-w')==='her'){ herOff--; renderHerCal(); } else { calOff--; renderMyCal(); } }
  else if(act === 'cal-next'){ if(el.getAttribute('data-w')==='her'){ herOff++; renderHerCal(); } else { calOff++; renderMyCal(); } }
  else if(act === 'cal-month'){
    var now0 = new Date();
    var dt0 = new Date(now0.getFullYear(), now0.getMonth() + calOff, 1);
    openCalSheet(dt0.getFullYear()+'-'+String(dt0.getMonth()+1).padStart(2,'0')+'-01', 1);
  }
  else if(act === 'cal-day'){
    if(el.getAttribute('data-w')==='her'){ openHerSheet(el.getAttribute('data-d')); }
    else if(calSelectMode){
      var k = el.getAttribute('data-d');
      var ix = calSel.indexOf(k);
      if(ix === -1){ calSel.push(k); } else { calSel.splice(ix,1); }
      $('calSelectBtn').textContent = 'Добавить ('+calSel.length+')';
      renderMyCal();
    }
    else { openCalSheet(el.getAttribute('data-d')); }
  }
  else if(act === 'cal-select'){
    if(!calSelectMode){
      calSelectMode = true; calSel = [];
      $('calSelectBtn').textContent = 'Добавить (0)';
      $('calCancelBtn').classList.remove('hidden');
      renderMyCal();
    } else if(calSel.length){ openPlanSheet(); }
  }
  else if(act === 'cal-cancel'){
    calSelectMode = false; calSel = [];
    $('calSelectBtn').textContent = '+ план';
    $('calCancelBtn').classList.add('hidden');
    closeSheet(); renderMyCal();
  }
  else if(act === 'cal-select-from-sheet'){
    var sd0 = window._calSheetDate;
    closeSheet();
    calSelectMode = true; calSel = sd0 ? [sd0] : [];
    $('calSelectBtn').textContent = 'Добавить ('+calSel.length+')';
    $('calCancelBtn').classList.remove('hidden');
    renderMyCal();
  }
  else if(act === 'ev-color'){ planColor = el.getAttribute('data-c'); paintPal(); }
  else if(act === 'plan-save'){
    var nm = $('evName').value.trim();
    if(!nm){ dAlert('Дай плану название.', 'Новый план'); return; }
    var col = autoColor(nm) || planColor || freeColor();
    var yearly = $('evYear').checked ? 1 : 0;
    var gid = Date.now();
    for(var pi=0;pi<calSel.length;pi++){
      D.events.push({id:gid+pi, gid:gid, d: yearly ? calSel[pi].slice(5) : calSel[pi], n:nm, c:col, yearly:yearly});
    }
    save();
    calSelectMode = false; calSel = [];
    $('calSelectBtn').textContent = '+ план';
    $('calCancelBtn').classList.add('hidden');
    render(); closeSheet();
    toast('План добавлен: '+nm);
  }
  else if(act === 'cal-event-add'){ calEventAdd(); }
  else if(act === 'cal-auto-del'){
    var t2 = el.getAttribute('data-t');
    var i2 = el.getAttribute('data-i');
    var d2 = el.getAttribute('data-d');
    dConfirm('Отменить это авто-событие на данную дату?', 'Отмена', true).then(function(ok){
      if(!ok){ return; }
      D.cancelled.push(t2+'-'+i2+'-'+d2);
      save(); render();
      var now2 = new Date();
      var dt2 = new Date(now2.getFullYear(), now2.getMonth()+calOff, 1);
      openCalSheet(dt2.getFullYear()+'-'+String(dt2.getMonth()+1).padStart(2,'0')+'-01', 1);
      toast('Авто-событие отменено');
    });
  }
  else if(act === 'cal-event-del'){ calEventDel(el.getAttribute('data-i')); }
  else if(act === 'fix-del'){ fixDel(el.getAttribute('data-t'), parseInt(el.getAttribute('data-i'),10)); }
  else if(act === 'postpone'){ fixPostpone(el.getAttribute('data-t'), parseInt(el.getAttribute('data-i'),10)); }
  else if(act === 'goal-add'){ openGoalAdd(); }
  else if(act === 'goal-add-save'){ goalAddSave(); }
  else if(act === 'goal-edit'){ openGoalEdit(parseInt(el.getAttribute('data-i'),10)); }
  else if(act === 'goal-edit-save'){ goalEditSave(parseInt(el.getAttribute('data-i'),10)); }
  else if(act === 'goal-fund'){ goalFund(parseInt(el.getAttribute('data-i'),10)); }
  else if(act === 'goal-del'){ goalDel(parseInt(el.getAttribute('data-i'),10)); }
  else if(act === 'goal-uncomplete'){ goalUncomplete(parseInt(el.getAttribute('data-i'),10)); }
  else if(act === 'her-set'){ herSet(el.getAttribute('data-d'), el.getAttribute('data-v')); }
  else if(act === 'her-fill'){ herFill(el.getAttribute('data-d')); }
   else if(act === 'chip' || act === 'chat-chip'){
    ask(el.getAttribute('data-q'));
  }
  else if(act === 'send'){ ask(); }
   else if(act === 'i-mode'){ iMode = el.getAttribute('data-v'); iCycOff = 0; renderIncome(); }
  else if(act === 'i-prev'){
    if(iMode==='cyc'){ iCycOff--; } else { var r0 = incRange(); iFrom = addM(r0.from,-1); iTo = addM(r0.to,-1); }
    renderIncome();
  }
  else if(act === 'i-next'){
    if(iMode==='cyc'){ iCycOff++; } else { var r1 = incRange(); iFrom = addM(r1.from,1); iTo = addM(r1.to,1); }
    renderIncome();
  }
  else if(act === 'i-quick'){
    var n3 = new Date(); var v3 = el.getAttribute('data-v');
    if(v3==='m'){ iFrom = new Date(n3.getFullYear(), n3.getMonth(), 1); iTo = new Date(n3.getFullYear(), n3.getMonth()+1, 1); }
    else if(v3==='pm'){ iFrom = new Date(n3.getFullYear(), n3.getMonth()-1, 1); iTo = new Date(n3.getFullYear(), n3.getMonth(), 1); }
    else if(v3==='q'){ iFrom = new Date(n3.getFullYear(), n3.getMonth()-2, 1); iTo = new Date(n3.getFullYear(), n3.getMonth()+1, 1); }
    else if(v3==='y'){ iFrom = new Date(n3.getFullYear(), 0, 1); iTo = new Date(n3.getFullYear()+1, 0, 1); }
    else if(v3==='all'){ iFrom = new Date(2020, 0, 1); iTo = new Date(n3.getFullYear()+1, 0, 1); }
    iMode = 'cal';
    var dd9 = document.querySelectorAll('.dd.on'); for(var d9=0;d9<dd9.length;d9++){ dd9[d9].classList.remove('on'); }
    closeSheet(); renderIncome();
  }
  else if(act === 'i-period'){ openIncPeriodSheet(); }
  else if(act === 'i-period-save'){
    var f9 = $('ipFrom').value, t9 = $('ipTo').value;
    if(f9 && t9){ var dF9 = parseD(f9), dT9 = parseD(t9); if(dT9 >= dF9){ iFrom = dF9; iTo = new Date(dT9.getFullYear(), dT9.getMonth(), dT9.getDate()+1); iMode = 'cal'; } }
    closeSheet(); renderIncome();
  }
  else if(act === 'i-kind'){ iKind = el.getAttribute('data-c'); var ddA = document.querySelectorAll('.dd.on'); for(var dA=0;dA<ddA.length;dA++){ ddA[dA].classList.remove('on'); } renderIncome(); }
  else if(act === 'i-tpl'){
    var tk3 = el.getAttribute('data-k');
    if(tk3 === 'salary'){
      var csT = cycleStart(new Date());
      var ckk = csT.getFullYear()+'-'+csT.getMonth();
      var dupSal = false;
      for(var ds2=0;ds2<D.incomes.length;ds2++){ if(D.incomes[ds2].auto && D.incomes[ds2].ck === ckk){ dupSal = true; break; } }
      if(dupSal){
        toast('Зарплата за этот цикл уже записана');
        return;
      }
      D.incomes.push({id:Date.now(), d:iso(new Date()), n:'Заработная плата', s:D.income, k:'salary'});
      save(); render(); toast('Поступление +'+fmt(D.income));
    } else {
      dPrompt('Сумма поступления, ₽?', tk3==='side' ? 'Подработка' : 'Кэшбэк', '5000').then(function(v){
        if(!v){ return; }
        var a9 = parseFloat(v);
        if(isNaN(a9) || a9 <= 0){ return; }
        D.incomes.push({id:Date.now(), d:iso(new Date()), n: tk3==='side' ? 'Подработка' : 'Кэшбэк', s:a9, k:tk3});
        save(); render(); toast('Поступление +'+fmt(a9));
      });
    }
  }
  else if(act === 'i-edit'){ openIncEdit(el.getAttribute('data-i')); }
  else if(act === 'i-edit-save'){
    var iid = window._incEf;
    var it9 = null;
    for(var i9=0;i9<(D.incomes||[]).length;i9++){ if(String(D.incomes[i9].id) === String(iid)){ it9 = D.incomes[i9]; break; } }
    if(it9){
      var aA = parseFloat($('ieAmt').value);
      if(isNaN(aA) || aA <= 0){ dAlert('Введите сумму.', 'Поступление'); return; }
      it9.s = aA; it9.k = $('ieKind').value;
      if($('ieDate').value){ it9.d = $('ieDate').value; }
      if($('ieNote').value.trim()){ it9.n = $('ieNote').value.trim(); }
      save(); closeSheet(); render(); toast('Поступление обновлено');
    }
  }
   else if(act === 'i-del'){
    var iid2 = window._incEf;
    dConfirm('Удалить поступление?', 'Удаление', true).then(function(ok){
      if(!ok){ return; }
      var delIt = null;
      for(var x2=0;x2<D.incomes.length;x2++){ if(String(D.incomes[x2].id) === String(iid2)){ delIt = D.incomes[x2]; break; } }
      if(delIt && delIt.auto && delIt.ck){
        D.removedAuto = D.removedAuto || [];
        if(D.removedAuto.indexOf(delIt.ck) === -1){ D.removedAuto.push(delIt.ck); }
      }
      D.incomes = D.incomes.filter(function(x){ return String(x.id) !== String(iid2); });
      save(); closeSheet(); render(); toast('Поступление удалено');
    });
  }
  else if(act === 'cashback-add'){ openCashbackSheet(); }
  else if(act === 'cashback-save'){
    var cg = findGoal(parseInt($('cbGoal').value,10));
    if(cg && (window._cashAmt||0) > 0){
      cg.cur = (cg.cur||0) + window._cashAmt;
      if(cg.cur >= cg.target && cg.target > 0){ cg.done = true; toast('Цель "'+cg.n+'" выполнена!'); }
      else { toast('+'+fmt(window._cashAmt)+' к цели "'+cg.n+'"'); }
      save(); closeSheet(); render();
    }
  }
  else if(act === 'env-add'){ openEnvAdd(); }
  else if(act === 'env-cat' || act === 'env-icon' || act === 'env-col'){
    envDraftSyncInputs();
    var dEc = window._envDraft;
    var vE = el.getAttribute('data-c');
    if(act === 'env-cat'){
      var ix2 = dEc.cats.indexOf(vE);
      if(ix2 !== -1){ if(dEc.cats.length > 1){ dEc.cats.splice(ix2, 1); } }
      else { dEc.cats.push(vE); }
    }
    else if(act === 'env-icon'){ dEc.ic = vE; }
    else { dEc.k = vE; }
    renderEnvForm();
  }
  else if(act === 'env-add-save' || act === 'form-save-env'){
    envDraftSyncInputs();
    var dEs = window._envDraft;
    if(!dEs){ return; }
    var nmE = (dEs.name||'').trim();
    var lE = parseFloat(dEs.lim);
    if(!nmE){ dAlert('Дайте конверту название.', 'Конверт'); return; }
    if(isNaN(lE) || lE <= 0){ dAlert('Укажи лимит на цикл.', 'Конверт'); return; }
    if(act === 'env-add-save'){
      D.envs.push({id:Date.now(), n:nmE, lim:lE, cats:dEs.cats.slice(), ic:dEs.ic, k:dEs.k});
      toast('Конверт «'+nmE+'» создан');
    } else {
      var itSv = null;
      for(var sv=0;sv<D.envs.length;sv++){ if(D.envs[sv].id === dEs._id){ itSv = D.envs[sv]; break; } }
      if(itSv){
        itSv.n = nmE; itSv.lim = lE; itSv.cats = dEs.cats.slice(); itSv.ic = dEs.ic; itSv.k = dEs.k;
        toast('Конверт обновлён');
      }
    }
    save(); closeSheet(); render();
  }
  else if(act === 'pay-paid'){
    var pid = parseInt(el.getAttribute('data-i'),10);
    var pay = null;
    for(var p2=0;p2<D.pays.length;p2++){ if(D.pays[p2].id===pid){ pay = D.pays[p2]; break; } }
    if(pay){
      dConfirm('Отметить "'+pay.n+'" оплаченным? Запишется трата '+fmt(pay.s)+'.', 'Платёж').then(function(ok){
        if(!ok){ return; }
        var sid = Date.now();
        D.spends.push({id:sid, d:iso(new Date()), n:pay.n, cat:autoCat(pay.n), s:pay.s, manual:1});
        D.paid = D.paid || {}; var key = cycleKey(); D.paid[key] = D.paid[key] || {}; D.paid[key][pay.id] = sid;
        save(); render(); vib(12); toast('Платёж отмечен оплаченным');
        if(window._sheetCur === 'upcoming-detail'){ openSheet('upcoming-detail'); }
      });
    }
  }
  else if(act === 'pay-unpaid'){
    var pid2 = parseInt(el.getAttribute('data-i'),10);
    var key2 = cycleKey();
    var sid2 = ((D.paid||{})[key2]||{})[pid2];
    dConfirm('Снять отметку? Трата платежа будет удалена.', 'Платёж', true).then(function(ok){
      if(!ok){ return; }
      if(sid2){ D.spends = D.spends.filter(function(x){ return x.id !== sid2; }); }
      if(D.paid && D.paid[key2]){ delete D.paid[key2][pid2]; }
      save(); render(); toast('Отметка снята');
    });
  }
  else if(act === 'sub-toggle'){
    var sid3 = parseInt(el.getAttribute('data-i'),10);
    var sIt = null;
    for(var s4=0;s4<D.subs.length;s4++){ if(D.subs[s4].id===sid3){ sIt = D.subs[s4]; break; } }
    if(sIt){
      sIt.off = sIt.off ? 0 : 1;
      if(sIt.off){ logDecision('cancel_sub', {name:sIt.n, amount:sIt.s}); toast('Подписка "'+sIt.n+'" отключена · '+fmt(sIt.s*12)+' в год освободится'); }
      else { toast('Подписка "'+sIt.n+'" включена'); }
      save(); render();
    }
  }
  else if(act === 'cred-pay'){
    var cid = parseInt(el.getAttribute('data-i'),10);
    var cr = null;
    for(var c5=0;c5<D.credits.length;c5++){ if(D.credits[c5].id===cid){ cr = D.credits[c5]; break; } }
    if(cr){
      dPrompt('Сумма платежа по "'+cr.n+'", ₽?', 'Платёж по кредиту', String(cr.cur)).then(function(v){
        if(!v){ return; }
        var a5 = parseFloat(v);
        if(isNaN(a5) || a5 <= 0){ return; }
        a5 = Math.min(a5, cr.cur);
        cr.cur -= a5;
        D.spends.push({id:Date.now(), d:iso(new Date()), n:'Платёж: '+cr.n, cat:'other', s:a5, manual:1});
        save(); render(); toast(cr.cur <= 0 ? 'Кредит "'+cr.n+'" закрыт!' : 'Платёж '+fmt(a5)+' учтён');
      });
    }
  }
  else if(act === 'inst-pay'){
    var iid3 = parseInt(el.getAttribute('data-i'),10);
    var in3 = null;
    for(var i7=0;i7<D.insts.length;i7++){ if(D.insts[i7].id===iid3){ in3 = D.insts[i7]; break; } }
    if(in3){
      dConfirm('Оплатить рассрочку '+fmt(in3.s)+' ('+in3.n+')? Запишется трата.', 'Рассрочка').then(function(ok){
        if(!ok){ return; }
        D.spends.push({id:Date.now(), d:iso(new Date()), n:in3.n, cat:'other', s:in3.s, manual:1});
        D.insts = D.insts.filter(function(x){ return x.id !== iid3; });
        save(); render(); toast('Рассрочка оплачена');
        if(window._sheetCur === 'upcoming-detail'){ openSheet('upcoming-detail'); }
      });
    }
  }
  else if(act === 'backup-export'){ exportBackup(); }
  else if(act === 'backup-import'){ importBackupFromFile(el); }
  else if(act === 'reset-all'){ resetAllData(); }
      else if(act === 'cycle-toggle'){
    var newMode = D.cycleMode === 'salary' ? 'calendar' : 'salary';
    D.cycleMode = newMode;
    save();
    render();
    toast('Цикл переключён на ' + (newMode === 'salary' ? 'зарплатный' : 'календарный'));
  }
  else if(act === 'learn-done'){
    var li8 = parseInt(el.getAttribute('data-i'),10);
    if((D.learned||[]).indexOf(li8) === -1){
      D.learned.push(li8);
      save(); render();
      toast('Урок изучен · прогресс '+D.learned.length+'/'+LESSONS.length);
    }
    closeSheet();
  }
  else if(act === 'cred-setpay'){
    var cpId = parseInt(el.getAttribute('data-i'),10);
    var cpC = null;
    for(var cc7=0;cc7<(D.credits||[]).length;cc7++){ if(D.credits[cc7].id === cpId){ cpC = D.credits[cc7]; break; } }
    if(!cpC){ return; }
    dPrompt('Ежемесячный платёж по «'+cpC.n+'», ₽:', 'Платёж по кредиту', '5000').then(function(vA){
      var aC = parseFloat(vA);
      if(isNaN(aC) || aC <= 0){ return; }
      dPrompt('В какой день списывается? (1–31)', 'День списания', '20').then(function(vD){
        var dC2 = parseInt(String(vD||'').replace(/\D/g,''),10);
        if(!dC2 || dC2 < 1 || dC2 > 31){ dC2 = 1; }
        cpC.pay = aC; cpC.d = dC2;
        save(); render(); closeSheet();
        toast('Прогноз учтёт '+fmt(aC)+' ежемесячно');
      });
    });
  }
  else if(act === 'exit'){ signOut(auth); }
});

$('shb').addEventListener('click', closeSheet);

document.addEventListener('change', function(e){
var el = e.target.closest ? e.target.closest('[data-act="backup-import"]') : null;
if(el){ importBackupFromFile(el); }
});

document.addEventListener('click', function(e){
  var open = document.querySelectorAll('.dd.on');
  for(var i=0;i<open.length;i++){
    if(!open[i].contains(e.target)){ open[i].classList.remove('on'); }
  }
});

var gbtn = $('googleBtn');
if(gbtn){
  gbtn.addEventListener('click', function(){
    gbtn.textContent = 'Подключаюсь...';
    signInWithPopup(auth, prov).catch(function(err){
      return signInWithRedirect(auth, prov);
    }).catch(function(err2){
      gbtn.textContent = 'Войти через Google';
      dAlert('Не удалось войти: ' + ((err2 && err2.code) || err2), 'Ошибка входа');
    });
  });
}

function loadPages() {
  var pages = ['dash', 'spend', 'income', 'budget', 'learn', 'chat', 'settings'];
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
          pageDiv.id = 'p-' + pageName;
          container.appendChild(pageDiv);
        }
      });
  });
  return Promise.all(promises);
}

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
  (window._pagesLoaded || Promise.resolve()).then(function() {
    var name = (u.displayName || 'друг').split(' ')[0];
    if ($('hello')) $('hello').textContent = 'Привет, ' + name + '!';
    if ($('mMail')) $('mMail').textContent = name;
    getDoc(doc(db,'users',uid)).then(function(s){
      if(s.exists() && s.data() && s.data().data){ D = s.data().data; }
      normalize();
      if(window.SEED && (D.seedVersion||0) !== window.SEED.version){ applySeed(window.SEED); }
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
      if($('q')){ $('q').addEventListener('input', debRerender()); }
      if($('q2')){ $('q2').addEventListener('input', debRerender2()); }
      if($('chatIn')){ $('chatIn').addEventListener('keydown', function(e){ if(e.key === 'Enter'){ ask(); } }); }
            // Чипы быстрых сценариев в чате
      var chatContainer = $('chatLog');
      if(chatContainer){
        var chipContainer = document.createElement('div');
        chipContainer.id = 'chatChips';
        chipContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:8px 0;margin-bottom:8px';
        chipContainer.innerHTML = 
          '<button class="chip" data-act="chat-chip" data-q="Что будет, если я урежу кафе на 30%?">Урезать кафе на 30%</button>' +
          '<button class="chip" data-act="chat-chip" data-q="Что будет, если я урежу самокаты на 50%?">Самокаты -50%</button>' +
          '<button class="chip" data-act="chat-chip" data-q="Что важно сейчас?">Что важно сейчас?</button>' +
          '<button class="chip" data-act="chat-chip" data-q="Как мне сэкономить 10000 в этом месяце?">Сэкономить 10 000</button>';
        chatContainer.parentNode.insertBefore(chipContainer, chatContainer);
      }
      if($('spCat')){ $('spCat').addEventListener('change', function(){ catTouched = true; }); }
      if($('spNote')){ $('spNote').addEventListener('input', function(){ if(!catTouched){ $('spCat').value = autoCat(this.value); } }); }
      render();
      go('dash');
      placeTip();
    }).catch(function(){ normalize(); render(); go('dash'); placeTip(); });
  });
});

if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(function(){}); }

var watchBaseSuccess = null;
var deployPolls = 0;
function deployPaint(color, txt){
  var el = $('buildInfo');
  if(!el){ return; }
  el.innerHTML = '<i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:'+color+';margin-right:6px;vertical-align:middle"></i>'+txt;
}
function deployFtime(s){
  var d = new Date(s);
  return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function deploySchedule(ms){ setTimeout(deployCheck, ms); }
function deployCheck(){
  fetch('https://api.github.com/repos/pvsstr/trash-budget/actions/runs?per_page=10', { cache: 'no-cache' })
    .then(function(r){
      if(r.status === 403 || r.status === 429){
        deployPaint('#8b91a7', 'лимит API · пауза 10 мин');
        deploySchedule(600000);
        return null;
      }
      return r.json();
    })
    .then(function(data){
      if(!data){ return; }
      var list = (data && data.workflow_runs) ? data.workflow_runs : [];
      if(!list.length){ deployPaint('#8b91a7','деплой: —'); deploySchedule(300000); return; }
      var run = null;
      for(var i=0;i<list.length;i++){
        if(String(list[i].name||'').toLowerCase().indexOf('pages') !== -1){ run = list[i]; break; }
      }
      if(!run){ run = list[0]; }
      var success = null;
      for(var j=0;j<list.length;j++){
        if(list[j].status === 'completed' && list[j].conclusion === 'success'){ success = list[j]; break; }
      }
      var st = run.status;
      var con = run.conclusion;
      var num = '#' + run.run_number;
      deployPolls++;
      var delay = deployPolls > 15 ? 300000 : 60000;
      if(st !== 'completed'){
        deployPaint('#ff9f0a', 'деплоится… · ' + num);
      } else if(con === 'success'){
        deployPaint('#30d158', 'деплой ' + deployFtime(run.updated_at) + ' · ' + num);
      } else {
        deployPaint('#ff453a', 'ошибка деплоя · ' + num);
      }
      if(watchBaseSuccess === null){
        watchBaseSuccess = success ? success.run_number : 0;
        deploySchedule(delay);
        return;
      }
      if(success && success.run_number > watchBaseSuccess){
        watchBaseSuccess = success.run_number;
        deployPaint('#30d158', 'применяю обновление… · #' + success.run_number);
        setTimeout(function(){ window.location.reload(); }, 2000);
        return;
      }
      deploySchedule(delay);
    })
    .catch(function(){
      deployPaint('#8b91a7', 'деплой: —');
      deploySchedule(60000);
    });
}

// ========== ПЛАН НА МЕСЯЦ ==========
// Автоматически рассчитывает рекомендуемые лимиты по категориям
function calcMonthlyPlan() {
  var now = new Date();
  // Среднее по последним 3 завершённым циклам (или месяцам в календарном режиме)
  var totals = {};
  var cyclesN = 0;
  for(var c=1;c<=3;c++){
    var from, to;
    if(D.cycleMode === 'calendar'){
      var f0 = new Date(now.getFullYear(), now.getMonth()-c, 1);
      from = f0; to = new Date(f0.getFullYear(), f0.getMonth()+1, 1);
    } else {
      from = shiftCycle(cycleStart(now), -c);
      to = cycleEnd(from);
    }
    var cycSp = allSpends().filter(function(x){ return x.d >= from && x.d < to; });
    if(!cycSp.length){ continue; }
    cyclesN++;
    for(var i=0;i<cycSp.length;i++){
      var cat = cycSp[i].cat || 'other';
      totals[cat] = (totals[cat]||0) + cycSp[i].s;
    }
  }
  
  var plan = {};
  var totalPlan = 0;
  var income = D.income || 0;
  var fixedCosts = calcMonthlyFixedPay();
  var available = Math.max(0, income - fixedCosts);
  var targetSave = available * 0.15; // 15% откладываем
  
  for(var cat2 in totals){
    // Среднее за 3 цикла
    var avg = totals[cat2] / Math.max(1, cyclesN);
    // Рекомендуемый лимит = среднее × 0.9 (постепенное ужатие)
    var recommended = Math.round(avg * 0.9);
    plan[cat2] = recommended;
    totalPlan += recommended;
  }
  
  // Если план превышает доступные деньги, пропорционально ужимаем
  if(totalPlan > available - targetSave && totalPlan > 0){
    var ratio = (available - targetSave) / totalPlan;
    for(var cat3 in plan){
      plan[cat3] = Math.round(plan[cat3] * ratio);
    }
  }
  
  // Добавляем цель сбережений
  plan._saveTarget = Math.round(targetSave);
  plan._available = available;
  plan._fixedCosts = fixedCosts;
  
  return plan;
}

// Автокоррекция бюджета – перераспределение между категориями при перерасходе
function rebalanceBudget() {
  var now = new Date();
  var from, to;
  if(D.cycleMode === 'calendar'){
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else {
    from = cycleStart(now);
    to = cycleEnd(from);
  }
  var allSp = allSpends().filter(function(x){ return x.d >= from && x.d < to; });
  
  // Текущие траты по категориям
  var spent = {};
  for(var i=0;i<allSp.length;i++){
    var cat = allSp[i].cat || 'other';
    spent[cat] = (spent[cat]||0) + allSp[i].s;
  }
  
  // План на месяц
  var plan = calcMonthlyPlan();
  var overSpent = {};
  var underSpent = {};
  
  // Находим перерасход и недорасход
  for(var cat in plan){
    if(cat === '_saveTarget' || cat === '_available' || cat === '_fixedCosts') continue;
    var current = spent[cat] || 0;
    var limit = plan[cat] || 0;
    var diff = current - limit;
    if(diff > 0){
      overSpent[cat] = diff;
    } else if(diff < 0 && Math.abs(diff) > 100){
      underSpent[cat] = Math.abs(diff);
    }
  }
  
  // Если нет перерасхода – ничего не делаем
  var totalOver = 0;
  for(var oc in overSpent){ totalOver += overSpent[oc]; }
  if(totalOver < 100) return null;
  
  // Собираем предложения по переносу
  var suggestions = [];
  var underKeys = Object.keys(underSpent);
  underKeys.sort(function(a,b){ return underSpent[b] - underSpent[a]; });
  
  var remainingOver = totalOver;
  for(var j=0;j<underKeys.length && remainingOver > 0;j++){
    var catFrom = underKeys[j];
    var amount = Math.min(underSpent[catFrom], remainingOver);
    if(amount < 50) continue;
    // Ищем категорию с перерасходом
    var overKeys = Object.keys(overSpent);
    var catTo = overKeys[0];
    if(!catTo) break;
    suggestions.push({from: catFrom, to: catTo, amount: Math.round(amount)});
    remainingOver -= amount;
    overSpent[catTo] -= amount;
    if(overSpent[catTo] < 50) delete overSpent[catTo];
    underSpent[catFrom] -= amount;
    if(underSpent[catFrom] < 50) delete underSpent[catFrom];
  }
  
  if(!suggestions.length) return null;
  
  return {
    suggestions: suggestions,
    totalOver: totalOver,
    remaining: remainingOver
  };
}
// Применить перераспределение бюджета
function applyRebalance(suggestions) {
  var plan = calcMonthlyPlan();
  for(var i=0;i<suggestions.length;i++){
    var s = suggestions[i];
    var from = s.from;
    var to = s.to;
    var amount = s.amount;
    // Уменьшаем лимит категории-донора
    if(plan[from]) plan[from] = Math.max(0, plan[from] - amount);
    // Увеличиваем лимит категории-получателя
    if(plan[to]) plan[to] = (plan[to]||0) + amount;
  }
  // Сохраняем новые лимиты в конверты
  var updated = 0;
  for(var cat in plan){
    if(cat === '_saveTarget' || cat === '_available' || cat === '_fixedCosts') continue;
    var envName = CAT2ENV[cat] || cat;
    // Ищем конверт с таким названием
    for(var j=0;j<D.envs.length;j++){
      if(D.envs[j].n.indexOf(envName) === 0 || D.envs[j].n === cat){
        var oldLim = D.envs[j].lim;
        var newLim = plan[cat] || 0;
        if(Math.abs(oldLim - newLim) > 10){
          D.envs[j].lim = newLim;
          updated++;
        }
        break;
      }
    }
  }
  save();
  render();
  toast('Бюджет перераспределён: обновлено '+updated+' конвертов');
  return updated;
}
// ========== ИСТОРИЯ ЦЕЛЕЙ ==========
function goalHistory(goalId){
  var history = [];
  // Ищем все траты с названием, содержащим имя цели
  var goal = null;
  for(var i=0;i<(D.goals||[]).length;i++){
    if(D.goals[i].id === goalId){ goal = D.goals[i]; break; }
  }
  if(!goal) return history;
  
  var allSp = allSpends();
  for(var j=0;j<allSp.length;j++){
    if(allSp[j].n && allSp[j].n.indexOf(goal.n) !== -1){
      history.push({date:allSp[j].d, amount:allSp[j].s});
    }
  }
  // Также ищем пополнения из доходов с типом 'cash' или с названием цели
  for(var k=0;k<(D.incomes||[]).length;k++){
    if(D.incomes[k].n && D.incomes[k].n.indexOf(goal.n) !== -1){
      history.push({date:parseD(D.incomes[k].d), amount:D.incomes[k].s});
    }
  }
  history.sort(function(a,b){ return a.date - b.date; });
  return history;
}

// ========== ЛОГ РЕШЕНИЙ ==========
function logDecision(type, data){
  D.decisions = D.decisions || [];
  D.decisions.push({
    id: Date.now(),
    type: type, // 'cut_spend', 'postpone_pay', 'save_money', 'cancel_sub'
    data: data,
    date: new Date().toISOString(),
    reviewed: false
  });
  save();
}

function getDecisionEffect(decisionId){
  var decision = null;
  for(var i=0;i<(D.decisions||[]).length;i++){
    if(D.decisions[i].id === decisionId){ decision = D.decisions[i]; break; }
  }
  if(!decision) return null;
  
  // Анализируем эффект решения через 30 дней
  var decisionDate = new Date(decision.date);
  var fromDate = new Date(decisionDate.getFullYear(), decisionDate.getMonth(), 1);
  var toDate = new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 1);
  var allSp = allSpends();
  
  var spentBefore = 0, spentAfter = 0;
  var monthBefore = new Date(fromDate.getFullYear(), fromDate.getMonth() - 1, 1);
  var monthAfter = new Date(fromDate.getFullYear(), fromDate.getMonth() + 2, 1);
  
  for(var j=0;j<allSp.length;j++){
    if(decision.type === 'cut_spend' && decision.data.cat){
      if((allSp[j].cat||'other') !== decision.data.cat) continue;
    }
    if(allSp[j].d >= monthBefore && allSp[j].d < fromDate){
      spentBefore += allSp[j].s;
    } else if(allSp[j].d >= toDate && allSp[j].d < monthAfter){
      spentAfter += allSp[j].s;
    }
  }
  
  var diff = spentBefore - spentAfter;
  return {
    decision: decision,
    before: spentBefore,
    after: spentAfter,
    saved: diff,
    success: diff > 0
  };
}

function getRecentDecisions(){
  var decisions = D.decisions || [];
  decisions.sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
  return decisions.slice(0, 5);
}

// ========== МОЗГ ПРИЛОЖЕНИЯ v2 ==========

// Прогнозный движок: строит баланс на каждый день вперёд
// Учитывает: текущий остаток, средний дневной темп гибких трат,
//            все будущие платежи, подписки, рассрочки, зарплату
var _fcCache = null;
function forecastCashFlow(daysAhead, fromDate){
  var useDefault = (fromDate == null);
  daysAhead = daysAhead || 90;
  fromDate = fromDate || new Date();
  if(useDefault && daysAhead === 90 && _fcCache){ return _fcCache; }
  fromDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  
   // 1. Определяем дневной темп гибких трат (исключая обязательные)
  var lookback = 30;
  var fromLook = new Date(fromDate.getTime() - lookback*864e5);
  var allSp = allSpends();
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
  
  // 2. Поведенческие коэффициенты: после зарплаты тратим больше, перед зарплатой — меньше
  var nextSalary = salaryDate(fromDate.getFullYear(), fromDate.getMonth() + 1);
  var daysToSalary = Math.max(1, Math.round((nextSalary - fromDate) / 864e5));
  var totalCycle = 30; // примерно
  var daysFromSalary = totalCycle - daysToSalary;
  
  function getBehaviorCoeff(dayFromStart) {
    // dayFromStart — сколько дней прошло с начала прогноза
    var currentDate = new Date(fromDate.getTime() + dayFromStart * 864e5);
    var daysSinceSalary = Math.round((currentDate - cycleStart(currentDate)) / 864e5);
    var cycleLen = Math.round((cycleEnd(cycleStart(currentDate)) - cycleStart(currentDate)) / 864e5);
    var phase = daysSinceSalary / cycleLen; // 0..1
    
    if (phase < 0.15) return 1.3;  // первые 15% цикла — тратим на 30% больше
    if (phase < 0.45) return 1.0;  // средняя часть — норма
    if (phase < 0.75) return 0.85; // предпоследняя треть — на 15% меньше
    return 0.7;                   // последняя четверть — на 30% меньше
  }
  
  // 2. Собираем все будущие известные списания и поступления
  var events = [];
  var i, d, key;
  
  // Подписки — списание 1 числа каждого месяца (или по дате, если известна)
  for(i=0;i<D.subs.length;i++){
    if(D.subs[i].off){ continue; }
    for(var md=1; md<=daysAhead+30; md+=30){
      var subDay = new Date(fromDate.getTime() + md*864e5);
      subDay = new Date(subDay.getFullYear(), subDay.getMonth(), 1);
      if(subDay >= fromDate){ events.push({date:subDay, amt:-D.subs[i].s, n:'Подписка: '+D.subs[i].n}); }
    }
  }
  
   // Платежи — по дню месяца, каждый месяц на всём горизонте
  for(i=0;i<D.pays.length;i++){
    for(var pmo=0; pmo<=Math.ceil(daysAhead/30)+1; pmo++){
      var pDate = new Date(fromDate.getFullYear(), fromDate.getMonth()+pmo, D.pays[i].d);
      if(pDate >= fromDate && (pDate - fromDate)/864e5 <= daysAhead){
        events.push({date:pDate, amt:-D.pays[i].s, n:'Платёж: '+D.pays[i].n});
      }
    }
  }
  
  // Рассрочки — по точной дате
  for(i=0;i<D.insts.length;i++){
    var id = parseD(D.insts[i].d);
    if(id >= fromDate){ events.push({date:id, amt:-D.insts[i].s, n:'Рассрочка: '+D.insts[i].n}); }
  }
  
  // Кредиты — ежемесячный платёж по дню списания
  for(i=0;i<(D.credits||[]).length;i++){
    var crF = D.credits[i];
    if(!(crF.pay > 0)){ continue; }
    for(var cmo=0; cmo<=Math.ceil(daysAhead/30)+1; cmo++){
      var cDate = new Date(fromDate.getFullYear(), fromDate.getMonth()+cmo, crF.d || 1);
      if(cDate >= fromDate && (cDate - fromDate)/864e5 <= daysAhead){
        events.push({date:cDate, amt:-crF.pay, n:'Кредит: '+crF.n});
      }
    }
  }
  
  // Зарплата — по календарю (с учётом выходных)
  for(var mo=0; mo<=Math.ceil(daysAhead/30)+1; mo++){
    var sd = salaryDate(fromDate.getFullYear(), fromDate.getMonth()+mo);
    if(sd >= fromDate){ events.push({date:sd, amt: D.income || 0, n:'Зарплата'}); }
  }
  
  events.sort(function(a,b){ return a.date - b.date; });
  
  // 3. Строим прогноз день за днём
  var flow = [];
  var curBal = realBal();
  var curDate = new Date(fromDate);
  
    for(var day=0; day<=daysAhead; day++){
    // применяем все события этого дня
    for(var ei=0; ei<events.length; ei++){
      if(iso(events[ei].date) === iso(curDate)){
        curBal += events[ei].amt;
      }
    }
    // вычитаем дневной темп гибких трат с поведенческим коэффициентом
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
  
  var res = {flow:flow, flexPerDay:Math.round(flexPerDay), events:events};
  if(useDefault && daysAhead === 90){ _fcCache = res; }
  return res;
}

var FC = null;

function fcShortRub(v){
  var a = Math.abs(v), s = v < 0 ? '−' : '';
  if(a >= 1000){ return s + Math.round(a/1000) + 'к'; }
  return s + Math.round(a);
}

function fcClamp(){
  var total = FC.f.flow.length - 1;
  if(FC.span < 6){ FC.span = 6; }
  if(FC.span > total){ FC.span = total; }
  if(FC.i0 < 0){ FC.i0 = 0; }
  if(FC.i0 + FC.span > total){ FC.i0 = total - FC.span; }
}

// Перерисовка прогноза не чаще кадров монитора (плавно на 120 Гц)
var _fcRaf = null;
function fcSchedule(){
  if(_fcRaf){ return; }
  _fcRaf = requestAnimationFrame(function(){ _fcRaf = null; if(FC){ fcPaint(); } });
}

function fcZoom(dir, anchorIdx){
  if(!FC){ return; }
  var total = FC.f.flow.length - 1;
  if(dir === 'reset'){ FC.i0 = 0; FC.span = total; fcSchedule(); return; }
  var k = dir === 'in' ? 0.6 : 1.7;
  var a = (typeof anchorIdx === 'number') ? anchorIdx : (FC.i0 + FC.span/2);
  var rel = (a - FC.i0) / FC.span;
  FC.span = FC.span * k;
  FC.i0 = a - rel * FC.span;
  fcClamp();
  fcSchedule();
}

function drawForecastChart(f){
  var c = $('forecastChart'); if(!c){ return; }
  FC = {f:f, i0:0, span:f.flow.length - 1, cv:c, plot:{}};
  var drag = null, pinch = null;

  function idxAt(clientX){
    var rect = c.getBoundingClientRect();
    var relX = (clientX - rect.left)/rect.width * FC.plot.W;
    var i = FC.i0 + (relX - FC.plot.PL)/FC.plot.pw * FC.span;
    return Math.max(0, Math.min(FC.f.flow.length-1, Math.round(i)));
  }
  function panBy(dxPx){
    FC.i0 -= dxPx / FC.plot.pw * FC.span;
    fcClamp(); fcSchedule();
  }

  c.addEventListener('wheel', function(ev){
    ev.preventDefault();
    fcZoom(ev.deltaY < 0 ? 'in' : 'out', idxAt(ev.clientX));
  }, {passive:false});

  c.addEventListener('mousedown', function(ev){ drag = {x:ev.clientX, moved:0}; });
  window.addEventListener('mousemove', function(ev){
    if(!FC || FC.cv !== c){ drag = null; return; }
    if(!drag){ return; }
    var dx = ev.clientX - drag.x;
    if(Math.abs(dx) < 1){ return; }
    drag.moved += Math.abs(dx); drag.x = ev.clientX;
    panBy(dx);
  });
  window.addEventListener('mouseup', function(ev){
    if(!FC || FC.cv !== c){ drag = null; return; }
    if(drag && drag.moved < 5){ fcShowDay(idxAt(ev.clientX)); }
    drag = null;
  });

  c.addEventListener('touchstart', function(ev){
    if(ev.touches.length === 2){
      pinch = {d:Math.abs(ev.touches[0].clientX - ev.touches[1].clientX) || 1, span:FC.span,
               a:idxAt((ev.touches[0].clientX + ev.touches[1].clientX)/2)};
      drag = null;
    } else if(ev.touches.length === 1){
      drag = {x:ev.touches[0].clientX, y:ev.touches[0].clientY, moved:0, t:Date.now()};
      pinch = null;
    }
  }, {passive:true});

  c.addEventListener('touchmove', function(ev){
    if(pinch && ev.touches.length === 2){
      ev.preventDefault();
      var nd = Math.abs(ev.touches[0].clientX - ev.touches[1].clientX) || 1;
      var rel = (pinch.a - FC.i0)/FC.span;
      FC.span = pinch.span * (pinch.d / nd);
      FC.i0 = pinch.a - rel * FC.span;
      fcClamp(); fcSchedule();
      return;
    }
    if(drag && ev.touches.length === 1){
      var dx = ev.touches[0].clientX - drag.x;
      var dy = ev.touches[0].clientY - drag.y;
      if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 3){
        ev.preventDefault();
        drag.moved += Math.abs(dx);
        drag.x = ev.touches[0].clientX; drag.y = ev.touches[0].clientY;
        panBy(dx);
      }
    }
  }, {passive:false});

  c.addEventListener('touchend', function(ev){
    if(drag && drag.moved < 6 && (Date.now() - drag.t) < 500){
      var t = ev.changedTouches[0];
      fcShowDay(idxAt(t.clientX));
    }
    drag = null; pinch = null;
  }, {passive:true});

  fcPaint();
}

function fcPaint(){
  if(!FC){ return; }
  var f = FC.f, c = FC.cv;
  var W = c.clientWidth || 300, H = 230;
  c.width = W*2; c.height = H*2;
  c.style.height = H+'px';
  var ctx = c.getContext('2d');
  ctx.setTransform(2,0,0,2,0,0);
  ctx.clearRect(0,0,W,H);
  var PL = 46, PR = 10, PT = 22, PB = 30;
  var pw = W - PL - PR, ph = H - PT - PB;
  FC.plot = {W:W, PL:PL, pw:pw};

  var lo = Math.max(0, Math.floor(FC.i0)), hi = Math.min(f.flow.length-1, Math.ceil(FC.i0 + FC.span));
  var rawMn = Infinity, rawMx = -Infinity;
  for(var i=lo;i<=hi;i++){
    var b = f.flow[i].balance;
    if(b < rawMn){ rawMn = b; } if(b > rawMx){ rawMx = b; }
  }
  var mn = Math.min(0, rawMn), mx = Math.max(0, rawMx);
  var pad = (mx - mn) * 0.12 || 1000;
  mn -= pad; mx += pad;
  var rng = (mx - mn) || 1;
  function Y(v){ return PT + (1 - (v - mn)/rng) * ph; }
  function X(i){ return PL + (i - FC.i0)/FC.span * pw; }

  ctx.save();
  ctx.beginPath(); ctx.rect(PL, PT-14, pw, ph+14); ctx.clip();

  if(rawMn < 0){
    ctx.fillStyle = 'rgba(255,69,58,.09)';
    ctx.fillRect(PL, Y(0), pw, (H - PB) - Y(0));
  }
  ctx.restore();

  // сетка сумм
  var step = Math.pow(10, Math.floor(Math.log(rng/3.2)/Math.LN10));
  while(rng/step > 5){ step *= 2; }
  while(rng/step < 2.5){ step /= 2; }
  ctx.font = '600 9px Manrope'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for(var gv = Math.ceil(mn/step)*step; gv <= mx; gv += step){
    var gy = Y(gv);
    if(gy < PT - 2 || gy > H - PB + 2){ continue; }
    var isZero = Math.abs(gv) < step/100;
    ctx.strokeStyle = isZero ? 'rgba(255,69,58,.55)' : 'rgba(255,255,255,.07)';
    ctx.lineWidth = isZero ? 1.5 : 1;
    ctx.setLineDash(isZero ? [] : [2,4]);
    ctx.beginPath(); ctx.moveTo(PL, gy); ctx.lineTo(W - PR, gy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isZero ? 'rgba(255,105,97,.95)' : 'rgba(255,255,255,.38)';
    ctx.fillText(isZero ? '0' : fcShortRub(gv), PL - 6, gy);
  }

  ctx.save();
  ctx.beginPath(); ctx.rect(PL, PT-14, pw, ph+16); ctx.clip();

  // заливка
  var zeroY = Math.min(H - PB, Math.max(PT, Y(0)));
  var grad = ctx.createLinearGradient(0, PT, 0, H - PB);
  grad.addColorStop(0, 'rgba(100,210,255,.28)');
  grad.addColorStop(1, 'rgba(100,210,255,.02)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.moveTo(X(lo), zeroY);
  for(i=lo;i<=hi;i++){ ctx.lineTo(X(i), Y(f.flow[i].balance)); }
  ctx.lineTo(X(hi), zeroY); ctx.closePath(); ctx.fill();

  // даты
  var stepD = Math.max(1, Math.round(FC.span/6));
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for(var xi=lo; xi<=hi; xi++){
    if((xi - lo) % stepD !== 0){ continue; }
    var dt = f.flow[xi].date;
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(xi), PT); ctx.lineTo(X(xi), H - PB); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.font = '600 9px Manrope';
    ctx.fillText(xi === 0 ? 'сегодня' : dt.getDate()+'.'+String(dt.getMonth()+1).padStart(2,'0'), X(xi), H - PB + 8);
  }

  // линия
  ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
  for(var s=lo;s<hi;s++){
    var v1 = f.flow[s].balance, v2 = f.flow[s+1].balance;
    ctx.strokeStyle = (v1 < 0 || v2 < 0) ? '#ff453a' : '#64d2ff';
    ctx.beginPath(); ctx.moveTo(X(s), Y(v1)); ctx.lineTo(X(s+1), Y(v2)); ctx.stroke();
  }

  // события
  var labelled = [];
  var bigLimit = FC.span > 45 ? 10000 : 3000;
  for(var e=0;e<f.events.length;e++){
    var dayIdx = Math.round((f.events[e].date - f.flow[0].date)/864e5);
    if(dayIdx < lo || dayIdx > hi){ continue; }
    var amt = f.events[e].amt;
    if(Math.abs(amt) < bigLimit){ continue; }
    var ex = X(dayIdx), ey = Y(f.flow[dayIdx].balance);
    ctx.fillStyle = amt > 0 ? '#30d158' : '#ff9f0a';
    ctx.beginPath();
    if(amt > 0){ ctx.moveTo(ex, ey-9); ctx.lineTo(ex-4, ey-3); ctx.lineTo(ex+4, ey-3); }
    else { ctx.moveTo(ex, ey+9); ctx.lineTo(ex-4, ey+3); ctx.lineTo(ex+4, ey+3); }
    ctx.closePath(); ctx.fill();
    var tag = amt > 0 ? 'ЗП' : (FC.span <= 45 ? f.events[e].n.split(':')[1] : '');
    if(tag){ tag = tag.trim(); }
    if(!tag){ continue; }
    var free = true;
    for(var l=0;l<labelled.length;l++){ if(Math.abs(labelled[l] - ex) < 40){ free = false; break; } }
    if(!free){ continue; }
    labelled.push(ex);
    ctx.font = '700 9px Manrope'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = amt > 0 ? '#30d158' : '#ff9f0a';
    ctx.fillText(tag, ex, amt > 0 ? Math.max(PT+9, ey-11) : Math.min(H-PB-2, ey+22));
  }

  // «сейчас»
  if(lo === 0){
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(X(0), Y(f.flow[0].balance), 3.5, 0, 6.28); ctx.fill();
    ctx.font = '700 9px Manrope'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillText('сейчас ' + fcShortRub(f.flow[0].balance), X(0) + 6, Math.max(PT + 8, Y(f.flow[0].balance) - 7));
  }

  // дно видимого участка
  var minI = lo;
  for(var m2=lo;m2<=hi;m2++){ if(f.flow[m2].balance < f.flow[minI].balance){ minI = m2; } }
  var mVal = f.flow[minI].balance, mX = X(minI), mY = Y(mVal);
  ctx.strokeStyle = mVal < 0 ? '#ff453a' : '#30d158';
  ctx.lineWidth = 1; ctx.setLineDash([2,3]);
  ctx.beginPath(); ctx.moveTo(mX, mY); ctx.lineTo(mX, H - PB); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = mVal < 0 ? '#ff453a' : '#30d158';
  ctx.beginPath(); ctx.arc(mX, mY, 5, 0, 6.28); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  var mDt = f.flow[minI].date;
  var mTxt = 'дно ' + fmt(mVal) + ' · ' + mDt.getDate() + '.' + String(mDt.getMonth()+1).padStart(2,'0');
  ctx.font = '700 10px Manrope'; ctx.textBaseline = 'middle';
  var tw = ctx.measureText(mTxt).width + 10;
  var bx = Math.max(PL + 2, Math.min(W - PR - tw, mX - tw/2));
  var by = Math.max(PT - 12, mY - 20);
  ctx.fillStyle = 'rgba(20,22,28,.92)';
  ctx.beginPath(); ctx.rect(bx, by - 8, tw, 17); ctx.fill();
  ctx.strokeStyle = mVal < 0 ? 'rgba(255,69,58,.7)' : 'rgba(48,209,88,.7)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = mVal < 0 ? '#ff8a80' : '#7ee2a0';
  ctx.textAlign = 'left'; ctx.fillText(mTxt, bx + 5, by + 1);
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

  var rEl = $('fcRange');
  if(rEl){
    var d1 = f.flow[lo].date, d2 = f.flow[hi].date;
    rEl.textContent = 'видно ' + d1.getDate()+'.'+String(d1.getMonth()+1).padStart(2,'0')
      + ' — ' + d2.getDate()+'.'+String(d2.getMonth()+1).padStart(2,'0')
      + ' · ' + (hi - lo + 1) + ' дн';
  }
}

// Карточка дня: что это, как получилось, что делать
function fcShowDay(idx){
  var el = $('fcInfo'); if(!el || !FC){ return; }
  var f = FC.f, pt = f.flow[idx], d = pt.date, bal = pt.balance;
  var mName = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  var wName = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  var h = '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">'
    + '<b style="font-size:14px">' + d.getDate() + ' ' + mName[d.getMonth()] + ', ' + wName[d.getDay()] + '</b>'
    + '<span style="font-size:11px;color:var(--mut)">' + (idx === 0 ? 'сегодня' : 'через ' + idx + ' дн') + '</span></div>';
  h += '<div style="font-size:13px;margin-bottom:8px">На счету останется <b style="color:'
    + (bal < 0 ? 'var(--red)' : (bal < f.flexPerDay*7 ? 'var(--org)' : 'var(--grn)')) + '">' + fmt(bal) + '</b></div>';

  // события дня
  if(pt.events.length){
    h += '<div style="font-size:12px;color:var(--mut);margin-bottom:3px">В этот день:</div>';
    for(var e=0;e<pt.events.length;e++){
      var ev = pt.events[e];
      h += '<div style="font-size:12px;display:flex;justify-content:space-between;padding:2px 0">'
        + '<span>' + ev.n + '</span><b style="color:' + (ev.amt > 0 ? 'var(--grn)' : 'var(--org)') + '">'
        + (ev.amt > 0 ? '+' : '−') + fmt(Math.abs(ev.amt)) + '</b></div>';
    }
  } else {
    h += '<div style="font-size:12px;color:var(--mut)">Платежей в этот день нет — только повседневные траты.</div>';
  }

  // как получилась цифра
  var prevBal = idx > 0 ? f.flow[idx-1].balance : bal;
  var inSum = 0, outSum = 0;
  for(var j=0;j<=idx;j++){
    for(var k=0;k<f.flow[j].events.length;k++){
      var a = f.flow[j].events[k].amt;
      if(a > 0){ inSum += a; } else { outSum += -a; }
    }
  }
  var flexTotal = Math.round(f.flexPerDay * idx);
  h += '<div style="font-size:12px;color:var(--mut);margin:8px 0 3px">Как получилась эта цифра:</div>'
    + '<div style="font-size:12px;line-height:1.6">'
    + 'сейчас ' + fmt(f.flow[0].balance)
    + (inSum ? '<br>плюс поступления за ' + idx + ' дн: <span style="color:var(--grn)">+' + fmt(inSum) + '</span>' : '')
    + (outSum ? '<br>минус платежи за ' + idx + ' дн: <span style="color:var(--org)">−' + fmt(outSum) + '</span>' : '')
    + (flexTotal ? '<br>минус повседневные траты (' + fmt(f.flexPerDay) + '/день × ' + idx + '): <span style="color:var(--org)">−' + fmt(flexTotal) + '</span>' : '')
    + '<br><b>итого ' + fmt(bal) + '</b></div>';

  // совет
  var advice = '', acol = 'var(--grn)';
  var minAhead = bal, minIdx = idx;
  for(var q=idx;q<f.flow.length;q++){ if(f.flow[q].balance < minAhead){ minAhead = f.flow[q].balance; minIdx = q; } }
  var mDt2 = f.flow[minIdx].date;
  var mDtS = mDt2.getDate() + '.' + String(mDt2.getMonth()+1).padStart(2,'0');
  if(bal < 0){
    acol = 'var(--red)';
    var need = -bal;
    var cutPerDay = Math.ceil(need/Math.max(1, idx));
    advice = 'Это провал: в этот день не хватит ' + fmt(need) + '. Чтобы дожить до него в плюсе, урезай повседневные траты на '
      + fmt(cutPerDay) + '/день начиная с сегодня — темп станет ' + fmt(Math.max(0, f.flexPerDay - cutPerDay)) + '/день вместо ' + fmt(f.flexPerDay) + '. '
      + 'Альтернатива — перенести крупный платёж этого периода на после зарплаты или закрыть разрыв подработкой на ' + fmt(need) + '.';
  } else if(minAhead < 0){
    acol = 'var(--red)';
    var need2 = -minAhead;
    var cut2 = Math.ceil(need2/Math.max(1, minIdx));
    advice = 'Сегодня запас есть, но дальше провал: ' + mDtS + ' баланс уйдёт в минус на ' + fmt(need2)
      + '. Чтобы этого не случилось, начиная с сегодня трать на ' + fmt(cut2) + '/день меньше (темп '
      + fmt(Math.max(0, f.flexPerDay - cut2)) + '/день вместо ' + fmt(f.flexPerDay) + '), либо отложи ' + fmt(need2) + ' прямо сейчас и не трогай.';
  } else if(bal < f.flexPerDay * 7){
    acol = 'var(--org)';
    advice = 'Впритык: остатка хватит примерно на ' + Math.floor(bal/Math.max(1, f.flexPerDay))
      + ' дн жизни текущим темпом. Крупные покупки до этой даты лучше отложить, а в резерве держать хотя бы '
      + fmt(Math.round(f.flexPerDay*14)) + ' — это две недели трат.';
  } else {
    var safe = Math.max(0, minAhead - Math.round(f.flexPerDay*7));
    advice = 'Запас нормальный. Самая низкая точка впереди — ' + fmt(minAhead) + ' (' + mDtS + '), так что сверх плана без риска можно потратить до '
      + fmt(safe) + ', оставив неделю трат в резерве.';
  }
  h += '<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.04);border-left:3px solid '
    + acol + ';font-size:12px;line-height:1.5">' + advice + '</div>';
  el.innerHTML = h;
}

function explainForecast(f){
var el = $('fcExplain'); if(!el){ return; }
var now = new Date();
var salary = 0, salaryStr = '—', paysSum = 0, paysN = 0, instSum = 0, instN = 0, subsSum = 0;
for(var e=0;e<f.events.length;e++){
var ev = f.events[e];
var dd = Math.round((ev.date - now)/864e5);
if(dd < 0 || dd > 30){ continue; }
if(ev.n.indexOf('Зарплата')===0){ salary += ev.amt; salaryStr = ev.date.getDate()+'.'+String(ev.date.getMonth()+1).padStart(2,'0'); }
else if(ev.n.indexOf('Платёж:')===0){ paysSum += -ev.amt; paysN++; }
else if(ev.n.indexOf('Кредит:')===0){ paysSum += -ev.amt; paysN++; }
else if(ev.n.indexOf('Рассрочка:')===0){ instSum += -ev.amt; instN++; }
else if(ev.n.indexOf('Подписка:')===0){ subsSum += -ev.amt; }
}
var flex30 = Math.round(f.flexPerDay * 30);
var b30 = 0, min30v = Infinity, min30d = null;
for(var j=0;j<f.flow.length;j++){
var ddn = Math.round((f.flow[j].date - now)/864e5);
if(ddn === 30){ b30 = f.flow[j].balance; }
if(ddn <= 30 && f.flow[j].balance < min30v){ min30v = f.flow[j].balance; min30d = f.flow[j].date; }
}
var h = '';
h += '<div class="dig-item"><span>Зарплата '+salaryStr+'</span><b class="pos">+'+fmt(salary)+'</b></div>';
h += '<div class="dig-item"><span>Обязательные платежи ('+paysN+'): аренда, симки и т.д.</span><b>−'+fmt(paysSum)+'</b></div>';
if(instN){ h += '<div class="dig-item"><span>Рассрочки ('+instN+')</span><b>−'+fmt(instSum)+'</b></div>'; }
if(subsSum>0){ h += '<div class="dig-item"><span>Подписки за месяц</span><b>−'+fmt(subsSum)+'</b></div>'; }
h += '<div class="dig-item"><span>Повседневные траты темпом '+fmt(f.flexPerDay)+'/день</span><b>−'+fmt(flex30)+'</b></div>';
h += '<div class="dig-item"><span>Баланс через 30 дней</span><b style="color:'+(b30>=0?'var(--grn)':'var(--red)')+'">'+fmt(b30)+'</b></div>';
h += '<div class="dig-item"><span>Минимум за 30 дней</span><b style="color:'+(min30v<0?'var(--red)':'var(--grn)')+'">'+fmt(min30v)+' · '+min30d.getDate()+'.'+String(min30d.getMonth()+1).padStart(2,'0')+'</b></div>';
var verdict, vcol;
if(min30v < 0){
vcol = 'var(--red)';
verdict = 'Тревога: деньги закончатся примерно '+min30d.getDate()+'.'+String(min30d.getMonth()+1).padStart(2,'0')+'. Чтобы остаться в плюсе, урежь повседневные траты на '+fmt(Math.ceil(-min30v/30))+'/день или сдвинь покупку.';
} else if(min30v < f.flexPerDay*7){
vcol = 'var(--org)';
verdict = 'Впритык: запас в самой низкой точке — '+fmt(min30v)+', это меньше недели трат. Крупные покупки сейчас лучше не планировать.';
} else {
vcol = 'var(--grn)';
verdict = 'Спокойно: в самой низкой точке останется '+fmt(min30v)+'. Покупки в пределах этого запаса безопасны.';
}
h += '<div class="sh-tip" style="margin-top:8px;border-left:3px solid '+vcol+'">'+verdict+'</div>';
el.innerHTML = h;
}

// Сколько дней денег хватит до нуля
function cashRunway(){
  var f = forecastCashFlow(90);
  for(var i=0;i<f.flow.length;i++){
    if(f.flow[i].balance < 0){ return i; }
  }
  return 90;
}

// Минимальный баланс за N дней и дата минимума
function minBalance(days){
  var f = forecastCashFlow(days);
  var min = Infinity, minDate = null;
  for(var i=0;i<f.flow.length;i++){
    if(f.flow[i].balance < min){ min = f.flow[i].balance; minDate = f.flow[i].date; }
  }
  return {val:min, date:minDate, daysFromNow: Math.round((minDate - new Date())/864e5)};
}

// Могу ли купить X? Честный ответ с расчётом
function canAfford(amount){
  var f = forecastCashFlow(30);
  var daily = calcDailyLimit();
  var safe = calcSafeBalance();
  var pay3 = nextPay(3);
  var free = Math.max(0, safe - pay3);
  
  // Смотрим минимальный баланс после покупки
  var minAfter = minBalance(30);
  var postMin = minAfter.val - amount;
  
  if(amount <= daily.perDay && postMin >= 0){
    return {verdict:'yes', txt:'Можно: вписывается в дневной лимит, после покупки минимальный баланс будет '+fmt(postMin)+' ₽.', color:'var(--grn)'};
  } else if(postMin >= -5000){
    return {verdict:'warn', txt:'Можно, но осторожно: после покупки минимум будет '+fmt(postMin)+' ₽. Срежь гибкие траты на пару дней.', color:'var(--org)'};
  } else {
    return {verdict:'no', txt:'Не советую: минимум уйдёт в '+fmt(postMin)+' ₽. Лучше подождать или найти дешевле.', color:'var(--red)'};
  }
}

// План выхода из долгов — снежный ком или лавина
function debtSnowball(){
  var debts = [];
  for(var i=0;i<D.credits.length;i++){
    if(D.credits[i].cur > 0){ debts.push({n:D.credits[i].n, cur:D.credits[i].cur, total:D.credits[i].total}); }
  }
  if(!debts.length){ return null; }
  
  var totalDebt = 0;
  for(var j=0;j<debts.length;j++){ totalDebt += debts[j].cur; }
  
  // Сколько можем платить в месяц сверх обязательных
    var lifeMin = typeof D.lifeMin === 'number' ? D.lifeMin : 50000;
  var monthlyExtra = Math.max(0, (D.income||0) - calcMonthlyFixedPay() - lifeMin); // минимум на жизнь (D.lifeMin)
  
  if(monthlyExtra <= 0){
    return {txt:'Обязательные платежи съедают весь доход. Сначала урежь гибкие траты (кафе, самокаты).', debts:debts};
  }
  
  // Сортируем по размеру — снежный ком
  debts.sort(function(a,b){ return a.cur - b.cur; });
  var months = Math.ceil(totalDebt / monthlyExtra);
  
  return {
    txt: 'При платеже '+fmt(monthlyExtra)+'/мес закроешь все долги за '+months+' мес. Начни с "'+debts[0].n+'" ('+fmt(debts[0].cur)+') — это даст психологическую победу.',
    first: debts[0],
    total: totalDebt,
    months: months,
    monthlyExtra: monthlyExtra
  };
}

// Вычисляет «минимум на жизнь»: базовые траты (продукты, транспорт, здоровье)
// за последние 3 цикла + 10% запаса. Обязательные платежи считаются отдельно
// (calcMonthlyFixedPay) и в эту цифру НЕ входят — иначе план долгов задваивает.
// Ручное значение пользователя имеет приоритет (D.lifeMinManual).
function calcLifeMin() {
    if (!D) return 50000;
    if(D.lifeMinManual && typeof D.lifeMin === 'number' && D.lifeMin > 0){ return D.lifeMin; }
    var now = new Date();
    var base = 0, cycles = 0;
    for(var c=1;c<=3;c++){
      var cs = shiftCycle(cycleStart(now), -c);
      var ce = cycleEnd(cs);
      var list = allSpends().filter(function(x){ return x.d >= cs && x.d < ce; });
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

// Движок сигналов — 10 типов, каждый даёт ₽/мес выгоды
// Аудит подписок по факту: сравнение заявленной цены с реальными списаниями
function subAudit(){
  var out = [];
  var all = allSpends();
  var now = new Date();
  for(var i=0;i<(D.subs||[]).length;i++){
    var s = D.subs[i];
    if(s.off){ continue; }
    var key = merchName(s.n).toLowerCase();
    var lastAmt = 0, lastDate = null;
    for(var j=0;j<all.length;j++){
      var nm = String(all[j].n||'').toLowerCase();
      if(!key || (nm.indexOf(key) === -1 && key.indexOf(nm) === -1)){ continue; }
      if(all[j].s <= 0){ continue; }
      if(!lastDate || all[j].d > lastDate){ lastDate = all[j].d; lastAmt = all[j].s; }
    }
    var daysSince = lastDate ? Math.round((now - lastDate)/864e5) : 999;
    out.push({
      sub:s,
      found: !!lastDate && daysSince <= 95,
      daysSince: daysSince,
      lastAmt: lastAmt,
      rose: !!lastDate && lastAmt > s.s * 1.05 && daysSince <= 45,
      dead: !lastDate || daysSince > 95
    });
  }
  return out;
}

function getSignals(){
  var signals = [];
  var now = new Date();
  var allSp = allSpends();

  // Вспомогательная функция: сколько дней до ближайшего критического события
  function daysToDeadline() {
    var now = new Date();
    var minDays = 999;
    // Проверяем платежи
    for(var i=0;i<D.pays.length;i++){
      var payDay = D.pays[i].d;
      var nextDate = new Date(now.getFullYear(), now.getMonth(), payDay);
      if(nextDate < now){ nextDate.setMonth(nextDate.getMonth() + 1); }
      var diff = Math.round((nextDate - now) / 864e5);
      if(diff < minDays && diff >= 0) minDays = diff;
    }
    // Проверяем рассрочки
    for(var j=0;j<D.insts.length;j++){
      var instDate = parseD(D.insts[j].d);
      var diff2 = Math.round((instDate - now) / 864e5);
      if(diff2 < minDays && diff2 >= 0) minDays = diff2;
    }
    return minDays === 999 ? 30 : minDays;
  }
  var daysToCritical = daysToDeadline();
  var suReadySig = setupState().ready;
  function prio(sev, benefit){ return (sev * 2) + ((benefit||0) / 1000) + (1 / (daysToCritical + 1)); }
  function isPlanned(x){ return x.tag === 'planned'; }
  
    // 1. Runway отрицательный
  var rw = cashRunway();
  var payday = calcDailyLimit().daysLeft;
  if(rw < payday){
    signals.push({
      sev: 9,
      title: 'Через '+rw+' дн. денег не хватит',
      desc: 'Зарплата только через '+payday+' дн. Нужно срочно урезать гибкие траты.',
      benefit: 0,
      priority: prio(9, 0),
      act: {t:'daily'}
    });
  }
  
    // 2. Подписки годовой стоимостью
  var subsAnnual = 0;
  for(var i=0;i<D.subs.length;i++){ if(!D.subs[i].off){ subsAnnual += D.subs[i].s * 12; } }
  if(subsAnnual > 5000){
    var benefit = Math.round(subsAnnual * 0.3 / 12);
    signals.push({
      sev: 5,
      title: 'Подписки = '+fmt(subsAnnual)+' в год',
      desc: 'Пересмотри автоплатежи — часть можно отключить.',
      benefit: benefit,
      priority: prio(5, benefit),
      act: {t:'fixed'}
    });
  }
  
   // 2b. Аудит подписок по факту: подорожание или мёртвая подписка
  var aud = subAudit();
  var roseSubs = [], deadSubs = [];
  for(var ia=0;ia<aud.length;ia++){
    if(aud[ia].rose){ roseSubs.push(aud[ia]); }
    if(aud[ia].dead){ deadSubs.push(aud[ia]); }
  }
  if(roseSubs.length){
    var r0 = roseSubs[0];
    var rBenefit = Math.max(1, Math.round((r0.lastAmt - r0.sub.s)));
    signals.push({
      sev: 6,
      title: '«'+r0.sub.n+'» подорожала: '+fmt(r0.sub.s)+' → '+fmt(r0.lastAmt),
      desc: (roseSubs.length > 1 ? 'И ещё '+(roseSubs.length-1)+' подписок выросли в цене. ' : '') + 'Проверь, нужна ли она всё ещё.',
      benefit: rBenefit,
      priority: prio(6, rBenefit),
      act: {act:'nav', p:'budget'}
    });
  }
  if(deadSubs.length){
    var dB = 0;
    for(var idd=0;idd<deadSubs.length;idd++){ dB += deadSubs[idd].sub.s; }
    signals.push({
      sev: 3,
      title: deadSubs.length+' подписк(а/и) без списаний',
      desc: '«'+deadSubs[0].sub.n+'» — списаний нет 90+ дней. Похоже, вы уже не платите — отключите и уберите из бюджета.',
      benefit: Math.round(dB),
      priority: prio(3, dB),
      act: {act:'nav', p:'budget'}
    });
  }

  // 3. Долги > 50% дохода
  var debtTotal = 0;
  for(var d=0;d<D.credits.length;d++){ debtTotal += D.credits[d].cur || 0; }
  if(debtTotal > (D.income||0) * 0.5){
    var plan = debtSnowball();
    signals.push({
      sev: 8,
      title: 'Долги = '+Math.round(debtTotal/Math.max(1,D.income||1)*100)+'% дохода',
      desc: plan ? plan.txt : 'Начни гасить с самого маленького.',
      benefit: 0,
      priority: prio(8, 0),
      act: {t:'fixed'}
    });
  }
  
  // 4. Перерасход в конвертах
  var actLeak = activeLeaks();
  if(actLeak.length){
    var leakSum = 0;
    for(var l=0;l<actLeak.length;l++){ leakSum += actLeak[l].over; }
    var lBenefit = Math.round(leakSum * 0.4);
    signals.push({
      sev: 7,
      title: actLeak.length+' конверт(а) в перерасходе',
      desc: 'Перерасход '+fmt(leakSum)+' за цикл. Сократи: '+actLeak[0].n+'.',
      benefit: lBenefit,
      priority: prio(7, lBenefit),
      act: {t:'leaks'}
    });
  }
  
  // 5. Гибкие траты > 20% дохода
  var mNow = cycleStart(now);
  var flexSpend = 0;
  for(var i2=0;i2<allSp.length;i2++){
    if(allSp[i2].d < mNow){ continue; }
    if(isPlanned(allSp[i2])){ continue; }
    var c = allSp[i2].cat || 'other';
    if(c!=='home' && c!=='subs' && c!=='transport' && c!=='grocery'){ flexSpend += allSp[i2].s; }
  }
  var flexPct = (D.income||0) > 0 ? flexSpend / (D.income||1) : 0;
  if(flexPct > 0.2){
    var over = flexSpend - (D.income||0)*0.2;
    var fBenefit = Math.round(over * 0.5);
    signals.push({
      sev: 6,
      title: 'Гибкие траты = '+Math.round(flexPct*100)+'% дохода',
      desc: 'Норма — до 20%. Сверх нормы: '+fmt(over)+'. Это кафе, такси, самокаты.',
      benefit: fBenefit,
      priority: prio(6, fBenefit),
      act: {t:'leaks'}
    });
  }
  
  // 6. Неразобранное «Прочее»
  var otherN = 0;
  for(var i3=0;i3<allSp.length;i3++){
    if(allSp[i3].d >= mNow && (allSp[i3].cat||'other')==='other'){ otherN++; }
  }
  if(otherN > 3){
    signals.push({
      sev: 4,
      title: otherN+' операций в «Прочее»',
      desc: 'Разбери их — статистика станет точнее.',
      benefit: 0,
      priority: prio(4, 0),
      act: {act:'other-bulk'}
    });
  }
  
  // 7. Кэшбэк без цели
  var cashSum = 0;
  for(var i4=0;i4<(D.incomes||[]).length;i4++){
    var xd = parseD(D.incomes[i4].d);
    if(xd >= mNow && incomeKind(D.incomes[i4])==='cash'){ cashSum += D.incomes[i4].s; }
  }
  if(cashSum > 500){
    signals.push({
      sev: 3,
      title: 'Кэшбэк '+fmt(cashSum)+' без цели',
      desc: 'Закинь в копилку — пусть работает на подушку или отпуск.',
      benefit: Math.round(cashSum),
      priority: prio(3, cashSum),
      act: {act:'cashback-add'}
    });
  }
  
  // 8. Нет прогресса в подушке
  var cush = null;
  for(var ig=0;ig<(D.goals||[]).length;ig++){ if(/подушк/i.test(D.goals[ig].n)){ cush = D.goals[ig]; break; } }
  if(cush && !cush.done && (cush.cur||0) < cush.target * 0.1){
    signals.push({
      sev: 7,
      title: 'Подушка = '+Math.round((cush.cur||0)/cush.target*100)+'% от цели',
      desc: 'Нужно 3-6 месяцев расходов. Авто-перевод 10% от зарплаты поможет.',
      benefit: 0,
      priority: prio(7, 0),
      act: {t:'goals'}
    });
  }
  
  // 9. Крупный платёж в ближайшие 3 дня
  var pay3 = nextPay(3);
  if(pay3 > (D.income||0) * 0.3){
    signals.push({
      sev: 5,
      title: 'Через 3 дня платёж '+fmt(pay3),
      desc: 'Это '+Math.round(pay3/Math.max(1,D.income||1)*100)+'% зарплаты. Убедись, что деньги в резерве.',
      benefit: 0,
      priority: prio(5, 0),
      act: {t:'upcoming-detail'}
    });
  }
  
  // 10. Сдача не закинута в копилку
  var roundSum = 0;
  for(var i5=0;i5<allSp.length;i5++){
    if(allSp[i5].d >= mNow){ roundSum += Math.ceil(allSp[i5].s/10)*10 - allSp[i5].s; }
  }
  if(Math.round(roundSum) > 300){
    signals.push({
      sev: 2,
      title: 'Сдача '+fmt(Math.round(roundSum))+' ждёт копилки',
      desc: 'Округления трат накопились. Закинь в цель одним тапом.',
      benefit: Math.round(roundSum),
      priority: prio(2, roundSum),
      act: {act:'round-add'}
    });
  }
  
  // 11. Пост-зарплатный всплеск (привязан к началу цикла, а не к календарю)
var cycStart11 = cycleStart(now);
var daysSince = Math.max(1, Math.round((now - cycStart11)/864e5));
var f3sum = 0, rsum = 0;
for(var i6=0;i6<allSp.length;i6++){
if(allSp[i6].d < cycStart11 || isPlanned(allSp[i6])){ continue; }
var dn = Math.round((allSp[i6].d - cycStart11)/864e5);
if(dn < 3){ f3sum += allSp[i6].s; } else { rsum += allSp[i6].s; }
}
var f3per = f3sum / Math.min(3, daysSince);
var rper = rsum / Math.max(1, daysSince - Math.min(3, daysSince));
if(daysSince > 4 && f3sum > 0 && f3per > rper * 1.5){
signals.push({
sev: 4,
title: 'Пост-зарплатный всплеск',
desc: 'Первые дни после зарплаты: '+fmt(Math.round(f3per))+'/день, дальше — '+fmt(Math.round(rper))+'/день. Придержи треть всплеска.',
benefit: Math.round((f3per - rper) * 3),
priority: prio(4, (f3per - rper) * 3),
act: {t:'daily'}
});
}
// 12. Дорогой день недели (окно 60 дней)
var wFrom12 = new Date(now.getTime() - 60*864e5);
var wdSum = [0,0,0,0,0,0,0];
for(var i7=0;i7<allSp.length;i7++){ if(allSp[i7].d >= wFrom12 && !isPlanned(allSp[i7])){ wdSum[allSp[i7].d.getDay()] += allSp[i7].s; } }
var maxW = 0, avgW = 0;
for(var i8=0;i8<7;i8++){ avgW += wdSum[i8]; if(wdSum[i8] > wdSum[maxW]){ maxW = i8; } }
avgW = avgW / 7;
var WD_NAMES = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
if(wdSum[maxW] > avgW * 1.6 && wdSum[maxW] > 0){
var wdBenefit = Math.round((wdSum[maxW] - avgW) * 0.3);
signals.push({
sev: 3,
title: 'Дорогой день: '+WD_NAMES[maxW],
desc: 'По '+WD_NAMES[maxW]+' уходит '+fmt(Math.round(wdSum[maxW]))+' за 60 дней. Крупное планируй на другие дни.',
benefit: wdBenefit,
priority: prio(3, wdBenefit),
act: {act:'an-habit', h:'wd'}
});
}

// 13. Созревшие желания (правило 24 часов)
var ripeN = 0;
for(var i9=0;i9<(D.wishes||[]).length;i9++){
if(D.wishes[i9].st === 'wait' && (Date.now() - new Date(D.wishes[i9].d).getTime()) >= 24*36e5){ ripeN++; }
}
if(ripeN > 0){
signals.push({
sev: 4,
title: 'Желания дозрели: '+ripeN,
desc: 'Прошли сутки. Проверь «Могу купить?» — и реши холодной головой.',
benefit: 0,
priority: prio(4, 0),
act: {act:'canbuy'}
});
}

// 14. Баланс давно не сверялся — прогноз начинает врать
var balAge = D.lastBalCheck ? Math.round((Date.now() - D.lastBalCheck)/864e5) : -1;
if(suReadySig && balAge >= 45){
signals.push({
sev: 5,
title: 'Баланс не сверялся '+balAge+' дн.',
desc: 'Прогноз считается от последнего введённого остатка. Обнови его — карточка «Реальный остаток» на панели.',
benefit: 0,
priority: prio(5, 0),
act: {t:'balance'}
});
}

// 15. Резервная копия данных старше 60 дней
var bkAge = D.lastBackup ? Math.round((Date.now() - D.lastBackup)/864e5) : -1;
if(suReadySig && bkAge >= 60){
signals.push({
sev: 3,
title: 'Копии данных нет '+bkAge+' дн.',
desc: 'Скачай свежую копию в Настройках — это страховка от потери всей истории.',
benefit: 0,
priority: prio(3, 0),
act: {act:'nav', p:'settings'}
});
}

  
// Сортируем по приоритету (чем выше, тем важнее)
signals.sort(function(a,b){ return (b.priority||0) - (a.priority||0); });
return signals.slice(0, 5);
}

// What-if симулятор (не мутирует кэш прогноза)
function whatIf(perMonth){
  var f2 = forecastCashFlow(90);
  var perDay = perMonth / 30;
  var newMin = Infinity;
  for(var j=0;j<f2.flow.length;j++){
    var vAdj = f2.flow[j].balance + Math.round(perDay * j);
    if(vAdj < newMin){ newMin = vAdj; }
  }
  var orig = minBalance(90);
  return {originalMin: orig.val, newMin: newMin, diff: newMin - orig.val};
}

// Парсер намерений для копилота
function agentParse(query){
  var q = query.toLowerCase();
  var numMatch = q.match(/(\d[\d\s]*)/);
  var amount = numMatch ? parseInt(numMatch[1].replace(/\s/g,'')) : 0;
  
  if(/куп|можн|потяну|afford|хват/i.test(q) && amount > 0){
    var r = canAfford(amount);
    return {type:'afford', data:{amount:amount, verdict:r.verdict, txt:r.txt, color:r.color}};
  }
  if(/долг|кредит|рассроч|закрыть/i.test(q)){
    return {type:'debt', data:debtSnowball()};
  }
  if(/утеч|перерасход|лимит/i.test(q)){
    var leaks = activeLeaks();
    return {type:'leaks', data:{leaks:leaks, total: leaks.reduce(function(s,l){return s+l.over;},0)}};
  }
  if(/подпис/i.test(q)){
    var subs = D.subs.filter(function(s){ return !s.off; });
    var total = 0; for(var i=0;i<subs.length;i++){ total += subs[i].s; }
    return {type:'subs', data:{subs:subs, monthly:total, annual:total*12}};
  }
  if(/зарплат|зп|до зп|payday/i.test(q)){
    var d = calcDailyLimit();
    var rw2 = cashRunway();
    return {type:'payday', data:{days:d.daysLeft, runway:rw2, daily:d.perDay}};
  }
  // Сколько можно тратить сегодня / дневной лимит
  if(/сегодня|лимит|потрат|тратить/i.test(q) && !amount){
    var dly = calcDailyLimit();
    return {type:'daily', data:{perDay:dly.perDay, days:dly.daysLeft}};
  }
  // Обучение
  if(/научи|урок|обуч|финграмотн|грамот/i.test(q)){
    var doneIds = D.learned || [];
    var nextL = null;
    for(var li=0;li<LESSONS.length;li++){ if(doneIds.indexOf(LESSONS[li].id) === -1){ nextL = LESSONS[li]; break; } }
    return {type:'lesson', data:{lesson:nextL, done:doneIds.length, total:LESSONS.length}};
  }
  // Первая настройка
  if(/настро|начать|с чего|старт|первый раз|новичок/i.test(q)){
    return {type:'setup', data:setupState()};
  }
  if(/итог|месяц|месяц/i.test(q)){
    var now2 = new Date();
    var from2 = new Date(now2.getFullYear(), now2.getMonth(), 1);
    var tot2 = 0;
    var all2 = allSpends();
    for(var i=0;i<all2.length;i++){ if(all2[i].d >= from2){ tot2 += all2[i].s; } }
    return {type:'month', data:{spent:tot2, income:D.income, saved:(D.income||0)-tot2}};
  }
  if(/накоп|копить|цель|отпуск/i.test(q)){
    if(amount > 0){
      var months2 = Math.ceil(amount / Math.max(1, (D.income||0) * 0.1));
      return {type:'savings', data:{target:amount, months:months2, monthly:Math.round(amount/months2)}};
    }
    return {type:'savings', data:{goals:D.goals||[]}};
  }
  
   // Сигналы – что важно прямо сейчас
  if(/сигнал|важно|срочн|проблем|внимани/i.test(q)){
    var sigs = getSignals();
    return {type:'signals', data:sigs.slice(0,5)};
  }
  
  // Сценарии – что если урежу/увеличу
  if(/если|уреж|сократ|увелич|сценари/i.test(q)){
    var numMatch2 = q.match(/(\d[\d\s]*)/);
    var amount2 = numMatch2 ? parseInt(numMatch2[1].replace(/\s/g,'')) : 0;
    var catMatch = q.match(/(кафе|продукт|самокат|такси|подписк|развлечен|личн)/i);
    var catId = catMatch ? catMatch[1].toLowerCase() : 'cafe';
    // маппинг названий на ID категорий
    var catMap = {'кафе':'cafe','продукт':'grocery','самокат':'scooters','такси':'taxi','подписк':'subs','развлечен':'fun','личн':'personal'};
    catId = catMap[catId] || 'cafe';
    var catSum = 0;
    var mNow2 = new Date(); mNow2 = new Date(mNow2.getFullYear(), mNow2.getMonth(), 1);
    var allSp2 = allSpends();
    for(var i=0;i<allSp2.length;i++){
      if(allSp2[i].d >= mNow2 && (allSp2[i].cat||'other') === catId){
        catSum += allSp2[i].s;
      }
    }
    if(amount2 === 0){ amount2 = Math.round(catSum * 0.3); }
    var sim = whatIf(amount2);
    return {type:'scenario', data:{cat:catId, catName:catById(catId).n, amount:amount2, catSum:catSum, sim:sim}};
  }
  
  // По умолчанию — топ-3 сигнала
  var sigs = getSignals().slice(0,3);
  return {type:'signals', data:sigs};
}

function agentAnswer(query){
  var r = agentParse(query);
  var ans = '';
  if(r.type === 'afford'){
    ans = '<b>'+fmt(r.data.amount)+'</b> — '+r.data.txt;
  } else if(r.type === 'debt'){
    if(!r.data){ ans = 'Долгов нет — отлично!'; }
    else { ans = 'Всего долгов: <b>'+fmt(r.data.total)+'</b>. '+r.data.txt; }
  } else if(r.type === 'leaks'){
    if(!r.data.leaks.length){ ans = 'Утечек нет — лимиты в порядке.'; }
    else { ans = '<b>'+r.data.leaks.length+' утечек</b> на '+fmt(r.data.total)+'. Главная: '+r.data.leaks[0].n+' — перерасход '+fmt(r.data.leaks[0].over)+'.'; }
  } else if(r.type === 'subs'){
    ans = '<b>'+r.data.subs.length+' активных подписок</b>: '+fmt(r.data.monthly)+'/мес, '+fmt(r.data.annual)+'/год.';
  } else if(r.type === 'payday'){
    ans = 'Зарплата через <b>'+r.data.days+' дн</b>. Прогноз: '+r.data.runway+' дн. Дневной лимит: '+fmt(r.data.daily)+'.';
  } else if(r.type === 'daily'){
    ans = 'Сегодня можно потратить <b>'+fmt(r.data.perDay)+'</b> — и до зарплаты ('+r.data.days+' дн.) всё будет в плюсе. Это честная цифра: (остаток − платежи на 30 дней) ÷ дней.';
  } else if(r.type === 'lesson'){
    if(r.data.lesson){
      ans = '<b>Урок: '+r.data.lesson.t+'</b><br>'+r.data.lesson.x+'<br><small>Прогресс: '+r.data.done+' из '+r.data.total+' · отметка — во вкладке «Обучение»</small>';
    } else {
      ans = 'Курс пройден: '+r.data.total+' из '+r.data.total+'. Теперь главное — практика: плати себе первым в день зарплаты.';
    }
  } else if(r.type === 'setup'){
    var sNames = {inc:'доход и день зарплаты', bal:'текущий баланс', pay:'обязательные платежи', env:'первый конверт'};
    var sMiss = [];
    for(var sk in r.data.st){ if(!r.data.st[sk]){ sMiss.push(sNames[sk]); } }
    if(!sMiss.length){
      ans = 'Всё настроено. Дальше просто: добавляй траты кнопкой «Трата», а я буду держать прогноз и предупреждать о рисках.';
    } else {
      ans = '<b>Настройка: '+r.data.done+' из '+r.data.total+'</b><br>Осталось указать: '+sMiss.join(', ')+'.<br>Чек-лист — вверху Панели, каждый шаг занимает секунды.';
    }
  } else if(r.type === 'month'){
    ans = 'В этом месяце: потрачено <b>'+fmt(r.data.spent)+'</b> из дохода '+fmt(r.data.income)+'. '+(r.data.saved>=0?'Сэкономлено '+fmt(r.data.saved)+'.':'Перерасход '+fmt(-r.data.saved)+'.');
  } else if(r.type === 'savings'){
    if(r.data.months){ ans = 'Чтобы накопить '+fmt(r.data.target)+', откладывай '+fmt(r.data.monthly)+'/мес — накопишь за '+r.data.months+' мес.'; }
    else { ans = 'Активных целей: '+(r.data.goals||[]).filter(function(g){return !g.done;}).length; }
   } else if(r.type === 'signals'){
    ans = '<b>Что важно сейчас:</b><br>';
    for(var i=0;i<r.data.length;i++){
      var s = r.data[i];
      var actTxt = '';
      if(s.act && s.act.t){ actTxt = ' (нажми, чтобы открыть)'; }
      ans += '• <b style="color:'+(s.sev>=8?'var(--red)':s.sev>=5?'var(--org)':'var(--blu)')+'">'+esc(s.title)+'</b> — '+esc(s.desc)+(s.benefit?' · выгода '+fmt(s.benefit)+'/мес':'')+actTxt+'<br>';
    }
    if(!r.data.length){ ans = 'Сейчас всё спокойно. Так держать!'; }
      } else if(r.type === 'scenario'){
    var d = r.data;
    ans = '<b>Сценарий: урезать "'+d.catName+'" на '+fmt(d.amount)+'</b><br>';
    ans += 'Сейчас по этой категории: '+fmt(d.catSum)+' за месяц.<br>';
    ans += '<b>Эффект:</b> минимум за 90 дней станет <b style="color:'+(d.sim.diff>0?'var(--grn)':'var(--red)')+'">'+fmt(d.sim.newMin)+'</b> (было '+fmt(d.sim.originalMin)+', '+ (d.sim.diff>0?'+':'')+fmt(d.sim.diff)+')<br>';
    if(d.sim.diff > 0){
      ans += 'Это добавит тебе '+fmt(d.sim.diff)+' к минимальному балансу. Отличный шаг! Если решишь так сделать — урежь лимит категории и решение запомнится само.';
    } else {
      ans += 'Это ухудшит ситуацию на '+fmt(Math.abs(d.sim.diff))+'. Лучше урежь другую категорию.';
    }
  }
  return ans;
}

// ========== МИНИ-ГРАФИКИ ДЛЯ ЦЕЛЕЙ ==========
function drawGoalMiniChart(container, goal) {
    if (!container || !goal) return;
    
    // Собираем историю пополнений цели
    var history = [];
    var allSp = allSpends();
    var goalName = goal.n || '';
    
    // Ищем траты с названием цели (пополнения)
    for (var i = 0; i < allSp.length; i++) {
        if (allSp[i].n && allSp[i].n.indexOf(goalName) !== -1) {
            history.push({ date: allSp[i].d, amount: allSp[i].s });
        }
    }
    // Ищем доходы с названием цели
    for (var j = 0; j < (D.incomes || []).length; j++) {
        if (D.incomes[j].n && D.incomes[j].n.indexOf(goalName) !== -1) {
            history.push({ date: parseD(D.incomes[j].d), amount: D.incomes[j].s });
        }
    }
    // Если есть только текущая сумма, но нет истории — создаём одну точку
    if (history.length === 0 && (goal.cur || 0) > 0) {
        history.push({ date: new Date(), amount: goal.cur });
    }
    
    history.sort(function(a, b) { return a.date - b.date; });
    
    // Если данных нет — ничего не рисуем
    if (history.length === 0) return;
    
    // Создаём канвас
    var canvas = document.createElement('canvas');
    canvas.width = container.clientWidth * 2 || 600;
    canvas.height = 120;
    canvas.style.width = '100%';
    canvas.style.height = '60px';
    canvas.style.borderRadius = '6px';
    container.appendChild(canvas);
    
    var ctx = canvas.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    var W = canvas.width / 2;
    var H = canvas.height / 2;
    ctx.clearRect(0, 0, W, H);
    
    // Вычисляем кумулятивную сумму
    var cumulative = 0;
    var points = [];
    for (var k = 0; k < history.length; k++) {
        cumulative += history[k].amount;
        points.push({ x: k, y: cumulative });
    }
    
    var target = goal.target || 1;
    var current = cumulative;
    var maxVal = Math.max(current, target);
    var padding = 4;
    var range = maxVal || 1;
    
    // Рисуем целевую линию (пунктир)
    var targetY = H - padding - (target / range) * (H - padding * 2);
    ctx.strokeStyle = 'rgba(48, 209, 88, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(padding, targetY);
    ctx.lineTo(W - padding, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Подпись цели
    ctx.fillStyle = 'rgba(48, 209, 88, 0.5)';
    ctx.font = '7px Manrope';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Цель: ' + fmt(target), W - padding - 50, targetY - 2);
    
    // Рисуем линию прогресса
    ctx.strokeStyle = '#64d2ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var m = 0; m < points.length; m++) {
        var x = padding + (points[m].x / (points.length - 1 || 1)) * (W - padding * 2);
        var y = H - padding - (points[m].y / range) * (H - padding * 2);
        if (m === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Текущая точка (кружок)
    if (points.length > 0) {
        var lastX = padding + ((points.length - 1) / (points.length - 1 || 1)) * (W - padding * 2);
        var lastY = H - padding - (current / range) * (H - padding * 2);
        ctx.fillStyle = current >= target ? '#30d158' : '#64d2ff';
        ctx.beginPath();
        ctx.arc(lastX, lastY, 3, 0, 6.28);
        ctx.fill();
    }
    
    // Подпись текущей суммы
    ctx.fillStyle = current >= target ? 'rgba(48, 209, 88, 0.8)' : 'rgba(255, 255, 255, 0.6)';
    ctx.font = '7px Manrope';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(fmt(current), W - padding, 2);
    
    // Прогноз ETA
    var eta = goalEta(goal);
    if (eta && current < target) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('~ ' + eta, padding, 2);
    }
}

deployCheck();
