const PackagingStorage = {
  packaging: [],
  packagingFlow: [],

  init(data) {
    this.packaging = data.packaging || [];
    this.packagingFlow = data.packagingFlow || [];
  },

  save() {
    Storage.savePackaging(this.packaging);
    Storage.savePackagingFlow(this.packagingFlow);
  },

  getAll() {
    return [...this.packaging].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getById(id) {
    return this.packaging.find(p => p.id === id);
  },

  getByOrderId(orderId) {
    return this.packaging.filter(p => p.orderId === orderId);
  },

  getByBatchId(batchId) {
    return this.packaging.filter(p => p.batchId === batchId);
  },

  getFlow() {
    return [...this.packagingFlow].sort((a, b) => new Date(b.time) - new Date(a.time));
  },

  getFlowByPackagingId(packagingId) {
    return this.packagingFlow.filter(f => f.packagingId === packagingId);
  },

  create(record) {
    const now = new Date();
    const newRecord = {
      id: crypto.randomUUID(),
      batchId: record.batchId,
      batchHook: record.batchHook || "",
      batchWire: record.batchWire || "",
      orderId: record.orderId || null,
      orderCustomer: record.orderCustomer || "",
      shippedQty: Number(record.shippedQty),
      boxCount: Number(record.boxCount) || 0,
      perBoxQty: Number(record.perBoxQty) || 0,
      operator: record.operator || "",
      labelNo: record.labelNo || "",
      note: record.note || "",
      createdAt: now.toISOString(),
      history: [`${now.toLocaleString()} 创建包装记录，出货 ${record.shippedQty} 枚，共 ${record.boxCount || 0} 盒`]
    };
    this.packaging.unshift(newRecord);

    this.addFlow({
      packagingId: newRecord.id,
      type: "create",
      qty: newRecord.shippedQty,
      reason: `新建包装出货：${newRecord.batchHook} ${newRecord.shippedQty} 枚，${newRecord.boxCount} 盒`
    });

    this.save();
    return newRecord;
  },

  update(id, updates) {
    const record = this.packaging.find(p => p.id === id);
    if (!record) return null;
    Object.assign(record, updates);
    record.history.push(`${new Date().toLocaleString()} 更新包装记录`);
    this.save();
    return record;
  },

  remove(id) {
    const record = this.packaging.find(p => p.id === id);
    if (!record) return false;
    this.packaging = this.packaging.filter(p => p.id !== id);

    this.addFlow({
      packagingId: id,
      type: "delete",
      qty: -(record.shippedQty || 0),
      reason: `删除包装记录：${record.batchHook} ${record.shippedQty} 枚`
    });

    this.save();
    return true;
  },

  addFlow(entry) {
    this.packagingFlow.unshift({
      id: crypto.randomUUID(),
      packagingId: entry.packagingId,
      type: entry.type,
      qty: entry.qty,
      reason: entry.reason,
      time: new Date().toISOString()
    });
  },

  getShippedQtyByBatch(batchId) {
    return this.packaging
      .filter(p => p.batchId === batchId)
      .reduce((sum, p) => sum + Number(p.shippedQty), 0);
  },

  getShippedQtyByOrder(orderId) {
    return this.packaging
      .filter(p => p.orderId === orderId)
      .reduce((sum, p) => sum + Number(p.shippedQty), 0);
  },

  getTotalStats() {
    const totalRecords = this.packaging.length;
    const totalQty = this.packaging.reduce((sum, p) => sum + Number(p.shippedQty), 0);
    const totalBoxes = this.packaging.reduce((sum, p) => sum + Number(p.boxCount || 0), 0);
    const uniqueOrders = new Set(this.packaging.map(p => p.orderId).filter(Boolean)).size;
    return { totalRecords, totalQty, totalBoxes, uniqueOrders };
  }
};

window.PackagingStorage = PackagingStorage;
