/**
 * PortalGuide - 그란디스 280~290 (아르테리아, 카르시온, 탈라하트) 맵 지형 조감도 & 히든 포탈 가이드
 */
class PortalGuide {
  constructor() {
    this.guideData = [
      {
        region: '아르테리아 (Lv.280~)',
        maps: [
          {
            name: '서쪽 외곽지역 1 / 2 (Lv.280 - 젠당 40마리)',
            layoutType: 'arteria-west',
            svgDiagram: `
              <svg viewBox="0 0 400 160" class="map-diagram-svg">
                <!-- 배경 및 테두리 -->
                <rect x="0" y="0" width="400" height="160" rx="8" fill="#121624" stroke="rgba(255,255,255,0.1)"/>
                <!-- 1층 발판 -->
                <rect x="20" y="135" width="360" height="8" rx="4" fill="#3a4563"/>
                <!-- 2층 발판 -->
                <rect x="50" y="95" width="130" height="6" rx="3" fill="#3a4563"/>
                <rect x="220" y="95" width="130" height="6" rx="3" fill="#3a4563"/>
                <!-- 3층 상단 발판 -->
                <rect x="30" y="45" width="150" height="6" rx="3" fill="#4a5a82"/>
                <rect x="220" y="45" width="150" height="6" rx="3" fill="#4a5a82"/>
                <!-- 히든 포탈 7시 -->
                <circle cx="35" cy="130" r="7" fill="#00f2fe" stroke="#fff" stroke-width="2"/>
                <text x="35" y="120" fill="#00f2fe" font-size="10" font-weight="bold" text-anchor="middle">📍 7시 포탈</text>
                <!-- 히든 포탈 5시 -->
                <circle cx="365" cy="130" r="7" fill="#00f2fe" stroke="#fff" stroke-width="2"/>
                <text x="365" y="120" fill="#00f2fe" font-size="10" font-weight="bold" text-anchor="middle">📍 5시 포탈</text>
                <!-- 연결 화살표 (7시 -> 11시 상단) -->
                <path d="M 35 120 Q 20 80 50 45" fill="none" stroke="#00f2fe" stroke-width="2" stroke-dasharray="4,4"/>
                <polygon points="50,45 42,50 50,55" fill="#00f2fe"/>
                <!-- 야누스 추천 설치 위치 -->
                <circle cx="105" cy="40" r="5" fill="#f6d365"/>
                <text x="105" y="30" fill="#f6d365" font-size="9" text-anchor="middle">⚡ 야누스</text>
                <circle cx="295" cy="40" r="5" fill="#f6d365"/>
                <text x="295" y="30" fill="#f6d365" font-size="9" text-anchor="middle">⚡ 야누스</text>
              </svg>
            `,
            portals: [
              { pos: '좌측 하단 7시 포탈', destination: '최상층 11시 발판 직행', usage: '상단 이동 후 야누스 재설치' },
              { pos: '우측 하단 5시 포탈', destination: '최상층 1시 발판 직행', usage: '상단 우측 구역 정제' }
            ],
            tip: '하단에서 포탈을 타고 최상층으로 직행한 뒤, 야누스/파운틴을 설치하고 1층으로 하향 점프하며 사냥하는 시계방향 순환 루트가 가장 좋습니다.'
          },
          {
            name: '최하층 통로 2 (Lv.282 - 젠당 40마리 / 6분 1,920마리 오피셜 인기맵)',
            layoutType: 'arteria-passage2',
            svgDiagram: `
              <svg viewBox="0 0 400 160" class="map-diagram-svg">
                <rect x="0" y="0" width="400" height="160" rx="8" fill="#121624" stroke="rgba(255,255,255,0.1)"/>
                <!-- 1층 메인 바닥 -->
                <rect x="15" y="135" width="370" height="8" rx="4" fill="#3a4563"/>
                <!-- 2층 좌/우 발판 -->
                <rect x="30" y="90" width="110" height="6" rx="3" fill="#3a4563"/>
                <rect x="260" y="90" width="110" height="6" rx="3" fill="#3a4563"/>
                <!-- 3층 중앙 메인 발판 -->
                <rect x="120" y="45" width="160" height="7" rx="3" fill="#6b73ff"/>
                <!-- 1층 중앙 포탈 -->
                <circle cx="200" cy="130" r="7" fill="#ff4b2b" stroke="#fff" stroke-width="2"/>
                <text x="200" y="120" fill="#ff4b2b" font-size="10" font-weight="bold" text-anchor="middle">📍 중앙 1층 포탈</text>
                <!-- 3층 중앙 도착 지점 -->
                <path d="M 200 120 L 200 55" fill="none" stroke="#ff4b2b" stroke-width="2" stroke-dasharray="4,4"/>
                <polygon points="200,55 195,63 205,63" fill="#ff4b2b"/>
                <!-- 야누스 1층 좌우 설치 -->
                <circle cx="70" cy="130" r="6" fill="#f6d365"/>
                <text x="70" y="120" fill="#f6d365" font-size="9" text-anchor="middle">⚡ 야누스L</text>
                <circle cx="330" cy="130" r="6" fill="#f6d365"/>
                <text x="330" y="120" fill="#f6d365" font-size="9" text-anchor="middle">⚡ 야누스R</text>
              </svg>
            `,
            portals: [
              { pos: '중앙 1층 포탈', destination: '3층 중앙 발판 직행', usage: '중앙 3층 직행 후 주력기 발사' },
              { pos: '좌측 2층 포탈', destination: '우측 상단 텔레포트', usage: '순환 동선' }
            ],
            tip: '야누스 노드 2개를 1층 좌우에 깔아두고 중앙 포탈을 통해 3층 중앙으로 올라가면, 이동 없이 무지성 제자리 사냥이 가능합니다!'
          }
        ]
      },
      {
        region: '카르시온 (Lv.285~)',
        maps: [
          {
            name: '거대 산호 군락 3 (Lv.286 - 젠당 40마리 / 6분 1,920마리 오피셜 인기맵)',
            layoutType: 'carcion-coral3',
            svgDiagram: `
              <svg viewBox="0 0 400 160" class="map-diagram-svg">
                <rect x="0" y="0" width="400" height="160" rx="8" fill="#121624" stroke="rgba(255,255,255,0.1)"/>
                <!-- 산호 구역 발판 지형 -->
                <rect x="20" y="135" width="360" height="8" rx="4" fill="#2d4059"/>
                <rect x="40" y="90" width="100" height="6" rx="3" fill="#2d4059"/>
                <rect x="260" y="90" width="100" height="6" rx="3" fill="#2d4059"/>
                <rect x="140" y="45" width="120" height="6" rx="3" fill="#00f2fe"/>
                <!-- 7시 포탈 -->
                <circle cx="45" cy="130" r="7" fill="#00f2fe" stroke="#fff" stroke-width="2"/>
                <text x="45" y="120" fill="#00f2fe" font-size="10" font-weight="bold" text-anchor="middle">📍 7시 히든포탈</text>
                <!-- 연결 라인 -->
                <path d="M 45 120 Q 100 30 310 85" fill="none" stroke="#00f2fe" stroke-width="2" stroke-dasharray="4,4"/>
                <polygon points="310,85 302,80 305,90" fill="#00f2fe"/>
                <circle cx="200" cy="40" r="5" fill="#f6d365"/>
                <text x="200" y="30" fill="#f6d365" font-size="9" text-anchor="middle">⚡ 최상단 야누스</text>
              </svg>
            `,
            portals: [
              { pos: '좌측 하단 7시 포탈', destination: '우측 상단 발판 직행', usage: '상단 직행 포탈' },
              { pos: '중앙 2층 포탈', destination: '최상층 중앙 발판 이동', usage: '야누스 재설치' }
            ],
            tip: '7시 포탈 타자마자 우상단으로 순간이동하여 최상단 야누스를 까는 1초 복귀 빌드가 가장 효율이 높습니다.'
          },
          {
            name: '잔잔한 해안가 2 / 3 (Lv.286 - 젠당 40마리 / 6분 1,920마리)',
            layoutType: 'carcion-coast2',
            svgDiagram: `
              <svg viewBox="0 0 400 160" class="map-diagram-svg">
                <rect x="0" y="0" width="400" height="160" rx="8" fill="#121624" stroke="rgba(255,255,255,0.1)"/>
                <rect x="15" y="135" width="370" height="8" rx="4" fill="#2d4059"/>
                <rect x="50" y="90" width="300" height="6" rx="3" fill="#2d4059"/>
                <rect x="80" y="45" width="240" height="6" rx="3" fill="#4a5a82"/>
                <circle cx="200" cy="85" r="7" fill="#ff4b2b" stroke="#fff" stroke-width="2"/>
                <text x="200" y="75" fill="#ff4b2b" font-size="10" font-weight="bold" text-anchor="middle">📍 2층 중앙 포탈</text>
                <path d="M 200 75 Q 120 30 90 40" fill="none" stroke="#ff4b2b" stroke-width="2" stroke-dasharray="4,4"/>
                <polygon points="90,40 98,35 96,45" fill="#ff4b2b"/>
              </svg>
            `,
            portals: [
              { pos: '2층 중앙 포탈', destination: '좌측 3층 상단 이동', usage: '반시계방향 순환 루틴' }
            ],
            tip: '2층 중앙 포탈 이용 시 동선 낭비 없이 맵 전체를 7.5초 젠타임 내 순환할 수 있습니다.'
          }
        ]
      }
    ];
  }
}

window.portalGuide = new PortalGuide();
