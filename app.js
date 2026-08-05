/* ============================================
   ТРЕШ — семейный бюджет
   Структурированный JavaScript
   
   Секции:
   1. Firebase импорты
   2. Конфигурация
   3. Утилиты
   4. Данные и константы
   5. Функции работы с данными
   6. Расчёты и формулы
   7. HTML-генераторы
   8. Шторки (sheet)
   9. Рендеры экранов
   10. Навигация
   11. Чат-бот
   12. Инициализация
   ============================================ */

// ===== СЕКЦИЯ 1: FIREBASE ИМПОРТЫ =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ===== СЕКЦИЯ 2: КОНФИГУРАЦИЯ FIREBASE =====
const firebaseConfig = {
  apiKey: "AIzaSyBrK9eZknNE3UBniVU2cnKUtwSOXnl_y2g",
  authDomain: "trash-budget-737fd.firebaseapp.com",
  projectId: "trash-budget-737fd",
  storageBucket: "trash-budget-737fd.firebasestorage.app",
  messagingSenderId: "996241413300",
  appId: "1:996241413300:web:ca7c0668e67f570c7373e1"
};
const appFirebase = initializeApp(firebaseConfig);
const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);
const provider = new GoogleAuthProvider();

let uid = null;
let viewOff = 0;
let pMode = 'm';
let pOff = 0;
let catTouched = false;

// ===== СЕКЦИЯ 3: УТИЛИТЫ =====
function $(id){ return document.getElementById(id); }
function fmt(n){ return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Math.round(n)) + ' ₽'; }
function iso(dt){ return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
function parseD(s){
  if(!s) return new Date(2026,0,1);
  if(s.length <= 5){ var p=s.split('.'); return new Date(2026, +p[1]-1, +p[0]); }
  var q=s.split('-'); return new Date(+q[0], +q[1]-1, +q[2]);
}
function addM(dt, k){ return new Date(dt.getFullYear(), dt.getMonth()+k, dt.getDate()); }
function cycleStart(dt){
  if(dt.getDate() >= 20) return new Date(dt.getFullYear(), dt.getMonth(), 20);
  return new Date(dt.getFullYear(), dt.getMonth()-1, 20);
}
function cycLabel(cs){
  var ce = addM(cs,1);
  return cs.getDate()+'.'+String(cs.getMonth()+1).padStart(2,'0')+' – '+String(ce.getDate()-1).padStart(2,'0')+'.'+String(ce.getMonth()+1).padStart(2,'0')+'.'+ce.getFullYear();
}
function toast(m){ var t=document.createElement('div'); t.className='toast'; t.textContent=m; document.body.appendChild(t); setTimeout(function(){ t.remove(); },2500); }

// ===== СЕКЦИЯ 4: ДАННЫЕ И КОНСТАНТЫ =====
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_S = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

const CATS = [
 {id:'grocery', n:'Продукты', i:'i-cart', k:'c-grn'},
 {id:'cafe', n:'Кафе и доставка', i:'i-coffee', k:'c-red'},
 {id:'scooters', n:'Самокаты / каршеринг', i:'i-scoot', k:'c-org'},
 {id:'transport', n:'Транспорт / электричка', i:'i-train', k:'c-blu'},
 {id:'taxi', n:'Такси', i:'i-taxi', k:'c-blu'},
 {id:'home', n:'Жильё и коммунальные', i:'i-home', k:'c-pur'},
 {id:'subs', n:'Подписки', i:'i-sub', k:'c-blu'},
 {id:'health', n:'Здоровье', i:'i-med', k:'c-red'},
 {id:'fun', n:'Развлечения', i:'i-beach', k:'c-pnk'},
 {id:'clothes', n:'Одежда', i:'i-shirt', k:'c-pur'},
 {id:'personal', n:'Личное', i:'i-gift', k:'c-teal'},
 {id:'other', n:'Прочее', i:'i-alert', k:'c-mut'}
];

const CAT2ENV = {grocery:'Продукты',cafe:'Кафе',scooters:'Самокаты',taxi:'Такси',transport:'Тройка',home:'Аренда',subs:'Личное',health:'Личное',fun:'Личное',clothes:'Личное',personal:'Личное',other:'Личное'};
const TX2CAT = {'КАФЕ':'cafe','ПРОДУКТЫ':'grocery','УТЕЧКИ':'scooters','ТРАНСПОРТ':'transport','ТАКСИ':'taxi','ЖИЛЬЁ':'home','ЛИЧНОЕ':'personal','ПОДПИСКИ':'subs','ПЕРЕВОДЫ':'home'};
const KEYCAT = [
 ['scooters',['самокат','scooter','whoosh','urent','урент','citydrive','ситидрайв']],
 ['taxi',['такси','taxi','бериза','bamboo']],
 ['transport',['тройк','troika','tutu','туту','электрич','поезд','автобус','метро']],
 ['subs',['подписк','telegram','телеграм','иви','yandex plus','яндекс плюс','netflix','spotify']],
 ['health',['аптек','aptek','pharmacy','лекарств','врач','клиник','больниц']],
 ['clothes',['одежд','обув','sportmaster','спортмастер','new yorker','куртк','футболк']],
 ['cafe',['кафе','cafe','кофейн','coffee','пышк','пицц','pizza','dodo','додо','ресторан','столов','доставк','бургер','burger','суши','шаурм','вкусно и точка','хочу пышку','еда']],
 ['grocery',['пятероч','pyateroch','магнит','magnit','перекрест','perekrest','ашан','auchan','вкуствил','vkusvill','мерко','merko','fix price','фикс','продукт','маркет','market','лента','дикси']],
 ['home',['аренд','коммунал','жкх','квартплат']],
 ['personal',['подарк','цвет','салон','барбер','парикм','космет','стрижк','маник','педик','spa']]
];

const LESSONS = [
{id:1,t:'Подушка безопасности',x:'Это 3–6 месяцев обязательных трат (аренда, еда, транспорт) на отдельном счёте. Она защищает от кредиток при форс-мажоре. Начните с 10% дохода в месяц — первые 20 000 ₽ дают спокойствие.'},
{id:2,t:'Платите себе первыми',x:'В день зарплаты сразу переводите план в накопления, до любых трат. Тратите то, что осталось — а не наоборот. Это главное правило богатства.'},
{id:3,t:'Лавина долгов',x:'Гасите сначала долг с самой высокой ставкой. Кредитка выгодна только при полном погашении в грейс-период, иначе ~40% годовых съедают бюджет.'},
{id:4,t:'Метод конвертов',x:'Разделите деньги по категориям с лимитами сразу после зарплаты. Конверт пуст — траты в категории стоп до следующего цикла. В этом приложении конверты живут в разделе «Бюджет».'},
{id:5,t:'Правило 24 часов',x:'Любое незапланированное желание дороже 500 ₽ — ждите сутки и согласуйте с Копилотом. В 70% случаев желание уходит, деньги остаются на отпуске.'},
{id:6,t:'Аудит подписок',x:'Раз в месяц смотрите все автоплатежи. Треть не используется — это до 10 000 ₽ в год скрытых потерь. Отключайте прямо в разделе «Бюджет».'},
{id:7,t:'Обязательное и гибкое',x:'Аренда и подписки урезать трудно. Кафе, самокаты, такси — гибкие траты, именно там живёт экономия. Управляйте ими дневным лимитом из утреннего дайджеста.'},
{id:8,t:'Рассрочка без ловушек',x:'Рассрочка безопасна, только если платёж уже вписан в бюджет и не вытесняет конверты. Проверяйте до, а не после. График ваших рассрочек — в разделе «Бюджет».'}
];

const TIPS = [
  'Подушка безопасности = 3–6 месяцев обязательных трат. Начните с 10%.',
  'Мелкие траты 100–200 ₽ незаметны, но 5 таких в день = 15 000 ₽ в месяц.',
  'Подписки — тихая утечка. Раз в месяц просматривайте автоплатежи.',
  'Платите себе первыми: в день зарплаты сразу переводите 10% в накопления.',
  'Кредитка выгодна только при полном погашении в грейс-период.',
  'Конверт пуст — трата стоп. Правило работает без силы воли.'
];

let D = {
  demo: true,
  income: 114493,
  salaryDay: 20,
  baseBalance: 0,
  goals: {cushion:0, cushionT:100000, vacation:0, vacationT:200000},
  spends: [],
  incomes: [],
  envs: [
    {n:'Аренда + КУ', ic:'i-home', k:'c-pur', lim:65000},
    {n:'Электричка экспресс', ic:'i-train', k:'c-blu', lim:8100},
    {n:'Продукты', ic:'i-cart', k:'c-grn', lim:18000},
    {n:'Кафе и рестораны', ic:'i-coffee', k:'c-red', lim:3000},
    {n:'Самокаты и каршеринг', ic:'i-scoot', k:'c-red', lim:2500},
    {n:'Такси', ic:'i-taxi', k:'c-blu', lim:1500},
    {n:'Тройка и транспорт', ic:'i-train', k:'c-blu', lim:1500},
    {n:'Личное и прочее', ic:'i-gift', k:'c-pur', lim:3000},
    {n:'Погашение кредитки Альфа', ic:'i-shield', k:'c-grn', lim:6000},
    {n:'Микро-подушка', ic:'i-target', k:'c-pur', lim:2000}
  ],
  pays: [
    {d:20, n:'Аренда + КУ', s:63500},
    {d:21, n:'Симка своя', s:300},
    {d:22, n:'Симка жены', s:300},
    {d:23, n:'Интернет', s:610}
  ],
  subs: [
    {n:'Telegram Premium', s:299, off:0},
    {n:'Яндекс Плюс', s:449, off:0},
    {n:'Getcontact', s:299, off:1},
    {n:'ivi.ru', s:99, off:1},
    {n:'Привилегии M', s:399, off:1}
  ],
  leaks: [
    {n:'Самокаты и каршеринг', s:4700, tx:96, adv:'Лимит 2 500 ₽/мес: часть поездок заменяйте электричкой и Тройкой.'},
    {n:'Кафе сверх лимита', s:7600, tx:41, adv:'Правило 24 часов: желания дороже 500 ₽ согласовывайте с Копилотом.'},
    {n:'Подписки к отключению', s:797, tx:3, adv:'Getcontact, ivi и Привилегии M отключаются в разделе «Бюджет» за минуту.'}
  ],
  tx: []
};

// ===== СЕКЦИЯ 5: ФУНКЦИИ РАБОТЫ С ДАННЫМИ =====
function catById(id){ for(var i=0;i<CATS.length;i++){ if(CATS[i].id===id) return CATS[i]; } return CATS[11]; }
function autoCat(t){
  var s = (' '+t.toLowerCase()+' ');
  for(var i=0;i<KEYCAT.length;i++){
    var kw = KEYCAT[i][1];
    for(var j=0;j<kw.length;j++){ if(s.indexOf(kw[j]) !== -1) return KEYCAT[i][0]; }
  }
  return 'other';
}
function save(){
  if(uid){
    setDoc(doc(db,'users',uid), {data:D, updatedAt:new Date().toISOString()}).catch(function(){});
  }
  try{ localStorage.setItem('trash_budget_data', JSON.stringify(D)); }catch(e){}
}
function normalize(){
  if(!D.spends) D.spends=[];
  if(!D.incomes) D.incomes=[];
  if(!D.envs) D.envs=[];
  if(!D.pays) D.pays=[];
  if(!D.subs) D.subs=[];
  if(!D.leaks) D.leaks=[];
  if(!D.tx) D.tx=[];
  if(!D.goals) D.goals={cushion:0,cushionT:100000,vacation:0,vacationT:200000};
}
function allSpends(){
  var cs = cycleStart(new Date());
  var out=[];
  for(var i=0;i<D.spends.length;i++){
    var x=D.spends[i];
    var d=parseD(x.d);
    if(d>=cs) out.push(x);
  }
  return out;
}

// ===== СЕКЦИЯ 6: РАСЧЁТЫ И ФОРМУЛЫ =====
function sums(){
  var cs=cycleStart(new Date());
  var r={}; for(var i=0;i<CATS.length;i++) r[CATS[i].id]=0;
  for(var i=0;i<D.spends.length;i++){
    var x=D.spends[i]; var d=parseD(x.d);
    if(d>=cs){ r[x.c]=(r[x.c]||0)+x.s; }
  }
  return r;
}
function realBal(){
  var b=D.baseBalance||0;
  for(var i=0;i<D.incomes.length;i++) b+=D.incomes[i].s;
  for(var i=0;i<D.spends.length;i++) b-=D.spends[i].s;
  return b;
}
function inCycle(dt){ var cs=cycleStart(new Date()); return dt>=cs && dt<addM(cs,1); }
function nextPay(){
  var now=new Date();
  var d=D.salaryDay||20;
  var np=new Date(now.getFullYear(), now.getMonth(), d);
  if(now.getDate()>=d) np=addM(np,1);
  return np;
}
function calcMonthlyFixedPay(){
  var fp=0;
  for(var i=0;i<D.pays.length;i++) fp+=D.pays[i].s;
  for(var i=0;i<D.subs.length;i++) if(!D.subs[i].off) fp+=D.subs[i].s;
  return fp;
}
function calcSafeBalance(){
  var cs=cycleStart(new Date());
  var daysLeft=Math.max(1, Math.ceil((addM(cs,1)-new Date())/86400000));
  var fixed=calcMonthlyFixedPay();
  var daily=(D.income-fixed)/30;
  return Math.max(0, Math.round(realBal()-fixed-(daily*daysLeft)));
}
function calcDailyLimit(){
  var cs=cycleStart(new Date());
  var daysLeft=Math.max(1, Math.ceil((addM(cs,1)-new Date())/86400000));
  var fixed=calcMonthlyFixedPay();
  var flex=D.income-fixed;
  var spent=0; var s=sums();
  for(var k in s) if(k!=='home' && k!=='subs') spent+=s[k];
  return Math.max(0, Math.round((flex-spent)/daysLeft));
}
function calcHealthScore(){
  var bal=realBal();
  var fixed=calcMonthlyFixedPay();
  var cushion=D.goals.cushion||0;
  var cushionT=D.goals.cushionT||100000;
  var score=50;
  if(bal>fixed*2) score+=15;
  if(cushion>=cushionT*0.5) score+=20;
  if(D.leaks.filter(function(x){return !x.fixed;}).length===0) score+=15;
  return Math.min(100, score);
}
function ensureSalary(){
  var now=new Date();
  var last=localStorage.getItem('trash_last_salary');
  var thisCycle=cycleStart(now).toDateString();
  if(last!==thisCycle){
    localStorage.setItem('trash_last_salary', thisCycle);
    D.baseBalance=realBal();
    D.incomes.push({id:Date.now(), d:iso(now), n:'Зарплата', s:D.income});
    save();
  }
}
function periodRange(){
  var cs=cycleStart(new Date());
  if(pMode==='m'){ return {from:cs, to:addM(cs,1), label:cycLabel(cs)}; }
  if(pMode==='q'){
    var qStart=new Date(cs.getFullYear(), Math.floor(cs.getMonth()/3)*3, cs.getDate());
    var qOff=addM(qStart, pOff*3);
    return {from:qOff, to:addM(qOff,3), label:'Квартал'};
  }
  var yStart=new Date(cs.getFullYear(),0,1);
  var yOff=addM(yStart, pOff*12);
  return {from:yOff, to:addM(yOff,12), label:yOff.getFullYear()};
}

// ===== СЕКЦИЯ 7: HTML-ГЕНЕРАТОРЫ =====
function rowHtml(o){
  return '<div class="row"><div class="l"><div class="sic '+o.k+'">'+o.ic+'</div><div><div>'+o.n+'</div><div class="mut">'+o.sub+'</div></div></div><div class="r"><div class="sum">'+fmt(o.s)+'</div></div></div>';
}
function tipHtml(t){ return '<div class="card" style="font-size:13px;color:var(--mut)">💡 '+t+'</div>'; }
function sheetHead(t){ return '<div class="sheetHead"><h3>'+t+'</h3><button data-act="closeSheet"><svg class="ic"><use href="#i-x"/></svg></button></div>'; }

// ===== СЕКЦИЯ 8: ШТОРКИ (SHEET) =====
function closeSheet(){
  var sh=$('sheet'); var shb=$('shb');
  if(sh) sh.classList.remove('on');
  if(shb) shb.classList.remove('on');
  setTimeout(function(){ var b=$('sheetBody'); if(b) b.innerHTML=''; }, 350);
}
function openSheet(type, index){
  var sh=$('sheet'); var shb=$('shb'); var b=$('sheetBody');
  if(!b) return;
  b.innerHTML='';
  if(type==='spend'){ b.innerHTML=sheetHead('Новая трата')+'<div style="display:flex;flex-direction:column;gap:12px"><input id="spAmt" type="number" placeholder="Сумма" style="background:rgba(255,255,255,.06);border:1px solid var(--stroke);border-radius:14px;padding:14px 16px"><input id="spNote" type="text" placeholder="Описание" style="background:rgba(255,255,255,.06);border:1px solid var(--stroke);border-radius:14px;padding:14px 16px"><select id="spCat" style="background:rgba(255,255,255,.06);border:1px solid var(--stroke);border-radius:14px;padding:14px 16px"></select><input id="spDate" type="date" style="background:rgba(255,255,255,.06);border:1px solid var(--stroke);border-radius:14px;padding:14px 16px"><button data-act="spend-save" style="background:var(--grn);color:#000;border-radius:14px;padding:14px;font-weight:700">Сохранить трату</button></div>'; }
  else if(type==='income'){ b.innerHTML=sheetHead('Новый доход')+'<div style="display:flex;flex-direction:column;gap:12px"><input id="incAmt" type="number" placeholder="Сумма" style="background:rgba(255,255,255,.06);border:1px solid var(--stroke);border-radius:14px;padding:14px 16px"><input id="incNote" type="text" placeholder="Описание" style="background:rgba(255,255,255,.06);border:1px solid var(--stroke);border-radius:14px;padding:14px 16px"><input id="incDate" type="date" style="background:rgba(255,255,255,.06);border:1px solid var(--stroke);border-radius:14px;padding:14px 16px"><button data-act="income-save" style="background:var(--grn);color:#000;border-radius:14px;padding:14px;font-weight:700">Сохранить доход</button></div>'; }
  else if(type==='env'){ openEnv(index); }
  if(sh) sh.classList.add('on');
  if(shb) shb.classList.add('on');
  var sel=$('spCat');
  if(sel){
    sel.innerHTML='';
    for(var i=0;i<CATS.length;i++){ var o=document.createElement('option'); o.value=CATS[i].id; o.textContent=CATS[i].n; sel.appendChild(o); }
  }
  var spDate=$('spDate'); if(spDate) spDate.value=iso(new Date());
  catTouched=false;
}
function openEdit(type, id){
  // TODO: реализация редактирования
}
function get(arr, id){ for(var i=0;i<arr.length;i++) if(arr[i].id===id) return arr[i]; return null; }
function saveEdit(){}
function g(id){ for(var i=0;i<D.envs.length;i++) if(D.envs[i].id===id) return D.envs[i]; return null; }
function find(id){ for(var i=0;i<D.spends.length;i++) if(D.spends[i].id===id) return i; return -1; }
function delEdit(){}
function rm(arr, id){ var i=find(id); if(i>=0){ arr.splice(i,1); save(); render(); } }
function envMatch(cat){ return CAT2ENV[cat]||'Личное'; }
function openEnv(i){
  var e=D.envs[i]; if(!e) return;
  var b=$('sheetBody'); if(!b) return;
  b.innerHTML=sheetHead(e.n)+'<div style="display:flex;flex-direction:column;gap:12px"><label>Лимит</label><input id="in1" type="number" value="'+(e.lim||0)+'" style="background:rgba(255,255,255,.06);border:1px solid var(--stroke);border-radius:14px;padding:14px 16px"><button data-act="env-save" data-i="'+i+'" style="background:var(--grn);color:#000;border-radius:14px;padding:14px;font-weight:700">Сохранить</button></div>';
}

// ===== СЕКЦИЯ 9: РЕНДЕРЫ ЭКРАНОВ =====
function renderEnv(){
  var el=$('envWrap'); if(!el) return;
  var cs=cycleStart(new Date()); var s=sums(); var h='';
  for(var i=0;i<D.envs.length;i++){
    var e=D.envs[i]; var spent=s[e.id]||0;
    var pct=e.lim>0?Math.round(spent/e.lim*100):0;
    var cls=pct>100?'var(--red)':(pct>85?'var(--org)':'var(--grn)');
    h+='<div class="env glass hov" data-act="env" data-i="'+i+'"><header><div class="env-name"><div class="sic '+e.k+'" style="width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center">'+e.ic+'</div>'+e.n+'</div><div class="sum" style="color:'+cls+'">'+fmt(spent)+' / '+fmt(e.lim)+'</div></header><div class="env-bar"><div style="width:'+Math.min(100,pct)+'%;background:'+cls+'"></div></div></div>';
  }
  el.innerHTML=h;
}
function renderPays(){ var el=$('paysWrap'); if(!el) return; var h=''; for(var i=0;i<D.pays.length;i++){ var p=D.pays[i]; h+='<div class="row"><div class="l"><div class="sic c-pur">'+p.d+'</div><div>'+p.n+'</div></div><div class="r sum">'+fmt(p.s)+'</div></div>'; } el.innerHTML=h; }
function renderSubs(){ var el=$('subsWrap'); if(!el) return; var h=''; for(var i=0;i<D.subs.length;i++){ var s=D.subs[i]; h+='<div class="row"><div class="l"><div class="sic '+(s.off?'c-mut':'c-blu')+'">📅</div><div>'+s.n+(s.off?' <span style=\"color:var(--mut)\">(откл)</span>':'')+'</div></div><div class="r sum">'+fmt(s.s)+'</div></div>'; } el.innerHTML=h; }
function renderCredits(){ var el=$('creditsWrap'); if(!el) return; el.innerHTML='<div class="card"><div class="mut">Кредиты и рассрочки</div></div>'; }
function renderInsts(){ var el=$('instsWrap'); if(!el) return; el.innerHTML='<div class="card"><div class="mut">Рассрочки</div></div>'; }
function catAgg(){
  var cs=cycleStart(new Date()); var r={};
  for(var i=0;i<D.spends.length;i++){ var x=D.spends[i]; var d=parseD(x.d); if(d>=cs){ r[x.c]=(r[x.c]||0)+x.s; } }
  var arr=[]; for(var k in r){ var c=catById(k); arr.push({id:k,n:c.n,s:r[k],k:c.k}); }
  arr.sort(function(a,b){return b.s-a.s;});
  return arr;
}
function drawDonutWith(id, data){
  var el=$(id); if(!el) return;
  var total=data.reduce(function(a,b){return a+b.s;},0);
  if(total===0){ el.innerHTML='<div class="donut"><div class="center"><div class="big">0 ₽</div></div></div>'; return; }
  var r=70, c=2*Math.PI*r, off=0, h='';
  for(var i=0;i<data.length;i++){
    var pct=data[i].s/total; var dash=c*pct;
    var colors=['var(--grn)','var(--red)','var(--org)','var(--acc)','var(--pur)','var(--pink)','var(--teal)'];
    h+='<circle cx="80" cy="80" r="'+r+'" fill="none" stroke="'+colors[i%colors.length]+'" stroke-width="14" stroke-dasharray="'+dash+' '+(c-dash)+'" stroke-dashoffset="'+(-off)+'" style="transition:stroke-dasharray .6s"/>';
    off+=dash;
  }
  el.innerHTML='<div class="donut"><svg viewBox="0 0 160 160" width="160" height="160">'+h+'</svg><div class="center"><div class="big">'+fmt(total)+'</div><div class="sm">в этом цикле</div></div></div>';
}
function drawBarsFor(id, data){
  var el=$(id); if(!el) return;
  if(data.length===0){ el.innerHTML=''; return; }
  var max=Math.max.apply(null,data.map(function(x){return x.s;}));
  var h='<div style="display:flex;align-items:flex-end;gap:8px;height:120px;padding:10px 0">';
  for(var i=0;i<data.length;i++){
    var pct=max>0?Math.round(data[i].s/max*100):0;
    h+='<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px"><div style="width:100%;background:var(--acc);border-radius:6px;height:'+pct+'%;min-height:4px;transition:height .4s"></div><div style="font-size:10px;color:var(--mut);text-align:center">'+data[i].n+'</div></div>';
  }
  h+='</div>';
  el.innerHTML=h;
}
function renderAnalytics(){
  var el=$('analyticsWrap'); if(!el) return;
  var pr=periodRange(); var h='<div class="card"><h4>'+pr.label+'</h4>';
  var agg=catAgg();
  h+='<div id="donutWrap"></div><div id="barsWrap"></div></div>';
  el.innerHTML=h;
  drawDonutWith('donutWrap', agg);
  drawBarsFor('barsWrap', agg);
}
function renderTx(){
  var el=$('txWrap'); if(!el) return;
  var q=$('q'); var filter=q?q.value.toLowerCase():'';
  var arr=D.tx||[]; if(filter){ arr=arr.filter(function(x){return x.n.toLowerCase().indexOf(filter)!==-1;}); }
  var h=''; for(var i=0;i<arr.length;i++){ var x=arr[i]; h+='<div class="row"><div class="l"><div class="sic c-blu">💳</div><div>'+x.n+'</div></div><div class="r sum">'+fmt(x.s)+'</div></div>'; }
  el.innerHTML=h;
}
function renderRec(){ var el=$('recWrap'); if(!el) return; el.innerHTML=''; }
function renderGoals(){
  var el=$('goalsWrap'); if(!el) return;
  var g=D.goals; var h='<div class="card"><h4>Цели</h4>';
  h+='<div class="row"><div class="l"><div class="sic c-grn">🛡️</div><div>Подушка безопасности</div></div><div class="r"><div class="sum">'+fmt(g.cushion)+' / '+fmt(g.cushionT)+'</div></div></div>';
  h+='<div class="env-bar" style="margin-top:8px"><div style="width:'+Math.min(100,Math.round(g.cushion/g.cushionT*100))+'%;background:var(--grn)"></div></div>';
  h+='<div class="row" style="margin-top:12px"><div class="l"><div class="sic c-org">🏖️</div><div>Отпуск</div></div><div class="r"><div class="sum">'+fmt(g.vacation)+' / '+fmt(g.vacationT)+'</div></div></div>';
  h+='<div class="env-bar" style="margin-top:8px"><div style="width:'+Math.min(100,Math.round(g.vacation/g.vacationT*100))+'%;background:var(--org)"></div></div>';
  h+='</div>';
  el.innerHTML=h;
}
function renderLearn(){
  var el=$('learnWrap'); if(!el) return;
  var h='<div class="card"><h4>Финансовая грамотность</h4>';
  for(var i=0;i<LESSONS.length;i++){ var l=LESSONS[i]; h+='<div style="padding:14px 0;border-bottom:1px solid var(--stroke)"><div style="font-weight:700;margin-bottom:6px">'+l.t+'</div><div style="font-size:13px;color:var(--mut);line-height:1.5">'+l.x+'</div></div>'; }
  h+='</div>';
  el.innerHTML=h;
}
function renderSpend(){ var el=$('spendWrap'); if(!el) return; el.innerHTML='<div class="card"><button class="hov" data-act="sheet" data-t="spend" style="width:100%;padding:16px;background:var(--red);color:#fff;border-radius:14px;font-weight:700;font-size:16px">+ Добавить трату</button></div>'; }
function renderIncome(){ var el=$('incomeWrap'); if(!el) return; el.innerHTML='<div class="card"><button class="hov" data-act="sheet" data-t="income" style="width:100%;padding:16px;background:var(--grn);color:#000;border-radius:14px;font-weight:700;font-size:16px">+ Добавить доход</button></div>'; }
function renderDigest(){
  var el=$('digestWrap'); if(!el) return;
  var dl=calcDailyLimit(); var sb=calcSafeBalance(); var hs=calcHealthScore();
  var h='<div class="card"><h4>Утренний дайджест</h4>';
  h+='<div class="row"><div class="l"><div class="sic c-teal">📊</div><div>Дневной лимит</div></div><div class="r sum c-teal">'+fmt(dl)+'</div></div>';
  h+='<div class="row"><div class="l"><div class="sic c-grn">🛡️</div><div>Безопасный остаток</div></div><div class="r sum c-grn">'+fmt(sb)+'</div></div>';
  h+='<div class="row"><div class="l"><div class="sic c-org">❤️</div><div>Здоровье бюджета</div></div><div class="r sum c-org">'+hs+'/100</div></div>';
  h+='</div>';
  el.innerHTML=h;
}
function renderBanner(){
  var el=$('bannerWrap'); if(!el) return;
  var days=Math.ceil((nextPay()-new Date())/86400000);
  el.innerHTML='<div class="card" style="background:linear-gradient(135deg,var(--pur),var(--acc));color:#fff;border:none"><div style="font-weight:800;font-size:18px">До зарплаты '+days+' '+((days%10===1&&days%100!==11)?'день':((days%10>=2&&days%10<=4&&!(days%100>=12&&days%100<=14))?'дня':'дней'))+'</div><div style="opacity:.8;margin-top:4px">Остаток: '+fmt(realBal())+'</div></div>';
}
function renderDashboardNew(){
  var el=$('dashboardWrap'); if(!el) return;
  var bal=realBal(); var inc=D.income; var cs=cycLabel(cycleStart(new Date()));
  el.innerHTML='<div style="text-align:center;padding:24px 0"><div style="font-size:13px;color:var(--mut);margin-bottom:6px">Текущий баланс · '+cs+'</div><div style="font-size:42px;font-weight:800;letter-spacing:-1px">'+fmt(bal)+'</div><div style="font-size:13px;color:var(--mut);margin-top:6px">Доход: '+fmt(inc)+'</div></div>';
}

// ===== СЕКЦИЯ 10: НАВИГАЦИЯ =====
// [ИСПРАВЛЕНИЕ БАГА]: функция loadPage была вызвана, но нигде не объявлена в оригинале!
function loadPage(pageName, callback){
  var app = $('app');
  if(!app) return;
  // Пытаемся загрузить HTML-шаблон из pages/
  fetch('pages/'+pageName+'.html')
    .then(function(r){ return r.text(); })
    .then(function(html){ app.innerHTML = html; if(typeof callback==='function') callback(); })
    .catch(function(){
      // Fallback: создаём базовый контейнер для JS-рендеринга
      app.innerHTML = '<div id=\"'+pageName+'Wrap\"></div>';
      if(typeof callback==='function') callback();
    });
}

function go(pageName){
  document.querySelectorAll('#rail button.nav-link, #bnav button.nav-link').forEach(function(btn){
    btn.classList.toggle('on', btn.dataset.page === pageName);
  });
  loadPage(pageName, function(){
    if(typeof render === 'function') render();
  });
}

function render(){
  var now = new Date();
  var curDate=$('curDate'); if(curDate) curDate.textContent = now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'});
  var demoTag=$('demoTag'); if(demoTag) demoTag.classList.toggle('hidden', !D.demo);
  var hBal=$('hBal'); if(hBal) hBal.textContent = fmt(realBal());
  var sInc=$('sInc'); if(sInc) sInc.textContent = fmt(D.income);
  var sIncP=$('sIncP'); if(sIncP) sIncP.textContent = 'зарплата, '+D.salaryDay+'-го числа';
  
  var act = D.leaks.filter(function(x){ return !x.fixed; });
  var leakSum=0;
  for(var j=0;j<act.length;j++) leakSum += act[j].s;
  var sLeakV=$('sLeakV'); if(sLeakV) sLeakV.textContent = fmt(leakSum);
  var sLeakP=$('sLeakP'); if(sLeakP) sLeakP.textContent = act.length+' зоны перерасхода';
  var tipText=$('tipText'); if(tipText) tipText.textContent = TIPS[now.getDate() % TIPS.length];
  
  renderDashboardNew();
  renderGoals();
  renderBanner();
  renderAnalytics();
  renderDigest();
  renderRec();
  renderTx();
  renderEnv();
  renderPays();
  renderSubs();
  renderCredits();
  renderInsts();
  renderSpend();
  renderIncome();
  renderLearn();
}

// ===== СЕКЦИЯ 11: ЧАТ-БОТ =====
function ask(q){
  var text = q || (document.getElementById('chatIn') ? document.getElementById('chatIn').value.trim() : '');
  if(!text) return;
  var chatIn=document.getElementById('chatIn');
  if(chatIn) chatIn.value = '';
  var log=document.getElementById('chatLog');
  if(!log) return;
  log.insertAdjacentHTML('beforeend', '<div class=\"msg me\">'+text+'</div>');
  setTimeout(function(){
    var s=text.toLowerCase();
    var reply='';
    if(s.indexOf('сегодня') !== -1){
      var days = ((D.salaryDay - new Date().getDate()) + 30) % 30;
      reply='До зарплаты '+days+' дней. Дневной лимит: '+fmt(calcDailyLimit())+'.';
    }else if(s.indexOf('лимит') !== -1){
      reply='Ваш дневной лимит: '+fmt(calcDailyLimit())+'. Безопасный остаток: '+fmt(calcSafeBalance())+'.';
    }else if(s.indexOf('подушка') !== -1){
      reply='Подушка безопасности: '+fmt(D.goals.cushion)+' из '+fmt(D.goals.cushionT)+'.';
    }else{
      reply='Я Копилот — ваш финансовый ассистент. Спросите про лимит, подушку безопасности или дату зарплаты.';
    }
    log.insertAdjacentHTML('beforeend', '<div class=\"msg bot\">'+reply+'</div>');
    log.scrollTop = log.scrollHeight;
  }, 600);
}

// ===== СЕКЦИЯ 12: ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('click', function(e){
  var el = e.target.closest('[data-act]');
  if(!el) return;
  var act = el.getAttribute('data-act');
  
  if(act === 'nav'){
    var page = el.getAttribute('data-page');
    if(page) go(page);
  }
  else if(act === 'closeSheet'){ closeSheet(); }
  else if(act === 'sheet'){ openSheet(el.getAttribute('data-t'), parseInt(el.getAttribute('data-i')||'0',10)); }
  else if(act === 'spend-save'){
    var spAmt=$('spAmt'); var spNote=$('spNote'); var spCat=$('spCat'); var spDate=$('spDate');
    if(!spAmt) return;
    var a=parseFloat(spAmt.value);
    if(isNaN(a) || a<=0){ alert('Введите сумму траты.'); return; }
    D.spends.push({id:Date.now(), d: spDate?spDate.value:iso(new Date()), c: spCat?spCat.value:'other', n: spNote?spNote.value.trim()||'Трата':'Трата', s:a});
    save(); closeSheet(); render(); toast('Трата '+fmt(a)+' сохранена');
  }
  else if(act === 'env-save'){
    var in1=$('in1');
    if(!in1) return;
    var idx=parseInt(el.getAttribute('data-i')||'0',10);
    if(D.envs[idx]){ D.envs[idx].lim=parseFloat(in1.value)||0; save(); render(); toast('Лимит обновлён'); }
    closeSheet();
  }
  else if(act === 'env'){ openEnv(parseInt(el.getAttribute('data-i')||'0',10)); var sh=$('sheet'); var shb=$('shb'); if(sh) sh.classList.add('on'); if(shb) shb.classList.add('on'); }
  else if(act === 'income-save'){
    var incAmt=$('incAmt'); var incDate=$('incDate'); var incNote=$('incNote');
    if(!incAmt) return;
    var a2=parseFloat(incAmt.value);
    if(isNaN(a2) || a2<=0){ alert('Введите сумму поступления.'); return; }
    D.incomes.push({id:Date.now(), d: incDate?incDate.value:iso(new Date()), n: incNote?incNote.value.trim()||'Поступление':'Поступление', s:a2});
    save(); closeSheet(); render(); toast('Поступление +'+fmt(a2));
  }
  else if(act === 'p-set'){ pMode=el.getAttribute('data-v'); pOff=0; renderAnalytics(); }
  else if(act === 'chip'){ ask(el.getAttribute('data-q')); }
  else if(act === 'send'){ ask(); }
  else if(act === 'exit'){ signOut(auth); }
});

function safeAddEventListener(id, event, handler){
  var el=document.getElementById(id);
  if(el) el.addEventListener(event, handler);
}
var shb=$('shb'); if(shb) shb.addEventListener('click', closeSheet);
safeAddEventListener('q', 'input', renderTx);
var chatIn=$('chatIn');
if(chatIn) chatIn.addEventListener('keydown', function(e){ if(e.key==='Enter') ask(); });
safeAddEventListener('spCat', 'change', function(){ catTouched=true; });
safeAddEventListener('spNote', 'input', function(){ if(!catTouched){ var sc=$('spCat'); if(sc) sc.value=autoCat(this.value); } });

var gbtn=$('googleBtn');
if(gbtn){
  gbtn.addEventListener('click', function(){
    gbtn.textContent='Подключаюсь...';
    signInWithPopup(auth, provider).catch(function(err){
      return signInWithRedirect(auth, provider);
    }).catch(function(err2){
      gbtn.textContent='Войти через Google';
      alert('Не удалось войти: '+((err2&&err2.code)||err2));
    });
  });
}

onAuthStateChanged(auth, function(u){
  if(!u){
    var login=$('login'); var app=$('app');
    if(login) login.classList.remove('hidden');
    if(app) app.classList.add('hidden');
    return;
  }
  uid=u.uid;
  var login=$('login'); var app=$('app');
  if(login) login.classList.add('hidden');
  if(app) app.classList.remove('hidden');
  var name=(u.displayName||'друг').split(' ')[0];
  var hello=$('hello'); if(hello) hello.textContent='Привет, '+name+'!';
  var mMail=$('mMail'); if(mMail) mMail.textContent=name;
  getDoc(doc(db,'users',uid)).then(function(s){
    if(s.exists() && s.data() && s.data().data) D=s.data().data;
    normalize();
    ensureSalary();
    var sel=$('spCat');
    if(sel){
      sel.innerHTML='';
      for(var i=0;i<CATS.length;i++){
        var o=document.createElement('option');
        o.value=CATS[i].id; o.textContent=CATS[i].n;
        sel.appendChild(o);
      }
    }
    var spDate=$('spDate');
    if(spDate) spDate.value=iso(new Date());
    loadPage('panel', function(){
      if(typeof render === 'function') render();
    });
  }).catch(function(){ normalize(); render(); });
});

if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(function(){}); }
