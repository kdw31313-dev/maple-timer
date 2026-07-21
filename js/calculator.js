/**
 * Calculator - 메이플스토리 사냥 효율 계산기 (MapleWidget / Mapleroad 검증 공식 DB 적용)
 */
class HuntingCalculator {
  constructor() {
    // MapleWidget & Mapleroad 실측 오피셜 사냥터 DB (젠당 몹수 36~40마리, 1시간 17,280~19,200마리)
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
      { region: '아르테리아', name: '최상층 통로 3', mobLevel: 284, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1580000, baseMeso: 2250 },
      { region: '아르테리아', name: '최상층 통로 4', mobLevel: 284, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1580000, baseMeso: 2250 },
      { region: '아르테리아', name: '최상층 통로 5', mobLevel: 284, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1580000, baseMeso: 2250 },
      { region: '아르테리아', name: '최상층 통로 6', mobLevel: 284, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1580000, baseMeso: 2250 },
      { region: '아르테리아', name: '최상층 통로 7', mobLevel: 284, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1580000, baseMeso: 2250 },
      { region: '아르테리아', name: '최상층 통로 8', mobLevel: 284, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1580000, baseMeso: 2250 },

      // --- 카르시온 (Lv.285~289) ---
      { region: '카르시온', name: '거대 산호 군락 1', mobLevel: 285, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1620000, baseMeso: 2280 },
      { region: '카르시온', name: '거대 산호 군락 2', mobLevel: 285, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1620000, baseMeso: 2280 },
      { region: '카르시온', name: '거대 산호 군락 3 (인기)', mobLevel: 286, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1640000, baseMeso: 2300 },
      { region: '카르시온', name: '잔잔한 해안가 1', mobLevel: 286, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1670000, baseMeso: 2330 },
      { region: '카르시온', name: '잔잔한 해안가 2', mobLevel: 286, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1670000, baseMeso: 2330 },
      { region: '카르시온', name: '잔잔한 해안가 3', mobLevel: 286, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1670000, baseMeso: 2330 },
      { region: '카르시온', name: '휘감기는 숲 1', mobLevel: 287, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1730000, baseMeso: 2390 },
      { region: '카르시온', name: '휘감기는 숲 2', mobLevel: 287, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1730000, baseMeso: 2390 },
      { region: '카르시온', name: '휘감기는 숲 3', mobLevel: 288, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1770000, baseMeso: 2420 },
      { region: '카르시온', name: '어둠이 내리는 나무줄기 1', mobLevel: 288, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1770000, baseMeso: 2420 },
      { region: '카르시온', name: '어둠이 내리는 나무줄기 2', mobLevel: 288, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1770000, baseMeso: 2420 },
      { region: '카르시온', name: '어둠이 내리는 나무줄기 3', mobLevel: 288, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1770000, baseMeso: 2420 },
      { region: '카르시온', name: '숨이 멎어드는 동굴 1', mobLevel: 289, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1800000, baseMeso: 2450 },
      { region: '카르시온', name: '숨이 멎어드는 동굴 2', mobLevel: 289, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1800000, baseMeso: 2450 },
      { region: '카르시온', name: '숨이 멎어드는 동굴 3', mobLevel: 289, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1800000, baseMeso: 2450 },
      { region: '카르시온', name: '숨이 멎어드는 동굴 4', mobLevel: 289, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1800000, baseMeso: 2450 },
      { region: '카르시온', name: '가라앉은 유적지 1', mobLevel: 289, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1800000, baseMeso: 2450 },
      { region: '카르시온', name: '가라앉은 유적지 2', mobLevel: 289, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1800000, baseMeso: 2450 },
      { region: '카르시온', name: '가라앉은 유적지 3', mobLevel: 289, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1800000, baseMeso: 2450 },
      { region: '카르시온', name: '가라앉은 유적지 4', mobLevel: 289, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1800000, baseMeso: 2450 }
    ];
  }

  getExpLevelRatio(userLevel, mobLevel) {
    const diff = userLevel - mobLevel;

    if (diff === 0) return 1.20;
    if (diff === 1 || diff === -1) return 1.20;
    if (diff === 2 || diff === -2) return 1.10;
    if (diff === 3 || diff === -3) return 1.05;
    if (diff === 4 || diff === -4) return 1.05;
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
      mapIndex = 7, // 최하층 통로 2
      killRatio = 100, // 젠컷 % (80~100)
      expBuffPct = 200,
      mesoRatePct = 100,
      dropRatePct = 100
    } = params;

    const map = this.mapDatabase[mapIndex] || this.mapDatabase[7];

    // 1시간 오피셜 마릿수 (17,280마리 또는 19,200마리)
    const hourlyMaxKills = map.hourlyMax || (map.spawnPerWave * 480);
    const max6MinKills = Math.round(hourlyMaxKills / 10); // 1,728마리 또는 1,920마리

    const actual6MinKills = Math.round(max6MinKills * (killRatio / 100));
    const hourlyKills = actual6MinKills * 10;
    const twoHourKills = hourlyKills * 2;

    const expLevelMult = this.getExpLevelRatio(userLevel, map.mobLevel);
    const mesoLevelMult = this.getMesoLevelRatio(userLevel, map.mobLevel);

    const expPerMob = map.baseExp * expLevelMult * (expBuffPct / 100);
    const hourlyExpTotal = expPerMob * hourlyKills;
    const twoHourExpTotal = expPerMob * twoHourKills;

    const mesoPerMob = map.baseMeso * mesoLevelMult * (mesoRatePct / 100);
    const hourlyMesoTotal = Math.round(mesoPerMob * hourlyKills * 7.5);
    const twoHourMesoTotal = hourlyMesoTotal * 2;

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
