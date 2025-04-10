# Dockerfile
FROM node:20

# 작업 디렉토리 설정
WORKDIR /app

# package.json, package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# 나머지 파일 복사
COPY . .

# 서버 실행 포트
EXPOSE 8000

# 서버 실행 명령어
CMD ["node", "server.js"]
