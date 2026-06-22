const DiffCalculator = {
  compareSnapshots(snapshotA, snapshotB) {
    const dataA = snapshotA ? snapshotA.data : StorageMigration.collectAll();
    const dataB = snapshotB.data;
    const labels = SnapshotService.getDataLabels();
    const keys = Object.keys(labels);
    const result = {};

    for (const key of keys) {
      result[key] = this._compareCollection(dataA[key] || [], dataB[key] || [], key);
    }

    return result;
  },

  compareWithCurrent(snapshot) {
    return this.compareSnapshots(null, snapshot);
  },

  summarize(diff) {
    const summary = {
      totalAdded: 0,
      totalRemoved: 0,
      totalChanged: 0,
      sections: []
    };
    const labels = SnapshotService.getDataLabels();

    for (const [key, section] of Object.entries(diff)) {
      if (section.added > 0 || section.removed > 0 || section.changed > 0) {
        summary.totalAdded += section.added;
        summary.totalRemoved += section.removed;
        summary.totalChanged += section.changed;
        summary.sections.push({
          key,
          label: labels[key] || key,
          added: section.added,
          removed: section.removed,
          changed: section.changed
        });
      }
    }

    return summary;
  },

  _compareCollection(a, b, collectionKey) {
    const idField = this._getIdField(collectionKey);
    const aMap = this._toMap(a, idField);
    const bMap = this._toMap(b, idField);

    let added = 0;
    let removed = 0;
    let changed = 0;
    const addedItems = [];
    const removedItems = [];
    const changedItems = [];

    for (const [id, item] of Object.entries(bMap)) {
      if (!aMap[id]) {
        added++;
        addedItems.push(this._summarizeItem(item, collectionKey));
      } else {
        const itemDiff = this._diffItem(aMap[id], item);
        if (itemDiff.changed) {
          changed++;
          changedItems.push({
            id,
            label: this._summarizeItem(item, collectionKey),
            changes: itemDiff.fields
          });
        }
      }
    }

    for (const [id, item] of Object.entries(aMap)) {
      if (!bMap[id]) {
        removed++;
        removedItems.push(this._summarizeItem(item, collectionKey));
      }
    }

    return { added, removed, changed, addedItems, removedItems, changedItems };
  },

  _toMap(list, idField) {
    const map = {};
    for (const item of list) {
      if (!item) continue;
      let id = item[idField];
      if (!id) {
        id = JSON.stringify(item);
      }
      map[id] = item;
    }
    return map;
  },

  _getIdField(collectionKey) {
    const idFields = {
      batches: "id",
      orders: "id",
      wireStock: "id",
      wireFlow: "id",
      inspections: "id",
      templates: "id",
      packaging: "id",
      packagingFlow: "id",
      suppliers: "id",
      purchaseOrders: "id",
      purchaseFlow: "id"
    };
    return idFields[collectionKey] || "id";
  },

  _summarizeItem(item, collectionKey) {
    switch (collectionKey) {
      case "batches":
        return `${item.hook || "?"} · ${item.qty || 0}枚 · ${item.owner || "?"}`;
      case "orders":
        return `${item.customer || "?"} · ${item.hook || "?"} · ${item.targetQty || 0}枚`;
      case "wireStock":
        return `${item.spec || "?"} · ${item.qty || 0}${item.unit || ""}`;
      case "wireFlow":
        return `${item.spec || "?"} · ${item.type || "?"} · ${item.qty || 0}`;
      case "inspections":
        return `批次抽检 · ${item.sampleQty || 0}枚 · ${item.conclusion || "?"}`;
      case "templates":
        return `${item.hookName || "?"} · ${item.wire || "?"}`;
      case "packaging":
        return `${item.batchHook || "?"} · ${item.shippedQty || 0}枚`;
      case "packagingFlow":
        return `${item.type || "?"} · ${item.qty || 0}`;
      case "suppliers":
        return `${item.name || "?"} · ${item.contact || ""}`;
      case "purchaseOrders":
        return `${item.orderNo || "?"} · ${item.wireSpec || "?"} · ${item.qty || 0}`;
      case "purchaseFlow":
        return `${item.type || "?"} · ${item.remark || ""}`;
      default:
        return JSON.stringify(item).slice(0, 60);
    }
  },

  _diffItem(a, b) {
    const fields = [];
    const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);

    for (const key of allKeys) {
      if (key === "history") continue;
      const valA = a ? a[key] : undefined;
      const valB = b ? b[key] : undefined;
      if (!this._equal(valA, valB)) {
        fields.push({
          field: key,
          oldValue: this._formatValue(valA),
          newValue: this._formatValue(valB)
        });
      }
    }

    return { changed: fields.length > 0, fields };
  },

  _equal(a, b) {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a === "object") {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return false;
  },

  _formatValue(v) {
    if (v === undefined || v === null) return "(空)";
    if (typeof v === "object") {
      try {
        const str = JSON.stringify(v);
        return str.length > 80 ? str.slice(0, 80) + "..." : str;
      } catch (e) {
        return String(v);
      }
    }
    const str = String(v);
    return str.length > 80 ? str.slice(0, 80) + "..." : str;
  }
};

window.DiffCalculator = DiffCalculator;
