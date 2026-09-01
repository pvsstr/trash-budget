// Модуль утилит: fmt, esc, parseD, iso, addM, toast, reportErr

function $(id){ return document.getElementById(id); }
function fmt(n){ return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Math.round(n)) + '\u00A0₽'; }
function iso(dt){ return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
function parseD(s){
  var y = new Date().getFullYear();
  if(!s){ return new Date(y,0,1); }
  if(s.length <= 5){ var p=s.split('.'); return new Date(y, +p[1]-1, +p[0]); }
  var q=s.split('-'); return new Date(+q[0], +q[1]-1, +q[2]);
}
function addM(dt, k){
  var target = new Date(dt.getFullYear(), dt.getMonth()+k+1, 0);
  return new Date(dt.getFullYear(), dt.getMonth()+k, Math.min(dt.getDate(), target.getDate()));
}
function esc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function reportErr(name, e){
  try{
    var d = document.getElementById('dbg');
    if(!d){
      d = document.createElement('div');
      d.id = 'dbg';
      d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;background:#401010;color:#ffd7d7;padding:8px 12px;font:11px monospace;z-index:99999;max-height:110px;overflow:auto;white-space:pre-wrap';
      document.body.appendChild(d);
    }
    d.textContent = '\u041e\u0448\u0438\u0431\u043a\u0430: ' + name + ' \u2014 ' + (e && e.message ? e.message : e) + (e && e.stack ? '  [' + String(e.stack).split('\n')[1] + ']' : '');
  }catch(_){}
}
function toast(m){ var t=document.createElement('div'); t.className='toast'; t.textContent=m; document.body.appendChild(t); setTimeout(function(){ t.remove(); },2500); }
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

export { $, fmt, iso, parseD, addM, esc, reportErr, toast, dToast };
