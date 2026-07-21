/**
 * Calculator - 메이플스토리 공식 패치 일일 메소 제한 & 재획비 1.2배 곱연산 수식 엔진
 */
class HuntingCalculator {
  constructor() {
    this.mapDatabase = [
      // --- 세르니움 (Lv.260~264) ---
      { region: '세르니움', name: '세르니움 서쪽 성벽 2', mobLevel: 260, spawnPerWave: 36, hourlyMax: 17280, baseExp: 420000 },
      { region: '세르니움', name: '세르니움 동쪽 성벽 2 (인기)', mobLevel: 261, spawnPerWave: 40, hourlyMax: 19200, baseExp: 435000 },
      { region: '세르니움', name: '왕립 도서관 제1구역', mobLevel: 263, spawnPerWave: 40, hourlyMax: 19200, baseExp: 460000 },
      { region: '세르니움', name: '분노의 회랑 2', mobLevel: 264, spawnPerWave: 40, hourlyMax: 19200, baseExp: 480000 },

      // --- 호텔 아르쿠스 (Lv.265~269) ---
      { region: '호텔 아르쿠스', name: 'Outlaw Street 2', mobLevel: 265, spawnPerWave: 40, hourlyMax: 19200, baseExp: 550000 },
      { region: '호텔 아르쿠스', name: '낭만있는 카라반 1', mobLevel: 267, spawnPerWave: 40, hourlyMax: 19200, baseExp: 610000 },
      { region: '호텔 아르쿠스', name: '드라이브 스루 2 (인기)', mobLevel: 268, spawnPerWave: 40, hourlyMax: 19200, baseExp: 650000 },

      // --- 오디움 (Lv.270~274) ---
      { region: '오디움', name: '성곽 접근로 2', mobLevel: 270, spawnPerWave: 40, hourlyMax: 19200, baseExp: 790000 },
      { region: '오디움', name: '점배되는 연구실 1 (인기)', mobLevel: 272, spawnPerWave: 40, hourlyMax: 19200, baseExp: 860000 },
      { region: '오디움', name: '닫힌 문 너머 실험실 2', mobLevel: 274, spawnPerWave: 40, hourlyMax: 19200, baseExp: 940000 },

      // --- 도원경 (Lv.275~279) ---
      { region: '도원경', name: '빛이 약한 여름 4 (인기)', mobLevel: 275, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1100000 },
      { region: '도원경', name: '생기가 맴도는 가을 2', mobLevel: 277, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1220000 },
      { region: '도원경', name: '눈이 내리는 겨울 4', mobLevel: 279, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1350000 },

      // --- 아르테리아 (Lv.280~284) ---
      { region: '아르테리아', name: '북쪽 외곽지역', mobLevel: 280, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1450000 },
      { region: '아르테리아', name: '서쪽 외곽지역', mobLevel: 280, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1460000 },
      { region: '아르테리아', name: '최하층 통로 2 (인기)', mobLevel: 282, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1530000 },
      { region: '아르테리아', name: '최상층 통로 2', mobLevel: 284, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1580000 },

      // --- 카르시온 (Lv.285~289) ---
      { region: '카르시온', name: '거대 산호 군락 3 (인기)', mobLevel: 286, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1640000 },
      { region: '카르시온', name: '어둠이 내리는 나무줄기 1', mobLevel: 288, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1770000 }
    ];
  }

  getOfficialBaseMesoCap(userLevel) {
    if (userLevel < 260) return 80000000;
    if (userLevel < 265) return 150000000;
    if (userLevel < 270) return 160000000;
    if (userLevel < 275) return 170000000;
    if (userLevel < 280) return 180000000;
    if (userLevel < 285) return 190000000;
    if (userLevel < 290) return 200000000;
    return 210000000;
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
      userCustomKills6min = null,
      killRatio = 100,
      expBuffPct = 200,
      mesoRatePct = 137,
      dropRatePct = 100,
      useWealthPotion = true // 재획비 1.2배 곱연산 체크
    } = params;

    const map = this.mapDatabase[mapIndex] || this.mapDatabase[7];

    const hourlyMaxKills = map.hourlyMax || (map.spawnPerWave * 480);
    const max6MinKills = Math.round(hourlyMaxKills / 10);

    const actual6MinKills = userCustomKills6min !== null && !isNaN(userCustomKills6min) && userCustomKills6min > 0
      ? userCustomKills6min
      : Math.round(max6MinKills * (killRatio / 100));

    const hourlyKills = actual6MinKills * 10;
    const twoHourKills = hourlyKills * 2;
    const thirtyMinKills = Math.round(hourlyKills / 2);

    // 1) 메소 주머니 드롭률 (아획 67% 이상시 100% 확정)
    const mesoBagDropRate = Math.min(100, Math.round((dropRatePct / 67) * 100));

    // 2) 메획 배율 계산 (재획비 1.2배 곱연산 핵심!)
    // 합산 메획 수치 = (1 + mesoRatePct/100)
    // 재획비 사용시 수식: (1 + mesoRatePct/100) * 1.2 (최대 400% = 4.0배 한도)
    const baseMesoMultiplier = (1 + mesoRatePct / 100);
    const finalMesoMultiplier = useWealthPotion
      ? Math.min(4.0, baseMesoMultiplier * 1.2)
      : baseMesoMultiplier;

    // 표기용 실질 최종 메획 %
    const displayFinalMesoPct = Math.round((finalMesoMultiplier - 1) * 100);

    // 3) 몬스터 메소 주머니 기본 평균값 (a_base = 몬스터 레벨 * 7.5)
    const baseMesoPerBag = map.mobLevel * 7.5;
    // 재획비 곱연산 반영 실질 주머니 1개당 평균 메소 (a = a_base * finalMesoMultiplier)
    const actualMesoPerBag = Math.round(baseMesoPerBag * finalMesoMultiplier);

    // 4) 시간별 메소 획득액 연산
    const hourlyMesoTotal = Math.round(actualMesoPerBag * hourlyKills * (mesoBagDropRate / 100));
    const thirtyMinMeso = Math.round(hourlyMesoTotal / 2);
    const twoHourMesoTotal = hourlyMesoTotal * 2;

    // 5) 넥슨 오피셜 레벨별 기본 메소 제한 상한선 (d_base)
    const baseCapMeso = this.getOfficialBaseMesoCap(userLevel);

    // 6) 메획 및 재획비 곱연산 반영 최종 메소 상한선 (d = d_base * finalMesoMultiplier)
    const totalCapMesoWithRate = Math.round(baseCapMeso * finalMesoMultiplier);

    // 7) 메소 제한 도달까지 잡아야 하는 총 몬스터 마릿수 (c = d_base / a_base)
    const requiredKillsForCap = Math.ceil(baseCapMeso / baseMesoPerBag);

    // 8) 필요 재획량 (재획비 개수 = c / (1시간 마릿수 * 2))
    const requiredRehoekCount = (requiredKillsForCap / (hourlyKills * 2 || 1)).toFixed(3);

    // 9) 메소 제한 도달 소요 시간
    const hoursNeeded = requiredKillsForCap / (hourlyKills || 1);
    const totalMinutesNeeded = Math.round(hoursNeeded * 60);
    const capHours = Math.floor(totalMinutesNeeded / 60);
    const capMinutes = totalMinutesNeeded % 60;
    const timeToCapFormatted = `${capHours}시간 ${capMinutes}분`;

    // 10) 경험치 & 조각 연산
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
      useWealthPotion,
      finalMesoMultiplier,
      displayFinalMesoPct,
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
