/* =========================================================

   一页账本 · app.js

   本地优先 + Supabase 云端同步

   \========================================================= */





/* =========================

   1. Supabase

   \========================= */



const SUPABASE_URL =

  "https\://gstgvcdfkieieaogxsgw.supabase.co";



const SUPABASE_PUBLISHABLE_KEY =

  "sb_publishable_cYtOxuVMzd78MgQRSPLbzA_FtUxm-Wp";



let supabaseClient = null;



try {

  if (

    window.supabase &&

    typeof window.supabase.createClient === "function"

  ) {

    supabaseClient = window.supabase.createClient(

      SUPABASE_URL,

      SUPABASE_PUBLISHABLE_KEY

    );

  } else {

    console.warn("Supabase SDK 未加载，将只使用本地存储。");

  }

} catch (error) {

  console.error("Supabase 初始化失败：", error);

}





/* =========================

   2. 基础配置

   \========================= */



const STORAGE_KEY = "one-page-ledger-records";

function getUserStorageKey(userId) {
  return `${STORAGE_KEY}:user:${userId}`;
}



const CATEGORIES = [

  { name: "餐饮", icon: "🍚" },

  { name: "饮品", icon: "🧋" },

  { name: "交通", icon: "🚌" },

  { name: "购物", icon: "🛍" },

  { name: "娱乐", icon: "🎮" },

  { name: "学习", icon: "📚" },

  { name: "生活", icon: "🏠" },

  { name: "其他", icon: "···" }

];



const PAGE_META = {

  today: {

    eyebrow: "ONE PAGE LEDGER",

    title: "今天"

  },



  bills: {

    eyebrow: "YOUR RECORDS",

    title: "账单"

  },



  stats: {

    eyebrow: "YOUR DATA",

    title: "统计"

  },



  settings: {

    eyebrow: "ONE PAGE LEDGER",

    title: "设置"

  }

};





/* =========================

   3. 状态

   \========================= */



let records = [];

let selectedCategory = "餐饮";

let currentView = "today";

let billsMonth = getMonthKey(new Date());

let statsMonth = getMonthKey(new Date());

let editingRecordId = null;

let toastTimer = null;

let currentUser = null;

let cloudSyncing = false;





/* =========================

   4. DOM 工具

   \========================= */



function get(id) {

  return document.getElementById(id);

}





/* =========================

   5. 初始化

   \========================= */



async function init() {

  console.log("一页账本正在初始化……");



  records = loadRecords().map(normalizeRecord);



  bindEvents();



  switchView("today");



  registerServiceWorker();



  await initAuth();



  renderAll();



  console.log("一页账本初始化完成。");

}



document.addEventListener("DOMContentLoaded", init);





/* =========================

   6. 本地存储

   \========================= */



function readRecordsFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("读取本地账单失败：", error);
    return [];
  }
}

function loadRecords() {
  return readRecordsFromStorage(STORAGE_KEY);
}

function loadUserRecords(userId) {
  if (!userId) return [];
  return readRecordsFromStorage(getUserStorageKey(userId));
}

function saveRecords() {
  try {
    const storageKey = currentUser
      ? getUserStorageKey(currentUser.id)
      : STORAGE_KEY;

    localStorage.setItem(storageKey, JSON.stringify(records));
  } catch (error) {
    console.error("保存本地账单失败：", error);
    showToast("本地保存失败");
  }
}

function clearAnonymousRecords() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("清理未登录账本失败：", error);
  }
}


/* =========================

   7. 事件绑定

   \========================= */



function bindEvents() {



  /* ---------- 账户入口 ---------- */



  document.addEventListener("click", (event) => {

    const accountEntry =

      event.target.closest("#accountEntry");



    if (!accountEntry) {

      return;

    }



    event.preventDefault();

    event.stopPropagation();



    if (currentUser) {

      const email =

        currentUser.email || "已登录";



      const confirmed = window.confirm(

        `当前账号：${email}\n\n确定要退出登录吗？`

      );



      if (confirmed) {

        handleLogout();

      }

    } else {

      openAuthModal();

    }

  });





  /* ---------- 登录弹窗关闭按钮 ---------- */



  const authClose = get("authClose");



  if (authClose) {

    authClose.addEventListener("click", (event) => {

      event.preventDefault();

      event.stopPropagation();

      closeAuthModal();

    });

  }





  /* ---------- 登录弹窗背景 ---------- */



  const authBackdrop = get("authBackdrop");



  if (authBackdrop) {

    authBackdrop.addEventListener("click", (event) => {

      if (event.target === authBackdrop) {

        closeAuthModal();

      }

    });

  }





  /* ---------- 登录 ---------- */



  const loginBtn = get("loginBtn");



  if (loginBtn) {

    loginBtn.addEventListener(

      "click",

      handleLogin

    );

  }





  /* ---------- 注册 ---------- */



  const registerBtn = get("registerBtn");



  if (registerBtn) {

    registerBtn.addEventListener(

      "click",

      handleRegister

    );

  }





  /* ---------- 切换到注册 ---------- */



  const showRegisterBtn =

    get("showRegisterBtn");



  if (showRegisterBtn) {

    showRegisterBtn.addEventListener(

      "click",

      showRegisterPanel

    );

  }





  /* ---------- 切换到登录 ---------- */



  const showLoginBtn =

    get("showLoginBtn");



  if (showLoginBtn) {

    showLoginBtn.addEventListener(

      "click",

      showLoginPanel

    );

  }





  /* ---------- 添加记录 ---------- */



  const addBtn = get("addBtn");



  if (addBtn) {

    addBtn.addEventListener("click", () => {

      openModal();

    });

  }





  /* ---------- 关闭记录弹窗 ---------- */



  const closeModal = get("closeModal");



  if (closeModal) {

    closeModal.addEventListener(

      "click",

      closeRecordModal

    );

  }





  const modalBackdrop =

    get("modalBackdrop");



  if (modalBackdrop) {

    modalBackdrop.addEventListener(

      "click",

      (event) => {

        if (event.target === modalBackdrop) {

          closeRecordModal();

        }

      }

    );

  }





  /* ---------- 保存 ---------- */



  const saveBtn = get("saveBtn");



  if (saveBtn) {

    saveBtn.addEventListener(

      "click",

      saveRecordFromModal

    );

  }





  /* ---------- 删除 ---------- */



  const deleteEditBtn =

    get("deleteEditBtn");



  if (deleteEditBtn) {

    deleteEditBtn.addEventListener(

      "click",

      deleteEditingRecord

    );

  }





  /* ---------- 日期 ---------- */



  const dateSelector =

    get("dateSelector");



  if (dateSelector) {

    dateSelector.addEventListener(

      "click",

      openDatePicker

    );

  }





  const dateInput =

    get("dateInput");



  if (dateInput) {

    dateInput.addEventListener(

      "change",

      () => {

        updateDateDisplay(

          dateInput.value

        );

      }

    );

  }





  /* ---------- 分类 ---------- */



  document

    .querySelectorAll(

      ".category-item, .category"

    )

    .forEach((item) => {

      item.addEventListener(

        "click",

        () => {

          const category =

            item.dataset.category;



          if (category) {

            selectCategory(category);

          }

        }

      );

    });





  /* ---------- 首页日历 ---------- */



  const calendarBtn =

    get("calendarBtn");



  if (calendarBtn) {

    calendarBtn.addEventListener(

      "click",

      () => {

        const dateInput =

          get("dateInput");



        if (!dateInput) {

          return;

        }



        dateInput.value =

          formatDateInput(new Date());



        updateDateDisplay(

          dateInput.value

        );



        try {

          if (

            typeof dateInput.showPicker ===

            "function"

          ) {

            dateInput.showPicker();

          } else {

            dateInput.click();

          }

        } catch (error) {

          dateInput.click();

        }

      }

    );

  }





  /* ---------- 清空今天 ---------- */



  const clearTodayBtn =

    get("clearTodayBtn");



  if (clearTodayBtn) {

    clearTodayBtn.addEventListener(

      "click",

      clearTodayRecords

    );

  }





  /* =====================================================

     底部导航

     \===================================================== */



  document

    .querySelectorAll(".nav-item")

    .forEach((item) => {



      item.addEventListener(

        "click",

        (event) => {



          event.preventDefault();



          const view =

            item.dataset.view;



          if (

            view &&

            PAGE_META[view]

          ) {

            switchView(view);

          }



        }

      );



    });





  /* ---------- 账单月份 ---------- */



  const billsPrevMonth =

    get("billsPrevMonth");



  if (billsPrevMonth) {

    billsPrevMonth.addEventListener(

      "click",

      () => {

        billsMonth =

          shiftMonth(

            billsMonth,

            -1

          );



        renderBills();

      }

    );

  }





  const billsNextMonth =

    get("billsNextMonth");



  if (billsNextMonth) {

    billsNextMonth.addEventListener(

      "click",

      () => {

        billsMonth =

          shiftMonth(

            billsMonth,

            1

          );



        renderBills();

      }

    );

  }





  /* ---------- 统计月份 ---------- */



  const statsPrevMonth =

    get("statsPrevMonth");



  if (statsPrevMonth) {

    statsPrevMonth.addEventListener(

      "click",

      () => {

        statsMonth =

          shiftMonth(

            statsMonth,

            -1

          );



        renderStats();

      }

    );

  }





  const statsNextMonth =

    get("statsNextMonth");



  if (statsNextMonth) {

    statsNextMonth.addEventListener(

      "click",

      () => {

        statsMonth =

          shiftMonth(

            statsMonth,

            1

          );



        renderStats();

      }

    );

  }





  /* ---------- 键盘 ---------- */



  document.addEventListener(

    "keydown",

    (event) => {



      if (event.key === "Escape") {

        closeRecordModal();

        closeAuthModal();

      }



    }

  );





  document.addEventListener(

    "keydown",

    (event) => {



      if (event.key !== "Enter") {

        return;

      }



      const modal =

        get("recordModal");



      if (!modal) {

        return;

      }



      if (

        !modal.classList.contains("show")

      ) {

        return;

      }



      const active =

        document.activeElement;



      if (

        active &&

        (

          active.id === "amountInput" ||

          active.id === "noteInput"

        )

      ) {

        event.preventDefault();

        saveRecordFromModal();

      }



    }

  );

}





/* =========================

   8. 页面切换

   \========================= */



function switchView(view) {



  if (!PAGE_META[view]) {

    return;

  }



  currentView = view;



  /*

   * 页面切换的核心逻辑：

   *

   * 1. active

   * 2. hidden 属性

   * 3. inline display

   *

   * 三层同时控制，避免 style.css

   * 中某一条规则导致页面全部消失。

   */



  document

    .querySelectorAll(".page-view")

    .forEach((page) => {



      const shouldShow =

        page.id === `${view}View`;



      page.classList.toggle(

        "active",

        shouldShow

      );



      page.classList.toggle(

        "hidden",

        !shouldShow

      );



      page.hidden =

        !shouldShow;



      page.style.display =

        shouldShow

          ? ""

          : "none";



    });





  /* ---------- 底部导航 active ---------- */



  document

    .querySelectorAll(".nav-item")

    .forEach((item) => {



      item.classList.toggle(

        "active",

        item.dataset.view === view

      );



    });





  /* ---------- 顶部标题 ---------- */



  const eyebrow =

    get("pageEyebrow");



  const title =

    get("pageTitle");



  if (eyebrow) {

    eyebrow.textContent =

      PAGE_META[view].eyebrow;

  }



  if (title) {

    title.textContent =

      PAGE_META[view].title;

  }





  /* ---------- 对应页面重新渲染 ---------- */



  if (view === "today") {

    renderToday();

  }



  if (view === "bills") {

    renderBills();

  }



  if (view === "stats") {

    renderStats();

  }



  if (view === "settings") {

    renderSettings();

  }

}





/* =========================

   9. 记录弹窗

   \========================= */



function openModal(record = null) {



  editingRecordId =

    record ? record.id : null;



  const modalBackdrop =

    get("modalBackdrop");



  if (!modalBackdrop) {

    return;

  }



  const amountInput =

    get("amountInput");



  const noteInput =

    get("noteInput");



  const dateInput =

    get("dateInput");



  const deleteBtn =

    get("deleteEditBtn");





  if (record) {



    if (amountInput) {

      amountInput.value =

        record.amount;

    }



    if (noteInput) {

      noteInput.value =

        record.note || "";

    }



    if (dateInput) {

      dateInput.value =

        record.date ||

        formatDateInput(new Date());



      updateDateDisplay(

        dateInput.value

      );

    }



    selectCategory(

      record.category || "餐饮"

    );



    if (deleteBtn) {

      deleteBtn.hidden = false;

      deleteBtn.classList.remove("hidden");

      deleteBtn.style.display = "flex";

    }



  } else {



    if (amountInput) {

      amountInput.value = "";

    }



    if (noteInput) {

      noteInput.value = "";

    }



    if (dateInput) {

      dateInput.value =

        formatDateInput(new Date());



      updateDateDisplay(

        dateInput.value

      );

    }



    selectCategory("餐饮");



    if (deleteBtn) {

      deleteBtn.hidden = true;

      deleteBtn.classList.add("hidden");

      deleteBtn.style.display = "none";

    }



  }





  modalBackdrop.classList.add("show");



  setTimeout(() => {

    if (amountInput) {

      amountInput.focus();

    }

  }, 100);

}





function closeRecordModal() {



  const modalBackdrop =

    get("modalBackdrop");



  if (modalBackdrop) {

    modalBackdrop.classList.remove(

      "show"

    );

  }



  editingRecordId = null;

}





function selectCategory(category) {



  selectedCategory =

    category;



  document

    .querySelectorAll(

      ".category-item, .category"

    )

    .forEach((item) => {



      item.classList.toggle(

        "active",

        item.dataset.category ===

          category

      );



    });

}





function updateDateDisplay(

  dateString

) {



  const dateDisplay =

    get("dateDisplay");



  if (

    !dateDisplay ||

    !dateString

  ) {

    return;

  }



  const date =

    parseLocalDate(dateString);



  if (isToday(date)) {



    dateDisplay.textContent =

      `今天 · ${

        date.getMonth() + 1

      }月${date.getDate()}日`;



  } else {



    dateDisplay.textContent =

      `${

        date.getMonth() + 1

      }月${date.getDate()}日`;



  }

}





function openDatePicker() {



  const dateInput =

    get("dateInput");



  if (!dateInput) {

    return;

  }



  try {



    if (

      typeof dateInput.showPicker ===

      "function"

    ) {

      dateInput.showPicker();

    } else {

      dateInput.click();

    }



  } catch (error) {

    dateInput.click();

  }

}





/* =========================

   10. 保存记录

   \========================= */



async function saveRecordFromModal() {



  const amountInput =

    get("amountInput");



  const noteInput =

    get("noteInput");



  const dateInput =

    get("dateInput");



  const saveBtn =

    get("saveBtn");



  if (

    !amountInput ||

    !dateInput

  ) {

    return;

  }



  const amount =

    Number(amountInput.value);



  if (

    !Number.isFinite(amount) ||

    amount <= 0

  ) {



    showToast(

      "请输入正确的金额"

    );



    amountInput.focus();



    return;

  }



  const date =

    dateInput.value ||

    formatDateInput(new Date());



  const note =

    noteInput

      ? noteInput.value.trim()

      : "";



  const isEditing = Boolean(editingRecordId);


  const existingRecord =

    editingRecordId

      ? records.find(

          (item) =>

            item.id ===

            editingRecordId

        )

      : null;



  const record =

    normalizeRecord({



      id:

        editingRecordId ||

        generateId(),



      user_id:

        currentUser

          ? currentUser.id

          : null,



      amount:

        Number(

          amount.toFixed(2)

        ),



      category:

        selectedCategory,



      note,



      date,



      created_at:

        existingRecord?.created_at ||

        new Date().toISOString()



    });





  if (saveBtn) {

    saveBtn.disabled = true;

  }





  try {



    /* ---------- 本地保存 ---------- */



    if (isEditing) {



      const index =

        records.findIndex(

          (item) =>

            item.id ===

            editingRecordId

        );



      if (index !== -1) {



        records[index] = {

          ...records[index],

          ...record

        };



      }



    } else {



      records.unshift(record);



    }





    saveRecords();



    closeRecordModal();



    renderAll();



    showToast(

      currentUser

        ? "已保存，正在同步云端…"

        : "已保存"

    );





    /* ---------- 云端同步 ---------- */



    if (

      currentUser &&

      supabaseClient

    ) {



      try {



        if (isEditing) {



          await updateCloudRecord(

            record

          );



        } else {



          await createCloudRecord(

            record

          );



        }



        showToast(

          "已保存并同步"

        );



      } catch (error) {



        console.error(

          "云端保存失败：",

          error

        );



        showToast(

          "已保存到本地，云端同步失败"

        );



      }



    }



  } finally {



    if (saveBtn) {

      saveBtn.disabled = false;

    }



  }

}





/* =========================

   11. 删除记录

   \========================= */



async function deleteEditingRecord() {



  if (!editingRecordId) {

    return;

  }



  const recordId =

    editingRecordId;



  const confirmed =

    window.confirm(

      "确定要删除这笔记录吗？"

    );



  if (!confirmed) {

    return;

  }



  try {



    records =

      records.filter(

        (record) =>

          record.id !==

          recordId

      );



    saveRecords();



    closeRecordModal();



    renderAll();



    showToast(

      "记录已删除"

    );





    if (

      currentUser &&

      supabaseClient

    ) {



      try {



        await deleteCloudRecord(

          recordId

        );



      } catch (error) {



        console.error(

          "云端删除失败：",

          error

        );



        showToast(

          "本地已删除，云端同步失败"

        );



      }



    }



  } catch (error) {



    console.error(

      "删除记录失败：",

      error

    );



    showToast(

      "删除失败"

    );



  }

}





/* =========================

   12. 清空今日

   \========================= */



async function clearTodayRecords() {



  const today =

    formatDateInput(new Date());



  const todayRecords =

    records.filter(

      (record) =>

        record.date === today

    );



  if (

    todayRecords.length === 0

  ) {



    showToast(

      "今天还没有记录"

    );



    return;

  }



  const confirmed =

    window.confirm(

      `确定删除今天的 ${todayRecords.length} 笔记录吗？`

    );



  if (!confirmed) {

    return;

  }



  const ids =

    todayRecords.map(

      (record) =>

        record.id

    );



  records =

    records.filter(

      (record) =>

        record.date !== today

    );



  saveRecords();



  renderAll();



  showToast(

    "今天的记录已清空"

  );





  if (

    currentUser &&

    supabaseClient

  ) {



    try {



      for (const id of ids) {

        await deleteCloudRecord(id);

      }



    } catch (error) {



      console.error(

        "云端清空失败：",

        error

      );



      showToast(

        "本地已清空，云端部分同步失败"

      );



    }



  }

}





/* =========================

   13. 今日页面

   \========================= */



function renderToday() {



  const today =

    formatDateInput(new Date());



  const todayRecords =

    records.filter(

      (record) =>

        record.date === today

    );



  const monthKey =

    getMonthKey(new Date());



  const monthRecords =

    records.filter(

      (record) =>

        record.date &&

        record.date.startsWith(

          monthKey

        )

    );



  const todayTotal =

    sumRecords(todayRecords);



  const monthTotal =

    sumRecords(monthRecords);





  const todayTotalEl =

    get("todayTotal");



  const todayCountEl =

    get("todayCount");



  const monthTotalEl =

    get("monthTotal");





  if (todayTotalEl) {

    todayTotalEl.textContent =

      formatMoney(todayTotal);

  }



  if (todayCountEl) {

    todayCountEl.textContent =

      `${todayRecords.length} 笔`;

  }



  if (monthTotalEl) {

    monthTotalEl.textContent =

      formatMoney(monthTotal);

  }





  renderTodayRecords(

    todayRecords

  );

}





function renderTodayRecords(

  todayRecords

) {



  const list =

    get("recordList");



  const empty =

    get("emptyState");



  if (!list) {

    return;

  }



  list.innerHTML = "";





  if (

    todayRecords.length === 0

  ) {



    if (empty) {

      empty.hidden = false;

    }



    return;

  }





  if (empty) {

    empty.hidden = true;

  }





  todayRecords

    .slice()

    .sort(

      (a, b) =>

        new Date(

          b.created_at || 0

        ) -

        new Date(

          a.created_at || 0

        )

    )

    .forEach(

      (record) => {



        list.appendChild(

          createRecordElement(

            record

          )

        );



      }

    );

}





/* =========================

   14. 账单页面

   \========================= */



function renderBills() {



  const title =

    get("billsMonthTitle");



  const list =

    get("billsList");



  const empty =

    get("billsEmpty");





  const monthRecords =

    records

      .filter(

        (record) =>

          record.date &&

          record.date.startsWith(

            billsMonth

          )

      )

      .sort(

        (a, b) => {



          if (

            a.date !==

            b.date

          ) {

            return b.date.localeCompare(

              a.date

            );

          }



          return (

            new Date(

              b.created_at || 0

            ) -

            new Date(

              a.created_at || 0

            )

          );



        }

      );





  if (title) {

    title.textContent =

      formatMonthTitle(

        billsMonth

      );

  }





  const total =

    sumRecords(monthRecords);



  const totalEl =

    get("billsMonthTotal");



  const countEl =

    get("billsMonthCount");





  if (totalEl) {

    totalEl.textContent =

      formatMoney(total);

  }



  if (countEl) {

    countEl.textContent =

      `${monthRecords.length} 笔`;

  }





  if (!list) {

    return;

  }



  list.innerHTML = "";





  if (

    monthRecords.length === 0

  ) {



    if (empty) {

      empty.hidden = false;

    }



    return;

  }





  if (empty) {

    empty.hidden = true;

  }





  let lastDate = null;

  let currentDayList = null;





  monthRecords.forEach(

    (record) => {



      if (

        record.date !==

        lastDate

      ) {



        const dayWrapper =

          document.createElement(

            "div"

          );



        const header =

          document.createElement(

            "div"

          );



        header.className =

          "bill-day-header";





        const headerLeft =

          document.createElement(

            "div"

          );





        const strong =

          document.createElement(

            "strong"

          );



        strong.textContent =

          formatReadableDate(

            record.date

          );





        const span =

          document.createElement(

            "span"

          );



        span.textContent =

          formatFullDate(

            record.date

          );





        headerLeft.appendChild(

          strong

        );



        headerLeft.appendChild(

          span

        );





        const dayRecords =

          monthRecords.filter(

            (item) =>

              item.date ===

              record.date

          );





        const dayTotal =

          sumRecords(

            dayRecords

          );





        const totalElement =

          document.createElement(

            "b"

          );



        totalElement.textContent =

          formatMoney(dayTotal);





        header.appendChild(

          headerLeft

        );



        header.appendChild(

          totalElement

        );





        currentDayList =

          document.createElement(

            "div"

          );



        currentDayList.className =

          "bill-record-list";





        dayWrapper.appendChild(

          header

        );



        dayWrapper.appendChild(

          currentDayList

        );





        list.appendChild(

          dayWrapper

        );





        lastDate =

          record.date;

      }





      if (currentDayList) {



        currentDayList.appendChild(

          createBillRecordElement(

            record

          )

        );



      }



    }

  );

}





/* =========================

   15. 统计页面

   \========================= */



function renderStats() {



  const title =

    get("statsMonthTitle");



  if (title) {

    title.textContent =

      formatMonthTitle(

        statsMonth

      );

  }





  const monthRecords =

    records.filter(

      (record) =>

        record.date &&

        record.date.startsWith(

          statsMonth

        )

    );





  const total =

    sumRecords(monthRecords);



  const count =

    monthRecords.length;



  const average =

    count > 0

      ? total / count

      : 0;





  const statsTotal =

    get("statsTotal");



  const statsCount =

    get("statsCount");



  const statsAverage =

    get("statsAverage");





  if (statsTotal) {

    statsTotal.textContent =

      formatMoney(total);

  }



  if (statsCount) {

    statsCount.textContent =

      `${count} 笔`;

  }



  if (statsAverage) {

    statsAverage.textContent =

      formatMoney(average);

  }





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





  const empty =

    get("statsEmpty");



  if (empty) {

    empty.hidden =

      monthRecords.length > 0;

  }

}





/* =========================

   16. 分类统计

   \========================= */



function renderCategoryStats(

  monthRecords,

  total

) {



  const container =

    get("categoryStats");



  const hint =

    get("categoryTotalHint");



  if (!container) {

    return;

  }



  container.innerHTML = "";





  if (hint) {

    hint.textContent =

      total > 0

        ? `本月共支出 ${formatMoney(total)}`

        : "本月暂无记录";

  }





  if (

    monthRecords.length === 0

  ) {

    return;

  }





  const categoryMap = {};





  monthRecords.forEach(

    (record) => {



      const category =

        record.category ||

        "其他";



      categoryMap[category] =

        (

          categoryMap[category] ||

          0

        ) +

        Number(

          record.amount || 0

        );



    }

  );





  const sorted =

    Object.entries(categoryMap)

      .sort(

        (a, b) =>

          b[1] - a[1]

      );





  sorted.forEach(

    ([category, amount]) => {



      const info =

        getCategoryInfo(

          category

        );



      const percentage =

        total > 0

          ? Math.round(

              (amount / total) *

              100

            )

          : 0;





      const row =

        document.createElement(

          "div"

        );



      row.className =

        "category-stat-row";





      row.innerHTML = `

        \<div class="category-stat-top">



          \<div class="category-stat-name">



            \<span class="mini-category-icon">

              ${info.icon}

            \</span>



            \<span>

              ${escapeHTML(category)}

            \</span>



          \</div>



          \<div class="category-stat-value">



            \<strong>

              ${formatMoney(amount)}

            \</strong>



            \<span>

              ${percentage}%

            \</span>



          \</div>



        \</div>



        \<div class="progress-track">



          \<div

            class="progress-fill"

            style="width: ${percentage}%"

          >\</div>



        \</div>

      `;





      container.appendChild(row);



    }

  );

}





/* =========================

   17. 每日统计

   \========================= */



function renderDailyChart(

  monthRecords

) {



  const container =

    get("dailyChart");



  if (!container) {

    return;

  }



  container.innerHTML = "";





  const [

    year,

    month

  ] =

    statsMonth

      .split("-")

      .map(Number);





  const daysInMonth =

    new Date(

      year,

      month,

      0

    ).getDate();





  const dailyMap = {};





  monthRecords.forEach(

    (record) => {



      dailyMap[record.date] =

        (

          dailyMap[record.date] ||

          0

        ) +

        Number(

          record.amount || 0

        );



    }

  );





  const values =

    Array.from(

      {

        length:

          daysInMonth

      },

      (_, index) => {



        const day =

          String(index + 1)

            .padStart(2, "0");



        const date =

          `${statsMonth}-${day}`;



        return (

          dailyMap[date] || 0

        );



      }

    );





  const max =

    Math.max(

      ...values,

      1

    );





  values.forEach(

    (amount, index) => {



      const day =

        index + 1;





      const column =

        document.createElement(

          "div"

        );



      column.className =

        "chart-column";





      const value =

        document.createElement(

          "div"

        );



      value.className =

        "chart-value";



      value.textContent =

        amount > 0

          ? formatMoney(amount)

          : "";





      const barWrap =

        document.createElement(

          "div"

        );



      barWrap.className =

        "chart-bar-wrap";





      const bar =

        document.createElement(

          "div"

        );



      bar.className =

        amount > 0

          ? "chart-bar has-value"

          : "chart-bar";





      const height =

        amount > 0

          ? Math.max(

              8,

              Math.round(

                (amount / max) *

                100

              )

            )

          : 0;





      bar.style.height =

        `${height}%`;





      if (amount > 0) {

        bar.title =

          formatMoney(amount);

      }





      barWrap.appendChild(

        bar

      );





      const label =

        document.createElement(

          "div"

        );



      label.className =

        "chart-label";



      label.textContent =

        day;





      column.appendChild(

        value

      );



      column.appendChild(

        barWrap

      );



      column.appendChild(

        label

      );





      container.appendChild(

        column

      );



    }

  );

}





/* =========================

   18. Top 分类

   \========================= */



function renderTopCategories(

  monthRecords,

  total

) {



  const container =

    get("topCategories");



  const hint =

    get("topCategoryHint");



  if (!container) {

    return;

  }



  container.innerHTML = "";





  if (

    monthRecords.length === 0

  ) {



    if (hint) {

      hint.textContent =

        "本月暂无记录";

    }



    return;

  }





  const categoryMap = {};





  monthRecords.forEach(

    (record) => {



      const category =

        record.category ||

        "其他";



      categoryMap[category] =

        (

          categoryMap[category] ||

          0

        ) +

        Number(

          record.amount || 0

        );



    }

  );





  const sorted =

    Object.entries(categoryMap)

      .sort(

        (a, b) =>

          b[1] - a[1]

      )

      .slice(0, 3);





  if (hint) {

    hint.textContent =

      `本月支出 ${formatMoney(total)}`;

  }





  sorted.forEach(

    ([category, amount], index) => {



      const info =

        getCategoryInfo(

          category

        );



      const percentage =

        total > 0

          ? Math.round(

              (amount / total) *

              100

            )

          : 0;





      const item =

        document.createElement(

          "div"

        );



      item.className =

        "top-category";





      item.innerHTML = `

        \<span class="top-rank">

          ${index + 1}

        \</span>



        \<span class="top-icon">

          ${info.icon}

        \</span>



        \<div class="top-info">



          \<strong>

            ${escapeHTML(category)}

          \</strong>



          \<span>

            占本月支出 ${percentage}%

          \</span>



        \</div>



        \<b>

          ${formatMoney(amount)}

        \</b>

      `;





      container.appendChild(

        item

      );



    }

  );

}





/* =========================

   19. 设置页面

   \========================= */



function renderSettings() {

  updateAccountUI();

}





/* =========================

   20. 今日 / 账单记录元素

   \========================= */



function createRecordElement(

  record

) {



  const item =

    document.createElement(

      "div"

    );



  item.className =

    "record";





  const info =

    getCategoryInfo(

      record.category

    );





  const noteHTML =

    record.note

      ? `

        \<div class="record-note">

          ${escapeHTML(record.note)}

        \</div>

      `

      : "";





  item.innerHTML = `

    \<div class="record-icon">

      ${info.icon}

    \</div>



    \<div class="record-info">



      \<div class="record-category">

        ${escapeHTML(

          record.category ||

          "其他"

        )}

      \</div>



      ${noteHTML}



    \</div>



    \<div class="record-right">



      \<div class="record-amount">

        -${formatMoney(

          record.amount

        )}

      \</div>



    \</div>

  `;





  item.addEventListener(

    "click",

    () => {

      openModal(record);

    }

  );





  return item;

}





/* =========================================================

   21. 账单页面专用记录元素

   \========================================================= */



function createBillRecordElement(

  record

) {



  const wrapper =

    document.createElement(

      "div"

    );



  wrapper.className =

    "bill-record-item";





  const info =

    getCategoryInfo(

      record.category

    );





  const main =

    document.createElement(

      "div"

    );



  main.className =

    "bill-record-main";





  const icon =

    document.createElement(

      "div"

    );



  icon.className =

    "record-icon";



  icon.textContent =

    info.icon;





  const text =

    document.createElement(

      "div"

    );



  text.className =

    "record-info";





  const category =

    document.createElement(

      "div"

    );



  category.className =

    "record-category";



  category.textContent =

    record.category ||

    "其他";





  text.appendChild(

    category

  );





  if (record.note) {



    const note =

      document.createElement(

        "div"

      );



    note.className =

      "record-note";



    note.textContent =

      record.note;



    text.appendChild(

      note

    );



  }





  const right =

    document.createElement(

      "div"

    );



  right.className =

    "bill-record-right";





  const amount =

    document.createElement(

      "div"

    );



  amount.className =

    "record-amount";



  amount.textContent =

    `-${formatMoney(

      record.amount

    )}`;





  /*

   * 删除操作统一放在“编辑记录”弹窗中。

   * 账单列表本身不再显示删除按钮。

   */



  right.appendChild(

    amount

  );





  main.appendChild(

    icon

  );



  main.appendChild(

    text

  );





  wrapper.appendChild(

    main

  );



  wrapper.appendChild(

    right

  );





  /*

   * 点击记录主体进入编辑。

   * 删除操作统一在编辑弹窗中完成。

   */



  wrapper.addEventListener(

    "click",

    () => {

      openModal(record);

    }

  );





  return wrapper;

}





/* =========================================================

   22. 根据 ID 删除记录

   \========================================================= */



async function deleteRecordById(

  recordId

) {



  const record =

    records.find(

      (item) =>

        item.id === recordId

    );



  if (!record) {

    return;

  }





  const confirmed =

    window.confirm(

      `确定要删除「${

        record.category || "其他"

      }」这笔 ${

        formatMoney(record.amount)

      } 的记录吗？`

    );





  if (!confirmed) {

    return;

  }





  try {



    records =

      records.filter(

        (item) =>

          item.id !== recordId

      );



    saveRecords();



    renderAll();



    showToast(

      "记录已删除"

    );





    if (

      currentUser &&

      supabaseClient

    ) {



      try {



        await deleteCloudRecord(

          recordId

        );



      } catch (error) {



        console.error(

          "云端删除失败：",

          error

        );



        showToast(

          "本地已删除，云端同步失败"

        );



      }



    }



  } catch (error) {



    console.error(

      "删除记录失败：",

      error

    );



    showToast(

      "删除失败"

    );



  }

}





/* =========================

   23. 云端：读取

   \========================= */



async function fetchCloudRecords() {



  if (

    !supabaseClient ||

    !currentUser

  ) {

    return [];

  }





  const {

    data,

    error

  } =

    await supabaseClient

      .from("records")

      .select(

        "id, user_id, amount, category, note, date, created_at"

      )

      .eq(

        "user_id",

        currentUser.id

      )

      .order(

        "date",

        {

          ascending: false

        }

      );





  if (error) {

    throw error;

  }





  return Array.isArray(data)

    ? data.map(normalizeRecord)

    : [];

}





/* =========================

   24. 云端：上传

   \========================= */



async function uploadRecordsToCloud(

  recordsToUpload = records

) {



  if (

    !supabaseClient ||

    !currentUser

  ) {

    return;

  }





  if (

    recordsToUpload.length === 0

  ) {

    return;

  }





  const payload =

    recordsToUpload.map(

      (record) => ({



        id:

          record.id,



        user_id:

          currentUser.id,



        amount:

          Number(record.amount),



        category:

          record.category,



        note:

          record.note || "",



        date:

          record.date,



        created_at:

          record.created_at ||

          new Date().toISOString()



      })

    );





  const {

    error

  } =

    await supabaseClient

      .from("records")

      .upsert(

        payload,

        {

          onConflict: "id"

        }

      );





  if (error) {

    throw error;

  }

}





/* =========================

   25. 云端：同步

   \========================= */



async function syncFromCloud() {

  if (!supabaseClient || !currentUser || cloudSyncing) {
    return;
  }

  cloudSyncing = true;

  try {
    const anonymousRecords = records.map(normalizeRecord);
    const cloudRecords = await fetchCloudRecords();

    if (cloudRecords.length === 0) {
      // 云端为空时，只把“未登录状态”的旧账本视为待迁移数据。
      // 不自动把账号缓存重新上传，避免在其他设备删除云端数据后又被旧缓存复活。
      if (anonymousRecords.length > 0) {
        await uploadRecordsToCloud(anonymousRecords);

        const syncedRecords = await fetchCloudRecords();
        records = syncedRecords.map(normalizeRecord);
        saveRecords();
        clearAnonymousRecords();
        renderAll();
        showToast("本地账单已同步到云端");
        return;
      }

      records = [];
      saveRecords();
      renderAll();
      return;
    }

    if (anonymousRecords.length > 0) {
      const shouldMerge = window.confirm(
        `检测到本机还有 ${anonymousRecords.length} 笔未登录账单。\n\n是否将这些账单合并到当前账号？`
      );

      if (shouldMerge) {
        await uploadRecordsToCloud(anonymousRecords);
        clearAnonymousRecords();

        const mergedCloudRecords = await fetchCloudRecords();
        records = mergedCloudRecords.map(normalizeRecord);
        saveRecords();
        renderAll();
        showToast("本地账单已合并到云端");
        return;
      }
    }

    records = cloudRecords.map(normalizeRecord);
    saveRecords();
    renderAll();
    showToast("云端账单已同步");
  } catch (error) {
    console.error("云端同步失败：", error);
    showToast("云端同步失败，本地数据仍可使用");
  } finally {
    cloudSyncing = false;
  }
}


/* =========================

   26. 云端：创建

   \========================= */



async function createCloudRecord(

  record

) {



  if (

    !supabaseClient ||

    !currentUser

  ) {

    return;

  }





  const {

    error

  } =

    await supabaseClient

      .from("records")

      .insert({



        id:

          record.id,



        user_id:

          currentUser.id,



        amount:

          Number(record.amount),



        category:

          record.category,



        note:

          record.note || "",



        date:

          record.date,



        created_at:

          record.created_at ||

          new Date().toISOString()



      });





  if (error) {

    throw error;

  }

}





/* =========================

   27. 云端：更新

   \========================= */



async function updateCloudRecord(

  record

) {



  if (

    !supabaseClient ||

    !currentUser

  ) {

    return;

  }





  const {

    error

  } =

    await supabaseClient

      .from("records")

      .update({



        amount:

          Number(record.amount),



        category:

          record.category,



        note:

          record.note || "",



        date:

          record.date



      })

      .eq(

        "id",

        record.id

      )

      .eq(

        "user_id",

        currentUser.id

      );





  if (error) {

    throw error;

  }

}





/* =========================

   28. 云端：删除

   \========================= */



async function deleteCloudRecord(

  recordId

) {



  if (

    !supabaseClient ||

    !currentUser

  ) {

    return;

  }





  const {

    error

  } =

    await supabaseClient

      .from("records")

      .delete()

      .eq(

        "id",

        recordId

      )

      .eq(

        "user_id",

        currentUser.id

      );





  if (error) {

    throw error;

  }

}





/* =========================

   29. 登录 / 注册初始化

   \========================= */



async function initAuth() {



  if (!supabaseClient) {

    updateAccountUI();

    return;

  }





  try {



    const {

      data: {

        session

      }

    } =

      await supabaseClient.auth.getSession();





    currentUser =

      session?.user || null;





    updateAccountUI();





    if (currentUser) {

      await syncFromCloud();

    }





    supabaseClient.auth.onAuthStateChange(

      async (_event, session) => {



        currentUser =

          session?.user || null;



        updateAccountUI();





        if (currentUser) {



          await syncFromCloud();



        } else {



          records = loadRecords().map(normalizeRecord);
          renderAll();



        }



      }

    );



  } catch (error) {



    console.error(

      "初始化登录状态失败：",

      error

    );



    updateAccountUI();



  }

}





/* =========================

   30. 登录

   \========================= */



async function handleLogin() {



  if (!supabaseClient) {



    showLoginMessage(

      "云端服务未加载"

    );



    return;

  }





  const emailInput =

    get("loginEmail");



  const passwordInput =

    get("loginPassword");



  const loginBtn =

    get("loginBtn");





  const email =

    emailInput?.value.trim() || "";



  const password =

    passwordInput?.value || "";





  if (!email || !password) {



    showLoginMessage(

      "请输入邮箱和密码"

    );



    return;

  }





  if (loginBtn) {

    loginBtn.disabled = true;

  }





  showLoginMessage(

    "正在登录…"

  );





  try {



    const {

      error

    } =

      await supabaseClient.auth

        .signInWithPassword({



          email,

          password



        });





    if (error) {

      throw error;

    }





    showLoginMessage(

      "登录成功"

    );





    setTimeout(

      () => {

        closeAuthModal();

      },

      500

    );





  } catch (error) {



    console.error(

      "登录失败：",

      error

    );





    showLoginMessage(

      getAuthErrorMessage(error)

    );





  } finally {



    if (loginBtn) {

      loginBtn.disabled = false;

    }



  }

}





/* =========================

   31. 注册

   \========================= */



async function handleRegister() {



  if (!supabaseClient) {



    showRegisterMessage(

      "云端服务未加载"

    );



    return;

  }





  const emailInput =

    get("registerEmail");



  const passwordInput =

    get("registerPassword");



  const confirmInput =

    get("registerPasswordConfirm");



  const registerBtn =

    get("registerBtn");





  const email =

    emailInput?.value.trim() || "";



  const password =

    passwordInput?.value || "";



  const confirm =

    confirmInput?.value || "";





  if (

    !email ||

    !password ||

    !confirm

  ) {



    showRegisterMessage(

      "请完整填写注册信息"

    );



    return;

  }





  if (password.length < 6) {



    showRegisterMessage(

      "密码至少需要 6 位"

    );



    return;

  }





  if (password !== confirm) {



    showRegisterMessage(

      "两次输入的密码不一致"

    );



    return;

  }





  if (registerBtn) {

    registerBtn.disabled = true;

  }





  showRegisterMessage(

    "正在注册…"

  );





  try {



    const {

      data,

      error

    } =

      await supabaseClient.auth

        .signUp({



          email,

          password



        });





    if (error) {

      throw error;

    }





    if (data.session) {



      showRegisterMessage(

        "注册成功"

      );



    } else {



      showRegisterMessage(

        "注册成功，请检查邮箱完成验证"

      );



    }



  } catch (error) {



    console.error(

      "注册失败：",

      error

    );



    showRegisterMessage(

      getAuthErrorMessage(error)

    );



  } finally {



    if (registerBtn) {

      registerBtn.disabled = false;

    }



  }

}





/* =========================

   32. 登出

   \========================= */



async function handleLogout() {



  try {



    if (supabaseClient) {

      const {

        error

      } =

        await supabaseClient.auth

          .signOut();



      if (error) {

        throw error;

      }

    }





    /*

     * 无论 Supabase 有没有成功，

     * 本地 UI 都立即恢复为未登录状态。

     */



    currentUser = null;



    records = loadRecords().map(normalizeRecord);



    updateAccountUI();



    renderAll();



    showToast(

      "已退出登录"

    );



  } catch (error) {



    console.error(

      "退出登录失败：",

      error

    );



    showToast(

      "退出登录失败"

    );



  }

}





/* =========================

   33. 登录弹窗

   \========================= */



function openAuthModal() {



  const modal =

    get("authModal");



  if (!modal) {

    console.error(

      "找不到 authModal"

    );

    return;

  }





  modal.hidden = false;



  modal.classList.remove(

    "hidden"

  );



  modal.classList.add(

    "show"

  );





  showLoginPanel();

}





function closeAuthModal() {



  const modal =

    get("authModal");



  if (!modal) {

    return;

  }





  modal.classList.remove(

    "show"

  );



  /*

   * 不直接给 authModal 加 hidden，

   * 避免和现有 CSS / 动画冲突。

   */

}





/* =========================

   34. 登录 UI

   \========================= */



function updateAccountUI() {



  const accountEntry =

    get("accountEntry");



  const syncSetting =

    get("syncSetting");





  const nameElement =

    accountEntry?.querySelector(

      ".account-info strong"

    );



  const detailElement =

    accountEntry?.querySelector(

      ".account-info span"

    );



  const avatarElement =

    accountEntry?.querySelector(

      ".account-avatar span"

    );



  const syncValue =

    syncSetting?.querySelector(

      ".settings-row-value"

    );





  if (currentUser) {



    const email =

      currentUser.email ||

      "已登录";





    if (nameElement) {

      nameElement.textContent =

        email;

    }





    if (detailElement) {

      detailElement.textContent =

        "点击此处退出登录";

    }





    if (avatarElement) {

      avatarElement.textContent =

        email

          .charAt(0)

          .toUpperCase();

    }





    if (syncValue) {

      syncValue.textContent =

        "已开启";

    }



  } else {



    if (nameElement) {

      nameElement.textContent =

        "未登录";

    }





    if (detailElement) {

      detailElement.textContent =

        "登录后同步你的账单";

    }





    if (avatarElement) {

      avatarElement.textContent =

        "未";

    }





    if (syncValue) {

      syncValue.textContent =

        "未登录";

    }



  }

}





function showLoginPanel() {



  const loginPanel =

    get("loginPanel");



  const registerPanel =

    get("registerPanel");





  if (loginPanel) {

    loginPanel.hidden = false;

  }



  if (registerPanel) {

    registerPanel.hidden = true;

  }





  clearAuthMessages();

}





function showRegisterPanel() {



  const loginPanel =

    get("loginPanel");



  const registerPanel =

    get("registerPanel");





  if (loginPanel) {

    loginPanel.hidden = true;

  }



  if (registerPanel) {

    registerPanel.hidden = false;

  }





  clearAuthMessages();

}





function showLoginMessage(

  message

) {



  const element =

    get("loginMessage");



  if (element) {

    element.textContent =

      message;

  }

}





function showRegisterMessage(

  message

) {



  const element =

    get("registerMessage");



  if (element) {

    element.textContent =

      message;

  }

}





function clearAuthMessages() {



  showLoginMessage("");



  showRegisterMessage("");

}





function getAuthErrorMessage(

  error

) {



  const message =

    error?.message || "";



  const lower =

    message.toLowerCase();





  if (

    lower.includes(

      "invalid login credentials"

    )

  ) {

    return "邮箱或密码错误";

  }





  if (

    lower.includes(

      "email not confirmed"

    )

  ) {

    return "请先完成邮箱验证";

  }





  if (

    lower.includes(

      "user already registered"

    )

  ) {

    return "这个邮箱已经注册过了";

  }





  return (

    message ||

    "操作失败，请稍后再试"

  );

}





/* =========================

   35. 重新渲染

   \========================= */



function renderAll() {



  renderToday();



  renderBills();



  renderStats();



  renderSettings();



}





/* =========================

   36. 日期工具

   \========================= */



function formatDateInput(date) {



  const year =

    date.getFullYear();



  const month =

    String(

      date.getMonth() + 1

    ).padStart(2, "0");



  const day =

    String(

      date.getDate()

    ).padStart(2, "0");





  return `${year}-${month}-${day}`;

}





function getMonthKey(date) {



  const year =

    date.getFullYear();



  const month =

    String(

      date.getMonth() + 1

    ).padStart(2, "0");





  return `${year}-${month}`;

}





function parseLocalDate(

  dateString

) {



  if (!dateString) {

    return new Date();

  }





  const [

    year,

    month,

    day

  ] =

    dateString

      .split("-")

      .map(Number);





  return new Date(

    year,

    month - 1,

    day

  );

}





function isToday(date) {



  return (

    formatDateInput(date) ===

    formatDateInput(new Date())

  );

}





function formatMonthTitle(

  monthKey

) {



  const [

    year,

    month

  ] =

    monthKey.split("-");





  return (

    `${year}年${Number(month)}月`

  );

}





function formatReadableDate(

  dateString

) {



  const date =

    parseLocalDate(

      dateString

    );





  if (isToday(date)) {

    return "今天";

  }





  const yesterday =

    new Date();



  yesterday.setDate(

    yesterday.getDate() - 1

  );





  if (

    formatDateInput(date) ===

    formatDateInput(yesterday)

  ) {

    return "昨天";

  }





  return (

    `${date.getMonth() + 1}月` +

    `${date.getDate()}日`

  );

}





function formatFullDate(

  dateString

) {



  const date =

    parseLocalDate(

      dateString

    );





  const weekdays = [

    "周日",

    "周一",

    "周二",

    "周三",

    "周四",

    "周五",

    "周六"

  ];





  return (

    `${date.getMonth() + 1}月` +

    `${date.getDate()}日 · ` +

    `${weekdays[date.getDay()]}`

  );

}





function shiftMonth(

  monthKey,

  offset

) {



  const [

    year,

    month

  ] =

    monthKey

      .split("-")

      .map(Number);





  const date =

    new Date(

      year,

      month - 1 + offset,

      1

    );





  return getMonthKey(date);

}





/* =========================

   37. 金额工具

   \========================= */



function sumRecords(list) {



  return list.reduce(

    (sum, record) =>

      sum +

      Number(

        record.amount || 0

      ),

    0

  );

}





function formatMoney(amount) {



  const value =

    Number(amount || 0);



  return `¥${value.toFixed(2)}`;

}





/* =========================

   38. 分类工具

   \========================= */



function getCategoryInfo(

  category

) {



  return (

    CATEGORIES.find(

      (item) =>

        item.name === category

    ) || {

      name: "其他",

      icon: "···"

    }

  );

}





/* =========================

   39. ID

   \========================= */



function generateId() {



  if (

    typeof crypto !==

      "undefined" &&

    typeof crypto.randomUUID ===

      "function"

  ) {



    return crypto.randomUUID();



  }





  return (

    Date.now().toString(36) +

    Math.random()

      .toString(36)

      .slice(2)

  );

}





/* =========================

   40. 数据标准化

   \========================= */



function normalizeRecord(

  record

) {



  return {



    id:

      record?.id ||

      generateId(),



    user_id:

      record?.user_id ||

      currentUser?.id ||

      null,



    amount:

      Number(

        record?.amount || 0

      ),



    category:

      record?.category ||

      "其他",



    note:

      record?.note ||

      "",



    date:

      record?.date ||

      formatDateInput(

        new Date()

      ),



    created_at:

      record?.created_at ||

      new Date().toISOString()



  };

}





/* =========================

   41. HTML 安全

   \========================= */



function escapeHTML(

  value

) {



  return String(

    value ?? ""

  )

    .replace(

      /&/g,

      "&amp;"

    )

    .replace(

      /\</g,

      "&lt;"

    )

    .replace(

      />/g,

      "&gt;"

    )

    .replace(

      /"/g,

      "&quot;"

    )

    .replace(

      /'/g,

      "&#039;"

    );

}





/* =========================

   42. Toast

   \========================= */



function showToast(

  message

) {



  const toast =

    get("toast");





  if (!toast) {

    console.log(message);

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





/* =========================

   43. Service Worker

   \========================= */



function registerServiceWorker() {



  if (

    "serviceWorker" in navigator &&

    location.protocol !== "file:"

  ) {



    navigator.serviceWorker

      .register("./sw.js")

      .then(

        () => {



          console.log(

            "Service Worker 注册成功"

          );



        }

      )

      .catch(

        (error) => {



          console.warn(

            "Service Worker 注册失败：",

            error

          );



        }

      );



  }



}