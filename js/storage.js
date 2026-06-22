const StorageKeys = {
  BATCHES: "zfl41Batches",
  ORDERS: "zfl41Orders",
  WIRE_STOCK: "zfl41WireStock",
  WIRE_FLOW: "zfl41WireFlow",
  INSPECTIONS: "zfl41Inspections",
  TEMPLATES: "zfl41Templates",
  PACKAGING: "zfl41Packaging",
  PACKAGING_FLOW: "zfl41PackagingFlow"
};

const Stages = ["剪料", "退火", "弯钩", "淬火", "回火", "打磨", "验收"];

const DefectTypeOptions = ["外观不良", "尺寸偏差", "硬度不足", "弹性不够", "钩尖不锋利", "镀层问题", "其他"];
const ConclusionOptions = ["合格通过", "返工处理", "报废处理", "条件放行", "待复检"];
const RecheckStatusOptions = ["not_required", "pending", "passed"];

const SeedData = {
  batches: () => ([
    { id: crypto.randomUUID(), wire: "0.8mm 蓝火钢丝", hook: "溪流倒刺 6 号", qty: 120, owner: "林师傅", stage: "弯钩", defects: 3, note: "弯嘴角度偏小的单独复查", history: ["创建批次", "推进到弯钩"], orderId: null, templateId: null },
    { id: crypto.randomUUID(), wire: "1.0mm 高碳钢丝", hook: "海钓长柄 2 号", qty: 60, owner: "阿青", stage: "回火", defects: 1, note: "回火后抽检 12 枚", history: ["创建批次", "完成淬火"], orderId: null, templateId: null },
    { id: crypto.randomUUID(), wire: "0.6mm 软调钢丝", hook: "袖钩 4 号", qty: 200, owner: "小孟", stage: "剪料", defects: 0, note: "先做样钩 10 枚", history: ["创建批次"], orderId: null, templateId: null }
  ]),
  orders: () => ([
    {
      id: crypto.randomUUID(),
      customer: "老王渔具店",
      hook: "袖钩 4 号",
      targetQty: 500,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      note: "需要单独包装，每50枚一袋",
      createdAt: new Date().toISOString(),
      history: [`${new Date().toLocaleString()} 创建订单`]
    },
    {
      id: crypto.randomUUID(),
      customer: "张总钓具批发",
      hook: "溪流倒刺 6 号",
      targetQty: 200,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      note: "急单，优先处理",
      createdAt: new Date().toISOString(),
      history: [`${new Date().toLocaleString()} 创建订单`]
    }
  ]),
  wireStock: () => {
    const seed = [
      { id: crypto.randomUUID(), spec: "0.8mm 蓝火钢丝", qty: 2500, unit: "米", safeStock: 500, note: "供应商A，高碳钢", createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), spec: "1.0mm 高碳钢丝", qty: 1200, unit: "米", safeStock: 300, note: "供应商B，进口材质", createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), spec: "0.6mm 软调钢丝", qty: 80, unit: "米", safeStock: 200, note: "供应商A", createdAt: new Date().toISOString() }
    ];
    return seed;
  },
  wireFlow: (wireSeed) => ([
    { id: crypto.randomUUID(), wireId: wireSeed[0].id, spec: wireSeed[0].spec, type: "in", qty: 2500, balance: 2500, reason: "初始入库", time: new Date().toISOString() },
    { id: crypto.randomUUID(), wireId: wireSeed[1].id, spec: wireSeed[1].spec, type: "in", qty: 1200, balance: 1200, reason: "初始入库", time: new Date().toISOString() },
    { id: crypto.randomUUID(), wireId: wireSeed[2].id, spec: wireSeed[2].spec, type: "in", qty: 80, balance: 80, reason: "初始入库", time: new Date().toISOString() }
  ]),
  inspections: () => ([]),
  packaging: () => ([]),
  packagingFlow: () => ([]),
  templates: () => ([
    { id: crypto.randomUUID(), hookName: "袖钩 4 号", wire: "0.6mm 软调钢丝", owner: "小孟", defectThreshold: 3, processNote: "退火温度 650°C，弯嘴角度 45°，打磨后需做样钩 10 枚抽检", createdAt: new Date().toISOString() },
    { id: crypto.randomUUID(), hookName: "溪流倒刺 6 号", wire: "0.8mm 蓝火钢丝", owner: "林师傅", defectThreshold: 5, processNote: "退火温度 700°C，弯嘴角度偏小的需单独复查", createdAt: new Date().toISOString() },
    { id: crypto.randomUUID(), hookName: "海钓长柄 2 号", wire: "1.0mm 高碳钢丝", owner: "阿青", defectThreshold: 2, processNote: "回火后抽检 12 枚，硬度需达标", createdAt: new Date().toISOString() }
  ])
};

const Storage = {
  load(key, seedFn) {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn(`Failed to load ${key} from localStorage:`, e);
    }
    const seed = seedFn();
    this.save(key, seed);
    return seed;
  },

  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Failed to save ${key} to localStorage:`, e);
    }
  },

  loadAll() {
    const wireStockSeed = SeedData.wireStock();
    return {
      batches: this.load(StorageKeys.BATCHES, SeedData.batches),
      orders: this.load(StorageKeys.ORDERS, SeedData.orders),
      wireStock: this.load(StorageKeys.WIRE_STOCK, () => wireStockSeed),
      wireFlow: this.load(StorageKeys.WIRE_FLOW, () => SeedData.wireFlow(wireStockSeed)),
      inspections: this.load(StorageKeys.INSPECTIONS, SeedData.inspections),
      templates: this.load(StorageKeys.TEMPLATES, SeedData.templates),
      packaging: this.load(StorageKeys.PACKAGING, SeedData.packaging),
      packagingFlow: this.load(StorageKeys.PACKAGING_FLOW, SeedData.packagingFlow)
    };
  },

  saveAll(data) {
    this.save(StorageKeys.BATCHES, data.batches);
    this.save(StorageKeys.ORDERS, data.orders);
    this.save(StorageKeys.WIRE_STOCK, data.wireStock);
    this.save(StorageKeys.WIRE_FLOW, data.wireFlow);
    this.save(StorageKeys.INSPECTIONS, data.inspections);
    this.save(StorageKeys.TEMPLATES, data.templates);
    this.save(StorageKeys.PACKAGING, data.packaging);
    this.save(StorageKeys.PACKAGING_FLOW, data.packagingFlow);
  },

  saveBatches(batches) { this.save(StorageKeys.BATCHES, batches); },
  saveOrders(orders) { this.save(StorageKeys.ORDERS, orders); },
  saveWireStock(wireStock) { this.save(StorageKeys.WIRE_STOCK, wireStock); },
  saveWireFlow(wireFlow) { this.save(StorageKeys.WIRE_FLOW, wireFlow); },
  saveInspections(inspections) { this.save(StorageKeys.INSPECTIONS, inspections); },
  saveTemplates(templates) { this.save(StorageKeys.TEMPLATES, templates); },
  savePackaging(packaging) { this.save(StorageKeys.PACKAGING, packaging); },
  savePackagingFlow(packagingFlow) { this.save(StorageKeys.PACKAGING_FLOW, packagingFlow); }
};

function estimateWireUsage(batchQty) {
  const perHook = 0.08;
  return Math.ceil(Number(batchQty) * perHook * 100) / 100;
}

function getWireStatus(wire) {
  if (wire.qty <= 0) return "out";
  if (wire.qty < wire.safeStock) return "low";
  return "good";
}

function getOrderBatches(orderId, batches) {
  return batches.filter(b => b.orderId === orderId);
}

function getOrderProgress(orderId, orders, batches) {
  const orderBatches = getOrderBatches(orderId, batches);
  if (orderBatches.length === 0) return { completedQty: 0, assignedQty: 0, progress: 0 };
  const assignedQty = orderBatches.reduce((sum, b) => sum + Number(b.qty), 0);
  const completedQty = orderBatches
    .filter(b => b.stage === "验收")
    .reduce((sum, b) => sum + (Number(b.qty) - Number(b.defects)), 0);
  const order = orders.find(o => o.id === orderId);
  const progress = order ? Math.min(100, (completedQty / Number(order.targetQty)) * 100) : 0;
  return { completedQty, assignedQty, progress };
}

function getOrderStatus(orderId, orders, batches) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return { status: "progress", label: "进行中", days: 0 };
  const { progress } = getOrderProgress(orderId, orders, batches);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(order.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  const diffTime = dueDate - today;
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (progress >= 100) {
    return { status: "completed", label: "已完成", days };
  }
  if (days < 0) {
    return { status: "overdue", label: `已逾期 ${Math.abs(days)} 天`, days };
  }
  if (days <= 3 && progress < 80) {
    return { status: "warning", label: `剩余 ${days} 天`, days };
  }
  return { status: "progress", label: `剩余 ${days} 天`, days };
}

function addWireFlow(wireId, spec, type, qty, balance, reason, wireFlow) {
  wireFlow.unshift({
    id: crypto.randomUUID(),
    wireId,
    spec,
    type,
    qty,
    balance,
    reason,
    time: new Date().toISOString()
  });
}

function getBatchThresholdWarning(batch, templates) {
  if (!batch.templateId) return null;
  const tpl = templates.find(t => t.id === batch.templateId);
  if (!tpl || !tpl.defectThreshold) return null;
  if (batch.defects > tpl.defectThreshold) {
    return { threshold: tpl.defectThreshold, actual: batch.defects, hookName: tpl.hookName };
  }
  return null;
}

function getBatchInspections(batchId, inspections) {
  return inspections.filter(i => i.batchId === batchId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getBatchRecheckStatus(batchId, inspections) {
  const batchInsp = getBatchInspections(batchId, inspections);
  if (batchInsp.length === 0) return null;
  if (batchInsp.some(item => item.recheckStatus === "pending")) return "pending";
  const latest = batchInsp[0];
  return latest.recheckStatus;
}

function getRecheckStatusLabel(status) {
  const labels = {
    "not_required": "无需复检",
    "pending": "待复检",
    "passed": "复检通过"
  };
  return labels[status] || status;
}

window.StorageKeys = StorageKeys;
window.Stages = Stages;
window.DefectTypeOptions = DefectTypeOptions;
window.ConclusionOptions = ConclusionOptions;
window.RecheckStatusOptions = RecheckStatusOptions;
window.Storage = Storage;
window.estimateWireUsage = estimateWireUsage;
window.getWireStatus = getWireStatus;
window.getOrderBatches = getOrderBatches;
window.getOrderProgress = getOrderProgress;
window.getOrderStatus = getOrderStatus;
window.addWireFlow = addWireFlow;
window.getBatchThresholdWarning = getBatchThresholdWarning;
window.getBatchInspections = getBatchInspections;
window.getBatchRecheckStatus = getBatchRecheckStatus;
window.getRecheckStatusLabel = getRecheckStatusLabel;
