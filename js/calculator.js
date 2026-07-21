/**
 * Calculator - 메이플스토리 사냥 효율 및 일일 메소 제한 공식 모듈 (유저 검증 오피셜 수식 기반)
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

  calculate(params) {
    const {
      userLevel = 280,
      mapIndex = 7,
      killRatio = 100,
      expBuffPct = 200,
      mesoRatePct = 137,
      dropRatePct = 100
    } = params;

    const map = this.mapDatabase[mapIndex] || this.mapDatabase[7];

    const hourlyMaxKills = map.hourlyMax || (map.spawnPerWave * 480);
    const max6MinKills = Math.round(hourlyMaxKills / 10);

    const actual6MinKills = Math.round(max6MinKills * (killRatio / 100));
    const hourlyKills = actual6MinKills * 10;
    const twoHourKills = hourlyKills * 2;
    const thirtyMinKills = Math.round(hourlyKills / 2);

    const expLevelMult = this.getExpLevelRatio(userLevel, map.mobLevel);

    // 1) 메소 주머니 기본 평균값 (몬스터 레벨 * 7.5)
    const baseMesoPerBag = map.mobLevel * 7.5; // 예: 280렙 * 7.5 = 2,100메소
    // 메획% 반영 주머니당 평균 획득액
    const actualMesoPerBag = baseMesoPerBag * (1 + mesoRatePct / 100);

    // 2) 시간별 메소 획득액 (주머니 드롭률 100% 확정 기준)
    const hourlyMesoTotal = Math.round(actualMesoPerBag * hourlyKills);
    const thirtyMinMeso = Math.round(hourlyMesoTotal / 2);
    const twoHourMesoTotal = hourlyMesoTotal * 2;

    // 3) 레벨별 기본 메소 제한량 (메획 0% 기준 상수 d)
    let baseCapMeso = 150000000;
    if (userLevel >= 280) {
      baseCapMeso = 170000000; // 280렙 이상: 1.7억 고정
    } else if (userLevel >= 270) {
      baseCapMeso = 160000000; // 270렙대: 1.6억 고정
    }

    // 4) 메획% 반영 최종 메소 상한선 (0%면 1.7억, 137%면 4.029억, 224%면 5.508억)
    const totalCapMesoWithRate = Math.round(baseCapMeso * (1 + mesoRatePct / 100));

    // 5) 메소 제한 도달까지 잡아야 하는 총 마릿수 (메획%와 무관하게 고정 수치!)
    // 수식: c = baseCapMeso / (mobLevel * 7.5)
    const requiredKillsForCap = Math.ceil(baseCapMeso / baseMesoPerBag);

    // 6) 필요 재획량 (재획비 개수 = 잡아야 하는 마릿수 / (시간당 마릿수 * 2))
    const requiredRehoekCount = (requiredKillsForCap / (hourlyKills * 2 || 1)).toFixed(3);

    // 7) 메소 제한 도달 소요 시간
    const hoursNeeded = requiredKillsForCap / (hourlyKills || 1);
    const totalMinutesNeeded = Math.round(hoursNeeded * 60);
    const capHours = Math.floor(totalMinutesNeeded / 60);
    const capMinutes = totalMinutesNeeded % 60;
    const timeToCapFormatted = `${capHours}시간 ${capMinutes}분`;

    // 경험치 및 조각 연산
    const expPerMob = map.baseExp * expLevelMult * (expBuffPct / 100);
    const hourlyExpTotal = expPerMob * hourlyKills;
    const twoHourExpTotal = expPerMob * twoHourKills;

    const solErdaPiecesHourly = (hourlyKills / 1000) * 1.8 * (dropRatePct / 100);
    const solErdaPieces2Hr = solErdaPiecesHourly * 2;

    return {
      mapInfo: map,
      userLevel,
      actual6MinKills,
      thirtyMinKills,
      hourlyKills,
      twoHourKills,
      expLevelMult,
      baseMesoPerBag,
      actualMesoPerBag: Math.round(actualMesoPerBag),
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
