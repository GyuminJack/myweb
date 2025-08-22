/**
 * 스토리지 관리 모듈
 * 로컬 스토리지 및 데이터 영속성 담당
 */
export class StorageManager {
    constructor() {
        this.prefix = 'personalHome_';
    }

    /**
     * 데이터 저장
     * @param {string} key - 저장할 키
     * @param {any} data - 저장할 데이터
     */
    save(key, data) {
        try {
            const serializedData = JSON.stringify(data);
            localStorage.setItem(this.prefix + key, serializedData);
            return true;
        } catch (error) {
            console.error('Storage save error:', error);
            return false;
        }
    }

    /**
     * 데이터 로드
     * @param {string} key - 로드할 키
     * @param {any} defaultValue - 기본값
     * @returns {any} 로드된 데이터
     */
    load(key, defaultValue = null) {
        try {
            const serializedData = localStorage.getItem(this.prefix + key);
            if (serializedData === null) {
                return defaultValue;
            }
            return JSON.parse(serializedData);
        } catch (error) {
            console.error('Storage load error:', error);
            return defaultValue;
        }
    }

    /**
     * 데이터 삭제
     * @param {string} key - 삭제할 키
     */
    remove(key) {
        try {
            localStorage.removeItem(this.prefix + key);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    }

    /**
     * 모든 데이터 삭제
     */
    clear() {
        try {
            const keys = Object.keys(localStorage).filter(key =>
                key.startsWith(this.prefix)
            );
            keys.forEach(key => localStorage.removeItem(key));
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }

    /**
     * 스토리지 사용량 확인
     * @returns {number} 사용량 (바이트)
     */
    getUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (key.startsWith(this.prefix)) {
                total += localStorage[key].length;
            }
        }
        return total;
    }

    /**
     * 데이터 내보내기
     * @returns {object} 모든 데이터
     */
    export() {
        const data = {};
        for (let key in localStorage) {
            if (key.startsWith(this.prefix)) {
                const cleanKey = key.replace(this.prefix, '');
                data[cleanKey] = this.load(cleanKey);
            }
        }
        return data;
    }

    /**
     * 데이터 가져오기
     * @param {object} data - 가져올 데이터
     */
    import(data) {
        try {
            for (let key in data) {
                this.save(key, data[key]);
            }
            return true;
        } catch (error) {
            console.error('Storage import error:', error);
            return false;
        }
    }
}
