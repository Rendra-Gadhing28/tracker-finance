# DESIGN.md — Buku Kas Modern

Design system untuk web tracker keuangan pribadi (SvelteKit, mobile-first, PWA).
Mode terang dan gelap sama-sama kelas satu. Mockup acuan ada di artifact "Buku Kas Modern".

---

## 1. Prinsip

1. **Satu layar, satu pertanyaan.** Beranda menjawab "Aman nggak uangku bulan ini?". Detail dipindah ke layar lain.
2. **Kurangi isi, jangan kecilkan teks.** Kalau layar terasa sempit, buang elemen. Ukuran teks tidak diturunkan.
3. **List dan garis, bukan card.** Pemisah berupa border 1px. Card hanya untuk bottom sheet dan input.
4. **Warna punya arti.** Hijau = masuk/aman, kuning = hampir habis, terakota = keluar/lewat. Bukan dekorasi.
5. **Status tidak hanya lewat warna.** Selalu ada teks ("Aman", "Lewat Rp 90 rb") atau ikon pendamping.
6. **Angka adalah konten utama.** Tabular, sejajar kanan, tidak pernah terpotong.
7. **Tanpa efek "AI generik":** tanpa gradient, glassmorphism, glow, shadow tebal, atau emoji sebagai ikon.

---

## 2. Design tokens

### 2.1 Warna

Semua warna dipakai lewat CSS variable semantik. Jangan pakai hex langsung di komponen.

| Token | Gelap | Terang | Dipakai untuk |
|---|---|---|---|
| `--bg` | `#171614` | `#F6F3EC` | Latar halaman |
| `--bg-raised` | `#201E1B` | `#FBF9F4` | Bottom sheet, input, popover |
| `--fg` | `#F0ECE3` | `#1C1B18` | Teks utama |
| `--fg-muted` | `#A8A296` | `#5F5A50` | Caption, label, tanggal |
| `--line` | `#2E2B27` | `#DDD7C8` | Pemisah, border |
| `--track` | `#2E2B27` | `#E3DDCE` | Latar progress bar dan ring |
| `--accent` | `#8CCBA8` | `#1F5C46` | Aksi utama, aktif, pemasukan, status aman |
| `--on-accent` | `#10231A` | `#FFFFFF` | Teks di atas `--accent` |
| `--expense` | `#E8957A` | `#A8452A` | Pengeluaran, status lewat anggaran |
| `--warn` | `#E3B866` | `#8A5F0A` | Status hampir habis |
| `--overlay` | `rgb(0 0 0 / .55)` | `rgb(28 27 24 / .35)` | Latar di belakang bottom sheet |

Warna chart (dibedakan lewat terang-gelap, bukan hue saja):

| Token | Gelap | Terang |
|---|---|---|
| `--chart-1` | `#8CCBA8` | `#1F5C46` |
| `--chart-2` | `#E8957A` | `#A8452A` |
| `--chart-3` | `#E3B866` | `#B07F12` |
| `--chart-4` | `#9DB4D8` | `#3F5F8F` |
| `--chart-5` | `#7A7468` | `#8C867A` |

Catatan kontras:
- Teks (`--fg`, `--fg-muted`, `--accent`, `--expense`, `--warn`) di atas `--bg` harus ≥ 4.5:1 di kedua mode.
- Elemen grafis (bar, donut, ring) minimal 3:1 terhadap `--bg`.
- Mode gelap memakai charcoal hangat, bukan hitam pekat atau navy.

### 2.2 Tipografi

| Peran | Font | Fallback |
|---|---|---|
| Display (angka hero, judul halaman) | **Fraunces** 400 | `Georgia, serif` |
| UI dan body | **DM Sans** 400/500/600 | `system-ui, sans-serif` |

| Token | Ukuran | Weight | Pemakaian |
|---|---|---|---|
| `--fs-hero` | `clamp(40px, 11vw, 48px)` | 400 (Fraunces) | Satu angka utama per layar |
| `--fs-title` | 32px | 400 (Fraunces) | Judul halaman |
| `--fs-h` | 18px | 600 | Judul bagian |
| `--fs-body` | 16px | 400/500 | Nama transaksi, nominal, isi |
| `--fs-sm` | 14px | 400/500 | Info sekunder, tautan kecil |
| `--fs-cap` | 13px | 400 | Kategori, tanggal, label chart (**batas terkecil**) |

Aturan:
- Maksimal 3–4 ukuran berbeda per layar.
- Tidak ada teks di bawah 13px.
- Semua nominal: `font-variant-numeric: tabular-nums`.
- Line-height: 1.1 untuk display, 1.4 untuk body.

### 2.3 Spacing, bentuk, dan ukuran

| Token | Nilai |
|---|---|
| Skala spacing (grid 4px) | 4, 8, 12, 16, 20, 24, 32, 48 |
| `--gutter` (padding halaman) | 24px mobile, 32px tablet ke atas |
| `--r` (radius semua kontrol) | 10px |
| `--r-bar` (radius bar chart) | 4px |
| Border | 1px solid `--line`, tidak ada shadow |
| Tap target minimal | 44 × 44px |
| Tinggi baris list | min 64px |
| Bottom nav | 56px + `env(safe-area-inset-bottom)` |
| Jarak antar bagian | 32px |

### 2.4 Motion

- Durasi 150–250ms, easing `cubic-bezier(.2, .7, .2, 1)`.
- Bottom sheet: slide naik + fade overlay.
- Bar chart, ring, dan donut: animasi isi 400ms sekali saat muncul.
- Hormati `prefers-reduced-motion: reduce` (matikan semua animasi non-esensial).

### 2.5 `src/app.css`

```css
:root {
  color-scheme: light dark;

  /* Terang (default) */
  --bg: #F6F3EC;  --bg-raised: #FBF9F4;
  --fg: #1C1B18;  --fg-muted: #5F5A50;
  --line: #DDD7C8; --track: #E3DDCE;
  --accent: #1F5C46; --on-accent: #FFFFFF;
  --expense: #A8452A; --warn: #8A5F0A;
  --overlay: rgb(28 27 24 / .35);
  --chart-1: #1F5C46; --chart-2: #A8452A; --chart-3: #B07F12;
  --chart-4: #3F5F8F; --chart-5: #8C867A;

  --font-display: 'Fraunces', Georgia, serif;
  --font-ui: 'DM Sans', system-ui, sans-serif;
  --fs-hero: clamp(40px, 11vw, 48px);
  --fs-title: 32px; --fs-h: 18px; --fs-body: 16px; --fs-sm: 14px; --fs-cap: 13px;
  --r: 10px; --r-bar: 4px; --gutter: 24px;
  --ease: cubic-bezier(.2, .7, .2, 1);
}

/* Gelap: ikut sistem, kecuali pengguna memilih terang secara manual */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --bg: #171614;  --bg-raised: #201E1B;
    --fg: #F0ECE3;  --fg-muted: #A8A296;
    --line: #2E2B27; --track: #2E2B27;
    --accent: #8CCBA8; --on-accent: #10231A;
    --expense: #E8957A; --warn: #E3B866;
    --overlay: rgb(0 0 0 / .55);
    --chart-1: #8CCBA8; --chart-2: #E8957A; --chart-3: #E3B866;
    --chart-4: #9DB4D8; --chart-5: #7A7468;
  }
}

/* Gelap: dipilih manual */
:root[data-theme='dark'] {
  --bg: #171614;  --bg-raised: #201E1B;
  --fg: #F0ECE3;  --fg-muted: #A8A296;
  --line: #2E2B27; --track: #2E2B27;
  --accent: #8CCBA8; --on-accent: #10231A;
  --expense: #E8957A; --warn: #E3B866;
  --overlay: rgb(0 0 0 / .55);
  --chart-1: #8CCBA8; --chart-2: #E8957A; --chart-3: #E3B866;
  --chart-4: #9DB4D8; --chart-5: #7A7468;
}

html { background: var(--bg); color: var(--fg); font: 400 var(--fs-body)/1.4 var(--font-ui); }
body { margin: 0; }
.num { font-variant-numeric: tabular-nums; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

---

## 3. Layout

### 3.1 Breakpoint

| Lebar | Layout |
|---|---|
| < 640px (HP) | Satu kolom, bottom nav 4 item, tombol Tambah mengambang |
| 640–1023px | Satu kolom, konten maks 720px di tengah, bottom nav tetap |
| ≥ 1024px | Sidebar ramping 240px di kiri, konten maks 720px, panel detail 360px di kanan bila perlu |

Desain dan uji di **360px** dulu. Jangan menambah kolom grid di desktop; ruang kosong itu disengaja.

### 3.2 Pola halaman

- Padding atas halaman 56px di HP (ruang untuk status bar PWA), `env(safe-area-inset-*)` untuk sisi bawah.
- Satu angka hero per halaman, ukuran `--fs-hero`.
- Urutan konten: header → hero → ringkasan → satu chart → daftar.
- Maksimal **satu chart per bagian**, label langsung di grafik, tanpa legend terpisah (kecuali donut, legenda diletakkan di samping).

### 3.3 Navigasi

Bottom nav 4 item: **Beranda, Transaksi, Anggaran, Insight**.
- Item aktif: warna `--accent`. Tidak aktif: `--fg-muted`.
- Tombol **Tambah** mengambang di kanan bawah, 52px tinggi, 104px dari bawah (di atas nav).

---

## 4. Komponen

### 4.1 TransactionRow
Dua baris di kiri (nama 16/500, caption 13 `--fg-muted`: "Kategori · waktu"), nominal rata kanan 16/500 tabular.
- Pengeluaran: `--expense`, awalan "−". Pemasukan: `--accent`, awalan "+".
- Pemisah `border-bottom: 1px solid var(--line)`, tinggi min 64px.
- Seluruh baris bisa ditekan (membuka detail di bottom sheet).

### 4.2 DayGroupHeader
Tanggal ("Hari ini · Jum, 23 Okt") di kiri, total harian di kanan, 14px `--fg-muted`, tabular. Padding `20px 0 8px`.

### 4.3 StatStrip
Tiga kolom sejajar dibatasi border atas/bawah dan garis vertikal tipis. Label 13px muted, nilai 17/600. Nilai pakai format ringkas ("+9,5 jt"). Tidak dibungkus card.

### 4.4 ProgressBar
Tinggi 6px, radius 3px, track `--track`. Fill mengikuti nilai status (lihat 5). Nilai > 100% tetap digambar penuh, bedanya di warna dan teks.

### 4.5 ProgressRing
Diameter 88px, stroke 8px, ujung `round`, mulai dari jam 12. Angka persen di tengah (20/600). Hanya satu ring per layar (di Beranda).

### 4.6 BudgetRow
Nama (16/500) + "terpakai / batas" (14 muted, tabular) → ProgressBar → teks status 13px. Padding vertikal 14px, pemisah border bawah.

### 4.7 StatusBadge
Teks 14/500 dengan titik "●" di depan, border 1px `--line`, radius 10px, padding `6px 12px`. Warna teks sesuai status.

### 4.8 Chip (filter)
Tinggi 44px, padding horizontal 16px, border `--line`, radius 10px, teks 15px. Aktif: latar `--fg`, teks `--bg`. Baris chip boleh scroll horizontal dan meluber sampai tepi layar.

### 4.9 SegmentedControl
Susunan Chip yang lebar sama (`flex: 1`). Satu pilihan aktif (periode: Bulan, Minggu, Tahun).

### 4.10 Search
Tinggi 48px, border `--line`, radius 10px, ikon garis 20px di kiri, placeholder `--fg-muted` 16px.

### 4.11 FAB "Tambah"
Tinggi 52px, latar `--accent`, teks `--on-accent` 16/600, ikon plus 20px, radius 10px. Tanpa shadow.

### 4.12 BottomSheet
Latar `--bg-raised`, radius atas 10px, border atas 1px `--line`, handle 36×4px, overlay `--overlay`. Dipakai untuk detail transaksi, filter, dan input transaksi. Bisa ditutup dengan tarik ke bawah, tombol Tutup, atau tekan overlay.

### 4.13 Input transaksi (maks 3 ketukan)
1. **Nominal**: numpad besar kustom (tombol ≥ 56px), nominal tampil 44px Fraunces.
2. **Kategori**: chip, 5 kategori teratas lebih dulu, sisanya lewat "Lainnya".
3. **Simpan**: tombol penuh lebar `--accent`.
Tanggal default hari ini, catatan opsional di bawah (tidak wajib).

### 4.14 Chart

| Chart | Aturan |
|---|---|
| **Bar 7 hari** | Bar 30px, radius 4px. Hari ini `--accent`, lainnya `--fg-muted` opacity .4. Garis rata-rata putus-putus. Label nilai hanya di hari ini dan titik tertinggi. |
| **Line tren** | Garis 2.5px `--accent`, titik r=5. Periode berjalan: segmen putus-putus dan titik berongga. Label nilai di atas titik. |
| **Donut** | Stroke 22px, jeda 2px antar segmen, maksimal 5 segmen (sisanya digabung "Lainnya"). Total di tengah. Legenda di samping: kotak warna + nama + persen. |

Aturan umum chart: satu chart per bagian, label langsung, tanpa gridline kecuali baseline, ada `role="img"` dan `aria-label` yang menjelaskan isinya, dan data yang sama tersedia dalam bentuk teks/list di dekatnya.

### 4.15 Keadaan khusus
- **Loading**: baris skeleton dengan `--track`, tanpa shimmer berlebihan.
- **Kosong**: satu kalimat pendek + satu tombol aksi ("Belum ada transaksi bulan ini. Catat yang pertama").
- **Error**: pesan jelas di tempat konten, tombol "Coba lagi". Tidak memakai alert merah penuh.

---

## 5. Logika status anggaran

Rasio = terpakai ÷ batas.

| Rasio | Status | Warna | Teks contoh |
|---|---|---|---|
| < 80% | Aman | `--accent` | "Aman" |
| 80–100% | Hampir habis | `--warn` | "Hampir habis · sisa Rp 300 rb" |
| > 100% | Lewat | `--expense` | "Lewat Rp 90 rb" |

Status keseluruhan di Beranda mengikuti total anggaran bulan ini, bukan kategori terburuk.

---

## 6. Format angka dan teks

- Mata uang penuh: `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })` → "Rp 2.410.000".
- Format ringkas ("2,4 jt", "92 rb") hanya untuk nilai sekunder (StatStrip, label chart). Nominal transaksi dan hero **selalu penuh**.
- Tanda minus memakai "−" (U+2212), bukan hyphen.
- Bahasa: Indonesia kasual, singkat. Tanggal relatif ("Hari ini", "Kemarin") sebelum tanggal lengkap.
- Hindari tanda seru, emoji, dan kalimat motivasi.

---

## 7. Implementasi Svelte

### 7.1 Struktur folder

```
src/
  app.html            # skrip inline tema (cegah flash)
  app.css             # token (bagian 2.5)
  lib/
    format.ts         # rupiah(), compact()
    status.ts         # budgetStatus()
    theme.ts          # toggle tema
    components/
      Amount.svelte
      TransactionRow.svelte
      ProgressBar.svelte
      ProgressRing.svelte
      BudgetRow.svelte
      StatStrip.svelte
      Chip.svelte
      BottomSheet.svelte
      BottomNav.svelte
      charts/
        BarChart.svelte
        LineChart.svelte
        Donut.svelte
    db/               # Dexie (IndexedDB) atau klien Supabase
  routes/
    +layout.svelte    # shell: bottom nav / sidebar
    +page.svelte      # Beranda
    transaksi/
    anggaran/
    insight/
```

### 7.2 `lib/format.ts`

```ts
const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0
});

export const rupiah = (n: number) => idr.format(n).replace(/\u00a0/g, ' ');

export function compact(n: number) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + ' jt';
  if (a >= 1_000) return Math.round(n / 1_000) + ' rb';
  return String(n);
}
```

### 7.3 `lib/status.ts`

```ts
export type Status = 'aman' | 'hampir' | 'lewat';

export function budgetStatus(spent: number, limit: number) {
  const ratio = limit > 0 ? spent / limit : 0;
  const status: Status = ratio > 1 ? 'lewat' : ratio >= 0.8 ? 'hampir' : 'aman';
  const color = { aman: 'var(--accent)', hampir: 'var(--warn)', lewat: 'var(--expense)' }[status];
  return { ratio, status, color };
}
```

### 7.4 `Amount.svelte`

```svelte
<script lang="ts">
  import { rupiah, compact } from '$lib/format';
  let { value, short = false, signed = true }: { value: number; short?: boolean; signed?: boolean } = $props();
  const text = $derived(short ? 'Rp ' + compact(Math.abs(value)) : rupiah(Math.abs(value)));
  const sign = $derived(!signed ? '' : value < 0 ? '−' : '+');
</script>

<span class="amt num" class:out={value < 0} class:in={value > 0}>{sign}{text}</span>

<style>
  .amt { font-weight: 500; font-variant-numeric: tabular-nums; }
  .out { color: var(--expense); }
  .in { color: var(--accent); }
</style>
```

### 7.5 `ProgressBar.svelte`

```svelte
<script lang="ts">
  let { value, color = 'var(--accent)' }: { value: number; color?: string } = $props();
  const pct = $derived(Math.min(Math.max(value, 0), 1) * 100);
</script>

<div class="track" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin="0" aria-valuemax="100">
  <div class="fill" style:width="{pct}%" style:background={color}></div>
</div>

<style>
  .track { height: 6px; border-radius: 3px; background: var(--track); }
  .fill { height: 100%; border-radius: 3px; transition: width 400ms var(--ease); }
</style>
```

### 7.6 `ProgressRing.svelte`

```svelte
<script lang="ts">
  let { value, size = 88 }: { value: number; size?: number } = $props();
  const r = 36, c = 2 * Math.PI * r;
  const dash = $derived(c * Math.min(Math.max(value, 0), 1));
</script>

<svg width={size} height={size} viewBox="0 0 88 88" role="img" aria-label="{Math.round(value * 100)}% anggaran terpakai">
  <circle cx="44" cy="44" r={r} fill="none" stroke="var(--track)" stroke-width="8" />
  <circle cx="44" cy="44" r={r} fill="none" stroke="var(--accent)" stroke-width="8"
    stroke-linecap="round" stroke-dasharray="{dash} {c}" transform="rotate(-90 44 44)"
    style="transition: stroke-dasharray 400ms var(--ease)" />
  <text x="44" y="50" text-anchor="middle" font-size="20" font-weight="600" fill="var(--fg)">{Math.round(value * 100)}%</text>
</svg>
```

### 7.7 Tema tanpa flash (`app.html` + `lib/theme.ts`)

```html
<!-- di <head> app.html, sebelum %sveltekit.head% -->
<script>
  try {
    const t = localStorage.getItem('theme'); // 'light' | 'dark' | null (ikut sistem)
    if (t) document.documentElement.dataset.theme = t;
  } catch {}
</script>
```

```ts
// lib/theme.ts
export function setTheme(t: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  if (t === 'system') { delete root.dataset.theme; localStorage.removeItem('theme'); }
  else { root.dataset.theme = t; localStorage.setItem('theme', t); }
}
```

Sediakan toggle tiga pilihan (Sistem, Terang, Gelap) di pengaturan, tidak perlu di header tiap halaman.

### 7.8 Library yang disarankan

| Kebutuhan | Pilihan |
|---|---|
| Framework | SvelteKit + `adapter-static` atau `adapter-vercel` |
| Styling | CSS variables di atas (Tailwind v4 boleh, tapi petakan token ke `@theme`) |
| Komponen dasar | `bits-ui` (headless), restyle penuh |
| Chart | SVG manual + `d3-scale` / `d3-shape`, atau LayerChart |
| Ikon | `lucide-svelte` (stroke 1.75) |
| Data lokal | Dexie (IndexedDB), opsional sinkron ke Supabase |
| PWA | `@vite-pwa/sveltekit` |
| Font | `@fontsource-variable/fraunces` dan `@fontsource-variable/dm-sans` (self-host) |

---

## 8. Aksesibilitas

- Tap target ≥ 44px; jarak antar target ≥ 8px.
- Gunakan elemen asli: `<button>`, `<a href>`, `<input>` + `<label>`. Jangan `onclick` pada `div`.
- Tombol ikon wajib `aria-label`; ikon dekoratif `aria-hidden="true"`.
- Fokus terlihat: `outline: 2px solid var(--accent); outline-offset: 2px`.
- Status tidak hanya lewat warna (selalu ada teks).
- Chart punya `role="img"` + `aria-label`, dan angka pentingnya tersedia sebagai teks.
- Dukung zoom teks sistem hingga 200% tanpa elemen terpotong (pakai `rem`/`flex`, hindari tinggi tetap pada teks).

---

## 9. Do dan Don't

| Do | Don't |
|---|---|
| Satu angka hero per layar | 6–8 statistik sekaligus |
| List dengan garis tipis | Card bersusun dengan shadow |
| Satu chart per bagian, label langsung | Donut 8 warna dengan legend jauh |
| Warna redup bermakna (hijau, kuning, terakota) | Hijau/merah neon |
| Radius 10px di semua tempat | Campur radius 4/12/24px |
| Teks ≥ 13px, body 16px | Mengecilkan teks agar muat |
| Detail lewat bottom sheet | Semua info tampil di awal |
| Fraunces untuk angka hero | Satu font sans untuk semuanya |

---

## 10. Checklist sebelum rilis layar baru

- [ ] Hanya satu pertanyaan yang dijawab layar ini.
- [ ] Tidak ada teks < 13px; body 16px.
- [ ] Dicek di 360px, 390px, dan desktop.
- [ ] Dicek di mode terang dan gelap (kontras ≥ 4.5:1 untuk teks).
- [ ] Semua nominal tabular dan tidak terpotong.
- [ ] Status punya teks pendamping, bukan hanya warna.
- [ ] Loading, kosong, dan error sudah ada.
- [ ] Tap target ≥ 44px dan bisa dioperasikan dengan keyboard.
- [ ] `prefers-reduced-motion` dihormati.
