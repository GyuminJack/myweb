/**
 * 북마크 가져오기 모듈
 * 크롬, Firefox 등의 북마크를 파싱하고 태그 시스템에 맞게 변환
 */
export class BookmarkImporter {
    constructor(linkManager, options = {}) {
        this.linkManager = linkManager;
        this.importedBookmarks = [];
        // 새 옵션: 특수 폴더 포함 여부 (기본: true)
        this.options = { includeSpecialFolders: true, ...options };
    }

    /**
     * 파일 선택기를 통한 북마크 import
     */
    async importFromFile() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.html,.json';
            input.multiple = false;

            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    reject(new Error('파일이 선택되지 않았습니다.'));
                    return;
                }

                try {
                    console.log('북마크 파일 읽기 시작:', file.name);
                    const content = await this.readFile(file);
                    console.log('파일 내용 길이:', content.length);

                    let bookmarks = [];

                    if (file.name.endsWith('.html')) {
                        console.log('HTML 북마크 파일 파싱 시작');
                        bookmarks = this.parseHtmlBookmarks(content);
                        console.log('파싱된 원본 북마크 수:', bookmarks.length);
                    } else if (file.name.endsWith('.json')) {
                        console.log('JSON 북마크 파일 파싱 시작');
                        bookmarks = this.parseJsonBookmarks(content);
                        console.log('파싱된 원본 북마크 수:', bookmarks.length);
                    } else {
                        throw new Error('지원하지 않는 파일 형식입니다.');
                    }

                    if (bookmarks.length === 0) {
                        throw new Error('파일에서 유효한 북마크를 찾을 수 없습니다.');
                    }

                    console.log('북마크 처리 시작');
                    const processedBookmarks = this.processBookmarks(bookmarks);
                    console.log('처리된 북마크 수:', processedBookmarks.length);

                    const addedCount = await this.addBookmarksToLinkManager(processedBookmarks);
                    console.log('실제 추가된 북마크 수:', addedCount);

                    resolve({
                        total: processedBookmarks.length,
                        added: addedCount,
                        bookmarks: processedBookmarks
                    });
                } catch (error) {
                    console.error('북마크 가져오기 실패:', error);
                    reject(error);
                }
            });

            input.click();
        });
    }

    /**
     * 파일 읽기
     * @param {File} file - 읽을 파일
     * @returns {Promise<string>} 파일 내용
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('파일 읽기에 실패했습니다.'));
            reader.readAsText(file, 'utf-8');
        });
    }

    /**
     * HTML 북마크 파일 파싱 (Netscape/Chrome/Firefox 내보내기)
     * @param {string} htmlContent
     * @returns {Array} bookmarks
     */
    parseHtmlBookmarks(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const bookmarks = [];

        // 루트 DL을 찾는다 (NETSCAPE export는 최상단에 DL 1개가 온다)
        const rootDL = doc.querySelector('DL');
        if (!rootDL) return bookmarks;

        const isSpecialFolder = (name) => {
            if (this.options.includeSpecialFolders) return false;
            const specials = [
                '북마크바', 'Bookmarks Bar', 'Bookmarks Toolbar',
                '기타 북마크', 'Other Bookmarks', 'Other',
                'Bookmarks', '북마크',
                'Mobile Bookmarks', '모바일 북마크'
            ];
            return specials.includes(name);
        };

        // DT 바로 다음 형제 DL을 찾는다 (Netscape 포맷의 표준 구조)
        const nextSiblingDL = (dtEl) => {
            let sib = dtEl.nextElementSibling;
            if (sib && sib.tagName === 'DL') return sib;
            // 혹시 <DT><DL> 중첩처럼 들어온 변형도 방어
            const innerDL = dtEl.querySelector(':scope > DL');
            if (innerDL) return innerDL;
            return null;
        };

        // DT 바로 다음 형제 DD(설명)를 찾는다
        const nextSiblingDD = (dtEl) => {
            let sib = dtEl.nextElementSibling;
            while (sib && sib.tagName === 'DL') {
                sib = sib.nextElementSibling;
            }
            return sib && sib.tagName === 'DD' ? sib : null;
        };

        const parseDL = (dlEl, parentPath = []) => {
            // DL 안에서 DT만 순회
            const dts = Array.from(dlEl.children).filter(ch => ch.tagName === 'DT');
            for (const dt of dts) {
                const h3 = dt.querySelector(':scope > H3');
                const a = dt.querySelector(':scope > A[href]');

                if (h3) {
                    const folderName = (h3.textContent || '').trim();
                    const addDate = h3.getAttribute('ADD_DATE') || null;
                    const lastModified = h3.getAttribute('LAST_MODIFIED') || null;
                    const isToolbar = h3.hasAttribute('PERSONAL_TOOLBAR_FOLDER');

                    // 특수 폴더 제외 여부 옵션
                    const newPath = isSpecialFolder(folderName)
                        ? parentPath
                        : [...parentPath, folderName];

                    // 폴더 설명(DD)이 바로 뒤에 붙을 수 있음
                    const dd = nextSiblingDD(dt);
                    const folderDesc = dd ? (dd.textContent || '').trim() : '';

                    // 필요하다면 폴더 메타를 어딘가에 기록할 수도 있지만,
                    // 현재는 경로만 사용

                    const childDL = nextSiblingDL(dt);
                    if (childDL) {
                        parseDL(childDL, newPath);
                    }
                } else if (a) {
                    const href = a.getAttribute('HREF');
                    const title = (a.textContent || '').trim();
                    if (!href || !title) continue;

                    // DD(설명)
                    const dd = nextSiblingDD(dt);
                    const desc = dd ? (dd.textContent || '').trim() : '';

                    // http/https만 수집 (data:, file: 등은 스킵)
                    if (!/^https?:\/\//i.test(href)) continue;

                    bookmarks.push({
                        name: title,
                        url: href,
                        tags: [...parentPath],
                        addDate: a.getAttribute('ADD_DATE') || null,
                        lastModified: a.getAttribute('LAST_MODIFIED') || null,
                        icon: a.getAttribute('ICON') || null,
                        description: desc
                    });
                }
            }
        };

        parseDL(rootDL, []);
        return bookmarks;
    }
    /**
     * 다음 DL 요소 찾기 헬퍼
     * @param {Array} children - 자식 요소들
     * @param {number} currentIndex - 현재 인덱스
     * @returns {Element|null} 다음 DL 요소
     */
    findNextDL(children, currentIndex) {
        // 바로 다음 요소가 DL인지 확인
        if (currentIndex + 1 < children.length) {
            const nextElement = children[currentIndex + 1];
            if (nextElement.tagName === 'DL') {
                return nextElement;
            }
        }
        return null;
    }

    /**
     * 특수 폴더 확인 (북마크바, 기타 북마크 등)
     * @param {string} folderName - 폴더명
     * @returns {boolean} 특수 폴더 여부
     */
    isSpecialFolder(folderName) {
        const specialFolders = [
            '북마크바', 'Bookmarks Bar', 'Bookmarks Toolbar',
            '기타 북마크', 'Other Bookmarks', 'Other',
            'Bookmarks', '북마크',
            'Mobile Bookmarks', '모바일 북마크'
        ];
        return specialFolders.includes(folderName);
    }

    /**
     * JSON 북마크 파일 파싱 (Chrome JSON 내보내기)
     * @param {string} jsonContent - JSON 내용
     * @returns {Array} 파싱된 북마크
     */
    parseJsonBookmarks(jsonContent) {
        const bookmarks = [];

        try {
            const data = JSON.parse(jsonContent);

            // Chrome JSON 형식 파싱
            if (data.roots) {
                const parseNode = (node, parentPath = []) => {
                    if (node.type === 'url') {
                        bookmarks.push({
                            name: node.name,
                            url: node.url,
                            tags: [...parentPath],
                            addDate: node.date_added,
                            description: node.meta_info?.description || ''
                        });
                    } else if (node.type === 'folder' && node.children) {
                        const newPath = [...parentPath, node.name];
                        node.children.forEach(child => {
                            parseNode(child, newPath);
                        });
                    }
                };

                // 북마크바, 기타 북마크 등 파싱
                Object.values(data.roots).forEach(root => {
                    if (root.children) {
                        root.children.forEach(child => {
                            parseNode(child, root.name ? [root.name] : []);
                        });
                    }
                });
            }
        } catch (error) {
            throw new Error('유효하지 않은 JSON 형식입니다.');
        }

        return bookmarks;
    }

    /**
     * 북마크 처리 및 정규화
     * @param {Array} rawBookmarks - 원본 북마크
     * @returns {Array} 처리된 북마크
     */
    processBookmarks(rawBookmarks) {
        const processed = rawBookmarks
            .filter(bookmark => bookmark.url && bookmark.name)
            .map(bookmark => ({
                name: this.sanitizeName(bookmark.name),
                url: this.normalizeUrl(bookmark.url),
                tags: this.processTags(bookmark.tags),
                description: bookmark.description || '',
                source: 'import',
                importedAt: new Date().toISOString()
            }));

        // 중복 제거 (URL 기준)
        const seen = new Set();
        return processed.filter(bookmark => {
            const key = bookmark.url.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * 이름 정리
     * @param {string} name - 원본 이름
     * @returns {string} 정리된 이름
     */
    sanitizeName(name) {
        return name
            .replace(/[\r\n\t]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 100); // 길이 제한
    }

    /**
     * URL 정규화
     * @param {string} url - 원본 URL
     * @returns {string} 정규화된 URL
     */
    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.href;
        } catch {
            // 유효하지 않은 URL의 경우 https 추가 시도
            try {
                return new URL(`https://${url}`).href;
            } catch {
                return url; // 그래도 안 되면 원본 반환
            }
        }
    }

    /**
     * 태그 처리 (계층적 구조 지원)
     * @param {Array} rawTags - 원본 태그 (폴더 경로)
     * @returns {Array} 처리된 태그
     */
    processTags(rawTags) {
        if (!Array.isArray(rawTags) || rawTags.length === 0) {
            return ['미분류'];
        }

        const processedTags = [];
        const specialTagSet = new Set([
            'Bookmarks', '북마크',
            '북마크바', 'Bookmarks Bar', 'Bookmarks Toolbar',
            '기타 북마크', 'Other Bookmarks', 'Other',
            'Mobile Bookmarks', '모바일 북마크'
        ]);

        // 계층적 태그 생성
        for (let i = 0; i < rawTags.length; i++) {
            const tagPart = rawTags[i].trim();
            if (tagPart && !specialTagSet.has(tagPart)) {
                // 단일 태그
                processedTags.push(tagPart);

                // 계층적 태그 (부모 > 자식)
                if (i > 0) {
                    const hierarchicalTag = rawTags.slice(0, i + 1).join(' > ');
                    if (hierarchicalTag !== tagPart) {
                        // 계층 경로 내에서도 특수 폴더가 루트에 오는 경우 제거
                        const startsWithSpecial = specialTagSet.has(rawTags[0]?.trim());
                        const cleanedHierarchicalTag = startsWithSpecial
                            ? rawTags.slice(1, i + 1).join(' > ')
                            : hierarchicalTag;
                        if (cleanedHierarchicalTag) {
                            processedTags.push(cleanedHierarchicalTag);
                        }
                    }
                }
            }
        }

        return processedTags.length > 0 ? [...new Set(processedTags)] : ['미분류'];
    }

    /**
     * LinkManager에 북마크 추가
     * @param {Array} bookmarks - 처리된 북마크
     * @returns {Promise<number>} 추가된 북마크 수
     */
    async addBookmarksToLinkManager(bookmarks) {
        let addedCount = 0;
        const existingUrls = new Set(
            this.linkManager.links.map(link => link.url.toLowerCase())
        );

        for (const bookmark of bookmarks) {
            // 중복 체크
            if (!existingUrls.has(bookmark.url.toLowerCase())) {
                try {
                    this.linkManager.addLink({
                        name: bookmark.name,
                        url: bookmark.url,
                        tags: bookmark.tags,
                        description: bookmark.description
                    });
                    addedCount++;
                    existingUrls.add(bookmark.url.toLowerCase());
                } catch (error) {
                    console.warn('북마크 추가 실패:', bookmark.name, error);
                }
            }
        }

        return addedCount;
    }

    /**
     * 서버모드에서 RC 파일에 북마크를 append
     */
    async appendToRcFile(bookmarks) {
        try {
            const response = await fetch('/api/rc/append', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ links: bookmarks })
            });
            return await response.json();
        } catch (e) {
            console.warn('RC 파일 업데이트 실패:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * 북마크 통계 생성
     * @param {Array} bookmarks - 북마크 목록
     * @returns {object} 통계 정보
     */
    generateStats(bookmarks) {
        const stats = {
            total: bookmarks.length,
            byTag: {},
            byDomain: {},
            hierarchicalTags: new Set()
        };

        bookmarks.forEach(bookmark => {
            // 태그별 통계
            bookmark.tags.forEach(tag => {
                stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;

                // 계층적 태그 식별
                if (tag.includes(' > ')) {
                    stats.hierarchicalTags.add(tag);
                }
            });

            // 도메인별 통계
            try {
                const domain = new URL(bookmark.url).hostname;
                stats.byDomain[domain] = (stats.byDomain[domain] || 0) + 1;
            } catch {
                // URL 파싱 실패 시 무시
            }
        });

        stats.hierarchicalTags = Array.from(stats.hierarchicalTags);

        return stats;
    }

    /**
     * 계층적 태그 구조 생성
     * @param {Array} tags - 태그 목록
     * @returns {object} 트리 구조
     */
    buildTagTree(tags) {
        const tree = {};

        tags.forEach(tag => {
            if (tag.includes(' > ')) {
                const parts = tag.split(' > ');
                let current = tree;

                parts.forEach((part, index) => {
                    if (!current[part]) {
                        current[part] = {
                            name: part,
                            fullPath: parts.slice(0, index + 1).join(' > '),
                            children: {},
                            count: 0
                        };
                    }
                    current = current[part].children;
                });
            } else {
                if (!tree[tag]) {
                    tree[tag] = {
                        name: tag,
                        fullPath: tag,
                        children: {},
                        count: 0
                    };
                }
            }
        });

        return tree;
    }

    /**
     * 서버를 통한 시스템 북마크 가져오기
     * @returns {Promise<object>} 가져오기 결과
     */
    async importFromSystem() {
        try {
            const response = await fetch('/api/bookmarks');
            const data = await response.json();

            if (data.success && data.bookmarks.length > 0) {
                const processedBookmarks = this.processBookmarks(data.bookmarks);
                const addedCount = await this.addBookmarksToLinkManager(processedBookmarks);

                return {
                    total: processedBookmarks.length,
                    added: addedCount,
                    bookmarks: processedBookmarks
                };
            } else {
                throw new Error('시스템에서 북마크를 찾을 수 없습니다.');
            }
        } catch (error) {
            throw new Error(`시스템 북마크 가져오기 실패: ${error.message}`);
        }
    }

    /**
     * 북마크 미리보기 생성
     * @param {Array} bookmarks - 북마크 목록
     * @returns {string} HTML 미리보기
     */
    generatePreview(bookmarks) {
        const stats = this.generateStats(bookmarks);
        const tagTree = this.buildTagTree(Object.keys(stats.byTag));

        let html = `
            <div class="bookmark-preview">
                <div class="preview-stats">
                    <h4>가져올 북마크: ${stats.total}개</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">총 태그</span>
                            <span class="stat-value">${Object.keys(stats.byTag).length}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">계층 태그</span>
                            <span class="stat-value">${stats.hierarchicalTags.length}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">도메인</span>
                            <span class="stat-value">${Object.keys(stats.byDomain).length}</span>
                        </div>
                    </div>
                </div>

                <div class="preview-tags">
                    <h5>주요 태그:</h5>
                    <div class="tag-list">
        `;

        // 상위 태그들 표시
        const topTags = Object.entries(stats.byTag)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        topTags.forEach(([tag, count]) => {
            const isHierarchical = tag.includes(' > ');
            html += `
                <span class="preview-tag ${isHierarchical ? 'hierarchical' : ''}">
                    ${tag} (${count})
                </span>
            `;
        });

        html += `
                    </div>
                </div>

                <div class="preview-samples">
                    <h5>미리보기:</h5>
                    <div class="sample-bookmarks">
        `;

        // 샘플 북마크 표시
        bookmarks.slice(0, 5).forEach(bookmark => {
            html += `
                <div class="sample-bookmark">
                    <strong>${bookmark.name}</strong><br>
                    <small>${bookmark.url}</small><br>
                    <div class="sample-tags">
                        ${bookmark.tags.map(tag => `<span class="sample-tag">${tag}</span>`).join('')}
                    </div>
                </div>
            `;
        });

        if (bookmarks.length > 5) {
            html += `<div class="more-indicator">... 그 외 ${bookmarks.length - 5}개</div>`;
        }

        html += `
                    </div>
                </div>
            </div>
        `;

        return html;
    }
}

// 전역 함수 export
window.BookmarkImporter = BookmarkImporter;
