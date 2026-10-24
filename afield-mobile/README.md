# Afield Mobile Shell · Sprint 01
Expo SDK 54 + Expo Router 기반 **실제 React Native 앱 셸**. 기존 Cloudflare 웹 프로젝트와 분리된 별도 폴더/브랜치이며 운영 환경과 데이터는 변경하지 않음.

## Run on Mac
```bash
cd afield-mobile
npm install
npx expo start
```
iPhone Expo Go에서 QR을 열어 테스트한다. 동일 Wi‑Fi 접근이 어렵다면 `npx expo start --tunnel` (추가 설치 요구 가능). `npm run typecheck`로 타입 검사한다.

## Screens
Chapters → Trip Home → 4 tabs (Home/Itinerary/Candidates/Journal), recommendation modal.
All trip names, dates, schedule, and recommendation in this version are **fake fixtures** and do not persist. AI/server, user login, candidates save, protected changes, onboarding and production data migration are intentionally outside Sprint 01.

## QA
- Chapters → Paris → tabs → Chapters round trip
- Chapters → Berlin returns Berlin trip context and doesn't leak Paris selection
- date selection in itinerary
- recommendation modal open and close
- no network, localStorage or production mutation

## Next
Replace mock context with trip-scoped store, persisted state and real backend; add selection approval/Undo, first-plan flows and native-device QA. Use `npx expo install --check` to validate SDK dependency compatibility.
