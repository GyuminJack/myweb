#!/bin/bash

# Personal Home Docker 시작 스크립트
# 포트 3456으로 실행

echo "🐳 Personal Home Docker 컨테이너를 시작합니다..."

# 기존 컨테이너 중지 및 제거
if [ $(docker ps -aq -f name=personal-home) ]; then
    echo "📦 기존 컨테이너를 중지합니다..."
    docker stop personal-home >/dev/null 2>&1
    docker rm personal-home >/dev/null 2>&1
fi

# 이미지 빌드
echo "🔨 이미지를 빌드합니다..."
docker build -t myweb:latest . --no-cache

if [ $? -ne 0 ]; then
    echo "❌ 이미지 빌드에 실패했습니다."
    exit 1
fi

# RC 파일 존재 확인 및 생성
if [ ! -f "./.myweb.rc" ]; then
    echo "📝 RC 파일을 생성합니다..."
    cat > ./.myweb.rc << 'EOF'
# Personal Home RC 파일
Google,https://google.com,검색
GitHub,https://github.com,개발
YouTube,https://youtube.com,엔터테인먼트
Netflix,https://netflix.com,엔터테인먼트
Notion,https://notion.so,생산성
EOF
fi

# 컨테이너 실행
echo "🚀 컨테이너를 시작합니다..."
docker run -d \
    --name personal-home \
    -p 3456:3456 \
    -v "$(pwd)/.myweb.rc:/app/.myweb.rc:rw" \
    --restart unless-stopped \
    myweb:latest

if [ $? -eq 0 ]; then
    echo "✅ Personal Home이 성공적으로 시작되었습니다!"
    echo ""
    echo "🌐 웹 브라우저에서 다음 주소로 접속하세요:"
    echo "   http://localhost:3456"
    echo "   http://0.0.0.0:3456"
    echo ""
    echo "📋 유용한 명령어:"
    echo "   npm run docker:logs      # 로그 확인"
    echo "   npm run docker:stop      # 컨테이너 중지"
    echo "   npm run docker:restart   # 컨테이너 재시작"
    echo "   npm run docker:exec      # 컨테이너 내부 접속"
    echo ""
    echo "📁 RC 파일 경로: $(pwd)/.myweb.rc"
    echo ""

    # 컨테이너 상태 확인
    sleep 3
    if [ $(docker ps -q -f name=personal-home) ]; then
        echo "🟢 컨테이너가 정상적으로 실행 중입니다."
    else
        echo "🔴 컨테이너 실행에 문제가 있습니다. 로그를 확인하세요:"
        echo "   docker logs personal-home"
    fi
else
    echo "❌ 컨테이너 시작에 실패했습니다."
    exit 1
fi
