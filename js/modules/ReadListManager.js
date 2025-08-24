/**
 * 읽을거리 관리 모듈 (.myread 연동)
 */
export class ReadListManager {
    constructor(storageManager, options = {}) {
        this.storage = storageManager;
        this.items = [];
        this.container = null;
        this.inputName = null;
        this.inputUrl = null;
        this.addBtn = null;
        this.tabs = { all: null, unread: null, read: null };
        this.currentTab = 'unread';
        this.serverMode = !!options.serverMode;
        this.serverUrl = options.serverUrl || window.location.origin;
    }

    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) throw new Error('Read list container not found');
        this.renderSkeleton();
        this.cacheElements();
        this.bindEvents();
        this.loadItems();
    }

    renderSkeleton() {
        this.container.innerHTML = `
            <div class="readlist">
                <div class="readlist-header">
                    <div class="readlist-tabs">
                        <button class="tab-btn" data-tab="unread">Unread</button>
                        <button class="tab-btn" data-tab="read">Read</button>
                        <button class="tab-btn" data-tab="all">All</button>
                    </div>
                </div>
                <div class="readlist-add">
                    <input type="text" class="read-name" placeholder="제목">
                    <input type="text" class="read-url" placeholder="URL">
                    <button class="read-add-btn"><i class="fas fa-plus"></i> 추가</button>
                </div>
                <div class="readlist-list" id="readList"></div>
            </div>
        `;
    }

    cacheElements() {
        this.inputName = this.container.querySelector('.read-name');
        this.inputUrl = this.container.querySelector('.read-url');
        this.addBtn = this.container.querySelector('.read-add-btn');
        this.tabs = {
            unread: this.container.querySelector('[data-tab="unread"]'),
            read: this.container.querySelector('[data-tab="read"]'),
            all: this.container.querySelector('[data-tab="all"]')
        };
        this.listEl = this.container.querySelector('#readList');
    }

    bindEvents() {
        this.addBtn.addEventListener('click', () => this.handleAdd());
        Object.keys(this.tabs).forEach(tab => {
            this.tabs[tab].addEventListener('click', () => {
                this.currentTab = tab;
                this.renderList();
                this.updateTabs();
            });
        });
    }

    async loadItems() {
        if (this.serverMode) {
            try {
                const res = await fetch(`${this.serverUrl}/api/read`);
                const data = await res.json();
                if (data?.success && Array.isArray(data.items)) {
                    this.items = data.items;
                } else {
                    this.items = [];
                }
            } catch (e) {
                console.warn('서버에서 읽을거리 로드 실패, 로컬 스토리지 사용:', e);
                this.items = this.storage.load('readItems', []);
            }
        } else {
            this.items = this.storage.load('readItems', []);
        }
        this.renderList();
        this.updateTabs();
    }

    async persistItems() {
        this.storage.save('readItems', this.items);
        if (this.serverMode) {
            try {
                await fetch(`${this.serverUrl}/api/read`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: this.items })
                });
            } catch (e) {
                console.warn('서버 저장 실패:', e);
            }
        }
    }

    normalizeUrlMaybe(url) {
        if (!url) return '';
        return url.startsWith('http') ? url : `https://${url}`;
    }

    async handleAdd() {
        const name = (this.inputName?.value || '').trim();
        const urlRaw = (this.inputUrl?.value || '').trim();
        if (!name || !urlRaw) return;
        const url = this.normalizeUrlMaybe(urlRaw);
        const newItem = { id: 'read_' + Date.now(), name, url, status: 'unread' };
        this.items.unshift(newItem);
        await this.persistItems();
        this.renderList();
        if (this.inputName) this.inputName.value = '';
        if (this.inputUrl) this.inputUrl.value = '';
    }

    async markAsRead(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;
        item.status = 'read';
        await this.persistItems();
        this.renderList();
    }

    async markAsUnread(id) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;
        item.status = 'unread';
        await this.persistItems();
        this.renderList();
    }

    async deleteItem(id) {
        const target = this.items.find(i => i.id === id);
        if (!target) return;
        if (!confirm('이 항목을 삭제할까요?')) return;
        this.items = this.items.filter(i => i.id !== id);
        await this.persistItems();
        this.renderList();
    }

    updateTabs() {
        Object.keys(this.tabs).forEach(tab => {
            const btn = this.tabs[tab];
            if (!btn) return;
            btn.classList.toggle('active', tab === this.currentTab);
            const count = tab === 'all' ? this.items.length : this.items.filter(i => i.status === tab).length;
            btn.innerText = `${tab.charAt(0).toUpperCase() + tab.slice(1)} (${count})`;
        });
    }

    createRow(item) {
        const row = document.createElement('div');
        row.className = `read-item ${item.status}`;
        row.dataset.id = item.id;
        row.innerHTML = `
            <a class="read-link" href="${item.url}" target="_blank" rel="noopener noreferrer">${item.name}</a>
            <div class="read-actions">
                ${item.status === 'unread' ? `<button class="read-btn mark-read" title="읽음"><i class="fas fa-check"></i></button>` : `<button class="read-btn mark-unread" title="미읽음으로"><i class="fas fa-undo"></i></button>`}
                <button class="read-btn delete" title="삭제"><i class="fas fa-trash"></i></button>
            </div>
        `;

        const markBtn = row.querySelector(item.status === 'unread' ? '.mark-read' : '.mark-unread');
        markBtn.addEventListener('click', () => {
            if (item.status === 'unread') this.markAsRead(item.id); else this.markAsUnread(item.id);
        });
        row.querySelector('.delete').addEventListener('click', () => this.deleteItem(item.id));
        return row;
    }

    renderList() {
        if (!this.listEl) return;
        const filtered = this.currentTab === 'all' ? this.items : this.items.filter(i => i.status === this.currentTab);
        this.listEl.innerHTML = '';
        if (filtered.length === 0) {
            this.listEl.innerHTML = `
                <div class="read-empty">
                    <i class="fas fa-inbox"></i>
                    <p>${this.currentTab === 'unread' ? '읽을 항목이 없습니다' : this.currentTab === 'read' ? '읽은 항목이 없습니다' : '항목이 없습니다'}</p>
                </div>
            `;
            return;
        }
        filtered.forEach(item => this.listEl.appendChild(this.createRow(item)));
    }
}

window.readListManager = null;

