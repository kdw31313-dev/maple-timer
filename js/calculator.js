/**
 * Calculator - 메이플스토리 사냥 효율 및 일일 메소 제한 공식 연산 엔진 (100% 동적 실시간 수식)
 */
class HuntingCalculator {
  constructor() {
    this.mapDatabase = [
      // --- 아르테리아 (Lv.280~284) ---
      { region: '아르테리아', name: '북쪽 외곽지역', mobLevel: 280, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1450000 },
      { region: '아르테리아', name: '서쪽 외곽지역', mobLevel: 280, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1460000 },
      { region: '아르테리아', name: '남쪽 외곽지역', mobLevel: 281, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1480000 },
      { region: '아르테리아', name: '동쪽 외곽지역', mobLevel: 281, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1490000 },
      { region: '아르테리아', name: '외곽 전투지역 1', mobLevel: 280, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1460000 },
      { region: '아르테리아', name: '외곽 전투지역 2', mobLevel: 281, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1490000 },
      { region: '아르테리아', name: '최하층 통로 1', mobLevel: 282, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1520000 },
      { region: '아르테리아', name: '최하층 통로 2 (인기)', mobLevel: 282, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1530000 },
      { region: '아르테리아', name: '최하층 통로 3', mobLevel: 282, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1530000 },
      { region: '아르테리아', name: '최하층 통로 4', mobLevel: 283, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1550000 },
      { region: '아르테리아', name: '최하층 통로 5', mobLevel: 283, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1550000 },
      { region: '아르테리아', name: '최하층 통로 6', mobLevel: 283, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1550000 },
      { region: '아르테리아', name: '최상층 통로 1', mobLevel: 284, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1580000 },
      { region: '아르테리아', name: '최상층 통로 2', mobLevel: 284, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1580000 },

      // --- 카르시온 (Lv.285~289) ---
      { region: '카르시온', name: '거대 산호 군락 1', mobLevel: 285, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1620000 },
      { region: '카르시온', name: '거대 산호 군락 3 (인기)', mobLevel: 286, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1640000 },
      { region: '카르시온', name: '잔잔한 해안가 2', mobLevel: 286, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1670000 },
      { region: '카르시온', name: '어둠이 내리는 나무줄기 1', mobLevel: 288, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1770000 }
    ];
  }

  getExpLevelRatio(userLevel, mobLevel) {
    const diff = userLevel - mobLevel;
    if (diff === 0 || diff === 1 || diff === -1) return 1.20;
    if (diff === 2 || diff === -2) return 1.10;
    if (diff === 3 || diff === -3 || diff === 4 || diff === -4) return 1.05;
    if (diff >= 5 && diff <= 9) return 1.00;
    if (diff <= -5 && diff >= -9) return 0.95;
    if (diff >= 10 && diff <= 20) return Math.max(0.70, 1.00 - (diff - 9) * 0.05);
    if (diff < -10) return Math.max(0.10, 0.90 - (-diff - 10) * 0.10);
    return 1.00;
  }

  /**
   * 100% 동적 연산 메서드
   */
  calculate(params) {
    const {
      userLevel = 280,
      mapIndex = 7,
      userCustomKills6min = null,
      killRatio = 100,
      expBuffPct = 200,
      mesoRatePct = 137,
      dropRatePct = 100
    } = params;

    const map = this.mapDatabase[mapIndex] || this.mapDatabase[7];

    // 1시간 오피셜 최대 마릿수 (36마리: 17,280, 40마리: 19,200)
    const hourlyMaxKills = map.hourlyMax || (map.spawnPerWave * 480);
    const max6MinKills = Math.round(hourlyMaxKills / 10);

    // 사용자가 직접 6분 마릿수를 작성했으면 그 값을 사용, 없으면 젠컷 비율 반영 계산
    let actual6MinKills = userCustomKills6min !== null && !isNaN(userCustomKills6min) && userCustomKills6min > 0
      ? userCustomKills6min
      : Math.round(max6MinKills * (killRatio / 100));

    const hourlyKills = actual6MinKills * 10;
    const twoHourKills = hourlyKills * 2;
    const thirtyMinKills = Math.round(hourlyKills / 2);

    // 1) 아이템 드롭률 % 기반 메소 주머니 드롭률 (67% 이상시 100% 확정)
    const mesoBagDropRate = Math.min(100, Math.round((dropRatePct / 67) * 100));

    // 2) 몬스터 메소 주머니 기본 평균값 (a_base = 몬스터 레벨 * 7.5)
    const baseMesoPerBag = map.mobLevel * 7.5;
    // 메획% 반영 실질 주머니 1개당 평균 메소 (a = a_base * (1 + 메획%/100))
    const actualMesoPerBag = Math.round(baseMesoPerBag * (1 + mesoRatePct / 100));

    // 3) 시간별 실질 획득 메소 연산
    const hourlyMesoTotal = Math.round(actualMesoPerBag * hourlyKills * (mesoBagDropRate / 100));
    const thirtyMinMeso = Math.round(hourlyMesoTotal / 2);
    const twoHourMesoTotal = hourlyMesoTotal * 2;

    // 4) 캐릭터 레벨별 기본 메소 제한 상한선 (메획 0% 기준 d_base)
    let baseCapMeso = 150000000;
    if (userLevel >= 280) {
      baseCapMeso = 170000000; // 280렙 이상: 1.7억 메소
    } else if (userLevel >= 270) {
      baseCapMeso = 160000000; // 270렙대: 1.6억 메소
    }

    // 5) 메획% 반영 최종 메소 상한선 (d = d_base * (1 + 메획%/100))
    const totalCapMesoWithRate = Math.round(baseCapMeso * (1 + mesoRatePct / 100));

    // 6) 메소 제한 도달까지 잡아야 하는 총 몬스터 마릿수 (c = d_base / a_base)
    const requiredKillsForCap = Math.ceil(baseCapMeso / baseMesoPerBag);

    // 7) 필요 재획량 (재획비 개수 = c / (1시간 마릿수 * 2))
    const requiredRehoekCount = (requiredKillsForCap / (hourlyKills * 2 || 1)).toFixed(3);

    // 8) 메소 제한 도달까지 필요한 소요 시간 (시간 & 분)
    const hoursNeeded = requiredKillsForCap / (hourlyKills || 1);
    const totalMinutesNeeded = Math.round(hoursNeeded * 60);
    const capHours = Math.floor(totalMinutesNeeded / 60);
    const capMinutes = totalMinutesNeeded % 60;
    const timeToCapFormatted = `${capHours}시간 ${capMinutes}분`;

    // 9) 경험치 & 솔 에르다 조각 연산
    const expLevelMult = this.getExpLevelRatio(userLevel, map.mobLevel);
    const expPerMob = map.baseExp * expLevelMult * (expBuffPct / 100);
    const hourlyExpTotal = expPerMob * hourlyKills;
    const twoHourExpTotal = expPerMob * twoHourKills;

    const solErdaPiecesHourly = (hourlyKills / 1000) * 1.8 * (dropRatePct / 100);
    const solErdaPieces2Hr = solErdaPiecesHourly * 2;

    return {
      mapInfo: map,
      userLevel,
      max6MinKills,
      actual6MinKills,
      thirtyMinKills,
      hourlyKills,
      twoHourKills,
      expLevelMult,
      dropRatePct,
      mesoRatePct,
      mesoBagDropRate,
      baseMesoPerBag,
      actualMesoPerBag,
      baseCapMeso,
      totalCapMesoWithRate,
      requiredKillsForCap,
      requiredRehoekCount,
      thirtyMinMeso,
      hourlyMesoTotal,
      twoHourMesoTotal,
      timeToCapFormatted,
      hourlyExpTotal,
      twoHourExpTotal,
      solErdaPieces2Hr: solErdaPieces2Hr.toFixed(1)
    };
  }
}

window.huntingCalculator = new HuntingCalculator();
