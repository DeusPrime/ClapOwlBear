// Smooth colour regions before reducing tones, then antialias their boundaries.
// Work at source resolution: reducing resolution first would introduce blocks.
function smoothRegions(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  let current = data;
  const passes = Math.ceil(amount) + 1;
  const radius = Math.max(2, Math.round(Math.min(width, height) * (0.002 + amount * 0.002)));
  const stride = Math.max(1, Math.floor(radius / 3));
  const tolerance = 28 + amount * 16;
  const weights = Array.from({ length: 766 }, (_, d) => Math.exp(-d * d / (2 * tolerance * tolerance)));
  const spatial = Array.from({ length: 49 }, (_, i) => Math.exp(-((i % 7 - 3) ** 2 + (Math.floor(i / 7) - 3) ** 2) / 8));
  for (let pass = 0; pass < passes; pass++) {
    const next = new Uint8ClampedArray(current);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!current[i + 3]) continue;
      let red = 0, green = 0, blue = 0, total = 0;
      for (let gy = -3; gy <= 3; gy++) for (let gx = -3; gx <= 3; gx++) {
        const dx = gx * stride, dy = gy * stride;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const j = (ny * width + nx) * 4;
        const difference = Math.abs(current[i] - current[j]) + Math.abs(current[i + 1] - current[j + 1]) + Math.abs(current[i + 2] - current[j + 2]);
        const weight = weights[difference] * current[j + 3] / 255 * spatial[(gy + 3) * 7 + gx + 3];
        red += current[j] * weight; green += current[j + 1] * weight; blue += current[j + 2] * weight; total += weight;
      }
      next[i] = red / total; next[i + 1] = green / total; next[i + 2] = blue / total;
    }
    current = next;
  }
  return current;
}

function flattenPalette(data: Uint8ClampedArray, amount: number) {
  const samples: number[][] = [];
  const step = Math.max(1, Math.floor(data.length / 4 / 6000));
  for (let p = 0; p < data.length / 4; p += step) {
    if (data[p * 4 + 3]) samples.push([data[p * 4], data[p * 4 + 1], data[p * 4 + 2]]);
  }
  if (!samples.length) return new Uint8ClampedArray(data);
  const count = Math.round(64 - Math.min(2, amount) * 16);
  const distance = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const palette = [samples[0].slice()];
  const nearest = new Float64Array(samples.length).fill(Infinity);
  // Farthest-point seeding retains small, distinctive colour accents.
  while (palette.length < count) {
    let farthest = 0;
    for (let s = 0; s < samples.length; s++) {
      nearest[s] = Math.min(nearest[s], distance(samples[s], palette[palette.length - 1]));
      if (nearest[s] > nearest[farthest]) farthest = s;
    }
    if (nearest[farthest] === 0) break;
    palette.push(samples[farthest].slice());
  }
  const closest = (color: number[]) => {
    let best = 0, bestDistance = Infinity;
    for (let k = 0; k < palette.length; k++) {
      const d = distance(color, palette[k]);
      if (d < bestDistance) { best = k; bestDistance = d; }
    }
    return best;
  };
  // Keep vivid light accents from being averaged into much larger muted areas.
  const anchors = palette.map(color => Math.max(...color) > 180 && Math.min(...color) / Math.max(...color) < 0.3);
  for (let pass = 0; pass < 10; pass++) {
    const sums = palette.map(() => [0, 0, 0, 0]);
    for (const sample of samples) {
      const sum = sums[closest(sample)];
      for (let c = 0; c < 3; c++) sum[c] += sample[c];
      sum[3]++;
    }
    sums.forEach((sum, k) => { if (sum[3] && !anchors[k]) palette[k] = sum.slice(0, 3).map(c => c / sum[3]); });
  }
  const result = new Uint8ClampedArray(data);
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const color = palette[closest([data[i], data[i + 1], data[i + 2]])];
    for (let c = 0; c < 3; c++) result[i + c] = color[c];
  }
  return result;
}

// Posterization creates tiny disconnected islands even after denoising. Merge
// those islands into the closest surrounding colour instead of merely blurring
// their edges, which leaves the speckled texture visible.
function differentHue(a: number[], b: number[]) {
  const av = Math.max(...a), bv = Math.max(...b);
  if (!av || !bv) return false;
  return a.reduce((sum, c, k) => sum + (c / av - b[k] / bv) ** 2, 0) > 0.16;
}

function mergeSmallRegions(data: Uint8ClampedArray, width: number, height: number, minimum: number) {
  const size = width * height;
  const labels = new Int32Array(size).fill(-1);
  const queue = new Int32Array(size);
  const regions: { count: number; color: number[]; minX: number; maxX: number; minY: number; maxY: number }[] = [];
  for (let seed = 0; seed < size; seed++) {
    if (labels[seed] !== -1 || !data[seed * 4 + 3]) continue;
    const id = regions.length, color = Array.from(data.slice(seed * 4, seed * 4 + 3));
    let head = 0, tail = 1;
    let minX = seed % width, maxX = minX, minY = Math.floor(seed / width), maxY = minY;
    queue[0] = seed; labels[seed] = id;
    while (head < tail) {
      const p = queue[head++], x = p % width;
      const y = Math.floor(p / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const n of [x > 0 ? p - 1 : -1, x + 1 < width ? p + 1 : -1, p - width, p + width]) {
        if (n < 0 || n >= size || labels[n] !== -1 || !data[n * 4 + 3]) continue;
        if (data[n * 4] !== color[0] || data[n * 4 + 1] !== color[1] || data[n * 4 + 2] !== color[2]) continue;
        labels[n] = id; queue[tail++] = n;
      }
    }
    regions.push({ count: tail, color, minX, maxX, minY, maxY });
  }
  const parent = Int32Array.from(regions, (_, i) => i);
  const root = (id: number) => {
    let r = id;
    while (parent[r] !== r) r = parent[r];
    while (parent[id] !== id) { const next = parent[id]; parent[id] = r; id = next; }
    return r;
  };
  // Smallest first lets adjacent flecks consolidate into a stable larger area.
  const order = regions.map((_, i) => i).sort((a, b) => regions[a].count - regions[b].count);
  const borders = regions.map(() => new Set<number>());
  for (let p = 0; p < size; p++) {
    const a = labels[p]; if (a < 0) continue;
    for (const n of [p % width + 1 < width ? p + 1 : -1, p + width < size ? p + width : -1]) {
      if (n < 0) continue;
      const b = labels[n];
      if (b >= 0 && b !== a) { borders[a].add(b); borders[b].add(a); }
    }
  }
  for (const id of order) {
    if (parent[id] !== id || regions[id].count >= minimum) continue;
    const spanX = regions[id].maxX - regions[id].minX + 1, spanY = regions[id].maxY - regions[id].minY + 1;
    // Long narrow regions describe a seam or a stroke; compact islands are
    // much more likely to be small surface imperfections.
    if (Math.max(spanX, spanY) >= 10 && Math.max(spanX, spanY) > 3 * Math.min(spanX, spanY)) continue;
    let best = -1, distance = Infinity;
    for (const neighbor of borders[id]) {
      const target = root(neighbor); if (target === id) continue;
      if (differentHue(regions[id].color, regions[target].color)) continue;
      const d = regions[id].color.reduce((sum, c, k) => sum + (c - regions[target].color[k]) ** 2, 0);
      if (d < distance) { distance = d; best = target; }
    }
    // Preserve isolated high-contrast accents (eyes, runes, lights).
    if (best < 0 || distance > 2500) continue;
    parent[id] = best; regions[best].count += regions[id].count;
    regions[best].minX = Math.min(regions[best].minX, regions[id].minX);
    regions[best].maxX = Math.max(regions[best].maxX, regions[id].maxX);
    regions[best].minY = Math.min(regions[best].minY, regions[id].minY);
    regions[best].maxY = Math.max(regions[best].maxY, regions[id].maxY);
    for (const n of borders[id]) borders[best].add(n);
  }
  for (let p = 0; p < size; p++) {
    if (labels[p] < 0) continue;
    const color = regions[root(labels[p])].color;
    data[p * 4] = color[0]; data[p * 4 + 1] = color[1]; data[p * 4 + 2] = color[2];
  }
}

const STROKE_DIRECTIONS = [[2, 0], [0, 2], [2, 2], [2, -2]] as const;
const COVERAGE_WEIGHTS = Array.from({ length: 25 }, (_, i) => Math.exp(-((i % 5 - 2) ** 2 + (Math.floor(i / 5) - 2) ** 2) / 2));

function roundRegionEdges(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  let current = data;
  // At most 21 colours occur in this neighbourhood. Reuse small buffers rather
  // than allocating a Map and its entries for every pixel of every pass.
  const colors = new Int32Array(21), counts = new Float64Array(21);
  for (let pass = 0; pass < 2 + Math.ceil(amount); pass++) {
    const next = new Uint8ClampedArray(current);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!current[i + 3]) continue;
      let colorCount = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy > 5) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const j = (ny * width + nx) * 4;
        if (!current[j + 3]) continue;
        const color = (current[j] << 16) | (current[j + 1] << 8) | current[j + 2];
        let slot = 0;
        while (slot < colorCount && colors[slot] !== color) slot++;
        if (slot === colorCount) { colors[slot] = color; counts[slot] = 0; colorCount++; }
        counts[slot] += current[j + 3] / 255;
      }
      let best = (current[i] << 16) | (current[i + 1] << 8) | current[i + 2];
      let count = 0;
      for (let slot = 0; slot < colorCount; slot++) if (colors[slot] === best) { count = counts[slot]; break; }
      const same = (dx: number, dy: number) => {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return false;
        const j = (ny * width + nx) * 4;
        return current[j + 3] > 0 && current[i] === current[j] && current[i + 1] === current[j + 1] && current[i + 2] === current[j + 2];
      };
      // Protect a coherent narrow stroke, rather than every pixel with five
      // neighbours: that old rule also protected bumps on broad flat regions.
      const stroke = STROKE_DIRECTIONS.some(([dx, dy]) =>
        same(dx, dy) && same(-dx, -dy) && !same(-dy, dx) && !same(dy, -dx));
      if (stroke) continue;
      for (let slot = 0; slot < colorCount; slot++) if (counts[slot] > count) { best = colors[slot]; count = counts[slot]; }
      const r = best >> 16, g = best >> 8 & 255, b = best & 255;
      if (differentHue([r, g, b], [current[i], current[i + 1], current[i + 2]])) continue;
      if ((r - current[i]) ** 2 + (g - current[i + 1]) ** 2 + (b - current[i + 2]) ** 2 > 10000) continue;
      next[i] = r; next[i + 1] = g; next[i + 2] = b;
    }
    current = next;
  }
  return current;
}

// Keep continuous tones in broad, low-detail areas (sky, haze, soft shadows).
// A palette alone turns those gradients into visible contour bands. This is
// based on local image structure, not a semantic foreground/background mask.
function softenGradients(styled: Uint8ClampedArray, source: Uint8ClampedArray, width: number, height: number) {
  const output = new Uint8ClampedArray(styled);
  const radius = Math.max(2, Math.round(Math.min(width, height) * 0.008));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (!source[i + 3]) continue;
    let curvature = 0, contrast = 0;
    let opaque = true;
    for (const [before, after, wideBefore, wideAfter] of [
      [(y * width + Math.max(0, x - 2)) * 4, (y * width + Math.min(width - 1, x + 2)) * 4,
        (y * width + Math.max(0, x - radius)) * 4, (y * width + Math.min(width - 1, x + radius)) * 4],
      [(Math.max(0, y - 2) * width + x) * 4, (Math.min(height - 1, y + 2) * width + x) * 4,
        (Math.max(0, y - radius) * width + x) * 4, (Math.min(height - 1, y + radius) * width + x) * 4],
    ]) {
      if (!source[before + 3] || !source[after + 3]) { opaque = false; break; }
      for (let c = 0; c < 3; c++) {
        const a = source[before + c], b = source[after + c], center = source[i + c];
        curvature = Math.max(curvature, Math.abs(a + b - 2 * center));
        contrast = Math.max(contrast, Math.abs(source[wideBefore + c] - center), Math.abs(source[wideAfter + c] - center));
      }
    }
    if (!opaque) continue;
    const continuity = Math.max(0, 1 - curvature / 16);
    const edgeProtection = Math.max(0, 1 - contrast / 65);
    const weight = 0.9 * continuity * continuity * edgeProtection;
    for (let c = 0; c < 3; c++) output[i + c] = styled[i + c] * (1 - weight) + source[i + c] * weight;
  }
  return output;
}

export function stylizePixels(data: Uint8ClampedArray, width: number, height: number, strength: number) {
  // Full posterization starts at 40%; keep maximum simplification at 100%.
  const percent = Math.max(0, Math.min(100, strength));
  const amount = percent <= 40 ? percent / 40 : 1 + (percent - 40) / 60;
  const blend = Math.min(1, amount);
  if (!amount) return new Uint8ClampedArray(data);
  // A strip has no 2D regions to simplify; retain its hue-preserving treatment.
  if (width < 2 || height < 2) return posterizeStrip(data, width, height, amount);
  const original = data;
  data = smoothRegions(data, width, height, amount);
  // Quantize RGB jointly. Independent hue/value bins create extra contour
  // lines in dark gradients, even where brightness is already uniform.
  let output = flattenPalette(data, amount);
  mergeSmallRegions(output, width, height, Math.max(16, Math.round(width * height * 0.0001 * amount)));
  output = roundRegionEdges(output, width, height, amount);
  if (blend < 1) {
    for (let i = 0; i < output.length; i += 4) {
      if (!output[i + 3]) continue;
      for (let c = 0; c < 3; c++) output[i + c] = original[i + c] * (1 - blend) + output[i + c] * blend;
    }
  }
  // Coverage filtering must cross colour boundaries, including high-contrast
  // ones: a colour-aware filter would preserve the very stair steps we remove.
  // Interiors remain flat and alpha is retained exactly.
  const antialiased = new Uint8ClampedArray(output);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (!output[i + 3]) continue;
    let red = 0, green = 0, blue = 0, total = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const j = (ny * width + nx) * 4;
      if (!output[j + 3]) continue;
      const weight = COVERAGE_WEIGHTS[(dy + 2) * 5 + dx + 2] * output[j + 3] / 255;
      red += output[j] * weight; green += output[j + 1] * weight; blue += output[j + 2] * weight; total += weight;
    }
    antialiased[i] = red / total; antialiased[i + 1] = green / total; antialiased[i + 2] = blue / total;
  }
  return softenGradients(antialiased, data, width, height);
}

function posterizeStrip(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  const original = data;
  const blend = Math.min(1, amount);
  const smooth = new Uint8ClampedArray(data.length);
  const radius = amount >= 1.5 ? 4 : amount >= .5 ? 3 : 1;
  const range = 16 + amount * 36;
  const weights = Array.from({ length: 766 }, (_, difference) => Math.exp(-difference * difference / (2 * range * range * 3)));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    let brightness = 0, total = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const neighbor = (ny * width + nx) * 4;
      if (data[neighbor + 3] === 0) continue;
      const difference = Math.abs(data[index] - data[neighbor]) + Math.abs(data[index + 1] - data[neighbor + 1]) + Math.abs(data[index + 2] - data[neighbor + 2]);
      const weight = weights[difference] / (1 + dx * dx + dy * dy);
      brightness += Math.max(data[neighbor], data[neighbor + 1], data[neighbor + 2]) * weight;
      total += weight;
    }
    // Smooth brightness, preserving each pixel's hue and saturation. Averaging
    // RGB directly mixes coloured accents with their neutral surroundings.
    const originalValue = Math.max(data[index], data[index + 1], data[index + 2]);
    const value = total ? brightness / total : originalValue;
    const scale = originalValue ? value / originalValue : 0;
    for (let c = 0; c < 3; c++) smooth[index + c] = data[index + c] * scale;
    smooth[index + 3] = data[index + 3];
  }
  // Quantize tone and small variations within each hue separately. Never
  // substitute another hue to satisfy a global palette or saturation target.
  const samples: number[] = [];
  const step = Math.max(1, Math.floor(width * height / 5000));
  for (let pixel = 0; pixel < width * height; pixel += step) {
    const i = pixel * 4;
    if (smooth[i + 3] > 0) samples.push(Math.max(smooth[i], smooth[i + 1], smooth[i + 2]));
  }
  if (!samples.length) return new Uint8ClampedArray(data);
  samples.sort((a, b) => a - b);
  const count = Math.round(amount <= 1 ? 24 - amount * 18 : 6 - (amount - 1) * 2);
  const levels = Array.from({ length: count }, (_, k) => samples[Math.round(k * (samples.length - 1) / (count - 1))]);
  const hasBlack = samples[0] === 0;
  // Keep the brightest source tone instead of averaging highlights down.
  const highlight = samples[samples.length - 1];
  const closestLevel = (value: number) => {
    let closest = 0;
    for (let k = 1; k < levels.length; k++) {
      if (Math.abs(value - levels[k]) < Math.abs(value - levels[closest])) closest = k;
    }
    return closest;
  };
  for (let iteration = 0; iteration < 8; iteration++) {
    const sums = levels.map(() => [0, 0]);
    for (const value of samples) {
      const sum = sums[closestLevel(value)]; sum[0] += value; sum[1]++;
    }
    sums.forEach((sum, k) => { if (sum[1] && !(hasBlack && k === 0) && k !== count - 1) levels[k] = sum[0] / sum[1]; });
    levels[count - 1] = highlight;
  }
  const output = new Uint8ClampedArray(data);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const originalValue = Math.max(data[i], data[i + 1], data[i + 2]);
    if (!originalValue) continue;
    const value = Math.max(smooth[i], smooth[i + 1], smooth[i + 2]);
    const target = Math.round(levels[closestLevel(value)]);
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const chroma = originalValue - Math.min(r, g, b);
    const saturation = chroma / originalValue;
    let hue = !chroma ? 0 : originalValue === r ? (g - b) / chroma : originalValue === g ? 2 + (b - r) / chroma : 4 + (r - g) / chroma;
    hue = (hue + 6) % 6;
    const hueSteps = amount >= 1.5 ? 24 : 36;
    hue = Math.round(hue * hueSteps / 6) * 6 / hueSteps % 6;
    const saturationSteps = amount >= 1.5 ? 8 : 12;
    // Round coloured pixels upwards: simplification must not wash them out.
    // Neutral pixels retain their own saturation and cannot acquire a tint.
    const flatSaturation = saturation < 0.06 ? saturation : Math.ceil(saturation * saturationSteps - 1e-8) / saturationSteps;
    const flatChroma = target * flatSaturation;
    const secondary = flatChroma * (1 - Math.abs(hue % 2 - 1));
    const base = target - flatChroma;
    const channels = hue < 1 ? [flatChroma, secondary, 0] : hue < 2 ? [secondary, flatChroma, 0] : hue < 3 ? [0, flatChroma, secondary] : hue < 4 ? [0, secondary, flatChroma] : hue < 5 ? [secondary, 0, flatChroma] : [flatChroma, 0, secondary];
    for (let c = 0; c < 3; c++) output[i + c] = original[i + c] * (1 - blend) + (channels[c] + base) * blend;
  }
  return output;
}
