# GitHub Pages 배포 가이드

## 1. GitHub에서 저장소 생성 후 실행할 명령어

```bash
# 실제 GitHub 저장소 URL로 연결 (사용자명과 저장소명을 실제 값으로 변경)
git remote add origin https://github.com/[사용자명]/[저장소명].git

# 메인 브랜치로 설정
git branch -M main

# GitHub에 코드 업로드
git push -u origin main
```

## 2. GitHub Pages 설정

1. GitHub 저장소 → Settings → Pages
2. Source: "Deploy from a branch"
3. Branch: "main" 선택
4. Folder: "/ (root)" 선택
5. Save 클릭

## 3. 배포 URL

게임 URL: `https://[사용자명].github.io/[저장소명]`

## 4. 배포 후 업데이트 방법

게임을 수정한 후 업데이트하려면:

```bash
git add .
git commit -m "게임 업데이트"
git push origin main
```

몇 분 후 자동으로 사이트가 업데이트됩니다!

## 5. 문제 해결

### 404 에러가 발생하는 경우:
- GitHub Pages 설정에서 Branch가 "main"으로 되어 있는지 확인
- index.html 파일이 루트 폴더에 있는지 확인

### 사이트가 업데이트되지 않는 경우:
- Actions 탭에서 배포 상태 확인
- 브라우저 캐시 삭제 후 재시도

## 6. 고급 설정

### 커스텀 도메인 사용하기:
1. 도메인을 구매
2. Settings → Pages → Custom domain에 도메인 입력
3. DNS 설정에서 CNAME 레코드 추가

### HTTPS 강제 활성화:
Settings → Pages → "Enforce HTTPS" 체크 