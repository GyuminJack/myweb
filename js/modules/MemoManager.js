/**
 * 메모 관리 모듈
 * 다중 메모 카드 및 메모 히스토리 관리
 */
export class MemoManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.memos = [];
        this.memoContainer = null;
        this.addMemoButton = null;
        this.currentEditingId = null;
        this.serverMode = false;
        this.serverUrl = '';
    }

    /**
     * 초기화
     * @param {string} memoContainerId - 메모 컨테이너 ID
     * @param {string} addMemoButtonId - 메모 추가 버튼 ID
     */
    init(memoContainerId, addMemoButtonId, options = {}) {
        this.memoContainer = document.getElementById(memoContainerId);
        this.addMemoButton = document.getElementById(addMemoButtonId);

        if (!this.memoContainer || !this.addMemoButton) {
            throw new Error('Memo elements not found');
        }

        this.serverMode = !!options.serverMode;
        this.serverUrl = options.serverUrl || window.location.origin;

        this.loadMemos();
        this.setupEventListeners();
        this.render();
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 메모 추가 버튼
        this.addMemoButton.addEventListener('click', () => this.addNewMemo());

        // 키보드 단축키
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && this.currentEditingId) {
                this.saveMemo(this.currentEditingId);
            }
        });
    }

    /**
     * 메모 목록 로드
     */
    async loadMemos() {
        if (this.serverMode) {
            try {
                const res = await fetch(`${this.serverUrl}/api/memos`);
                const data = await res.json();
                if (data && data.success && Array.isArray(data.memos)) {
                    this.memos = data.memos;
                } else {
                    this.memos = [];
                }
            } catch (e) {
                console.warn('서버에서 메모 로드 실패, 로컬 스토리지로 폴백:', e);
                this.memos = this.storage.load('memos', []);
            }
        } else {
            this.memos = this.storage.load('memos', []);
        }

        // 날짜순 정렬 (최신순)
        this.memos.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        // 초기 렌더 갱신
        if (this.memoContainer) {
            this.render();
        }
    }

    /**
     * 메모 목록 저장
     */
    async saveMemos() {
        this.storage.save('memos', this.memos);
        if (this.serverMode) {
            try {
                await fetch(`${this.serverUrl}/api/memos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memos: this.memos })
                });
            } catch (e) {
                console.warn('서버에 메모 저장 실패:', e);
            }
        }
    }

    /**
     * 새 메모 추가
     */
    addNewMemo() {
        const newMemo = {
            id: this.generateId(),
            title: '',
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            color: this.getRandomColor()
        };

        this.memos.unshift(newMemo);
        this.saveMemos();
        this.render();

        // 새 메모 편집 모드로 전환
        setTimeout(() => {
            this.editMemo(newMemo.id);
        }, 100);
    }

    /**
     * 메모 편집
     * @param {string} id - 메모 ID
     */
    editMemo(id) {
        this.currentEditingId = id;
        const memoCard = document.querySelector(`[data-memo-id="${id}"]`);
        if (!memoCard) return;

        const titleElement = memoCard.querySelector('.memo-title');
        const contentElement = memoCard.querySelector('.memo-content');

        // 편집 모드로 전환
        memoCard.classList.add('editing');

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'memo-title-input';
        titleInput.value = titleElement.textContent;
        titleInput.placeholder = '메모 제목';

        const contentTextarea = document.createElement('textarea');
        contentTextarea.className = 'memo-content-textarea';
        contentTextarea.value = contentElement.textContent;
        contentTextarea.placeholder = '메모 내용을 입력하세요...';

        // 기존 요소를 입력 요소로 교체
        titleElement.style.display = 'none';
        contentElement.style.display = 'none';

        titleElement.parentNode.insertBefore(titleInput, titleElement);
        contentElement.parentNode.insertBefore(contentTextarea, contentElement);

        // 첫 번째 입력 필드에 포커스
        titleInput.focus();
        titleInput.select();

        // 입력 이벤트 리스너
        const saveChanges = () => {
            this.updateMemoContent(id, titleInput.value, contentTextarea.value);
            this.exitEditMode(id);
        };

        const cancelChanges = () => {
            this.exitEditMode(id);
        };

        // 저장 버튼 추가
        const saveButton = document.createElement('button');
        saveButton.className = 'memo-save-btn';
        saveButton.innerHTML = '<i class="fas fa-check"></i> 저장';
        saveButton.addEventListener('click', saveChanges);

        const cancelButton = document.createElement('button');
        cancelButton.className = 'memo-cancel-btn';
        cancelButton.innerHTML = '<i class="fas fa-times"></i> 취소';
        cancelButton.addEventListener('click', cancelChanges);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'memo-edit-buttons';
        buttonContainer.appendChild(saveButton);
        buttonContainer.appendChild(cancelButton);

        memoCard.appendChild(buttonContainer);

        // ESC 키로 취소
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                cancelChanges();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // Ctrl+Enter로 저장
        const ctrlEnterHandler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                saveChanges();
                document.removeEventListener('keydown', ctrlEnterHandler);
            }
        };
        document.addEventListener('keydown', ctrlEnterHandler);
    }

    /**
     * 편집 모드 종료
     * @param {string} id - 메모 ID
     */
    exitEditMode(id) {
        this.currentEditingId = null;
        const memoCard = document.querySelector(`[data-memo-id="${id}"]`);
        if (!memoCard) return;

        memoCard.classList.remove('editing');

        // 입력 요소들 제거
        const titleInput = memoCard.querySelector('.memo-title-input');
        const contentTextarea = memoCard.querySelector('.memo-content-textarea');
        const buttonContainer = memoCard.querySelector('.memo-edit-buttons');

        if (titleInput) titleInput.remove();
        if (contentTextarea) contentTextarea.remove();
        if (buttonContainer) buttonContainer.remove();

        // 원래 요소들 표시
        const titleElement = memoCard.querySelector('.memo-title');
        const contentElement = memoCard.querySelector('.memo-content');

        if (titleElement) titleElement.style.display = '';
        if (contentElement) contentElement.style.display = '';
    }

    /**
     * 메모 내용 업데이트
     * @param {string} id - 메모 ID
     * @param {string} title - 제목
     * @param {string} content - 내용
     */
    updateMemoContent(id, title, content) {
        const memo = this.memos.find(m => m.id === id);
        if (!memo) return;

        memo.title = title.trim();
        memo.content = content.trim();
        memo.updatedAt = new Date().toISOString();

        // 빈 메모는 삭제
        if (!memo.title && !memo.content) {
            this.deleteMemo(id);
            return;
        }

        this.saveMemos();
        this.render();
    }

    /**
     * 메모 삭제
     * @param {string} id - 메모 ID
     */
    deleteMemo(id) {
        const memo = this.memos.find(m => m.id === id);
        if (!memo) return;

        if (memo.title || memo.content) {
            if (!confirm('정말로 이 메모를 삭제하시겠습니까?')) {
                return;
            }
        }

        this.memos = this.memos.filter(m => m.id !== id);
        this.saveMemos();
        this.render();
    }

    /**
     * 메모 카드 생성
     * @param {object} memo - 메모 데이터
     * @returns {HTMLElement} 메모 카드 요소
     */
    createMemoCard(memo) {
        const card = document.createElement('div');
        card.className = 'memo-card';
        card.dataset.memoId = memo.id;
        card.style.borderLeft = `4px solid ${memo.color}`;

        const displayTitle = memo.title || '제목 없음';
        const displayContent = memo.content || '내용 없음';
        const timeAgo = this.getTimeAgo(memo.updatedAt);

        card.innerHTML = `
            <div class="memo-header">
                <h4 class="memo-title">${displayTitle}</h4>
                <div class="memo-actions">
                    <button class="memo-edit-btn" onclick="memoManager.editMemo('${memo.id}')" title="편집">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="memo-delete-btn" onclick="memoManager.deleteMemo('${memo.id}')" title="삭제">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="memo-content">${displayContent}</div>
            <div class="memo-meta">
                <span class="memo-time">${timeAgo}</span>
                <span class="memo-chars">${memo.content.length}자</span>
            </div>
        `;

        // 더블클릭으로 편집
        card.addEventListener('dblclick', () => {
            this.editMemo(memo.id);
        });

        return card;
    }

    /**
     * 메모 목록 렌더링
     */
    render() {
        if (!this.memoContainer) return;

        this.memoContainer.innerHTML = '';

        if (this.memos.length === 0) {
            this.memoContainer.innerHTML = `
                <div class="memo-empty-state">
                    <i class="fas fa-sticky-note"></i>
                    <h3>메모가 없습니다</h3>
                    <p>새 메모를 추가해보세요!</p>
                </div>
            `;
            return;
        }

        this.memos.forEach(memo => {
            const memoCard = this.createMemoCard(memo);
            this.memoContainer.appendChild(memoCard);
        });
    }

    /**
     * 시간 차이를 인간이 읽기 쉬운 형태로 변환
     * @param {string} timestamp - ISO 타임스탬프
     * @returns {string} 상대 시간
     */
    getTimeAgo(timestamp) {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        if (diffDays < 7) return `${diffDays}일 전`;

        return past.toLocaleDateString('ko-KR');
    }

    /**
     * 랜덤 색상 생성
     * @returns {string} 색상 코드
     */
    getRandomColor() {
        const colors = [
            '#667eea', '#764ba2', '#f093fb', '#f5576c',
            '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
            '#ffeaa7', '#fab1a0', '#fd79a8', '#e17055'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * 고유 ID 생성
     * @returns {string} 고유 ID
     */
    generateId() {
        return 'memo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 메모 검색
     * @param {string} query - 검색어
     * @returns {Array} 검색 결과
     */
    searchMemos(query) {
        if (!query.trim()) return this.memos;

        const lowerQuery = query.toLowerCase();
        return this.memos.filter(memo =>
            memo.title.toLowerCase().includes(lowerQuery) ||
            memo.content.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * 메모 통계 반환
     * @returns {object} 통계 데이터
     */
    getStats() {
        const totalMemos = this.memos.length;
        const totalCharacters = this.memos.reduce((sum, memo) => sum + memo.content.length, 0);
        const averageLength = totalMemos > 0 ? Math.round(totalCharacters / totalMemos) : 0;

        // 가장 긴 메모
        const longestMemo = this.memos.reduce((max, memo) =>
            memo.content.length > max.content.length ? memo : max,
            { content: '' }
        );

        // 최근 활동
        const recentMemos = this.memos.slice(0, 5);

        return {
            totalMemos,
            totalCharacters,
            averageLength,
            longestMemo,
            recentMemos
        };
    }

    /**
     * 메모 데이터 내보내기
     * @returns {object} 내보낼 데이터
     */
    exportMemos() {
        return {
            exportDate: new Date().toISOString(),
            memos: this.memos
        };
    }

    /**
     * 메모 데이터 가져오기
     * @param {object} data - 가져올 메모 데이터
     */
    importMemos(data) {
        if (!data.memos || !Array.isArray(data.memos)) {
            throw new Error('Invalid memo data format');
        }

        // 기존 메모와 병합
        data.memos.forEach(importedMemo => {
            // 중복 확인 (ID 기준)
            if (!this.memos.find(m => m.id === importedMemo.id)) {
                this.memos.push(importedMemo);
            }
        });

        // 날짜순 정렬
        this.memos.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        this.saveMemos();
        this.render();
    }

    /**
     * 메모 색상 변경
     * @param {string} id - 메모 ID
     * @param {string} color - 새 색상
     */
    changeMemoColor(id, color) {
        const memo = this.memos.find(m => m.id === id);
        if (memo) {
            memo.color = color;
            memo.updatedAt = new Date().toISOString();
            this.saveMemos();
            this.render();
        }
    }
}

// 전역 함수로 export
window.memoManager = null;