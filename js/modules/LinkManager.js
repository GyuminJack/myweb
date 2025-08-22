/**
 * 링크 관리 모듈
 * 링크 생성, 수정, 삭제, 정렬 등의 기능 담당
 */
export class LinkManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.links = [];
        this.currentFilter = 'all';
        this.draggedElement = null;
        this.container = null;
    }

    /**
     * 초기화
     * @param {string} containerId - 링크 컨테이너 ID
     */
    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error('Link container not found');
        }

        this.loadLinks();
        this.setupDragAndDrop();
    }

    /**
     * 링크 로드
     */
    loadLinks() {
        this.links = this.storage.load('links', []);
    }

    /**
     * 링크 저장
     */
    saveLinks() {
        this.storage.save('links', this.links);
    }

    /**
     * 현재 링크 목록을 주어진 목록으로 교체 (URL 기준 중복 제거)
     * @param {Array<{name:string,url:string,tags?:Array<string>,description?:string}>} newLinks
     */
    replaceLinks(newLinks) {
        const seen = new Set();
        const normalized = [];

        (newLinks || []).forEach((item) => {
            if (!item || !item.url || !item.name) return;
            const urlKey = String(item.url).trim().toLowerCase();
            if (!urlKey.startsWith('http')) return;
            if (seen.has(urlKey)) return;
            seen.add(urlKey);

            normalized.push({
                id: this.generateId(),
                name: item.name,
                url: item.url,
                tags: Array.isArray(item.tags) ? item.tags : [],
                order: normalized.length,
                favicon: item.favicon || null,
                description: item.description || '',
                createdAt: new Date().toISOString(),
                clickCount: 0,
                lastClicked: null
            });
        });

        this.links = normalized;
        this.saveLinks();
        return this.links.length;
    }

    /**
     * 링크 추가
     * @param {object} linkData - 링크 데이터
     */
    addLink(linkData) {
        const link = {
            id: this.generateId(),
            name: linkData.name,
            url: linkData.url,
            tags: Array.isArray(linkData.tags) ? linkData.tags : [],
            order: this.links.length,
            favicon: linkData.favicon || null,
            description: linkData.description || '',
            createdAt: new Date().toISOString(),
            clickCount: 0,
            lastClicked: null
        };

        this.links.push(link);
        this.saveLinks();
        return link;
    }

    /**
     * 링크 수정
     * @param {string} id - 링크 ID
     * @param {object} updates - 업데이트할 데이터
     */
    updateLink(id, updates) {
        const linkIndex = this.links.findIndex(link => link.id === id);
        if (linkIndex === -1) return false;

        this.links[linkIndex] = { ...this.links[linkIndex], ...updates };
        this.saveLinks();
        return true;
    }

    /**
     * 링크 삭제
     * @param {string} id - 링크 ID
     */
    deleteLink(id) {
        this.links = this.links.filter(link => link.id !== id);
        this.saveLinks();
        return true;
    }

    /**
     * 모든 링크 삭제
     * @returns {number} 삭제된 개수
     */
    deleteAll() {
        const removed = this.links.length;
        this.links = [];
        this.saveLinks();
        return removed;
    }

    /**
     * 링크 클릭 추적
     * @param {string} id - 링크 ID
     */
    trackClick(id) {
        const link = this.links.find(l => l.id === id);
        if (link) {
            link.clickCount = (link.clickCount || 0) + 1;
            link.lastClicked = new Date().toISOString();
            this.saveLinks();
        }
    }

    /**
     * 필터링된 링크 반환
     * @param {string} filter - 필터 태그
     * @returns {Array} 필터링된 링크 배열
     */
    getFilteredLinks(filter = this.currentFilter) {
        let filteredLinks = [...this.links];

        if (filter !== 'all') {
            filteredLinks = filteredLinks.filter(link =>
                link.tags.includes(filter)
            );
        }

        return filteredLinks.sort((a, b) => a.order - b.order);
    }

    /**
     * 모든 태그 반환 (계층적 정렬 포함)
     * @returns {Array} 태그 배열
     */
    getAllTags() {
        const tagSet = new Set();
        this.links.forEach(link => {
            link.tags.forEach(tag => tagSet.add(tag));
        });

        const allTags = Array.from(tagSet);

        // 계층적 태그와 일반 태그 분리
        const hierarchicalTags = allTags.filter(tag => tag.includes(' > '));
        const simpleTags = allTags.filter(tag => !tag.includes(' > '));

        // 계층적 태그 정렬
        hierarchicalTags.sort((a, b) => {
            const aDepth = a.split(' > ').length;
            const bDepth = b.split(' > ').length;
            if (aDepth !== bDepth) return aDepth - bDepth;
            return a.localeCompare(b);
        });

        // 일반 태그 정렬
        simpleTags.sort();

        return ['all', ...simpleTags, ...hierarchicalTags];
    }

    /**
     * 링크 순서 변경
     * @param {string} linkId - 이동할 링크 ID
     * @param {number} newIndex - 새로운 인덱스
     */
    reorderLink(linkId, newIndex) {
        const linkIndex = this.links.findIndex(link => link.id === linkId);
        if (linkIndex === -1) return false;

        const [movedLink] = this.links.splice(linkIndex, 1);
        this.links.splice(newIndex, 0, movedLink);

        // 순서 재정렬
        this.links.forEach((link, index) => {
            link.order = index;
        });

        this.saveLinks();
        return true;
    }

    /**
     * 링크 카드 생성
     * @param {object} link - 링크 데이터
     * @returns {HTMLElement} 링크 카드 요소
     */
    createLinkCard(link) {
        const card = document.createElement('div');
        card.className = 'link-card';
        card.draggable = true;
        card.dataset.id = link.id;

        // 파비콘 URL 생성
        const faviconUrl = link.favicon || `https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=32`;

                const tagsHtml = link.tags.map(tag => {
            const isHierarchical = tag.includes(' > ');
            return `<span class="link-tag ${isHierarchical ? 'hierarchical' : ''}">${tag}</span>`;
        }).join('');

        const statsHtml = link.clickCount > 0 ?
            `<div class="link-stats">
                <span class="click-count">${link.clickCount}회 방문</span>
                ${link.lastClicked ? `<span class="last-clicked">최근: ${new Date(link.lastClicked).toLocaleDateString()}</span>` : ''}
            </div>` : '';

        card.innerHTML = `
            <div class="link-header">
                <img src="${faviconUrl}" alt="${link.name}" class="link-favicon" onerror="this.style.display='none'">
                <h4>${link.name}</h4>
                <div class="link-actions">
                    <button class="card-edit-btn" onclick="editLink('${link.id}')" title="수정">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="card-delete-btn" onclick="deleteLink('${link.id}')" title="삭제">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <a href="${link.url}" target="_blank" rel="noopener noreferrer" onclick="trackClick('${link.id}')">${link.url}</a>
            ${link.description ? `<p class="link-description">${link.description}</p>` : ''}
            <div class="link-tags">${tagsHtml}</div>
            ${statsHtml}
        `;

        return card;
    }

    /**
     * 링크 편집 UI 열기 (카드 내부에 인라인 폼)
     * @param {string} id
     */
    openEdit(id) {
        const link = this.links.find(l => l.id === id);
        if (!link) return;
        const card = this.container.querySelector(`.link-card[data-id="${id}"]`);
        if (!card) return;
        if (!card.dataset.originalHtml) {
            card.dataset.originalHtml = card.innerHTML;
        }

        const tagsString = Array.isArray(link.tags) ? link.tags.join(', ') : '';
        const faviconUrl = link.favicon || `https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=32`;

        card.innerHTML = `
            <div class="link-edit-form">
                <div class="form-row">
                    <img src="${faviconUrl}" class="link-favicon" onerror="this.style.display='none'">
                    <input type="text" class="edit-name" placeholder="이름" value="${link.name || ''}">
                </div>
                <div class="form-row">
                    <input type="text" class="edit-url" placeholder="URL" value="${link.url || ''}">
                </div>
                <div class="form-row">
                    <input type="text" class="edit-tags" placeholder="태그 (쉼표로 구분)" value="${tagsString}">
                </div>
                <div class="form-row">
                    <textarea class="edit-description" placeholder="설명">${link.description || ''}</textarea>
                </div>
                <div class="form-actions">
                    <button class="save-btn" onclick="saveLinkEdit('${id}')"><i class="fas fa-check"></i> 저장</button>
                    <button class="cancel-btn" onclick="cancelLinkEdit('${id}')"><i class="fas fa-times"></i> 취소</button>
                </div>
            </div>
        `;
    }

    /**
     * 편집 취소: 원래 카드 복원
     */
    cancelEdit(id) {
        const card = this.container.querySelector(`.link-card[data-id="${id}"]`);
        if (card && card.dataset.originalHtml) {
            card.innerHTML = card.dataset.originalHtml;
            delete card.dataset.originalHtml;
        } else {
            // 폴백: 전체 리렌더
            this.render();
        }
    }

    /**
     * 편집 내용 적용
     * @param {string} id
     * @param {{name:string,url:string,tags:string,description:string}} fields
     */
    applyEdit(id, fields) {
        const updates = {
            name: (fields.name || '').trim(),
            url: (fields.url || '').trim(),
            tags: (fields.tags || '')
                .split(',')
                .map(t => t.trim())
                .filter(Boolean),
            description: (fields.description || '').trim()
        };
        this.updateLink(id, updates);
        return true;
    }

    /**
     * 링크 렌더링
     */
    render() {
        if (!this.container) return;

        this.container.innerHTML = '';
        const filteredLinks = this.getFilteredLinks();

        if (filteredLinks.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-link"></i>
                    <h3>링크가 없습니다</h3>
                    <p>설정에서 링크를 추가해보세요!</p>
                </div>
            `;
            return;
        }

        filteredLinks.forEach(link => {
            const linkCard = this.createLinkCard(link);
            this.container.appendChild(linkCard);
        });

        this.setupDragAndDrop();
    }

    /**
     * 드래그 앤 드롭 설정
     */
    setupDragAndDrop() {
        const cards = this.container.querySelectorAll('.link-card');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => this.handleDragStart(e));
            card.addEventListener('dragend', (e) => this.handleDragEnd(e));
        });

        this.container.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.container.addEventListener('drop', (e) => this.handleDrop(e));
        this.container.addEventListener('dragenter', (e) => this.handleDragEnter(e));
        this.container.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    }

    /**
     * 드래그 시작 핸들러
     */
    handleDragStart(e) {
        this.draggedElement = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
    }

    /**
     * 드래그 종료 핸들러
     */
    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedElement = null;
    }

    /**
     * 드래그 오버 핸들러
     */
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    /**
     * 드래그 진입 핸들러
     */
    handleDragEnter(e) {
        e.preventDefault();
        if (e.target.classList.contains('links-container')) {
            e.target.classList.add('drag-over');
        }
    }

    /**
     * 드래그 벗어남 핸들러
     */
    handleDragLeave(e) {
        if (e.target.classList.contains('links-container')) {
            e.target.classList.remove('drag-over');
        }
    }

    /**
     * 드롭 핸들러
     */
    handleDrop(e) {
        e.preventDefault();
        e.target.classList.remove('drag-over');

        if (this.draggedElement && e.target.classList.contains('links-container')) {
            const cards = Array.from(this.container.querySelectorAll('.link-card'));
            const draggedIndex = cards.findIndex(card =>
                card.dataset.id === this.draggedElement.dataset.id
            );

            // 드롭 위치 계산
            const dropY = e.clientY;
            let dropIndex = 0;

            for (let i = 0; i < cards.length; i++) {
                const rect = cards[i].getBoundingClientRect();
                if (dropY < rect.top + rect.height / 2) {
                    dropIndex = i;
                    break;
                }
                dropIndex = i + 1;
            }

            if (draggedIndex !== dropIndex) {
                this.reorderLink(this.draggedElement.dataset.id, dropIndex);
                this.render();
            }
        }
    }

    /**
     * 필터 설정
     * @param {string} filter - 필터 태그
     */
    setFilter(filter) {
        this.currentFilter = filter;
        this.render();
    }

    /**
     * RC 데이터 파싱 및 추가
     * @param {string} rcData - RC 파일 데이터
     */
    parseAndAddRcData(rcData) {
        const lines = rcData.trim().split('\n');
        const newLinks = [];

        lines.forEach(line => {
            if (line.trim() && !line.startsWith('#')) {
                const parts = line.split(',').map(part => part.trim());
                if (parts.length >= 2) {
                    const [name, url, ...tagParts] = parts;
                    const tags = tagParts.length > 0 ?
                        tagParts.join(',').split(',').map(tag => tag.trim()).filter(Boolean) : [];

                    newLinks.push({
                        name,
                        url,
                        tags
                    });
                }
            }
        });

        // 파일 로드 시 기존 목록을 교체하여 중복 누적 방지
        this.replaceLinks(newLinks);
        return newLinks.length;
    }

    /**
     * 고유 ID 생성
     * @returns {string} 고유 ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 링크 검색
     * @param {string} query - 검색어
     * @returns {Array} 검색 결과
     */
    searchLinks(query) {
        if (!query.trim()) return this.links;

        const lowerQuery = query.toLowerCase();
        return this.links.filter(link =>
            link.name.toLowerCase().includes(lowerQuery) ||
            link.url.toLowerCase().includes(lowerQuery) ||
            link.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
            (link.description && link.description.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * 링크 통계 반환
     * @returns {object} 통계 데이터
     */
    getStats() {
        const totalLinks = this.links.length;
        const totalClicks = this.links.reduce((sum, link) => sum + (link.clickCount || 0), 0);
        const mostClicked = this.links.reduce((max, link) =>
            (link.clickCount || 0) > (max.clickCount || 0) ? link : max, this.links[0]);
        const tagStats = {};

        this.links.forEach(link => {
            link.tags.forEach(tag => {
                tagStats[tag] = (tagStats[tag] || 0) + 1;
            });
        });

        return {
            totalLinks,
            totalClicks,
            mostClicked,
            tagStats,
            averageClicksPerLink: totalLinks > 0 ? (totalClicks / totalLinks).toFixed(1) : 0
        };
    }
}
