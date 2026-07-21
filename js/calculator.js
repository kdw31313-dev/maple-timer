/**
 * Calculator - 메이플스토리 사냥 효율 및 일일 메소 제한 시간 계산기 (Mapleroad / MapleWidget 정밀 연산 모듈)
 */
class HuntingCalculator {
  constructor() {
    this.mapDatabase = [
      // --- 아르테리아 (Lv.280~284) ---
      { region: '아르테리아', name: '북쪽 외곽지역', mobLevel: 280, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1450000, baseMeso: 2100 },
      { region: '아르테리아', name: '서쪽 외곽지역', mobLevel: 280, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1460000, baseMeso: 2120 },
      { region: '아르테리아', name: '남쪽 외곽지역', mobLevel: 281, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1480000, baseMeso: 2140 },
      { region: '아르테리아', name: '동쪽 외곽지역', mobLevel: 281, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1490000, baseMeso: 2150 },
      { region: '아르테리아', name: '외곽 전투지역 1', mobLevel: 280, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1460000, baseMeso: 2120 },
      { region: '아르테리아', name: '외곽 전투지역 2', mobLevel: 281, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1490000, baseMeso: 2150 },
      { region: '아르테리아', name: '최하층 통로 1', mobLevel: 282, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1520000, baseMeso: 2180 },
      { region: '아르테리아', name: '최하층 통로 2 (인기)', mobLevel: 282, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1530000, baseMeso: 2200 },
      { region: '아르테리아', name: '최하층 통로 3', mobLevel: 282, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1530000, baseMeso: 2200 },
      { region: '아르테리아', name: '최하층 통로 4', mobLevel: 283, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1550000, baseMeso: 2220 },
      { region: '아르테리아', name: '최하층 통로 5', mobLevel: 283, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1550000, baseMeso: 2220 },
      { region: '아르테리아', name: '최하층 통로 6', mobLevel: 283, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1550000, baseMeso: 2220 },
      { region: '아르테리아', name: '최상층 통로 1', mobLevel: 284, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1580000, baseMeso: 2250 },
      { region: '아르테리아', name: '최상층 통로 2', mobLevel: 284, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1580000, baseMeso: 2250 },

      // --- 카르시온 (Lv.285~289) ---
      { region: '카르시온', name: '거대 산호 군락 1', mobLevel: 285, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1620000, baseMeso: 2280 },
      { region: '카르시온', name: '거대 산호 군락 3 (인기)', mobLevel: 286, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1640000, baseMeso: 2300 },
      { region: '카르시온', name: '잔잔한 해안가 2', mobLevel: 286, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1670000, baseMeso: 2330 },
      { region: '카르시온', name: '어둠이 내리는 나무줄기 1', mobLevel: 288, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1770000, baseMeso: 2420 }
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

  getMesoLevelRatio(userLevel, mobLevel) {
    const diff = userLevel - mobLevel;
    if (Math.abs(diff) <= 10) return 1.00;
    if (diff > 10) return Math.max(0.0, 1.00 - (diff - 10) * 0.05);
    return Math.max(0.0, 1.00 - (-diff - 10) * 0.05);
  }

  calculate(params) {
    const {
      userLevel = 280,
      mapIndex = 7,
      killRatio = 100,
      expBuffPct = 200,
      mesoRatePct = 188, // 예시 메획 188%
      dropRatePct = 98  // 예시 아획 98%
    } = params;

    const map = this.mapDatabase[mapIndex] || this.mapDatabase[7];

    const hourlyMaxKills = map.hourlyMax || (map.spawnPerWave * 480);
    const max6MinKills = Math.round(hourlyMaxKills / 10);

    const actual6MinKills = Math.round(max6MinKills * (killRatio / 100));
    const hourlyKills = actual6MinKills * 10;
    const twoHourKills = hourlyKills * 2;
    const thirtyMinKills = Math.round(hourlyKills / 2);

    const expLevelMult = this.getExpLevelRatio(userLevel, map.mobLevel);
    const mesoLevelMult = this.getMesoLevelRatio(userLevel, map.mobLevel);

    // 경험치 연산
    const expPerMob = map.baseExp * expLevelMult * (expBuffPct / 100);
    const hourlyExpTotal = expPerMob * hourlyKills;
    const twoHourExpTotal = expPerMob * twoHourKills;

    // 메소 연산 (Mapleroad 정밀 메소 공식)
    // 메소 주머니 드롭률: 아획 67% 이상시 100% 확정 드롭
    const mesoBagDropRate = Math.min(100, Math.round((dropRatePct / 67) * 100));

    // 마리당 순메소
    const baseMesoPerMob = map.baseMeso * mesoLevelMult;
    const actualMesoPerMob = baseMesoPerMob * (mesoRatePct / 100) * (mesoBagDropRate / 100);

    const hourlyMesoTotal = Math.round(actualMesoPerMob * hourlyKills * 7.5);
    const thirtyMinMeso = Math.round(hourlyMesoTotal / 2);
    const twoHourMesoTotal = hourlyMesoTotal * 2;

    // 일일 메소 제한 (메이플스토리 일일 1억 9천만 순메소 기준)
    const dailyMesoBaseCap = 190000000;
    const totalMesoAtCap = Math.round(dailyMesoBaseCap * (mesoRatePct / 100));

    // 메소 제한까지 걸리는 시간 연산
    const hourlyBaseMesoEarned = baseMesoPerMob * hourlyKills * 7.5;
    const hoursNeeded = dailyMesoBaseCap / (hourlyBaseMesoEarned || 1);
    const totalMinutesNeeded = Math.round(hoursNeeded * 60);

    const capHours = Math.floor(totalMinutesNeeded / 60);
    const capMinutes = totalMinutesNeeded % 60;
    const timeToCapFormatted = `${capHours}시간 ${capMinutes}분`;

    // 에르다 조각 (아획 % 반영)
    const solErdaPiecesHourly = (hourlyKills / 1000) * 1.8 * (dropRatePct / 100);
    const solErdaPieces2Hr = solErdaPiecesHourly * 2;

    return {
      mapInfo: map,
      actual6MinKills,
      thirtyMinKills,
      hourlyKills,
      twoHourKills,
      expLevelMult,
      mesoLevelMult,
      expBuffPct,
      mesoRatePct,
      dropRatePct,
      mesoBagDropRate,
      hourlyExpTotal,
      twoHourExpTotal,
      thirtyMinMeso,
      hourlyMesoTotal,
      twoHourMesoTotal,
      dailyMesoBaseCap,
      totalMesoAtCap,
      timeToCapFormatted,
      solErdaPiecesHourly: solErdaPiecesHourly.toFixed(1),
      solErdaPieces2Hr: solErdaPieces2Hr.toFixed(1)
    };
  }
}

window.huntingCalculator = new HuntingCalculator();
