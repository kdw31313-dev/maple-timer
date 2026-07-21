/**
 * PortalGuide - 그란디스 280~290 (아르테리아, 카르시온, 탈라하트) 맵별 히든 포탈 위치 및 동선 가이드
 */
class PortalGuide {
  constructor() {
    this.guideData = [
      {
        region: '아르테리아 (Lv.280~)',
        maps: [
          {
            name: '서쪽 외곽지역 1 / 2 (Lv.280)',
            portals: [
              { pos: '좌측 하단 7시 포탈', destination: '최상층 11시 발판 이동', usage: '상단 이동 후 솔 야누스/파운틴 설치' },
              { pos: '우측 하단 5시 포탈', destination: '최상층 1시 발판 이동', usage: '상단 우측 구역 정제' }
            ],
            tip: '하단에서 포탈을 타고 최상층으로 올라가 야누스를 재설치한 뒤 하향 점프 사냥으로 1층 복귀 루틴 추천.'
          },
          {
            name: '최하층 통로 2 (Lv.282 - 인기 맵)',
            portals: [
              { pos: '중앙 1층 포탈', destination: '3층 중앙 발판 이동', usage: '중앙 3층 직행 후 좌/우 사냥 스킬 분배' },
              { pos: '좌측 2층 포탈', destination: '우측 상단 텔레포트', usage: '시계방향 젠컷 동선' }
            ],
            tip: '야누스 노드 2개를 1층 좌우에 깔고 중앙 포탈로 3층 올라가면 무지성 제자리 사냥 가능.'
          },
          {
            name: '최상층 통로 1 ~ 4 (Lv.284)',
            portals: [
              { pos: '맵 양쪽 끝 히든 포탈', destination: '반대편 상단 복귀 포탈', usage: '순환동선 전용' }
            ],
            tip: '포탈 이동 후 아래로 떨어지며 주력기를 사용하는 직선 젠컷 빌드.'
          }
        ]
      },
      {
        region: '카르시온 (Lv.285~)',
        maps: [
          {
            name: '거대 산호 군락 3 (Lv.285 - 인기 맵)',
            portals: [
              { pos: '좌측 하단 7시 포탈', destination: '우측 상단 발판 직행', usage: '상단 직행 포탈' },
              { pos: '중앙 2층 히든 포탈', destination: '최상층 중앙 발판 이동', usage: '야누스 재설치 동선' }
            ],
            tip: '7시 포탈 타자마자 오른쪽 상단에 야누스를 까는 1초 복귀 빌드가 가장 효율이 높습니다.'
          },
          {
            name: '잔잔한 해안가 2 / 3 (Lv.286~287)',
            portals: [
              { pos: '2층 중앙 포탈', destination: '좌측 3층 상단 이동', usage: '반시계방향 순환 루틴' }
            ],
            tip: '2층 포탈 이용 시 동선 낭비 없이 맵 전체를 7.5초 젠타임 내 순환 가능.'
          },
          {
            name: '어둠이 내리는 나무줄기 1 / 2 (Lv.288~289)',
            portals: [
              { pos: '나무줄기 하단 포탈', destination: '최상단 가지 발판 이동', usage: '상하 텔레포트' }
            ],
            tip: '하단 포탈 진입 후 상단에서 아래로 밀고 내려오는 직관적 사냥 동선.'
          }
        ]
      },
      {
        region: '탈라하트 (Lv.290~)',
        maps: [
          {
            name: '별빛이 내리는 골짜기 1 / 3 (Lv.290)',
            portals: [
              { pos: '입구 중앙 히든 포탈', destination: '상단 유적 발판 직행', usage: '고층 이동' }
            ],
            tip: '신규 지역 특유의 3층 구조로 중앙 포탈을 통한 상단 스킬 배치가 핵심.'
          }
        ]
      }
    ];
  }
}

window.portalGuide = new PortalGuide();
