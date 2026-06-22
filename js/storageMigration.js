const StorageMigration = {
  CURRENT_VERSION: 1,
  VERSION_KEY: "zfl41StorageVersion",

  getAllKeys() {
    return Object.values(StorageKeys);
  },

  getDataMap() {
    return {
      batches: StorageKeys.BATCHES,
      orders: StorageKeys.ORDERS,
      wireStock: StorageKeys.WIRE_STOCK,
      wireFlow: StorageKeys.WIRE_FLOW,
      inspections: StorageKeys.INSPECTIONS,
      templates: StorageKeys.TEMPLATES,
      packaging: StorageKeys.PACKAGING,
      packagingFlow: StorageKeys.PACKAGING_FLOW,
      suppliers: StorageKeys.SUPPLIERS,
      purchaseOrders: StorageKeys.PURCHASE_ORDERS,
      purchaseFlow: StorageKeys.PURCHASE_FLOW
    };
  },

  collectAll() {
    const map = this.getDataMap();
    const result = {};
    for (const [name, key] of Object.entries(map)) {
      try {
        const raw = localStorage.getItem(key);
        result[name] = raw ? JSON.parse(raw) : this._seedFor(name);
      } catch (e) {
        console.warn(`StorageMigration: failed to load ${name}`, e);
        result[name] = this._seedFor(name);
      }
    }
    return result;
  },

  restoreAll(data) {
    const map = this.getDataMap();
    for (const [name, key] of Object.entries(map)) {
      if (data[name] !== undefined) {
        try {
          localStorage.setItem(key, JSON.stringify(data[name]));
        } catch (e) {
          console.error(`StorageMigration: failed to restore ${name}`, e);
        }
      }
    }
  },

  getCurrentVersion() {
    try {
      const v = localStorage.getItem(this.VERSION_KEY);
      return v ? parseInt(v, 10) : 0;
    } catch (e) {
      return 0;
    }
  },

  setCurrentVersion(v) {
    try {
      localStorage.setItem(this.VERSION_KEY, String(v));
    } catch (e) {
      console.error("StorageMigration: failed to set version", e);
    }
  },

  migrateIfNeeded() {
    const current = this.getCurrentVersion();
    if (current >= this.CURRENT_VERSION) return false;

    if (current < 1) {
      this._migrateToV1();
    }

    this.setCurrentVersion(this.CURRENT_VERSION);
    return true;
  },

  _migrateToV1() {
    const data = this.collectAll();
    if (!Array.isArray(data.batches)) data.batches = [];
    if (!Array.isArray(data.orders)) data.orders = [];
    if (!Array.isArray(data.wireStock)) data.wireStock = [];
    if (!Array.isArray(data.wireFlow)) data.wireFlow = [];
    if (!Array.isArray(data.inspections)) data.inspections = [];
    if (!Array.isArray(data.templates)) data.templates = [];
    if (!Array.isArray(data.packaging)) data.packaging = [];
    if (!Array.isArray(data.packagingFlow)) data.packagingFlow = [];
    if (!Array.isArray(data.suppliers)) data.suppliers = [];
    if (!Array.isArray(data.purchaseOrders)) data.purchaseOrders = [];
    if (!Array.isArray(data.purchaseFlow)) data.purchaseFlow = [];

    data.batches.forEach(b => {
      if (!b.id) b.id = crypto.randomUUID();
      if (b.orderId === undefined) b.orderId = null;
      if (b.templateId === undefined) b.templateId = null;
      if (!b.history || !Array.isArray(b.history)) b.history = ["创建批次"];
      if (b.defects === undefined) b.defects = 0;
    });

    data.orders.forEach(o => {
      if (!o.id) o.id = crypto.randomUUID();
      if (!o.history || !Array.isArray(o.history)) o.history = ["创建订单"];
      if (!o.createdAt) o.createdAt = new Date().toISOString();
    });

    this.restoreAll(data);
  },

  _seedFor(name) {
    const seeds = {
      batches: [],
      orders: [],
      wireStock: [],
      wireFlow: [],
      inspections: [],
      templates: [],
      packaging: [],
      packagingFlow: [],
      suppliers: [],
      purchaseOrders: [],
      purchaseFlow: []
    };
    return seeds[name] || [];
  },

  estimateSize(data) {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch (e) {
      return JSON.stringify(data).length * 2;
    }
  },

  formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }
};

window.StorageMigration = StorageMigration;
