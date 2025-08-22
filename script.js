class PersonalHome {
    constructor() {
        this.links = [];
        this.currentFilter = 'all';
        this.draggedElement = null;
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.updateTime();
        this.renderLinks();
        this.renderTagFilters();

        // 1초마다 시간 업데이트
        setInterval(() => this.updateTime(), 1000);
    }

    setupEventListeners() {
        // 메모 저장
        document.getElementById('saveMemo').addEventListener('click', () => this.saveMemo());

        // 설정 모달
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('closeModal').addEventListener('click', () => this.closeSettings());
        document.getElementById('loadRcFile').addEventListener('click', () => this.loadRcFile());
        document.getElementById('addLink').addEventListener('click', () => this.addLink());

        // 모달 외부 클릭 시 닫기
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeSettings();
            }
        });

        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSettings();
            }
        });
    }

    updateTime() {
        const now = new Date();
        const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // KST = UTC + 9

        const timeString = kstTime.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        const dateString = kstTime.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });

        document.getElementById('currentTime').textContent = timeString;
        document.getElementById('currentDate').textContent = dateString;
    }

    loadData() {
        // 로컬 스토리지에서 데이터 로드
        const savedLinks = localStorage.getItem('personalHomeLinks');
        const savedMemo = localStorage.getItem('personalHomeMemo');

        if (savedLinks) {
            this.links = JSON.parse(savedLinks);
        }

        if (savedMemo) {
            document.getElementById('dailyMemo').value = savedMemo;
        }
    }

    saveData() {
        // 로컬 스토리지에 데이터 저장
        localStorage.setItem('personalHomeLinks', JSON.stringify(this.links));
    }

    saveMemo() {
        const memo = document.getElementById('dailyMemo').value;
        localStorage.setItem('personalHomeMemo', memo);

        // 저장 완료 피드백
        const saveBtn = document.getElementById('saveMemo');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '저장됨!';
        saveBtn.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';

        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }, 2000);
    }

    openSettings() {
        document.getElementById('settingsModal').style.display = 'block';
    }

    closeSettings() {
        document.getElementById('settingsModal').style.display = 'none';
    }

    async loadRcFile() {
        const filePath = document.getElementById('rcFilePath').value;

        try {
            // 실제 파일 시스템 접근은 불가능하므로 예시 데이터로 대체
            // 실제 구현에서는 서버 사이드에서 파일을 읽어야 합니다
            const sampleData = this.getSampleRcData();
            this.parseRcData(sampleData);

            alert('RC 파일이 로드되었습니다! (예시 데이터)');
            this.closeSettings();
        } catch (error) {
            alert('RC 파일 로드 중 오류가 발생했습니다: ' + error.message);
        }
    }

    getSampleRcData() {
        // 예시 RC 파일 데이터
        return `Google 검색,https://google.com,검색
GitHub,https://github.com,개발
Stack Overflow,https://stackoverflow.com,개발
YouTube,https://youtube.com,엔터테인먼트
Netflix,https://netflix.com,엔터테인먼트
Notion,https://notion.so,생산성
Figma,https://figma.com,디자인
ChatGPT,https://chat.openai.com,AI
Reddit,https://reddit.com,커뮤니티
Wikipedia,https://wikipedia.org,학습`;
    }

    parseRcData(data) {
        const lines = data.trim().split('\n');
        const newLinks = [];

        lines.forEach(line => {
            const [name, url, tags] = line.split(',').map(item => item.trim());
            if (name && url) {
                newLinks.push({
                    id: Date.now() + Math.random(),
                    name: name,
                    url: url,
                    tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
                    order: this.links.length + newLinks.length
                });
            }
        });

        this.links = [...this.links, ...newLinks];
        this.saveData();
        this.renderLinks();
        this.renderTagFilters();
    }

    addLink() {
        const name = document.getElementById('linkName').value.trim();
        const url = document.getElementById('linkUrl').value.trim();
        const tags = document.getElementById('linkTags').value.trim();

        if (!name || !url) {
            alert('이름과 URL을 모두 입력해주세요.');
            return;
        }

        const newLink = {
            id: Date.now() + Math.random(),
            name: name,
            url: url,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            order: this.links.length
        };

        this.links.push(newLink);
        this.saveData();
        this.renderLinks();
        this.renderTagFilters();

        // 입력 필드 초기화
        document.getElementById('linkName').value = '';
        document.getElementById('linkUrl').value = '';
        document.getElementById('linkTags').value = '';

        alert('링크가 추가되었습니다!');
    }

    renderLinks() {
        const container = document.getElementById('linksContainer');
        container.innerHTML = '';

        const filteredLinks = this.getFilteredLinks();

        filteredLinks.forEach(link => {
            const linkCard = this.createLinkCard(link);
            container.appendChild(linkCard);
        });

        this.setupDragAndDrop();
    }

    getFilteredLinks() {
        if (this.currentFilter === 'all') {
            return [...this.links].sort((a, b) => a.order - b.order);
        }

        return this.links
            .filter(link => link.tags.includes(this.currentFilter))
            .sort((a, b) => a.order - b.order);
    }

    createLinkCard(link) {
        const card = document.createElement('div');
        card.className = 'link-card';
        card.draggable = true;
        card.dataset.id = link.id;

        const tagsHtml = link.tags.map(tag =>
            `<span class="link-tag">${tag}</span>`
        ).join('');

        card.innerHTML = `
            <button class="delete-btn" onclick="personalHome.deleteLink('${link.id}')">
                <i class="fas fa-times"></i>
            </button>
            <h4>${link.name}</h4>
            <a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.url}</a>
            <div class="link-tags">${tagsHtml}</div>
        `;

        return card;
    }

    deleteLink(id) {
        if (confirm('정말로 이 링크를 삭제하시겠습니까?')) {
            this.links = this.links.filter(link => link.id !== id);
            this.saveData();
            this.renderLinks();
            this.renderTagFilters();
        }
    }

    renderTagFilters() {
        const container = document.getElementById('tagFilters');
        const allTags = ['all'];

        // 모든 링크에서 태그 수집
        this.links.forEach(link => {
            link.tags.forEach(tag => {
                if (!allTags.includes(tag)) {
                    allTags.push(tag);
                }
            });
        });

        container.innerHTML = allTags.map(tag => `
            <button class="tag-filter ${tag === this.currentFilter ? 'active' : ''}"
                    data-tag="${tag}">
                ${tag === 'all' ? '전체' : tag}
            </button>
        `).join('');

        // 태그 필터 이벤트 리스너 추가
        container.querySelectorAll('.tag-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tag = e.target.dataset.tag;
                this.setFilter(tag);
            });
        });
    }

    setFilter(tag) {
        this.currentFilter = tag;

        // 활성 필터 버튼 업데이트
        document.querySelectorAll('.tag-filter').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tag === tag);
        });

        this.renderLinks();
    }

    setupDragAndDrop() {
        const cards = document.querySelectorAll('.link-card');
        const container = document.getElementById('linksContainer');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => this.handleDragStart(e));
            card.addEventListener('dragend', (e) => this.handleDragEnd(e));
        });

        container.addEventListener('dragover', (e) => this.handleDragOver(e));
        container.addEventListener('drop', (e) => this.handleDrop(e));
        container.addEventListener('dragenter', (e) => this.handleDragEnter(e));
        container.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    }

    handleDragStart(e) {
        this.draggedElement = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedElement = null;
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(e) {
        e.preventDefault();
        if (e.target.classList.contains('links-container')) {
            e.target.classList.add('drag-over');
        }
    }

    handleDragLeave(e) {
        if (e.target.classList.contains('links-container')) {
            e.target.classList.remove('drag-over');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        e.target.classList.remove('drag-over');

        if (this.draggedElement && e.target.classList.contains('links-container')) {
            const cards = Array.from(container.querySelectorAll('.link-card'));
            const draggedIndex = cards.findIndex(card => card.dataset.id === this.draggedElement.dataset.id);

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

            // 순서 재정렬
            this.reorderLinks(draggedIndex, dropIndex);
            this.renderLinks();
        }
    }

    reorderLinks(fromIndex, toIndex) {
        const linkId = this.draggedElement.dataset.id;
        const link = this.links.find(l => l.id === linkId);

        if (link) {
            // 기존 링크 제거
            this.links = this.links.filter(l => l.id !== linkId);

            // 새 위치에 삽입
            this.links.splice(toIndex, 0, link);

            // 순서 업데이트
            this.links.forEach((link, index) => {
                link.order = index;
            });

            this.saveData();
        }
    }
}

// 페이지 로드 시 초기화
let personalHome;
document.addEventListener('DOMContentLoaded', () => {
    personalHome = new PersonalHome();
});
