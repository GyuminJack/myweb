/**
 * 시간 관리 모듈
 * KST 기준 시간 표시 및 업데이트 담당
 */
export class TimeManager {
    constructor() {
        this.timeElement = null;
        this.dateElement = null;
        this.intervalId = null;
        this.showUTC = false; // deprecated toggle, 항상 둘 다 표시
    }

    init(timeElementId, dateElementId) {
        this.timeElement = document.getElementById(timeElementId);
        this.dateElement = document.getElementById(dateElementId);

        if (!this.timeElement || !this.dateElement) {
            throw new Error('Time or date element not found');
        }

        this.updateTime();
        this.startTimer();
    }

        updateTime() {
        const now = new Date();
        const kstTime = now.toLocaleTimeString('ko-KR', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Seoul'
        });
        const kstDate = now.toLocaleDateString('ko-KR', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul'
        });

        const utcTime = now.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC'
        });
        const utcDate = now.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC'
        });

        this.timeElement.innerHTML = `
            <div class="tz-dual">
                <div class="tz-block">
                    <div class="tz-row"><span class="tz">KST</span> <span class="t">${kstTime}</span></div>
                    <div class="tz-date">${kstDate}</div>
                </div>
                <div class="tz-block">
                    <div class="tz-row"><span class="tz">UTC</span> <span class="t">${utcTime}</span></div>
                    <div class="tz-date">${utcDate}</div>
                </div>
            </div>
        `;
        this.dateElement.innerHTML = '';
    }

    startTimer() {
        this.intervalId = setInterval(() => this.updateTime(), 1000);
    }

    stopTimer() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    // 토글 제거: 항상 두 개를 동시에 표시
    toggleTimezone() {}

    /**
     * 현재 시간대 반환
     * @returns {string} 현재 시간대
     */
    getCurrentTimezone() {
        return 'KST & UTC';
    }

    /**
     * 시간대 설정
     * @param {boolean} useUTC - UTC 사용 여부
     */
    setTimezone(useUTC) {
        // no-op: 항상 두 개 모두 표시
    }

    destroy() {
        this.stopTimer();
    }
}
