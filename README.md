# tikcx v1

결혼식 하객이 QR로 사진·영상을 올리고, 신랑·신부가 한 갤러리에서 받아보는 서비스.

## 화면
- `/w/[주소]` 하객 업로드 (QR이 여는 페이지, 로그인 없음)
- `/c/[주소]?k=[커플키]` 신랑·신부 전용 갤러리
- `/admin` 스튜디오 관리자: 예식 만들기, QR 저장, 커플 링크 복사, 작가 원본 올리기

## 구조
- Next.js (Vercel) + Supabase (서울 리전)
- 사진은 휴대폰에서 Supabase 저장소로 바로 올라감 (서버를 거치지 않아 빠름)
- 모든 데이터 접근은 서버 API 경유. 테이블과 저장소는 비공개(RLS)
- 미리보기용 작은 사진은 업로드할 때 휴대폰에서 만들어 같이 올림

## 환경변수 (Vercel > Settings > Environment Variables)
| 이름 | 값 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API의 Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API Keys의 service_role (비밀 키) |
| `ADMIN_KEY` | 관리자 화면 비밀번호로 쓸 긴 문자열 |

## 현재 제한 (무료 플랜)
- 파일당 50MB (Supabase Free). 긴 영상은 Pro 전환 후 상향
- 무료/원본 구분은 화면 표시만. 결제 붙일 때 서버에서 워터마크 이미지 생성으로 바꿔야 함
- 30일 자동 삭제 미구현
- DB 스키마: `supabase/schema.sql` (이미 적용됨)

## AI 장면 분류
- 환경변수 `ANTHROPIC_API_KEY`가 있으면 신랑·신부 앨범에 "AI로 장면별 정리하기" 버튼이 보입니다.
- 미리보기(썸네일)만 AI에 보내고, 결과는 저장소 `scenes/<예식 id>.json`에 저장합니다. 예식 삭제·보관 기간 종료 시 같이 지워집니다.
- 장면 목록: `lib/scenes.ts`, AI 지시문: `lib/scenesServer.ts`
