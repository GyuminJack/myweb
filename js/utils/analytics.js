/**
 * 사용 분석 및 통계 유틸리티
 */
export class AnalyticsManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.sessionStartTime = Date.now();
        this.init();
    }

    init() {
        this.trackSession();
        this.setupEventTracking();
    }

    /**
     * 세션 추적 시작
     */
    trackSession() {
        const today = new Date().toISOString().split('T')[0];
        const sessions = this.storage.load('analytics_sessions', {});

        if (!sessions[today]) {
            sessions[today] = [];
        }

        const session = {
            id: this.generateSessionId(),
            startTime: this.sessionStartTime,
            userAgent: navigator.userAgent,
            screenResolution: `${screen.width}x${screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };

        sessions[today].push(session);
        this.storage.save('analytics_sessions', sessions);
        this.currentSessionId = session.id;
    }

    /**
     * 이벤트 추적 설정
     */
    setupEventTracking() {
        // 페이지 언로드 시 세션 종료
        window.addEventListener('beforeunload', () => {
            this.endSession();
        });

        // 링크 클릭 추적은 LinkManager에서 처리
        // 검색 추적
        document.addEventListener('input', (e) => {
            if (e.target.id === 'searchInput') {
                this.debounce(() => {
                    this.trackEvent('search', {
                        query: e.target.value,
                        queryLength: e.target.value.length
                    });
                }, 1000);
            }
        });

        // 태그 필터 클릭 추적
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-filter')) {
                this.trackEvent('filter_click', {
                    tag: e.target.dataset.tag,
                    isActive: e.target.classList.contains('active')
                });
            }
        });

        // 모달 열기/닫기 추적
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.trackEvent('modal_open', { modal: 'settings' });
            });
        }
    }

    /**
     * 이벤트 추적
     * @param {string} eventName - 이벤트 이름
     * @param {object} properties - 이벤트 속성
     */
    trackEvent(eventName, properties = {}) {
        const today = new Date().toISOString().split('T')[0];
        const events = this.storage.load('analytics_events', {});

        if (!events[today]) {
            events[today] = [];
        }

        const event = {
            id: this.generateEventId(),
            sessionId: this.currentSessionId,
            name: eventName,
            properties,
            timestamp: Date.now(),
            url: window.location.href,
            referrer: document.referrer
        };

        events[today].push(event);
        this.storage.save('analytics_events', events);
    }

    /**
     * 세션 종료
     */
    endSession() {
        const today = new Date().toISOString().split('T')[0];
        const sessions = this.storage.load('analytics_sessions', {});

        if (sessions[today]) {
            const currentSession = sessions[today].find(s => s.id === this.currentSessionId);
            if (currentSession) {
                currentSession.endTime = Date.now();
                currentSession.duration = currentSession.endTime - currentSession.startTime;
                this.storage.save('analytics_sessions', sessions);
            }
        }
    }

    /**
     * 사용 통계 반환
     * @param {number} days - 분석할 일수
     * @returns {object} 통계 데이터
     */
    getUsageStats(days = 30) {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

        const sessions = this.storage.load('analytics_sessions', {});
        const events = this.storage.load('analytics_events', {});

        let totalSessions = 0;
        let totalDuration = 0;
        let totalEvents = 0;
        const eventCounts = {};
        const dailyStats = {};
        const hourlyDistribution = new Array(24).fill(0);

        // 날짜별 데이터 수집
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateKey = d.toISOString().split('T')[0];

            // 세션 데이터
            const daySessions = sessions[dateKey] || [];
            totalSessions += daySessions.length;

            const dayDuration = daySessions.reduce((sum, session) => {
                return sum + (session.duration || 0);
            }, 0);
            totalDuration += dayDuration;

            // 시간대별 분포
            daySessions.forEach(session => {
                const hour = new Date(session.startTime).getHours();
                hourlyDistribution[hour]++;
            });

            // 이벤트 데이터
            const dayEvents = events[dateKey] || [];
            totalEvents += dayEvents.length;

            dayEvents.forEach(event => {
                eventCounts[event.name] = (eventCounts[event.name] || 0) + 1;
            });

            dailyStats[dateKey] = {
                sessions: daySessions.length,
                events: dayEvents.length,
                duration: dayDuration
            };
        }

        return {
            period: { start: startDate, end: endDate, days },
            sessions: {
                total: totalSessions,
                averagePerDay: totalSessions / days,
                averageDuration: totalSessions > 0 ? totalDuration / totalSessions : 0
            },
            events: {
                total: totalEvents,
                averagePerDay: totalEvents / days,
                byType: eventCounts
            },
            hourlyDistribution,
            dailyStats,
            mostActiveHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
            totalDuration
        };
    }

    /**
     * 링크 클릭 통계
     * @returns {object} 링크 클릭 통계
     */
    getLinkClickStats() {
        const events = this.storage.load('analytics_events', {});
        const linkClicks = {};
        let totalClicks = 0;

        Object.values(events).flat().forEach(event => {
            if (event.name === 'link_click') {
                const linkId = event.properties.linkId;
                if (linkId) {
                    linkClicks[linkId] = (linkClicks[linkId] || 0) + 1;
                    totalClicks++;
                }
            }
        });

        // 상위 링크 정렬
        const topLinks = Object.entries(linkClicks)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        return {
            totalClicks,
            linkClicks,
            topLinks,
            uniqueLinksClicked: Object.keys(linkClicks).length
        };
    }

    /**
     * 검색 통계
     * @returns {object} 검색 통계
     */
    getSearchStats() {
        const events = this.storage.load('analytics_events', {});
        const searchQueries = {};
        let totalSearches = 0;

        Object.values(events).flat().forEach(event => {
            if (event.name === 'search') {
                const query = event.properties.query?.toLowerCase().trim();
                if (query) {
                    searchQueries[query] = (searchQueries[query] || 0) + 1;
                    totalSearches++;
                }
            }
        });

        const topQueries = Object.entries(searchQueries)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        return {
            totalSearches,
            uniqueQueries: Object.keys(searchQueries).length,
            topQueries,
            averageQueryLength: this.calculateAverageQueryLength(events)
        };
    }

    /**
     * 평균 검색어 길이 계산
     * @param {object} events - 이벤트 데이터
     * @returns {number} 평균 길이
     */
    calculateAverageQueryLength(events) {
        const queryLengths = [];

        Object.values(events).flat().forEach(event => {
            if (event.name === 'search' && event.properties.queryLength) {
                queryLengths.push(event.properties.queryLength);
            }
        });

        return queryLengths.length > 0 ?
            queryLengths.reduce((sum, len) => sum + len, 0) / queryLengths.length : 0;
    }

    /**
     * 태그 사용 통계
     * @returns {object} 태그 통계
     */
    getTagStats() {
        const events = this.storage.load('analytics_events', {});
        const tagClicks = {};

        Object.values(events).flat().forEach(event => {
            if (event.name === 'filter_click') {
                const tag = event.properties.tag;
                if (tag && tag !== 'all') {
                    tagClicks[tag] = (tagClicks[tag] || 0) + 1;
                }
            }
        });

        const topTags = Object.entries(tagClicks)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        return {
            tagClicks,
            topTags,
            uniqueTagsUsed: Object.keys(tagClicks).length
        };
    }

    /**
     * 데이터 내보내기
     * @returns {object} 분석 데이터
     */
    exportAnalytics() {
        return {
            sessions: this.storage.load('analytics_sessions', {}),
            events: this.storage.load('analytics_events', {}),
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * 분석 데이터 삭제
     * @param {number} olderThanDays - 며칠 이전 데이터 삭제
     */
    cleanupOldData(olderThanDays = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        const cutoffDateString = cutoffDate.toISOString().split('T')[0];

        const sessions = this.storage.load('analytics_sessions', {});
        const events = this.storage.load('analytics_events', {});

        // 오래된 데이터 삭제
        Object.keys(sessions).forEach(date => {
            if (date < cutoffDateString) {
                delete sessions[date];
            }
        });

        Object.keys(events).forEach(date => {
            if (date < cutoffDateString) {
                delete events[date];
            }
        });

        this.storage.save('analytics_sessions', sessions);
        this.storage.save('analytics_events', events);
    }

    /**
     * 디바운스 유틸리티
     * @param {Function} func - 실행할 함수
     * @param {number} delay - 지연 시간
     */
    debounce(func, delay) {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(func, delay);
    }

    /**
     * 세션 ID 생성
     * @returns {string} 세션 ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 이벤트 ID 생성
     * @returns {string} 이벤트 ID
     */
    generateEventId() {
        return 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 개인정보 보호를 위한 데이터 익명화
     * @param {object} data - 익명화할 데이터
     * @returns {object} 익명화된 데이터
     */
    anonymizeData(data) {
        // 개인 식별 정보 제거
        const anonymized = JSON.parse(JSON.stringify(data));

        // URL에서 개인정보 제거
        if (anonymized.url) {
            try {
                const url = new URL(anonymized.url);
                anonymized.url = url.origin + url.pathname;
            } catch {
                delete anonymized.url;
            }
        }

        // 사용자 에이전트 단순화
        if (anonymized.userAgent) {
            anonymized.userAgent = this.simplifyUserAgent(anonymized.userAgent);
        }

        return anonymized;
    }

    /**
     * 사용자 에이전트 단순화
     * @param {string} userAgent - 원본 사용자 에이전트
     * @returns {string} 단순화된 사용자 에이전트
     */
    simplifyUserAgent(userAgent) {
        const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera'];
        const os = ['Windows', 'macOS', 'Linux', 'iOS', 'Android'];

        let browser = 'Unknown';
        let platform = 'Unknown';

        browsers.forEach(b => {
            if (userAgent.includes(b)) browser = b;
        });

        if (userAgent.includes('Windows')) platform = 'Windows';
        else if (userAgent.includes('Mac')) platform = 'macOS';
        else if (userAgent.includes('Linux')) platform = 'Linux';
        else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) platform = 'iOS';
        else if (userAgent.includes('Android')) platform = 'Android';

        return `${browser}/${platform}`;
    }
}
