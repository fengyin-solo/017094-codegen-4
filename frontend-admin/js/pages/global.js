/**
 * 通用知识页面 - 模块化控制器
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
    // 生效范围弹层
    scopeKnowledgeId: null,
    scopeMerchants: [],      // 当前筛选后的商家视图 [{id,name,checked,blacklisted,excluded}]
    scopeSearchKeyword: ''
  };

  // ====================== DOM 元素缓存 ======================
  var elements = {};

  function cacheElements() {
    elements = {
      btnAddKnowledge: document.getElementById('btnAddKnowledge'),
      knowledgeTableBody: document.getElementById('knowledgeTableBody'),
      knowledgeModal: document.getElementById('knowledgeModal'),
      knowledgeModalTitle: document.getElementById('knowledgeModalTitle'),
      formStandardQ: document.getElementById('formStandardQ'),
      formSimilarQ: document.getElementById('formSimilarQ'),
      formAnswer: document.getElementById('formAnswer'),
      knowledgeModalCancel: document.getElementById('knowledgeModalCancel'),
      knowledgeModalSubmit: document.getElementById('knowledgeModalSubmit'),
      // 生效范围
      scopeModal: document.getElementById('scopeModal'),
      scopeModalTitle: document.getElementById('scopeModalTitle'),
      scopeKnowledgeQ: document.getElementById('scopeKnowledgeQ'),
      scopeSearchInput: document.getElementById('scopeSearchInput'),
      scopeMerchantList: document.getElementById('scopeMerchantList'),
      scopeListEmpty: document.getElementById('scopeListEmpty'),
      scopeStatEffective: document.getElementById('scopeStatEffective'),
      scopeStatExcluded: document.getElementById('scopeStatExcluded'),
      scopeStatBlacklisted: document.getElementById('scopeStatBlacklisted'),
      scopeNoPermission: document.getElementById('scopeNoPermission'),
      scopeModalCancel: document.getElementById('scopeModalCancel'),
      scopeModalSubmit: document.getElementById('scopeModalSubmit'),
      // 黑名单
      blacklistAddSelect: document.getElementById('blacklistAddSelect'),
      btnAddBlacklist: document.getElementById('btnAddBlacklist'),
      blacklistTableBody: document.getElementById('blacklistTableBody'),
      blacklistEmpty: document.getElementById('blacklistEmpty')
    };
  }

  // ====================== 生效范围单元格渲染 ======================
  /**
   * 渲染某条通用知识的生效范围摘要
   * @param {string} knowledgeId
   * @returns {string} HTML
   */
  function renderScopeCell(knowledgeId) {
    var scope = MockStore.getGlobalKnowledgeScope(knowledgeId);
    var parts = [];

    // 全部生效（无例外、无黑名单）
    if (scope.effectiveCount === scope.total) {
      parts.push('<span class="scope-badge scope-badge-all">' +
        '<span class="iconify" data-icon="lucide:check-circle-2" data-width="12" data-height="12"></span>' +
        '全部 ' + scope.total + ' 家生效</span>');
      return parts.join(' ');
    }

    // 生效数
    if (scope.effectiveCount > 0) {
      parts.push('<span class="scope-badge scope-badge-partial">' +
        '<span class="iconify" data-icon="lucide:users" data-width="12" data-height="12"></span>' +
        '生效 ' + scope.effectiveCount + ' 家</span>');
    } else {
      parts.push('<span class="scope-badge scope-badge-none">' +
        '<span class="iconify" data-icon="lucide:user-x" data-width="12" data-height="12"></span>' +
        '无商家生效</span>');
    }

    if (scope.excludedCount > 0) {
      parts.push('<span class="scope-badge scope-badge-partial" title="例外（按本条单独排除）">' +
        '例外 ' + scope.excludedCount + '</span>');
    }
    if (scope.blacklistedCount > 0) {
      parts.push('<span class="scope-badge scope-badge-blacklisted" title="黑名单商家整体不生效">' +
        '黑名单 ' + scope.blacklistedCount + '</span>');
    }
    return parts.join(' ');
  }

  // ====================== 通用知识管理 ======================
  var KnowledgeManager = {
    render: function () {
      var list = MockStore.getGlobalKnowledge();

      Table.render(elements.knowledgeTableBody, list, function (k) {
        return '<td class="text-obsidian">' + Utils.escapeHtml(k.standardQ || '') + '</td>' +
          '<td class="text-subtle">' + Utils.escapeHtml((k.similarQs || []).join('；')) + '</td>' +
          '<td class="text-charcoal max-w-xs truncate">' + Utils.escapeHtml(k.answer || '') + '</td>' +
          '<td><div class="flex flex-wrap gap-1">' + renderScopeCell(k.id) + '</div></td>' +
          '<td class="text-right">' +
            '<button type="button" class="btn-link k-scope mr-1" data-id="' + k.id + '">生效范围</button>' +
            '<button type="button" class="btn-link k-edit mr-1" data-id="' + k.id + '">编辑</button>' +
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
          Confirm.show('确定删除这条知识？其按商家例外配置将一并清除。', function () {
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

  // ====================== 生效范围管理（按条例外） ======================
  var ScopeManager = {
    /**
     * 构建当前知识下各商家的视图模型
     * checked = 该商家是否接收本条知识（黑名单强制 false 且禁用）
     */
    buildMerchantView: function () {
      var knowledgeId = state.scopeKnowledgeId;
      var blacklist = MockStore.getBlacklist();
      var excludedIds = MockStore.getGlobalKnowledgeExcludedMerchantIds(knowledgeId);
      return MockStore.getMerchants().map(function (m) {
        var blacklisted = blacklist.indexOf(m.id) !== -1;
        var explicitlyExcluded = excludedIds.indexOf(m.id) !== -1;
        return {
          id: m.id,
          name: m.name,
          blacklisted: blacklisted,
          explicitlyExcluded: explicitlyExcluded,
          // 黑名单商家固定不生效（禁用勾选）；其余默认生效，例外商家不勾选
          checked: !blacklisted && !explicitlyExcluded
        };
      });
    },

    openModal: function (knowledgeId) {
      var k = MockStore.getGlobalKnowledge().find(function (x) { return x.id === knowledgeId; });
      if (!k) return;

      state.scopeKnowledgeId = knowledgeId;
      state.scopeSearchKeyword = '';
      elements.scopeSearchInput.value = '';
      elements.scopeModalTitle.textContent = '设置生效范围';
      elements.scopeKnowledgeQ.textContent = k.standardQ || '';

      var canManage = MockStore.Auth.canManageGlobalScope();
      elements.scopeNoPermission.classList.toggle('hidden', canManage);
      elements.scopeModalSubmit.style.display = canManage ? '' : 'none';

      state.scopeMerchants = this.buildMerchantView();
      this.renderMerchantList();
      elements.scopeModal.style.display = 'flex';
    },

    closeModal: function () {
      elements.scopeModal.style.display = 'none';
      state.scopeKnowledgeId = null;
      state.scopeMerchants = [];
    },

    /** 当前勾选状态（含被搜索过滤隐藏的项，保证整批保存） */
    collectExcludedIds: function () {
      return state.scopeMerchants
        .filter(function (m) { return !m.checked && !m.blacklisted; })
        .map(function (m) { return m.id; });
    },

    renderMerchantList: function () {
      var self = this;
      var keyword = (state.scopeSearchKeyword || '').trim().toLowerCase();
      var view = state.scopeMerchants.filter(function (m) {
        if (!keyword) return true;
        return m.id.toLowerCase().indexOf(keyword) !== -1 ||
          (m.name || '').toLowerCase().indexOf(keyword) !== -1;
      });

      elements.scopeListEmpty.classList.toggle('hidden', view.length > 0);
      elements.scopeMerchantList.innerHTML = view.map(function (m) {
        var tagHtml;
        if (m.blacklisted) {
          tagHtml = '<span class="scope-merchant-tag scope-tag-blacklisted">黑名单</span>';
        } else if (!m.checked) {
          tagHtml = '<span class="scope-merchant-tag scope-tag-excluded">例外排除</span>';
        } else {
          tagHtml = '<span class="scope-merchant-tag scope-tag-effective">生效</span>';
        }
        return '<label class="scope-merchant-item' + (m.blacklisted ? ' is-blacklisted' : '') + '" data-id="' + Utils.escapeHtml(m.id) + '"' +
            (m.blacklisted ? ' title="黑名单商家整体不生效，移出黑名单后按例外配置恢复"' : '') + '>' +
          '<input type="checkbox" ' + (m.checked ? 'checked' : '') + (m.blacklisted ? ' disabled' : '') + ' />' +
          '<span class="scope-merchant-meta">' +
            '<span class="scope-merchant-name">' + Utils.escapeHtml(m.name) + '</span> ' +
            '<span class="scope-merchant-id">' + Utils.escapeHtml(m.id) + '</span>' +
          '</span>' +
          tagHtml +
        '</label>';
      }).join('');

      // 绑定勾选（黑名单为 disabled，不会触发变更）
      elements.scopeMerchantList.querySelectorAll('.scope-merchant-item').forEach(function (itemEl) {
        var cb = itemEl.querySelector('input[type="checkbox"]');
        cb.addEventListener('change', function () {
          var mid = itemEl.dataset.id;
          var target = state.scopeMerchants.find(function (m) { return m.id === mid; });
          if (!target || target.blacklisted) return;
          target.checked = cb.checked;
          self.renderMerchantList();
        });
      });

      this.renderStats();
    },

    renderStats: function () {
      var effective = state.scopeMerchants.filter(function (m) { return m.checked; }).length;
      var excluded = state.scopeMerchants.filter(function (m) { return !m.checked && !m.blacklisted; }).length;
      var blacklisted = state.scopeMerchants.filter(function (m) { return m.blacklisted; }).length;
      elements.scopeStatEffective.textContent = effective;
      elements.scopeStatExcluded.textContent = excluded;
      elements.scopeStatBlacklisted.textContent = blacklisted;
    },

    save: function () {
      if (!MockStore.Auth.canManageGlobalScope()) {
        Toast.show('无权限调整生效范围', 'error');
        return;
      }
      var knowledgeId = state.scopeKnowledgeId;
      var excludedIds = this.collectExcludedIds();
      var result = MockStore.setGlobalKnowledgeExclusions(knowledgeId, excludedIds);
      if (!result.success) {
        Toast.show(result.message || '保存失败', 'error');
        return;
      }
      this.closeModal();
      KnowledgeManager.render();
      Toast.show(excludedIds.length
        ? '生效范围已保存：对 ' + excludedIds.length + ' 家商家设置例外'
        : '生效范围已保存：本条对全部非黑名单商家生效', 'success');
    }
  };

  // ====================== 黑名单管理 ======================
  var BlacklistManager = {
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

      var data = blacklist.map(function (id) {
        return { id: id, name: map[id] || '-' };
      });

      Table.render(elements.blacklistTableBody, data, function (item) {
        return '<td class="font-mono text-sm text-obsidian">' + Utils.escapeHtml(item.id) + '</td>' +
          '<td class="text-obsidian">' + Utils.escapeHtml(item.name) + '</td>' +
          '<td class="text-right">' +
            '<button type="button" class="btn-link bl-remove" data-id="' + item.id + '">移出</button>' +
          '</td>';
      }, this.bindTableEvents.bind(this));
    },

    bindTableEvents: function (tbody) {
      var self = this;
      tbody.querySelectorAll('.bl-remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
          MockStore.removeBlacklist(btn.dataset.id);
          self.render();
          self.fillSelect();
          // 黑名单变化会影响各条通用知识的生效范围，同步刷新列表
          KnowledgeManager.render();
          Toast.show('已从黑名单移出，通用知识按各自生效范围恢复', 'success');
        });
      });
    },

    add: function () {
      var id = elements.blacklistAddSelect.value;
      if (!id) {
        Toast.show('请选择商家', 'error');
        return;
      }
      MockStore.addBlacklist(id);
      this.fillSelect();
      this.render();
      KnowledgeManager.render();
      Toast.show('已加入黑名单，该商家不生效全部通用知识', 'success');
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

    // 生效范围弹层
    elements.scopeModalCancel.addEventListener('click', function () {
      ScopeManager.closeModal();
    });
    elements.scopeModalSubmit.addEventListener('click', function () {
      ScopeManager.save();
    });
    Modal.bindOverlayClose(elements.scopeModal, function () {
      ScopeManager.closeModal();
    });
    elements.scopeSearchInput.addEventListener('input', function () {
      state.scopeSearchKeyword = elements.scopeSearchInput.value;
      ScopeManager.renderMerchantList();
    });

    elements.btnAddBlacklist.addEventListener('click', function () {
      BlacklistManager.add();
    });
  }

  // ====================== 初始化 ======================
  function init() {
    cacheElements();
    bindEvents();
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
