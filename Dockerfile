# 가장 가벼운 Node.js Alpine 이미지 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일만 먼저 복사 (캐시 최적화)
COPY package*.json ./

# 프로덕션 의존성만 설치
RUN npm install --only=production && \
    npm cache clean --force

# 애플리케이션 코드 복사
COPY . .

# 불필요한 파일 제거로 이미지 크기 최소화
RUN rm -rf \
    node_modules/.cache \
    scripts/setup.js \
    *.md \
    .git* \
    Dockerfile* \
    docker-compose*

# 비 루트 사용자 생성 및 권한 설정
RUN addgroup -g 1001 -S nodejs && \
    adduser -S myweb -u 1001 && \
    chown -R myweb:nodejs /app

# 비 루트 사용자로 전환
USER myweb

# 포트 노출
EXPOSE 3456

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3456/api/system', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 애플리케이션 시작
CMD ["node", "server.js"]
