#!/usr/bin/env node

/**
 * Personal Home 설치 스크립트
 */
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class SetupManager {
    constructor() {
        this.homeDir = os.homedir();
        this.rcFilePath = path.join(this.homeDir, '.myweb.rc');
        this.configDir = path.join(this.homeDir, '.myweb');
    }

    async run() {
        console.log('🚀 Personal Home 설치를 시작합니다...\n');

        try {
            await this.createDirectories();
            await this.createRcFile();
            await this.createConfigFile();
            await this.checkDependencies();
            await this.displayInstructions();

            console.log('✅ 설치가 완료되었습니다!\n');
        } catch (error) {
            console.error('❌ 설치 중 오류가 발생했습니다:', error.message);
            process.exit(1);
        }
    }

    async createDirectories() {
        console.log('📁 디렉토리를 생성합니다...');

        try {
            await fs.mkdir(this.configDir, { recursive: true });
            console.log(`✅ 설정 디렉토리 생성: ${this.configDir}`);
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
            console.log(`ℹ️  설정 디렉토리가 이미 존재합니다: ${this.configDir}`);
        }
    }

    async createRcFile() {
        console.log('\n📝 RC 파일을 생성합니다...');

        try {
            await fs.access(this.rcFilePath);
            console.log(`ℹ️  RC 파일이 이미 존재합니다: ${this.rcFilePath}`);
            return;
        } catch {
            // 파일이 없으므로 생성
        }

        const defaultRcContent = this.getDefaultRcContent();
        await fs.writeFile(this.rcFilePath, defaultRcContent, 'utf-8');
        console.log(`✅ RC 파일 생성 완료: ${this.rcFilePath}`);
    }

    async createConfigFile() {
        console.log('\n⚙️  설정 파일을 생성합니다...');

        const configPath = path.join(this.configDir, 'config.json');

        try {
            await fs.access(configPath);
            console.log(`ℹ️  설정 파일이 이미 존재합니다: ${configPath}`);
            return;
        } catch {
            // 파일이 없으므로 생성
        }

        const defaultConfig = {
            version: '2.0.0',
            rcFilePath: this.rcFilePath,
            theme: 'default',
            autoSave: true,
            analyticsEnabled: true,
            backupEnabled: true,
            backupRetentionDays: 30,
            server: {
                port: 3000,
                host: 'localhost',
                watchRcFile: true
            },
            features: {
                shortcuts: true,
                analytics: true,
                bookmarkImport: true,
                autoBackup: true
            }
        };

        await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
        console.log(`✅ 설정 파일 생성 완료: ${configPath}`);
    }

    async checkDependencies() {
        console.log('\n🔍 의존성을 확인합니다...');

        try {
            const packageJson = require('../package.json');
            const dependencies = Object.keys(packageJson.dependencies || {});

            console.log(`✅ ${dependencies.length}개의 의존성 패키지 확인됨`);

            // Node.js 버전 확인
            const nodeVersion = process.version;
            const requiredVersion = packageJson.engines?.node || '>=16.0.0';
            console.log(`✅ Node.js 버전: ${nodeVersion} (요구사항: ${requiredVersion})`);

        } catch (error) {
            console.warn('⚠️  package.json을 찾을 수 없습니다');
        }
    }

    async displayInstructions() {
        console.log('\n📋 사용 방법:');
        console.log('');
        console.log('1. 서버 모드로 실행:');
        console.log('   npm start');
        console.log('   또는: node server.js');
        console.log('');
        console.log('2. 개발 모드로 실행:');
        console.log('   npm run dev');
        console.log('');
        console.log('3. 클라이언트만 사용:');
        console.log('   브라우저에서 index.html 파일을 직접 열기');
        console.log('');
        console.log('4. RC 파일 편집:');
        console.log(`   ${this.rcFilePath}`);
        console.log('');
        console.log('5. 설정 변경:');
        console.log(`   ${path.join(this.configDir, 'config.json')}`);
        console.log('');
        console.log('🌐 웹 브라우저에서 http://localhost:3000 으로 접속하세요');
        console.log('');
        console.log('📚 더 자세한 정보는 README.md 파일을 참조하세요');
    }

    getDefaultRcContent() {
        return `# Personal Home RC 파일
# 형식: 이름,URL,태그1,태그2,...
# 빈 줄과 #으로 시작하는 줄은 무시됩니다

# 검색 엔진
Google,https://google.com,검색,일반
Naver,https://naver.com,검색,한국
DuckDuckGo,https://duckduckgo.com,검색,프라이버시

# 개발 도구
GitHub,https://github.com,개발,코드
Stack Overflow,https://stackoverflow.com,개발,Q&A
MDN Web Docs,https://developer.mozilla.org,개발,문서
npm,https://npmjs.com,개발,패키지

# 생산성 도구
Notion,https://notion.so,생산성,문서
Figma,https://figma.com,디자인,협업
Slack,https://slack.com,소통,협업
Trello,https://trello.com,생산성,관리

# 엔터테인먼트
YouTube,https://youtube.com,엔터테인먼트,동영상
Netflix,https://netflix.com,엔터테인먼트,영화
Spotify,https://spotify.com,엔터테인먼트,음악
Reddit,https://reddit.com,커뮤니티,소셜

# 쇼핑
Amazon,https://amazon.com,쇼핑,해외
Coupang,https://coupang.com,쇼핑,한국
11번가,https://11st.co.kr,쇼핑,한국

# 뉴스
BBC News,https://bbc.com/news,뉴스,해외
조선일보,https://chosun.com,뉴스,한국
TechCrunch,https://techcrunch.com,뉴스,기술

# 학습
Coursera,https://coursera.org,학습,온라인
Khan Academy,https://khanacademy.org,학습,무료
Udemy,https://udemy.com,학습,강의

# 기타
Weather,https://weather.com,날씨,정보
Maps,https://maps.google.com,지도,내비게이션
Gmail,https://gmail.com,이메일,구글
`;
    }
}

// 스크립트 실행
if (require.main === module) {
    const setup = new SetupManager();
    setup.run().catch(console.error);
}

module.exports = SetupManager;
