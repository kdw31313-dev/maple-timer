/**
 * Calculator - 메이플스토리 사냥 효율 계산기 (맵 마릿수 DB, 레벨 패널티/보너스, 경험치/메소 기댓값 연산)
 */
class HuntingCalculator {
  constructor() {
    // 그란디스 주요 사냥터 DB (레벨, 젠당 마릿수, 기본 경험치, 기본 메소)
    this.mapDatabase = [
      // --- 아르테리아 (Lv.280~) ---
      { region: '아르테리아', name: '서쪽 외곽지역 1', mobLevel: 280, spawnPerWave: 25, baseExp: 1450000, baseMeso: 2100 },
      { region: '아르테리아', name: '서쪽 외곽지역 2', mobLevel: 280, spawnPerWave: 26, baseExp: 1460000, baseMeso: 2120 },
      { region: '아르테리아', name: '동쪽 외곽지역 1', mobLevel: 281, spawnPerWave: 25, baseExp: 1480000, baseMeso: 2140 },
      { region: '아르테리아', name: '동쪽 외곽지역 2', mobLevel: 281, spawnPerWave: 27, baseExp: 1490000, baseMeso: 2150 },
      { region: '아르테리아', name: '최하층 통로 1', mobLevel: 282, spawnPerWave: 28, baseExp: 1520000, baseMeso: 2180 },
      { region: '아르테리아', name: '최하층 통로 2 (인기)', mobLevel: 282, spawnPerWave: 30, baseExp: 1530000, baseMeso: 2200 },
      { region: '아르테리아', name: '최하층 통로 3', mobLevel: 283, spawnPerWave: 28, baseExp: 1550000, baseMeso: 2220 },
      { region: '아르테리아', name: '최상층 통로 1', mobLevel: 284, spawnPerWave: 29, baseExp: 1580000, baseMeso: 2250 },

      // --- 카르시온 (Lv.285~) ---
      { region: '카르시온', name: '거대 산호 군락 1', mobLevel: 285, spawnPerWave: 26, baseExp: 1620000, baseMeso: 2280 },
      { region: '카르시온', name: '거대 산호 군락 3 (인기)', mobLevel: 285, spawnPerWave: 30, baseExp: 1640000, baseMeso: 2300 },
      { region: '카르시온', name: '잔잔한 해안가 2', mobLevel: 286, spawnPerWave: 27, baseExp: 1670000, baseMeso: 2330 },
      { region: '카르시온', name: '잔잔한 해안가 3', mobLevel: 287, spawnPerWave: 29, baseExp: 1700000, baseMeso: 2360 },
      { region: '카르시온', name: '어둠이 내리는 나무줄기 1', mobLevel: 288, spawnPerWave: 28, baseExp: 1730000, baseMeso: 2390 },
      { region: '카르시온', name: '휘감기는 숲 2', mobLevel: 289, spawnPerWave: 29, baseExp: 1770000, baseMeso: 2420 },

      // --- 탈라하트 (Lv.290~) ---
      { region: '탈라하트', name: '별빛이 내리는 골자기 1', mobLevel: 290, spawnPerWave: 30, baseExp: 1820000, baseMeso: 2480 },
      { region: '탈라하트', name: '별빛이 내리는 골자기 3', mobLevel: 291, spawnPerWave: 31, baseExp: 1860000, baseMeso: 2520 },
      { region: '탈라하트', name: '고대 신전 외각 2', mobLevel: 293, spawnPerWave: 32, baseExp: 1920000, baseMeso: 2580 },

      // --- 도원경 / 오디움 (Lv.265~275) ---
      { region: '도원경', name: '봄의 양지 1', mobLevel: 275, spawnPerWave: 26, baseExp: 1320000, baseMeso: 1950 },
      { region: '오디움', name: '성곽 안뜰 1', mobLevel: 270, spawnPerWave: 25, baseExp: 1200000, baseMeso: 1820 }
    ];
  }

  /**
   * 레벨 차이에 따른 경험치 배율 계산 (±1레벨 120%, ±2~4레벨 110~105%, 5~9레벨 100%, 10레벨 이상 감가)
   */
  getExpLevelRatio(userLevel, mobLevel) {
    const diff = userLevel - mobLevel;

    if (diff === 0) return 1.20; // 0레벨 차이 120%
    if (diff === 1 || diff === -1) return 1.20; // ±1레벨 120%
    if (diff === 2 || diff === -2) return 1.10;
    if (diff === 3 || diff === -3) return 1.05;
    if (diff === 4 || diff === -4) return 1.05;
    if (diff >= 5 && diff <= 9) return 1.00;
    if (diff <= -5 && diff >= -9) return 0.95;
    if (diff >= 10 && diff <= 20) return Math.max(0.70, 1.00 - (diff - 9) * 0.05);
    if (diff < -10) return Math.max(0.10, 0.90 - (-diff - 10) * 0.10);

    return 1.00;
  }

  /**
   * 레벨 차이에 따른 메소 배율 계산 (±10레벨 이내 100%, 초과시 패널티)
   */
  getMesoLevelRatio(userLevel, mobLevel) {
    const diff = userLevel - mobLevel;
    if (Math.abs(diff) <= 10) return 1.00;
    if (diff > 10) return Math.max(0.0, 1.00 - (diff - 10) * 0.05);
    return Math.max(0.0, 1.00 - (-diff - 10) * 0.05);
  }

  /**
   * 종합 사냥 효율 계산
   */
  calculate(params) {
    const {
      userLevel = 280,
      mapIndex = 5, // 최하층 통로 2
      killRatio = 100, // 젠컷 % (90~100)
      expBuffPct = 200, // 경험치 버프 총합 % (기본 100% + 경쿠100% 등)
      mesoRatePct = 100, // 메획 % (장비메획 + 재획비 등)
      dropRatePct = 100 // 아획 %
    } = params;

    const map = this.mapDatabase[mapIndex] || this.mapDatabase[5];

    // 1분당 8젠 (7.5초당 1젠)
    const wavesPerMinute = 8;
    const max6MinKills = map.spawnPerWave * wavesPerMinute * 6; // 6분 100% 젠컷 마릿수
    const actual6MinKills = Math.round(max6MinKills * (killRatio / 100));

    const hourlyKills = actual6MinKills * 10;
    const twoHourKills = hourlyKills * 2; // 1재획(2시간) 마릿수

    // 레벨 배율
    const expLevelMult = this.getExpLevelRatio(userLevel, map.mobLevel);
    const mesoLevelMult = this.getMesoLevelRatio(userLevel, map.mobLevel);

    // 1마리당 경험치 = 기본경험치 * 레벨배율 * (1 + 버프%/100)
    const expPerMob = map.baseExp * expLevelMult * (expBuffPct / 100);
    const hourlyExpTotal = expPerMob * hourlyKills;
    const twoHourExpTotal = expPerMob * twoHourKills;

    // 1마리당 순메소 = 기본메소(약 7.5배 잡템포함) * 레벨배율 * (메획%/100) * (재획비1.2배 포함)
    const mesoPerMob = map.baseMeso * mesoLevelMult * (mesoRatePct / 100);
    const hourlyMesoTotal = Math.round(mesoPerMob * hourlyKills * 7.5);
    const twoHourMesoTotal = hourlyMesoTotal * 2;

    // 에르다 조각 및 노드스톤 기댓값 (아획 % 반영)
    const solErdaPiecesHourly = (hourlyKills / 1000) * 1.8 * (dropRatePct / 100);
    const solErdaPieces2Hr = solErdaPiecesHourly * 2;

    return {
      mapInfo: map,
      actual6MinKills,
      hourlyKills,
      twoHourKills,
      expLevelMult,
      mesoLevelMult,
      hourlyExpTotal,
      twoHourExpTotal,
      hourlyMesoTotal,
      twoHourMesoTotal,
      solErdaPiecesHourly: solErdaPiecesHourly.toFixed(1),
      solErdaPieces2Hr: solErdaPieces2Hr.toFixed(1)
    };
  }
}

window.huntingCalculator = new HuntingCalculator();
