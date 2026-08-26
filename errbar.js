// Видимая полоса ошибок: незапланированные сбои нельзя терять молча
(function(){
  function show(msg){
    try{
      var d = document.getElementById('dbg');
      if(!d){
        d = document.createElement('div');
        d.id = 'dbg';
        d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;background:#401010;color:#ffd7d7;padding:10px 14px;font:12px monospace;z-index:99999;white-space:pre-wrap;max-height:140px;overflow:auto';
        document.body.appendChild(d);
      }
      d.textContent = 'ОШИБКА ПРИЛОЖЕНИЯ: ' + msg;
    }catch(_){}
  }
  window.addEventListener('error', function(e){
    var msg = e.message;
    if(!msg && e.target && e.target.src){
      msg = 'заблокирована загрузка: ' + e.target.src;
    }
    show((msg || 'неизвестный сбой') + ' (' + (e.filename || '') + ':' + (e.lineno || 0) + ')');
  }, true);
  window.addEventListener('unhandledrejection', function(e){
    var r = e.reason;
    var c = (r && r.code) || '';
    show('promise: ' + (c || (r && r.message) || r));
  });
})();
