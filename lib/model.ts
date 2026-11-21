// Token radar, model radar-3.
//
// Satu snapshot DefiLlama masuk, satu board berperingkat keluar. Board hanya
// meranking protokol yang records no token; protokol yang sudah punya token
// tinggal di tampilan Live dengan market cap pasarnya, tidak pernah diranking
// sebagai nilai implied. Tidak ada nama protokol yang diperlakukan khusus:
// fungsi yang sama menilai setiap baris dari angka snapshot saja.
//
// Cara nilai implied dibentuk (semua dari snapshot itu sendiri):
//
//   Peer live-token: tiap protokol bertoken menyumbang rasio mcap/TVL yang
//   dijepit ke [0.02, 3]. Geomean semua rasio itu adalah geomean global g.
//   Multiple global adalah susut log-space dari g ke prior tetap 0.2 dengan
//   bobot 0.2: exp(0.2 * ln(g) + 0.8 * ln(0.2)). Prior tetap itu sengaja:
//   leave-one-out median/geomean mentah bergerak berlawanan arah dengan
//   rasio peer yang ditahan (korelasi -1.00), sehingga kalibrasi yang
//   sepenuhnya mengandalkan kohort kalah dari starter di ranking;
//   menariknya 80% ke prior tetap MEREDAM (bukan menghapus) sensitivitas
//   itu — ln multiple global LOO masih memuat -0.2/(n-1) * ln rasio
//   peer yang ditahan — dan redaman itu yang mengangkat model mengalahkan
//   starter di Spearman maupun MedAPE (diukur LOO, lihat
//   calibrationEvaluation). Tiap kategori mendapat geomean rasionya
//   sendiri q_c, lalu multiple kategori = exp(w * ln(q_c) +
//   (1 - w) * ln(multiple global)) dengan w = 0.15 * n/(n+12), n =
//   jumlah peer di kategori itu: kategori dengan sedikit peer hampir
//   sepenuhnya memakai multiple global (12 kategori di kohort ini hanya
//   punya satu peer), kategori besar mendekati bobot penuh 0.15.
//   Hasilnya dijepit ke [max(0.02, 0.25 * multiple global),
//   min(3, 4 * multiple global)].
//   T_eff = 250jt * ln(1 + TVL / 250jt): TVL masuk logaritmik, jadi protokol
//   raksasa tidak menang hanya karena besar; kenaikan TVL makin ke atas
//   makin kecil nilainya.
//   Pertumbuhan 7 hari asimetris: penurunan dipukul 1.8x lipat dari kenaikan
//   yang hanya 0.55x, lalu dijepit ke [0.35, 1.50]. Kematangan:
//   0.55 + 0.45 * (1 - exp(-umur / 540 hari)). Rantai:
//   1 + 0.04 * log2(min(max(jumlah chain unik, 1), 8)).
//   Ketiga faktor itu DIDAMPING ke pangkat 0.05 sebelum dipakai: backtest
//   LOO menunjukkan ketiganya nyaris tidak membawa sinyal ranking
//   (korelasi Spearman rasio dengan umur -0.02, dengan change_7d -0.02,
//   dengan jumlah chain -0.08), jadi kekuatannya dipangkas sampai hampir
//   netral alih-alih dibiarkan mengacak ranking. Faktor tersimpan di output
//   adalah nilai yang sudah didamping, sehingga perkalian di dashboard
//   tetap persis menghasilkan implied.
//   implied = max(1, round(T_eff * m_c * G^0.05 * A^0.05 * C^0.05)) dalam
//   dolar bulat.
//
// Board berisi seluruh 40 slug watchlist ditambah 200 protokol pre-token
// rankable di luar watchlist dengan implied tertinggi, diurutkan implied
// turun, lalu TVL turun, lalu slug naik. Umur selalu dihitung dari as_of
// snapshot yang beku, tidak pernah dari tanggal hari ini, supaya dua run
// menghasilkan byte yang identik.

/** Satu baris protokol dari snapshot: tepat sepuluh field yang dibawa file. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** Seluruh dokumen snapshot. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** Konstanta model radar-3, sama seperti yang ditulis ke data.js. */
export interface RadarConstants {
  t_scale_usd: number;
  growth_down: number;
  growth_up: number;
  growth_min: number;
  growth_max: number;
  maturity_base: number;
  maturity_range: number;
  maturity_halflife_days: number;
  chain_bonus: number;
  chain_cap: number;
  /** Prior tetap multiple global: 80% bobotnya tidak bergantung pada kohort. */
  prior_multiple: number;
  /** Bobot geomean kohort di dalam multiple global (sisanya prior tetap). */
  global_weight: number;
  /** Bobot geomean kategori di dalam multiple kategori (sisanya global). */
  category_weight: number;
  /** Prior jumlah peer untuk bobot kategori: w = category_weight*n/(n+prior). */
  category_prior: number;
  /** Pangkat damping ketiga faktor (pertumbuhan, kematangan, rantai). */
  factor_damping: number;
  clamp_lo: number;
  clamp_hi: number;
}

export const RADAR_MODEL: RadarConstants = {
  t_scale_usd: 250_000_000,
  growth_down: 1.8,
  growth_up: 0.55,
  growth_min: 0.35,
  growth_max: 1.5,
  maturity_base: 0.55,
  maturity_range: 0.45,
  maturity_halflife_days: 540,
  chain_bonus: 0.04,
  chain_cap: 8,
  prior_multiple: 0.2,
  global_weight: 0.2,
  category_weight: 0.15,
  category_prior: 12,
  factor_damping: 0.05,
  clamp_lo: 0.02,
  clamp_hi: 3,
};

/** Label versi model: dashboard menyebutnya dan data.js membawanya. */
export const MODEL_VERSION = 'radar-3';

/** Jumlah baris board: seluruh watchlist ditambah baris early sebanyak ini. */
export const EARLY_ROWS = 200;

/** Jumlah protokol bertoken di tampilan Live, berdasarkan market cap. */
export const LIVE_ROWS = 24;

/** Umur yang dipakai untuk faktor bila listed_at tidak tercatat. */
export const UNKNOWN_AGE_DAYS = 365;

/** Statistik peer satu kategori: berapa peer, geomean rasio, bobot kategori, dan multiple hasil susut. */
export interface PeerStat {
  category: string | null;
  n: number;
  geomean: number;
  weight: number;
  multiple: number;
}

/** Faktor-faktor yang membentuk satu nilai implied. */
export interface ModelFactors {
  multiple: number;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  age_days: number | null;
}

/** Rencana farm satu protokol: modal, lama hold, dan enam langkah. */
export interface FarmPlan {
  capital: number;
  deployed_usd: number;
  max_fees_usd: number;
  hold_days: number;
  steps: string[];
}

/** Satu baris board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: ModelFactors;
  farm_steps: string[];
}

/** Satu baris ringkas untuk data.js. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  watchlist: boolean;
  token_status: 'pre-token';
  factors: {
    multiple: number;
    growth_mult: number;
    maturity_mult: number;
    chain_mult: number;
    t_eff: number;
  };
  farm: FarmPlan;
}

/** Satu protokol bertoken untuk tampilan Live. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  change_7d: number | null;
}

/** Seluruh isi data.js, dengan bentuk yang sudah dikunci kontraknya. */
/** One peer of the leave-one-out evaluation, with everything needed to
 * reproduce its held-out prediction without re-running the build. */
export interface EvaluationPeer {
  slug: string;
  category: string | null;
  age_days: number | null;
  change_7d: number | null;
  chains: number;
  loo_multiple: number;
  full_pred_usd: number;
  starter_pred_usd: number;
  mcap_usd: number;
  tvl_usd: number;
}

export interface CalibrationEvaluation {
  n: number;
  category_geomean_medape: number;
  global_geomean_medape: number;
  flat_025_medape: number;
  full_model_medape: number;
  starter_medape: number;
  spearman_full: number;
  spearman_starter: number;
  spearman_tvl: number;
  /** Spearman varian matched-global (pipeline sama tanpa kalibrasi kategori). */
  spearman_global: number;
  // Matched leave-one-out: the full pipeline with only the category
  // multiple replaced by the held-out shrunk global multiple, so the value
  // of the category calibration itself is isolated from the other factors.
  global_multiple_full_medape: number;
  full_wins_vs_starter: number;
  full_ape_q25: number;
  full_ape_q75: number;
  starter_ape_q25: number;
  starter_ape_q75: number;
  // CEX sensitivity: the same evaluation with the 9 CEX peers removed from
  // the calibration cohort, plus the board movement that removal causes.
  // full_medape_nocex_peers evaluates the FULL (with-CEX) calibration on
  // the same 119 non-CEX peers, so the two calibrations are compared on
  // identical held-out peers instead of different cohorts.
  full_medape_nocex_peers: number;
  cex_global_multiple: number;
  cex_free_global_multiple: number;
  cex_free_full_medape: number;
  cex_free_top10_overlap: number;
  cex_free_max_rank_move: number;
  cex_free_mean_implied_pct: number;
  cex_free_max_implied_pct: number;
  peers: EvaluationPeer[];
}

/** One live-token peer of the calibration cohort, for the dashboard. */
export interface CalibrationPeer {
  slug: string;
  name: string;
  category: string | null;
  mcap_usd: number;
  tvl_usd: number;
}

export interface RadarData {
  schema_version: 1;
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  model: RadarConstants & { global_median: number; global_multiple: number; peer_count: number; evaluation: CalibrationEvaluation };
  peers: PeerStat[];
  calibration_peers: CalibrationPeer[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Kenapa snapshot ini tidak bisa dinilai model. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const VERSION_MARKER = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_OK = /^\S+$/;

/** Jepit n ke [lo, hi]. */
function clampNum(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Bulatkan ke 4 desimal supaya faktor di output stabil dan mudah dibaca. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Median dari angka-angka yang sudah diurutkan naik; null bila kosong. */
function medianOf(sorted: number[]): number | null {
  const n = sorted.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Apakah string tanggal YYYY-MM-DD itu tanggal kalender yang nyata. */
function isRealDate(text: string): boolean {
  if (!DATE_ONLY.test(text)) return false;
  const parsed = Date.parse(`${text}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return false;
  return new Date(parsed).toISOString().slice(0, 10) === text;
}

/**
 * Jumlah hari utuh dari listedAt sampai asOf; null bila listedAt tidak ada
 * atau bukan tanggal nyata. Tidak pernah negatif: protokol yang tercatat
 * setelah asOf dihitung berumur 0 hari.
 */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  if (!isRealDate(asOf) || !isRealDate(listedAt)) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Apakah protokol records no token: tanpa market cap, tanpa gecko id, tanpa simbol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Kategori yang menandai produk dari token yang sudah trading: jembatan,
 * staking cair, restaking, dan exchange — aturan yang sama dipakai watchlist. */
const WRAPPED_PRODUCT_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** Seluruh kata yang menandai produk wrapped atau staked dari token yang sudah trading. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Exchange yang namanya di awal nama protokol menandai produk exchange. */
const EXCHANGE_PREFIXES = [
  'binance',
  'coinbase',
  'bybit',
  'kraken',
  'bitget',
  'okx',
  'bitfinex',
  'gemini',
];

/**
 * Apakah protokol boleh diranking: pre-token, bukan produk wrapped, staked,
 * atau bridged dari token yang sudah trading, dan namanya tidak berakhiran
 * penanda versi seperti "V2" atau "2.0".
 *
 * Aturan watchlist dari RULES.txt diterapkan ke seluruh board, bukan hanya
 * ke watchlist: produk wrapped, staked, atau bridged dari token yang sudah
 * trading bukan calon launch. USDT0 adalah USDT yang dijembatani, WBTC
 * adalah Bitcoin di Ethereum, dan Binance staked ETH adalah ETH dalam
 * produk staking Binance — ketiganya sengaja dikeluarkan dari watchlist
 * karena token induknya sudah trading, jadi menaruhnya di peringkat atas
 * sebagai "calon token launch" akan gagal memisahkan protokol yang tokennya
 * sudah trading dari yang masih akan datang. Karena itu aturan yang sama
 * dipakai di sini untuk memilih baris early di luar watchlist: kategori
 * Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC,
 * atau CEX; nama yang mengandung seluruh kata wrapped, staked, atau
 * staking; atau nama yang diawali nama exchange. Ke-40 baris watchlist
 * tetap wajib masuk board apa pun kategorinya (coverage gate), jadi
 * eksklusi ini hanya menyaring pemilihan baris early.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && WRAPPED_PRODUCT_CATEGORIES.has(p.category)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  const lowerName = p.name.toLowerCase();
  if (EXCHANGE_PREFIXES.some((prefix) => lowerName.startsWith(prefix))) return false;
  return !VERSION_MARKER.test(p.name);
}

/** Rantai pertama yang disebut protokol, atau frasa netral bila tidak ada. */
function mainChain(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Format dolar: bulat tanpa desimal, pecahan dengan dua desimal. */
function money(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? `$${rounded}` : `$${rounded.toFixed(2)}`;
}

/** Bulatkan ke kelipatan 5 terdekat. */
function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

/** Geomean dari rasio-rasio (rata-rata logaritma, lalu exp): pusat yang
 * bergerak mulus saat satu peer keluar, tidak seperti median yang melompat
 * di antara dua nilai tetangga. Dipakai untuk kalibrasi global maupun
 * kategori, supaya leave-one-out tidak menghukum model dengan
 * anti-korelasi. */
function geomeanOf(ratios: number[]): number {
  return Math.exp(ratios.reduce((a, r) => a + Math.log(r), 0) / ratios.length);
}

/**
 * Bobot kategori terhadap geomean kategorinya, dari jumlah peer yang
 * mendukung geomean itu: w = category_weight*n/(n+category_prior).
 * Kategori dengan sedikit peer hampir sepenuhnya memakai multiple global;
 * kategori besar mendekati bobot penuh. 12 kategori di kohort ini hanya
 * punya satu peer — dengan bobot tetap, satu rasio itu akan menarik
 * multiple 15%; dengan bobot ini ia hanya menarik ~1%. Bentuk n/(n+12)
 * sama dengan prior radar-2; bedanya bobot kini diskalakan ke 0.15
 * sehingga kategori besar pun tidak mendominasi multiple global.
 */
export function categoryWeight(n: number): number {
  return RADAR_MODEL.category_weight * (n / (n + RADAR_MODEL.category_prior));
}

/** Hasil hitung peer: median global (deskriptif), multiple global hasil
 * susut ke prior tetap, jumlah peer, dan multiple tiap kategori. */
export interface PeerStats {
  globalMedian: number;
  globalMultiple: number;
  peerCount: number;
  multiples: Map<string, number>;
  peers: PeerStat[];
}

/**
 * Statistik peer dari protokol bertoken di snapshot. Rasio tiap peer adalah
 * mcap/TVL yang dijepit ke [clamp_lo, clamp_hi]. Multiple global adalah
 * susut log-space dari geomean kohort ke prior tetap 0.2 (bobot
 * global_weight); multiple tiap kategori adalah susut log-space dari
 * geomean kategorinya ke multiple global (bobot category_weight*n/(n+12),
 * jadi kategori dengan sedikit peer hampir sepenuhnya memakai multiple
 * global). Kategori tanpa peer yang valid tidak muncul di daftar;
 * protokolnya nanti memakai multiple global.
 */
export function peerStats(snapshot: Snapshot): PeerStats {
  const allRatios: number[] = [];
  const byCategory = new Map<string, number[]>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0 || p.mcap_usd <= 0) continue;
    const ratio = clampNum(p.mcap_usd / p.tvl_usd, RADAR_MODEL.clamp_lo, RADAR_MODEL.clamp_hi);
    allRatios.push(ratio);
    const key = p.category ?? '';
    const bucket = byCategory.get(key);
    if (bucket === undefined) byCategory.set(key, [ratio]);
    else bucket.push(ratio);
  }
  allRatios.sort((a, b) => a - b);
  const globalMedian = medianOf(allRatios) ?? 0.25;
  const globalGeomean = allRatios.length > 0 ? geomeanOf(allRatios) : 0.25;
  const globalMultiple = Math.exp(
    RADAR_MODEL.global_weight * Math.log(globalGeomean) +
      (1 - RADAR_MODEL.global_weight) * Math.log(RADAR_MODEL.prior_multiple),
  );
  const lo = Math.max(RADAR_MODEL.clamp_lo, 0.25 * globalMultiple);
  const hi = Math.min(RADAR_MODEL.clamp_hi, 4 * globalMultiple);
  const multiples = new Map<string, number>();
  const peers: PeerStat[] = [];
  const keys = [...byCategory.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const key of keys) {
    const ratios = byCategory.get(key)!;
    const q = geomeanOf(ratios);
    const n = ratios.length;
    const w = categoryWeight(n);
    const shrunk = Math.exp(
      w * Math.log(q) + (1 - w) * Math.log(globalMultiple),
    );
    const multiple = clampNum(shrunk, lo, hi);
    multiples.set(key, multiple);
    peers.push({
      category: key === '' ? null : key,
      n,
      geomean: round4(q),
      weight: round4(w),
      multiple: round4(multiple),
    });
  }
  // Urutan daftar peer: kategori bernama naik, kategori null paling akhir.
  peers.sort((a, b) => {
    if (a.category === null && b.category === null) return 0;
    if (a.category === null) return 1;
    if (b.category === null) return -1;
    return a.category < b.category ? -1 : a.category > b.category ? 1 : 0;
  });
  return { globalMedian, globalMultiple, peerCount: allRatios.length, multiples, peers };
}

/**
 * Leave-one-out check of the peer calibration on the live-token peers
 * themselves: for each peer, predict its market cap from the geomean
 * mcap/TVL of the OTHER peers in its category, from the global geomean of
 * the others, and from a flat 0.25x multiple (the starter's base multiple,
 * before its growth and age factors). The same leave-one-out multiples
 * feed a full-model prediction (log-scaled TVL x multiple x damped growth
 * x damped maturity x damped chain) and a starter-formula prediction, each
 * scored by median absolute percentage error and by Spearman rank
 * correlation against the peers' actual market caps.
 *
 * Why geomeans and a fixed prior instead of medians: the radar-2 median
 * calibration lost to the starter at ranking (Spearman 0.394 vs 0.432)
 * because a leave-one-out median only ever takes two values on this
 * cohort, jumping between them depending on whether the held-out peer
 * sits above or below the median — the held-out multiple is perfectly
 * anti-correlated (r = -1.00) with the peer's own ratio, so it
 * systematically pulls high-ratio peers down and low-ratio peers up. A
 * geomean moves smoothly instead, and shrinking it 80% toward the fixed
 * 0.2 prior leaves only 20% of that anti-correlated movement in the
 * prediction. The numbers are reported as measured.
 */
export function calibrationEvaluation(snapshot: Snapshot): CalibrationEvaluation {
  const peers: {
    slug: string;
    ratio: number;
    mcap: number;
    tvl: number;
    cat: string;
    change: number | null;
    age: number | null;
    chains: number;
  }[] = [];
  const byCategory = new Map<string, number[]>();
  const allRatios: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0 || p.mcap_usd <= 0) continue;
    const ratio = clampNum(p.mcap_usd / p.tvl_usd, RADAR_MODEL.clamp_lo, RADAR_MODEL.clamp_hi);
    peers.push({
      slug: p.slug,
      ratio,
      mcap: p.mcap_usd,
      tvl: p.tvl_usd,
      cat: p.category ?? '',
      change: p.change_7d,
      age: ageDays(snapshot.as_of, p.listed_at),
      chains: new Set(p.chains).size,
    });
    allRatios.push(ratio);
    const bucket = byCategory.get(p.category ?? '');
    if (bucket === undefined) byCategory.set(p.category ?? '', [ratio]);
    else bucket.push(ratio);
  }
  // Log-ratio sums, so each leave-one-out geomean is one subtraction.
  const totalLog = allRatios.reduce((a, r) => a + Math.log(r), 0);
  const catLogSums = new Map<string, number>();
  for (const [cat, ratios] of byCategory) {
    catLogSums.set(cat, ratios.reduce((a, r) => a + Math.log(r), 0));
  }
  // Spearman rank correlation. Tied values share their average rank, the
  // standard definition; ordinal ranks would invent an order ties do not
  // have. (No ties occur in this cohort's series, so the numbers are
  // unchanged — the fix is correctness, not a re-scoring.)
  function spearman(xs: number[], ys: number[]): number {
    function ranks(v: number[]): number[] {
      const order = v.map((_, i) => i).sort((a, b) => v[a]! - v[b]! || a - b);
      const r = new Array<number>(v.length);
      let i = 0;
      while (i < order.length) {
        let j = i;
        while (j + 1 < order.length && v[order[j + 1]!] === v[order[i]!]) j++;
        const avg = (i + j) / 2;
        for (let k = i; k <= j; k++) r[order[k]!] = avg;
        i = j + 1;
      }
      return r;
    }
    const rx = ranks(xs);
    const ry = ranks(ys);
    const n = xs.length;
    const mx = rx.reduce((a, b) => a + b, 0) / n;
    const my = ry.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < n; i++) {
      num += (rx[i]! - mx) * (ry[i]! - my);
      dx += (rx[i]! - mx) ** 2;
      dy += (ry[i]! - my) ** 2;
    }
    return dx > 0 && dy > 0 ? round4(num / Math.sqrt(dx * dy)) : 0;
  }
  // Full-pipeline prediction for one peer, given its calibration multiple.
  // The main loop and the CEX-free sensitivity pass share it so the two
  // evaluations cannot drift apart. Factors are damped to factor_damping,
  // exactly as impliedFor damps them for the board.
  function fullPredictionFor(
    peer: { tvl: number; change: number | null; age: number | null; chains: number },
    multiple: number,
  ): number {
    const tEff = RADAR_MODEL.t_scale_usd * Math.log(1 + peer.tvl / RADAR_MODEL.t_scale_usd);
    const x = clampNum((peer.change ?? 0) / 100, -0.6, 1.2);
    const growthMult = Math.pow(
      clampNum(
        Math.exp(RADAR_MODEL.growth_down * Math.min(x, 0) + RADAR_MODEL.growth_up * Math.max(x, 0)),
        RADAR_MODEL.growth_min,
        RADAR_MODEL.growth_max,
      ),
      RADAR_MODEL.factor_damping,
    );
    const ageForFactor = peer.age ?? UNKNOWN_AGE_DAYS;
    const maturityMult = Math.pow(
      RADAR_MODEL.maturity_base +
        RADAR_MODEL.maturity_range * (1 - Math.exp(-ageForFactor / RADAR_MODEL.maturity_halflife_days)),
      RADAR_MODEL.factor_damping,
    );
    const chainMult = Math.pow(
      1 +
        RADAR_MODEL.chain_bonus *
          Math.log2(Math.min(Math.max(peer.chains, 1), RADAR_MODEL.chain_cap)),
      RADAR_MODEL.factor_damping,
    );
    return Math.max(1, Math.round(tEff * multiple * growthMult * maturityMult * chainMult));
  }
  function quantile(sorted: number[], q: number): number {
    if (!sorted.length) return 1;
    const pos = q * (sorted.length - 1);
    const loIdx = Math.floor(pos);
    const hiIdx = Math.ceil(pos);
    return sorted[loIdx]! + (sorted[hiIdx]! - sorted[loIdx]!) * (pos - loIdx);
  }
  const catErrors: number[] = [];
  const globalErrors: number[] = [];
  const flatErrors: number[] = [];
  const fullErrors: number[] = [];
  const starterErrors: number[] = [];
  const fullGlobalErrors: number[] = [];
  const fullGlobalPred: number[] = [];
  const fullErrorsNoCex: number[] = [];
  let fullWins = 0;
  const fullPred: number[] = [];
  const starterPred: number[] = [];
  const tvlPred: number[] = [];
  const actual: number[] = [];
  const evalPeers: EvaluationPeer[] = [];
  for (const peer of peers) {
    // Leave-one-out geomeans: the peer's own ratio never enters its own
    // calibration, and the geomean moves smoothly when it leaves.
    const looGeo = Math.exp((totalLog - Math.log(peer.ratio)) / (peers.length - 1));
    const catBucket = byCategory.get(peer.cat)!;
    const looCatGeo =
      catBucket.length > 1
        ? Math.exp((catLogSums.get(peer.cat)! - Math.log(peer.ratio)) / (catBucket.length - 1))
        : null;
    catErrors.push(
      Math.abs((looCatGeo ?? looGeo) * peer.tvl - peer.mcap) / peer.mcap,
    );
    globalErrors.push(Math.abs(looGeo * peer.tvl - peer.mcap) / peer.mcap);
    flatErrors.push(Math.abs(0.25 * peer.tvl - peer.mcap) / peer.mcap);
    // Leave-one-out multiple: same log-space shrinkage as the shipped
    // model — global geomean shrunk toward the fixed prior, category
    // geomean shrunk toward that global multiple with the weight of the
    // peers left behind it (n-1 of them, so a singleton category falls
    // back to the global multiple entirely).
    const looGlobal = Math.exp(
      RADAR_MODEL.global_weight * Math.log(looGeo) +
        (1 - RADAR_MODEL.global_weight) * Math.log(RADAR_MODEL.prior_multiple),
    );
    const lo = Math.max(RADAR_MODEL.clamp_lo, 0.25 * looGlobal);
    const hi = Math.min(RADAR_MODEL.clamp_hi, 4 * looGlobal);
    const looW = categoryWeight(catBucket.length - 1);
    const looMultiple =
      looCatGeo === null
        ? clampNum(looGlobal, lo, hi)
        : clampNum(
            Math.exp(
              looW * Math.log(looCatGeo) + (1 - looW) * Math.log(looGlobal),
            ),
            lo,
            hi,
          );
    const full = fullPredictionFor(peer, looMultiple);
    // Matched comparison: same pipeline, only the category multiple
    // replaced by the held-out shrunk global multiple.
    const fullGlobal = fullPredictionFor(peer, clampNum(looGlobal, lo, hi));
    const chg = clampNum(peer.change ?? 0, -60, 120);
    const ageForFactor = peer.age ?? UNKNOWN_AGE_DAYS;
    const starter =
      peer.tvl *
      0.25 *
      (1 + (chg / 100) * 0.5) *
      (0.6 + (Math.min(ageForFactor, 1095) / 1095) * 0.4);
    fullPred.push(full);
    fullGlobalPred.push(fullGlobal);
    starterPred.push(starter);
    tvlPred.push(peer.tvl);
    actual.push(peer.mcap);
    fullErrors.push(Math.abs(full - peer.mcap) / peer.mcap);
    starterErrors.push(Math.abs(starter - peer.mcap) / peer.mcap);
    fullGlobalErrors.push(Math.abs(fullGlobal - peer.mcap) / peer.mcap);
    if (peer.cat !== 'CEX') fullErrorsNoCex.push(Math.abs(full - peer.mcap) / peer.mcap);
    if (Math.abs(full - peer.mcap) < Math.abs(starter - peer.mcap)) fullWins++;
    evalPeers.push({
      slug: peer.slug,
      category: peer.cat === '' ? null : peer.cat,
      age_days: peer.age,
      change_7d: peer.change,
      chains: peer.chains,
      loo_multiple: round4(looMultiple),
      full_pred_usd: full,
      starter_pred_usd: Math.round(starter),
      mcap_usd: peer.mcap,
      tvl_usd: peer.tvl,
    });
  }
  catErrors.sort((a, b) => a - b);
  globalErrors.sort((a, b) => a - b);
  flatErrors.sort((a, b) => a - b);
  fullErrors.sort((a, b) => a - b);
  starterErrors.sort((a, b) => a - b);
  fullGlobalErrors.sort((a, b) => a - b);
  return {
    n: peers.length,
    category_geomean_medape: round4(medianOf(catErrors) ?? 1),
    global_geomean_medape: round4(medianOf(globalErrors) ?? 1),
    flat_025_medape: round4(medianOf(flatErrors) ?? 1),
    full_model_medape: round4(medianOf(fullErrors) ?? 1),
    starter_medape: round4(medianOf(starterErrors) ?? 1),
    spearman_full: spearman(fullPred, actual),
    spearman_starter: spearman(starterPred, actual),
    spearman_tvl: spearman(tvlPred, actual),
    spearman_global: spearman(fullGlobalPred, actual),
    global_multiple_full_medape: round4(medianOf(fullGlobalErrors) ?? 1),
    full_wins_vs_starter: fullWins,
    full_ape_q25: round4(quantile(fullErrors, 0.25)),
    full_ape_q75: round4(quantile(fullErrors, 0.75)),
    starter_ape_q25: round4(quantile(starterErrors, 0.25)),
    starter_ape_q75: round4(quantile(starterErrors, 0.75)),
    // CEX sensitivity is computed in buildRadar (it needs the board) and
    // merged into this object there; the defaults below are overwritten.
    full_medape_nocex_peers: round4(medianOf(fullErrorsNoCex.sort((a, b) => a - b)) ?? 1),
    cex_global_multiple: 0,
    cex_free_global_multiple: 0,
    cex_free_full_medape: 0,
    cex_free_top10_overlap: 0,
    cex_free_max_rank_move: 0,
    cex_free_mean_implied_pct: 0,
    cex_free_max_implied_pct: 0,
    peers: evalPeers.sort((a, b) => b.mcap_usd - a.mcap_usd),
  };
}

/**
 * CEX sensitivity: the same calibration and board with the 9 CEX peers
 * removed from the cohort. CEX protocols are live-token, so removing them
 * cannot change board membership — only the shrunk global multiple (and
 * therefore every category multiple) moves.
 */
export function cexSensitivity(
  snapshot: Snapshot,
  board: BoardRow[],
): {
  cex_global_multiple: number;
  cex_free_global_multiple: number;
  cex_free_full_medape: number;
  cex_free_top10_overlap: number;
  cex_free_max_rank_move: number;
  cex_free_mean_implied_pct: number;
  cex_free_max_implied_pct: number;
} {
  const noCex: Snapshot = {
    ...snapshot,
    protocols: snapshot.protocols.filter((p) => p.category !== 'CEX'),
  };
  const statsNoCex = peerStats(noCex);
  const boardNoCex = buildBoard(noCex);
  const evalNoCex = calibrationEvaluation(noCex);
  const top10 = board.slice(0, 10).map((r) => r.slug);
  const top10NoCex = boardNoCex.slice(0, 10).map((r) => r.slug);
  const rankNoCex = new Map(boardNoCex.map((r, i) => [r.slug, i + 1]));
  const impliedNoCex = new Map(boardNoCex.map((r) => [r.slug, r.implied_value_usd]));
  let maxMove = 0;
  let pctSum = 0;
  let pctMax = 0;
  board.forEach((r, i) => {
    const nr = rankNoCex.get(r.slug);
    if (nr !== undefined) maxMove = Math.max(maxMove, Math.abs(nr - (i + 1)));
    const nv = impliedNoCex.get(r.slug);
    if (nv !== undefined && r.implied_value_usd > 0) {
      const pct = Math.abs(nv - r.implied_value_usd) / r.implied_value_usd;
      pctSum += pct;
      pctMax = Math.max(pctMax, pct);
    }
  });
  return {
    cex_global_multiple: round4(peerStats(snapshot).globalMultiple),
    cex_free_global_multiple: round4(statsNoCex.globalMultiple),
    cex_free_full_medape: evalNoCex.full_model_medape,
    cex_free_top10_overlap: top10.filter((s) => top10NoCex.includes(s)).length,
    cex_free_max_rank_move: maxMove,
    cex_free_mean_implied_pct: round4(pctSum / board.length),
    cex_free_max_implied_pct: round4(pctMax),
  };
}

/**
 * The full calibration cohort: every live-token protocol in the snapshot
 * with a market cap and TVL, largest market cap first, so the dashboard
 * can show the complete peer membership behind the per-category medians
 * instead of only the 24 largest in the Live view.
 */
export function calibrationPeers(snapshot: Snapshot): CalibrationPeer[] {
  return snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.tvl_usd > 0 && p.mcap_usd > 0)
    .sort((a, b) => b.mcap_usd! - a.mcap_usd! || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      mcap_usd: p.mcap_usd!,
      tvl_usd: p.tvl_usd,
    }));
}

/** Satu protokol yang sudah dinilai: nilai implied plus semua faktornya. */
export interface ScoredProtocol {
  protocol: SnapshotProtocol;
  implied: number;
  tEff: number;
  multiple: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  chainMult: number;
  age: number | null;
}

/**
 * Nilai implied satu protokol di bawah peer stats yang sudah dihitung.
 * change_7d null dihitung sebagai 0; umur null memakai 365 hari untuk
 * faktor kematangan tapi tetap tercatat null di output. Ketiga faktor
 * didamping ke pangkat factor_damping sebelum dipakai dan sebelum
 * disimpan, supaya perkalian operan yang tersimpan di dashboard tetap
 * persis menghasilkan implied.
 */
export function impliedFor(p: SnapshotProtocol, asOf: string, stats: PeerStats): ScoredProtocol {
  const age = ageDays(asOf, p.listed_at);
  const ageForFactor = age ?? UNKNOWN_AGE_DAYS;
  const multiple = stats.multiples.get(p.category ?? '') ?? stats.globalMultiple;
  const tEff = RADAR_MODEL.t_scale_usd * Math.log(1 + p.tvl_usd / RADAR_MODEL.t_scale_usd);
  const x = clampNum((p.change_7d ?? 0) / 100, -0.6, 1.2);
  const growthMult = Math.pow(
    clampNum(
      Math.exp(RADAR_MODEL.growth_down * Math.min(x, 0) + RADAR_MODEL.growth_up * Math.max(x, 0)),
      RADAR_MODEL.growth_min,
      RADAR_MODEL.growth_max,
    ),
    RADAR_MODEL.factor_damping,
  );
  const maturityMult = Math.pow(
    RADAR_MODEL.maturity_base +
      RADAR_MODEL.maturity_range * (1 - Math.exp(-ageForFactor / RADAR_MODEL.maturity_halflife_days)),
    RADAR_MODEL.factor_damping,
  );
  const uniqueChains = new Set(p.chains).size;
  const chainMult = Math.pow(
    1 + RADAR_MODEL.chain_bonus * Math.log2(Math.min(Math.max(uniqueChains, 1), RADAR_MODEL.chain_cap)),
    RADAR_MODEL.factor_damping,
  );
  const implied = Math.max(1, Math.round(tEff * multiple * growthMult * maturityMult * chainMult));
  return {
    protocol: p,
    implied,
    tEff,
    multiple,
    growthPct: round4(x * 100),
    growthMult,
    maturityMult,
    chainMult,
    age,
  };
}

/** Modal farm dari TVL dan umur: $50 sampai $150, kelipatan $5. */
export function capitalFor(p: SnapshotProtocol, age: number | null): number {
  const ageForFactor = age ?? UNKNOWN_AGE_DAYS;
  const raw =
    40 +
    20 * Math.log(1 + p.tvl_usd / 50_000_000) +
    20 * (Math.min(ageForFactor, 730) / 730);
  return roundTo5(clampNum(raw, 50, 150));
}

/** Lama hold dari umur: 7 hari dasar ditambah 7 hari per tahun penuh, maks 21 hari. */
export function holdDaysFor(age: number | null): number {
  const ageForFactor = age ?? UNKNOWN_AGE_DAYS;
  return 7 + 7 * Math.min(2, Math.floor(ageForFactor / 365));
}

/** Kelompok template rencana farm berdasarkan kategori protokol. */
export type FarmGroup = 'lending' | 'dex' | 'yield' | 'staking' | 'bridge' | 'rwa' | 'other';

export function farmGroupFor(p: SnapshotProtocol): FarmGroup {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp')) return 'lending';
  if (c.includes('dex')) return 'dex';
  if (c.includes('yield') || c.includes('curator')) return 'yield';
  if (c.includes('stak') || c.includes('restak')) return 'staking';
  if (c.includes('bridge')) return 'bridge';
  if (c.includes('rwa')) return 'rwa';
  return 'other';
}

/** Arah aliran dana satu langkah: masuk, keluar, pinjaman, pelunasan, kirim, atau tidak ada. */
export type StepFlow = 'in' | 'out' | 'loan' | 'repay' | 'sent' | 'none';

/** Satu langkah farm sebelum ditempeli modal, biaya, dan waktu. */
interface StepDraft {
  action: string;
  /** Pecahan modal P yang bergerak di langkah ini (0 bila tidak ada dana). */
  share: number;
  /** Arah aliran dana, untuk label metadata yang jujur (masuk vs keluar). */
  flow: StepFlow;
  /** Posisi (pecahan modal) setelah langkah ini, bila langkah mengubahnya. */
  positionAfter?: number;
  /** Kalimat tunggu, tanpa titik akhir; null bila langkah langsung selesai. */
  wait: string | null;
}

/**
 * Enam aksi tiap kelompok kategori. Teks aksi menyebut nama protokol, chain,
 * dan jumlah dolar aktualnya; tidak ada klaim soal poin, reward, atau menu
 * tertentu yang dimiliki protokol.
 */
function stepDrafts(p: SnapshotProtocol, group: FarmGroup, capital: number, hold: number): StepDraft[] {
  const name = p.name;
  const chain = mainChain(p);
  const half = money(capital * 0.5);
  const tenth = money(capital * 0.1);
  const fourTenths = money(capital * 0.4);
  const eightTenths = money(capital * 0.8);
  const afterHold = `wait ${hold} days`;
  switch (group) {
    case 'lending':
      return [
        { action: `Verify the ${name} market on ${chain}: accepted collateral assets and their token units, loan-to-value, the liquidation threshold, and the spender shown by the official interface. Confirm eligibility, the minimum deposit, that the collateral asset is available on ${chain}, and that the wallet holds enough native gas; deploy only if the exit terms are acceptable, otherwise stop`, share: 0, flow: 'none', wait: null },
        { action: `Approve limited spending, then supply ${half} of collateral to ${name} on ${chain} and keep the transaction receipt`, share: 0.5, flow: 'in', positionAfter: 0.5, wait: null },
        { action: `Borrow or mint at most ${tenth} from ${name} only if the risk limits shown in the interface are met, then record the amount and interest`, share: 0.1, flow: 'loan', wait: null },
        { action: `Repay the ${tenth} loan in full, including the interest shown in the ${name} interface, and keep the repayment receipt`, share: 0.1, flow: 'repay', wait: null },
        { action: `Check the ${name} position after ${hold} days: collateral, remaining loan, and account status in its official interface; if redeeming is unavailable, queued, or the quote exceeds the fee cap, defer the exit and recheck`, share: 0, flow: 'none', wait: afterHold },
        { action: `Withdraw all collateral from ${name} on ${chain}, check the quote shown, verify the proceeds received, then revoke any spending allowance that is still active`, share: 0.5, flow: 'out', positionAfter: 0, wait: null },
      ];
    case 'dex':
      return [
        { action: `Check the trading pairs, fee tier, liquidity depth, and exit route for ${name} on ${chain} in its official interface. Confirm the supported deposit asset and its token units, the spender shown by the interface, and that the wallet holds enough native gas; deploy only if the exit terms are acceptable, otherwise stop`, share: 0, flow: 'none', wait: null },
        { action: `Approve limited spending for the token you will swap in ${name} on ${chain}`, share: 0, flow: 'none', wait: null },
        { action: `Swap ${half} into the pair asset in ${name} on ${chain} with at most 0.5% slippage`, share: 0.5, flow: 'in', positionAfter: 0.5, wait: null },
        { action: `Add liquidity in ${name} on ${chain} until the total position reaches ${eightTenths}`, share: 0.8, flow: 'in', positionAfter: 0.8, wait: null },
        { action: `Check the fees collected on the ${name} position after ${hold} days; if removing liquidity is unavailable or the quote exceeds the fee cap, defer the exit and recheck`, share: 0, flow: 'none', wait: afterHold },
        { action: `Remove the entire LP position in ${name}, swap the full redeemable balance back to the starting asset with at most 0.5% slippage, check the quote shown, and verify the proceeds received`, share: 0.8, flow: 'out', positionAfter: 0, wait: null },
      ];
    case 'yield':
      return [
        { action: `Identify the vault, host, curator, supported deposit asset and its token units, the spender shown by the official interface, fee structure, and redemption method for ${name} on ${chain} in its official documentation. Confirm eligibility, the minimum deposit, that the asset is available on ${chain}, and that the wallet holds enough native gas; deploy only if the exit terms are acceptable, otherwise stop`, share: 0, flow: 'none', wait: null },
        { action: `Approve spending of at most ${half} for the ${name} vault on ${chain}`, share: 0, flow: 'none', wait: null },
        { action: `Deposit a trial ${tenth} into the ${name} vault on ${chain} and check the receipt it issues`, share: 0.1, flow: 'in', positionAfter: 0.1, wait: null },
        { action: `Add a ${fourTenths} deposit to ${name} once the trial receipt is verified, bringing the total to ${half}`, share: 0.4, flow: 'in', positionAfter: 0.5, wait: 'wait until the trial receipt is verified' },
        { action: `Check the redeem value of the ${name} position after ${hold} days in its official interface; if redeeming is unavailable, queued, or the quote exceeds the fee cap, defer the exit and recheck`, share: 0, flow: 'none', wait: afterHold },
        { action: `Redeem all shares of the ${name} position (about ${half} at deposit value), check the quote shown, verify the proceeds received, then revoke the vault spending allowance`, share: 0.5, flow: 'out', positionAfter: 0, wait: null },
      ];
    case 'staking':
      return [
        { action: `Check the receipt token, risks, exit queue, supported stake asset and its token units, and the spender shown by the official interface for ${name} on ${chain} in its official documentation. Confirm eligibility, the minimum stake, and that the wallet holds enough native gas; deploy only if the exit terms are acceptable, otherwise stop`, share: 0, flow: 'none', wait: null },
        { action: `Approve spending only if the ${name} interface asks for it, and only for the amount needed to stake`, share: 0, flow: 'none', wait: null },
        { action: `Stake ${tenth} through ${name} on ${chain} and keep the receipt token it issues`, share: 0.1, flow: 'in', positionAfter: 0.1, wait: null },
        { action: `Add ${fourTenths} more stake to ${name} once the first receipt arrives, bringing the total to ${half}`, share: 0.4, flow: 'in', positionAfter: 0.5, wait: 'wait until the first receipt arrives' },
        { action: `Check the receipt token and exit route for ${name} after ${hold} days in its official interface; if unstaking is queued or the quote exceeds the fee cap, defer the exit and recheck`, share: 0, flow: 'none', wait: afterHold },
        { action: `Unstake or redeem all shares of the ${name} position (about ${half} at deposit value), check the quote shown, verify the proceeds received, and record the exit queue time shown in the interface`, share: 0.5, flow: 'out', positionAfter: 0, wait: null },
      ];
    case 'bridge':
      return [
        { action: `Verify the contracts, chain pair, supported asset and its token units for ${name} in its official documentation and interface. Confirm the asset is available on the source chain and that the wallet holds enough native gas on both sides; send only if the quoted route and fees are acceptable, otherwise stop`, share: 0, flow: 'none', wait: null },
        { action: `Check the quote and confirm gas is available on both sides before sending through ${name}`, share: 0, flow: 'none', wait: null },
        { action: `Send a trial ${tenth} through ${name} and wait for the receipt confirmation on the destination chain`, share: 0.1, flow: 'sent', positionAfter: 0.1, wait: 'wait until the trial transfer arrives' },
        { action: `Send an additional ${fourTenths} through ${name} once the trial transfer arrives, bringing the total to ${half}`, share: 0.4, flow: 'sent', positionAfter: 0.5, wait: null },
        { action: `Match the source and destination transactions for ${name}, including the actual fees recorded on both chains; if the return route is unavailable or its quote exceeds the fee cap, defer the return and recheck`, share: 0, flow: 'none', wait: null },
        { action: `Bridge all of the ${name} balance back (about ${half} at send value) through the verified route, check the quote shown, verify the amount received, and keep the receipts for both directions`, share: 0.5, flow: 'sent', positionAfter: 0, wait: null },
      ];
    case 'rwa':
      return [
        { action: `Check the jurisdiction, KYC requirements, minimum investment, redemption window, supported asset and its token units for ${name} in its official documentation. Confirm eligibility and that the wallet holds enough native gas; proceed only if the exit terms are acceptable, otherwise stop`, share: 0, flow: 'none', wait: null },
        { action: `Complete the ${name} eligibility check without sending any transaction`, share: 0, flow: 'none', wait: null },
        { action: `Subscribe a trial ${tenth} to ${name} if the minimum investment allows and eligibility is met`, share: 0.1, flow: 'in', positionAfter: 0.1, wait: null },
        { action: `Add a ${fourTenths} subscription to ${name} while still eligible, bringing the total to ${half}`, share: 0.4, flow: 'in', positionAfter: 0.5, wait: null },
        { action: `Check the receipt and settlement schedule for ${name} after ${hold} days in its official interface; if redemption is outside its window or the quote exceeds the fee cap, defer and recheck`, share: 0, flow: 'none', wait: afterHold },
        { action: `Request redemption of all shares of the ${name} position (about ${half} at subscription value) inside its official redemption window, check the quote shown, verify the proceeds received, and keep the request receipt`, share: 0.5, flow: 'out', positionAfter: 0, wait: null },
      ];
    default:
      return [
        { action: `Verify the identity, chain, mechanism, supported asset and its token units for ${name} on ${chain} in its official documentation. Confirm eligibility and that the wallet holds enough native gas; proceed only if the exit terms are acceptable, otherwise stop`, share: 0, flow: 'none', wait: null },
        { action: `Read the ${name} mechanism documentation and record the available actions and their conditions`, share: 0, flow: 'none', wait: null },
        { action: `Identify the available actions for ${name}, including their fees and exit conditions`, share: 0, flow: 'none', wait: null },
        { action: `Simulate the ${name} flow without funds if the interface offers a simulation`, share: 0, flow: 'none', wait: null },
        { action: `Record the fees, exit conditions, and observations for ${name} after ${hold} days; if exiting is unavailable or the quote exceeds the fee cap, defer and recheck`, share: 0, flow: 'none', wait: afterHold },
        { action: `Continue only if the ${name} flow is verified; otherwise flag this position for manual review and send no funds`, share: 0, flow: 'none', wait: null },
      ];
  }
}

/** Plafon biaya enam langkah, dalam dolar, sesuai urutan langkah. */
const STEP_FEE_CAPS = [0, 4, 4, 6, 0, 6];

/** Waktu aktif enam langkah, dalam menit, sesuai urutan langkah. */
const STEP_ACTIVE_MINUTES = [8, 5, 8, 10, 5, 10];

/**
 * One finished step as a string: action, directional capital label,
 * max fee, active time, and a wait clause when there is one. The em dash
 * separates the action from its metadata so the dashboard can split the
 * two reliably. Final length is kept between 20 and 600 characters: when
 * it runs over, it is cut cleanly at the last sentence boundary that
 * still fits.
 */
function renderStep(draft: StepDraft, capital: number, feeCap: number, minutes: number): string {
  const allocation = money(draft.share * capital);
  const label =
    draft.flow === 'in'
      ? 'Capital in'
      : draft.flow === 'out'
        ? 'Principal out'
        : draft.flow === 'loan'
          ? 'Loan received'
          : draft.flow === 'repay'
            ? 'Loan repaid'
            : draft.flow === 'sent'
              ? 'Amount sent'
              : 'Capital';
  let text = `${draft.action}. — ${label} ${allocation}; max fee $${feeCap}; active time ${minutes} min`;
  if (draft.wait !== null) text += `; ${draft.wait}`;
  text += '.';
  if (text.length > 600) {
    const cut = text.slice(0, 597);
    const lastSentence = cut.lastIndexOf('. ');
    text = lastSentence > 100 ? `${cut.slice(0, lastSentence + 1)}` : `${cut}...`;
  }
  if (text.length < 20) text += ' Recheck the position in the official interface.';
  return text;
}

/** Rencana farm lengkap satu protokol: modal, hold, dan enam langkah. */
export function farmPlan(p: SnapshotProtocol, age: number | null): FarmPlan {
  const capital = capitalFor(p, age);
  const hold = holdDaysFor(age);
  const group = farmGroupFor(p);
  const drafts = stepDrafts(p, group, capital, hold);
  const steps = drafts.map((draft, i) => {
    const minutes = group === 'rwa' && i === 0 ? 30 : STEP_ACTIVE_MINUTES[i]!;
    return renderStep(draft, capital, STEP_FEE_CAPS[i]!, minutes);
  });
  // Largest position the steps ever hold at once (trial + top-up add up,
  // the dex LP step builds one position up to its share, approve steps
  // hold nothing); the rest of the budget stays in the wallet as a
  // reserve. Max fees is the sum of the per-step fee caps.
  const deployedShare = Math.max(0, ...drafts.map((d) => d.positionAfter ?? 0));
  const deployed = Math.round(capital * deployedShare * 100) / 100;
  const maxFees = STEP_FEE_CAPS.reduce((a, b) => a + b, 0);
  return { capital, deployed_usd: deployed, max_fees_usd: maxFees, hold_days: hold, steps };
}

/** Enam langkah farm sebagai string, untuk baris board.json. */
export function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  return farmPlan(p, age).steps;
}

/** Apakah nilai ini objek biasa (bukan null, bukan array). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Satu protokol dari JSON mentah, ditolak bila bentuknya tidak sesuai sepuluh field. */
function parseProtocol(value: unknown, index: number): SnapshotProtocol {
  const where = `protocol ${index}`;
  if (!isRecord(value)) throw new SnapshotError(`snapshot ${where} is not an object`);
  const keys = Object.keys(value).sort();
  const expected = ['category', 'chains', 'change_7d', 'gecko_id', 'listed_at', 'mcap_usd', 'name', 'slug', 'symbol', 'tvl_usd'];
  if (keys.length !== expected.length || keys.some((k, i) => k !== expected[i])) {
    throw new SnapshotError(`snapshot ${where} does not carry exactly the ten expected fields`);
  }
  if (typeof value.slug !== 'string' || !SLUG_OK.test(value.slug)) {
    throw new SnapshotError(`snapshot ${where} has no valid slug`);
  }
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    throw new SnapshotError(`snapshot ${where} has no name`);
  }
  if (value.category !== null && typeof value.category !== 'string') {
    throw new SnapshotError(`snapshot ${where} has a category that is neither a string nor null`);
  }
  if (!Array.isArray(value.chains) || value.chains.some((c) => typeof c !== 'string' || c.trim().length === 0)) {
    throw new SnapshotError(`snapshot ${where} has no chains array of names`);
  }
  if (typeof value.tvl_usd !== 'number' || !Number.isSafeInteger(value.tvl_usd) || value.tvl_usd < 0) {
    throw new SnapshotError(`snapshot ${where} has no TVL in whole dollars`);
  }
  if (value.change_7d !== null && (typeof value.change_7d !== 'number' || !Number.isFinite(value.change_7d))) {
    throw new SnapshotError(`snapshot ${where} has a 7d change that is neither a number nor null`);
  }
  if (value.mcap_usd !== null && (typeof value.mcap_usd !== 'number' || !Number.isSafeInteger(value.mcap_usd))) {
    throw new SnapshotError(`snapshot ${where} has a market cap that is neither whole dollars nor null`);
  }
  if (value.listed_at !== null && (typeof value.listed_at !== 'string' || !isRealDate(value.listed_at))) {
    throw new SnapshotError(`snapshot ${where} has a listed_at that is neither a date nor null`);
  }
  if (value.gecko_id !== null && typeof value.gecko_id !== 'string') {
    throw new SnapshotError(`snapshot ${where} has a gecko_id that is neither a string nor null`);
  }
  if (value.symbol !== null && typeof value.symbol !== 'string') {
    throw new SnapshotError(`snapshot ${where} has a symbol that is neither a string nor null`);
  }
  return {
    slug: value.slug,
    name: value.name,
    category: value.category,
    chains: [...(value.chains as string[])],
    tvl_usd: value.tvl_usd,
    change_7d: value.change_7d,
    mcap_usd: value.mcap_usd,
    listed_at: value.listed_at,
    gecko_id: value.gecko_id,
    symbol: value.symbol,
  };
}

/**
 * Snapshot dari teks file, ditolak bila bentuknya bukan dokumen snapshot
 * yang sah: tanggal as_of nyata, floor positif, protokol unik dan lengkap,
 * dan setiap slug watchlist benar-benar ada di daftar protokol.
 */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (!isRecord(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  if (typeof raw.as_of !== 'string' || !isRealDate(raw.as_of)) {
    throw new SnapshotError('snapshot.json has no real as_of date');
  }
  if (typeof raw.source !== 'string' || raw.source.trim().length === 0) {
    throw new SnapshotError('snapshot.json has no source');
  }
  if (typeof raw.floor_usd !== 'number' || !Number.isSafeInteger(raw.floor_usd) || raw.floor_usd <= 0) {
    throw new SnapshotError('snapshot.json has no positive floor_usd in whole dollars');
  }
  if (!Array.isArray(raw.protocols) || raw.protocols.length === 0) {
    throw new SnapshotError('snapshot.json has no protocols array');
  }
  if (!Array.isArray(raw.watchlist) || raw.watchlist.some((s) => typeof s !== 'string' || s.length === 0)) {
    throw new SnapshotError('snapshot.json has no watchlist of slugs');
  }
  const protocols = raw.protocols.map((v, i) => parseProtocol(v, i));
  const seen = new Set<string>();
  for (const p of protocols) {
    if (seen.has(p.slug)) throw new SnapshotError(`snapshot.json repeats slug ${p.slug}`);
    seen.add(p.slug);
  }
  const watchlist = [...(raw.watchlist as string[])];
  if (new Set(watchlist).size !== watchlist.length) throw new SnapshotError('snapshot.json repeats a watchlist slug');
  for (const slug of watchlist) {
    if (!seen.has(slug)) throw new SnapshotError(`snapshot.json watchlist names ${slug}, which no protocol carries`);
  }
  return { as_of: raw.as_of, source: raw.source, floor_usd: raw.floor_usd, protocols, watchlist };
}

/** Urutan board: implied turun, TVL turun, slug naik. */
function compareScored(a: ScoredProtocol, b: ScoredProtocol): number {
  return (
    b.implied - a.implied ||
    b.protocol.tvl_usd - a.protocol.tvl_usd ||
    (a.protocol.slug < b.protocol.slug ? -1 : a.protocol.slug > b.protocol.slug ? 1 : 0)
  );
}

/** Satu baris board.json dari protokol yang sudah dinilai. */
function toBoardRow(scored: ScoredProtocol, rank: number): BoardRow {
  const p = scored.protocol;
  return {
    rank,
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: [...p.chains],
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd,
    listed_at: p.listed_at,
    gecko_id: p.gecko_id,
    symbol: p.symbol,
    token_status: 'pre-token',
    age_days: scored.age,
    implied_value_usd: scored.implied,
    model: {
      multiple: round4(scored.multiple),
      growth_pct: scored.growthPct,
      growth_multiplier: round4(scored.growthMult),
      maturity_multiplier: round4(scored.maturityMult),
      chain_multiplier: round4(scored.chainMult),
      age_days: scored.age,
    },
    farm_steps: farmSteps(p, scored.age),
  };
}

/** Satu baris ringkas data.js dari baris board dan rencana farm-nya. */
function toRadarRow(row: BoardRow, scored: ScoredProtocol, watchlisted: boolean): RadarRow {
  const plan = farmPlan(scored.protocol, scored.age);
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: [...row.chains],
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    watchlist: watchlisted,
    token_status: 'pre-token',
    factors: {
      multiple: round4(scored.multiple),
      growth_mult: round4(scored.growthMult),
      maturity_mult: round4(scored.maturityMult),
      chain_mult: round4(scored.chainMult),
      t_eff: Math.round(scored.tEff),
    },
    farm: plan,
  };
}

/**
 * Board berperingkat: seluruh watchlist ditambah 200 protokol pre-token
 * rankable di luar watchlist dengan implied tertinggi. Baris watchlist yang
 * bukan rankable tetap ikut karena cakupan watchlist adalah syarat gate;
 * snapshot yang sah membuat semua slug watchlist rankable.
 */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const stats = peerStats(snapshot);
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .map((p) => impliedFor(p, snapshot.as_of, stats))
    .sort(compareScored)
    .slice(0, EARLY_ROWS);
  for (const s of early) chosen.set(s.protocol.slug, s.protocol);
  const scored = [...chosen.values()]
    .map((p) => impliedFor(p, snapshot.as_of, stats))
    .sort(compareScored);
  return scored.map((s, i) => toBoardRow(s, i + 1));
}

/** Protokol bertoken teratas berdasarkan market cap, tanpa exchange. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX' && p.mcap_usd !== null)
    .sort(
      (a, b) =>
        (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) ||
        b.tvl_usd - a.tvl_usd ||
        (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
    )
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: [...p.chains],
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      change_7d: p.change_7d,
    }));
}

/** Board dan data dashboard dari satu snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const stats = peerStats(snapshot);
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const watchlisted = new Set(snapshot.watchlist);
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const rows: RadarRow[] = board.map((row) => {
    const scored = impliedFor(index.get(row.slug)!, snapshot.as_of, stats);
    return toRadarRow(row, scored, watchlisted.has(row.slug));
  });
  const early = rows.filter((r) => !r.watchlist).length;
  const evaluation = calibrationEvaluation(snapshot);
  Object.assign(evaluation, cexSensitivity(snapshot, board));
  const radar: RadarData = {
    schema_version: 1,
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    model: {
      ...RADAR_MODEL,
      global_median: round4(stats.globalMedian),
      global_multiple: round4(stats.globalMultiple),
      peer_count: stats.peerCount,
      evaluation,
    },
    peers: stats.peers,
    calibration_peers: calibrationPeers(snapshot),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows,
    live,
  };
  return { board, radar };
}

/**
 * Kenapa board ini tidak lolos gate, atau null bila lolos: cakupan watchlist,
 * slug unik yang ada di snapshot, rank 1..N tepat sekali, implied tak naik
 * mengikuti rank, tidak semua implied sama, dan tiap langkah farm 20-600
 * karakter setelah trim.
 */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) {
    return `the board has ${board.length} rows, outside the gate's 100 to 4000`;
  }
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  for (const r of board) {
    if (!known.has(r.slug)) return `row ${r.slug} is not a protocol in the snapshot`;
    if (seen.has(r.slug)) return `slug ${r.slug} appears twice on the board`;
    seen.add(r.slug);
    if (typeof r.slug !== 'string' || /\s/.test(r.slug)) return `slug ${r.slug} carries whitespace`;
    if (typeof r.name !== 'string' || r.name.trim().length === 0) return `row ${r.slug} has no name`;
    if (r.token_status !== 'pre-token') return `row ${r.slug} is not marked pre-token`;
  }
  const missing = snapshot.watchlist.filter((s) => !seen.has(s));
  if (missing.length > 0) {
    return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  }
  const outside = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  if (outside < 60) return `the board carries only ${outside} rows outside the watchlist, fewer than 60`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  }
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) {
      return `row ${i + 1} outranks row ${i} on implied value`;
    }
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) {
      return `${r.slug} has ${r.farm_steps.length} farm steps`;
    }
    for (const s of r.farm_steps) {
      const trimmed = s.trim();
      if (trimmed.length !== s.length) return `${r.slug} has a farm step with leading or trailing whitespace`;
      if (trimmed.length < 20 || trimmed.length > 600) {
        return `${r.slug} has a farm step of ${trimmed.length} characters`;
      }
    }
  }
  return null;
}

/** data.js: seluruh dataset dashboard sebagai satu script, tanpa fetch dan tanpa network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
