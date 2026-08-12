<div class="page">
  <div class="cap">Доходы · любой период</div>
  <div class="tx-card glass">
    <button class="qa-btn spend-add-btn" data-act="addincome"><svg class="ic"><use href="#i-in"/></svg>Добавить поступление</button>
    <div class="cap" style="margin:10px 4px 6px">Быстрые шаблоны · тап запишет сегодня</div>
    <div id="iTplBox" class="h-actions"></div>
    <div class="cap" style="margin:10px 4px 6px">Режим периода · цикл = с 20-го по 19-е</div>
    <div class="chips" style="padding:0 0 10px">
      <button class="chip" id="imCal" data-act="i-mode" data-v="cal">Календарь</button>
      <button class="chip" id="imCyc" data-act="i-mode" data-v="cyc">Цикл зарплаты</button>
    </div>
    <div class="h-controls">
      <div class="msw"><button data-act="i-prev">‹</button><b id="iLabel">--</b><button data-act="i-next">›</button></div>
      <div class="dd">
        <button class="dd-btn" data-act="dd-toggle"><svg class="ic"><use href="#i-cal"/></svg><span>Период</span><svg class="ic chev"><use href="#i-chev"/></svg></button>
        <div class="dd-list">
          <button data-act="i-quick" data-v="m">Этот месяц</button>
          <button data-act="i-quick" data-v="pm">Прошлый месяц</button>
          <button data-act="i-quick" data-v="q">3 месяца</button>
          <button data-act="i-quick" data-v="y">Год</button>
          <button data-act="i-quick" data-v="all">Всё время</button>
          <button data-act="i-period"><svg class="ic"><use href="#i-cal"/></svg>Свой период…</button>
        </div>
      </div>
      <div class="dd">
        <button class="dd-btn" data-act="dd-toggle"><svg class="ic"><use href="#i-grid"/></svg><span id="iKindLbl">Все типы</span><svg class="ic chev"><use href="#i-chev"/></svg></button>
        <div class="dd-list" id="iKindList"></div>
      </div>
    </div>
    <div id="iAvgBox"></div>
    <div id="iStructBox"></div>
    <div id="iCashbackBox"></div>
    <div id="iSum" class="hist-sum"></div>
    <div class="cap" style="margin:10px 4px 6px">Поступления · тап по строке — редактирование</div>
    <div id="incList"></div>
  </div>
</div>
