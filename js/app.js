/**
 * 메인 애플리케이션 클래스
 * 모든 모듈을 통합하고 관리
 */
import { TimeManager } from './modules/TimeManager.js';
import { StorageManager } from './modules/StorageManager.js';
import { LinkManager } from './modules/LinkManager.js';
import { MemoManager } from './modules/MemoManager.js';
import { BookmarkImporter } from './modules/BookmarkImporter.js';

class PersonalHomeApp {
    constructor() {
        this.timeManager = new TimeManager();
        this.storageManager = new StorageManager();
        this.linkManager = new LinkManager(this.storageManager);
        this.memoManager = new MemoManager(this.storageManager);
        this.bookmarkImporter = new BookmarkImporter(this.linkManager, { includeSpecialFolders: false });

        this.currentTheme = 'default';
        this.isServerMode = false;
        this.serverUrl = window.location.origin;

        this.init();
    }

    /**
     * 애플리케이션 초기화
     */
    async init() {
        try {
            // 서버 모드 확인
            await this.checkServerMode();

                    // 모듈 초기화
        this.timeManager.init('currentTime', 'currentDate');
        this.memoManager.init('memoContainer', 'addMemo', { serverMode: this.isServerMode, serverUrl: this.serverUrl });
        this.linkManager.init('linksContainer');

        // 전역 참조 설정
        window.memoManager = this.memoManager;
        window.editLink = (id) => this.linkManager.openEdit(id);
        window.cancelLinkEdit = (id) => this.linkManager.cancelEdit(id);
        window.saveLinkEdit = async (id) => {
            const card = document.querySelector(`.link-card[data-id="${id}"]`);
            if (!card) return;
            const name = card.querySelector('.edit-name')?.value || '';
            const url = card.querySelector('.edit-url')?.value || '';
            const tags = card.querySelector('.edit-tags')?.value || '';
            const description = card.querySelector('.edit-description')?.value || '';

            this.linkManager.applyEdit(id, { name, url, tags, description });
            this.render();

            // 서버 모드면 RC 파일에 즉시 반영
            if (this.isServerMode) {
                try {
                    const lines = this.linkManager.links.map(l => {
                        const safeName = String(l.name || '').replace(/,/g, ' ').trim();
                        const flatTags = Array.isArray(l.tags) ? l.tags.filter(t => !t.includes(' > ')) : [];
                        return [safeName, l.url, ...flatTags].join(',');
                    });
                    const content = lines.join('\n') + (lines.length ? '\n' : '');
                    await fetch('/api/rc', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content })
                    });
                } catch (e) {
                    console.warn('RC 파일 업데이트 실패:', e);
                }
            }

            this.showSuccess('링크가 수정되었습니다');
        };

            // 이벤트 리스너 설정
            this.setupEventListeners();

            // 테마 로드
            this.loadTheme();

            // 초기 렌더링
            this.render();

            // RC 파일 자동 로드 시도
            if (this.isServerMode) {
                await this.loadRcFromServer();
            } else {
                this.loadSampleData();
            }

            // 평일 9~18시에는 기본 필터를 '깃헙'으로 자동 선택
            this.applyTimeBasedDefaultFilter();

            console.log('✅ Personal Home 애플리케이션이 성공적으로 초기화되었습니다');

        } catch (error) {
            console.error('❌ 애플리케이션 초기화 실패:', error);
            this.showError('애플리케이션 초기화 중 오류가 발생했습니다');
        }
    }

    /**
     * 서버 모드 확인
     */
    async checkServerMode() {
        try {
            const response = await fetch(`${this.serverUrl}/api/system`);
            if (response.ok) {
                this.isServerMode = true;
                console.log('🖥️ 서버 모드로 실행 중');
            }
        } catch {
            this.isServerMode = false;
            console.log('💻 클라이언트 모드로 실행 중');
        }
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 설정 모달
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.openSettings());
        document.getElementById('closeModal')?.addEventListener('click', () => this.closeSettings());

        // RC 파일 관련
        document.getElementById('loadRcFile')?.addEventListener('click', () => this.loadRcFile());
        document.getElementById('addLink')?.addEventListener('click', () => this.addLink());
        document.getElementById('deleteAllLinks')?.addEventListener('click', () => this.deleteAllLinks());
        document.getElementById('saveRcNow')?.addEventListener('click', () => this.saveRcNow());

        // 테마 변경
        document.getElementById('themeSelector')?.addEventListener('change', (e) => {
            this.changeTheme(e.target.value);
        });

        // 검색
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // 북마크 가져오기
        document.getElementById('importBookmarksFile')?.addEventListener('click', () => this.importBookmarksFromFile());
        document.getElementById('showChromeGuide')?.addEventListener('click', () => this.showChromeGuide());

        // 시간 클릭 전환 제거 (KST/UTC 동시 표시)

        // 데이터 내보내기/가져오기
        document.getElementById('exportData')?.addEventListener('click', () => this.exportData());
        document.getElementById('importData')?.addEventListener('click', () => this.importData());

        // 모달 외부 클릭 시 닫기
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeSettings();
            }
        });

        // 키보드 단축키
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // 태그 필터 이벤트 위임
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-filter')) {
                this.handleTagFilter(e.target.dataset.tag);
            }
        });
    }

    /**
     * 키보드 단축키 처리
     */
    handleKeyboardShortcuts(e) {
        // ESC: 모달 닫기
        if (e.key === 'Escape') {
            this.closeSettings();
        }

        // Ctrl/Cmd + K: 검색 포커스
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
        }

        // Ctrl/Cmd + ,: 설정 열기
        if ((e.ctrlKey || e.metaKey) && e.key === ',') {
            e.preventDefault();
            this.openSettings();
        }

        // Ctrl/Cmd + R: 브라우저 기본 동작 유지 (새로고침)
    }

    /**
     * 서버에서 RC 파일 로드
     */
    async loadRcFromServer() {
        try {
            const response = await fetch(`${this.serverUrl}/api/rc`);
            const data = await response.json();

            if (data.success) {
                // 기존 로컬 링크를 RC 파일 내용으로 교체
                this.linkManager.replaceLinks(data.links);
                this.render();
            } else {
                console.warn('RC 파일 로드 실패:', data.error);
                this.loadSampleData();
            }
        } catch (error) {
            console.error('서버에서 RC 파일 로드 실패:', error);
            this.loadSampleData();
        }
    }

    /**
     * 샘플 데이터 로드
     */
    loadSampleData() {
        const sampleLinks = [
            { name: 'Google', url: 'https://google.com', tags: ['검색'] },
            { name: 'GitHub', url: 'https://github.com', tags: ['개발'] },
            { name: 'Stack Overflow', url: 'https://stackoverflow.com', tags: ['개발'] },
            { name: 'YouTube', url: 'https://youtube.com', tags: ['엔터테인먼트'] },
            { name: 'Netflix', url: 'https://netflix.com', tags: ['엔터테인먼트'] }
        ];

        // 기존 링크가 없는 경우에만 샘플 데이터 추가
        if (this.linkManager.links.length === 0) {
            sampleLinks.forEach(link => this.linkManager.addLink(link));
            this.render();
        }
    }

    /**
     * RC 파일 로드
     */
    async loadRcFile() {
        if (this.isServerMode) {
            await this.loadRcFromServer();
        } else {
            // 클라이언트 모드에서는 파일 입력으로 처리
            this.showFileInput();
        }
    }

    /**
     * 파일 입력 모달 표시
     */
    showFileInput() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.rc,.txt';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    const count = this.linkManager.parseAndAddRcData(content);
                    this.render();
                    this.showSuccess(`${count}개의 링크를 추가했습니다`);
                };
                reader.readAsText(file);
            }
        });
        input.click();
    }

    /**
     * 링크 추가
     */
    addLink() {
        const name = document.getElementById('linkName')?.value.trim();
        const url = document.getElementById('linkUrl')?.value.trim();
        const tags = document.getElementById('linkTags')?.value.trim();

        if (!name || !url) {
            this.showError('이름과 URL을 모두 입력해주세요');
            return;
        }

        const linkData = {
            name,
            url,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : []
        };

        this.linkManager.addLink(linkData);
        this.render();

        // 입력 필드 초기화
        document.getElementById('linkName').value = '';
        document.getElementById('linkUrl').value = '';
        document.getElementById('linkTags').value = '';

        this.showSuccess('링크가 추가되었습니다');
    }

    /**
     * 모든 링크 삭제
     */
    deleteAllLinks() {
        if (!confirm('정말 모든 링크를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
        const removed = this.linkManager.deleteAll();
        this.render();
        this.showSuccess(`${removed}개의 링크를 삭제했습니다`);
    }

    /**
     * 현재 링크 상태를 RC 파일로 저장 (서버 모드 필요)
     */
    async saveRcNow() {
        try {
            // 현재 링크를 RC 포맷 CSV 라인으로 직렬화
            const lines = this.linkManager.links.map(l => {
                const safeName = String(l.name || '').replace(/,/g, ' ').trim();
                const flatTags = Array.isArray(l.tags) ? l.tags.filter(t => !t.includes(' > ')) : [];
                return [safeName, l.url, ...flatTags].join(',');
            });
            const content = lines.join('\n') + (lines.length ? '\n' : '');

            if (this.isServerMode) {
                try {
                    const res = await fetch('/api/rc', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content })
                    });
                    const data = await res.json();
                    if (data?.success) {
                        this.showSuccess('현재 상태를 RC 파일에 저장했습니다');
                        return;
                    }
                } catch (_) {
                    // 서버 저장 실패 시 아래 다운로드로 폴백
                }
            }

            // 클라이언트 모드 또는 서버 저장 실패: 파일로 다운로드
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '.myweb.rc';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            this.showSuccess('현재 상태를 .myweb.rc 파일로 다운로드했습니다');
        } catch (e) {
            console.error('RC 저장 실패:', e);
            this.showError('RC 파일 저장 중 오류가 발생했습니다');
        }
    }

    /**
     * 태그 필터 처리
     */
    handleTagFilter(tag) {
        this.linkManager.setFilter(tag);
        this.renderTagFilters();
    }

    /**
     * 검색 처리
     */
    handleSearch(query) {
        if (!query.trim()) {
            this.linkManager.setFilter('all');
            this.linkManager.render();
            return;
        }

        const searchResults = this.linkManager.searchLinks(query);
        this.renderSearchResults(searchResults);
    }

    /**
     * 검색 결과 렌더링
     */
    renderSearchResults(results) {
        const container = document.getElementById('linksContainer');
        container.innerHTML = '';

        if (results.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>검색 결과가 없습니다</h3>
                    <p>다른 키워드로 검색해보세요</p>
                </div>
            `;
            return;
        }

        results.forEach(link => {
            const linkCard = this.linkManager.createLinkCard(link);
            container.appendChild(linkCard);
        });
    }

    /**
     * 파일에서 북마크 가져오기
     */
    async importBookmarksFromFile() {
        try {
            this.showNotification('북마크 파일을 선택해주세요...', 'info');

            const result = await this.bookmarkImporter.importFromFile();

            // 서버 모드면 RC 파일에 즉시 반영, 아니면 파일로 자동 다운로드
            if (result.bookmarks?.length) {
                if (this.isServerMode) {
                    try {
                        await this.bookmarkImporter.appendToRcFile(result.bookmarks);
                    } catch (_) {}
                } else {
                    const lines = this.linkManager.links.map(l => {
                        const safeName = String(l.name || '').replace(/,/g, ' ').trim();
                        const flatTags = Array.isArray(l.tags) ? l.tags.filter(t => !t.includes(' > ')) : [];
                        return [safeName, l.url, ...flatTags].join(',');
                    });
                    const content = lines.join('\n') + (lines.length ? '\n' : '');
                    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = '.myweb.rc';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                }
            }

            // 미리보기 모달 표시 (저장 이후)
            await this.showBookmarkPreview(result);

            this.render();

        } catch (error) {
            console.error('북마크 가져오기 실패:', error);
            this.showError(`북마크 가져오기 실패: ${error.message}`);
        }
    }

        /**
     * 크롬 가이드 표시
     */
    showChromeGuide() {
        const modal = document.createElement('div');
        modal.className = 'modal chrome-guide-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fab fa-chrome"></i> 크롬에서 북마크 내보내기</h3>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="guide-step">
                        <div class="guide-step-number">1</div>
                        <div class="guide-step-content">
                            <h4>크롬 북마크 관리자 열기</h4>
                            <p>크롬에서 <span class="shortcut">Ctrl+Shift+O</span> (Mac: <span class="shortcut">Cmd+Shift+O</span>) 를 누르거나<br>
                            주소창에 <span class="shortcut">chrome://bookmarks/</span> 입력</p>
                        </div>
                    </div>

                    <div class="guide-step">
                        <div class="guide-step-number">2</div>
                        <div class="guide-step-content">
                            <h4>내보내기 메뉴 찾기</h4>
                            <p>북마크 관리자 우측 상단의 <strong>⋮</strong> (점 3개) 버튼을 클릭하고<br>
                            <strong>"북마크 내보내기"</strong> 선택</p>
                        </div>
                    </div>

                    <div class="guide-step">
                        <div class="guide-step-number">3</div>
                        <div class="guide-step-content">
                            <h4>HTML 파일 저장</h4>
                            <p>원하는 위치에 북마크 파일을 저장합니다.<br>
                            파일명은 <strong>bookmarks_날짜.html</strong> 형태로 자동 생성됩니다.</p>
                        </div>
                    </div>

                    <div class="guide-step">
                        <div class="guide-step-number">4</div>
                        <div class="guide-step-content">
                            <h4>파일 업로드</h4>
                            <p>저장된 HTML 파일을 <strong>"북마크 파일 선택"</strong> 버튼으로 업로드하면<br>
                            자동으로 폴더 구조가 태그로 변환됩니다!</p>
                        </div>
                    </div>

                    <div class="guide-tip">
                        <i class="fas fa-lightbulb"></i>
                        <div>
                            <strong>꿀팁:</strong> 북마크 폴더가 "개발 > Frontend > React" 구조라면<br>
                            "개발", "Frontend", "개발 > Frontend" 태그가 자동 생성됩니다!
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'block';

        // 이벤트 리스너
        const closeModal = () => {
            modal.remove();
        };

        modal.querySelector('.close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // ESC로 닫기
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    /**
     * 북마크 미리보기 모달 표시
     * @param {object} result - 가져오기 결과
     */
    async showBookmarkPreview(result) {
        const previewHtml = this.bookmarkImporter.generatePreview(result.bookmarks);

        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal bookmark-preview-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>북마크 가져오기 결과</h3>
                        <span class="close">&times;</span>
                    </div>
                    <div class="modal-body">
                        ${previewHtml}
                        <div class="preview-actions">
                            <button class="confirm-btn">확인</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            modal.style.display = 'block';

            // 이벤트 리스너
            const closeModal = () => {
                modal.remove();
                resolve();
            };

            modal.querySelector('.close').addEventListener('click', closeModal);
            modal.querySelector('.confirm-btn').addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        });
    }

    /**
     * 시간대 토글
     */
    toggleTimezone() {
        this.timeManager.toggleTimezone();
        const currentTz = this.timeManager.getCurrentTimezone();
        this.showNotification(`시간대가 ${currentTz}로 변경되었습니다`, 'info');
    }

    /**
     * 데이터 내보내기
     */
    exportData() {
        const data = {
            exportDate: new Date().toISOString(),
            version: '2.0.0',
            links: this.linkManager.links,
            memos: this.memoManager.exportMemos(),
            settings: {
                theme: this.currentTheme,
                // 기타 설정들
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `personal-home-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showSuccess('데이터를 성공적으로 내보냈습니다');
    }

    /**
     * 데이터 가져오기
     */
    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);

                        // 데이터 유효성 검사
                        if (data.links) {
                            data.links.forEach(link => this.linkManager.addLink(link));
                        }

                        if (data.memos) {
                            this.memoManager.importMemos(data.memos);
                        }

                        if (data.settings?.theme) {
                            this.changeTheme(data.settings.theme);
                        }

                        this.render();
                        this.showSuccess('데이터를 성공적으로 가져왔습니다');

                    } catch (error) {
                        console.error('데이터 가져오기 실패:', error);
                        this.showError('올바르지 않은 데이터 형식입니다');
                    }
                };
                reader.readAsText(file);
            }
        });
        input.click();
    }

    /**
     * 테마 변경
     */
    changeTheme(themeName) {
        this.currentTheme = themeName;
        document.body.className = `theme-${themeName}`;
        this.storageManager.save('theme', themeName);
    }

    /**
     * 테마 로드
     */
    loadTheme() {
        const savedTheme = this.storageManager.load('theme', 'default');
        this.changeTheme(savedTheme);

        const themeSelector = document.getElementById('themeSelector');
        if (themeSelector) {
            themeSelector.value = savedTheme;
        }
    }

    /**
     * 설정 모달 열기
     */
    openSettings() {
        document.getElementById('settingsModal').style.display = 'block';
        this.renderSettingsContent();
    }

    /**
     * 설정 모달 닫기
     */
    closeSettings() {
        document.getElementById('settingsModal').style.display = 'none';
    }

    /**
     * 설정 내용 렌더링
     */
    renderSettingsContent() {
        const modalBody = document.querySelector('.modal-body');
        if (!modalBody) {
            console.error('Modal body not found');
            return;
        }

        console.log('Rendering settings content...');

        const stats = this.linkManager.getStats();
        const memoStats = this.memoManager.getStats();

        modalBody.innerHTML = `
            <div class="config-section">
                <h4>🔗 RC 파일 관리</h4>
                <input type="text" id="rcFilePath" value="~/.myweb.rc" placeholder="RC 파일 경로">
                <button id="loadRcFile" class="load-btn">파일 로드</button>
                <button id="saveRcNow" class="add-btn">현재 상태 저장</button>
                ${this.isServerMode ? '<p class="info">서버 모드: 자동 감시 활성화</p>' : '<p class="info">클라이언트 모드: 파일 업로드</p>'}
            </div>



            <div class="config-section">
                <h4>➕ 수동 링크 추가</h4>
                <input type="text" id="linkName" placeholder="링크 이름">
                <input type="text" id="linkUrl" placeholder="URL">
                <input type="text" id="linkTags" placeholder="태그 (쉼표로 구분)">
                <button id="addLink" class="add-btn">추가</button>
                <button id="deleteAllLinks" class="delete-btn" style="margin-left: 8px;">모든 링크 삭제</button>
            </div>

            <div class="config-section">
                <h4>🎨 테마 설정</h4>
                <select id="themeSelector">
                    <option value="default">기본</option>
                    <option value="dark">다크</option>
                    <option value="light">라이트</option>
                    <option value="blue">블루</option>
                    <option value="green">그린</option>
                </select>
            </div>

            <div class="config-section">
                <h4>🔍 검색</h4>
                <input type="text" id="searchInput" placeholder="링크 검색... (Ctrl+K)">
            </div>



            <div class="config-section">
                <h4>💾 데이터 관리</h4>
                <button id="exportData" class="add-btn">데이터 내보내기</button>
                <button id="importData" class="load-btn">데이터 가져오기</button>
            </div>

            <div class="config-section">
                <h4>📊 통계</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">총 링크</span>
                        <span class="stat-value">${stats.totalLinks}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">총 클릭</span>
                        <span class="stat-value">${stats.totalClicks}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">메모 일수</span>
                        <span class="stat-value">${memoStats.totalDays}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">총 글자수</span>
                        <span class="stat-value">${memoStats.totalCharacters}</span>
                    </div>
                </div>
            </div>
        `;

        // 이벤트 리스너 재설정
        this.setupEventListeners();
    }

    /**
     * 전체 렌더링
     */
    render() {
        this.linkManager.render();
        this.renderTagFilters();
    }

    /**
     * 태그 필터 렌더링 (계층적 태그 지원)
     */
    renderTagFilters() {
        const container = document.getElementById('tagFilters');
        if (!container) return;

        const allTags = this.linkManager.getAllTags();
        const stats = this.linkManager.getStats();
        const counts = stats.tagStats || {};
        const currentFilter = this.linkManager.currentFilter;
        const defaultTag = this.getDefaultTag();

        container.innerHTML = allTags.map(tag => {
            const isHierarchical = tag.includes(' > ');
            const isActive = tag === currentFilter;
            const isDefault = tag === defaultTag;
            const displayName = tag === 'all' ? '전체' : tag;

            const count = counts[tag] || 0;
            return `
                <button class="tag-filter ${isActive ? 'active' : ''} ${isHierarchical ? 'hierarchical' : ''} ${isDefault ? 'default' : ''}"
                        data-tag="${tag}"
                        title="${isDefault ? '기본 태그' : (isHierarchical ? '계층적 태그: ' + tag : tag)}">
                    ${displayName} <span class="tag-count">${count}</span>
                </button>
            `;
        }).join('');
    }

    /**
     * 시간 기반 기본 태그 적용 (평일 9~18시: '깃헙')
     */
    applyTimeBasedDefaultFilter() {
        const defaultTag = this.getDefaultTag();
        if (!defaultTag) return;
        const hasTag = this.linkManager.getAllTags().includes(defaultTag);
        if (hasTag) {
            this.linkManager.setFilter(defaultTag);
            this.renderTagFilters();
        }
    }

    /**
     * 현재 시간대에 따른 기본 태그 반환
     */
    getDefaultTag() {
        const now = new Date();
        const day = now.getDay(); // 0=Sun, 1=Mon, ...
        const hour = now.getHours();
        const isWeekday = day >= 1 && day <= 5;
        const isWorkHour = hour >= 9 && hour < 18;
        return (isWeekday && isWorkHour) ? '깃헙' : null;
    }

    /**
     * 성공 메시지 표시
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    /**
     * 오류 메시지 표시
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * 경고 메시지 표시
     */
    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    /**
     * 알림 메시지 표시
     */
    showNotification(message, type = 'info') {
        // 기존 알림 제거
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : type === 'warning' ? 'exclamation' : 'info'}-circle"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);

        // 3초 후 자동 제거
        setTimeout(() => {
            notification.remove();
        }, 3000);

        // 클릭으로 즉시 제거
        notification.addEventListener('click', () => {
            notification.remove();
        });
    }

    /**
     * 애플리케이션 파괴
     */
    destroy() {
        this.timeManager.destroy();
        // 기타 정리 작업
    }
}

// 전역 변수로 export
window.personalHomeApp = null;

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.personalHomeApp = new PersonalHomeApp();
});

// 전역 함수들 (HTML에서 호출용)
window.deleteLink = (id) => {
    if (window.personalHomeApp?.linkManager) {
        window.personalHomeApp.linkManager.deleteLink(id);
        window.personalHomeApp.render();
        window.personalHomeApp.showSuccess('링크가 삭제되었습니다');
    }
};

window.trackClick = (id) => {
    if (window.personalHomeApp?.linkManager) {
        window.personalHomeApp.linkManager.trackClick(id);
    }
};

export default PersonalHomeApp;
