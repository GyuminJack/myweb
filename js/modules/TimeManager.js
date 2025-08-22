/**
 * 시간 관리 모듈
 * KST 기준 시간 표시 및 업데이트 담당
 */
export class TimeManager {
    constructor() {
        this.timeElement = null;
        this.dateElement = null;
        this.intervalId = null;
        this.showUTC = false; // KST가 기본
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
        let displayTime, timeZone, timeString, dateString;

        if (this.showUTC) {
            // UTC 시간 표시
            displayTime = now;
            timeZone = 'UTC';

            timeString = displayTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'UTC'
            });

            dateString = displayTime.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
                timeZone: 'UTC'
            });
        } else {
            // KST 시간 표시
            displayTime = now;
            timeZone = 'KST';

            timeString = displayTime.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'Asia/Seoul'
            });

            dateString = displayTime.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
                timeZone: 'Asia/Seoul'
            });
        }

        this.timeElement.innerHTML = `
            ${timeString}
            <small class="timezone-label">${timeZone}</small>
        `;
        this.dateElement.textContent = dateString;
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

    /**
     * 시간대 토글 (KST ↔ UTC)
     */
    toggleTimezone() {
        this.showUTC = !this.showUTC;
        this.updateTime();
    }

    /**
     * 현재 시간대 반환
     * @returns {string} 현재 시간대
     */
    getCurrentTimezone() {
        return this.showUTC ? 'UTC' : 'KST';
    }

    /**
     * 시간대 설정
     * @param {boolean} useUTC - UTC 사용 여부
     */
    setTimezone(useUTC) {
        this.showUTC = useUTC;
        this.updateTime();
    }

    destroy() {
        this.stopTimer();
    }
}
