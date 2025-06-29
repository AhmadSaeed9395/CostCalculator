// تحويل الموارد إلى هيكل أسعار افتراضية
const defaultPrices = {};
resourcesList.forEach(({ resource }) => {
  defaultPrices[resource] = 0;
});

// عناصر من HTML
const projectSelect = document.getElementById("projectSelect");
const newProjectName = document.getElementById("newProjectName");
const createProjectBtn = document.getElementById("createProjectBtn");
const savePricesBtn = document.getElementById("savePricesBtn");
const resetPricesBtn = document.getElementById("resetPricesBtn");

// حفظ البند المحسوب
const saveItemBtn = document.getElementById("saveItemBtn");
saveItemBtn.addEventListener("click", () => {
  const itemName = document.getElementById("itemSelect").value;
  const quantity = parseFloat(document.getElementById("itemQuantity").value);
  const projectName = document.getElementById("projectSelect").value;
  const totalCost = document.getElementById("totalCost").textContent.replace(/[^\d.]/g, "");
  if (!itemName || isNaN(quantity) || quantity <= 0) {
    showToast("يرجى اختيار بند وإدخال كمية صحيحة", 'error');
    return;
  }
  // Load saved items for this project
  const key = `items_${projectName}`;
  const saved = JSON.parse(localStorage.getItem(key)) || [];
  saved.push({ item: itemName, quantity, cost: parseFloat(totalCost) });
  localStorage.setItem(key, JSON.stringify(saved));
  showToast("تم حفظ البند", 'success');
  loadSavedItems();
});

// تحميل البنود المحفوظة
function loadSavedItems() {
  const projectName = document.getElementById("projectSelect").value;
  const key = `items_${projectName}`;
  const saved = JSON.parse(localStorage.getItem(key)) || [];
  const tbody = document.querySelector("#savedItemsTable tbody");
  tbody.innerHTML = "";
  
  let totalRawMaterials = 0;
  let totalLabor = 0;
  let totalWorkmanship = 0;
  let total = 0;
  
  // كائن لتجميع إجمالي كل خامة
  const resourceTotals = {};
  const resourceQuantities = {};
  
  // الحصول على أسعار المشروع
  const projectPrices = JSON.parse(localStorage.getItem(`project_${projectName}`)) || {};
  
  saved.forEach((item, idx) => {
    total += item.cost;
    
    // حساب تكلفة كل فئة بناءً على الموارد المستخدمة في البند
    const itemResources = itemsList.filter(i => i.item === item.item);
    let itemRawMaterials = 0;
    let itemLabor = 0;
    let itemWorkmanship = 0;
    
    itemResources.forEach(resource => {
      const resourceData = resourcesList.find(r => r.resource === resource.resource);
      if (resourceData) {
        const cost = (resource.quantityPerUnit * item.quantity * (projectPrices[resource.resource] || 0));
        const quantity = resource.quantityPerUnit * item.quantity;
        
        // تجميع إجمالي كل خامة
        if (!resourceTotals[resource.resource]) {
          resourceTotals[resource.resource] = 0;
          resourceQuantities[resource.resource] = {
            quantity: 0,
            unit: resourceData.unit,
            type: resourceData.type
          };
        }
        resourceTotals[resource.resource] += cost;
        resourceQuantities[resource.resource].quantity += quantity;
        
        if (resourceData.type === "RawMaterials") {
          itemRawMaterials += cost;
        } else if (resourceData.type === "Labor") {
          itemLabor += cost;
        } else if (resourceData.type === "Workmanship") {
          itemWorkmanship += cost;
        }
      }
    });
    
    totalRawMaterials += itemRawMaterials;
    totalLabor += itemLabor;
    totalWorkmanship += itemWorkmanship;
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.item}</td>
      <td>${item.quantity}</td>
      <td>${item.cost.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</td>
      <td><button onclick="removeSavedItem(${idx})">حذف</button></td>
      <td><button class="editSavedItemBtn" data-idx="${idx}">تعديل</button></td>
    `;
    tbody.appendChild(tr);
  });
  
  // إنشاء جدول تفاصيل الخامات المستخدمة
  let resourcesDetailsHTML = '';
  if (Object.keys(resourceTotals).length > 0) {
    resourcesDetailsHTML = `
      <div style="margin-top: 20px;">
        <h3 style="color: #e6a200; margin-bottom: 15px; border-bottom: 2px solid #e6a200; padding-bottom: 8px;">
          تفاصيل الخامات والموارد المستخدمة
        </h3>
    `;
    
    // تجميع الخامات حسب النوع
    const rawMaterials = [];
    const workmanship = [];
    const labor = [];
    
    Object.keys(resourceTotals).forEach(resource => {
      const total = resourceTotals[resource];
      const quantity = resourceQuantities[resource].quantity;
      const unit = resourceQuantities[resource].unit;
      const type = resourceQuantities[resource].type;
      
      const resourceData = {
        name: resource,
        total: total,
        quantity: quantity,
        unit: unit
      };
      
      if (type === 'RawMaterials') {
        rawMaterials.push(resourceData);
      } else if (type === 'Workmanship') {
        workmanship.push(resourceData);
      } else if (type === 'Labor') {
        labor.push(resourceData);
      }
    });
    
    // دالة لإنشاء جدول لكل نوع مع خاصية الطي والتوسيع
    function createResourceTable(resources, title, color) {
      if (resources.length === 0) return '';
      // ترتيب حسب التكلفة (الأعلى أولاً)
      resources.sort((a, b) => b.total - a.total);
      let sectionTotal = 0;
      resources.forEach(resource => {
        sectionTotal += resource.total;
      });
      let tableHTML = `
        <details style="margin-bottom: 25px; background: #232323; border-radius: 8px; border: 1.5px solid #444;" >
          <summary style="color: ${color}; margin-bottom: 12px; padding: 14px 18px; background: #2d2d2d; border-radius: 8px; border-right: 4px solid ${color}; font-size: 1.15em; font-weight: bold; cursor: pointer; outline: none; user-select: none;">${title}</summary>
          <div style="padding: 0 18px 12px 18px;">
            <table style="width: 100%; border-collapse: collapse; background: #232323; border-radius: 8px; overflow: hidden; margin-bottom: 10px;">
              <thead>
                <tr style="background: #444;">
                  <th style="padding: 10px; color: ${color}; text-align: right;">الخامة/الموارد</th>
                  <th style="padding: 10px; color: ${color}; text-align: center;">الكمية المطلوبة</th>
                  <th style="padding: 10px; color: ${color}; text-align: center;">الوحدة</th>
                  <th style="padding: 10px; color: ${color}; text-align: left;">التكلفة الإجمالية</th>
                </tr>
              </thead>
              <tbody>
      `;
      resources.forEach(resource => {
        tableHTML += `
          <tr style="border-bottom: 1px solid #444;">
            <td style="padding: 10px; color: #fff; font-weight: 600;">${resource.name}</td>
            <td style="padding: 10px; color: ${color}; text-align: center; font-weight: 600;">${resource.quantity.toFixed(3)}</td>
            <td style="padding: 10px; color: #fff; text-align: center;">${resource.unit}</td>
            <td style="padding: 10px; color: ${color}; text-align: left; font-weight: 700;">${resource.total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} جنيه</td>
          </tr>
        `;
      });
      tableHTML += `
              </tbody>
            </table>
            <div style="text-align: left; padding: 8px 12px; background: #2d2d2d; border-radius: 6px; margin-top: 5px;">
              <strong style="color: ${color}; font-size: 1.1em;">إجمالي ${title}: ${sectionTotal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} جنيه</strong>
            </div>
          </div>
        </details>
      `;
      return tableHTML;
    }
    
    // إنشاء الجداول الثلاثة
    resourcesDetailsHTML += createResourceTable(rawMaterials, 'الخامات', '#4CAF50');
    resourcesDetailsHTML += createResourceTable(workmanship, 'المصنعيات', '#2196F3');
    resourcesDetailsHTML += createResourceTable(labor, 'العمالة', '#FF9800');
    
    resourcesDetailsHTML += `</div>`;
  }
  
  // عرض التكاليف مقسمة حسب الفئة
  document.getElementById("projectTotal").innerHTML = `
    <details style="margin-bottom: 25px; background: #232323; border-radius: 8px; border: 1.5px solid #444;">
      <summary style="color: #e6a200; margin-bottom: 12px; padding: 14px 18px; background: #2d2d2d; border-radius: 8px; border-right: 4px solid #e6a200; font-size: 1.15em; font-weight: bold; cursor: pointer; outline: none; user-select: none;">ملخص تكاليف المشروع</summary>
      <div style="padding: 0 18px 12px 18px;">
        <table style="width: 100%; border-collapse: collapse; background: #232323; border-radius: 8px; overflow: hidden; margin-bottom: 10px;">
          <thead>
            <tr style="background: #444;">
              <th style="padding: 10px; color: #e6a200; text-align: right;">نوع التكلفة</th>
              <th style="padding: 10px; color: #e6a200; text-align: left;">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #444;">
              <td style="padding: 10px; color: #fff; font-weight: 600;">تكلفة الخامات:</td>
              <td style="padding: 10px; color: #4CAF50; text-align: left; font-weight: 700;">${totalRawMaterials.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} جنيه</td>
            </tr>
            <tr style="border-bottom: 1px solid #444;">
              <td style="padding: 10px; color: #fff; font-weight: 600;">تكلفة العمالة:</td>
              <td style="padding: 10px; color: #FF9800; text-align: left; font-weight: 700;">${totalLabor.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} جنيه</td>
            </tr>
            <tr style="border-bottom: 1px solid #444;">
              <td style="padding: 10px; color: #fff; font-weight: 600;">تكلفة المصنعيات:</td>
              <td style="padding: 10px; color: #2196F3; text-align: left; font-weight: 700;">${totalWorkmanship.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} جنيه</td>
            </tr>
          </tbody>
        </table>
        <div style="text-align: left; padding: 10px 12px; background: #2d2d2d; border-radius: 6px; margin-top: 5px; border-top: 2px solid #e6a200;">
          <strong style="color: #e6a200; font-size: 1.2em;">إجمالي تكلفة المشروع: ${total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} جنيه</strong>
        </div>
      </div>
    </details>
    ${resourcesDetailsHTML}
  `;
  
  document.getElementById("savedItemsSection").classList.toggle("hidden", saved.length === 0);

  // إضافة مستمعات التعديل
  tbody.querySelectorAll('.editSavedItemBtn').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = +this.dataset.idx;
      const item = saved[idx];
      // تحميل البند في قسم الحساب
      document.getElementById("itemSelect").value = item.item;
      document.getElementById("itemQuantity").value = item.quantity;
      document.getElementById("itemCalcSection").scrollIntoView({behavior: 'smooth'});
      document.getElementById("calculateBtn").click();
    });
  });
}

// حذف بند محفوظ
window.removeSavedItem = function(idx) {
  const projectName = document.getElementById("projectSelect").value;
  const key = `items_${projectName}`;
  const saved = JSON.parse(localStorage.getItem(key)) || [];
  const item = saved[idx];
  saved.splice(idx, 1);
  localStorage.setItem(key, JSON.stringify(saved));
  loadSavedItems();
  showToast('تم حذف البند <button id="undoBtn" style="margin-right:10px;">تراجع</button>', 'success');
  setTimeout(() => {
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) undoBtn.onclick = undoDelete;
  }, 100);
};

function undoDelete() {
  const projectName = document.getElementById("projectSelect").value;
  const key = `items_${projectName}`;
  const saved = JSON.parse(localStorage.getItem(key)) || [];
  const item = saved[lastDeletedItem.idx];
  saved.splice(lastDeletedItem.idx, 0, lastDeletedItem.item);
  localStorage.setItem(key, JSON.stringify(saved));
  loadSavedItems();
  showToast('تم التراجع عن الحذف', 'success');
  lastDeletedItem = null;
}

// عرض البنود المحفوظة عند تغيير المشروع
projectSelect.addEventListener("change", loadSavedItems);
// عند تحميل الصفحة
window.addEventListener("DOMContentLoaded", loadSavedItems);

// تحميل المشاريع المحفوظة
function loadProjects() {
  const projects = Object.keys(localStorage).filter(key => key.startsWith("project_"));
  projectSelect.innerHTML = '';
  projects.forEach(projectKey => {
    const projectName = projectKey.replace("project_", "");
    if (![...projectSelect.options].some(opt => opt.value === projectName)) {
    const option = document.createElement("option");
    option.value = projectName;
    option.textContent = projectName;
    projectSelect.appendChild(option);
    }
  });
}

// عند تغيير المشروع
projectSelect.addEventListener("change", () => {
  updateSections();
  loadProjectPrices(projectSelect.value);
  loadSavedItems();
});

function updateSections() {
  const name = projectSelect.value;
  if (!name) {
    document.getElementById("itemCalcSection").classList.add("hidden");
    document.getElementById("savedItemsSection").classList.add("hidden");
  } else {
    document.getElementById("itemCalcSection").classList.remove("hidden");
    loadSavedItems();
    focusFirstInput('itemCalcSection');
  }
}

// إنشاء مشروع جديد
createProjectBtn.addEventListener("click", () => {
  const name = newProjectName.value.trim();
  if (name === "") return showToast("من فضلك أدخل اسم المشروع", 'error');
  if ([...projectSelect.options].some(opt => opt.value === name)) {
    return showToast("هذا المشروع موجود بالفعل", 'warning');
  }
  // حفظ أسعار افتراضية
  localStorage.setItem(`project_${name}`, JSON.stringify(defaultPrices));
  // إعادة تحميل المشاريع وتحديد الجديد
  initializeApp();
  projectSelect.value = name;
  updateSections();
  loadProjectPrices(name);
  newProjectName.value = "";
  showToast("تم إنشاء المشروع", 'success');
});

// تحميل أسعار مشروع وعرضها في الجداول المنفصلة
function loadProjectPrices(projectName) {
  const prices = JSON.parse(localStorage.getItem(`project_${projectName}`)) || { ...defaultPrices };
  const tbodyRaw = document.querySelector("#priceTableRawMaterials tbody");
  const tbodyWork = document.querySelector("#priceTableWorkmanship tbody");
  const tbodyLabor = document.querySelector("#priceTableLabor tbody");
  tbodyRaw.innerHTML = tbodyWork.innerHTML = tbodyLabor.innerHTML = "";
  resourcesList.forEach(({ resource, unit, type }) => {
    const tr = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.textContent = resource;
    const unitCell = document.createElement("td");
    unitCell.textContent = unit;
    const priceCell = document.createElement("td");
    const input = document.createElement("input");
    input.type = "number";
    input.min = 0;
    input.value = prices[resource] || 0;
    input.dataset.resource = resource;
    priceCell.appendChild(input);
    tr.appendChild(nameCell);
    tr.appendChild(unitCell);
    tr.appendChild(priceCell);
    if (type === "RawMaterials") tbodyRaw.appendChild(tr);
    else if (type === "Workmanship") tbodyWork.appendChild(tr);
    else if (type === "Labor") tbodyLabor.appendChild(tr);
  });
}

// حفظ الأسعار المعدلة
savePricesBtn.addEventListener("click", () => {
  const name = projectSelect.value;
  const newPrices = {};
  document.querySelectorAll("#priceTableRawMaterials input, #priceTableWorkmanship input, #priceTableLabor input").forEach(input => {
    const res = input.dataset.resource;
    const val = parseFloat(input.value) || 0;
    newPrices[res] = val;
  });
  localStorage.setItem(`project_${name}`, JSON.stringify(newPrices));
  showToast("تم حفظ الأسعار", 'success');
});

// إعادة للأسعار الافتراضية
resetPricesBtn.addEventListener("click", () => {
  const name = projectSelect.value;
  localStorage.setItem(`project_${name}`, JSON.stringify(defaultPrices));
  loadProjectPrices(name);
  showToast("↩️ تمت إعادة الأسعار للوضع الافتراضي", 'success');
});

// عند تحميل الصفحة
window.addEventListener("DOMContentLoaded", () => {
  initializeApp();
});

function initializeApp() {
  // تفريغ القوائم
  projectSelect.innerHTML = '<option value="">-- اختر --</option>';
  loadProjects();
  loadItemsList();
  updateSections();
  loadSavedItems();
}

// إدراج البنود في القائمة
function loadItemsList() {
  const itemSelect = document.getElementById("itemSelect");
  const uniqueItems = [...new Set(itemsList.map(i => i.item))];
  uniqueItems.forEach(item => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    itemSelect.appendChild(option);
  });
}

// --- دعم التعديل المؤقت لمعدلات الفرد ---
let tempRates = null;

function getCurrentItemRates(itemName) {
  // إرجاع نسخة من البنود لهذا البند
  return itemsList.filter(i => i.item === itemName).map(obj => ({...obj}));
}

function renderCalculationTable(filtered, quantity, projectPrices) {
  const tbody = document.getElementById("resultTableBody");
  tbody.innerHTML = "";
  let total = 0;
  let missing = false;

  filtered.forEach((rowObj, idx) => {
    let { resource, unit, quantityPerUnit } = rowObj;
    let unitPrice = parseFloat(projectPrices[resource]);
    if (isNaN(unitPrice)) unitPrice = 0;
    const totalQty = quantity * quantityPerUnit;
    const cost = totalQty * unitPrice;
    total += cost;
    const row = document.createElement("tr");
    row.classList.remove('highlight-missing');
    if (!projectPrices.hasOwnProperty(resource) || unitPrice === 0) {
      row.classList.add('highlight-missing');
      missing = true;
    }
    row.innerHTML = `
      <td>${resource}</td>
      <td>${unit}</td>
      <td>${getDefaultRate(resource)}</td>
      <td><input type="number" min="0" step="any" value="${quantityPerUnit}" data-idx="${idx}" class="rateInput" style="width:90px"></td>
      <td>${totalQty.toFixed(2)} ${unit}</td>
      <td>${unitPrice.toLocaleString()}</td>
      <td>${cost.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</td>
      <td><button class="resetRowRateBtn" data-idx="${idx}">إعادة</button></td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById("totalCost").textContent = `الإجمالي: ${total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  document.getElementById("resultSection").classList.remove("hidden");
  warningDiv.textContent = '';
  if (missing) showToast('⚠️ يوجد مورد أو أكثر بدون سعر! الرجاء مراجعة الأسعار.', 'warning');
}

// Helper to get default rate for a resource in the current item
function getDefaultRate(resource) {
  const itemName = document.getElementById("itemSelect").value;
  const found = itemsList.find(i => i.item === itemName && i.resource === resource);
  return found ? found.quantityPerUnit : '';
}

// دعم إعادة معدل الفرد الافتراضي لكل صف
const resultTableBody = document.getElementById("resultTableBody");
resultTableBody.addEventListener("click", function(e) {
  if (e.target.classList.contains("resetRowRateBtn")) {
    const idx = +e.target.dataset.idx;
    if (tempRates && tempRates[idx]) {
      tempRates[idx].quantityPerUnit = getDefaultRate(tempRates[idx].resource);
      const itemName = document.getElementById("itemSelect").value;
      const quantity = parseFloat(document.getElementById("itemQuantity").value);
      const projectName = document.getElementById("projectSelect").value;
      const projectPrices = JSON.parse(localStorage.getItem(`project_${projectName}`)) || {};
      renderCalculationTable(tempRates, quantity, projectPrices);
      document.getElementById('resetRatesBtn').classList.remove('hidden');
    }
  }
});

// تحديث عند الضغط على حساب التكلفة
const warningDiv = document.getElementById('calcWarning') || (() => { const d = document.createElement('div'); d.id = 'calcWarning'; d.style.color = 'red'; d.style.fontWeight = 'bold'; document.getElementById('resultSection').prepend(d); return d; })();
document.getElementById("calculateBtn").addEventListener("click", () => {
  const itemName = document.getElementById("itemSelect").value;
  const quantity = parseFloat(document.getElementById("itemQuantity").value);
  const projectName = document.getElementById("projectSelect").value;

  if (!itemName || isNaN(quantity) || quantity <= 0) {
    showToast("يرجى اختيار بند وإدخال كمية صحيحة", 'error');
    return;
  }

  const projectPrices = JSON.parse(localStorage.getItem(`project_${projectName}`)) || {};
  tempRates = getCurrentItemRates(itemName); // نسخة مؤقتة
  renderCalculationTable(tempRates, quantity, projectPrices);
  document.getElementById('resetRatesBtn').classList.add('hidden');
});

// دعم التعديل على معدل الفرد
resultTableBody.addEventListener("input", function(e) {
  if (e.target.classList.contains("rateInput")) {
    const idx = +e.target.dataset.idx;
    const newVal = parseFloat(e.target.value) || 0;
    if (tempRates && tempRates[idx]) {
      tempRates[idx].quantityPerUnit = newVal;
      const itemName = document.getElementById("itemSelect").value;
      const quantity = parseFloat(document.getElementById("itemQuantity").value);
      const projectName = document.getElementById("projectSelect").value;
      const projectPrices = JSON.parse(localStorage.getItem(`project_${projectName}`)) || {};
      renderCalculationTable(tempRates, quantity, projectPrices);
      document.getElementById('resetRatesBtn').classList.remove('hidden');
    }
  }
});

document.getElementById('resetRatesBtn').addEventListener('click', function() {
  const itemName = document.getElementById("itemSelect").value;
  const quantity = parseFloat(document.getElementById("itemQuantity").value);
  const projectName = document.getElementById("projectSelect").value;
  const projectPrices = JSON.parse(localStorage.getItem(`project_${projectName}`)) || {};
  tempRates = getCurrentItemRates(itemName); // إعادة القيم الأصلية
  renderCalculationTable(tempRates, quantity, projectPrices);
  this.classList.add('hidden');
});

// البنود الرئيسية
const mainItemsMap = {
  "الهدم": [
    "هدم مباني", "هدم سيراميك أرضيات", "هدم سيراميك حوائط", "هدم محارة"
  ],
  "المباني": [
    "مباني طوب طفلي 20 9 5", "مباني طوب طفلي 24 11 6", "مباني طوب مصمت دبل 24 11 11", "مباني طوب أحمر 20 10 5"
  ],
  "المحاره": [
    "بياض (ملو و طرطشة و بؤج)"
  ],
  "العزل": [
    "عزل أنسومات", "عزل سيكا 107", "عزل حراري"
  ],
  "التكييف": [
    "تأسيس تكييف 1.5 و 2.25 حصان", "تأسيس تكييف 3 حصان", "تأسيس تكييف 4 و 5 حصان", "تأسيس صاج كونسيلد"
  ],
  "الجبسوم بورد": [
    "جبسوم بورد أبيض مسطح", "جبسوم بورد أخضر مسطح", "جبسوم بورد أبيض طولي ", "جبسوم بورد أخضر طولي "
  ],
  "البورسلين": [
    "بورسلين أرضيات", "بورسلين حوائط", "وزر", "HDF"
  ],
  "الرخام": [
    "رخام أسود", "رخام أبيض", "رخام تجاليد"
  ],
  "النقاشه": [
    "تأسيس نقاشة حوائط", "تأسيس نقاشة أسقف", "تشطيب نقاشة"
  ]
};

// تحميل البنود الرئيسية في القائمة
function loadMainItemsList() {
  const mainSelect = document.getElementById("mainItemSelect");
  mainSelect.innerHTML = '<option value="">-- اختر --</option>';
  Object.keys(mainItemsMap).forEach(main => {
    const option = document.createElement("option");
    option.value = main;
    option.textContent = main;
    mainSelect.appendChild(option);
  });
}

// تحميل البنود الفرعية عند اختيار بند رئيسي
function loadSubItemsList(main) {
  const subSelect = document.getElementById("itemSelect");
  subSelect.innerHTML = '<option value="">-- اختر --</option>';
  if (mainItemsMap[main]) {
    mainItemsMap[main].forEach(sub => {
      const option = document.createElement("option");
      option.value = sub;
      option.textContent = sub;
      subSelect.appendChild(option);
    });
    subSelect.disabled = false;
  } else {
    subSelect.disabled = true;
  }
}

document.getElementById("mainItemSelect").addEventListener("change", function() {
  loadSubItemsList(this.value);
});

// عند تحميل الصفحة
window.addEventListener("DOMContentLoaded", () => {
  initializeApp();
  loadMainItemsList();
  // Auto-select last used project if exists
  const lastProject = localStorage.getItem('lastProject');
  if (lastProject && [...projectSelect.options].some(opt => opt.value === lastProject)) {
    projectSelect.value = lastProject;
    updateSections();
    loadProjectPrices(lastProject);
    loadSavedItems();
  }
  // Auto-select last used main/sub item if exists
  const lastMain = localStorage.getItem('lastMainItem');
  const lastSub = localStorage.getItem('lastSubItem');
  if (lastMain && document.getElementById('mainItemSelect')) {
    document.getElementById('mainItemSelect').value = lastMain;
    loadSubItemsList(lastMain);
    if (lastSub && document.getElementById('itemSelect')) {
      document.getElementById('itemSelect').value = lastSub;
    }
  }
});

// --- الحفظ التلقائي لأسعار الموارد ---
function autoSavePrices() {
  const name = projectSelect.value;
  const newPrices = {};
  document.querySelectorAll("#priceTableRawMaterials input, #priceTableWorkmanship input, #priceTableLabor input").forEach(input => {
    const res = input.dataset.resource;
    const val = parseFloat(input.value) || 0;
    newPrices[res] = val;
  });
  localStorage.setItem(`project_${name}`, JSON.stringify(newPrices));
  showAutoSaveMsg();
}

function showAutoSaveMsg() {
  let msg = document.getElementById('autoSaveMsg');
  if (!msg) {
    msg = document.createElement('div');
    msg.id = 'autoSaveMsg';
    msg.style.position = 'fixed';
    msg.style.top = '10px';
    msg.style.left = '50%';
    msg.style.transform = 'translateX(-50%)';
    msg.style.background = '#d4edda';
    msg.style.color = '#155724';
    msg.style.padding = '8px 20px';
    msg.style.borderRadius = '8px';
    msg.style.zIndex = 1000;
    msg.style.fontWeight = 'bold';
    document.body.appendChild(msg);
  }
  msg.textContent = 'تم الحفظ تلقائياً';
  msg.style.display = 'block';
  clearTimeout(msg._timeout);
  msg._timeout = setTimeout(() => { msg.style.display = 'none'; }, 1200);
}

// --- Instant Save for Price Table Inputs ---
document.querySelectorAll('#priceTableRawMaterials input, #priceTableWorkmanship input, #priceTableLabor input').forEach(input => {
  input.addEventListener('change', function() {
    const projectName = document.getElementById('projectSelect').value;
    if (!projectName) return;
    const prices = JSON.parse(localStorage.getItem(`project_${projectName}`)) || {};
    prices[this.dataset.resource] = parseFloat(this.value) || 0;
    localStorage.setItem(`project_${projectName}`, JSON.stringify(prices));
    showToast('✅ تم حفظ السعر مباشرة', 'success');
  });
});

// --- Dashboard: عرض المشاريع الأخيرة ---
function renderDashboardProjects() {
  const container = document.getElementById('projectsList');
  if (!container) return; // Exit if element doesn't exist
  
  container.innerHTML = '';
  const projects = Object.keys(localStorage).filter(k => k.startsWith('project_'));
  if (projects.length === 0) {
    container.innerHTML = '<div class="card" style="text-align:center;">لا يوجد مشاريع محفوظة بعد.</div>';
    return;
  }
  projects.forEach(key => {
    const name = key.replace('project_', '');
    // حساب إجمالي تكلفة البنود المحفوظة
    const items = JSON.parse(localStorage.getItem(`items_${name}`) || '[]');
    const total = items.reduce((sum, i) => sum + (i.cost || 0), 0);
    const card = document.createElement('div');
    card.className = 'card project-card';
    card.style.cursor = 'pointer';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:1.1em;font-weight:700;">${name}</div>
          <div style="color:#ffe066;font-size:0.95em;">إجمالي التكلفة: <b>${total.toFixed(2)}</b> جنيه</div>
        </div>
        <div style="font-size:2em;">📁</div>
      </div>
    `;
    // (يمكنك إضافة حدث عند الضغط لاحقًا)
    container.appendChild(card);
  });
}
window.addEventListener('DOMContentLoaded', renderDashboardProjects);

// --- Toast Notification Utility ---
function showToast(msg, type = 'info') {
  let toast = document.getElementById('toastMsg');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastMsg';
    toast.style.position = 'fixed';
    toast.style.top = '30px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.minWidth = '220px';
    toast.style.maxWidth = '90vw';
    toast.style.zIndex = 2000;
    toast.style.fontWeight = 'bold';
    toast.style.fontSize = '1.1em';
    toast.style.padding = '14px 28px';
    toast.style.borderRadius = '12px';
    toast.style.boxShadow = '0 2px 16px #0005';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '12px';
    toast.style.cursor = 'pointer';
    toast.onclick = () => { toast.style.display = 'none'; };
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.display = 'flex';
  if (type === 'success') {
    toast.style.background = '#232323';
    toast.style.color = '#e6a200';
    toast.style.border = '2px solid #e6a200';
  } else if (type === 'error') {
    toast.style.background = '#ffe0e0';
    toast.style.color = '#b30000';
    toast.style.border = '2px solid #b30000';
  } else if (type === 'warning') {
    toast.style.background = '#fff8e1';
    toast.style.color = '#e6a200';
    toast.style.border = '2px solid #e6a200';
  } else {
    toast.style.background = '#232323';
    toast.style.color = '#fff';
    toast.style.border = '2px solid #444';
  }
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.style.display = 'none'; }, 2200);
}

// --- Smart Defaults & Fewer Clicks ---
// 1. Auto-select last used project on load
window.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  loadMainItemsList();
  // Auto-select last used project if exists
  const lastProject = localStorage.getItem('lastProject');
  if (lastProject && [...projectSelect.options].some(opt => opt.value === lastProject)) {
    projectSelect.value = lastProject;
    updateSections();
    loadProjectPrices(lastProject);
    loadSavedItems();
  }
  // Auto-select last used main/sub item if exists
  const lastMain = localStorage.getItem('lastMainItem');
  const lastSub = localStorage.getItem('lastSubItem');
  if (lastMain && document.getElementById('mainItemSelect')) {
    document.getElementById('mainItemSelect').value = lastMain;
    loadSubItemsList(lastMain);
    if (lastSub && document.getElementById('itemSelect')) {
      document.getElementById('itemSelect').value = lastSub;
    }
  }
});

// Save last used project on change
projectSelect.addEventListener('change', () => {
  localStorage.setItem('lastProject', projectSelect.value);
  updateSections();
  loadProjectPrices(projectSelect.value);
  loadSavedItems();
});

// Save last used main/sub item on change
if (document.getElementById('mainItemSelect')) {
  document.getElementById('mainItemSelect').addEventListener('change', function() {
    localStorage.setItem('lastMainItem', this.value);
    loadSubItemsList(this.value);
  });
}
if (document.getElementById('itemSelect')) {
  document.getElementById('itemSelect').addEventListener('change', function() {
    localStorage.setItem('lastSubItem', this.value);
  });
}

// 2. Auto-focus first input in each section when shown
function focusFirstInput(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const input = section.querySelector('input, select');
  if (input) setTimeout(() => input.focus(), 200);
}

// --- Export to PDF ---
// document.getElementById('exportBtn').addEventListener('click', function() {
//   const projectName = document.getElementById('projectSelect').value;
//   if (!projectName) return showToast('اختر مشروعاً أولاً', 'error');
//   const items = JSON.parse(localStorage.getItem(`items_${projectName}`) || '[]');
//   if (!items.length) return showToast('لا يوجد بنود محفوظة لهذا المشروع', 'warning');
//   // Generate PDF using jsPDF
//   const doc = new window.jspdf.jsPDF({orientation: 'p', unit: 'pt', format: 'a4'});
//   doc.setFont('Cairo', 'bold');
//   doc.setFontSize(18);
//   doc.text(`تقرير المشروع: ${projectName}`, 40, 50, {align: 'right'});
//   doc.setFontSize(13);
//   let y = 90;
//   doc.text('البند', 480, y);
//   doc.text('الكمية', 350, y);
//   doc.text('التكلفة', 220, y);
//   y += 18;
//   doc.setFont('Cairo', 'normal');
//   items.forEach(i => {
//     doc.text(String(i.item), 480, y);
//     doc.text(String(i.quantity), 350, y);
//     doc.text(String(i.cost), 220, y);
//     y += 18;
//   });
//   doc.save(`project_${projectName}.pdf`);
//   showToast('تم تصدير المشروع كملف PDF', 'success');
// });
// --- Share Project (download JSON) ---
// document.getElementById('shareBtn').addEventListener('click', function() {
//   const projectName = document.getElementById('projectSelect').value;
//   if (!projectName) return showToast('اختر مشروعاً أولاً', 'error');
//   const items = JSON.parse(localStorage.getItem(`items_${projectName}`) || '[]');
//   const blob = new Blob([JSON.stringify(items, null, 2)], {type: 'application/json'});
//   const a = document.createElement('a');
//   a.href = URL.createObjectURL(blob);
//   a.download = `project_${projectName}.json`;
//   a.click();
//   showToast('تم تجهيز ملف مشاركة المشروع', 'success');
// });

// --- UI: Highlight required fields and show mini summary card ---
const mainItemSelect = document.getElementById('mainItemSelect');
const subItemSelect = document.getElementById('itemSelect');
const itemQuantityInput = document.getElementById('itemQuantity');
const miniSummaryCard = document.getElementById('miniSummaryCard');
const miniSummaryItem = document.getElementById('miniSummaryItem');
const miniSummaryQty = document.getElementById('miniSummaryQty');
const miniSummaryTotal = document.getElementById('miniSummaryTotal');

function clearInputErrors() {
  mainItemSelect.classList.remove('input-error');
  subItemSelect.classList.remove('input-error');
  itemQuantityInput.classList.remove('input-error');
}

function validateInputs() {
  let valid = true;
  if (!mainItemSelect.value) {
    mainItemSelect.classList.add('input-error');
    valid = false;
  }
  if (!subItemSelect.value) {
    subItemSelect.classList.add('input-error');
    valid = false;
  }
  if (!itemQuantityInput.value || isNaN(parseFloat(itemQuantityInput.value)) || parseFloat(itemQuantityInput.value) <= 0) {
    itemQuantityInput.classList.add('input-error');
    valid = false;
  }
  return valid;
}

// Remove error highlight on input/change
mainItemSelect.addEventListener('change', clearInputErrors);
subItemSelect.addEventListener('change', clearInputErrors);
itemQuantityInput.addEventListener('input', clearInputErrors);

// Show mini summary card after calculation
const calcBtn = document.getElementById('calculateBtn');
calcBtn.addEventListener('click', function() {
  clearInputErrors();
  if (!validateInputs()) {
    showToast('يرجى ملء جميع الحقول المطلوبة بشكل صحيح', 'error');
    return;
  }
  // After calculation, show mini summary card
  setTimeout(() => {
    miniSummaryItem.textContent = subItemSelect.value;
    miniSummaryQty.textContent = itemQuantityInput.value;
    miniSummaryTotal.textContent = document.getElementById('totalCost').textContent.replace(/[^\d.]/g, '');
    miniSummaryCard.classList.remove('hidden');
  }, 200);
});
// Hide mini summary card if any input changes
[mainItemSelect, subItemSelect, itemQuantityInput].forEach(el => {
  el.addEventListener('input', () => miniSummaryCard.classList.add('hidden'));
  el.addEventListener('change', () => miniSummaryCard.classList.add('hidden'));
});

// --- Collapsible Cards UI ---
document.querySelectorAll('.collapsible-header').forEach(header => {
  header.addEventListener('click', function() {
    const card = this.closest('.collapsible-card');
    card.classList.toggle('collapsed');
  });
});

// --- Project Section UI: Always show both project-existing and project-new ---
function updateProjectSectionUI() {
  const projectExisting = document.querySelector('.project-existing');
  const projectNew = document.querySelector('.project-new');
  if (projectExisting) projectExisting.style.display = '';
  if (projectNew) projectNew.style.display = '';
}
document.getElementById('projectSelect').addEventListener('change', updateProjectSectionUI);
window.addEventListener('DOMContentLoaded', updateProjectSectionUI);

// Tab switching functionality
document.addEventListener('DOMContentLoaded', function() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      
      // Remove active class from all tabs and contents
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      this.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
  });
});
