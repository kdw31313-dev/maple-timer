/*
 * 사용자가 표시한 실제 익스트림 골드 아이콘 3장에서 추출한 8x8 RGB 표본.
 * 왼쪽 아래 시간 숫자는 매 프레임 변하므로 -1로 마스킹했다.
 */
(() => {
  const encoded = 'tQC8AMYA4gDcAOgA4ADSALgARwA9AAgATABBAAsA3wDEALMA4ADhANkAQABBAEUA5ADnAO4A7QDkAN0AmwB3AEUAxgCeABoAywCZACoAyQCmAHwA8ADmANoAwQC+AM8ArACzAMUAqwCvALAAmwCQAH4ArACOAFAAqQCEAFgAqACLAHkArQCqALsAjwCRAKYAjACQAJwAggCFAIoASABAADUAbgBhAFAAcABeAEYAXQBPAEQAfQB8AHcAcgBzAIgAjwCQAJUAWQBYAF0AaABlAGwAfgCAAHMAgAB3AGYAdgBtAGYAUQBJADwAdwByAIkA////////////////////////fgCLAIEAfwB4AEoAkgCMAGoAbABcAEwAeAB6AHkA////////////////////////fgB2AF8AfQBqAEIAjwB/AF4AWABIAEgAdAByAHcA////////////////////////dABdAFcAcwBXAFMAhQB3AHQAdQBqAGgARQArABIA2ADbAOIA5ADjAN8A4gDPALEAPAAtAAAALgAYAAAAzwC7AKAA5ADiAOMAIwAlACQA3wDiAOcA7gDkANsAkQBrAC0A2ACdABEA2gCaABwA0QCtAIsA6ADmANcAwADCAM8AsACyAL4ApgCqAKsAmACIAG4AsQCOAFYApwCCAGUApgCOAHYArQCsALQAnACeAKsAiACOAJwAfQCAAIcASABAADUAcwBoAFIAawBaAEAAYQBXAE0AgAB7AH8AdgB5AH4AhQCIAI8ASwBPAE4AZQBlAGcAewB6AHYAgQB6AGgAdABqAGAAUQBEADQAcgB1AHoA////////////////////////gACFAH8AfgB7AE4AhgB9AFQAeABoAFsAeAB0AHUA////////////////////////fgB3AGcAfgBqAEUAhAB1AFQAUgBJAEAAcgByAHIA////////////////////////bgBaAFEAbwBUAE0AgwBwAHIAdABoAGwAPAAiAAsA2QDjAO0A5wDmAOIA2QDPAKwAVwBJAAwASAA0AAAA1ADBALIA5gDoAOcAYABwAIAA5ADrAPEA5gDmAOYArQCQAFQAxQCSABIAuQCCAA4A3gC8AJcA4gDoAOgAuQDKANQA2QDiAOcA2wDcAN4AwACxAIoA5AC+AG0A5AC2AHoAygCwAI8A3gDfAOEAtAC/ANEAhwCPAJoAgQCFAJAAQAA9ACwAYgBcAEwAZwBaAEcAXQBTAEcAewB5AH4AbAB3AIsAgQCEAI0AXgBfAGMAXwBgAGQAegB/AHgAdQB0AGIAVgBSAE8AOgA3ADAAcABuAHsA////////////////////////ggCHAIEAggB5AFAAfQB4AFoAfQB0AG0AbABwAHsA////////////////////////fQB2AGYAewBoAEgAeABzAF0ATgBFAEgAbgBxAHgA////////////////////////bABjAGQAbgBjAGkAdAByAHUAZgBiAHAADwAQACIA';
  const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const values = [];
  for (let offset = 0; offset < bytes.length; offset += 2) {
    values.push(view.getInt16(offset, true));
  }

  const templateLength = 8 * 8 * 3;
  window.BUFF_ICON_TEMPLATES.extremeGoldVariants = [];
  for (let offset = 0; offset < values.length; offset += templateLength) {
    window.BUFF_ICON_TEMPLATES.extremeGoldVariants.push(
      values.slice(offset, offset + templateLength)
    );
  }
})();
