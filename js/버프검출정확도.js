/*
 * 버프 템플릿의 전역 후보 수 제한 때문에 정확한 슬롯이 탈락하는 경우를 보완한다.
 *
 * - 솔 야누스: 여러 줄 전체에서 타이머 획으로 슬롯 후보를 만들고 정밀화한다.
 * - 익스트림 골드: 전역 후보를 위치별로 분산해 정밀화하고 병 모양을 다시 검증한다.
 *
 * 기존 검출기가 성공한 추적 프레임은 그대로 사용한다. 이 파일의 정밀 탐색은
 * 최초 탐색 또는 기존 탐색 실패 때만 실행되므로 정상 추적 비용을 늘리지 않는다.
 */
(() => {
  const analyzer = window.imageAnalyzer;
  if (!analyzer) return;

  const proto = analyzer.constructor.prototype;
  if (proto.__buffPrecisionFallbackInstalled) return;
  proto.__buffPrecisionFallbackInstalled = true;

  const previousBuffMatch = proto.findBuffTemplateMatch;
  const compiledTemplates = new Map();

  const templateList = (templateName) => {
    const templates = window.BUFF_ICON_TEMPLATES || {};
    if (templateName === 'janus') return templates.janusVariants || [templates.janus];
    if (templateName === 'extremeGold') {
      return templates.extremeGoldVariants || [templates.extremeGold];
    }
    return templates[templateName] ? [templates[templateName]] : [];
  };

  // 원본 scoreAt과 같은 8x8 RGB 평균 절대 오차다. 크기별 표본 좌표는 한 번만 계산한다.
  const templatesForSize = (templateName, size) => {
    const key = `${templateName}:${size}`;
    if (compiledTemplates.has(key)) return compiledTemplates.get(key);

    const variants = templateList(templateName).filter(Boolean).map((template) => {
      const samples = [];
      for (let gy = 0; gy < 8; gy++) {
        for (let gx = 0; gx < 8; gx++) {
          const index = (gy * 8 + gx) * 3;
          if (template[index] < 0) continue;
          samples.push({
            dx: Math.round((gx + 0.5) * size / 8),
            dy: Math.round((gy + 0.5) * size / 8),
            r: template[index],
            g: template[index + 1],
            b: template[index + 2]
          });
        }
      }
      return samples;
    });
    compiledTemplates.set(key, variants);
    return variants;
  };

  const scoreAt = (imageData, templateName, left, top, size) => {
    const { data, width } = imageData;
    const variants = templatesForSize(templateName, size);
    const ignoreTimer = templateName === 'janus';
    let bestScore = Infinity;

    for (const samples of variants) {
      let difference = 0;
      let compared = 0;
      for (const sample of samples) {
        const pixel = ((top + sample.dy) * width + left + sample.dx) * 4;
        const r = data[pixel];
        const g = data[pixel + 1];
        const b = data[pixel + 2];
        // 야누스 중앙의 남은 시간 숫자는 원본 matcher와 똑같이 점수에서 뺀다.
        if (ignoreTimer && r >= 145 && g >= 135 && b <= 125) continue;
        difference += Math.abs(r - sample.r)
          + Math.abs(g - sample.g)
          + Math.abs(b - sample.b);
        compared += 3;
      }
      if (compared) bestScore = Math.min(bestScore, difference / compared);
    }
    return bestScore;
  };

  const candidateSizes = (imageData) => {
    // ROI 너비는 캡처 해상도와 함께 변한다. 1280px 전처리 자료는 66px,
    // 670~850px 운영 자료는 44/56px, 720p 운영 ROI는 33px이 흔하다.
    // 세 크기를 모두 보되 가능성이 높은 순서로 검사해 양성 프레임은 일찍 끝낸다.
    const primary = imageData.height >= 220
      ? [66, 56, 44]
      : imageData.width < 620
        ? [33, 44, 56]
        : [44, 56, 33];
    return primary.filter((size) => imageData.width >= size && imageData.height >= size);
  };

  // 활성 야누스는 아이콘 위에 노란 남은 시간이 겹친다. 전 화면을 템플릿으로
  // 1px씩 비교하는 대신 같은 색 기준의 연결요소를 한 번 만들고, 그 주변만
  // 정밀 탐색한다. 타이머가 없는 회색 종료 위상은 기존 추적 슬롯 matcher가 맡는다.
  const findTimerComponents = (imageData) => {
    const { data, width, height } = imageData;
    const mask = new Uint8Array(width * height);
    for (let pixel = 0; pixel < width * height; pixel++) {
      const index = pixel * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      if (r >= 165 && g >= 150 && b <= 145 && r - b >= 25) mask[pixel] = 1;
    }

    const components = [];
    for (let start = 0; start < mask.length; start++) {
      if (mask[start] !== 1) continue;
      const queue = [start];
      mask[start] = 2;
      let head = 0;
      let pixels = 0;
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      while (head < queue.length) {
        const pixel = queue[head++];
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        pixels++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nextX = x + dx;
            const nextY = y + dy;
            if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
            const next = nextY * width + nextX;
            if (mask[next] === 1) {
              mask[next] = 2;
              queue.push(next);
            }
          }
        }
      }
      if (pixels >= 2) {
        components.push({
          pixels,
          minX,
          minY,
          maxX,
          maxY,
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2
        });
      }
    }
    return components.sort((left, right) => right.pixels - left.pixels).slice(0, 256);
  };

  const makeTimerSeeds = (imageData, components, size) => {
    const maxLeft = imageData.width - size;
    const maxTop = imageData.height - size;
    const plausible = components.filter((component) => (
      component.maxX - component.minX + 1 <= size * 0.55
      && component.maxY - component.minY + 1 <= size * 0.55
      && component.pixels <= size * size * 0.18
    ));
    const seeds = [];
    const seen = new Set();
    const remember = (left, top, sourceRank) => {
      const x = Math.max(0, Math.min(maxLeft, Math.round(left)));
      const y = Math.max(0, Math.min(maxTop, Math.round(top)));
      const key = `${x}:${y}`;
      if (seen.has(key)) return;
      seen.add(key);
      seeds.push({ x, y, size, sourceRank });
    };

    plausible.forEach((component, sourceRank) => {
      // 같은 높이에서 한 아이콘 폭 안에 있는 여러 숫자 획을 합치면 실제
      // 아이콘 중심이 된다. 인접 슬롯 전체가 한 덩어리가 되지 않도록
      // 기준 획 좌우 0.55칸까지만 묶는다.
      const neighbors = plausible.filter((other) => (
        Math.abs(other.centerY - component.centerY) <= size * 0.13
        && Math.abs(other.centerX - component.centerX) <= size * 0.55
      ));
      const clusterMinX = Math.min(...neighbors.map((item) => item.minX));
      const clusterMaxX = Math.max(...neighbors.map((item) => item.maxX));
      const clusterMinY = Math.min(...neighbors.map((item) => item.minY));
      const clusterMaxY = Math.max(...neighbors.map((item) => item.maxY));
      const clusterWidth = clusterMaxX - clusterMinX + 1;
      if (clusterWidth >= size * 0.14 && clusterWidth <= size * 0.95) {
        remember(
          (clusterMinX + clusterMaxX) / 2 - size / 2,
          (clusterMinY + clusterMaxY) / 2 - size / 2,
          sourceRank
        );
      }

      // 한 자리만 보이거나 압축으로 획이 갈라져도 세 대표 자리 중 하나에서
      // 출발한다. 뒤의 작은 정밀 반경이 자리 사이의 나머지 오차를 덮는다.
      for (const fractionX of [0.2, 0.5, 0.8]) {
        remember(
          component.centerX - size * fractionX,
          component.centerY - size * 0.5,
          sourceRank
        );
      }
    });
    return seeds;
  };

  const makeResult = (candidate, shape, threshold, extra = {}) => ({
    ...candidate,
    found: true,
    shape,
    threshold,
    normalizedScore: candidate.score / threshold,
    inPreferredBand: Boolean(extra.inPreferredBand),
    searchBand: {
      top: 0,
      bottom: Math.min(extra.bottom || candidate.size, extra.height || Infinity),
      anchored: Boolean(extra.anchored),
      tracked: false,
      precisionFallback: true,
      arrowNumber: extra.arrowNumber ?? null
    }
  });

  const scanJanusDiversified = (instance, imageData, targetArrowNumber, preferredLocation) => {
    const { width, height } = imageData;
    const timerComponents = findTimerComponents(imageData);
    const preferredSize = preferredLocation?.size;
    const sizes = candidateSizes(imageData).sort((left, right) => {
      if (!preferredSize) return 0;
      return Math.abs(left - preferredSize) - Math.abs(right - preferredSize);
    });

    for (const size of sizes) {
      const maxTop = height - size;
      const coarse = makeTimerSeeds(imageData, timerComponents, size).map((candidate) => ({
        ...candidate,
        score: scoreAt(imageData, 'janus', candidate.x, candidate.y, size)
      }));
      coarse.sort((left, right) => left.score - right.score);

      // 각 세로 구간의 상위 후보를 라운드로빈으로 보존한다. 첫 줄의 여러
      // 전투 숫자가 목록을 독점해도 둘째·셋째 줄의 타이머 후보가 탈락하지 않는다.
      const bands = new Map();
      for (const candidate of coarse) {
        const band = Math.floor(candidate.y / Math.max(1, size));
        if (!bands.has(band)) bands.set(band, []);
        const list = bands.get(band);
        if (list.length < 12) list.push(candidate);
      }
      const seeds = [];
      for (let rank = 0; rank < 12 && seeds.length < 64; rank++) {
        for (const list of bands.values()) {
          const candidate = list[rank];
          if (candidate && candidate.score <= 46) {
            seeds.push(candidate);
            if (seeds.length >= 64) break;
          }
        }
      }

      const refined = [];
      const radius = Math.max(3, Math.round(size * 0.09));
      for (const seed of seeds) {
        let localBest = seed;
        for (let y = Math.max(0, seed.y - radius); y <= Math.min(maxTop, seed.y + radius); y++) {
          for (let x = Math.max(0, seed.x - radius); x <= Math.min(width - size, seed.x + radius); x++) {
            const score = scoreAt(imageData, 'janus', x, y, size);
            if (score < localBest.score) localBest = { score, x, y, size };
          }
        }
        refined.push(localBest);
      }
      refined.sort((left, right) => left.score - right.score);

      for (const candidate of refined) {
        if (candidate.score > 21) break;
        const shape = instance.measureBuffIconShape(
          imageData,
          candidate.x,
          candidate.y,
          candidate.size
        );
        const scale = Math.pow(candidate.size / 33, 2);
        const shapePassed = shape.violetPixels >= 18 * scale
          && shape.darkPixels >= 30 * scale;
        if (!shapePassed) continue;

        const timerVisible = shape.yellowDigitPixels >= 3
          && shape.largestYellowDigitComponent >= 2;
        if (!timerVisible) continue;
        // 20.5~21.0은 JPEG 재압축으로 20.43 양성이 흔들리는 구간이다.
        // 이 작은 여유는 강한 타이머·형상과 동일 슬롯 2프레임 확인을 모두
        // 요구한다. 알려진 음성 최저 21.6 아래에서 단일 프레임 경계는 유지한다.
        const strongTimedShape = shape.violetPixels >= 45 * scale
          && shape.darkPixels >= 55 * scale
          && shape.largestYellowDigitComponent >= Math.max(3, Math.round(size / 11))
          && shape.yellowDigitSpan >= size * 0.18;
        const threshold = strongTimedShape ? 21 : 20.5;
        if (candidate.score > threshold) continue;
        const inPreferredBand = Boolean(preferredLocation && (
          Math.hypot(candidate.x - preferredLocation.x, candidate.y - preferredLocation.y)
            <= Math.max(7, candidate.size * 0.42)
        ));
        return makeResult(candidate, shape, threshold, {
          bottom: height,
          height,
          inPreferredBand,
          arrowNumber: targetArrowNumber
        });
      }
    }

    return null;
  };

  const goldShapePassed = (shape, size) => {
    const scale = Math.pow(size / 33, 2);
    return shape.goldPixels >= 35 * scale
      && shape.goldPixels <= 400 * scale
      // 66px 실제 양성의 어두운 외곽은 399px이었다. 점수가 10 이하인
      // 강한 템플릿 일치에만 95*scale(66px=380)까지 허용한다.
      && shape.darkPixels >= 95 * scale
      && shape.centerGoldPixels >= 16 * scale
      && shape.upperCenterGoldPixels >= 4 * scale
      && shape.centerGoldVerticalSpan >= size * 0.2;
  };

  const scanGoldDiversified = (instance, imageData, targetArrowNumber, preferredLocation) => {
    const { width, height } = imageData;
    const preferredSize = preferredLocation?.size;
    const sizes = candidateSizes(imageData).sort((left, right) => {
      if (!preferredSize) return 0;
      return Math.abs(left - preferredSize) - Math.abs(right - preferredSize);
    });
    const found = [];

    for (const size of sizes) {
      const step = Math.max(4, Math.round(size / 9));
      const coarse = [];
      for (let y = 0; y <= height - size; y += step) {
        for (let x = 0; x <= width - size; x += step) {
          coarse.push({ score: scoreAt(imageData, 'extremeGold', x, y, size), x, y, size });
        }
      }
      coarse.sort((left, right) => left.score - right.score);

      // 원본의 전역 상위 10개가 아니라 상위 96개를 정밀화한다. 실제 44px 병은
      // 성긴 격자에서 33~39위였지만 1px 정렬 뒤 점수가 0이 되는 표본이 있었다.
      // 정밀 점수 10과 병 형상을 모두 요구하므로 후보 수만 늘려도 판정은 느슨해지지 않는다.
      const seeds = coarse.slice(0, 96);

      for (const seed of seeds) {
        let localBest = seed;
        for (let y = Math.max(0, seed.y - step); y <= Math.min(height - size, seed.y + step); y++) {
          for (let x = Math.max(0, seed.x - step); x <= Math.min(width - size, seed.x + step); x++) {
            const score = scoreAt(imageData, 'extremeGold', x, y, size);
            if (score < localBest.score) localBest = { score, x, y, size };
          }
        }
        if (localBest.score > 10) continue;
        const shape = instance.measureBuffIconShape(
          imageData,
          localBest.x,
          localBest.y,
          localBest.size
        );
        if (!goldShapePassed(shape, localBest.size)) continue;
        found.push(makeResult(localBest, shape, 10, {
          bottom: height,
          height,
          // 점수 10 이하와 병 형상을 함께 통과한 정밀 후보는
          // 상태 판정에서도 신뢰할 수 있는 고정 슬롯으로 취급한다.
          anchored: true,
          inPreferredBand: Boolean(preferredLocation && (
            Math.hypot(localBest.x - preferredLocation.x, localBest.y - preferredLocation.y)
              <= Math.max(7, localBest.size * 0.42)
          )),
          arrowNumber: targetArrowNumber
        }));
      }
    }

    if (!found.length) return null;
    found.sort((left, right) => {
      if (preferredLocation) {
        const leftDistance = Math.hypot(left.x - preferredLocation.x, left.y - preferredLocation.y);
        const rightDistance = Math.hypot(right.x - preferredLocation.x, right.y - preferredLocation.y);
        if (Math.abs(leftDistance - rightDistance) > 1) return leftDistance - rightDistance;
      }
      return left.score - right.score;
    });
    return found[0];
  };

  const relaxExactGoldShape = (match) => {
    if (!match || match.score > 10 || !match.shape || !goldShapePassed(match.shape, match.size || 33)) {
      return match;
    }
    return {
      ...match,
      found: true,
      threshold: 10,
      normalizedScore: match.score / 10,
      precisionFallback: true
    };
  };

  proto.findBuffTemplateMatch = function buffPrecisionFallback(
    imageData,
    templateName,
    targetArrowNumber = null,
    preferredLocation = null
  ) {
    if (!imageData?.data || (templateName !== 'janus' && templateName !== 'extremeGold')) {
      return previousBuffMatch.call(
        this,
        imageData,
        templateName,
        targetArrowNumber,
        preferredLocation
      );
    }

    // 확인된 슬롯은 기존의 1px 근접 탐색이 가장 빠르고 정확하다.
    if (preferredLocation) {
      const tracked = templateName === 'extremeGold'
        ? relaxExactGoldShape(previousBuffMatch.call(
          this,
          imageData,
          templateName,
          targetArrowNumber,
          preferredLocation
        ))
        : previousBuffMatch.call(
          this,
          imageData,
          templateName,
          targetArrowNumber,
          preferredLocation
        );
      if (tracked?.found) return tracked;

      const recovered = templateName === 'janus'
        ? scanJanusDiversified(this, imageData, targetArrowNumber, preferredLocation)
        : scanGoldDiversified(this, imageData, targetArrowNumber, preferredLocation);
      return recovered || tracked;
    }

    // 최초 탐색은 작은 고정 범위 fallback을 먼저 실행해 무거운 전체 탐색을 피한다.
    const precise = templateName === 'janus'
      ? scanJanusDiversified(this, imageData, targetArrowNumber, null)
      : scanGoldDiversified(this, imageData, targetArrowNumber, null);
    if (precise) return precise;

    // 이 정밀 탐색은 실제 양성/음성 경계를 모두 포함한다. 여기서 실패한 뒤
    // 기존 전역 탐색을 다시 돌리면 음성 한 장에 수백 ms가 추가되어 300ms
    // 분석 주기를 밀어낸다. 미검출은 즉시 반환하고 다음 프레임에서 재시도한다.
    return {
      found: false,
      score: Infinity,
      threshold: templateName === 'janus' ? 20.5 : 10,
      normalizedScore: Infinity,
      x: 0,
      y: 0,
      size: candidateSizes(imageData)[0] || 33,
      shape: {},
      inPreferredBand: false,
      searchBand: {
        top: 0,
        bottom: imageData.height,
        anchored: false,
        tracked: false,
        precisionFallback: true,
        arrowNumber: targetArrowNumber
      }
    };
  };
})();
