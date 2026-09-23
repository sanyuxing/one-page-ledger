const STORAGE_KEY = "one-page-ledger-records";

let records = [];
let selectedCategory = "餐饮";
let toastTimer = null;


/* =========================================
   初始化
   ========================================= */

init();


function init() {

  console.log("一页账本 JS 开始初始化");

  records = loadRecords();

  updateTodayTitle();

  bindEvents();

  render();

  registerServiceWorker();

  console.log("一页账本 JS 初始化完成");
}


/* =========================================
   DOM
   ========================================= */

function get(id) {
  return document.getElementById(id);
}


/* =========================================
   日期
   ========================================= */

function getTodayString() {

  const now = new Date();

  const year = now.getFullYear();

  const month =
    String(now.getMonth() + 1).padStart(2, "0");

  const day =
    String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function updateTodayTitle() {

  const element = get("todayTitle");

  if (!element) return;

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

  element.textContent =
    `${now.getMonth() + 1}月${now.getDate()}日 · ${weekdays[now.getDay()]}`;
}


/* =========================================
   数据
   ========================================= */

function loadRecords() {

  try {

    const saved =
      localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return [];
    }

    const data = JSON.parse(saved);

    return Array.isArray(data)
      ? data
      : [];

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

  const addBtn = get("addBtn");
  const closeModal = get("closeModal");
  const saveBtn = get("saveBtn");
  const clearTodayBtn = get("clearTodayBtn");
  const modalBackdrop = get("modalBackdrop");


  console.log("addBtn =", addBtn);
  console.log("closeModal =", closeModal);
  console.log("saveBtn =", saveBtn);
  console.log("modalBackdrop =", modalBackdrop);


  /* 记一笔 */

  if (addBtn) {

    addBtn.addEventListener("click", function () {

      console.log("记一笔按钮被点击了");

      openModal();

    });

  } else {

    console.error(
      "没有找到 id=\"addBtn\" 的按钮"
    );

  }


  /* 关闭 */

  if (closeModal) {

    closeModal.addEventListener(
      "click",
      closeRecordModal
    );

  }


  /* 保存 */

  if (saveBtn) {

    saveBtn.addEventListener(
      "click",
      addRecord
    );

  }


  /* 清空今天 */

  if (clearTodayBtn) {

    clearTodayBtn.addEventListener(
      "click",
      clearToday
    );

  }


  /* 点击背景 */

  if (modalBackdrop) {

    modalBackdrop.addEventListener(
      "click",
      function (event) {

        if (
          event.target === modalBackdrop
        ) {

          closeRecordModal();

        }

      }
    );

  }


  /* 分类 */

  const categories =
    document.querySelectorAll(".category");


  categories.forEach(category => {

    category.addEventListener(
      "click",
      function () {

        categories.forEach(item => {
          item.classList.remove("active");
        });

        category.classList.add("active");

        selectedCategory =
          category.dataset.category;

      }
    );

  });


  /* 金额 Enter */

  const amountInput =
    get("amountInput");


  if (amountInput) {

    amountInput.addEventListener(
      "keydown",
      function (event) {

        if (event.key === "Enter") {

          event.preventDefault();

          addRecord();

        }

      }
    );

  }


  /* 备注 Enter */

  const noteInput =
    get("noteInput");


  if (noteInput) {

    noteInput.addEventListener(
      "keydown",
      function (event) {

        if (event.key === "Enter") {

          event.preventDefault();

          addRecord();

        }

      }
    );

  }

}


/* =========================================
   弹窗
   ========================================= */

function openModal() {

  console.log("openModal() 执行");

  const modal =
    get("modalBackdrop");

  if (!modal) {

    console.error(
      "找不到 modalBackdrop"
    );

    return;

  }


  modal.classList.add("show");


  const amountInput =
    get("amountInput");


  if (amountInput) {

    amountInput.value = "";

    setTimeout(() => {
      amountInput.focus();
    }, 100);

  }


  const noteInput =
    get("noteInput");


  if (noteInput) {
    noteInput.value = "";
  }


  selectedCategory = "餐饮";


  const categories =
    document.querySelectorAll(".category");


  categories.forEach(category => {

    category.classList.remove("active");

  });


  const firstCategory =
    document.querySelector(
      '.category[data-category="餐饮"]'
    );


  if (firstCategory) {
    firstCategory.classList.add("active");
  }

}


function closeRecordModal() {

  const modal =
    get("modalBackdrop");

  if (!modal) return;

  modal.classList.remove("show");

}


/* =========================================
   添加记录
   ========================================= */

function addRecord() {

  const amountInput =
    get("amountInput");

  const noteInput =
    get("noteInput");


  if (!amountInput) {
    return;
  }


  const amount =
    parseFloat(amountInput.value);


  if (
    Number.isNaN(amount) ||
    amount <= 0
  ) {

    showToast("请输入正确的金额");

    amountInput.focus();

    return;

  }


  const note =
    noteInput
      ? noteInput.value.trim()
      : "";


  const record = {

    id:
      Date.now().toString(),

    amount:
      Number(amount.toFixed(2)),

    category:
      selectedCategory,

    note:
      note,

    date:
      getTodayString(),

    createdAt:
      Date.now()

  };


  records.push(record);

  saveRecords();

  render();

  closeRecordModal();

  showToast("已经记下了");

}


/* =========================================
   删除
   ========================================= */

function deleteRecord(id) {

  const confirmed =
    confirm("确定要删除这笔记录吗？");

  if (!confirmed) return;


  records =
    records.filter(
      record =>
        String(record.id) !== String(id)
    );


  saveRecords();

  render();

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


  if (
    !confirm(
      "确定要清空今天的所有记录吗？"
    )
  ) {

    return;

  }


  records =
    records.filter(
      record =>
        record.date !== today
    );


  saveRecords();

  render();

  showToast("今天的记录已清空");

}


/* =========================================
   渲染
   ========================================= */

function render() {

  renderSummary();

  renderRecords();

}


function renderSummary() {

  const today =
    getTodayString();


  const now =
    new Date();


  const todayRecords =
    records.filter(
      record =>
        record.date === today
    );


  const monthRecords =
    records.filter(record => {

      const date =
        new Date(
          record.date + "T00:00:00"
        );

      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );

    });


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


  const todayTotal =
    get("todayTotal");

  const todayCount =
    get("todayCount");

  const monthTotal =
    get("monthTotal");


  if (todayTotal) {

    todayTotal.textContent =
      todayAmount.toFixed(2);

  }


  if (todayCount) {

    todayCount.textContent =
      `${todayRecords.length} 笔记录`;

  }


  if (monthTotal) {

    monthTotal.textContent =
      `本月 ¥${monthAmount.toFixed(2)}`;

  }

}


/* =========================================
   账单列表
   ========================================= */

function renderRecords() {

  const list =
    get("recordList");

  const empty =
    get("emptyState");


  if (!list) return;


  const today =
    getTodayString();


  const todayRecords =
    records
      .filter(
        record =>
          record.date === today
      )
      .sort(
        (a, b) =>
          b.createdAt - a.createdAt
      );


  list.innerHTML = "";


  if (todayRecords.length === 0) {

    if (empty) {
      empty.style.display = "";
    }

    return;

  }


  if (empty) {
    empty.style.display = "none";
  }


  todayRecords.forEach(record => {

    const item =
      document.createElement("div");


    item.className =
      "record-item";


    const icon =
      getCategoryIcon(record.category);


    item.innerHTML = `

      <div class="record-left">

        <div class="record-icon">
          ${icon}
        </div>

        <div class="record-info">

          <div class="record-category">
            ${escapeHTML(record.category)}
          </div>

          ${
            record.note
              ? `
                <div class="record-note">
                  ${escapeHTML(record.note)}
                </div>
              `
              : ""
          }

        </div>

      </div>


      <div class="record-right">

        <span class="record-amount">
          ¥${Number(record.amount).toFixed(2)}
        </span>

        <button
          class="delete-record"
          data-id="${record.id}"
        >
          ×
        </button>

      </div>

    `;


    list.appendChild(item);

  });


  document
    .querySelectorAll(".delete-record")
    .forEach(button => {

      button.addEventListener(
        "click",
        function () {

          deleteRecord(
            this.dataset.id
          );

        }
      );

    });

}


/* =========================================
   分类图标
   ========================================= */

function getCategoryIcon(category) {

  const icons = {

    "餐饮": "🍚",
    "饮品": "🧋",
    "交通": "🚌",
    "购物": "🛍",
    "娱乐": "🎮",
    "学习": "📚",
    "生活": "🏠",
    "其他": "···"

  };


  return icons[category] || "···";

}


/* =========================================
   Toast
   ========================================= */

function showToast(message) {

  const toast =
    get("toast");


  if (!toast) return;


  toast.textContent =
    message;


  toast.classList.add("show");


  clearTimeout(toastTimer);


  toastTimer =
    setTimeout(() => {

      toast.classList.remove("show");

    }, 2200);

}


/* =========================================
   安全处理文字
   ========================================= */

function escapeHTML(text) {

  const div =
    document.createElement("div");


  div.textContent =
    text;


  return div.innerHTML;

}


/* =========================================
   PWA
   ========================================= */

function registerServiceWorker() {

  if (
    !("serviceWorker" in navigator)
  ) {

    return;

  }


  navigator.serviceWorker
    .register("./service-worker.js")

    .then(registration => {

      console.log(
        "一页账本 PWA 已启用",
        registration.scope
      );

    })

    .catch(error => {

      console.error(
        "Service Worker 注册失败：",
        error
      );

    });

}