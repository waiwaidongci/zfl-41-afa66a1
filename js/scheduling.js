const Scheduling = {
  state: {
    currentOrderId: null,
    suggestedBatches: [],
    data: null,
    callbacks: null
  },

  init(data, callbacks) {
    this.state.data = data;
    this.state.callbacks = callbacks;
    this.bindEvents();
  },

  updateData(data) {
    this.state.data = data;
  },

  bindEvents() {
    const modal = document.getElementById("schedulingModal");
    if (!modal) return;

    document.getElementById("closeSchedulingModal")?.addEventListener("click", () => this.closeModal());
    document.getElementById("cancelScheduling")?.addEventListener("click", () => this.closeModal());
    document.getElementById("schedulingModalMask")?.addEventListener("click", () => this.closeModal());

    document.getElementById("batchSizeInput")?.addEventListener("change", () => this.recalculateBatches());
    document.getElementById("ownerSelect")?.addEventListener("change", () => this.updateSuggestedBatchesUI());
    document.getElementById("stageSelect")?.addEventListener("change", () => this.updateSuggestedBatchesUI());

    document.getElementById("addSuggestedBatch")?.addEventListener("click", () => this.addManualBatch());
    document.getElementById("generateAllBatches")?.addEventListener("click", () => this.generateAllBatches());
  },

  openModal(orderId) {
    this.state.currentOrderId = orderId;
    this.state.suggestedBatches = [];

    const modal = document.getElementById("schedulingModal");
    if (!modal) return;

    const { orders, templates, wireStock, batches } = this.state.data;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const template = templates.find(t => t.hookName === order.hook);
    const wire = template ? wireStock.find(w => w.spec === template.wire) : null;
    const { completedQty, assignedQty, progress } = getOrderProgress(orderId, orders, batches);
    const remainingQty = Math.max(0, order.targetQty - assignedQty);

    const defaultBatchSize = template ? Math.min(150, remainingQty) : Math.min(100, remainingQty);

    this.populateOwnerSelect(template);
    this.populateStageSelect();
    this.generateSuggestedBatches(order, template, wire, remainingQty, defaultBatchSize);
    this.renderSummary(order, template, wire, remainingQty, completedQty, assignedQty, progress);
    this.renderSuggestedBatches();
    this.validateAndRenderWarnings(order, template, wire, remainingQty);

    const batchSizeInput = document.getElementById("batchSizeInput");
    if (batchSizeInput) batchSizeInput.value = defaultBatchSize;

    const modalTitle = document.getElementById("schedulingModalTitle");
    if (modalTitle) {
      modalTitle.textContent = `排产计划 · ${order.customer} · ${order.hook}`;
    }

    modal.hidden = false;
  },

  closeModal() {
    const modal = document.getElementById("schedulingModal");
    if (modal) {
      modal.hidden = true;
    }
    this.state.currentOrderId = null;
    this.state.suggestedBatches = [];
  },

  populateOwnerSelect(template) {
    const { data } = this.state;
    const select = document.getElementById("ownerSelect");
    if (!select) return;

    const owners = [...new Set(data.batches.map(b => b.owner))];
    if (template && template.owner && !owners.includes(template.owner)) {
      owners.unshift(template.owner);
    }

    select.innerHTML = `<option value="">自动分配</option>` +
      owners.map(o => `<option value="${o}">${o}</option>`).join("");

    if (template && template.owner) {
      select.value = template.owner;
    }
  },

  populateStageSelect() {
    const select = document.getElementById("stageSelect");
    if (!select) return;

    select.innerHTML = Stages.map(s => `<option value="${s}">${s}</option>`).join("");
    select.value = "剪料";
  },

  generateSuggestedBatches(order, template, wire, remainingQty, batchSize) {
    this.state.suggestedBatches = [];

    if (remainingQty <= 0) return;

    let qtyLeft = remainingQty;
    let batchNum = 1;

    while (qtyLeft > 0) {
      const qty = Math.min(batchSize, qtyLeft);
      const estimatedWire = estimateWireUsage(qty);

      this.state.suggestedBatches.push({
        id: `suggested-${Date.now()}-${batchNum}`,
        qty,
        wire: template ? template.wire : (wire ? wire.spec : ""),
        owner: template ? template.owner : "",
        stage: "剪料",
        templateId: template ? template.id : null,
        note: template ? template.processNote : "",
        estimatedWire,
        defects: 0
      });

      qtyLeft -= qty;
      batchNum++;
    }
  },

  recalculateBatches() {
    const { orders, templates, wireStock, batches } = this.state.data;
    const order = orders.find(o => o.id === this.state.currentOrderId);
    if (!order) return;

    const template = templates.find(t => t.hookName === order.hook);
    const wire = template ? wireStock.find(w => w.spec === template.wire) : null;
    const { assignedQty } = getOrderProgress(this.state.currentOrderId, orders, batches);
    const remainingQty = Math.max(0, order.targetQty - assignedQty);
    const batchSize = Math.max(1, Number(document.getElementById("batchSizeInput").value) || 100);

    this.generateSuggestedBatches(order, template, wire, remainingQty, batchSize);
    this.updateSuggestedBatchesUI();
    this.validateAndRenderWarnings(order, template, wire, remainingQty);
  },

  addManualBatch() {
    const { orders, templates, batches } = this.state.data;
    const order = orders.find(o => o.id === this.state.currentOrderId);
    if (!order) return;

    const template = templates.find(t => t.hookName === order.hook);
    const { assignedQty } = getOrderProgress(this.state.currentOrderId, orders, batches);
    const remainingQty = Math.max(0, order.targetQty - assignedQty);
    const currentTotal = this.state.suggestedBatches.reduce((sum, b) => sum + b.qty, 0);
    const defaultQty = Math.max(1, Math.min(100, remainingQty - currentTotal));

    this.state.suggestedBatches.push({
      id: `suggested-${Date.now()}-manual`,
      qty: defaultQty,
      wire: template ? template.wire : "",
      owner: template ? template.owner : "",
      stage: "剪料",
      templateId: template ? template.id : null,
      note: template ? template.processNote : "",
      estimatedWire: estimateWireUsage(defaultQty),
      defects: 0
    });

    this.updateSuggestedBatchesUI();
    this.validateAndRenderWarnings();
  },

  removeSuggestedBatch(id) {
    this.state.suggestedBatches = this.state.suggestedBatches.filter(b => b.id !== id);
    this.updateSuggestedBatchesUI();
    this.validateAndRenderWarnings();
  },

  updateSuggestedBatchQty(id, qty) {
    const batch = this.state.suggestedBatches.find(b => b.id === id);
    if (batch) {
      batch.qty = Math.max(1, Number(qty) || 1);
      batch.estimatedWire = estimateWireUsage(batch.qty);
      this.updateSuggestedBatchesUI();
      this.validateAndRenderWarnings();
    }
  },

  updateSuggestedBatchOwner(id, owner) {
    const batch = this.state.suggestedBatches.find(b => b.id === id);
    if (batch) {
      batch.owner = owner;
    }
  },

  updateSuggestedBatchStage(id, stage) {
    const batch = this.state.suggestedBatches.find(b => b.id === id);
    if (batch) {
      batch.stage = stage;
    }
  },

  updateSuggestedBatchesUI() {
    const globalOwner = document.getElementById("ownerSelect")?.value || "";
    const globalStage = document.getElementById("stageSelect")?.value || "剪料";

    this.state.suggestedBatches.forEach(b => {
      if (globalOwner && !b.owner) b.owner = globalOwner;
      if (!b.stage) b.stage = globalStage;
    });

    this.renderSuggestedBatches();
  },

  validateAndRenderWarnings(order, template, wire, remainingQty) {
    const { orders, wireStock, batches } = this.state.data;

    if (!order) order = orders.find(o => o.id === this.state.currentOrderId);
    if (!order) return;

    if (!template) template = this.state.data.templates.find(t => t.hookName === order.hook);
    if (!wire && template) wire = wireStock.find(w => w.spec === template.wire);
    if (remainingQty === undefined) {
      const { assignedQty } = getOrderProgress(this.state.currentOrderId, orders, batches);
      remainingQty = Math.max(0, order.targetQty - assignedQty);
    }

    const warnings = [];
    const totalSuggestedQty = this.state.suggestedBatches.reduce((sum, b) => sum + b.qty, 0);
    const totalEstimatedWire = this.state.suggestedBatches.reduce((sum, b) => sum + b.estimatedWire, 0);

    if (!template) {
      warnings.push({
        type: "error",
        icon: "⚠",
        message: `未找到「${order.hook}」的工艺模板，请先在工艺模板库中创建模板后再排产。`
      });
    }

    if (!wire) {
      warnings.push({
        type: "error",
        icon: "⚠",
        message: template
          ? `模板指定的钢丝「${template.wire}」不存在于库存中，请先入库或调整模板。`
          : `未找到对应钢丝规格，无法计算库存需求。`
      });
    } else if (totalEstimatedWire > wire.qty) {
      warnings.push({
        type: "error",
        icon: "❌",
        message: `库存不足：预计需用 ${totalEstimatedWire.toFixed(2)} ${wire.unit}，当前库存仅 ${wire.qty.toFixed(2)} ${wire.unit}，缺口 ${(totalEstimatedWire - wire.qty).toFixed(2)} ${wire.unit}。`
      });
    } else if (wire.qty - totalEstimatedWire < wire.safeStock) {
      warnings.push({
        type: "warning",
        icon: "⚡",
        message: `库存偏低：预计需用 ${totalEstimatedWire.toFixed(2)} ${wire.unit}，用后剩余 ${(wire.qty - totalEstimatedWire).toFixed(2)} ${wire.unit}，将低于安全库存（${wire.safeStock} ${wire.unit}）。`
      });
    }

    if (totalSuggestedQty > remainingQty) {
      warnings.push({
        type: "warning",
        icon: "⚠",
        message: `建议批次总数（${totalSuggestedQty} 枚）超过订单剩余需求（${remainingQty} 枚），可能造成重复排产。`
      });
    }

    if (totalSuggestedQty < remainingQty && this.state.suggestedBatches.length > 0) {
      warnings.push({
        type: "info",
        icon: "ℹ",
        message: `建议批次总数（${totalSuggestedQty} 枚）少于订单剩余需求（${remainingQty} 枚），将无法完全满足订单。`
      });
    }

    const existingSameOrderBatches = batches.filter(b => b.orderId === order.id);
    if (existingSameOrderBatches.length > 0) {
      const existingQty = existingSameOrderBatches.reduce((sum, b) => sum + b.qty, 0);
      warnings.push({
        type: "info",
        icon: "ℹ",
        message: `该订单已有 ${existingSameOrderBatches.length} 个批次（${existingQty} 枚）在制中。`
      });
    }

    const hasError = warnings.some(w => w.type === "error");
    const generateBtn = document.getElementById("generateAllBatches");
    if (generateBtn) {
      generateBtn.disabled = hasError || this.state.suggestedBatches.length === 0;
      generateBtn.textContent = hasError
        ? "请先解决错误后再生成"
        : (this.state.suggestedBatches.length === 0 ? "暂无建议批次" : `一键生成 ${this.state.suggestedBatches.length} 个批次`);
    }

    this.renderWarnings(warnings);
  },

  renderSummary(order, template, wire, remainingQty, completedQty, assignedQty, progress) {
    const summaryEl = document.getElementById("schedulingSummary");
    if (!summaryEl) return;

    const totalSuggestedQty = this.state.suggestedBatches.reduce((sum, b) => sum + b.qty, 0);
    const totalEstimatedWire = this.state.suggestedBatches.reduce((sum, b) => sum + b.estimatedWire, 0);

    const wireStatus = wire ? getWireStatus(wire) : "out";
    const wireStatusClass = wireStatus === "out" ? "error" : (wireStatus === "low" ? "warn" : "good");
    const wireStatusText = wireStatus === "out" ? "缺货" : (wireStatus === "low" ? "偏低" : "充足");

    summaryEl.innerHTML = `
      <div class="scheduling-summary">
        <div class="summary-card">
          <div class="label">订单目标</div>
          <div class="value">${order.targetQty} 枚</div>
        </div>
        <div class="summary-card">
          <div class="label">已完成</div>
          <div class="value good">${completedQty} 枚</div>
        </div>
        <div class="summary-card">
          <div class="label">已分配</div>
          <div class="value">${assignedQty} 枚</div>
        </div>
        <div class="summary-card">
          <div class="label">剩余需求</div>
          <div class="value">${remainingQty} 枚</div>
        </div>
        <div class="summary-card">
          <div class="label">完成进度</div>
          <div class="value good">${progress.toFixed(1)}%</div>
        </div>
        <div class="summary-card">
          <div class="label">建议批次</div>
          <div class="value">${this.state.suggestedBatches.length} 批 / ${totalSuggestedQty} 枚</div>
        </div>
        <div class="summary-card">
          <div class="label">钢丝库存</div>
          <div class="value ${wireStatusClass}">${wire ? `${wire.qty.toFixed(2)} ${wire.unit}` : "无"}</div>
        </div>
        <div class="summary-card">
          <div class="label">预计耗用</div>
          <div class="value">${totalEstimatedWire.toFixed(2)} ${wire ? wire.unit : ""}</div>
        </div>
      </div>

      <div class="scheduling-config">
        <h3>排产配置</h3>
        <div class="config-grid">
          <label>
            建议批次大小
            <input type="number" id="batchSizeInput" min="1" value="100">
          </label>
          <label>
            默认负责人
            <select id="ownerSelect">
              <option value="">自动分配</option>
            </select>
          </label>
          <label>
            默认起始工序
            <select id="stageSelect"></select>
          </label>
          <div class="full" style="display: flex; gap: 8px; align-items: flex-end;">
            <button type="button" id="addSuggestedBatch" class="secondary">手动添加批次</button>
          </div>
        </div>
        <div class="meta" style="font-size: 12px; color: var(--muted); margin-top: 4px;">
          ${template
            ? `<span class="status-ok">✓ 已匹配模板「${template.hookName}」：钢丝 ${template.wire}，负责人 ${template.owner || "未指定"}，缺陷阈值 ${template.defectThreshold || 0} 枚</span>`
            : `<span class="status-err">✗ 未找到「${order.hook}」的工艺模板</span>`}
        </div>
      </div>
    `;

    this.bindConfigEvents();
  },

  bindConfigEvents() {
    document.getElementById("batchSizeInput")?.addEventListener("change", () => this.recalculateBatches());
    document.getElementById("ownerSelect")?.addEventListener("change", () => this.updateSuggestedBatchesUI());
    document.getElementById("stageSelect")?.addEventListener("change", () => this.updateSuggestedBatchesUI());
    document.getElementById("addSuggestedBatch")?.addEventListener("click", () => this.addManualBatch());
  },

  renderSuggestedBatches() {
    const container = document.getElementById("suggestedBatchList");
    if (!container) return;

    const { data } = this.state;

    if (this.state.suggestedBatches.length === 0) {
      container.innerHTML = `<div class="empty">暂无建议批次，请调整批次大小或手动添加</div>`;
      return;
    }

    const owners = [...new Set(data.batches.map(b => b.owner))];

    container.innerHTML = this.state.suggestedBatches.map((batch, index) => `
      <div class="suggested-batch-item" data-id="${batch.id}">
        <div class="batch-head">
          <strong>批次 ${index + 1} · 预计耗用 ${batch.estimatedWire.toFixed(2)} 米</strong>
          <input type="number" class="qty-input" value="${batch.qty}" min="1"
                 onchange="Scheduling.updateSuggestedBatchQty('${batch.id}', this.value)">
        </div>
        <div class="batch-meta">
          <label>钢丝规格
            <input type="text" value="${batch.wire}" readonly>
          </label>
          <label>负责人
            <select onchange="Scheduling.updateSuggestedBatchOwner('${batch.id}', this.value)">
              <option value="">请选择</option>
              ${owners.map(o => `<option value="${o}" ${o === batch.owner ? "selected" : ""}>${o}</option>`).join("")}
            </select>
          </label>
          <label>起始工序
            <select onchange="Scheduling.updateSuggestedBatchStage('${batch.id}', this.value)">
              ${Stages.map(s => `<option value="${s}" ${s === batch.stage ? "selected" : ""}>${s}</option>`).join("")}
            </select>
          </label>
        </div>
        ${batch.note ? `<div class="meta">工艺备注：${batch.note}</div>` : ""}
        <div class="batch-actions">
          <button class="danger" onclick="Scheduling.removeSuggestedBatch('${batch.id}')">移除</button>
        </div>
      </div>
    `).join("");
  },

  renderWarnings(warnings) {
    const container = document.getElementById("validationWarnings");
    if (!container) return;

    if (warnings.length === 0) {
      container.innerHTML = `
        <div class="validation-item info">
          <span class="icon">✓</span>
          <span>所有校验通过，可以生成批次。</span>
        </div>
      `;
      return;
    }

    container.innerHTML = warnings.map(w => `
      <div class="validation-item ${w.type}">
        <span class="icon">${w.icon}</span>
        <span>${w.message}</span>
      </div>
    `).join("");
  },

  async generateAllBatches() {
    const { orders, batches, wireStock, wireFlow, templates } = this.state.data;
    const order = orders.find(o => o.id === this.state.currentOrderId);

    if (!order) {
      alert("订单不存在");
      return;
    }

    if (this.state.suggestedBatches.length === 0) {
      alert("没有可生成的批次");
      return;
    }

    const warnings = [];
    const template = templates.find(t => t.hookName === order.hook);
    if (!template) {
      warnings.push("缺少工艺模板");
    }

    const totalEstimatedWire = this.state.suggestedBatches.reduce((sum, b) => sum + b.estimatedWire, 0);
    const wire = template ? wireStock.find(w => w.spec === template.wire) : null;
    if (wire && totalEstimatedWire > wire.qty) {
      warnings.push("钢丝库存不足");
    }

    const existingSameOrderBatches = batches.filter(b => b.orderId === order.id);
    const existingQty = existingSameOrderBatches.reduce((sum, b) => sum + b.qty, 0);
    const totalSuggestedQty = this.state.suggestedBatches.reduce((sum, b) => sum + b.qty, 0);
    const { assignedQty } = getOrderProgress(this.state.currentOrderId, orders, batches);
    if (existingQty + totalSuggestedQty > order.targetQty) {
      warnings.push(`可能重复排产：已有 ${existingQty} 枚，新增 ${totalSuggestedQty} 枚，合计 ${existingQty + totalSuggestedQty} 枚，超过订单目标 ${order.targetQty} 枚`);
    }

    if (warnings.length > 0) {
      const confirmMsg = `检测到以下问题：\n\n${warnings.map((w, i) => `${i + 1}. ${w}`).join("\n")}\n\n是否仍要继续生成批次？`;
      if (!confirm(confirmMsg)) return;
    }

    const now = new Date();
    const generatedBatches = [];

    for (const suggested of this.state.suggestedBatches) {
      const batchWire = wireStock.find(w => w.spec === suggested.wire);
      const estimatedWire = suggested.estimatedWire;

      if (batchWire) {
        const oldQty = batchWire.qty;
        batchWire.qty = Math.max(0, batchWire.qty - estimatedWire);
        addWireFlow(
          batchWire.id,
          batchWire.spec,
          "out",
          estimatedWire,
          batchWire.qty,
          `排产批次领用：${order.hook} ${suggested.qty}枚，预计耗用 ${estimatedWire} ${batchWire.unit}（库存 ${oldQty} → ${batchWire.qty}）`,
          wireFlow
        );
      }

      const newBatch = {
        id: crypto.randomUUID(),
        wire: suggested.wire,
        hook: order.hook,
        qty: Number(suggested.qty),
        owner: suggested.owner || (template ? template.owner : ""),
        stage: suggested.stage || "剪料",
        defects: 0,
        note: suggested.note || (template ? template.processNote : ""),
        history: [
          `${now.toLocaleString()} 从排产计划创建批次${template ? `，使用模板「${template.hookName}」` : ""}${batchWire ? `，领用钢丝 ${estimatedWire} 米` : ""}，关联订单 ${order.customer}`
        ],
        orderId: order.id,
        templateId: suggested.templateId || (template ? template.id : null)
      };

      batches.unshift(newBatch);
      generatedBatches.push(newBatch);
    }

    order.history.push(`${now.toLocaleString()} 排产计划生成 ${generatedBatches.length} 个批次，共 ${totalSuggestedQty} 枚`);

    Storage.saveBatches(batches);
    Storage.saveOrders(orders);
    Storage.saveWireStock(wireStock);
    Storage.saveWireFlow(wireFlow);

    this.state.callbacks?.onBatchesGenerated?.({
      batches,
      orders,
      wireStock,
      wireFlow,
      templates,
      generatedBatches
    });

    alert(`成功生成 ${generatedBatches.length} 个批次（共 ${totalSuggestedQty} 枚），已自动关联订单并扣减钢丝库存。`);

    this.closeModal();
  }
};

window.Scheduling = Scheduling;
