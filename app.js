const STORAGE_KEY = "one-page-ledger-records";

const CATEGORY_ICONS = {
  "餐饮": "🍚",
  "饮品": "🧋",
  "交通": "🚌",
  "购物": "🛍",
  "娱乐": "🎮",
  "学习": "📚",
  "生活": "🏠",
  "其他": "···"
};

const PAGE_META = {
  today: ["ONE PAGE LEDGER", "今天"],
  bills: ["BILLS", "账单"],
  stats: ["STATISTICS", "统计"],
  settings: ["SETTINGS", "设置"]
};

let records = [];
let selectedCategory = "餐饮";

let currentView = "today";

let billsMonth = getMonthKey(new Date());
let statsMonth = getMonthKey(new Date());

let editingRecordId = null;

let toastTimer = null;


/* =========================================
   初始化
========================================= */

init();

function init() {
  console.log("一页账本 JS 开始初始化");

  records = loadRecords();

  bindEvents();

  switchView("today");

  registerServiceWorker();

  console.log("一页账本 JS 初始化完成");
}


/* =========================================
   基础 DOM
========================================= */

function get(id) {
  return document.getElementById(id);
}


/* =========================================
   日期工具
========================================= */

function getTodayString() {
  return formatDateKey(new Date());
}


function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}


function monthKeyToDate(key) {
  const [year, month] = key.split("-").map(Number);

  return new Date(year, month - 1, 1);
}


function shiftMonth(key, delta) {
  const date = monthKeyToDate(key);

  date.setMonth(date.getMonth() + delta);

  return getMonthKey(date);
}


function formatMonthTitle(key) {
  const date = monthKeyToDate(key);

  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}


function formatDateLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);

  const weekdays = [
    "星期日",
    "星期一",
    "星期二",
    "星期三",
    "星期四",
    "星期五",
    "星期六"
  ];

  return `${date.getMonth() + 1}月${date.getDate()}日 · ${weekdays[date.getDay()]}`;
}


function formatShortDay(day) {
  return day === 1 || day % 5 === 0
    ? String(day)
    : "";
}


function isCurrentMonth(key) {
  return key === getMonthKey(new Date());
}


function getDaysInMonth(key) {
  const date = monthKeyToDate(key);

  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  ).getDate();
}


function getElapsedDaysForMonth(key) {
  if (!isCurrentMonth(key)) {
    return getDaysInMonth(key);
  }

  return new Date().getDate();
}


/* =========================================
   数据
========================================= */

function loadRecords() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return [];
    }

    const data = JSON.parse(saved);

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(record => ({
      ...record,

      amount: Number(record.amount) || 0,

      createdAt: Number(record.createdAt) || 0,

      date: record.date || getTodayString(),

      category: record.category || "其他",

      note: record.note || ""
    }));

  } catch (error) {

    console.error("读取账本失败：", error);

    return [];
  }
}


function saveRecords() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(records)
  );
}


/* =========================================
   事件绑定
========================================= */

function bindEvents() {

  /* 记一笔 */

  get("addBtn")?.addEventListener(
    "click",
    () => openModal()
  );


  /* 关闭弹窗 */

  get("closeModal")?.addEventListener(
    "click",
    closeRecordModal
  );


  /* 保存 */

  get("saveBtn")?.addEventListener(
    "click",
    saveRecordFromModal
  );


  /* 编辑状态下删除 */

  get("deleteEditBtn")?.addEventListener(
    "click",
    deleteEditingRecord
  );


  /* 清空今天 */

  get("clearTodayBtn")?.addEventListener(
    "click",
    clearToday
  );


  /* 顶部日期按钮 */

  get("calendarBtn")?.addEventListener(
    "click",
    () => {
      switchView("today");
    }
  );


  /* 点击遮罩关闭 */

  get("modalBackdrop")?.addEventListener(
    "click",
    event => {

      if (event.target === get("modalBackdrop")) {
        closeRecordModal();
      }

    }
  );


  /* 分类 */

  document.querySelectorAll(".category").forEach(
    category => {

      category.addEventListener(
        "click",
        () => {
          selectCategory(
            category.dataset.category
          );
        }
      );

    }
  );


  /* 底部导航 */

  document.querySelectorAll(".nav-item").forEach(
    item => {

      item.addEventListener(
        "click",
        () => {
          switchView(item.dataset.view);
        }
      );

    }
  );


  /* 账单月份 */

  get("billsPrevMonth")?.addEventListener(
    "click",
    () => {

      billsMonth = shiftMonth(
        billsMonth,
        -1
      );

      renderBills();
    }
  );


  get("billsNextMonth")?.addEventListener(
    "click",
    () => {

      billsMonth = shiftMonth(
        billsMonth,
        1
      );

      renderBills();
    }
  );


  /* 统计月份 */

  get("statsPrevMonth")?.addEventListener(
    "click",
    () => {

      statsMonth = shiftMonth(
        statsMonth,
        -1
      );

      renderStats();
    }
  );


  get("statsNextMonth")?.addEventListener(
    "click",
    () => {

      statsMonth = shiftMonth(
        statsMonth,
        1
      );

      renderStats();
    }
  );


  /* 回车保存 */

  ["amountInput", "noteInput"].forEach(id => {

    get(id)?.addEventListener(
      "keydown",
      event => {

        if (event.key === "Enter") {

          event.preventDefault();

          saveRecordFromModal();
        }

      }
    );

  });
}


/* =========================================
   页面切换
========================================= */

function switchView(view) {

  currentView = view;


  document
    .querySelectorAll(".page-view")
    .forEach(page => {

      page.classList.toggle(
        "hidden",
        page.id !== `${view}View`
      );

    });


  document
    .querySelectorAll(".nav-item")
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.view === view
      );

    });


  const meta =
    PAGE_META[view] ||
    PAGE_META.today;


  get("pageEyebrow").textContent =
    meta[0];


  get("pageTitle").textContent =
    view === "today"
      ? getTodayTitle()
      : meta[1];


  if (view === "today") {
    renderToday();
  }


  if (view === "bills") {
    renderBills();
  }


  if (view === "stats") {
    renderStats();
  }
}


/* =========================================
   今天标题
========================================= */

function getTodayTitle() {

  const now = new Date();

  const weekdays = [
    "星期日",
    "星期一",
    "星期二",
    "星期三",
    "星期四",
    "星期五",
    "星期六"
  ];

  return `${now.getMonth() + 1}月${now.getDate()}日 · ${weekdays[now.getDay()]}`;
}


/* =========================================
   弹窗
========================================= */

function openModal(record = null) {

  const modal = get("modalBackdrop");

  if (!modal) {
    return;
  }


  /* 记录当前是在新增还是编辑 */

  editingRecordId =
    record
      ? String(record.id)
      : null;


  /* 修改标题 */

  get("modalEyebrow").textContent =
    record
      ? "EDIT RECORD"
      : "NEW RECORD";


  get("modalTitle").textContent =
    record
      ? "编辑记录"
      : "记一笔";


  get("saveBtn").textContent =
    record
      ? "保存修改"
      : "保存";


  /* 删除按钮 */

  get("deleteEditBtn").classList.toggle(
    "hidden",
    !record
  );


  /* 填充内容 */

  get("amountInput").value =
    record
      ? Number(record.amount).toFixed(2)
      : "";


  get("noteInput").value =
    record?.note || "";


  selectCategory(
    record?.category || "餐饮"
  );


  /* 打开 */

  modal.classList.add("show");


  /* 自动聚焦 */

  setTimeout(
    () => {
      get("amountInput")?.focus();
    },
    100
  );
}


function closeRecordModal() {

  get("modalBackdrop")
    ?.classList.remove("show");


  editingRecordId = null;
}


/* =========================================
   分类
========================================= */

function selectCategory(category) {

  selectedCategory = category;


  document
    .querySelectorAll(".category")
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.category === category
      );

    });
}


/* =========================================
   保存记录
========================================= */

function saveRecordFromModal() {

  const amountInput =
    get("amountInput");

  const noteInput =
    get("noteInput");


  const amount =
    parseFloat(amountInput.value);


  /* 金额检查 */

  if (
    Number.isNaN(amount) ||
    amount <= 0
  ) {

    showToast("请输入正确的金额");

    amountInput.focus();

    return;
  }


  const note =
    noteInput?.value.trim() || "";


  const fixedAmount =
    Number(amount.toFixed(2));


  /* =====================================
     编辑已有记录
  ====================================== */

  if (editingRecordId) {

    const index =
      records.findIndex(
        record =>
          String(record.id) ===
          editingRecordId
      );


    if (index !== -1) {

      records[index] = {

        ...records[index],

        amount: fixedAmount,

        category: selectedCategory,

        note

      };


      saveRecords();

      closeRecordModal();

      renderAll();

      showToast("记录已更新");

      return;
    }
  }


  /* =====================================
     新增记录
  ====================================== */

  records.push({

    id:
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,

    amount: fixedAmount,

    category: selectedCategory,

    note,

    date: getTodayString(),

    createdAt: Date.now()

  });


  saveRecords();

  closeRecordModal();

  renderAll();

  showToast("已经记下了");
}


/* =========================================
   编辑状态删除
========================================= */

function deleteEditingRecord() {

  if (!editingRecordId) {
    return;
  }


  const confirmed =
    confirm("确定要删除这笔记录吗？");


  if (!confirmed) {
    return;
  }


  records =
    records.filter(
      record =>
        String(record.id) !==
        editingRecordId
    );


  saveRecords();

  closeRecordModal();

  renderAll();

  showToast("记录已删除");
}


/* =========================================
   直接删除
========================================= */

function deleteRecord(id) {

  const confirmed =
    confirm("确定要删除这笔记录吗？");


  if (!confirmed) {
    return;
  }


  records =
    records.filter(
      record =>
        String(record.id) !==
        String(id)
    );


  saveRecords();

  renderAll();

  showToast("记录已删除");
}


/* =========================================
   清空今天
========================================= */

function clearToday() {

  const today =
    getTodayString();


  const count =
    records.filter(
      record =>
        record.date === today
    ).length;


  if (count === 0) {

    showToast("今天还没有记录");

    return;
  }


  const confirmed =
    confirm(
      "确定要清空今天的所有记录吗？"
    );


  if (!confirmed) {
    return;
  }


  records =
    records.filter(
      record =>
        record.date !== today
    );


  saveRecords();

  renderAll();

  showToast("今天的记录已清空");
}


/* =========================================
   全部刷新
========================================= */

function renderAll() {

  renderToday();


  if (currentView === "bills") {
    renderBills();
  }


  if (currentView === "stats") {
    renderStats();
  }
}


/* =========================================
   今天页面
========================================= */

function renderToday() {

  get("pageTitle").textContent =
    getTodayTitle();


  renderSummary();

  renderTodayRecords();
}


/* =========================================
   今日概览
========================================= */

function renderSummary() {

  const today =
    getTodayString();


  const currentMonth =
    getMonthKey(new Date());


  const todayRecords =
    records.filter(
      record =>
        record.date === today
    );


  const monthRecords =
    records.filter(
      record =>
        record.date.startsWith(
          currentMonth
        )
    );


  const todayAmount =
    todayRecords.reduce(
      (sum, record) =>
        sum + Number(record.amount),
      0
    );


  const monthAmount =
    monthRecords.reduce(
      (sum, record) =>
        sum + Number(record.amount),
      0
    );


  get("todayTotal").textContent =
    todayAmount.toFixed(2);


  get("todayCount").textContent =
    `${todayRecords.length} 笔记录`;


  get("monthTotal").textContent =
    `本月 ¥${monthAmount.toFixed(2)}`;
}


/* =========================================
   今天记录
========================================= */

function renderTodayRecords() {

  const list =
    get("recordList");


  const empty =
    get("emptyState");


  if (!list) {
    return;
  }


  const todayRecords =
    records

      .filter(
        record =>
          record.date ===
          getTodayString()
      )

      .sort(
        (a, b) =>
          b.createdAt -
          a.createdAt
      );


  list.innerHTML = "";


  if (todayRecords.length === 0) {

    empty?.classList.remove(
      "hidden"
    );

    return;
  }


  empty?.classList.add(
    "hidden"
  );


  todayRecords.forEach(
    record => {

      list.appendChild(
        createRecordElement(
          record,
          true
        )
      );

    }
  );
}


/* =========================================
   账单页面
========================================= */

function renderBills() {

  get("billsMonthTitle").textContent =
    formatMonthTitle(
      billsMonth
    );


  const monthRecords =
    records

      .filter(
        record =>
          record.date.startsWith(
            billsMonth
          )
      )

      .sort(
        (a, b) => {

          if (a.date !== b.date) {

            return b.date.localeCompare(
              a.date
            );
          }

          return b.createdAt -
            a.createdAt;
        }
      );


  const total =
    monthRecords.reduce(
      (sum, record) =>
        sum + Number(record.amount),
      0
    );


  get("billsMonthTotal").textContent =
    `¥${total.toFixed(2)}`;


  get("billsMonthCount").textContent =
    `${monthRecords.length} 笔`;


  const list =
    get("billsList");


  const empty =
    get("billsEmpty");


  list.innerHTML = "";


  if (monthRecords.length === 0) {

    empty.classList.remove(
      "hidden"
    );

    return;
  }


  empty.classList.add(
    "hidden"
  );


  /* =====================================
     按日期分组
  ====================================== */

  const grouped = {};


  monthRecords.forEach(
    record => {

      if (!grouped[record.date]) {
        grouped[record.date] = [];
      }


      grouped[record.date].push(
        record
      );

    }
  );


  Object.keys(grouped)

    .sort(
      (a, b) =>
        b.localeCompare(a)
    )

    .forEach(
      dateKey => {

        const dayRecords =
          grouped[dateKey];


        const dayTotal =
          dayRecords.reduce(
            (sum, record) =>
              sum + Number(record.amount),
            0
          );


        const day =
          document.createElement(
            "section"
          );


        day.className =
          "bill-day";


        /* 日期标题 */

        const header =
          document.createElement(
            "div"
          );


        header.className =
          "bill-day-header";


        header.innerHTML = `

          <div>

            <strong>
              ${formatDateLabel(
                dateKey
              )}
            </strong>

            <span>
              ${dayRecords.length} 笔
            </span>

          </div>

          <b>
            ¥${dayTotal.toFixed(2)}
          </b>

        `;


        /* 当天记录 */

        const recordsWrap =
          document.createElement(
            "div"
          );


        recordsWrap.className =
          "bill-record-list";


        dayRecords.forEach(
          record => {

            recordsWrap.appendChild(
              createRecordElement(
                record,
                false
              )
            );

          }
        );


        day.appendChild(header);

        day.appendChild(
          recordsWrap
        );


        list.appendChild(day);
      }
    );
}


/* =========================================
   统计页面
========================================= */

function renderStats() {

  get("statsMonthTitle").textContent =
    formatMonthTitle(
      statsMonth
    );


  const monthRecords =
    records.filter(
      record =>
        record.date.startsWith(
          statsMonth
        )
    );


  const total =
    monthRecords.reduce(
      (sum, record) =>
        sum + Number(record.amount),
      0
    );


  const count =
    monthRecords.length;


  const days =
    getElapsedDaysForMonth(
      statsMonth
    );


  const average =
    days > 0
      ? total / days
      : 0;


  get("statsTotal").textContent =
    `¥${total.toFixed(2)}`;


  get("statsCount").textContent =
    count;


  get("statsAverage").textContent =
    `¥${average.toFixed(2)}`;


  get("categoryTotalHint").textContent =
    `共 ¥${total.toFixed(2)}`;


  renderCategoryStats(
    monthRecords,
    total
  );


  renderDailyChart(
    monthRecords
  );


  renderTopCategories(
    monthRecords,
    total
  );


  get("statsEmpty")
    .classList.toggle(
      "hidden",
      count !== 0
    );
}


/* =========================================
   分类统计
========================================= */

function renderCategoryStats(
  monthRecords,
  total
) {

  const container =
    get("categoryStats");


  container.innerHTML = "";


  if (monthRecords.length === 0) {

    container.innerHTML = `
      <p class="panel-empty">
        记录几笔之后，这里会出现分类统计。
      </p>
    `;

    return;
  }


  const categoryTotals =
    getCategoryTotals(
      monthRecords
    );


  const max =
    Math.max(
      ...Object.values(
        categoryTotals
      )
    );


  Object.entries(categoryTotals)

    .sort(
      (a, b) =>
        b[1] - a[1]
    )

    .forEach(
      ([category, amount]) => {

        const percentage =
          total > 0
            ? amount / total * 100
            : 0;


        const row =
          document.createElement(
            "div"
          );


        row.className =
          "category-stat-row";


        row.innerHTML = `

          <div class="category-stat-top">

            <div class="category-stat-name">

              <span class="mini-category-icon">
                ${getCategoryIcon(category)}
              </span>

              <span>
                ${escapeHTML(category)}
              </span>

            </div>


            <div class="category-stat-value">

              <strong>
                ¥${amount.toFixed(2)}
              </strong>

              <span>
                ${percentage.toFixed(0)}%
              </span>

            </div>

          </div>


          <div class="progress-track">

            <div
              class="progress-fill"
              style="
                width:${
                  max
                    ? amount / max * 100
                    : 0
                }%
              "
            ></div>

          </div>

        `;


        container.appendChild(
          row
        );

      }
    );
}


/* =========================================
   每日消费图
========================================= */

function renderDailyChart(
  monthRecords
) {

  const chart =
    get("dailyChart");


  chart.innerHTML = "";


  const days =
    getDaysInMonth(
      statsMonth
    );


  const dailyTotals = {};


  monthRecords.forEach(
    record => {

      const day =
        Number(
          record.date.slice(-2)
        );


      dailyTotals[day] =
        (
          dailyTotals[day] || 0
        ) +
        Number(record.amount);

    }
  );


  const values =
    Array.from(
      { length: days },
      (_, index) =>
        dailyTotals[index + 1] || 0
    );


  const max =
    Math.max(
      ...values,
      1
    );


  values.forEach(
    (value, index) => {

      const day =
        index + 1;


      const column =
        document.createElement(
          "div"
        );


      column.className =
        "chart-column";


      column.innerHTML = `

        <span class="chart-value">

          ${
            value > 0
              ? `¥${value.toFixed(0)}`
              : ""
          }

        </span>


        <div class="chart-bar-wrap">

          <div
            class="
              chart-bar
              ${value > 0 ? "has-value" : ""}
            "
            style="
              height:${
                value
                  ? Math.max(
                      value / max * 100,
                      7
                    )
                  : 2
              }%
            "
          ></div>

        </div>


        <span class="chart-label">
          ${formatShortDay(day)}
        </span>

      `;


      chart.appendChild(
        column
      );

    }
  );
}


/* =========================================
   消费最多的分类
========================================= */

function renderTopCategories(
  monthRecords,
  total
) {

  const container =
    get("topCategories");


  container.innerHTML = "";


  const totals =
    getCategoryTotals(
      monthRecords
    );


  const entries =
    Object.entries(totals)

      .sort(
        (a, b) =>
          b[1] - a[1]
      )

      .slice(0, 3);


  get("topCategoryHint").textContent =
    entries.length
      ? `前 ${entries.length} 类`
      : "";


  if (entries.length === 0) {

    container.innerHTML = `
      <p class="panel-empty">
        暂时没有分类数据。
      </p>
    `;

    return;
  }


  entries.forEach(
    ([category, amount], index) => {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "top-category";


      const percentage =
        total
          ? (
              amount / total * 100
            ).toFixed(0)
          : 0;


      const categoryCount =
        monthRecords.filter(
          record =>
            record.category ===
            category
        ).length;


      item.innerHTML = `

        <span class="top-rank">
          ${index + 1}
        </span>


        <span class="top-icon">
          ${getCategoryIcon(category)}
        </span>


        <div class="top-info">

          <strong>
            ${escapeHTML(category)}
          </strong>

          <span>
            ${percentage}%
            ·
            ${categoryCount} 笔
          </span>

        </div>


        <b>
          ¥${amount.toFixed(2)}
        </b>

      `;


      container.appendChild(
        item
      );

    }
  );
}


/* =========================================
   分类总额
========================================= */

function getCategoryTotals(
  monthRecords
) {

  return monthRecords.reduce(
    (result, record) => {

      const category =
        record.category ||
        "其他";


      result[category] =
        (
          result[category] ||
          0
        ) +
        Number(record.amount);


      return result;

    },
    {}
  );
}


/* =========================================
   创建一条账单 DOM
========================================= */

function createRecordElement(
  record,
  showDeleteButton = false
) {

  const item =
    document.createElement(
      "div"
    );


  item.className =
    "record";


  item.setAttribute(
    "role",
    "button"
  );


  item.tabIndex = 0;


  const deleteButton =
    showDeleteButton

      ? `
        <button
          class="delete-record"
          type="button"
          aria-label="删除记录"
        >
          ×
        </button>
      `

      : "";


  item.innerHTML = `

    <div class="record-icon">
      ${getCategoryIcon(
        record.category
      )}
    </div>


    <div class="record-info">

      <div class="record-category">
        ${escapeHTML(
          record.category
        )}
      </div>

      ${
        record.note
          ? `
            <div class="record-note">
              ${escapeHTML(
                record.note
              )}
            </div>
          `
          : ""
      }

    </div>


    <div class="record-right">

      <span class="record-amount">
        ¥${Number(
          record.amount
        ).toFixed(2)}
      </span>

      ${deleteButton}

    </div>

  `;


  /* 点击账单 = 编辑 */

  item.addEventListener(
    "click",
    event => {

      if (
        event.target.closest(
          ".delete-record"
        )
      ) {

        event.stopPropagation();

        deleteRecord(
          record.id
        );

        return;
      }


      openModal(record);
    }
  );


  /* 键盘操作 */

  item.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter" ||
        event.key === " "
      ) {

        event.preventDefault();

        openModal(record);
      }

    }
  );


  return item;
}


/* =========================================
   分类图标
========================================= */

function getCategoryIcon(
  category
) {

  return (
    CATEGORY_ICONS[category] ||
    CATEGORY_ICONS["其他"]
  );
}


/* =========================================
   Toast
========================================= */

function showToast(message) {

  const toast =
    get("toast");


  if (!toast) {
    return;
  }


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      2200
    );
}


/* =========================================
   HTML 转义
========================================= */

function escapeHTML(text) {

  const div =
    document.createElement(
      "div"
    );


  div.textContent =
    String(text ?? "");


  return div.innerHTML;
}


/* =========================================
   Service Worker
========================================= */

function registerServiceWorker() {

  if (
    !("serviceWorker" in navigator)
  ) {
    return;
  }


  navigator.serviceWorker

    .register(
      "./service-worker.js"
    )

    .then(
      registration => {

        console.log(
          "一页账本 PWA 已启用",
          registration.scope
        );

      }
    )

    .catch(
      error => {

        console.error(
          "Service Worker 注册失败：",
          error
        );

      }
    );
}