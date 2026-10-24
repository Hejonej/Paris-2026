# Afield Mobile · Sprint 2

Expo Router로 만든 React Native 앱입니다. 변경 범위는 `afield-mobile/`뿐입니다. 운영 main, Cloudflare 배포 설정과 웹 여행 데이터에는 연결하거나 쓰지 않습니다.

## 맥북에서 새 ZIP으로 갱신하기

1. 기존 Expo 터미널에서 **Control + C**로 서버를 종료합니다.
2. GitHub에서 `feature/afield-mobile-shell` 브랜치를 선택하고 **Code → Download ZIP**을 누릅니다. 기존 폴더와 합치지 말고 새 위치에 압축을 풉니다. 구분을 위해 이전 폴더 이름을 먼저 바꿔 두세요.
3. 새로 압축을 푼 폴더 안의 `afield-mobile`에서 터미널을 엽니다. 기본 다운로드 경로라면:

```bash
cd ~/Downloads/Paris-2026-feature-afield-mobile-shell/afield-mobile
npm ci --cache "$PWD/.npm-cache"
npx expo start --clear
```

`npm ci`는 함께 제공하는 package-lock.json의 검증된 버전을 설치합니다. 별도 캐시 경로는 이전의 사용자 npm 캐시 권한 오류를 피합니다. sudo는 필요하지 않습니다.

4. 맥북과 iPhone을 같은 Wi-Fi에 연결하고, 카메라로 터미널 QR을 스캔해 **Expo Go**로 엽니다. 이전 서버의 QR 대신 새 터미널의 QR을 사용하세요.
5. 연결이 어려울 때는 서버를 종료하고 `npx expo start --tunnel --clear`를 사용합니다. tunnel용 추가 패키지 설치가 필요할 수 있습니다.
6. `Project is incompatible with this version of Expo Go`가 표시되면 오류 전문을 확인해야 합니다. 이 프로젝트는 기존 Sprint 1과 같은 **SDK 54**이며, 설치된 Expo Go와 SDK 호환이 필요합니다.

GitHub 최신 브랜치 ZIP: https://github.com/Hejonej/Paris-2026/archive/refs/heads/feature/afield-mobile-shell.zip

## 구현

- Chapters: 이미지가 있는 컴팩트한 여행 목록. 카드 전체를 눌러 여행을 엽니다.
- 새 여행: 이름/도시 필수, 날짜 선택. 실제 달력 날짜·순서·최대 31일 검증. 빈 일정으로 생성하며 이 기기에 저장합니다.
- 홈: 구상 중 / 준비 중 / 여행 중 / 다녀온 여행에 맞는 다음 행동과 여행별 일정·후보 수를 보여 줍니다.
- 일정: 여행 날짜별 가로 선택, 시간순의 조밀한 타임라인. 처음 날짜부터 열리며 날짜 미정 여행에 Paris 일정을 표시하지 않습니다.
- 장소 발견 → 상세: Paris 예시 장소 2개, 후보 저장, 날짜·시간을 직접 골라 일정에 추가, 외부 지도 이동.
- 후보 저장은 일정을 변경하지 않습니다. 중복 저장은 한 번만 반영합니다. 일정 추가는 기존 항목을 덮어쓰지 않으며 같은 시간 충돌과 같은 날짜의 중복 장소를 거부합니다. 기존 MUST·일정·다른 여행은 보존합니다.
- 후보·기록 탭과 여행 전환을 유지합니다. 잘못된 여행 주소는 Chapters로 돌아갑니다.
- 한국어는 iOS/Android 시스템 산세리프를 사용합니다. 따뜻한 배경·그린 강조·얇은 구분선으로 여행 저널과 플래너를 함께 표현합니다.

## 저장 및 범위

AsyncStorage의 `afield:sprint2:trips:v1` 키에 여행 전체를 저장합니다. 서버·운영 데이터·AI 추천 API를 사용하지 않습니다. 저장 읽기 실패 시 기존 값을 덮어쓰지 않도록 앱 변경 화면을 잠그고 오류를 표시합니다. 저장 쓰기 실패도 화면에 표시합니다. 앱 삭제/Expo Go 저장소 초기화 시 데이터가 사라질 수 있으며, 다른 기기와 동기화되지 않습니다. ZIP 폴더나 개발 서버 주소가 바뀌면 Expo Go 프로젝트 저장 공간이 달라질 수도 있으므로 기기 간 백업으로 간주하지 마세요.

Paris/Berlin은 Sprint 1의 예시 여행입니다. 첫 실행에만 초기값을 사용하며 이후 로컬 여행을 복원합니다. Sprint 1 원본의 네 일정은 보존했고 첫 항목은 MUST 보호 예시로 표시합니다. 원격 사진은 분위기 참고 이미지로, 실제 장소 사진을 보증하지 않습니다. 네트워크가 없으면 이미지 대신 배경색이 보입니다.

기록 작성, 날짜 미정 여행의 날짜 편집, 직접 장소 등록, Paris 외 도시 추천, AI/서버 연동은 아직 구현하지 않았습니다. 기록 탭은 기존의 빈 상태 화면을 유지합니다. 날짜 있는 새 여행을 만들면 일정 배치를 시험할 수 있습니다.

## 검증

```bash
npm run typecheck
npm test
npx expo install --check
npx expo export --platform ios --output-dir /tmp/afield-ios-check
```

- 확인된 설치 버전: Expo 54.0.38 / Router 6.0.24 / React 19.1.0 / React Native 0.81.5 / AsyncStorage 2.2.0.
- 타입 검사 통과, 로직·저장 복원 테스트 8개 통과, iOS Hermes 번들 생성 통과.
- Expo 의존성 검사는 로컬 SDK 호환성 맵 기준으로 통과했습니다.
- 현재 환경에 iOS 시뮬레이터가 없어 실제 iPhone 렌더링·터치 검증은 아래 체크리스트로 진행해야 합니다.
- npm audit은 SDK 54 도구 체인과 Router의 전이 의존성을 포함해 경고 10개(높음 6/중간 4)를 보고합니다. 이 작업에서는 SDK를 바꾸는 강제 수정은 적용하지 않았습니다.

### iPhone 확인 목록

1. Chapters에서 Paris 카드의 이미지/텍스트 어디든 탭 → 홈/일정/후보/기록 탭 확인.
2. 일정에서 12일/13일의 원본 일정 확인. 14일은 빈 상태, 가로 날짜 선택과 스크롤 확인.
3. 14일 → 장소 찾기 → Ofr. Paris 상세 → 후보 저장. 후보 탭에는 보이지만 일정에는 아직 없어야 합니다.
4. 상세에서 14일 11:00 배치 → 일정 보기. 14일에 한 항목만 생기며 원본 일정/MUST는 유지돼야 합니다.
5. 12일 10:00 배치 시 기존 일정 충돌 안내, 같은 날짜·장소 재추가 시 중복 안내 확인.
6. 여행 변경 → Berlin. Paris 일정과 후보가 섞이지 않는지 확인하고 다시 Paris로 이동.
7. 새 여행을 이름/도시/날짜와 함께 생성 → 빈 일정 확인. 날짜 미정 생성도 별도로 확인.
8. 앱을 닫았다 다시 열어 새 여행·후보·배치한 일정이 복원되는지 확인.
9. 추천/상세의 뒤로가기, 지도 이동 후 앱 복귀, 작은 화면·큰 글자·키보드 표시 시 스크롤 확인.
