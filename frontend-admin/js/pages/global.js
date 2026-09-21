/**
 * 通用知识页面 - 模块化控制器
 * 负责：通用知识增删改查、按条生效范围（例外商家）配置、商家黑名单
 * @module GlobalPage
 */
(function (global) {
  'use strict';

  var Utils = App.Utils;
  var Table = App.Table;
  var Modal = App.Modal;
  var Select = App.Select;

  // ====================== 页面状态 ======================
  var state = {
    editingKnowledgeId: null,
    scopeKnowledgeId: null,
    // 弹层内勾选的例外商家（草稿，保存时才落库）
    scopeDraftIds: []
  };

  // ====================== DOM 元素缓存 ======================
  var elements = {};

  function cacheElements() {
    elements = {
      roleBadge: document.getElementById('roleBadge'),
      btnAddKnowledge: document.getElementById('btnAddKnowledge'),
      knowledgeTableBody: document.getElementById('knowledgeTableBody'),
      knowledgeModal: document.getElementById('knowledgeModal'),
      knowledgeModalTitle: document.getElementById('knowledgeModalTitle'),
      formStandardQ: document.getElementById('formStandardQ'),
      formSimilarQ: document.getElementById('formSimilarQ'),
      formAnswer: document.getElementById('formAnswer'),
      knowledgeModalCancel: document.getElementById('knowledgeModalCancel'),
      knowledgeModalSubmit: document.getElementById('knowledgeModalSubmit'),
      // 生效范围弹层
      scopeModal: document.getElementById('scopeModal'),
      scopeKnowledgeQ: document.getElementById('scopeKnowledgeQ'),
      scopeExcludedSummary: document.getElementById('scopeExcludedSummary'),
      scopeExcludedChips: document.getElementById('scopeExcludedChips'),
      scopeMerchantBody: document.getElementById('scopeMerchantBody'),
      scopeReadonlyTip: document.getElementById('scopeReadonlyTip'),
      scopeModalCancel: document.getElementById('scopeModalCancel'),
      scopeModalSubmit: document.getElementById('scopeModalSubmit'),
      // 黑名单
      blacklistAddSelect: document.getElementById('blacklistAddSelect'),
      btnAddBlacklist: document.getElementById('btnAddBlacklist'),
      blacklistTableBody: document.getElementById('blacklistTableBody'),
      blacklistEmpty: document.getElementById('blacklistEmpty')
    };
  }

  function canManageScope() {
    return AuthModule.canManageScope();
  }

  // ====================== 角色标识 ======================
  var RoleBadge = {
    render: function () {
      var role = AuthModule.getCurrentRole();
      var name = AuthModule.getRoleName(role);
      var editable = canManageScope();
      elements.roleBadge.innerHTML =
        '<span class="iconify" data-icon="' + (editable ? 'lucide:shield-check' : 'lucide:eye') + '" data-width="14" data-height="14"></span>' +
        Utils.escapeHtml(name) + ' · ' + (editable ? '可调整范围' : '仅查看范围');
    }
  };

  // ====================== 通用知识管理 ======================
  var KnowledgeManager = {
    render: function () {
      var list = MockStore.getGlobalKnowledge();

      Table.render(elements.knowledgeTableBody, list, function (k) {
        return '<td class="text-obsidian">' + Utils.escapeHtml(k.standardQ || '') + '</td>' +
          '<td class="text-subtle">' + Utils.escapeHtml((k.similarQs || []).join('；')) + '</td>' +
          '<td class="text-charcoal max-w-xs truncate">' + Utils.escapeHtml(k.answer || '') + '</td>' +
          '<td>' + ScopeManager.renderSummary(k) + '</td>' +
          '<td class="text-right">' +
            '<button type="button" class="btn-link k-scope mr-2" data-id="' + k.id + '">生效范围</button>' +
            '<button type="button" class="btn-link k-edit mr-2" data-id="' + k.id + '">编辑</button>' +
            '<button type="button" class="btn-link btn-link-danger k-delete" data-id="' + k.id + '">删除</button>' +
          '</td>';
      }, this.bindTableEvents.bind(this));
    },

    bindTableEvents: function (tbody) {
      var self = this;
      tbody.querySelectorAll('.k-scope').forEach(function (btn) {
        btn.addEventListener('click', function () {
          ScopeManager.openModal(btn.dataset.id);
        });
      });
      tbody.querySelectorAll('.k-edit').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self.openModal(btn.dataset.id);
        });
      });
      tbody.querySelectorAll('.k-delete').forEach(function (btn) {
        btn.addEventListener('click', function () {
          Confirm.show('确定删除这条知识？其生效范围配置将一并删除。', function () {
            MockStore.deleteGlobalKnowledge(btn.dataset.id);
            self.render();
            Toast.show('知识删除成功', 'success');
          });
        });
      });
    },

    openModal: function (id) {
      state.editingKnowledgeId = id || null;
      elements.knowledgeModalTitle.textContent = id ? '编辑知识' : '新增知识';

      if (id) {
        var list = MockStore.getGlobalKnowledge();
        var k = list.find(function (x) { return x.id === id; });
        if (k) {
          elements.formStandardQ.value = k.standardQ || '';
          elements.formSimilarQ.value = (k.similarQs || []).join('\n');
          elements.formAnswer.value = k.answer || '';
        }
      } else {
        elements.formStandardQ.value = '';
        elements.formSimilarQ.value = '';
        elements.formAnswer.value = '';
      }

      elements.knowledgeModal.style.display = 'flex';
    },

    closeModal: function () {
      elements.knowledgeModal.style.display = 'none';
      state.editingKnowledgeId = null;
    },

    save: function () {
      var standardQ = elements.formStandardQ.value.trim();
      var similarQs = elements.formSimilarQ.value.trim().split(/\n/).map(function (s) {
        return s.trim();
      }).filter(Boolean);
      var answer = elements.formAnswer.value.trim();

      if (!standardQ) {
        Toast.show('请填写标准问', 'error');
        return;
      }

      if (state.editingKnowledgeId) {
        MockStore.updateGlobalKnowledge(state.editingKnowledgeId, {
          standardQ: standardQ,
          similarQs: similarQs,
          answer: answer
        });
        Toast.show('知识更新成功', 'success');
      } else {
        MockStore.addGlobalKnowledge({
          standardQ: standardQ,
          similarQs: similarQs,
          answer: answer
        });
        Toast.show('知识创建成功', 'success');
      }

      this.closeModal();
      this.render();
    }
  };

  // ====================== 生效范围（例外商家）管理 ======================
  var ScopeManager = {
    /** 列表中的生效范围摘要：每条生效到哪里，一眼可见 */
    renderSummary: function (k) {
      var scope = MockStore.getGlobalKnowledgeScope(k.id);
      var effectiveNames = scope.effectiveMerchants.map(function (m) { return m.name; });
      var excludedNames = scope.excludedMerchants.map(function (m) { return m.name; });
      var blacklistNames = scope.blacklistMerchants.map(function (m) { return m.name; });
      var tip = '生效商家：' + (effectiveNames.join('、') || '无') +
        (scope.excludedCount ? '\n例外商家：' + excludedNames.join('、') : '') +
        (scope.blacklistCount ? '\n黑名单商家：' + blacklistNames.join('、') : '');
      var html = '<div class="scope-summary flex flex-wrap items-center gap-1.5" title="' + Utils.escapeHtml(tip) + '">';
      html += '<span class="scope-chip scope-chip-ok">' +
        '<span class="iconify" data-icon="lucide:check-circle-2" data-width="12" data-height="12"></span>' +
        '生效 ' + scope.effectiveCount + '/' + scope.total + '</span>';
      if (scope.excludedCount > 0) {
        html += '<span class="scope-chip scope-chip-excluded" title="例外商家：' +
          Utils.escapeHtml(excludedNames.join('、')) + '">' +
          '<span class="iconify" data-icon="lucide:ban" data-width="12" data-height="12"></span>' +
          '例外 ' + scope.excludedCount + ' 家</span>';
      }
      if (scope.blacklistCount > 0) {
        html += '<span class="scope-chip scope-chip-blacklist" title="黑名单商家：' +
          Utils.escapeHtml(blacklistNames.join('、')) + '\n对所有通用知识整体不生效">' +
          '<span class="iconify" data-icon="lucide:user-x" data-width="12" data-height="12"></span>' +
          '黑名单 ' + scope.blacklistCount + ' 家</span>';
      }
      html += '</div>';
      return html;
    },

    openModal: function (knowledgeId) {
      var k = MockStore.getGlobalKnowledge().find(function (item) { return item.id === knowledgeId; });
      if (!k) return;
      state.scopeKnowledgeId = knowledgeId;
      // 草稿初始化为当前已配置的例外，保证再次打开能看到历史配置
      state.scopeDraftIds = (k.excludedMerchantIds || []).slice();

      elements.scopeKnowledgeQ.textContent = k.standardQ || '';

      var editable = canManageScope();
      elements.scopeReadonlyTip.classList.toggle('hidden', editable);
      elements.scopeModalSubmit.style.display = editable ? '' : 'none';

      this.renderMerchants();
      elements.scopeModal.style.display = 'flex';
    },

    closeModal: function () {
      elements.scopeModal.style.display = 'none';
      state.scopeKnowledgeId = null;
      state.scopeDraftIds = [];
    },

    /** 弹层内商家表格 + 当前排除 chips，两者同源，勾选变化即同步刷新 */
    renderMerchants: function () {
      var merchants = MockStore.getMerchants();
      var blacklist = MockStore.getBlacklist();
      var editable = canManageScope();
      var draft = state.scopeDraftIds;
      var self = this;

      // —— 当前被排除的商家 ——
      var excludedNow = merchants.filter(function (m) { return draft.indexOf(m.id) !== -1; });
      var blacklistSet = blacklist;
      elements.scopeExcludedSummary.textContent = '例外 ' + excludedNow.length +
        ' 家 · 黑名单 ' + blacklistSet.length + ' 家';
      if (excludedNow.length === 0) {
        elements.scopeExcludedChips.innerHTML = '<span class="scope-excluded-empty">暂无例外商家，本条对全部非黑名单商家生效</span>';
      } else {
        elements.scopeExcludedChips.innerHTML = excludedNow.map(function (m) {
          return '<span class="scope-excluded-chip">' +
            Utils.escapeHtml(m.name) +
            '<span class="text-orange-300 font-mono">' + Utils.escapeHtml(m.id) + '</span>' +
            (editable ? '<span class="iconify chip-remove" data-id="' + m.id + '" data-icon="lucide:x" data-width="12" data-height="12" title="移回生效范围"></span>' : '') +
            '</span>';
        }).join('');
        if (editable) {
          elements.scopeExcludedChips.querySelectorAll('.chip-remove').forEach(function (el) {
            el.addEventListener('click', function () {
              state.scopeDraftIds = state.scopeDraftIds.filter(function (id) { return id !== el.dataset.id; });
              self.renderMerchants();
            });
          });
        }
      }

      // —— 商家明细表 ——
      Table.render(elements.scopeMerchantBody, merchants, function (m) {
        var inBlacklist = blacklist.indexOf(m.id) !== -1;
        var inDraft = draft.indexOf(m.id) !== -1;
        var rowClass = inBlacklist ? 'row-blacklist' : (inDraft ? 'row-excluded' : '');
        var statusCell = inBlacklist
          ? '<span class="scope-chip scope-chip-blacklist">黑名单（整体不生效）</span>'
          : (inDraft
            ? '<span class="scope-chip scope-chip-excluded">本条例外</span>'
            : '<span class="scope-chip scope-chip-ok">生效中</span>');
        var checkbox = inBlacklist
          ? '<input type="checkbox" class="scope-check" disabled title="黑名单商家整体不生效，无需在本条设置例外" />'
          : '<input type="checkbox" class="scope-check scope-row-check" data-id="' + m.id + '"' +
            (inDraft ? ' checked' : '') + (editable ? '' : ' disabled') + ' />';
        return '<tr class="' + rowClass + '">' +
          '<td class="font-mono text-xs text-slate-600">' + Utils.escapeHtml(m.id) + '</td>' +
          '<td class="text-slate-800">' + Utils.escapeHtml(m.name) + '</td>' +
          '<td>' + statusCell + '</td>' +
          '<td class="text-center">' + checkbox + '</td>' +
        '</tr>';
      }, function (tbody) {
        tbody.querySelectorAll('.scope-row-check').forEach(function (cb) {
          cb.addEventListener('change', function () {
            var id = cb.dataset.id;
            if (cb.checked) {
              if (state.scopeDraftIds.indexOf(id) === -1) state.scopeDraftIds.push(id);
            } else {
              state.scopeDraftIds = state.scopeDraftIds.filter(function (x) { return x !== id; });
            }
            self.renderMerchants();
          });
        });
      });
    },

    save: function () {
      if (!canManageScope()) {
        Toast.show('无权限调整生效范围，仅管理员可配置例外商家', 'error');
        return;
      }
      if (!state.scopeKnowledgeId) return;
      // 黑名单商家不进入例外名单：黑名单是更高优先级的整体排除
      var blacklist = MockStore.getBlacklist();
      var ids = state.scopeDraftIds.filter(function (id) { return blacklist.indexOf(id) === -1; });
      var result = MockStore.setGlobalKnowledgeExclusions(state.scopeKnowledgeId, ids);
      if (!result.success) {
        Toast.show(result.message || '保存失败', 'error');
        return;
      }
      this.closeModal();
      KnowledgeManager.render();
      BlacklistManager.render();
      Toast.show('生效范围已保存', 'success');
    }
  };

  // ====================== 黑名单管理 ======================
  var BlacklistManager = {
    applyPermission: function () {
      var editable = canManageScope();
      elements.btnAddBlacklist.disabled = !editable;
      elements.blacklistAddSelect.disabled = !editable;
      elements.blacklistAddSelect.title = editable ? '' : '只读角色无权调整黑名单';
    },

    fillSelect: function () {
      var merchants = MockStore.getMerchants();
      var blacklist = MockStore.getBlacklist();
      var options = merchants.filter(function (m) {
        return blacklist.indexOf(m.id) === -1;
      }).map(function (m) {
        return { value: m.id, label: m.name + '（' + m.id + '）' };
      });
      Select.fill(elements.blacklistAddSelect, options, '选择商家加入黑名单');
    },

    render: function () {
      var blacklist = MockStore.getBlacklist();
      var merchants = MockStore.getMerchants();
      var map = {};
      merchants.forEach(function (m) { map[m.id] = m.name; });

      if (blacklist.length === 0) {
        elements.blacklistTableBody.innerHTML = '';
        elements.blacklistEmpty.classList.remove('hidden');
        var wrap = elements.blacklistTableBody.closest('.table-wrap');
        if (wrap) wrap.style.display = 'none';
        return;
      }

      elements.blacklistEmpty.classList.add('hidden');
      var wrap = elements.blacklistTableBody.closest('.table-wrap');
      if (wrap) wrap.style.display = '';

      var editable = canManageScope();
      var data = blacklist.map(function (id) {
        return { id: id, name: map[id] || '（商家已删除）' };
      });

      Table.render(elements.blacklistTableBody, data, function (item) {
        return '<td class="font-mono text-sm text-obsidian">' + Utils.escapeHtml(item.id) + '</td>' +
          '<td class="text-obsidian">' + Utils.escapeHtml(item.name) + '</td>' +
          '<td class="text-right">' +
            (editable
              ? '<button type="button" class="btn-link bl-remove" data-id="' + item.id + '">移出</button>'
              : '<span class="text-xs text-slate-400">仅管理员可操作</span>') +
          '</td>';
      }, this.bindTableEvents.bind(this));
    },

    bindTableEvents: function (tbody) {
      tbody.querySelectorAll('.bl-remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!AuthModule.canManageScope()) {
            Toast.show('无权限调整黑名单，仅管理员可操作', 'error');
            return;
          }
          Confirm.show('移出黑名单后，该商家将恢复接收通用知识（仍命中单条例外的除外）。确定移出？', function () {
            var result = MockStore.removeBlacklist(btn.dataset.id);
            if (!result.success) {
              Toast.show(result.message || '操作失败', 'error');
              return;
            }
            BlacklistManager.render();
            BlacklistManager.fillSelect();
            KnowledgeManager.render();
            Toast.show('已从黑名单移出，通用知识已恢复生效', 'success');
          });
        });
      });
    },

    add: function () {
      if (!canManageScope()) {
        Toast.show('无权限调整黑名单，仅管理员可操作', 'error');
        return;
      }
      var id = elements.blacklistAddSelect.value;
      if (!id) {
        Toast.show('请选择商家', 'error');
        return;
      }
      var result = MockStore.addBlacklist(id);
      if (!result.success) {
        Toast.show(result.message || '操作失败', 'error');
        return;
      }
      this.fillSelect();
      this.render();
      KnowledgeManager.render();
      Toast.show('已加入黑名单，该商家将整体不生效通用知识', 'success');
    }
  };

  // ====================== 事件绑定 ======================
  function bindEvents() {
    elements.btnAddKnowledge.addEventListener('click', function () {
      KnowledgeManager.openModal();
    });
    elements.knowledgeModalCancel.addEventListener('click', function () {
      KnowledgeManager.closeModal();
    });
    elements.knowledgeModalSubmit.addEventListener('click', function () {
      KnowledgeManager.save();
    });
    Modal.bindOverlayClose(elements.knowledgeModal, function () {
      KnowledgeManager.closeModal();
    });

    elements.scopeModalCancel.addEventListener('click', function () {
      ScopeManager.closeModal();
    });
    elements.scopeModalSubmit.addEventListener('click', function () {
      ScopeManager.save();
    });
    Modal.bindOverlayClose(elements.scopeModal, function () {
      ScopeManager.closeModal();
    });

    elements.btnAddBlacklist.addEventListener('click', function () {
      BlacklistManager.add();
    });
  }

  // ====================== 初始化 ======================
  function init() {
    cacheElements();
    bindEvents();
    RoleBadge.render();
    BlacklistManager.applyPermission();
    KnowledgeManager.render();
    BlacklistManager.fillSelect();
    BlacklistManager.render();
  }

  // ====================== 导出模块 ======================
  global.GlobalPage = {
    init: init,
    state: state,
    KnowledgeManager: KnowledgeManager,
    ScopeManager: ScopeManager,
    BlacklistManager: BlacklistManager
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
