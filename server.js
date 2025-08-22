/**
 * Personal Home Backend Server
 * RC 파일 읽기 및 API 제공
 */
const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const cors = require('cors');
const chokidar = require('chokidar');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3456;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// RC 파일 경로 (도커 볼륨 우선 -> 환경변수 -> 홈 디렉토리)
const getDefaultRcPath = () => {
    const envPath = process.env.RC_PATH;
    if (envPath) return envPath;
    const dockerCandidate = path.join(process.cwd(), '.myweb.rc');
    if (fsSync.existsSync(dockerCandidate)) return dockerCandidate;
    return path.join(os.homedir(), '.myweb.rc');
};
let currentRcPath = getDefaultRcPath();

// RC 파일 감시자
let watcher = null;

/**
 * 파일이 없으면 생성 (초기 내용 옵션)
 * @param {string} filePath
 * @param {string} [initialContent]
 */
async function ensureFileExists(filePath, initialContent = '') {
    try {
        await fs.access(filePath);
    } catch {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, initialContent, 'utf-8');
        console.log(`📄 파일 생성: ${filePath}`);
    }
}

/**
 * 메모 파일 경로 반환 (환경변수 우선, 아니면 RC 파일과 같은 폴더)
 */
function getMemoFilePath() {
    const envPath = process.env.MEMO_PATH;
    if (envPath) return envPath;
    const baseDir = path.dirname(currentRcPath);
    return path.join(baseDir, '.myweb.memos.json');
}

/**
 * RC 파일 파싱
 * @param {string} content - RC 파일 내용
 * @returns {Array} 파싱된 링크 배열
 */
function parseRcFile(content) {
    const lines = content.split('\n');
    const links = [];

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();

        // 빈 줄이나 주석 무시
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            return;
        }

        try {
            const parts = trimmedLine.split(',').map(part => part.trim());

            if (parts.length >= 2) {
                const [name, url, ...tagParts] = parts;
                const tags = tagParts.length > 0 ?
                    tagParts.join(',').split(',').map(tag => tag.trim()).filter(Boolean) : [];

                // URL 유효성 검사
                if (name && isValidUrl(url)) {
                    links.push({
                        id: `rc_${index}_${Date.now()}`,
                        name,
                        url: normalizeUrl(url),
                        tags,
                        source: 'rc_file',
                        lineNumber: index + 1
                    });
                }
            }
        } catch (error) {
            console.warn(`RC 파일 파싱 오류 (라인 ${index + 1}):`, error.message);
        }
    });

    return links;
}

/**
 * URL 유효성 검사
 * @param {string} url - 검사할 URL
 * @returns {boolean} 유효 여부
 */
function isValidUrl(url) {
    try {
        new URL(url.startsWith('http') ? url : `https://${url}`);
        return true;
    } catch {
        return false;
    }
}

/**
 * URL 정규화
 * @param {string} url - 정규화할 URL
 * @returns {string} 정규화된 URL
 */
function normalizeUrl(url) {
    if (!url.startsWith('http')) {
        return `https://${url}`;
    }
    return url;
}

/**
 * RC 파일 감시 시작
 * @param {string} filePath - 감시할 파일 경로
 */
function startWatching(filePath) {
    if (watcher) {
        watcher.close();
    }

    try {
        watcher = chokidar.watch(filePath, {
            persistent: true,
            ignoreInitial: false
        });

        watcher.on('change', () => {
            console.log(`RC 파일 변경 감지: ${filePath}`);
            // WebSocket을 통해 클라이언트에 알림 (추후 구현)
        });

        watcher.on('error', (error) => {
            console.error('파일 감시 오류:', error);
        });

        console.log(`RC 파일 감시 시작: ${filePath}`);
    } catch (error) {
        console.error('파일 감시 시작 실패:', error);
    }
}

// API 라우트들

/**
 * RC 파일 읽기
 */
app.get('/api/rc', async (req, res) => {
    try {
        const filePath = req.query.path || currentRcPath;

        // 파일 없으면 생성 (빈 파일)
        await ensureFileExists(filePath, '');

        const content = await fs.readFile(filePath, 'utf-8');
        const links = parseRcFile(content);

        res.json({
            success: true,
            path: filePath,
            links,
            lastModified: (await fs.stat(filePath)).mtime,
            lineCount: content.split('\n').length
        });

    } catch (error) {
        console.error('RC 파일 읽기 오류:', error);
        res.status(500).json({
            error: 'RC 파일 읽기 중 오류가 발생했습니다',
            details: error.message
        });
    }
});

/**
 * RC 파일 쓰기
 */
app.post('/api/rc', async (req, res) => {
    try {
        const { content, path: filePath } = req.body;
        const targetPath = filePath || currentRcPath;

        // 디렉토리 존재 확인 및 생성
        const dir = path.dirname(targetPath);
        await fs.mkdir(dir, { recursive: true });

        // 백업 생성
        try {
            const existingContent = await fs.readFile(targetPath, 'utf-8');
            const backupPath = `${targetPath}.backup.${Date.now()}`;
            await fs.writeFile(backupPath, existingContent);
        } catch {
            // 파일이 없는 경우 무시
        }

        // 파일 쓰기
        await fs.writeFile(targetPath, content, 'utf-8');

        res.json({
            success: true,
            path: targetPath,
            message: 'RC 파일이 성공적으로 저장되었습니다'
        });

    } catch (error) {
        console.error('RC 파일 쓰기 오류:', error);
        res.status(500).json({
            error: 'RC 파일 저장 중 오류가 발생했습니다',
            details: error.message
        });
    }
});

/**
 * RC 파일에 링크 추가(append)
 */
app.post('/api/rc/append', async (req, res) => {
    try {
        const { links = [], path: filePath } = req.body || {};
        const targetPath = filePath || currentRcPath;

        // 디렉토리 준비
        const dir = path.dirname(targetPath);
        await fs.mkdir(dir, { recursive: true });

        // 기존 내용 읽기 (없으면 빈 문자열)
        let existing = '';
        try {
            existing = await fs.readFile(targetPath, 'utf-8');
        } catch {}

        // 기존 URL 세트
        const existingUrls = new Set(
            existing
                .split('\n')
                .map(l => l.trim())
                .filter(Boolean)
                .map(l => l.split(',')[1] || '')
                .map(u => u.trim().toLowerCase())
        );

        // 추가할 라인 생성
        const newLines = [];
        for (const link of links) {
            if (!link || !link.url || !link.name) continue;
            const urlKey = String(link.url).trim().toLowerCase();
            if (!urlKey.startsWith('http')) continue;
            if (existingUrls.has(urlKey)) continue;

            // 이름/태그 내 콤마 제거해서 간단 CSV 유지
            const safeName = String(link.name).replace(/,/g, ' ').trim();
            const rawTags = Array.isArray(link.tags) ? link.tags : [];
            const simpleTags = rawTags.filter(t => typeof t === 'string' && t && !t.includes(' > '));
            const line = [safeName, link.url, ...simpleTags].join(',');
            newLines.push(line);
            existingUrls.add(urlKey);
        }

        if (newLines.length === 0) {
            return res.json({ success: true, path: targetPath, added: 0, skipped: links.length });
        }

        // 끝이 개행으로 끝나지 않으면 개행 추가
        const needsNewline = existing.length > 0 && !existing.endsWith('\n');
        const toAppend = (needsNewline ? '\n' : '') + newLines.join('\n') + '\n';
        await fs.appendFile(targetPath, toAppend, 'utf-8');

        res.json({ success: true, path: targetPath, added: newLines.length, skipped: links.length - newLines.length });
    } catch (error) {
        console.error('RC 파일 append 오류:', error);
        res.status(500).json({ error: 'RC 파일 업데이트 중 오류가 발생했습니다', details: error.message });
    }
});

/**
 * RC 파일 경로 설정
 */
app.post('/api/rc/path', async (req, res) => {
    try {
        const { path: newPath } = req.body;

        if (!newPath) {
            return res.status(400).json({
                error: '파일 경로가 필요합니다'
            });
        }

        // 홈 디렉토리 ~ 확장
        const expandedPath = newPath.startsWith('~') ?
            path.join(os.homedir(), newPath.slice(1)) :
            path.resolve(newPath);

        currentRcPath = expandedPath;

        // 새 경로 감시 시작
        await ensureFileExists(currentRcPath, '');
        startWatching(currentRcPath);

        res.json({
            success: true,
            path: currentRcPath,
            message: 'RC 파일 경로가 업데이트되었습니다'
        });

    } catch (error) {
        console.error('RC 파일 경로 설정 오류:', error);
        res.status(500).json({
            error: 'RC 파일 경로 설정 중 오류가 발생했습니다',
            details: error.message
        });
    }
});

/**
 * 시스템 정보
 */
app.get('/api/system', (req, res) => {
    res.json({
        platform: os.platform(),
        homedir: os.homedir(),
        currentRcPath,
        defaultRcPath: getDefaultRcPath(),
        nodeVersion: process.version,
        uptime: process.uptime()
    });
});

/**
 * 브라우저 북마크 가져오기 (Chrome/Safari 등)
 */
app.get('/api/bookmarks', async (req, res) => {
    try {
        const bookmarks = await getSystemBookmarks();
        res.json({
            success: true,
            bookmarks
        });
    } catch (error) {
        console.error('북마크 가져오기 오류:', error);
        res.status(500).json({
            error: '북마크를 가져올 수 없습니다',
            details: error.message
        });
    }
});

/**
 * 시스템 북마크 가져오기
 * @returns {Array} 북마크 배열
 */
async function getSystemBookmarks() {
    const bookmarks = [];
    const platform = os.platform();

    try {
        if (platform === 'darwin') {
            // macOS Chrome 북마크
            const chromeBookmarkPath = path.join(
                os.homedir(),
                'Library/Application Support/Google/Chrome/Default/Bookmarks'
            );

            try {
                const chromeData = await fs.readFile(chromeBookmarkPath, 'utf-8');
                const chromeBookmarks = JSON.parse(chromeData);
                bookmarks.push(...parseChromeBookmarks(chromeBookmarks));
            } catch {
                // Chrome 북마크 없음
            }

            // macOS Safari 북마크는 더 복잡하므로 생략
        } else if (platform === 'win32') {
            // Windows Chrome 북마크
            const chromeBookmarkPath = path.join(
                os.homedir(),
                'AppData/Local/Google/Chrome/User Data/Default/Bookmarks'
            );

            try {
                const chromeData = await fs.readFile(chromeBookmarkPath, 'utf-8');
                const chromeBookmarks = JSON.parse(chromeData);
                bookmarks.push(...parseChromeBookmarks(chromeBookmarks));
            } catch {
                // Chrome 북마크 없음
            }
        }
    } catch (error) {
        console.warn('북마크 파싱 중 오류:', error);
    }

    return bookmarks;
}

/**
 * 메모: 파일에서 로드
 */
app.get('/api/memos', async (req, res) => {
    try {
        const memoPath = getMemoFilePath();
        await ensureFileExists(memoPath, JSON.stringify({ memos: [] }, null, 2));
        const raw = await fs.readFile(memoPath, 'utf-8');
        let json;
        try {
            json = JSON.parse(raw || '{}');
        } catch {
            json = { memos: [] };
        }
        if (!Array.isArray(json.memos)) json.memos = [];
        res.json({ success: true, path: memoPath, memos: json.memos });
    } catch (error) {
        console.error('메모 로드 오류:', error);
        res.status(500).json({ error: '메모를 불러오는 중 오류가 발생했습니다', details: error.message });
    }
});

/**
 * 메모: 파일에 저장 (전체 덮어쓰기)
 */
app.post('/api/memos', async (req, res) => {
    try {
        const { memos = [] } = req.body || {};
        const memoPath = getMemoFilePath();
        const dir = path.dirname(memoPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(memoPath, JSON.stringify({ memos }, null, 2), 'utf-8');
        res.json({ success: true, path: memoPath, count: Array.isArray(memos) ? memos.length : 0 });
    } catch (error) {
        console.error('메모 저장 오류:', error);
        res.status(500).json({ error: '메모 저장 중 오류가 발생했습니다', details: error.message });
    }
});

/**
 * Chrome 북마크 파싱
 * @param {object} chromeData - Chrome 북마크 데이터
 * @returns {Array} 파싱된 북마크
 */
function parseChromeBookmarks(chromeData) {
    const bookmarks = [];

    function parseFolder(folder, folderName = '') {
        if (folder.children) {
            folder.children.forEach(item => {
                if (item.type === 'url') {
                    bookmarks.push({
                        name: item.name,
                        url: item.url,
                        tags: folderName ? [folderName] : [],
                        source: 'chrome',
                        dateAdded: item.date_added
                    });
                } else if (item.type === 'folder') {
                    parseFolder(item, item.name);
                }
            });
        }
    }

    if (chromeData.roots) {
        Object.values(chromeData.roots).forEach(root => {
            parseFolder(root);
        });
    }

    return bookmarks;
}

/**
 * 404 핸들러
 */
app.use((req, res) => {
    res.status(404).json({
        error: 'API 엔드포인트를 찾을 수 없습니다',
        availableEndpoints: [
            'GET /api/rc',
            'POST /api/rc',
            'POST /api/rc/path',
            'GET /api/system',
            'GET /api/bookmarks'
        ]
    });
});

/**
 * 에러 핸들러
 */
app.use((error, req, res, next) => {
    console.error('서버 오류:', error);
    res.status(500).json({
        error: '내부 서버 오류가 발생했습니다',
        details: error.message
    });
});

// 서버 시작 (Docker 환경에서 0.0.0.0으로 바인딩)
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`🚀 Personal Home Server가 ${HOST}:${PORT}에서 실행 중입니다`);
    console.log(`📂 기본 RC 파일 경로: ${currentRcPath}`);
    console.log(`🌐 웹 인터페이스: http://${HOST}:${PORT}`);
    console.log(`🐳 Docker 환경: ${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}`);

    // RC 파일 감시 시작
    ensureFileExists(currentRcPath, '').then(() => startWatching(currentRcPath));
});

// 종료 시 정리
process.on('SIGINT', () => {
    console.log('\n서버를 종료합니다...');
    if (watcher) {
        watcher.close();
    }
    process.exit(0);
});

module.exports = app;
