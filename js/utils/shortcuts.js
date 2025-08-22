/**
 * 키보드 단축키 관리 유틸리티
 */
export class ShortcutManager {
    constructor() {
        this.shortcuts = new Map();
        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.registerDefaultShortcuts();
    }

    /**
     * 단축키 등록
     * @param {string} key - 키 조합 (예: 'ctrl+k', 'cmd+shift+n')
     * @param {Function} callback - 실행할 함수
     * @param {string} description - 설명
     */
    register(key, callback, description = '') {
        const normalizedKey = this.normalizeKey(key);
        this.shortcuts.set(normalizedKey, { callback, description });
    }

    /**
     * 단축키 해제
     * @param {string} key - 키 조합
     */
    unregister(key) {
        const normalizedKey = this.normalizeKey(key);
        this.shortcuts.delete(normalizedKey);
    }

    /**
     * 키 정규화
     * @param {string} key - 키 조합
     * @returns {string} 정규화된 키
     */
    normalizeKey(key) {
        return key.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/command|cmd/g, 'meta')
            .replace(/option|opt/g, 'alt');
    }

    /**
     * 키다운 이벤트 처리
     * @param {KeyboardEvent} e - 키보드 이벤트
     */
    handleKeydown(e) {
        // 입력 필드에서는 단축키 무시
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            // 일부 전역 단축키만 허용
            if (!this.isGlobalShortcut(e)) return;
        }

        const keyCombo = this.getKeyCombo(e);
        const shortcut = this.shortcuts.get(keyCombo);

        if (shortcut) {
            e.preventDefault();
            e.stopPropagation();
            shortcut.callback(e);
        }
    }

    /**
     * 키 조합 생성
     * @param {KeyboardEvent} e - 키보드 이벤트
     * @returns {string} 키 조합
     */
    getKeyCombo(e) {
        const parts = [];

        if (e.ctrlKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        if (e.metaKey) parts.push('meta');

        // 특수 키 처리
        const key = e.key.toLowerCase();
        if (key === ' ') {
            parts.push('space');
        } else if (key === 'escape') {
            parts.push('escape');
        } else if (key.length === 1) {
            parts.push(key);
        } else {
            parts.push(key);
        }

        return parts.join('+');
    }

    /**
     * 전역 단축키 확인
     * @param {KeyboardEvent} e - 키보드 이벤트
     * @returns {boolean} 전역 단축키 여부
     */
    isGlobalShortcut(e) {
        const globalShortcuts = [
            'escape',
            'ctrl+k',
            'meta+k',
            'ctrl+,',
            'meta+,',
            'ctrl+r',
            'meta+r'
        ];

        const keyCombo = this.getKeyCombo(e);
        return globalShortcuts.includes(keyCombo);
    }

    /**
     * 기본 단축키 등록
     */
    registerDefaultShortcuts() {
        // 검색 포커스
        this.register('ctrl+k', () => {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }, '검색창 포커스');

        this.register('meta+k', () => {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }, '검색창 포커스 (Mac)');

        // 설정 열기
        this.register('ctrl+,', () => {
            if (window.personalHomeApp) {
                window.personalHomeApp.openSettings();
            }
        }, '설정 열기');

        this.register('meta+,', () => {
            if (window.personalHomeApp) {
                window.personalHomeApp.openSettings();
            }
        }, '설정 열기 (Mac)');

        // ESC: 모달 닫기
        this.register('escape', () => {
            if (window.personalHomeApp) {
                window.personalHomeApp.closeSettings();
            }
        }, '모달 닫기');

        // RC 파일 새로고침
        this.register('ctrl+r', (e) => {
            e.preventDefault();
            if (window.personalHomeApp) {
                window.personalHomeApp.loadRcFile();
            }
        }, 'RC 파일 새로고침');

        this.register('meta+r', (e) => {
            e.preventDefault();
            if (window.personalHomeApp) {
                window.personalHomeApp.loadRcFile();
            }
        }, 'RC 파일 새로고침 (Mac)');

        // 메모 저장
        this.register('ctrl+s', (e) => {
            const memoElement = document.getElementById('dailyMemo');
            if (document.activeElement === memoElement) {
                e.preventDefault();
                if (window.personalHomeApp?.memoManager) {
                    window.personalHomeApp.memoManager.saveMemo();
                }
            }
        }, '메모 저장');

        this.register('meta+s', (e) => {
            const memoElement = document.getElementById('dailyMemo');
            if (document.activeElement === memoElement) {
                e.preventDefault();
                if (window.personalHomeApp?.memoManager) {
                    window.personalHomeApp.memoManager.saveMemo();
                }
            }
        }, '메모 저장 (Mac)');

        // 새 링크 추가 모달 열기
        this.register('ctrl+n', () => {
            if (window.personalHomeApp) {
                window.personalHomeApp.openSettings();
                setTimeout(() => {
                    const linkNameInput = document.getElementById('linkName');
                    if (linkNameInput) {
                        linkNameInput.focus();
                    }
                }, 100);
            }
        }, '새 링크 추가');

        this.register('meta+n', () => {
            if (window.personalHomeApp) {
                window.personalHomeApp.openSettings();
                setTimeout(() => {
                    const linkNameInput = document.getElementById('linkName');
                    if (linkNameInput) {
                        linkNameInput.focus();
                    }
                }, 100);
            }
        }, '새 링크 추가 (Mac)');
    }

    /**
     * 등록된 단축키 목록 반환
     * @returns {Array} 단축키 목록
     */
    getShortcuts() {
        return Array.from(this.shortcuts.entries()).map(([key, { description }]) => ({
            key: key.replace(/meta/g, navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'),
            description
        }));
    }

    /**
     * 단축키 도움말 표시
     */
    showHelp() {
        const shortcuts = this.getShortcuts();
        const helpContent = shortcuts.map(({ key, description }) =>
            `<div class="shortcut-item"><kbd>${key}</kbd><span>${description}</span></div>`
        ).join('');

        // 도움말 모달 생성 및 표시
        const modal = document.createElement('div');
        modal.className = 'shortcut-help-modal';
        modal.innerHTML = `
            <div class="shortcut-help-content">
                <div class="shortcut-help-header">
                    <h3>키보드 단축키</h3>
                    <button class="close-help">×</button>
                </div>
                <div class="shortcut-help-body">
                    ${helpContent}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 모달 닫기 이벤트
        modal.querySelector('.close-help').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // ESC로 닫기
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }
}
