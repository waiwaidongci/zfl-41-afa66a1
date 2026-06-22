const SnapshotService = {
  SNAPSHOTS_KEY: "zfl41Snapshots",
  MAX_SNAPSHOTS: 50,
  AUTO_PREFIX: "自动快照",
  MANUAL_PREFIX: "手动快照",

  list() {
    try {
      const raw = localStorage.getItem(this.SNAPSHOTS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      console.error("SnapshotService: failed to list snapshots", e);
      return [];
    }
  },

  save(list) {
    try {
      localStorage.setItem(this.SNAPSHOTS_KEY, JSON.stringify(list));
    } catch (e) {
      console.error("SnapshotService: failed to save snapshots list", e);
      if (e.name === "QuotaExceededError" || e.message?.includes("quota")) {
        throw new Error("存储空间不足，请清理旧快照后再试");
      }
      throw e;
    }
  },

  get(id) {
    return this.list().find(s => s.id === id) || null;
  },

  create(options = {}) {
    const { note = "", auto = false } = options;
    const data = StorageMigration.collectAll();
    const meta = this._buildMeta(data);
    const timestamp = new Date().toISOString();
    const prefix = auto ? this.AUTO_PREFIX : this.MANUAL_PREFIX;
    const defaultNote = auto ? `导入前自动保存 ${new Date().toLocaleString()}` : note;

    const snapshot = {
      id: crypto.randomUUID(),
      name: options.name || `${prefix}-${new Date().toLocaleString()}`,
      note: defaultNote,
      auto,
      createdAt: timestamp,
      size: StorageMigration.estimateSize(data),
      meta,
      data
    };

    const list = this.list();
    list.unshift(snapshot);

    while (list.length > this.MAX_SNAPSHOTS) {
      list.pop();
    }

    this.save(list);
    return snapshot;
  },

  restore(id) {
    const snapshot = this.get(id);
    if (!snapshot) {
      throw new Error("快照不存在");
    }
    StorageMigration.restoreAll(snapshot.data);
    return snapshot;
  },

  remove(id) {
    const list = this.list().filter(s => s.id !== id);
    this.save(list);
  },

  clearAll() {
    this.save([]);
  },

  clearAuto() {
    const list = this.list().filter(s => !s.auto);
    this.save(list);
  },

  clearOlderThan(days) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const list = this.list().filter(s => new Date(s.createdAt).getTime() >= cutoff);
    this.save(list);
  },

  _buildMeta(data) {
    const meta = {};
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        meta[key] = value.length;
      } else {
        meta[key] = typeof value;
      }
    }
    return meta;
  },

  exportSnapshot(id) {
    const snapshot = this.get(id);
    if (!snapshot) return null;
    const exportData = {
      __snapshotExport: true,
      version: 1,
      snapshot: {
        id: snapshot.id,
        name: snapshot.name,
        note: snapshot.note,
        auto: snapshot.auto,
        createdAt: snapshot.createdAt,
        meta: snapshot.meta,
        data: snapshot.data
      }
    };
    return exportData;
  },

  importSnapshot(exportData) {
    if (!exportData || !exportData.__snapshotExport || !exportData.snapshot) {
      throw new Error("不是有效的快照导出文件");
    }
    const s = exportData.snapshot;
    const snapshot = {
      id: crypto.randomUUID(),
      name: s.name ? s.name + " (导入)" : "导入的快照",
      note: (s.note || "") + "\n[从外部文件导入]",
      auto: false,
      createdAt: new Date().toISOString(),
      size: StorageMigration.estimateSize(s.data),
      meta: s.meta || this._buildMeta(s.data),
      data: s.data
    };
    const list = this.list();
    list.unshift(snapshot);
    while (list.length > this.MAX_SNAPSHOTS) {
      list.pop();
    }
    this.save(list);
    return snapshot;
  },

  getDataLabels() {
    return {
      batches: "批次",
      orders: "订单",
      wireStock: "钢丝库存",
      wireFlow: "库存流水",
      inspections: "质检记录",
      templates: "工艺模板",
      packaging: "包装记录",
      packagingFlow: "包装流水",
      suppliers: "供应商",
      purchaseOrders: "采购单",
      purchaseFlow: "采购流水"
    };
  }
};

window.SnapshotService = SnapshotService;
