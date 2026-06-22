const PackagingLogic = {
  batches: [],
  orders: [],
  inspections: [],

  init(data) {
    this.batches = data.batches || [];
    this.orders = data.orders || [];
    this.inspections = data.inspections || [];
  },

  updateData(data) {
    if (data.batches) this.batches = data.batches;
    if (data.orders) this.orders = data.orders;
    if (data.inspections) this.inspections = data.inspections;
  },

  getInspectedBatches() {
    return this.batches.filter(b => b.stage === "验收");
  },

  getAvailableBatches() {
    return this.getInspectedBatches().map(batch => {
      const shippedQty = PackagingStorage.getShippedQtyByBatch(batch.id);
      const usableQty = Math.max(0, Number(batch.qty) - Number(batch.defects) - shippedQty);
      const order = batch.orderId ? this.orders.find(o => o.id === batch.orderId) : null;
      const inspectionSummary = this.getBatchInspectionStatus(batch.id);
      return {
        ...batch,
        shippedQty,
        usableQty,
        order,
        orderCustomer: order ? order.customer : "",
        orderDueDate: order ? order.dueDate : "",
        inspectionStatus: inspectionSummary.status,
        inspectionLabel: inspectionSummary.label
      };
    }).filter(b => b.usableQty > 0).sort((a, b) => {
      if (a.orderId && !b.orderId) return -1;
      if (!a.orderId && b.orderId) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  },

  getBatchInspectionStatus(batchId) {
    const batchInsp = this.inspections.filter(i => i.batchId === batchId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (batchInsp.length === 0) return { status: "ok", label: "待出货" };
    if (batchInsp.some(item => item.recheckStatus === "pending")) {
      return { status: "pending", label: "待复检" };
    }
    const latest = batchInsp[0];
    if (latest.recheckStatus === "passed") {
      return { status: "passed", label: "复检通过" };
    }
    if (latest.conclusion === "合格通过" || latest.conclusion === "条件放行") {
      return { status: "ok", label: "待出货" };
    }
    return { status: "warning", label: latest.conclusion || "需确认" };
  },

  getOrdersForPackaging() {
    return this.orders.map(order => {
      const orderBatches = this.batches.filter(b => b.orderId === order.id);
      const assignedQty = orderBatches.reduce((sum, b) => sum + Number(b.qty), 0);
      const completedQty = orderBatches
        .filter(b => b.stage === "验收")
        .reduce((sum, b) => sum + (Number(b.qty) - Number(b.defects)), 0);
      const progress = order ? Math.min(100, (completedQty / Number(order.targetQty)) * 100) : 0;
      const shippedQty = PackagingStorage.getShippedQtyByOrder(order.id);
      const remainingForDelivery = Math.max(0, Number(order.targetQty) - shippedQty);
      const deliveryProgress = Math.min(100, (shippedQty / Number(order.targetQty)) * 100);
      const statusInfo = this.getOrderStatus(order.id);
      return {
        ...order,
        completedQty,
        assignedQty,
        progress,
        shippedQty,
        remainingForDelivery,
        deliveryProgress,
        orderStatus: statusInfo.status,
        orderStatusLabel: statusInfo.label
      };
    }).sort((a, b) => {
      const priority = { overdue: 0, warning: 1, progress: 2, completed: 3 };
      return (priority[a.orderStatus] ?? 9) - (priority[b.orderStatus] ?? 9);
    });
  },

  getOrderStatus(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return { status: "progress", label: "进行中", days: 0 };
    const shippedQty = PackagingStorage.getShippedQtyByOrder(orderId);
    const deliveryProgress = Math.min(100, (shippedQty / Number(order.targetQty)) * 100);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(order.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate - today;
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (deliveryProgress >= 100) {
      return { status: "completed", label: "已交付", days };
    }
    if (days < 0) {
      return { status: "overdue", label: `已逾期 ${Math.abs(days)} 天`, days };
    }
    if (days <= 3 && deliveryProgress < 80) {
      return { status: "warning", label: `剩余 ${days} 天`, days };
    }
    return { status: "progress", label: `剩余 ${days} 天`, days };
  },

  getBatchesForOrder(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return [];
    return this.getAvailableBatches().filter(b => {
      if (b.hook !== order.hook) return false;
      if (b.orderId === orderId) return true;
      if (!b.orderId) return true;
      return false;
    });
  },

  validatePackagingForm(batchId, shippedQty, boxCount, perBoxQty, operator) {
    const errors = [];
    const batch = this.batches.find(b => b.id === batchId);
    if (!batch) {
      errors.push("请选择验收批次");
      return { valid: false, errors };
    }
    const shipped = PackagingStorage.getShippedQtyByBatch(batchId);
    const maxQty = Math.max(0, Number(batch.qty) - Number(batch.defects) - shipped);
    if (!shippedQty || !Number.isFinite(shippedQty) || shippedQty <= 0 || !Number.isInteger(shippedQty)) {
      errors.push("出货数量必须为正整数");
    } else if (shippedQty > maxQty) {
      errors.push(`出货数量超过可用库存（最多 ${maxQty} 枚）`);
    }
    if (!Number.isFinite(boxCount) || boxCount < 0 || !Number.isInteger(boxCount)) {
      errors.push("盒数必须为非负整数");
    }
    if (perBoxQty !== undefined && perBoxQty !== null && (!Number.isFinite(perBoxQty) || perBoxQty < 0)) {
      errors.push("每盒数量必须为非负数");
    }
    if (!operator || !operator.trim()) {
      errors.push("操作者不能为空");
    }
    if (boxCount > 0 && perBoxQty > 0 && boxCount * perBoxQty !== shippedQty) {
      errors.push(`盒数 × 每盒数量 = ${boxCount * perBoxQty}，与出货数量 ${shippedQty} 不一致`);
    }
    return { valid: errors.length === 0, errors };
  },

  createPackaging(params, callbacks) {
    const { batchId, shippedQty, boxCount, perBoxQty, operator, labelNo, note, orderId } = params;
    const batch = this.batches.find(b => b.id === batchId);
    if (!batch) return { success: false, error: "批次不存在" };

    const order = orderId ? this.orders.find(o => o.id === orderId) : (batch.orderId ? this.orders.find(o => o.id === batch.orderId) : null);
    const finalOrderId = order ? order.id : (batch.orderId || null);
    const finalOrderCustomer = order ? order.customer : "";

    const record = PackagingStorage.create({
      batchId,
      batchHook: batch.hook,
      batchWire: batch.wire,
      orderId: finalOrderId,
      orderCustomer: finalOrderCustomer,
      shippedQty,
      boxCount,
      perBoxQty,
      operator,
      labelNo,
      note
    });

    batch.history.push(`${new Date().toLocaleString()} 包装出货 ${shippedQty} 枚，操作者：${operator}${boxCount ? `，共 ${boxCount} 盒` : ""}${order ? `，订单：${order.customer}` : ""}`);

    if (order) {
      order.history.push(`${new Date().toLocaleString()} 包装出货 ${batch.hook} ${shippedQty} 枚${boxCount ? `（${boxCount} 盒）` : ""}，操作者：${operator}${labelNo ? `，贴标：${labelNo}` : ""}`);
    }

    callbacks?.onCreated?.({ record, batch, order });
    return { success: true, record };
  },

  deletePackaging(id, callbacks) {
    const record = PackagingStorage.getById(id);
    if (!record) return { success: false, error: "记录不存在" };
    const batch = this.batches.find(b => b.id === record.batchId);
    const order = record.orderId ? this.orders.find(o => o.id === record.orderId) : null;
    const ok = PackagingStorage.remove(id);
    if (ok) {
      if (batch) {
        batch.history.push(`${new Date().toLocaleString()} 删除包装出货记录（${record.shippedQty} 枚）`);
      }
      if (order) {
        order.history.push(`${new Date().toLocaleString()} 删除包装出货记录（${record.batchHook} ${record.shippedQty} 枚）`);
      }
      callbacks?.onDeleted?.({ record, batch, order });
    }
    return { success: ok };
  },

  autoSuggestBoxes(qty, perBoxQty) {
    const n = Number(perBoxQty) || 50;
    const qtyN = Number(qty) || 0;
    if (qtyN <= 0 || n <= 0) return { boxCount: 0, remainder: 0 };
    const boxCount = Math.floor(qtyN / n);
    const remainder = qtyN % n;
    return { boxCount, remainder };
  },

  generateLabelNo() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `PKG-${datePart}-${timePart}-${random}`;
  }
};

window.PackagingLogic = PackagingLogic;
