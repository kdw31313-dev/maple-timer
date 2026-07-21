/**
 * Calculator - 메이플스토리 공식 패치 일일 메소 제한 & 재획비 1.2배 곱연산 수식 엔진
 */
class HuntingCalculator {
  constructor() {
    this.mapDatabase = [
      // ===== 1. 소멸의 여로 (Lv.200~209) =====
      { region: '소멸의 여로', name: '망각의 호수: 동굴 아랫길 (동아)', mobLevel: 204, spawnPerWave: 26, hourlyMax: 12480, baseExp: 111960, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_vanishing.jpg' },
      { region: '소멸의 여로', name: '소멸의 화염: 숨겨진 동굴', mobLevel: 209, spawnPerWave: 36, hourlyMax: 17280, baseExp: 135000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_vanishing.jpg' },
      { region: '소멸의 여로', name: '안식의 동굴: 동굴 아랫길 깊은 곳', mobLevel: 208, spawnPerWave: 31, hourlyMax: 14880, baseExp: 128000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_vanishing.jpg' },

      // ===== 2. 츄츄 아일랜드 (Lv.210~219) =====
      { region: '츄츄 아일랜드', name: '격류지대 3 (인기)', mobLevel: 213, spawnPerWave: 36, hourlyMax: 17280, baseExp: 195000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_chuchu.jpg' },
      { region: '츄츄 아일랜드', name: '고래산: 고래산 정상', mobLevel: 216, spawnPerWave: 36, hourlyMax: 17280, baseExp: 210000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_chuchu.jpg' },
      { region: '츄츄 아일랜드', name: '츄딥: 숨겨진 츄르숲', mobLevel: 219, spawnPerWave: 38, hourlyMax: 18240, baseExp: 225000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_chuchu.jpg' },

      // ===== 3. 레헬른 (Lv.220~224) =====
      { region: '레헬른', name: '꿈의 도시: 닭이 뛰노는 곳 2 (닭2)', mobLevel: 222, spawnPerWave: 35, hourlyMax: 16800, baseExp: 275000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_lachelein.jpg' },
      { region: '레헬른', name: '본색을 드러내는 곳 3 (본삼)', mobLevel: 224, spawnPerWave: 38, hourlyMax: 18240, baseExp: 295000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_lachelein.jpg' },
      { region: '레헬른', name: '시계탑 최하층 (인기)', mobLevel: 224, spawnPerWave: 40, hourlyMax: 19200, baseExp: 310000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_lachelein.jpg' },

      // ===== 4. 아르카나 (Lv.225~229) =====
      { region: '아르카나', name: '신비의 숲: 동굴 아랫길 (동아)', mobLevel: 227, spawnPerWave: 32, hourlyMax: 15360, baseExp: 370000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_arcana.jpg' },
      { region: '아르카나', name: '정령의 나무: 흙의 숲', mobLevel: 228, spawnPerWave: 36, hourlyMax: 17280, baseExp: 385000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_arcana.jpg' },
      { region: '아르카나', name: '동굴 아랫길 깊은 곳 2 (동디2)', mobLevel: 229, spawnPerWave: 39, hourlyMax: 18720, baseExp: 400000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_arcana.jpg' },

      // ===== 5. 모라스 (Lv.230~234) =====
      { region: '모라스', name: '기억의 늪: 그림자가 춤추는 곳 4 (그춤4)', mobLevel: 233, spawnPerWave: 38, hourlyMax: 18240, baseExp: 470000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_morass.jpg' },
      { region: '모라스', name: '폐쇄 구역 (인기)', mobLevel: 234, spawnPerWave: 40, hourlyMax: 19200, baseExp: 490000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_morass.jpg' },

      // ===== 6. 에스페라 (Lv.235~244) =====
      { region: '에스페라', name: '거울에 비친 빛의 신전 3 (신전3)', mobLevel: 239, spawnPerWave: 39, hourlyMax: 18720, baseExp: 580000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_esfera.jpg' },
      { region: '에스페라', name: '거울빛에 물든 바다 2 (신바2)', mobLevel: 242, spawnPerWave: 40, hourlyMax: 19200, baseExp: 600000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_esfera.jpg' },

      // ===== 7. 문브릿지 (Lv.245~249) =====
      { region: '문브릿지', name: '사상의 경계 2 (인기)', mobLevel: 247, spawnPerWave: 38, hourlyMax: 18240, baseExp: 710000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_moonbridge.jpg' },
      { region: '문브릿지', name: '공포의 거대함선 3', mobLevel: 249, spawnPerWave: 40, hourlyMax: 19200, baseExp: 740000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_moonbridge.jpg' },

      // ===== 8. 고통의 미궁 (Lv.250~254) =====
      { region: '고통의 미궁', name: '미궁 최하층 4 (인기)', mobLevel: 253, spawnPerWave: 40, hourlyMax: 19200, baseExp: 880000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_labyrinth.jpg' },
      { region: '고통의 미궁', name: '미궁 중심부 6', mobLevel: 252, spawnPerWave: 39, hourlyMax: 18720, baseExp: 860000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_labyrinth.jpg' },

      // ===== 9. 리멘 (Lv.255~259) =====
      { region: '리멘', name: '세계의 눈물 하단 1', mobLevel: 256, spawnPerWave: 38, hourlyMax: 18240, baseExp: 1020000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_limen.jpg' },
      { region: '리멘', name: '세계가 미치는 곳 1-6 (1-6)', mobLevel: 258, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1060000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_limen.jpg' },
      { region: '리멘', name: '세계가 미치는 곳 2-5 (2-5)', mobLevel: 259, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1080000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_road_limen.jpg' },

      // ===== 10. 세르니움 (Lv.260~264) =====
      { region: '세르니움', name: '세르니움 서쪽 성벽 2', mobLevel: 260, spawnPerWave: 36, hourlyMax: 17280, baseExp: 1220000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_cernium.jpg' },
      { region: '세르니움', name: '세르니움 동쪽 성벽 2 (인기)', mobLevel: 261, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1250000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_cernium.jpg' },
      { region: '세르니움', name: '왕립 도서관 제1구역', mobLevel: 263, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1300000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_cernium.jpg' },
      { region: '세르니움', name: '분노의 회랑 2', mobLevel: 264, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1350000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_cernium.jpg' },

      // ===== 11. 호텔 아르쿠스 (Lv.265~269) =====
      { region: '호텔 아르쿠스', name: 'Outlaw Street 2', mobLevel: 265, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1550000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_hotelarcus.jpg' },
      { region: '호텔 아르쿠스', name: '낭만있는 카라반 1', mobLevel: 267, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1610000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_hotelarcus.jpg' },
      { region: '호텔 아르쿠스', name: '드라이브 스루 2 (인기)', mobLevel: 268, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1650000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_hotelarcus.jpg' },

      // ===== 12. 오디움 (Lv.270~274) =====
      { region: '오디움', name: '성곽 접근로 2', mobLevel: 270, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1890000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_odium.jpg' },
      { region: '오디움', name: '점령되는 연구실 1 (인기)', mobLevel: 272, spawnPerWave: 40, hourlyMax: 19200, baseExp: 1960000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_odium.jpg' },
      { region: '오디움', name: '닫힌 문 너머 실험실 2', mobLevel: 274, spawnPerWave: 40, hourlyMax: 19200, baseExp: 2040000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_odium.jpg' },

      // ===== 13. 도원경 (Lv.275~279) =====
      { region: '도원경', name: '빛이 약한 여름 4 (인기)', mobLevel: 275, spawnPerWave: 40, hourlyMax: 19200, baseExp: 2300000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_dowonkyung.jpg' },
      { region: '도원경', name: '생기가 맴도는 가을 2', mobLevel: 277, spawnPerWave: 40, hourlyMax: 19200, baseExp: 2420000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_dowonkyung.jpg' },
      { region: '도원경', name: '눈이 내리는 겨울 4', mobLevel: 279, spawnPerWave: 40, hourlyMax: 19200, baseExp: 2550000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_dowonkyung.jpg' },

      // ===== 14. 아르테리아 (Lv.280~284) =====
      { region: '아르테리아', name: '북쪽 외곽지역', mobLevel: 280, spawnPerWave: 36, hourlyMax: 17280, baseExp: 2850000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_arteria.jpg' },
      { region: '아르테리아', name: '최하층 통로 2 (인기)', mobLevel: 282, spawnPerWave: 40, hourlyMax: 19200, baseExp: 2930000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_arteria.jpg' },
      { region: '아르테리아', name: '최상층 통로 2', mobLevel: 284, spawnPerWave: 40, hourlyMax: 19200, baseExp: 3080000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_arteria.jpg' },

      // ===== 15. 카르시온 (Lv.285~289) =====
      { region: '카르시온', name: '거대 산호 군락 3 (인기)', mobLevel: 286, spawnPerWave: 40, hourlyMax: 19200, baseExp: 3440000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_carcion.jpg' },
      { region: '카르시온', name: '어둠이 내리는 나무줄기 1', mobLevel: 288, spawnPerWave: 40, hourlyMax: 19200, baseExp: 3570000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_carcion.jpg' },

      // ===== 16. 탈라하트 (Lv.290+) =====
      { region: '탈라하트', name: '황혼이 지는 신전 1 (최신)', mobLevel: 290, spawnPerWave: 40, hourlyMax: 19200, baseExp: 4100000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_tallahart.jpg' },
      { region: '탈라하트', name: '고대 유적 중심부 2 (인기)', mobLevel: 293, spawnPerWave: 40, hourlyMax: 19200, baseExp: 4250000, imgUrl: 'https://maplestory.dn.nexoncdn.co.kr/DesignScript/images/maple/town/img_grandis_tallahart.jpg' }
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

  // ===== 2026 메이플스토리 200~300 오피셜 레벨별 필요 경험치(필경) 수식 =====
  getRequiredExpForLevel(lvl) {
    if (lvl < 200) return 0;
    if (lvl === 200) return 2207026470;
    if (lvl < 210) return Math.round(2207026470 * Math.pow(1.06, lvl - 200));
    if (lvl < 220) return Math.round(8970000000 * Math.pow(1.05, lvl - 210));
    if (lvl < 220) return Math.round(22500000000 * Math.pow(1.04, lvl - 220));
    if (lvl < 240) return Math.round(52000000000 * Math.pow(1.035, lvl - 230));
    if (lvl < 250) return Math.round(112000000000 * Math.pow(1.03, lvl - 240));
    if (lvl < 260) return Math.round(220000000000 * Math.pow(1.025, lvl - 250));
    if (lvl < 270) return Math.round(380000000000 * Math.pow(1.022, lvl - 260));
    if (lvl < 280) return Math.round(620000000000 * Math.pow(1.02, lvl - 270));
    if (lvl < 290) return Math.round(980000000000 * Math.pow(1.018, lvl - 280));
    if (lvl <= 300) return Math.round(1550000000000 * Math.pow(1.015, lvl - 290));
    return 2000000000000;
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

    // 11) Mapleroad 스타일 목표 레벨 D-Day & 필요 총 재획비/경쿠 연산
    const targetLevel = params.targetLevel || Math.min(300, userLevel + 1);
    const currentExpPct = params.currentExpPct || 0;
    const dailyPlayHours = params.dailyPlayHours || 2; // 하루 평균 사냥 시간 (기본 2시간 = 1재획)

    let totalGoalExpNeeded = 0;
    const curLevelReqExp = this.getRequiredExpForLevel(userLevel);
    const remainingCurLevelExp = Math.round(curLevelReqExp * (1 - currentExpPct / 100));

    totalGoalExpNeeded += remainingCurLevelExp;

    for (let l = userLevel + 1; l < targetLevel; l++) {
      totalGoalExpNeeded += this.getRequiredExpForLevel(l);
    }

    const totalGoalHoursNeeded = hourlyExpTotal > 0 ? (totalGoalExpNeeded / hourlyExpTotal) : 0;
    const totalGoalRehoekCount = (totalGoalHoursNeeded / 2).toFixed(1); // 2시간 = 1재획
    const daysNeededForGoal = dailyPlayHours > 0 ? Math.ceil(totalGoalHoursNeeded / dailyPlayHours) : 0;
    const totalGoalMesoExpected = Math.round(totalGoalHoursNeeded * hourlyMesoTotal);
    const totalGoalErdaExpected = Math.round(totalGoalHoursNeeded * solErdaPiecesHourly);

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
      solErdaPiecesHourly,
      solErdaPieces2Hr,
      // Mapleroad 정밀 리포트 항목
      targetLevel,
      currentExpPct,
      dailyPlayHours,
      totalGoalExpNeeded,
      totalGoalHoursNeeded: totalGoalHoursNeeded.toFixed(1),
      totalGoalRehoekCount,
      daysNeededForGoal,
      totalGoalMesoExpected,
      totalGoalErdaExpected
    };
  }
}

window.huntingCalculator = new HuntingCalculator();
