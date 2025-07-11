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
  // Check for missing prices after saving
  const projectPrices = JSON.parse(localStorage.getItem(`project_${projectName}`)) || {};
  const filtered = getCurrentItemRates(itemName);
  let missing = false;
  filtered.forEach((rowObj) => {
    let unitPrice = parseFloat(projectPrices[rowObj.resource]);
    if (isNaN(unitPrice) || unitPrice === 0) missing = true;
  });
  // Load saved items for this project
  const key = `items_${projectName}`;
  const saved = JSON.parse(localStorage.getItem(key)) || [];
  saved.push({ item: itemName, quantity, cost: parseFloat(totalCost) });
  localStorage.setItem(key, JSON.stringify(saved));
  showToast("تم حفظ البند", 'success');
  loadSavedItems();
  if (missing) {
    showToast('⚠️ يوجد مورد أو أكثر بدون سعر! الرجاء مراجعة الأسعار.', 'warning');
  }
});

// تحميل البنود المحفوظة
function loadSavedItems() {
  const projectName = document.getElementById("projectSelect").value;
  const key = `items_${projectName}`;
  const saved = JSON.parse(localStorage.getItem(key)) || [];
  const tbody = document.querySelector("#savedItemsTable tbody");
  tbody.innerHTML = "";
  
  // Show message when table is empty but section is visible
  if (saved.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="5" style="text-align: center; padding: 20px; color: #888; font-style: italic;">
        لا توجد بنود محفوظة في هذا المشروع
        ${deletedItemsStack.length > 0 ? '<br><small style="color: #e6a200;">يمكنك استخدام زر التراجع لإعادة البنود المحذوفة</small>' : ''}
      </td>
    `;
    tbody.appendChild(emptyRow);
  }
  
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
      <td><button class="expandDetailsBtn" data-idx="${idx}" title="تعديل"><span style="font-size:1.2em;">✏️</span></button></td>
    `;
    tbody.appendChild(tr);

    // إضافة صف التفاصيل (سيتم إظهاره عند الضغط على الزر)
    const detailsTr = document.createElement("tr");
    detailsTr.classList.add("details-row");
    detailsTr.style.display = "none";
    detailsTr.innerHTML = `<td colspan="5"><div class="details-content" id="details-content-${idx}"></div></td>`;
    tbody.appendChild(detailsTr);
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
      <summary style="color: #e6a200; margin-bottom: 12px; padding: 14px 18px; background: #2d2d2d; border-radius: 8px; border-right: 4px solid #444; font-size: 1.15em; font-weight: bold; cursor: pointer; outline: none; user-select: none;">ملخص تكاليف المشروع</summary>
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
  
  // Always show the savedItemsSection so the undo button remains visible
  document.getElementById("savedItemsSection").classList.remove("hidden");

  // إضافة مستمعات زر التفاصيل
  tbody.querySelectorAll('.expandDetailsBtn').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = +this.dataset.idx;
      const detailsRow = tbody.querySelectorAll('.details-row')[idx];
      const detailsDiv = document.getElementById(`details-content-${idx}`);
      // إظهار أو إخفاء التفاصيل
      if (detailsRow.style.display === "none") {
        renderSimpleResourceTableForSavedItem(saved[idx], idx, detailsDiv);
        detailsRow.style.display = "table-row";
        this.innerHTML = '<span style="font-size:1.2em;">❌</span>';
      } else {
        detailsRow.style.display = "none";
        this.innerHTML = '<span style="font-size:1.2em;">✏️</span>';
      }
    });
  });
}

// حذف بند محفوظ
let deletedItemsStack = [];

window.removeSavedItem = function(idx) {
  const projectName = document.getElementById("projectSelect").value;
  const key = `items_${projectName}`;
  const saved = JSON.parse(localStorage.getItem(key)) || [];
  const item = saved[idx];
  deletedItemsStack.push({ item, idx, projectName });
  saved.splice(idx, 1);
  
  // Always keep the items array in localStorage, even if empty
  localStorage.setItem(key, JSON.stringify(saved));
  
  loadSavedItems();
  showUndoButton();
  showToast('تم حذف البند', 'success');
};

function showUndoButton() {
  const undoBtn = document.getElementById('undoDeleteBtn');
  if (deletedItemsStack.length > 0) {
    undoBtn.style.display = '';
  } else {
    undoBtn.style.display = 'none';
  }
}

document.getElementById('undoDeleteBtn').addEventListener('click', function() {
  if (deletedItemsStack.length > 0) {
    const lastDeleted = deletedItemsStack.pop();
    const key = `items_${lastDeleted.projectName}`;
    const saved = JSON.parse(localStorage.getItem(key)) || [];
    
    // Insert the item back at its original position
    saved.splice(lastDeleted.idx, 0, lastDeleted.item);
    localStorage.setItem(key, JSON.stringify(saved));
    
    // Reload the current project's items
    loadSavedItems();
    showToast('تم التراجع عن الحذف', 'success');
    showUndoButton();
  }
});

// Clear undo stack on project change
projectSelect.addEventListener("change", function() {
  // Don't clear the undo stack when changing projects
  // This allows undoing deletions from other projects
  showUndoButton();
  
  // Save last used project
  localStorage.setItem('lastProject', projectSelect.value);
  
  // Update sections and load data
  updateSections();
  loadProjectPrices(projectSelect.value);
  loadSavedItems();
  
  // Show/hide delete button based on project selection
  showDeleteProjectButton();
});

// Delete project functionality
function showDeleteProjectButton() {
  const deleteBtn = document.getElementById('deleteProjectBtn');
  const selectedProject = projectSelect.value;
  
  if (selectedProject && selectedProject !== '') {
    deleteBtn.style.display = 'flex';
  } else {
    deleteBtn.style.display = 'none';
  }
}

function deleteProject() {
  const projectName = projectSelect.value;
  if (!projectName) {
    showToast('لم يتم اختيار مشروع للحذف', 'error');
    return;
  }
  
  // Confirm deletion
  if (!confirm(`هل أنت متأكد من حذف المشروع "${projectName}"؟\n\nسيتم حذف جميع البيانات المرتبطة به نهائياً.`)) {
    return;
  }
  
  // Remove project data from localStorage
  localStorage.removeItem(`project_${projectName}`);
  localStorage.removeItem(`items_${projectName}`);
  
  // Clear undo stack for this project
  deletedItemsStack = deletedItemsStack.filter(item => item.projectName !== projectName);
  
  // Clear last project if it was the deleted one
  if (localStorage.getItem('lastProject') === projectName) {
    localStorage.removeItem('lastProject');
  }
  
  // Reload projects and reset selection
  loadProjects();
  projectSelect.value = '';
  updateSections();
  showDeleteProjectButton();
  showUndoButton();
  
  showToast(`تم حذف المشروع "${projectName}" بنجاح`, 'success');
}

// Add event listener for delete project button
document.getElementById('deleteProjectBtn').addEventListener('click', deleteProject);

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
  
  // Initialize project section UI
  updateProjectSectionUI();
  
  // Initialize delete project button visibility
  showDeleteProjectButton();
});

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
  
  // Also check for projects that have items but no project_ key
  const itemKeys = Object.keys(localStorage).filter(key => key.startsWith("items_"));
  itemKeys.forEach(itemKey => {
    const projectName = itemKey.replace("items_", "");
    if (![...projectSelect.options].some(opt => opt.value === projectName)) {
      const option = document.createElement("option");
      option.value = projectName;
      option.textContent = projectName;
      projectSelect.appendChild(option);
    }
  });
}

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
  // Reset main and sub item selects
  const mainItemSelect = document.getElementById('mainItemSelect');
  const itemSelect = document.getElementById('itemSelect');
  if (mainItemSelect) mainItemSelect.value = '';
  if (itemSelect) {
    itemSelect.innerHTML = '<option value="">-- اختر --</option>';
    itemSelect.disabled = true;
  }
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
    input.id = resource;
    input.name = resource;
    input.setAttribute('aria-label', `سعر ${resource}`);
    const val = prices[resource];
    input.value = (val && val !== 0) ? val : '';
    input.dataset.resource = resource;
    
    // Add event listener for price changes
    input.addEventListener('change', function() {
      const projectName = document.getElementById('projectSelect').value;
      if (!projectName) return;
      const prices = JSON.parse(localStorage.getItem(`project_${projectName}`)) || {};
      prices[this.dataset.resource] = parseFloat(this.value) || 0;
      localStorage.setItem(`project_${projectName}`, JSON.stringify(prices));
      showToast('✅ تم حفظ السعر مباشرة', 'success');
      
      // Update calculation table if it's currently displayed
      updateCalculationIfVisible();
      
      // Update saved items table to reflect new prices
      updateSavedItemsWithNewPrices();
    });
    
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
      <td><input type="number" min="0" step="any" value="${quantityPerUnit}" data-idx="${idx}" class="rateInput" id="${resource}_rate" name="${resource}_rate" aria-label="معدل ${resource}" style="width:90px"></td>
      <td>${totalQty.toFixed(2)} ${unit}</td>
      <td>${unitPrice.toLocaleString()}</td>
      <td>${cost.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</td>
      <td><button class="resetRowRateBtn" data-idx="${idx}">إعادة</button></td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById("totalCost").textContent = `${total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  document.getElementById("resultSection").classList.remove("hidden");
  warningDiv.textContent = '';

  // Update the sticky summary label
  document.querySelector('.sticky-summary').innerHTML = `<strong>التكلفة الإجمالية :</strong> <span id="totalCost">${total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</span> جنيه`;
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

function tryInstantCalculation() {
  const itemName = document.getElementById("itemSelect").value;
  const quantity = parseFloat(document.getElementById("itemQuantity").value);
  const projectName = document.getElementById("projectSelect").value;
  if (!itemName || isNaN(quantity) || quantity <= 0) {
    // Optionally, you can clear the result section here
    return;
  }
  const projectPrices = JSON.parse(localStorage.getItem(`project_${projectName}`)) || {};
  tempRates = getCurrentItemRates(itemName); // نسخة مؤقتة
  renderCalculationTable(tempRates, quantity, projectPrices);
  document.getElementById('resetRatesBtn').classList.add('hidden');
}

document.getElementById('itemQuantity').addEventListener('input', tryInstantCalculation);
document.getElementById('mainItemSelect').addEventListener('change', tryInstantCalculation);
document.getElementById('itemSelect').addEventListener('change', function() {
  // Save last used sub item
  localStorage.setItem('lastSubItem', this.value);
  
  // Clear quantity and reset calculation
  document.getElementById('itemQuantity').value = '';
  document.getElementById('resultTableBody').innerHTML = '';
  document.getElementById('resultSection').classList.add('hidden');
  
  // Clear input errors
  clearInputErrors();
  
  // Try instant calculation
  tryInstantCalculation();
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
  // Load sub items list
  loadSubItemsList(this.value);
  
  // Save last used main item
  localStorage.setItem('lastMainItem', this.value);
  
  // Clear quantity and reset calculation
  document.getElementById('itemQuantity').value = '';
  document.getElementById('resultTableBody').innerHTML = '';
  document.getElementById('resultSection').classList.add('hidden');
  
  // Clear input errors
  clearInputErrors();
  
  // Try instant calculation if possible
  tryInstantCalculation();
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
// Event listeners are now set up in loadProjectPrices function for dynamically created inputs

// Function to update calculation table when prices change
function updateCalculationIfVisible() {
  const resultSection = document.getElementById('resultSection');
  if (!resultSection.classList.contains('hidden')) {
    const itemName = document.getElementById("itemSelect").value;
    const quantity = parseFloat(document.getElementById("itemQuantity").value);
    const projectName = document.getElementById("projectSelect").value;
    
    if (itemName && !isNaN(quantity) && quantity > 0) {
      const projectPrices = JSON.parse(localStorage.getItem(`project_${projectName}`)) || {};
      renderCalculationTable(tempRates, quantity, projectPrices);
    }
  }
}

// Function to update saved items with new prices
function updateSavedItemsWithNewPrices() {
  const projectName = document.getElementById("projectSelect").value;
  if (!projectName) return;
  
  const key = `items_${projectName}`;
  const saved = JSON.parse(localStorage.getItem(key)) || [];
  const projectPrices = JSON.parse(localStorage.getItem(`project_${projectName}`)) || {};
  
  let updated = false;
  
  // Recalculate costs for all saved items
  saved.forEach(item => {
    const itemResources = itemsList.filter(i => i.item === item.item);
    let newCost = 0;
    
    itemResources.forEach(resource => {
      const cost = (resource.quantityPerUnit * item.quantity * (projectPrices[resource.resource] || 0));
      newCost += cost;
    });
    
    // Update cost if it changed
    if (Math.abs(newCost - item.cost) > 0.01) {
      item.cost = newCost;
      updated = true;
    }
  });
  
  // Save updated items if any costs changed
  if (updated) {
    localStorage.setItem(key, JSON.stringify(saved));
    loadSavedItems(); // Refresh the display
    showToast('🔄 تم تحديث تكاليف البنود المحفوظة', 'success');
  }
}

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
// REMOVED: Duplicate DOMContentLoaded listener - already handled above

// Save last used main/sub item on change
// REMOVED: Duplicate mainItemSelect listener - consolidated above

// 2. Auto-focus first input in each section when shown
function focusFirstInput(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const input = section.querySelector('input, select');
  if (input) setTimeout(() => input.focus(), 200);
}

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

// دالة رسم جدول الموارد المبسط داخل تفاصيل البند
function renderSimpleResourceTableForSavedItem(item, idx, container) {
  // الحصول على الموارد الخاصة بالبند
  const itemResources = itemsList.filter(i => i.item === item.item);
  const projectName = document.getElementById("projectSelect").value;
  const projectPrices = JSON.parse(localStorage.getItem(`project_${projectName}`)) || {};
  let html = `<table class="compact-table" style="width:100%; margin:10px 0; background:#232323; border-radius:8px;">
    <thead>
      <tr style="background:#444; color:#e6a200;">
        <th>المورد</th>
        <th>الوحدة</th>
        <th>معدل الفرد</th>
        <th>الكمية المطلوبة</th>
        <th>السعر</th>
        <th>التكلفة</th>
      </tr>
    </thead>
    <tbody>`;
  itemResources.forEach((res, i) => {
    const unitPrice = parseFloat(projectPrices[res.resource]) || 0;
    const totalQty = res.quantityPerUnit * item.quantity;
    const cost = totalQty * unitPrice;
    html += `<tr>
      <td>${res.resource}</td>
      <td>${res.unit}</td>
      <td><input type="number" min="0" step="any" value="${res.quantityPerUnit}" data-idx="${i}" class="editRateInput" style="width:80px"></td>
      <td>${totalQty.toFixed(2)}</td>
      <td>${unitPrice.toLocaleString()}</td>
      <td>${cost.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  // زر معدلات الفرد الافتراضية
  html += `<button id="reset-default-rates-${idx}" style="margin-bottom:10px;">معدلات الفرد الافتراضية</button>`;
  // حقل تعديل الكمية وزر حفظ التعديل
  html += `<div style="margin:10px 0;">
    <label>الكمية: <input type="number" min="0" step="any" value="${item.quantity}" id="edit-qty-${idx}" style="width:90px"></label>
    <button id="save-edit-btn-${idx}" style="margin-right:20px;">حفظ التعديل</button>
  </div>`;
  container.innerHTML = html;

  // منطق زر معدلات الفرد الافتراضية
  document.getElementById(`reset-default-rates-${idx}`).onclick = function() {
    const defaultRates = itemsList.filter(i => i.item === item.item).map(obj => obj.quantityPerUnit);
    container.querySelectorAll('.editRateInput').forEach((input, i) => {
      input.value = defaultRates[i] || 0;
    });
  };

  // إضافة منطق حفظ التعديل
  document.getElementById(`save-edit-btn-${idx}`).onclick = function() {
    const projectName = document.getElementById("projectSelect").value;
    const key = `items_${projectName}`;
    const saved = JSON.parse(localStorage.getItem(key)) || [];
    // قراءة الكمية الجديدة
    const newQty = parseFloat(document.getElementById(`edit-qty-${idx}`).value) || 0;
    // قراءة معدلات الفرد الجديدة
    const newRates = [];
    const itemResources = itemsList.filter(i => i.item === item.item);
    container.querySelectorAll('.editRateInput').forEach((input, i) => {
      const val = parseFloat(input.value) || 0;
      newRates[i] = val;
    });
    // تحديث معدلات الفرد في itemResources
    itemResources.forEach((res, i) => {
      res.quantityPerUnit = newRates[i];
    });
    // إعادة حساب التكلفة
    const projectPrices = JSON.parse(localStorage.getItem(`project_${projectName}`)) || {};
    let newCost = 0;
    itemResources.forEach(res => {
      const unitPrice = parseFloat(projectPrices[res.resource]) || 0;
      const totalQty = res.quantityPerUnit * newQty;
      newCost += totalQty * unitPrice;
    });
    // تحديث البند في مكانه
    saved[idx] = {
      item: item.item,
      quantity: newQty,
      cost: newCost
    };
    localStorage.setItem(key, JSON.stringify(saved));
    loadSavedItems();
    // إغلاق التفاصيل بعد الحفظ
    const tbody = container.closest('tbody');
    if (tbody) {
      const expandBtn = tbody.querySelector(`.expandDetailsBtn[data-idx="${idx}"]`);
      const detailsRow = tbody.querySelectorAll('.details-row')[idx];
      if (detailsRow) detailsRow.style.display = "none";
      if (expandBtn) expandBtn.textContent = "⬇️";
    }
    showToast('تم حفظ التعديلات بنجاح', 'success');
  };
}
