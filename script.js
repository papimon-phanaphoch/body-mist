/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   ========================================================== */

var APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyXKH3WMn2QcAPN83kVIkuTYcjiI8IWY6OTGzkJHRnTZIAGEjOzRhIMy62PDMefjFg/exec';

var SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSV1l7zus7dr7DzhIZYGIxtiXr3fn5pj1x-tfEj-9ZSXOQFe8zoDI0zFvAjbFwucDCUESEQwqnRa0H7/pub?gid=0&single=true&output=csv';

var MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

var TYPE_LABELS = { spray: 'น้ำหอมฉีดตัว', rollon: 'โรลออน' };

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm')) initOrderPage();
  if (document.querySelector('#ordersTable tbody')) initAdminPage();
});

/* ---------- helpers ---------- */

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatPrice(n) {
  return Number(n).toLocaleString('th-TH');
}

/* ==========================================================
   1) หน้า product.html
   ========================================================== */

function initProductPage() {
  var listEl = document.getElementById('product-list');
  var barEl = document.getElementById('filter-bar');
  var products = [];

  var params = new URLSearchParams(window.location.search);
  var requested = (params.get('mood') || 'all').toLowerCase();
  var current = MOODS.some(function (m) { return m.key === requested; })
    ? requested
    : 'all';

  function renderFilters() {
    if (!barEl) return;
    barEl.innerHTML = '';
    MOODS.forEach(function (m) {
      var btn = el('button', 'chip' + (m.key === current ? ' is-active' : ''));
      btn.type = 'button';
      btn.setAttribute('aria-pressed', m.key === current ? 'true' : 'false');
      if (m.key !== 'all') {
        btn.setAttribute('data-mood', m.key);
        btn.appendChild(el('span', 'mood-dot'));
      }
      btn.appendChild(document.createTextNode(m.label));
      btn.addEventListener('click', function () {
        current = m.key;
        var url = new URL(window.location.href);
        if (current === 'all') url.searchParams.delete('mood');
        else url.searchParams.set('mood', current);
        window.history.replaceState(null, '', url);
        renderFilters();
        renderProducts();
      });
      barEl.appendChild(btn);
    });
  }

  function buildCard(p) {
    var itemName = p.size ? p.name + ' ' + p.size : p.name;
    var orderUrl =
      'order.html?' +
      new URLSearchParams({ item: itemName, price: p.price }).toString();

    var card = el('article', 'product-card');
    card.setAttribute('data-mood', p.mood);

    var media = el('div', 'product-card__media');
    var img = document.createElement('img');
    img.src = p.image;
    img.alt = p.name;
    img.loading = 'lazy';
    media.appendChild(img);

    var body = el('div', 'product-card__body');
    var name = el('h3', 'product-card__name');
    name.appendChild(el('span', 'mood-dot'));
    name.appendChild(document.createTextNode(p.name));
    body.appendChild(name);
    body.appendChild(
      el('div', 'product-card__meta', p.size || TYPE_LABELS[p.type] || '')
    );

    var foot = el('div', 'product-card__foot');
    var price = el('span', 'price', formatPrice(p.price));
    price.appendChild(el('small', '', 'บาท'));
    var buy = el('a', 'btn', 'สั่งซื้อ');
    buy.href = orderUrl;
    foot.appendChild(price);
    foot.appendChild(buy);
    body.appendChild(foot);

    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  function renderProducts() {
    listEl.innerHTML = '';
    var shown = products.filter(function (p) {
      return current === 'all' || p.mood === current;
    });
    if (!shown.length) {
      listEl.appendChild(el('p', '', 'ยังไม่มีสินค้าในหมวดนี้'));
      return;
    }
    shown.forEach(function (p) { listEl.appendChild(buildCard(p)); });
  }

  renderFilters();

  fetch('products.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      products = data;
      renderProducts();
    })
    .catch(function (err) {
      console.error(err);
      listEl.innerHTML = '';
      listEl.appendChild(el('p', '', 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
    });
}

/* ==========================================================
   2) หน้า order.html
   ========================================================== */

function initOrderPage() {
  var form = document.getElementById('orderForm');
  var itemsEl = document.getElementById('items');
  var totalEl = document.getElementById('total');

  // เติมค่าจาก URL parameter ทันทีที่โหลดหน้า (ทั้ง items และ total)
  var params = new URLSearchParams(window.location.search);
  var item = params.get('item');
  var price = params.get('price');
  if (item && itemsEl) itemsEl.value = item;
  if (price && totalEl) totalEl.value = price;

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    var payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: document.getElementById('items').value.trim(),
      total: document.getElementById('total').value.trim(),
      note: document.getElementById('note').value.trim()
    };

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      if (submitBtn) submitBtn.disabled = false;
    });
  });
}

/* ==========================================================
   3) หน้า admin.html
   ========================================================== */

// parse CSV เอง: รองรับ "…" ครอบค่า, "" แทนเครื่องหมายคำพูด, ขึ้นบรรทัดใหม่ในช่อง, CRLF, BOM
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;

  for (var i = 0; i < text.length; i++) {
    var c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }

  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  // ตัดแถวว่าง
  return rows.filter(function (r) {
    return r.some(function (cell) { return cell.trim() !== ''; });
  });
}

function initAdminPage() {
  var tbody = document.querySelector('#ordersTable tbody');
  var COLS = 6;

  function message(text) {
    tbody.innerHTML = '';
    var tr = document.createElement('tr');
    var td = el('td', '', text);
    td.colSpan = COLS;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  message('กำลังโหลดข้อมูล...');

  fetch(SHEET_CSV_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows = parseCSV(text);

      // ถ้าแถวแรกเป็นหัวตาราง (คอลัมน์ A ไม่มีตัวเลขเลย) ให้ข้าม
      if (rows.length && !/\d/.test(rows[0][0] || '')) rows.shift();

      // ล่าสุดขึ้นก่อน (Apps Script เพิ่มแถวต่อท้ายเสมอ)
      rows.reverse();

      if (!rows.length) {
        message('ยังไม่มีรายการสั่งซื้อ');
        return;
      }

      tbody.innerHTML = '';
      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        for (var i = 0; i < COLS; i++) {
          tr.appendChild(el('td', '', r[i] !== undefined ? r[i] : ''));
        }
        tbody.appendChild(tr);
      });
    })
    .catch(function (err) {
      console.error(err);
      message('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    });
}
