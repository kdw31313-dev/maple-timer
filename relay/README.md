# 텔레그램 중계 배포

Cloudflare Workers에 `worker.mjs`를 배포합니다. CLI에서는 이 폴더의 `wrangler.jsonc`를 사용합니다.

- `TELEGRAM_BOT_TOKEN`에는 BotFather가 발급한 봇 토큰을 설정합니다.
- `TELEGRAM_CHAT_ID`에는 알림을 받을 채팅 ID를 설정합니다. 토픽이 있는 채팅은 `TELEGRAM_THREAD_ID`도 설정합니다.
- `MAPLE_RELAY_KEY`에는 무작위 32바이트를 Base64URL로 인코딩한 값을 설정합니다.
- 네 값 모두 대시보드의 **Variables and Secrets**에서 **Secret**으로 설정합니다.

배포된 중계 주소는 `https://<worker>.<subdomain>.workers.dev/telegram`입니다. 기존 개인 실행 링크의 암호화 설정에 `relayUrl`과 `relayKey`를 넣으면 브라우저가 중계 서버를 사용합니다. 각 브라우저에서 기존 개인 실행 링크를 다시 열어 갱신합니다. 테스트 메시지를 보낸 뒤 룬 알림이 같은 채팅에 도착하는지 확인합니다.

중계 서버는 정해진 페이지에서 보낸 인증 요청만 처리합니다. 메시지 내용은 브라우저가 보내고, 채팅과 토픽은 서버 설정에서 정합니다.
