const PurchaseModule = {
  state: {
    suppliers: [],
    purchaseOrders: [],
    purchaseFlow: [],
    wireStock: [],
    wireFlow: [],
    orders: [],
    batches: [],
    templates: [],
    packaging: [],
    callbacks: null,
    editingSupplierId: null,
    editingPurchaseOrderId: null,
    activeSubTab: "replenishment"
  },

  init(data, callbacks) {
    this.state.suppliers = data.suppliers || [];
    this.state.purchaseOrders = data.purchaseOrders || [];
    this.state.purchaseFlow = data.purchaseFlow || [];
    this.state.wireStock = data.wireStock || [];
    this.state.wireFlow = data.wireFlow || [];
    this.state.orders = data.orders || [];
    this.state.batches = data.batches || [];
    this.state.templates = data.templates || [];
    this.state.packaging = data.packaging || [];
    this.state.callbacks = callbacks || {};
    this.bindEvents();
    this.renderAll();
  },

  updateData(data) {
    if (data.suppliers !== undefined) this.state.suppliers = data.suppliers;
    if (data.purchaseOrders !== undefined) this.state.purchaseOrders = data.purchaseOrders;
    if (data.purchaseFlow !== undefined) this.state.purchaseFlow = data.purchaseFlow;
    if (data.wireStock !== undefined) this.state.wireStock = data.wireStock;
    if (data.wireFlow !== undefined) this.state.wireFlow = data.wireFlow;
    if (data.orders !== undefined) this.state.orders = data.orders;
    if (data.batches !== undefined) this.state.batches = data.batches;
    if (data.templates !== undefined) this.state.templates = data.templates;
    if (data.packaging !== undefined) this.state.packaging = data.packaging;
  },

  saveAll() {
    Storage.saveSuppliers(this.state.suppliers);
    Storage.savePurchaseOrders(this.state.purchaseOrders);
    Storage.savePurchaseFlow(this.state.purchaseFlow);
    Storage.saveWireStock(this.state.wireStock);
    Storage.saveWireFlow(this.state.wireFlow);
    if (this.state.callbacks.onDataChange) {
      this.state.callbacks.onDataChange({
        suppliers: this.state.suppliers,
        purchaseOrders: this.state.purchaseOrders,
        purchaseFlow: this.state.purchaseFlow,
        wireStock: this.state.wireStock,
        wireFlow: this.state.wireFlow
      });
    }
  },

  addSupplier(data) {
    const supplier = {
      id: crypto.randomUUID(),
      name: data.name.trim(),
      contact: data.contact || "",
      phone: data.phone || "",
      address: data.address || "",
      note: data.note || "",
      createdAt: new Date().toISOString()
    };
    this.state.suppliers.unshift(supplier);
    addPurchaseFlow(null, "supplier_create", `新增供应商：${supplier.name}`, this.state.purchaseFlow);
    this.saveAll();
    return supplier;
  },

  updateSupplier(id, data) {
    const supplier = this.state.suppliers.find(s => s.id === id);
    if (!supplier) return null;
    const oldName = supplier.name;
    supplier.name = data.name.trim();
    supplier.contact = data.contact || "";
    supplier.phone = data.phone || "";
    supplier.address = data.address || "";
    supplier.note = data.note || "";
    addPurchaseFlow(null, "supplier_update", `更新供应商：${oldName} → ${supplier.name}`, this.state.purchaseFlow);
    this.saveAll();
    return supplier;
  },

  deleteSupplier(id) {
    const supplier = this.state.suppliers.find(s => s.id === id);
    if (!supplier) return false;
    if (!confirm(`确认删除供应商「${supplier.name}」？`)) return false;
    this.state.suppliers = this.state.suppliers.filter(s => s.id !== id);
    addPurchaseFlow(null, "supplier_delete", `删除供应商：${supplier.name}`, this.state.purchaseFlow);
    this.saveAll();
    return true;
  },

  generatePurchaseOrderNo() {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}`;
    const yearOrders = this.state.purchaseOrders.filter(po => po.orderNo && po.orderNo.startsWith(prefix));
    const maxNum = yearOrders.reduce((max, po) => {
      const num = parseInt(po.orderNo.replace(prefix, ""), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
  },

  createPurchaseOrder(data) {
    const supplier = data.supplierId ? this.state.suppliers.find(s => s.id === data.supplierId) : null;
    const qty = Number(data.qty);
    const unitPrice = Number(data.unitPrice);
    const totalAmount = Math.round(qty * unitPrice * 100) / 100;
    const po = {
      id: crypto.randomUUID(),
      orderNo: this.generatePurchaseOrderNo(),
      supplierId: data.supplierId || null,
      supplierName: supplier ? supplier.name : (data.supplierName || ""),
      wireSpec: data.wireSpec.trim(),
      qty: qty,
      unit: data.unit || "米",
      unitPrice: unitPrice,
      totalAmount: totalAmount,
      expectedDate: data.expectedDate || "",
      status: "pending",
      note: data.note || "",
      receivedQty: 0,
      createdAt: new Date().toISOString(),
      receivedAt: null
    };
    this.state.purchaseOrders.unshift(po);
    addPurchaseFlow(po.id, "po_create", `创建采购单 ${po.orderNo}：${po.wireSpec} ${po.qty}${po.unit}`, this.state.purchaseFlow);
    this.saveAll();
    return po;
  },

  updatePurchaseOrder(id, data) {
    const po = this.state.purchaseOrders.find(p => p.id === id);
    if (!po || po.status === "completed" || po.status === "cancelled") return null;
    if (po.receivedQty > 0) {
      alert("已部分到货的采购单无法修改，请取消后重新创建");
      return null;
    }
    const supplier = data.supplierId ? this.state.suppliers.find(s => s.id === data.supplierId) : null;
    const qty = Number(data.qty);
    const unitPrice = Number(data.unitPrice);
    const totalAmount = Math.round(qty * unitPrice * 100) / 100;
    po.supplierId = data.supplierId || null;
    po.supplierName = supplier ? supplier.name : (data.supplierName || "");
    po.wireSpec = data.wireSpec.trim();
    po.qty = qty;
    po.unit = data.unit || "米";
    po.unitPrice = unitPrice;
    po.totalAmount = totalAmount;
    po.expectedDate = data.expectedDate || "";
    po.note = data.note || "";
    addPurchaseFlow(po.id, "po_update", `更新采购单 ${po.orderNo}`, this.state.purchaseFlow);
    this.saveAll();
    return po;
  },

  cancelPurchaseOrder(id) {
    const po = this.state.purchaseOrders.find(p => p.id === id);
    if (!po || po.status === "completed" || po.status === "cancelled") return false;
    if (!confirm(`确认取消采购单「${po.orderNo}」？`)) return false;
    if (po.receivedQty > 0) {
      if (!confirm("该采购单已有部分到货，取消后已入库的库存不会减少。确认取消吗？")) return false;
    }
    po.status = "cancelled";
    addPurchaseFlow(po.id, "po_cancel", `取消采购单 ${po.orderNo}`, this.state.purchaseFlow);
    this.saveAll();
    return true;
  },

  receivePurchaseOrder(id, receiveQty) {
    const po = this.state.purchaseOrders.find(p => p.id === id);
    if (!po || po.status === "cancelled") return null;
    if (po.status === "completed") {
      alert("该采购单已全部到货，不能重复入库");
      return null;
    }
    const qty = Number(receiveQty);
    if (qty <= 0) {
      alert("入库数量必须大于0");
      return null;
    }
    const remaining = po.qty - po.receivedQty;
    if (qty > remaining) {
      alert(`入库数量不能超过剩余未到货数量（${remaining} ${po.unit}）`);
      return null;
    }
    let wire = this.state.wireStock.find(w => w.spec === po.wireSpec);
    let wireId;
    if (wire) {
      wireId = wire.id;
      wire.qty += qty;
      addWireFlow(wire.id, wire.spec, "in", qty, wire.qty, `采购入库：${po.orderNo}，+${qty} ${wire.unit}${po.note ? "，" + po.note : ""}`, this.state.wireFlow);
    } else {
      const newWire = {
        id: crypto.randomUUID(),
        spec: po.wireSpec,
        qty: qty,
        unit: po.unit,
        safeStock: 200,
        note: po.supplierName || "",
        createdAt: new Date().toISOString()
      };
      wireId = newWire.id;
      this.state.wireStock.unshift(newWire);
      addWireFlow(newWire.id, newWire.spec, "in", qty, qty, `新规格采购入库：${po.orderNo}，+${qty} ${newWire.unit}`, this.state.wireFlow);
      wire = newWire;
    }
    po.receivedQty += qty;
    if (po.receivedQty >= po.qty) {
      po.status = "completed";
      po.receivedAt = new Date().toISOString();
    } else {
      po.status = "partial";
    }
    addPurchaseFlow(po.id, "po_receive", `采购单 ${po.orderNo} 到货入库：${qty} ${po.unit}（累计 ${po.receivedQty}/${po.qty}）`, this.state.purchaseFlow);
    this.saveAll();
    return { po, wireId };
  },

  getReplenishmentSuggestions() {
    return calculateReplenishment(
      this.state.wireStock,
      this.state.orders,
      this.state.batches,
      this.state.templates,
      this.state.packaging,
      this.state.purchaseOrders
    );
  },

  renderAll() {
    this.renderStats();
    this.renderReplenishment();
    this.renderReplenishSummary();
    this.renderSupplierList();
    this.renderPurchaseOrderList();
    this.renderPurchaseFlow();
    this.renderSupplierSelects();
    this.renderWireSpecSelects();
  },

  renderReplenishSummary() {
    const listEl = document.getElementById("replenishSummaryList");
    if (!listEl) return;
    const wireStock = this.state.wireStock;
    if (wireStock.length === 0) {
      listEl.innerHTML = `<div class="wire-empty">暂无钢丝库存</div>`;
      return;
    }
    listEl.innerHTML = wireStock.map(wire => {
      const status = getWireStatus(wire);
      const statusLabel = status === "out" ? "已缺货" : (status === "low" ? "库存偏低" : "库存正常");
      return `<div class="wire-card ${status}">
        <div class="wire-head">
          <div>
            <strong>${wire.spec}</strong>
            <div class="wire-meta">安全库存：${wire.safeStock} ${wire.unit}</div>
          </div>
          <div>
            <span class="wire-qty ${status}">${wire.qty.toFixed(2)}</span>
            <span class="wire-unit">${wire.unit}</span>
            <div class="wire-meta" style="text-align: right;">${statusLabel}</div>
          </div>
        </div>
      </div>`;
    }).join("");
  },

  renderStats() {
    const statsEl = document.getElementById("purchaseStats");
    if (!statsEl) return;
    const totalSuppliers = this.state.suppliers.length;
    const totalPOs = this.state.purchaseOrders.length;
    const pendingPOs = this.state.purchaseOrders.filter(po => po.status === "pending" || po.status === "partial").length;
    const suggestions = this.getReplenishmentSuggestions();
    const urgentCount = suggestions.filter(s => s.urgency === "critical" || s.urgency === "urgent").length;
    statsEl.innerHTML = `
      <div class="stat"><span>供应商</span><b>${totalSuppliers}</b><span class="meta">家</span></div>
      <div class="stat"><span>采购单总数</span><b>${totalPOs}</b><span class="meta">笔</span></div>
      <div class="stat"><span>待到货</span><b style="color: var(--gold);">${pendingPOs}</b><span class="meta">笔</span></div>
      <div class="stat"><span>补货提醒</span><b style="color: var(--red);">${urgentCount}</b><span class="meta">紧急项</span></div>
    `;
  },

  renderReplenishment() {
    const listEl = document.getElementById("replenishmentList");
    if (!listEl) return;
    const suggestions = this.getReplenishmentSuggestions();
    if (suggestions.length === 0) {
      listEl.innerHTML = `<div class="wire-empty">暂无补货需求，所有钢丝库存充足</div>`;
      return;
    }
    const urgencyLabels = {
      critical: "已缺货",
      urgent: "紧急补货",
      warning: "库存偏低",
      suggest: "建议补货"
    };
    listEl.innerHTML = suggestions.map(s => `
      <div class="replenish-card ${s.urgency}">
        <div class="replenish-head">
          <div>
            <strong>${s.spec}</strong>
            <span class="replenish-badge ${s.urgency}">${urgencyLabels[s.urgency]}</span>
          </div>
          <div class="replenish-qty">
            ${s.currentQty.toFixed(2)} <span class="wire-unit">${s.unit}</span>
          </div>
        </div>
        <div class="replenish-details">
          <div><span>安全库存</span><b>${s.safeStock} ${s.unit}</b></div>
          <div><span>在途采购</span><b>${s.pendingQty} ${s.unit}</b></div>
          <div><span>订单需求</span><b>${s.demandQty.toFixed(2)} ${s.unit}</b></div>
          <div><span>缺口</span><b style="color: var(--red);">${s.shortfall.toFixed(2)} ${s.unit}</b></div>
        </div>
        <div class="wire-actions">
          <button class="good" onclick="PurchaseModule.quickCreatePO('${s.spec}', ${s.suggestedQty})">快速下单 ${s.suggestedQty} ${s.unit}</button>
          <button class="secondary" onclick="PurchaseModule.showSubTab('purchaseOrders')">查看采购单</button>
        </div>
      </div>
    `).join("");
  },

  renderSupplierList() {
    const listEl = document.getElementById("supplierList");
    if (!listEl) return;
    if (this.state.suppliers.length === 0) {
      listEl.innerHTML = `<div class="wire-empty">暂无供应商，点击左侧表单添加</div>`;
      return;
    }
    listEl.innerHTML = this.state.suppliers.map(s => `
      <div class="supplier-card">
        <div class="supplier-head">
          <strong>${s.name}</strong>
          ${s.contact ? `<span class="supplier-contact">${s.contact}</span>` : ""}
        </div>
        <div class="supplier-meta">
          ${s.phone ? `<div>📞 ${s.phone}</div>` : ""}
          ${s.address ? `<div>📍 ${s.address}</div>` : ""}
          ${s.note ? `<div>📝 ${s.note}</div>` : ""}
        </div>
        <div class="wire-actions">
          <button class="good" onclick="PurchaseModule.editSupplier('${s.id}')">编辑</button>
          <button class="warn" onclick="PurchaseModule.createPOFromSupplier('${s.id}')">新建采购</button>
          <button class="danger" onclick="PurchaseModule.deleteSupplierById('${s.id}')">删除</button>
        </div>
      </div>
    `).join("");
  },

  renderPurchaseOrderList() {
    const listEl = document.getElementById("purchaseOrderList");
    if (!listEl) return;
    if (this.state.purchaseOrders.length === 0) {
      listEl.innerHTML = `<div class="wire-empty">暂无采购单，点击左侧表单创建</div>`;
      return;
    }
    const statusLabels = PurchaseOrderStatusLabels;
    listEl.innerHTML = this.state.purchaseOrders.map(po => `
      <div class="po-card ${po.status}">
        <div class="po-head">
          <div>
            <strong>${po.orderNo}</strong>
            <span class="po-status ${po.status}">${statusLabels[po.status] || po.status}</span>
          </div>
          <div class="po-amount">¥${po.totalAmount.toFixed(2)}</div>
        </div>
        <div class="po-details">
          <div><span>供应商</span><b>${po.supplierName || "-"}</b></div>
          <div><span>钢丝规格</span><b>${po.wireSpec}</b></div>
          <div><span>采购数量</span><b>${po.qty} ${po.unit}</b></div>
          <div><span>已到货</span><b>${po.receivedQty} ${po.unit}</b></div>
          <div><span>预计到货</span><b>${po.expectedDate || "-"}</b></div>
          <div><span>单价</span><b>¥${po.unitPrice.toFixed(2)}/${po.unit}</b></div>
        </div>
        ${po.note ? `<div class="po-note">📝 ${po.note}</div>` : ""}
        <div class="wire-actions">
          ${(po.status === "pending" || po.status === "partial") ? `
            <button class="good" onclick="PurchaseModule.openReceiveModal('${po.id}')">到货入库</button>
            ${po.receivedQty === 0 ? `<button class="secondary" onclick="PurchaseModule.editPurchaseOrder('${po.id}')">编辑</button>` : ""}
            <button class="warn" onclick="PurchaseModule.cancelPurchaseOrderById('${po.id}')">取消</button>
          ` : ""}
          ${po.status === "completed" ? `<span class="po-done">✅ 已完成</span>` : ""}
          ${po.status === "cancelled" ? `<span class="po-cancelled">❌ 已取消</span>` : ""}
        </div>
      </div>
    `).join("");
  },

  renderPurchaseFlow() {
    const listEl = document.getElementById("purchaseFlowList");
    if (!listEl) return;
    if (this.state.purchaseFlow.length === 0) {
      listEl.innerHTML = `<div class="empty">暂无流水记录</div>`;
      return;
    }
    const typeLabels = {
      supplier_create: "新增供应商",
      supplier_update: "更新供应商",
      supplier_delete: "删除供应商",
      po_create: "创建采购单",
      po_update: "更新采购单",
      po_cancel: "取消采购单",
      po_receive: "到货入库",
      create: "初始化"
    };
    listEl.innerHTML = this.state.purchaseFlow.slice(0, 50).map(f => `
      <div class="wire-flow-item ${f.type}">
        <div><strong>${typeLabels[f.type] || f.type}</strong></div>
        <div class="wire-meta">${f.remark || ""}</div>
        <div class="wire-flow-time">${new Date(f.time).toLocaleString()}</div>
      </div>
    `).join("");
  },

  renderSupplierSelects() {
    const selects = ["supplierSelect", "poSupplierSelect"];
    selects.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (!select) return;
      const current = select.value;
      select.innerHTML = `<option value="">请选择供应商</option>` +
        this.state.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
      if (current && this.state.suppliers.find(s => s.id === current)) {
        select.value = current;
      }
    });
  },

  renderWireSpecSelects() {
    const selects = ["replenishWireSelect", "poWireSpecSelect"];
    selects.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (!select) return;
      const current = select.value;
      const specs = [...new Set(this.state.wireStock.map(w => w.spec))];
      select.innerHTML = `<option value="">请选择或输入规格</option>` +
        specs.map(s => `<option value="${s}">${s}</option>`).join("");
      if (current && specs.includes(current)) {
        select.value = current;
      }
    });
  },

  bindEvents() {
    const subTabs = document.querySelectorAll(".purchase-sub-tab");
    subTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        const tabName = tab.dataset.subtab;
        this.showSubTab(tabName);
      });
    });
    const supplierForm = document.getElementById("supplierForm");
    if (supplierForm) {
      supplierForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSupplierSubmit();
      });
    }
    const supplierCancelBtn = document.getElementById("supplierFormCancel");
    if (supplierCancelBtn) {
      supplierCancelBtn.addEventListener("click", () => {
        this.resetSupplierForm();
      });
    }
    const poForm = document.getElementById("purchaseOrderForm");
    if (poForm) {
      poForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handlePurchaseOrderSubmit();
      });
    }
    const poCancelBtn = document.getElementById("poFormCancel");
    if (poCancelBtn) {
      poCancelBtn.addEventListener("click", () => {
        this.resetPurchaseOrderForm();
      });
    }
    const supplierSelect = document.getElementById("poSupplierSelect");
    if (supplierSelect) {
      supplierSelect.addEventListener("change", () => {
        const supplier = this.state.suppliers.find(s => s.id === supplierSelect.value);
        const nameInput = document.getElementById("poSupplierName");
        if (supplier && nameInput) {
          nameInput.value = supplier.name;
        }
      });
    }
    const poQtyInput = document.getElementById("poQty");
    const poPriceInput = document.getElementById("poUnitPrice");
    const poTotalInput = document.getElementById("poTotalAmount");
    const calcTotal = () => {
      if (poQtyInput && poPriceInput && poTotalInput) {
        const qty = Number(poQtyInput.value) || 0;
        const price = Number(poPriceInput.value) || 0;
        poTotalInput.value = (qty * price).toFixed(2);
      }
    };
    if (poQtyInput) poQtyInput.addEventListener("input", calcTotal);
    if (poPriceInput) poPriceInput.addEventListener("input", calcTotal);
    const receiveForm = document.getElementById("receiveForm");
    if (receiveForm) {
      receiveForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleReceiveSubmit();
      });
    }
    const receiveModalClose = document.getElementById("closeReceiveModal");
    const receiveModalCancel = document.getElementById("cancelReceive");
    if (receiveModalClose) receiveModalClose.addEventListener("click", () => this.closeReceiveModal());
    if (receiveModalCancel) receiveModalCancel.addEventListener("click", () => this.closeReceiveModal());
    const receiveModalMask = document.querySelector("#receiveModal .modal-mask");
    if (receiveModalMask) receiveModalMask.addEventListener("click", () => this.closeReceiveModal());
    const saveReceiveBtn = document.getElementById("saveReceive");
    if (saveReceiveBtn) {
      saveReceiveBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleReceiveSubmit();
      });
    }
  },

  showSubTab(tabName) {
    this.state.activeSubTab = tabName;
    document.querySelectorAll(".purchase-sub-tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.subtab === tabName);
    });
    document.querySelectorAll(".purchase-sub-panel").forEach(panel => {
      panel.hidden = panel.id !== `${tabName}Panel`;
    });
  },

  handleSupplierSubmit() {
    const form = document.getElementById("supplierForm");
    if (!form) return;
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name || !data.name.trim()) {
      alert("请输入供应商名称");
      return;
    }
    if (this.state.editingSupplierId) {
      this.updateSupplier(this.state.editingSupplierId, data);
    } else {
      this.addSupplier(data);
    }
    this.resetSupplierForm();
    this.renderAll();
  },

  resetSupplierForm() {
    const form = document.getElementById("supplierForm");
    if (!form) return;
    form.reset();
    this.state.editingSupplierId = null;
    document.getElementById("supplierFormTitle").textContent = "新增供应商";
    document.getElementById("supplierFormSubmit").textContent = "添加供应商";
    document.getElementById("supplierFormCancel").hidden = true;
  },

  editSupplier(id) {
    const supplier = this.state.suppliers.find(s => s.id === id);
    if (!supplier) return;
    const form = document.getElementById("supplierForm");
    if (!form) return;
    form.name.value = supplier.name;
    form.contact.value = supplier.contact || "";
    form.phone.value = supplier.phone || "";
    form.address.value = supplier.address || "";
    form.note.value = supplier.note || "";
    this.state.editingSupplierId = id;
    document.getElementById("supplierFormTitle").textContent = "编辑供应商";
    document.getElementById("supplierFormSubmit").textContent = "保存修改";
    document.getElementById("supplierFormCancel").hidden = false;
    this.showSubTab("suppliers");
  },

  deleteSupplierById(id) {
    if (this.deleteSupplier(id)) {
      this.renderAll();
    }
  },

  createPOFromSupplier(supplierId) {
    const supplier = this.state.suppliers.find(s => s.id === supplierId);
    if (!supplier) return;
    const form = document.getElementById("purchaseOrderForm");
    if (!form) return;
    form.reset();
    document.getElementById("poSupplierSelect").value = supplierId;
    document.getElementById("poSupplierName").value = supplier.name;
    document.getElementById("poQty").value = 1000;
    document.getElementById("poUnit").value = "米";
    const tomorrow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    document.getElementById("poExpectedDate").value = tomorrow.toISOString().split("T")[0];
    this.state.editingPurchaseOrderId = null;
    document.getElementById("poFormTitle").textContent = "新建采购单";
    document.getElementById("poFormSubmit").textContent = "创建采购单";
    document.getElementById("poFormCancel").hidden = true;
    this.showSubTab("purchaseOrders");
  },

  quickCreatePO(wireSpec, suggestedQty) {
    const form = document.getElementById("purchaseOrderForm");
    if (!form) return;
    form.reset();
    document.getElementById("poWireSpec").value = wireSpec;
    document.getElementById("poQty").value = suggestedQty || 1000;
    document.getElementById("poUnit").value = "米";
    const tomorrow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    document.getElementById("poExpectedDate").value = tomorrow.toISOString().split("T")[0];
    this.state.editingPurchaseOrderId = null;
    document.getElementById("poFormTitle").textContent = "新建采购单";
    document.getElementById("poFormSubmit").textContent = "创建采购单";
    document.getElementById("poFormCancel").hidden = true;
    this.showSubTab("purchaseOrders");
  },

  handlePurchaseOrderSubmit() {
    const form = document.getElementById("purchaseOrderForm");
    if (!form) return;
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.wireSpec || !data.wireSpec.trim()) {
      alert("请输入钢丝规格");
      return;
    }
    if (!data.qty || Number(data.qty) <= 0) {
      alert("请输入有效的采购数量");
      return;
    }
    if (!data.supplierName && !data.supplierId) {
      alert("请选择或输入供应商");
      return;
    }
    if (this.state.editingPurchaseOrderId) {
      this.updatePurchaseOrder(this.state.editingPurchaseOrderId, data);
    } else {
      this.createPurchaseOrder(data);
    }
    this.resetPurchaseOrderForm();
    this.renderAll();
  },

  resetPurchaseOrderForm() {
    const form = document.getElementById("purchaseOrderForm");
    if (!form) return;
    form.reset();
    this.state.editingPurchaseOrderId = null;
    document.getElementById("poFormTitle").textContent = "新建采购单";
    document.getElementById("poFormSubmit").textContent = "创建采购单";
    document.getElementById("poFormCancel").hidden = true;
  },

  editPurchaseOrder(id) {
    const po = this.state.purchaseOrders.find(p => p.id === id);
    if (!po) return;
    const form = document.getElementById("purchaseOrderForm");
    if (!form) return;
    if (po.supplierId) {
      document.getElementById("poSupplierSelect").value = po.supplierId;
    }
    document.getElementById("poSupplierName").value = po.supplierName || "";
    document.getElementById("poWireSpec").value = po.wireSpec;
    document.getElementById("poQty").value = po.qty;
    document.getElementById("poUnit").value = po.unit;
    document.getElementById("poUnitPrice").value = po.unitPrice;
    document.getElementById("poTotalAmount").value = po.totalAmount.toFixed(2);
    document.getElementById("poExpectedDate").value = po.expectedDate || "";
    document.getElementById("poNote").value = po.note || "";
    this.state.editingPurchaseOrderId = id;
    document.getElementById("poFormTitle").textContent = "编辑采购单";
    document.getElementById("poFormSubmit").textContent = "保存修改";
    document.getElementById("poFormCancel").hidden = false;
    this.showSubTab("purchaseOrders");
  },

  cancelPurchaseOrderById(id) {
    if (this.cancelPurchaseOrder(id)) {
      this.renderAll();
    }
  },

  openReceiveModal(poId) {
    const po = this.state.purchaseOrders.find(p => p.id === poId);
    if (!po) return;
    const modal = document.getElementById("receiveModal");
    if (!modal) return;
    this.state.currentReceivePOId = poId;
    document.getElementById("receiveOrderNo").textContent = po.orderNo;
    document.getElementById("receiveWireSpec").textContent = po.wireSpec;
    document.getElementById("receiveTotalQty").textContent = `${po.qty} ${po.unit}`;
    document.getElementById("receiveReceivedQty").textContent = `${po.receivedQty} ${po.unit}`;
    document.getElementById("receiveRemainingQty").textContent = `${po.qty - po.receivedQty} ${po.unit}`;
    document.getElementById("receiveQty").value = po.qty - po.receivedQty;
    document.getElementById("receiveQty").max = po.qty - po.receivedQty;
    modal.hidden = false;
  },

  closeReceiveModal() {
    const modal = document.getElementById("receiveModal");
    if (modal) modal.hidden = true;
    this.state.currentReceivePOId = null;
  },

  handleReceiveSubmit() {
    const receiveQty = document.getElementById("receiveQty").value;
    const poId = this.state.currentReceivePOId;
    if (!poId) return;
    const result = this.receivePurchaseOrder(poId, receiveQty);
    if (result) {
      this.closeReceiveModal();
      this.renderAll();
      if (this.state.callbacks.onWireStockChanged) {
        this.state.callbacks.onWireStockChanged();
      }
    }
  }
};

window.PurchaseModule = PurchaseModule;
