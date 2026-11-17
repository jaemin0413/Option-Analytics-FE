# Option frontend

v1 백엔드 화면. 디자인 시안은 Claude Design 캔버스 "Option v1 화면".

```bash
npm install
npm run dev
```

개발 서버는 `http://localhost:5173/option/`, `/api` 요청은 `localhost:8080` 백엔드로 넘긴다. 홈서버에 붙이려면 `.env.local`에 `API_URL=http://<apps IP>:8090`.

## 배포

gateway Nginx가 `https://1.230.71.10/option/`(Funnel 주소도 같은 경로)으로 서빙한다. `/api/`는 Nginx가 이미 백엔드로 넘기고 있다.

처음 한 번은 gateway에서 `deploy/gateway-setup.sh`를 sudo로 실행해 Nginx 설정을 넣는다. 그 뒤로는 아래만 하면 된다.

```bash
bash deploy/deploy.sh
```
