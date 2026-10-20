(function(){
  'use strict';

  /* ---------- nav scroll state ---------- */
  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var hero = document.getElementById('top');

  function onScroll(){
    var past = window.scrollY > (window.innerHeight * 0.72) - 90;
    nav.classList.toggle('solid', past);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, {passive:true});

  /* ---------- mobile menu ---------- */
  burger.addEventListener('click', function(){
    var open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  });
  document.querySelectorAll('#navlinks a').forEach(function(a){
    a.addEventListener('click', function(){
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded','false');
      document.body.style.overflow = '';
    });
  });

  /* ---------- scroll reveal ---------- */
  var reveals = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, {rootMargin:'0px 0px -8% 0px', threshold:0.08});
    reveals.forEach(function(el){ io.observe(el); });
  } else {
    reveals.forEach(function(el){ el.classList.add('in'); });
  }

  /* ---------- opening hours (Africa/Nairobi, UTC+3, no DST) ---------- */
  var HOURS = {
    0: {open:12*60, close:22*60}, 1: {open:12*60, close:22*60},
    2: {open:12*60, close:22*60}, 3: {open:12*60, close:22*60},
    4: {open:12*60, close:22*60}, 5: {open:12*60, close:22*60+30},
    6: {open:12*60, close:22*60+30}
  };
  function nairobiNow(){
    var now = new Date();
    var utc = now.getTime() + now.getTimezoneOffset()*60000;
    return new Date(utc + 3*3600000);
  }
  function fmt(mins){
    var h = Math.floor(mins/60), m = mins%60;
    return h + ':' + (m<10?'0':'') + m;
  }
  function updateOpen(){
    var d = nairobiNow();
    var day = d.getDay();
    var mins = d.getHours()*60 + d.getMinutes();
    var today = HOURS[day];
    var badge = document.getElementById('openBadge');
    var txt = document.getElementById('openText');
    var isOpen = mins >= today.open && mins < today.close;

    if (isOpen){
      badge.classList.remove('closed');
      var left = today.close - mins;
      txt.textContent = left <= 60
        ? 'Open now · closes soon at ' + fmt(today.close)
        : 'Open now · until ' + fmt(today.close);
    } else if (mins < today.open){
      badge.classList.remove('closed');
      txt.textContent = 'Opens today at ' + fmt(today.open);
    } else {
      badge.classList.add('closed');
      var nd = (day + 1) % 7;
      txt.textContent = 'Closed now · opens ' + (['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][nd]) + ' at ' + fmt(HOURS[nd].open);
    }

    document.querySelectorAll('#hoursTable tr').forEach(function(tr){
      tr.classList.toggle('today', Number(tr.getAttribute('data-day')) === day);
    });
  }
  updateOpen();
  setInterval(updateOpen, 60000);

  /* ---------- year ---------- */
  document.getElementById('yr').textContent = new Date().getFullYear();

  /* ---------- reservations ---------- */
  (function(){
    var TO = 'foryouchineserestaurant@gmail.com';
    var form = document.getElementById('resForm');
    var done = document.getElementById('resDone');
    var alertBox = document.getElementById('resAlert');
    var summary = document.getElementById('resSummary');
    var retry = document.getElementById('resRetry');
    var lastMailto = '';
    if (!form) return;

    var DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    var F = {
      name:   document.getElementById('resName'),
      phone:  document.getElementById('resPhone'),
      email:  document.getElementById('resEmail'),
      date:   document.getElementById('resDate'),
      time:   document.getElementById('resTime'),
      guests: document.getElementById('resGuests'),
      notes:  document.getElementById('resNotes')
    };

    /* today in Nairobi (UTC+3, no DST) as YYYY-MM-DD */
    function todayISO(){
      var d = nairobiNow();
      var m = d.getMonth() + 1, day = d.getDate();
      return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    }

    /* parse YYYY-MM-DD as a local-midnight safe date */
    function parseISO(v){
      var p = String(v).split('-');
      if (p.length !== 3) return null;
      var y = Number(p[0]), m = Number(p[1]), d = Number(p[2]);
      if (!y || !m || !d) return null;
      var dt = new Date(y, m - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
      return dt;
    }

    function longDate(dt){
      return DAY_NAMES[dt.getDay()] + ', ' + dt.getDate() + ' ' + MONTH_NAMES[dt.getMonth()] + ' ' + dt.getFullYear();
    }
    function shortDate(dt){
      return DAY_NAMES[dt.getDay()].slice(0,3) + ' ' + dt.getDate() + ' ' + MONTH_NAMES[dt.getMonth()].slice(0,3) + ' ' + dt.getFullYear();
    }
    function fmtTime(v){
      var p = String(v).split(':');
      if (p.length < 2) return v;
      var h = Number(p[0]), m = Number(p[1]);
      var ap = h >= 12 ? 'pm' : 'am';
      var hh = h % 12; if (hh === 0) hh = 12;
      return hh + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
    }

    /* set the earliest selectable date */
    F.date.setAttribute('min', todayISO());

    /* ---------- whatsapp ---------- */
    var WA_NUMBER = '254733648724';
    var WA_DEFAULT = "Hello For You Chinese Restaurant, I'd like to enquire about a reservation.";
    syncWhatsApp();

    function fieldOf(input){ return input.closest('.res-field'); }
    function setError(input, msg){
      var wrap = fieldOf(input);
      if (!wrap) return;
      wrap.classList.add('bad');
      input.setAttribute('aria-invalid','true');
      var err = wrap.querySelector('.res-err');
      if (err && msg) err.textContent = msg;
    }
    function clearError(input){
      var wrap = fieldOf(input);
      if (!wrap) return;
      wrap.classList.remove('bad');
      input.removeAttribute('aria-invalid');
    }

    var EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

    function validate(){
      var ok = true;
      var firstBad = null;
      function fail(input, msg){
        setError(input, msg);
        ok = false;
        if (!firstBad) firstBad = input;
      }

      Object.keys(F).forEach(function(k){ clearError(F[k]); });

      var name = F.name.value.trim();
      if (!name) fail(F.name, 'Please tell us your name.');
      else if (name.length < 2) fail(F.name, 'Please enter your full name.');

      var phone = F.phone.value.trim();
      var digits = phone.replace(/[^0-9]/g, '');
      if (!phone) fail(F.phone, 'Enter a phone number we can reach you on.');
      else if (digits.length < 9 || digits.length > 15) fail(F.phone, 'That number looks too short — include the area or mobile code.');

      var email = F.email.value.trim();
      if (!email) fail(F.email, 'Enter your email address so we can confirm.');
      else if (!EMAIL_RE.test(email)) fail(F.email, 'Enter a valid email address, like name@example.com.');

      var dt = parseISO(F.date.value);
      if (!F.date.value) fail(F.date, 'Choose the date you would like to visit.');
      else if (!dt) fail(F.date, 'That date does not look right — please pick it again.');
      else if (F.date.value < todayISO()) fail(F.date, 'That date has already passed. Pick today or later.');

      var tv = F.time.value;
      if (!tv) fail(F.time, 'Choose a time for your table.');
      else {
        var parts = tv.split(':');
        var mins = Number(parts[0]) * 60 + Number(parts[1]);
        var closeMins = 22 * 60;
        if (dt && (dt.getDay() === 5 || dt.getDay() === 6)) closeMins = 22 * 60 + 30;
        var closeTxt = (dt && (dt.getDay() === 5 || dt.getDay() === 6)) ? '10:30 pm' : '10:00 pm';
        if (isNaN(mins)) fail(F.time, 'Choose a valid time.');
        else if (mins < 12 * 60) fail(F.time, 'We open at 12:00 — please choose a lunch or dinner time.');
        else if (mins > closeMins) fail(F.time, 'We take last tables before ' + closeTxt + ' — please choose an earlier time.');
      }

      var gv = F.guests.value.trim();
      if (!gv) fail(F.guests, 'How many guests will be joining you?');
      else if (!/^\d+$/.test(gv)) fail(F.guests, 'Please enter guests as a whole number, e.g. 4.');
      else if (Number(gv) < 1) fail(F.guests, 'At least one guest, please.');
      else if (Number(gv) > 40) fail(F.guests, 'For more than 40 guests, please call us on 0733 648 724.');

      return {ok: ok, firstBad: firstBad, dt: dt};
    }

    function buildMailto(dt){
      var name = F.name.value.trim();
      var guests = Number(F.guests.value.trim());
      var notes = F.notes.value.trim();
      var subject = 'Reservation Enquiry \u2013 ' + name + ' \u2013 ' + shortDate(dt);

      var lines = [
        'Hello For You Chinese Restaurant,',
        '',
        'I would like to enquire about a table. Details below:',
        '',
        'Name: ' + name,
        'Phone: ' + F.phone.value.trim(),
        'Email: ' + F.email.value.trim(),
        'Date: ' + longDate(dt),
        'Time: ' + fmtTime(F.time.value),
        'Guests: ' + guests + (guests === 1 ? ' person' : ' people'),
        '',
        'Special requests:',
        (notes ? notes : 'None'),
        '',
        'Please let me know whether this is available.',
        '',
        'Thank you,'
      ];

      var body = lines.join('\r\n');
      return {
        href: 'mailto:' + TO +
              '?subject=' + encodeURIComponent(subject) +
              '&body=' + encodeURIComponent(body),
        subject: subject,
        dt: dt,
        guests: guests
      };
    }

    /* ---------- whatsapp message builder ---------- */
    function waMessage(dt){
      var name = F.name.value.trim();
      var dateVal = F.date.value;
      var timeVal = F.time.value;
      var guestsVal = F.guests.value.trim();
      var notes = F.notes.value.trim();

      var hasDetails = !!(name || dateVal || timeVal || guestsVal || notes);
      if (!hasDetails) return WA_DEFAULT;

      var lines = [WA_DEFAULT, ''];
      if (name) lines.push('Name: ' + name);
      if (dateVal){
        var d = parseISO(dateVal);
        lines.push('Date: ' + (d ? longDate(d) : dateVal));
      }
      if (timeVal) lines.push('Time: ' + fmtTime(timeVal));
      if (guestsVal && /^\d+$/.test(guestsVal)){
        var g = Number(guestsVal);
        lines.push('Guests: ' + g + (g === 1 ? ' person' : ' people'));
      }
      if (notes) lines.push('Special requests: ' + notes);
      return lines.join('\n');
    }

    function waHref(dt){
      return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(waMessage(dt));
    }

    /* keep every WhatsApp link on the page in step with the form */
    function syncWhatsApp(dt){
      var href = waHref(dt);
      document.querySelectorAll('[data-wa]').forEach(function(a){
        a.setAttribute('href', href);
      });
    }

    function showSummary(dt){
      summary.innerHTML = '';
      var rows = [
        ['Name', F.name.value.trim()],
        ['Date', longDate(dt)],
        ['Time', fmtTime(F.time.value)],
        ['Guests', String(Number(F.guests.value.trim()))],
        ['Phone', F.phone.value.trim()],
        ['Email', F.email.value.trim()]
      ];
      var notes = F.notes.value.trim();
      if (notes) rows.push(['Requests', notes]);

      rows.forEach(function(r){
        var d = document.createElement('div');
        var t = document.createElement('dt');
        var v = document.createElement('dd');
        t.textContent = r[0];
        v.textContent = r[1];
        d.appendChild(t); d.appendChild(v);
        summary.appendChild(d);
      });
    }

    function submit(e){
      e.preventDefault();
      alertBox.classList.remove('show');
      var res = validate();

      if (!res.ok){
        alertBox.classList.add('show');
        if (res.firstBad) res.firstBad.focus({preventScroll:false});
        return;
      }

      var mail = buildMailto(res.dt);
      lastMailto = mail.href;
      retry.setAttribute('href', lastMailto);
      showSummary(res.dt);
      syncWhatsApp(res.dt);

      /* open the visitor's mail client */
    
      /* open the visitor's mail client */
      window.location.href = mail.href;

      /* Show confirmation without interrupting the email link */
      form.hidden = true;
      done.hidden = false;
      if (done.focus) done.focus({preventScroll:true});
    }

    form.addEventListener('submit', submit);

    /* clear a field's error as soon as the visitor edits it */
    Object.keys(F).forEach(function(k){
      var el = F[k];
      el.addEventListener('input', function(){ clearError(el); syncWhatsApp(); });
      el.addEventListener('change', function(){ clearError(el); syncWhatsApp(); });
      el.addEventListener('blur', function(){
        if (fieldOf(el) && fieldOf(el).classList.contains('bad')) validate();
      });
    });


    document.getElementById('resEdit').addEventListener('click', function(){
      done.hidden = true;
      form.hidden = false;
      F.name.focus({preventScroll:true});
    });

    /* if the mail client fails to open, fall back gracefully */
    retry.addEventListener('click', function(){
      if (!lastMailto) return;
      window.location.href = lastMailto;
    });
  })();
})();