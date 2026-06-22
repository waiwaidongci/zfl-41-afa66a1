const SnapshotUI = {
  _data: null,
  _callbacks: null,

  init(data, callbacks) {
    this._data = data;
    this._callbacks = callbacks;
    StorageMigration.migrateIfNeeded();
    this._bindModals();
  },

  _bindModals() {
    document.querySelector("#createSnapshotModal .modal-mask")?.addEventListener("click", () => this.closeCreateModal());
    document.querySelector("#diffModal .modal-mask")?.addEventListener("click", () => this.closeDiffModal());
    document.querySelector("#restoreConfirmModal .modal-mask")?.addEventListener("click", () => this.closeRestoreModal());
    document.querySelector("#cleanupModal .modal-mask")?.addEventListener("click", () => this.closeCleanupModal());
    document.querySelector("#snapshotImportModal .modal-mask")?.addEventListener("click", () => this.closeImportModal());

    document.querySelector("#closeCreateSnapshot")?.addEventListener("click", () => this.closeCreateModal());
    document.querySelector("#cancelCreateSnapshot")?.addEventListener("click", () => this.closeCreateModal());
    document.querySelector("#closeDiffModal")?.addEventListener("click", () => this.closeDiffModal());
    document.querySelector("#closeRestoreModal")?.addEventListener("click", () => this.closeRestoreModal());
    document.querySelector("#cancelRestore")?.addEventListener("click", () => this.closeRestoreModal());
    document.querySelector("#closeCleanupModal")?.addEventListener("click", () => this.closeCleanupModal());
    document.querySelector("#cancelCleanup")?.addEventListener("click", () => this.closeCleanupModal());
    document.querySelector("#closeSnapshotImport")?.addEventListener("click", () => this.closeImportModal());
    document.querySelector("#cancelSnapshotImport")?.addEventListener("click", () => this.closeImportModal());

    document.querySelector("#createSnapshotForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this._handleCreateSubmit();
    });

    document.querySelector("#confirmRestoreBtn")?.addEventListener("click", () => this._handleRestoreConfirm());
    document.querySelector("#confirmCleanupBtn")?.addEventListener("click", () => this._handleCleanupConfirm());

    const importFile = document.querySelector("#snapshotImportFile");
    if (importFile) {
      importFile.addEventListener("change", async () => {
        await this._handleImportFile(importFile.files?.[0]);
      });
    }
    document.querySelector("#confirmSnapshotImport")?.addEventListener("click", () => this._handleImportConfirm());
  },

  renderStats() {
    const list = SnapshotService.list();
    const total = list.length;
    const autoCount = list.filter(s => s.auto).length;
    const manualCount = total - autoCount;
    const totalSize = list.reduce((s, snap) => s + (snap.size || 0), 0);

    const el = document.querySelector("#snapshotStats");
    if (!el) return;

    el.innerHTML = `
      <div class="stat"><span>快照总数</span><b>${total}</b><span class="meta">条记录</span></div>
      <div class="stat"><span>手动快照</span><b style="color: var(--blue);">${manualCount}</b><span class="meta">条</span></div>
      <div class="stat"><span>自动快照</span><b style="color: var(--gold);">${autoCount}</b><span class="meta">导入前创建</span></div>
      <div class="stat"><span>占用空间</span><b>${StorageMigration.formatSize(totalSize)}</b><span class="meta">localStorage</span></div>
    `;
  },

  renderList() {
    const list = SnapshotService.list();
    const el = document.querySelector("#snapshotList");
    if (!el) return;

    if (list.length === 0) {
      el.innerHTML = `<div class="snapshot-empty">暂无快照记录，点击上方「创建快照」按钮创建第一个快照</div>`;
      return;
    }

    el.innerHTML = list.map(snap => this._renderCard(snap)).join("");
  },

  _renderCard(snap) {
    const labels = SnapshotService.getDataLabels();
    const metaHtml = Object.entries(snap.meta || {})
      .map(([k, v]) => {
        const label = labels[k] || k;
        return `<div><span class="label">${label}</span><span class="value">${typeof v === "number" ? v + " 条" : v}</span></div>`;
      })
      .join("");

    const typeTag = snap.auto
      ? `<span class="snapshot-type-tag auto">自动快照</span>`
      : `<span class="snapshot-type-tag manual">手动快照</span>`;

    const sizeStr = StorageMigration.formatSize(snap.size || 0);
    const createdAt = new Date(snap.createdAt);

    return `
      <div class="snapshot-card ${snap.auto ? "auto" : ""}">
        <div class="snapshot-head">
          <div>
            <strong>${this._escapeHtml(snap.name)}</strong>${typeTag}
          </div>
          <div class="meta">${sizeStr}</div>
        </div>
        <div class="snapshot-meta">
          <div><span class="label">创建时间</span><span class="value">${createdAt.toLocaleString()}</span></div>
          ${metaHtml}
        </div>
        ${snap.note ? `<div class="snapshot-note">${this._escapeHtml(snap.note)}</div>` : ""}
        <div class="snapshot-actions">
          <button class="good" onclick="SnapshotUI.viewDiff('${snap.id}')">查看差异</button>
          <button class="warn" onclick="SnapshotUI.openRestore('${snap.id}')">恢复到此</button>
          <button class="secondary" onclick="SnapshotUI.exportOne('${snap.id}')">导出</button>
          <button class="danger" onclick="SnapshotUI.deleteOne('${snap.id}')">删除</button>
        </div>
      </div>
    `;
  },

  renderAll() {
    this.renderStats();
    this.renderList();
  },

  openCreateModal() {
    const modal = document.querySelector("#createSnapshotModal");
    if (!modal) return;
    const nameInput = document.querySelector("#snapshotName");
    const noteInput = document.querySelector("#snapshotNote");
    if (nameInput) nameInput.value = `手动快照-${new Date().toLocaleString()}`;
    if (noteInput) noteInput.value = "";
    modal.hidden = false;
  },

  closeCreateModal() {
    const modal = document.querySelector("#createSnapshotModal");
    if (modal) modal.hidden = true;
  },

  _handleCreateSubmit() {
    const nameInput = document.querySelector("#snapshotName");
    const noteInput = document.querySelector("#snapshotNote");
    const name = nameInput ? nameInput.value.trim() : "";
    const note = noteInput ? noteInput.value.trim() : "";

    try {
      const snap = SnapshotService.create({ name: name || undefined, note, auto: false });
      this.closeCreateModal();
      this.renderAll();
      if (this._callbacks?.onSnapshotCreated) this._callbacks.onSnapshotCreated(snap);
      alert(`✓ 快照「${snap.name}」创建成功`);
    } catch (e) {
      alert(`创建失败：${e.message}`);
    }
  },

  viewDiff(snapshotId) {
    const snapshot = SnapshotService.get(snapshotId);
    if (!snapshot) {
      alert("快照不存在");
      return;
    }
    const diff = DiffCalculator.compareWithCurrent(snapshot);
    this._renderDiff(snapshot, diff);
    const modal = document.querySelector("#diffModal");
    if (modal) modal.hidden = false;
  },

  _renderDiff(snapshot, diff) {
    const summary = DiffCalculator.summarize(diff);
    const labels = SnapshotService.getDataLabels();

    const summaryEl = document.querySelector("#diffSummary");
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="diff-summary-card added"><div class="num">${summary.totalAdded}</div><div class="label">新增记录</div></div>
        <div class="diff-summary-card removed"><div class="num">${summary.totalRemoved}</div><div class="label">删除记录</div></div>
        <div class="diff-summary-card changed"><div class="num">${summary.totalChanged}</div><div class="label">变更记录</div></div>
        <div class="diff-summary-card total"><div class="num">${summary.sections.length}</div><div class="label">涉及数据类型</div></div>
      `;
    }

    const titleEl = document.querySelector("#diffModalTitle");
    if (titleEl) {
      titleEl.textContent = `差异对比 · ${snapshot.name}`;
    }

    const bodyEl = document.querySelector("#diffSections");
    if (!bodyEl) return;

    if (summary.totalAdded === 0 && summary.totalRemoved === 0 && summary.totalChanged === 0) {
      bodyEl.innerHTML = `<div class="snapshot-empty" style="padding: 20px;">✓ 当前数据与该快照完全一致，无差异</div>`;
      return;
    }

    bodyEl.innerHTML = summary.sections.map(section => {
      const sectionDiff = diff[section.key];
      if (!sectionDiff) return "";

      let itemsHtml = "";

      sectionDiff.addedItems.forEach(item => {
        itemsHtml += `<div class="diff-item added"><div class="diff-item-head"><span>${this._escapeHtml(String(item))}</span><span class="diff-item-type added">新增</span></div></div>`;
      });

      sectionDiff.removedItems.forEach(item => {
        itemsHtml += `<div class="diff-item removed"><div class="diff-item-head"><span>${this._escapeHtml(String(item))}</span><span class="diff-item-type removed">删除</span></div></div>`;
      });

      sectionDiff.changedItems.forEach(item => {
        const fieldsHtml = item.changes.map(f => `
          <div class="diff-field">
            <span class="diff-field-name">${this._escapeHtml(f.field)}</span>
            <span class="diff-field-old">${this._escapeHtml(f.oldValue)}</span>
            <span class="diff-field-new">${this._escapeHtml(f.newValue)}</span>
          </div>
        `).join("");
        itemsHtml += `
          <div class="diff-item changed">
            <div class="diff-item-head">
              <span>${this._escapeHtml(String(item.label))}</span>
              <span class="diff-item-type changed">变更</span>
            </div>
            <div class="diff-field-list">${fieldsHtml}</div>
          </div>
        `;
      });

      const tags = [];
      if (section.added > 0) tags.push(`<span class="snapshot-preview-tag added">+${section.added}</span>`);
      if (section.removed > 0) tags.push(`<span class="snapshot-preview-tag removed">-${section.removed}</span>`);
      if (section.changed > 0) tags.push(`<span class="snapshot-preview-tag changed">~${section.changed}</span>`);

      return `
        <div class="diff-section">
          <div class="diff-section-head" onclick="this.nextElementSibling.classList.toggle('collapsed')">
            <strong>${labels[section.key] || section.key}</strong>
            <div class="diff-section-tags">${tags.join("")} <span class="meta">▼</span></div>
          </div>
          <div class="diff-section-body">${itemsHtml || '<div class="meta">无详细差异</div>'}</div>
        </div>
      `;
    }).join("");
  },

  closeDiffModal() {
    const modal = document.querySelector("#diffModal");
    if (modal) modal.hidden = true;
  },

  openRestore(snapshotId) {
    const snapshot = SnapshotService.get(snapshotId);
    if (!snapshot) {
      alert("快照不存在");
      return;
    }
    this._pendingRestoreId = snapshotId;

    const infoEl = document.querySelector("#restoreInfo");
    if (infoEl) {
      const labels = SnapshotService.getDataLabels();
      const metaRows = Object.entries(snapshot.meta || {})
        .map(([k, v]) => {
          const label = labels[k] || k;
          return `<div><span class="label">${label}</span><span class="value">${typeof v === "number" ? v + " 条" : v}</span></div>`;
        })
        .join("");

      infoEl.innerHTML = `
        <div><span class="label">快照名称</span><span class="value">${this._escapeHtml(snapshot.name)}</span></div>
        <div><span class="label">创建时间</span><span class="value">${new Date(snapshot.createdAt).toLocaleString()}</span></div>
        <div><span class="label">快照大小</span><span class="value">${StorageMigration.formatSize(snapshot.size || 0)}</span></div>
        ${snap.note ? `<div><span class="label">备注</span><span class="value">${this._escapeHtml(snap.note)}</span></div>` : ""}
        ${metaRows}
      `;
    }

    const warnEl = document.querySelector("#restoreWarn");
    if (warnEl) {
      warnEl.innerHTML = `
        <strong>⚠ 恢复操作不可撤销</strong><br>
        恢复后，当前所有的批次、订单、库存、质检、模板、包装、采购等数据将被<strong>完全替换</strong>为该快照中的内容。<br>
        建议在恢复前先创建一个当前状态的快照作为备份。
      `;
    }

    const modal = document.querySelector("#restoreConfirmModal");
    if (modal) modal.hidden = false;
  },

  closeRestoreModal() {
    const modal = document.querySelector("#restoreConfirmModal");
    if (modal) modal.hidden = true;
    this._pendingRestoreId = null;
  },

  _handleRestoreConfirm() {
    if (!this._pendingRestoreId) return;
    const snapshotId = this._pendingRestoreId;

    if (!confirm("确认恢复到此快照？当前所有数据将被替换！")) {
      return;
    }

    try {
      const snap = SnapshotService.restore(snapshotId);
      this.closeRestoreModal();
      if (this._callbacks?.onRestored) this._callbacks.onRestored(snap);
      alert(`✓ 已成功恢复到「${snap.name}」，页面将刷新`);
    } catch (e) {
      alert(`恢复失败：${e.message}`);
    }
  },

  deleteOne(snapshotId) {
    const snapshot = SnapshotService.get(snapshotId);
    if (!snapshot) {
      alert("快照不存在");
      return;
    }
    if (!confirm(`确认删除快照「${snapshot.name}」？此操作不可撤销。`)) {
      return;
    }
    SnapshotService.remove(snapshotId);
    this.renderAll();
  },

  openCleanupModal() {
    const list = SnapshotService.list();
    const autoCount = list.filter(s => s.auto).length;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const oldCount = list.filter(s => new Date(s.createdAt).getTime() < weekAgo).length;

    const optEl = document.querySelector("#cleanupOptions");
    if (optEl) {
      optEl.innerHTML = `
        <label class="cleanup-option">
          <input type="radio" name="cleanupType" value="auto" checked>
          <div>
            <strong>清理所有自动快照</strong>
            <div class="meta">将删除 ${autoCount} 条导入前自动创建的快照，保留手动快照</div>
          </div>
        </label>
        <label class="cleanup-option">
          <input type="radio" name="cleanupType" value="old">
          <div>
            <strong>清理 7 天前的旧快照</strong>
            <div class="meta">将删除 ${oldCount} 条超过一周的快照</div>
          </div>
        </label>
        <label class="cleanup-option">
          <input type="radio" name="cleanupType" value="all">
          <div>
            <strong>清理全部快照</strong>
            <div class="meta">将删除全部 ${list.length} 条快照，释放存储空间</div>
          </div>
        </label>
      `;
    }

    const modal = document.querySelector("#cleanupModal");
    if (modal) modal.hidden = false;
  },

  closeCleanupModal() {
    const modal = document.querySelector("#cleanupModal");
    if (modal) modal.hidden = true;
  },

  _handleCleanupConfirm() {
    const checked = document.querySelector('input[name="cleanupType"]:checked');
    if (!checked) return;
    const type = checked.value;

    const confirmMsgs = {
      auto: "确认清理所有自动快照？",
      old: "确认清理 7 天前的旧快照？",
      all: "确认清理全部快照？此操作不可撤销！"
    };

    if (!confirm(confirmMsgs[type] || "确认清理？")) return;

    if (type === "auto") {
      SnapshotService.clearAuto();
    } else if (type === "old") {
      SnapshotService.clearOlderThan(7);
    } else if (type === "all") {
      SnapshotService.clearAll();
    }

    this.closeCleanupModal();
    this.renderAll();
    alert("✓ 清理完成");
  },

  exportOne(snapshotId) {
    const exportData = SnapshotService.exportSnapshot(snapshotId);
    if (!exportData) {
      alert("快照不存在");
      return;
    }
    const snap = SnapshotService.get(snapshotId);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `snapshot-${snap?.name || snapshotId}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  },

  openImportModal() {
    const modal = document.querySelector("#snapshotImportModal");
    if (!modal) return;
    const fileInput = document.querySelector("#snapshotImportFile");
    const errorEl = document.querySelector("#snapshotImportError");
    const summaryEl = document.querySelector("#snapshotImportSummary");
    const confirmBtn = document.querySelector("#confirmSnapshotImport");
    if (fileInput) fileInput.value = "";
    if (errorEl) errorEl.hidden = true;
    if (summaryEl) summaryEl.innerHTML = "";
    if (confirmBtn) confirmBtn.disabled = true;
    this._pendingImportData = null;
    modal.hidden = false;
  },

  closeImportModal() {
    const modal = document.querySelector("#snapshotImportModal");
    if (modal) modal.hidden = true;
    this._pendingImportData = null;
  },

  async _handleImportFile(file) {
    const errorEl = document.querySelector("#snapshotImportError");
    const summaryEl = document.querySelector("#snapshotImportSummary");
    const confirmBtn = document.querySelector("#confirmSnapshotImport");
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.__snapshotExport || !data.snapshot) {
        throw new Error("文件格式不正确，请选择快照导出文件");
      }
      this._pendingImportData = data;
      const labels = SnapshotService.getDataLabels();
      const meta = data.snapshot.meta || {};
      const metaRows = Object.entries(meta)
        .map(([k, v]) => `<div><span class="label">${labels[k] || k}</span><span class="value">${typeof v === "number" ? v + " 条" : v}</span></div>`)
        .join("");

      if (summaryEl) {
        summaryEl.innerHTML = `
          <div class="restore-info">
            <div><span class="label">快照名称</span><span class="value">${this._escapeHtml(data.snapshot.name || "未命名")}</span></div>
            <div><span class="label">原始创建时间</span><span class="value">${new Date(data.snapshot.createdAt || Date.now()).toLocaleString()}</span></div>
            ${data.snapshot.note ? `<div><span class="label">备注</span><span class="value">${this._escapeHtml(data.snapshot.note)}</span></div>` : ""}
            ${metaRows}
          </div>
        `;
      }
      if (errorEl) errorEl.hidden = true;
      if (confirmBtn) confirmBtn.disabled = false;
    } catch (e) {
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = `解析失败：${e.message}`;
      }
      if (summaryEl) summaryEl.innerHTML = "";
      if (confirmBtn) confirmBtn.disabled = true;
      this._pendingImportData = null;
    }
  },

  _handleImportConfirm() {
    if (!this._pendingImportData) return;
    try {
      const snap = SnapshotService.importSnapshot(this._pendingImportData);
      this.closeImportModal();
      this.renderAll();
      alert(`✓ 快照「${snap.name}」导入成功`);
    } catch (e) {
      alert(`导入失败：${e.message}`);
    }
  },

  _escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
};

window.SnapshotUI = SnapshotUI;
