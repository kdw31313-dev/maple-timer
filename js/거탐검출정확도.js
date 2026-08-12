/**
 * 실제 거짓말 탐지기 17장과 이벤트 장비 합성창 음성 4장을 기준으로 한
 * 거탐 전용 구조 검증기다. 색상 템플릿 한 점수만으로 확정하지 않고,
 * 팝업 유형별 색 구조 또는 고유 미니게임 구조가 함께 보일 때만 확정한다.
 */
(() => {
  const analyzer = window.imageAnalyzer;
  if (!analyzer) return;

  const proto = analyzer.constructor.prototype;

  /**
   * 기존 매처는 네 템플릿을 모두 훑고도 전역 최저 한 개만 남겼다. 배경 UI가
   * 우연히 더 닮으면 실제 거탐 후보가 사라지므로, 같은 적분 영상과 같은 한 번의
   * 전수 탐색에서 유형별 최선 후보를 함께 보존한다.
   */
  proto.findPopupTemplateMatch = function findAllPopupTemplateMatches(imageData) {
    const templates = window.POPUP_TEMPLATES;
    if (!templates || !imageData?.data?.length) {
      return {
        found: false,
        type: '',
        confidence: 0,
        score: Infinity,
        normalizedScore: Infinity,
        templateCandidates: []
      };
    }

    const { width, height } = imageData;
    const integrals = this.buildPopupRgbIntegrals(imageData);
    const heightScale = height / 135;
    const searchHeights = [...new Set(
      [32, 40, 48, 58, 70, 84, 98]
        .map((value) => Math.max(18, Math.round(value * heightScale)))
        .filter((value) => value < height)
    )];
    const templateCandidates = [];
    let globalBest = {
      found: false,
      type: '',
      confidence: 0,
      score: Infinity,
      normalizedScore: Infinity
    };

    for (const template of Object.values(templates)) {
      let typeBest = {
        found: false,
        type: template.type,
        confidence: 0,
        score: Infinity,
        normalizedScore: Infinity
      };

      for (const candidateHeight of searchHeights) {
        const candidateWidth = Math.round(candidateHeight * template.aspect);
        if (candidateWidth >= width) continue;

        for (let y = 0; y <= height - candidateHeight; y += 3) {
          for (let x = 0; x <= width - candidateWidth; x += 3) {
            let difference = 0;
            for (let gridY = 0; gridY < 8; gridY++) {
              const y1 = y + Math.floor(candidateHeight * gridY / 8);
              const y2 = y + Math.floor(candidateHeight * (gridY + 1) / 8);
              for (let gridX = 0; gridX < 8; gridX++) {
                const x1 = x + Math.floor(candidateWidth * gridX / 8);
                const x2 = x + Math.floor(candidateWidth * (gridX + 1) / 8);
                const expected = template.pixels[gridY][gridX];
                for (let channel = 0; channel < 3; channel++) {
                  const actual = this.popupRgbCellMean(
                    integrals[channel],
                    width,
                    x1,
                    y1,
                    x2,
                    y2
                  );
                  difference += Math.abs(actual - expected[channel]);
                }
              }
            }

            const score = difference / (8 * 8 * 3);
            const normalizedScore = score / template.threshold;
            if (normalizedScore < typeBest.normalizedScore) {
              typeBest = {
                found: normalizedScore <= 1,
                type: template.type,
                templateKey: template.type,
                score,
                normalizedScore,
                confidence: Math.max(0, 1 - normalizedScore),
                x,
                y,
                width: candidateWidth,
                height: candidateHeight
              };
            }
          }
        }
      }

      templateCandidates.push(typeBest);
      if (typeBest.normalizedScore < globalBest.normalizedScore) globalBest = typeBest;
    }

    return { ...globalBest, templateCandidates };
  };

  const candidateColorEvidence = (imageData, match) => {
    if (!imageData?.data?.length || !Number.isFinite(match?.x)
      || !Number.isFinite(match?.width) || !Number.isFinite(match?.height)) {
      return null;
    }

    const { data, width, height } = imageData;
    const startX = Math.max(0, Math.floor(match.x));
    const startY = Math.max(0, Math.floor(match.y));
    const endX = Math.min(width, Math.ceil(match.x + match.width));
    const endY = Math.min(height, Math.ceil(match.y + match.height));
    const counts = {
      pixels: 0,
      dark: 0,
      bright: 0,
      red: 0,
      cyan: 0,
      blue: 0,
      green: 0,
      pink: 0,
      yellow: 0,
      neutral: 0
    };

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        counts.pixels++;
        if (r < 75 && g < 85 && b < 95) counts.dark++;
        if (r > 175 && g > 175 && b > 170) counts.bright++;
        if (r >= 130 && r - g >= 35 && r - b >= 25) counts.red++;
        if (g > 85 && b > 90 && g > r * 1.15 && b > r * 1.15) counts.cyan++;
        if (b > 85 && b > r * 1.25 && g > r * 1.1) counts.blue++;
        if (g > 105 && g > r * 1.25 && g > b * 1.15) counts.green++;
        if (r > 145 && b > 105 && r > g * 1.25) counts.pink++;
        if (r > 145 && g > 105 && b < 100 && r > b * 1.6) counts.yellow++;
        if (Math.max(r, g, b) - Math.min(r, g, b) <= 15) counts.neutral++;
      }
    }

    const total = Math.max(1, counts.pixels);
    const ratios = {};
    for (const key of Object.keys(counts)) {
      if (key !== 'pixels') ratios[key] = counts[key] / total;
    }
    return ratios;
  };

  const buildBannerIntegrals = (imageData) => {
    const { data, width, height } = imageData;
    const stride = width + 1;
    const size = stride * (height + 1);
    const keys = ['dark', 'purple', 'gold', 'cyan'];
    const sums = Object.fromEntries(keys.map((key) => [key, new Uint32Array(size)]));

    for (let y = 1; y <= height; y++) {
      const row = { dark: 0, purple: 0, gold: 0, cyan: 0 };
      for (let x = 1; x <= width; x++) {
        const pixel = ((y - 1) * width + x - 1) * 4;
        const r = data[pixel];
        const g = data[pixel + 1];
        const b = data[pixel + 2];
        if (r < 85 && g < 90 && b < 100) row.dark++;
        if (r >= 55 && b >= 65 && b - g >= 15 && r - g >= 5) row.purple++;
        if (r >= 130 && g >= 90 && b <= 110 && r - b >= 35) row.gold++;
        if (b >= 95 && g >= 85 && r <= 100 && b - r >= 20) row.cyan++;
        const position = y * stride + x;
        for (const key of keys) {
          sums[key][position] = sums[key][position - stride] + row[key];
        }
      }
    }
    return sums;
  };

  const integralRatio = (integral, imageWidth, x, y, width, height) => {
    const stride = imageWidth + 1;
    const x2 = x + width;
    const y2 = y + height;
    const count = integral[y2 * stride + x2] - integral[y * stride + x2]
      - integral[y2 * stride + x] + integral[y * stride + x];
    return count / Math.max(1, width * height);
  };

  const findActivationBanner = (imageData) => {
    const { width, height } = imageData;
    const sums = buildBannerIntegrals(imageData);
    // 캔버스가 화면비를 보존하므로 UI 크기는 너비가 아니라 높이 배율로
    // 환산한다. 실제 width는 탐색 가능한 x 범위에만 사용한다.
    const baseScale = height / 135;
    let best = null;

    const heights = [14, 18, 22, 26].map((value) => Math.max(8, Math.round(value * baseScale)));
    const widths = [76, 92, 108, 124, 140].map((value) => Math.max(40, Math.round(value * baseScale)));
    const stepX = Math.max(2, Math.round(3 * baseScale));
    const stepY = Math.max(1, Math.round(2 * baseScale));
    const maxY = Math.min(height, Math.round(height * 0.62));

    for (const candidateHeight of new Set(heights)) {
      if (candidateHeight >= height) continue;
      for (const candidateWidth of new Set(widths)) {
        if (candidateWidth >= width || candidateWidth / candidateHeight < 4.2) continue;
        for (let y = 1; y <= Math.min(height - candidateHeight, maxY); y += stepY) {
          for (let x = 1; x <= width - candidateWidth - 1; x += stepX) {
            const dark = integralRatio(sums.dark, width, x, y, candidateWidth, candidateHeight);
            const purple = integralRatio(sums.purple, width, x, y, candidateWidth, candidateHeight);
            if (dark < 0.52 || purple < 0.44) continue;
            const gold = integralRatio(sums.gold, width, x, y, candidateWidth, candidateHeight);
            const cyan = integralRatio(sums.cyan, width, x, y, candidateWidth, candidateHeight);
            const insetX = Math.max(1, Math.round(2 * baseScale));
            const insetY = Math.max(1, Math.round(2 * baseScale));
            const innerWidth = candidateWidth - insetX * 2;
            const innerHeight = candidateHeight - insetY * 2;
            const innerDark = integralRatio(
              sums.dark,
              width,
              x + insetX,
              y + insetY,
              innerWidth,
              innerHeight
            );
            const innerPurple = integralRatio(
              sums.purple,
              width,
              x + insetX,
              y + insetY,
              innerWidth,
              innerHeight
            );
            const fullArea = candidateWidth * candidateHeight;
            const innerArea = innerWidth * innerHeight;
            const borderArea = Math.max(1, fullArea - innerArea);
            const borderPurple = (purple * fullArea - innerPurple * innerArea) / borderArea;
            // 실제 발동 안내는 검은 내부와 보라 테두리가 모두 연속된다.
            // 사냥 배경의 보라 몬스터/스킬 글자는 전체 색 비율만 비슷할 뿐
            // 내부 암부와 테두리 중 하나 이상이 끊겨 여기서 제외된다.
            if (dark < 0.64 || innerDark < 0.66 || borderPurple < 0.39) continue;
            const confidence = dark * 0.48 + purple * 0.48
              + Math.min(0.08, gold) * 0.35 + Math.min(0.10, cyan) * 0.15;
            const bannerMargins = [
              Math.min(1, Math.max(0, (dark - 0.64) / 0.20)),
              Math.min(1, Math.max(0, (innerDark - 0.66) / 0.20)),
              Math.min(1, Math.max(0, (borderPurple - 0.39) / 0.30))
            ];
            const structuralStrength = 0.60
              + bannerMargins.reduce((sum, value) => sum + value, 0) / bannerMargins.length * 0.40;
            if (!best || confidence > best.confidence) {
              best = {
                found: true,
                kind: 'activation-banner',
                type: '발동 안내형 거짓말 탐지기',
                confidence,
                structuralStrength,
                x,
                y,
                width: candidateWidth,
                height: candidateHeight,
                darkRatio: dark,
                purpleRatio: purple,
                innerDarkRatio: innerDark,
                borderPurpleRatio: borderPurple,
                goldRatio: gold,
                cyanRatio: cyan
              };
            }
          }
        }
      }
    }
    return best;
  };

  const buildLuminance = (imageData) => {
    const { data, width, height } = imageData;
    const luminance = new Float32Array(width * height);
    for (let index = 0, pixel = 0; index < luminance.length; index++, pixel += 4) {
      luminance[index] = data[pixel] * 0.299 + data[pixel + 1] * 0.587 + data[pixel + 2] * 0.114;
    }
    return luminance;
  };

  const findCircularClickDetector = (imageData) => {
    const { data, width, height } = imageData;
    // 이 구조는 240x135 운영 입력에서 지름 약 84px이다. 다른 입력도 같은 비율로 환산한다.
    // 화면비 보존 캔버스에서는 UI의 기하 크기가 세로 배율을 따른다.
    // 16:10의 좁은 너비를 크기 배율에 섞으면 실제 원을 10% 작게 찾아 놓친다.
    const baseScale = height / 135;
    const radii = [38, 42, 46]
      .map((value) => Math.max(18, Math.round(value * baseScale)))
      .filter((value, index, all) => all.indexOf(value) === index && value * 2 < Math.min(width, height));
    if (!radii.length) return null;

    const luminance = buildLuminance(imageData);
    const sample = (x, y) => luminance[
      Math.max(0, Math.min(height - 1, Math.round(y))) * width
      + Math.max(0, Math.min(width - 1, Math.round(x)))
    ];
    const angles = Array.from({ length: 48 }, (_, index) => ({
      cos: Math.cos(index * Math.PI * 2 / 48),
      sin: Math.sin(index * Math.PI * 2 / 48)
    }));
    const step = Math.max(2, Math.round(3 * baseScale));
    let best = null;

    for (const radius of radii) {
      for (let centerY = radius; centerY <= height - radius; centerY += step) {
        for (let centerX = radius; centerX <= width - radius; centerX += step) {
          // 원주 계산은 후보당 수백 번의 밝기 샘플이 필요하다. 먼저 성긴 내부
          // 색 표본으로 청회색 원판 가능성이 없는 대부분의 좌표를 제거한다.
          let sparseBlue = 0;
          let sparsePurple = 0;
          let sparseCount = 0;
          for (const ratio of [0.28, 0.52, 0.78]) {
            for (let sparseIndex = 0; sparseIndex < 16; sparseIndex++) {
              const sparseAngle = sparseIndex * Math.PI * 2 / 16;
              const sparseX = Math.max(0, Math.min(
                width - 1,
                Math.round(centerX + Math.cos(sparseAngle) * radius * ratio)
              ));
              const sparseY = Math.max(0, Math.min(
                height - 1,
                Math.round(centerY + Math.sin(sparseAngle) * radius * ratio)
              ));
              const sparsePixel = (sparseY * width + sparseX) * 4;
              const sparseRed = data[sparsePixel];
              const sparseGreen = data[sparsePixel + 1];
              const sparseBlueValue = data[sparsePixel + 2];
              sparseCount++;
              if (sparseBlueValue > sparseRed + 18 && sparseBlueValue > sparseGreen + 8) {
                sparseBlue++;
              }
              if (sparseRed >= 55 && sparseBlueValue >= 65
                && sparseBlueValue - sparseGreen >= 15 && sparseRed - sparseGreen >= 5) {
                sparsePurple++;
              }
            }
          }
          if (sparseBlue / sparseCount < 0.56 || sparsePurple / sparseCount > 0.36) continue;

          let edge15 = 0;
          let edge25 = 0;
          let neutralEdge = 0;
          let brightEdge = 0;
          let innerSum = 0;
          let outerSum = 0;

          for (const angle of angles) {
            let previous = sample(
              centerX + angle.cos * (radius - 4 * baseScale),
              centerY + angle.sin * (radius - 4 * baseScale)
            );
            let maximumDifference = 0;
            let maximumRadius = radius;
            for (let offset = -3; offset <= 4; offset++) {
              const currentRadius = radius + offset * baseScale;
              const current = sample(
                centerX + angle.cos * currentRadius,
                centerY + angle.sin * currentRadius
              );
              const difference = Math.abs(current - previous);
              if (difference > maximumDifference) {
                maximumDifference = difference;
                maximumRadius = currentRadius;
              }
              previous = current;
            }

            if (maximumDifference >= 15) edge15++;
            if (maximumDifference >= 25) edge25++;
            const edgeX = Math.max(0, Math.min(
              width - 1,
              Math.round(centerX + angle.cos * maximumRadius)
            ));
            const edgeY = Math.max(0, Math.min(
              height - 1,
              Math.round(centerY + angle.sin * maximumRadius)
            ));
            const edgeIndex = (edgeY * width + edgeX) * 4;
            const r = data[edgeIndex];
            const g = data[edgeIndex + 1];
            const b = data[edgeIndex + 2];
            if (Math.max(r, g, b) - Math.min(r, g, b) <= 28) neutralEdge++;
            if ((r + g + b) / 3 >= 145) brightEdge++;
            innerSum += sample(
              centerX + angle.cos * radius * 0.72,
              centerY + angle.sin * radius * 0.72
            );
            outerSum += sample(
              centerX + angle.cos * radius * 1.18,
              centerY + angle.sin * radius * 1.18
            );
          }

          const innerMean = innerSum / angles.length;
          const outerMean = outerSum / angles.length;
          const contrast = Math.abs(innerMean - outerMean);
          const found = edge15 >= 46
            && edge25 >= 42
            && neutralEdge <= 11
            && brightEdge <= 16
            && innerMean <= 108
            && contrast <= 18;
          if (!found) continue;

          let blueSamples = 0;
          let purpleSamples = 0;
          let colorSamples = 0;
          for (const ratio of [0.18, 0.32, 0.46, 0.60, 0.74, 0.86]) {
            for (let sampleIndex = 0; sampleIndex < 32; sampleIndex++) {
              const sampleAngle = sampleIndex * Math.PI * 2 / 32;
              const sampleX = Math.max(0, Math.min(
                width - 1,
                Math.round(centerX + Math.cos(sampleAngle) * radius * ratio)
              ));
              const sampleY = Math.max(0, Math.min(
                height - 1,
                Math.round(centerY + Math.sin(sampleAngle) * radius * ratio)
              ));
              const sampleIndex4 = (sampleY * width + sampleX) * 4;
              const sampleRed = data[sampleIndex4];
              const sampleGreen = data[sampleIndex4 + 1];
              const sampleBlue = data[sampleIndex4 + 2];
              colorSamples++;
              if (sampleBlue > sampleRed + 18 && sampleBlue > sampleGreen + 8) blueSamples++;
              if (sampleRed >= 55 && sampleBlue >= 65
                && sampleBlue - sampleGreen >= 15 && sampleRed - sampleGreen >= 5) {
                purpleSamples++;
              }
            }
          }
          const blueInteriorRatio = blueSamples / colorSamples;
          const purpleInteriorRatio = purpleSamples / colorSamples;
          // 클릭 미니게임의 원형 판은 내부 전반에 청회색 계열이 이어진다.
          // 새 맵 구조물의 보라 구체와 버프/스킬 아이콘도 원주는 만들지만,
          // 내부가 보라색이거나 청회색 연속 면적이 부족하므로 제외한다.
          if (blueInteriorRatio < 0.82 || purpleInteriorRatio > 0.18) continue;

          const confidence = edge25 / angles.length * 0.42
            + edge15 / angles.length * 0.20
            + (1 - neutralEdge / angles.length) * 0.16
            + Math.max(0, 108 - innerMean) / 108 * 0.12
            + Math.max(0, 18 - contrast) / 18 * 0.10;
          const circleMargins = [
            Math.min(1, Math.max(0, (edge25 - 42) / 6)),
            Math.min(1, Math.max(0, (blueInteriorRatio - 0.82) / 0.15)),
            Math.min(1, Math.max(0, (0.18 - purpleInteriorRatio) / 0.15))
          ];
          const structuralStrength = 0.60
            + circleMargins.reduce((sum, value) => sum + value, 0) / circleMargins.length * 0.40;
          if (!best || confidence > best.confidence) {
            best = {
              found: true,
              kind: 'circular-click-game',
              type: '원형 클릭형 거짓말 탐지기',
              confidence,
              structuralStrength,
              x: centerX - radius,
              y: centerY - radius,
              width: radius * 2,
              height: radius * 2,
              centerX,
              centerY,
              radius,
              edge15,
              edge25,
              neutralEdge,
              brightEdge,
              innerMean,
              outerMean,
              contrast,
              blueInteriorRatio,
              purpleInteriorRatio
            };
          }
        }
      }
    }
    return best;
  };

  proto.findPopupUniqueStructureEvidence = function findPopupUniqueStructureEvidence(imageData) {
    const banner = findActivationBanner(imageData);
    const circle = findCircularClickDetector(imageData);
    if (!banner) return circle;
    if (!circle) return banner;
    return (circle.structuralStrength || 0) > (banner.structuralStrength || 0)
      ? circle
      : banner;
  };

  const verifyTemplateCandidate = (imageData, candidate) => {
    if (!candidate?.found) return null;
    const normalizedScore = Number.isFinite(candidate.normalizedScore)
      ? candidate.normalizedScore
      : Infinity;
    const colors = candidateColorEvidence(imageData, candidate);
    let templateEvidence = '';

    if (colors && candidate.type === '버섯 안내창형 거짓말 탐지기'
      && normalizedScore <= 0.90
      && colors.red >= 0.015
      && colors.pink >= 0.015
      && (colors.cyan >= 0.20 || colors.dark >= 0.16)) {
      templateEvidence = 'mushroom-color-layout';
    } else if (colors && candidate.type === '도형 선택형 거짓말 탐지기'
      && normalizedScore <= 0.90
      && colors.bright >= 0.62
      && colors.neutral >= 0.68
      && colors.yellow >= 0.025) {
      templateEvidence = 'shape-panel-layout';
    } else if (colors && candidate.type === '파란 이미지 선택형 거짓말 탐지기'
      && normalizedScore <= 0.90
      && colors.cyan >= 0.50
      && colors.blue >= 0.55) {
      templateEvidence = 'blue-panel-layout';
    } else if (colors && candidate.type === '반투명 숫자형 거짓말 탐지기'
      && normalizedScore <= 0.90
      && colors.yellow >= 0.07
      && colors.green >= 0.14
      && colors.red >= 0.04) {
      templateEvidence = 'number-overlay-layout';
    }

    if (!templateEvidence) return null;
    return {
      ...candidate,
      found: true,
      verified: true,
      templateEvidence,
      colorEvidence: colors,
      evidenceStrength: 1 - normalizedScore * 0.5
    };
  };

  const stabilizePopupTracking = (analyzerInstance, imageData, verified) => {
    const detectedType = verified.type;
    const evidenceBox = {
      x: verified.x,
      y: verified.y,
      width: verified.width,
      height: verified.height
    };
    const centerX = verified.x + verified.width / 2;
    const centerY = verified.y + verified.height / 2;
    const trackingSize = Math.max(40, Math.round(imageData.height * 0.42));
    let trackingX = Math.round(centerX - trackingSize / 2);
    let trackingY = Math.round(centerY - trackingSize / 2);
    const previous = analyzerInstance.popupState?.lastMatch;

    // 템플릿형/발동 배너형/원형 클릭형 사이에서 화면 효과가 바뀌더라도,
    // 같은 팝업 중심이면 이전 추적 상자를 유지해 2프레임 연속 근거가 끊기지 않는다.
    if (previous && Number.isFinite(previous.x) && Number.isFinite(previous.y)) {
      const previousCenterX = previous.x + (previous.width || trackingSize) / 2;
      const previousCenterY = previous.y + (previous.height || trackingSize) / 2;
      if (Math.hypot(centerX - previousCenterX, centerY - previousCenterY) <= trackingSize * 0.55) {
        trackingX = previous.x;
        trackingY = previous.y;
      }
    }

    analyzerInstance.popupState.lastDetectedSubtype = detectedType;
    return {
      ...verified,
      // 상태 머신은 이 안정형 이름과 상자를 사용하고, 실제 알림 문구에는 아래
      // detectedType을 사용한다.
      type: '거짓말 탐지기 팝업',
      detectedType,
      evidenceBox,
      x: trackingX,
      y: trackingY,
      width: trackingSize,
      height: trackingSize
    };
  };

  proto.verifyPopupTemplateMatch = function verifyPopupWithIndependentEvidence(imageData, match = {}) {
    const candidates = Array.isArray(match.templateCandidates) && match.templateCandidates.length
      ? match.templateCandidates
      : [match];
    const verifiedTemplates = candidates
      .map((candidate) => verifyTemplateCandidate(imageData, candidate))
      .filter(Boolean)
      .sort((left, right) => right.evidenceStrength - left.evidenceStrength);

    if (verifiedTemplates.length) {
      const verified = verifiedTemplates[0];
      // 붉은 픽셀 군집은 진단 정보로만 남긴다. 제목색만으로 verified를 만들지 않는다.
      const title = this.findLieDetectorTitleEvidence(imageData, verified);
      return stabilizePopupTracking(this, imageData, {
        ...verified,
        titleEvidence: title.found,
        titlePixelCount: title.pixelCount,
        titleColumnSpan: title.columnSpan
      });
    }

    const structure = this.findPopupUniqueStructureEvidence(imageData);
    if (structure?.found) {
      const title = this.findLieDetectorTitleEvidence(imageData, match);
      return stabilizePopupTracking(this, imageData, {
        ...match,
        found: true,
        verified: true,
        type: structure.type,
        confidence: structure.confidence,
        x: structure.x,
        y: structure.y,
        width: structure.width,
        height: structure.height,
        titleEvidence: title.found,
        structuralEvidence: structure.kind,
        structure
      });
    }

    const title = this.findLieDetectorTitleEvidence(imageData, match);
    const colors = candidateColorEvidence(imageData, match);
    return {
      ...match,
      verified: false,
      titleEvidence: title.found,
      titlePixelCount: title.pixelCount,
      titleColumnSpan: title.columnSpan,
      colorEvidence: colors
    };
  };

  const originalTriggerPopupStructureAlert = proto.triggerPopupStructureAlert;
  proto.triggerPopupStructureAlert = function triggerPopupWithSubtype(fallbackType) {
    return originalTriggerPopupStructureAlert.call(
      this,
      this.popupState.lastDetectedSubtype || fallbackType
    );
  };

  const originalReset = proto.reset;
  proto.reset = function resetPopupTrackingState() {
    const result = originalReset.call(this);
    this.popupState.lastMatch = null;
    this.popupState.lastDetectedSubtype = '';
    return result;
  };
})();
