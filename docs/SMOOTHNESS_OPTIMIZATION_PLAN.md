# Rencana optimasi smoothness SDK

Disiapkan 12 Oktober 2026 (Asia/Jakarta), implementasi dimulai 13 Oktober. Status: **modul O0–O4 tersedia; O5 qualification berjalan. Interpolasi gagal alignment gate; prediksi media-aware tersedia sebagai kandidat terpisah. Default tetap direct; acceptance live/device belum ditutup.** Hasil dan kegagalan dicatat di log M7 `IMPLEMENTATION_PLAN.md`.

## 1. Tujuan dan batas pekerjaan

Membuat gerakan kacamata lebih halus, responsif, dan stabil ketika kepala atau tangan bergerak. Fitting, occlusion, kontinuitas kamera, dan lifecycle harus tetap benar.

- Produk tetap SDK JavaScript/TypeScript browser tanpa ketergantungan React. Vanilla/PWA menjadi contoh melalui API publik.
- Kamera, tracking, fitting, animasi dan rendering tetap lokal. Tidak menambah backend inferensi, upload, telemetry, atau penyimpanan frame/landmark/pose/snapshot.
- Pertahankan MediaPipe Face Landmarker dan Hand Landmarker opsional dalam worker yang ada, Three.js, serta GLB. Tidak mengganti tracker atau menambah library pada tahap ini.
- Fokus tahap ini adalah performa dan kontinuitas gerakan. Segmentasi rambut/telinga, kalibrasi fisik, refraksi video, physics/collision dan SKU retail merupakan pekerjaan terpisah.
- Kamera hanya mulai melalui `start()` eksplisit, `audio: false`; stop/failure/page hide/dispose membersihkan media, worker, timer dan buffer.
- Tidak publish ke npm. Implementasi diotorisasi pengguna dan sudah dimulai; promosi default mengikuti acceptance.

## 2. Baseline yang diketahui

| Bagian | Implementasi saat ini | Implikasi untuk optimasi |
|---|---|---|
| Kamera dan input | Kamera meminta ideal 30 FPS; input tracking dinormalkan dengan lebar maksimum 640, aspect ratio dipertahankan | FPS kamera aktual harus diukur; resolusi preview berbeda dari resolusi inference |
| Tracking | Satu bitmap dalam pemrosesan; wajah dan tangan berbagi worker; hasil wajah dikirim sebelum tangan, completion setelah keduanya | Inferensi tangan tetap dapat menunda pemrosesan wajah berikutnya |
| Smoothing wajah | Filter adaptif dengan cutoff posisi/rotasi terpisah; reset saat kehilangan wajah atau diskontinuitas | Sudah ada filtering; jangan menumpuk filter tanpa mengukur tambahan lag |
| Smoothing tangan | Lerp/slerp dengan bobot tetap per hasil | Respons berubah saat frekuensi hasil tangan berubah |
| Rendering | Loop `requestAnimationFrame`, tetapi transform diubah saat hasil tracking tiba dan draw dilewati ketika tidak dirty | Jadwal rAF belum menghasilkan gerakan interpolasi di antara hasil tracking |
| Occlusion | Face mesh, volume kepala/telinga dan GLB memakai koreksi pose yang sama; mask tangan saat grip | Semua layer harus tetap koheren ketika pose rendering diubah |
| Recovery | Worker dengan hash, protocol version 3, watchdog capture/inference, pump cadangan dan fallback CPU | Regresi satu frame lalu berhenti merupakan acceptance blocker |

Bukti baseline yang sudah tercatat: build/typecheck dan 94 tes lulus pada iterasi sebelumnya; actual-worker blank stream menghasilkan 203 hasil/completion; recovery CPU terkontrol menghasilkan 161 hasil/completion. Kamera pengguna mencapai tracking berkelanjutan dengan tangan nonaktif/aktif, reconnect manual dan stop. Ini menerima perbaikan kontinuitas, **belum mengukur smoothness, lag visual, akurasi grip, FPS kamera, atau performa mobile**.

Referensi: `../IMPLEMENTATION_PLAN.md`, `evidence/tracking-continuity-regression.json`, `evidence/tracking-refinement.json`, dan `FINAL_DEVICE_ACCEPTANCE.md`.

## 3. Keputusan teknis untuk implementasi berikutnya

1. **Pisahkan ingestion dan presentation.** Hasil tracker memperbarui target pose, sementara renderer memilih pose presentasi pada waktu yang sesuai. Mulai dengan interpolasi; prediksi singkat merupakan eksperimen tersendiri yang awalnya nonaktif.
2. **Gunakan clock yang jelas.** Catat capture timestamp, identitas frame/session dan pasangan waktu media/presentasi video bila tersedia. Durasi inferensi dihitung di worker dengan clock worker sendiri; jangan langsung mengurangkan `performance.now()` dari konteks berbeda. FPS inference, draw, rAF dan kamera dilaporkan terpisah.
3. **Selaraskan overlay dengan video.** Kamera 30 FPS tidak berubah menjadi 60 FPS karena overlay dirender 60 Hz. Jangan membuat kacamata terus bergerak di atas gambar kamera yang masih menampilkan frame sebelumnya. Tidak menambah buffer video sebagai default; periksa alignment pada timeline presentasi yang sebenarnya.
4. **Buffer temporal kecil dan sementara.** Maksimum tiga sample pose beserta geometri/transform yang diperlukan, tanpa histori tak terbatas. Bersihkan pada stop/dispose, pergantian session, recovery, asset swap dan timestamp tidak valid. Data lama tidak boleh masuk ke session baru.
5. **Satu transform presentasi yang koheren.** GLB, face/head/ear masks, mount targets, hand masks dan contact/grip harus memakai sample waktu yang kompatibel. Gunakan shortest-arc quaternion untuk rotasi. Hindari filtering mask atau transform aset secara independen.
6. **Pertahankan backpressure.** Tetap satu bitmap bersama dalam worker. Jangan membuka frame berikutnya hanya setelah hasil wajah, karena inferensi tangan masih dapat memiliki bitmap tersebut. Tangan opsional mengikuti anggaran waktu wajah.
7. **Ubah perilaku bertahap.** Tiap kandidat punya baseline pembanding dan jalur rollback. Pertahankan API publik saat ini; opsi baru hanya bila diperlukan dan setelah kontraknya dicatat. Kontrol A/B berada di harness pengembangan, tanpa framework atau telemetry di core.
8. **Jangan menyamarkan kehilangan tracking.** Prediction/grace tidak menggantikan deteksi. Baseline saat ini tetap: explicit no-face/invisible menyembunyikan mount, silence expiry 750 ms, hasil lebih tua dari 1.000 ms ditolak, hand-loss 450 ms membatalkan grip. Perubahan batas tersebut memerlukan acceptance tersendiri; stop/failure selalu membersihkan segera.

## 4. Milestone dan urutan kerja

### O0 — Pengukuran baseline dan harness yang representatif

**Dependensi:** tidak ada. **Prioritas:** pertama. **Status:** instrumentasi/harness dan 12 run native sintetis tersedia; controlled live/cold-warm acceptance terbuka.

Pekerjaan:

- Pisahkan biaya capture/draw ke canvas, pembuatan bitmap, face inference, hand inference, fitting/filter, CPU render submission dan waktu capture-ke-submission.
- Perluas diagnostik internal dan, bila diperlukan, callback `TrackingHealth` dengan agregat durasi/count yang kecil. Tidak mengekspos landmark atau pose baru melalui diagnostik.
- Bentuk agregat p50/p95 dan rate dalam window pendek, reset per session. Tambahkan label GPU/CPU, resolusi input, DPR, tangan aktif, aset dan refresh layar.
- Bekukan baseline dengan hash source/build/worker serta konfigurasi benchmark. Jalankan baseline dan kandidat bergantian pada perangkat/kondisi yang sama.
- Tambahkan fixture deterministik: diam dengan noise, gerakan lambat/cepat, berhenti mendadak, roll, turn+pitch, perubahan jarak, irregular cadence, dropped/out-of-order samples, serta grip/release.
- Pakai built public SDK dan worker URL yang dimuat SDK untuk continuity/recovery. Blank MediaPipe menguji runtime/IPC; fixture pose menguji matematika/rendering; kamera nyata menguji pengenalan dan pengalaman penggunaan.

Acceptance:

- Setiap angka memiliki definisi, unit, asal clock dan scope. CPU submission tidak disebut waktu GPU atau latency fisik end-to-end.
- Baseline desktop face-only dan hand-enabled memiliki minimal tiga run 60 detik; pisahkan cold start/warm start. Mobile belum tersedia tetap berstatus belum diuji.
- Known latency/drop fixtures menghasilkan agregat yang benar; tidak ada antrean bitmap bertambah atau ketidakcocokan SDK/worker.
- Artefak live hanya versi perangkat/browser, konfigurasi, timing/count nonbiometrik dan catatan pass/fail. Jitter/pose/ground truth numerik yang disimpan berasal dari fixture sintetis saja. Heap/trace dengan potensi isi frame atau koordinat hanya boleh memakai input sintetis.

Output: definisi metrik, baseline agregat, konfigurasi fixture dan harness public-API yang dapat diulang.

### O1 — Timeline rendering dan pose presentation

**Dependensi:** O0. **Status:** implementasi dan tes sintetis/GPU tersedia; default promotion belum diterima.

Pekerjaan:

- Pisahkan solver/filter saat sample datang dari pengaplikasian transform saat draw. Renderer menyimpan target tanpa langsung melompat ke setiap sample baru.
- Buat buffer sample kecil, mapping capture/media/presentation time, serta reset untuk recovery, resize, mirror/crop, timestamp reversal dan asset replacement.
- Interpolasi posisi, shortest-arc rotasi dan parameter mount yang relevan. Pertahankan ukuran fisik model dan perspektif jarak; hindari interpolasi Euler atau scale yang mengubah kalibrasi.
- Rekonstruksi face/head/ear masks dari sample referensi dan koreksi rigid yang sesuai, lalu gunakan transform yang sama pada GLB. Hand mask dan grab context mengikuti transform presentasi yang benar.
- Draw hanya selama transisi bergerak atau state berubah. Saat pose stabil, kembali melewati duplicate draw. Pose expiry tetap berfungsi saat tidak ada hasil baru.
- Keputusan 13 Oktober: interpolasi menghaluskan step namun gagal mengurangi error terhadap truth pada clock sama. Evaluasi prediksi sebagai **kandidat terpisah** maksimum 30 ms dengan capture-to-displayed-media mapping, tanpa mempromosikan interpolasi. Matikan ketika mapping tidak tersedia, sample tua/tidak valid, low motion, observed stop/reversal, teleport, pergantian owner atau tracking hilang. Semua eksperimen tetap nonaktif secara default sebelum A/B live lulus.

Acceptance:

- Timeline sintetis pada tracking 15/20/30 Hz dan rendering 30/60/90 Hz mengikuti urutan waktu dengan benar, termasuk sample gap/reordering.
- Pada fixture bergerak 20/30 Hz → render 60 Hz, target awal p95 error presentasi terhadap ground truth turun minimal 25% dibanding baseline, dengan perbandingan pada timestamp yang sama.
- Tambahan phase lag sintetis maksimum satu interval tracking dan maksimum 50 ms; noise RMS saat diam tidak lebih buruk dari baseline. Target ini tidak boleh dicapai dengan menahan video lebih lama.
- Mask/asset tidak bergeser terhadap satu sama lain; mirror/crop, jarak, pitch ±80°, profile ±84° dan hook/front-temple GPU regressions tetap lulus.
- Hand acquisition memakai contact yang kompatibel dengan pose yang dirender, tanpa lompatan pada perubahan owner; no-face/stop/recovery tidak meninggalkan model beku.

Output: sampler temporal, clock mapping, regression temporal dan A/B renderer. Prediction tetap terpisah dari acceptance interpolasi.

### O2 — Smoothing berbasis waktu dan kualitas sample

**Dependensi:** O0 dan O1. **Status:** filter grip berbasis waktu tersedia dan diuji; cutoff wajah dipertahankan, tuning live terbuka.

Pekerjaan:

- Ukur total lag dari smoothing MediaPipe yang tersedia dan filter SDK. Tuning cutoff posisi/rotasi menggunakan fixture diam, bergerak, stop dan turn; gunakan satu rantai filter yang terdefinisi.
- Ganti bobot grip tetap dengan faktor berdasarkan delta waktu. Pisahkan smoothing anchor, orientasi dan estimasi depth agar perubahan palm span tidak membuat objek meloncat.
- Tolak outlier dan timestamp tidak valid memakai indikator kualitas yang memang tersedia/diturunkan lokal. Jangan menganggap median-span sebagai confidence neural-model.
- Atur reacquisition dan perpindahan face ↔ hand ↔ crown secara eksplisit: contact offset tetap, held scale tetap, sample pemilik lama tidak tersisa.
- Evaluasi dropout grace hanya sebagai eksperimen terpisah, maksimum 100 ms, dengan status kehilangan tracking tetap jujur. Genuine absence/stop/failure tidak boleh menghasilkan kacamata melayang.

Acceptance:

- Trajektori tangan sintetis yang sama pada 10/15/30 Hz memiliki settling time dalam ±10% dan selisih orientasi steady-state ≤1°; depth/contact error memakai toleransi fixture yang dicatat sebelum tuning.
- Jitter RMS posisi/rotasi fixture diam tidak lebih buruk dari baseline, dan perubahan gerakan cepat tidak menambah phase lag melewati batas O1.
- Reversal, gap, timestamp duplicate/reversal, hand identity, face loss, grip/release serta stop/restart tetap deterministik; tidak ada overshoot pada fixture stop yang sudah didefinisikan.
- Live A/B memeriksa frame terasa menempel dan responsif. Grasp/rotation nyata tetap harus dilaporkan sebagai acceptance terpisah dari tangan sekadar aktif.

Output: filter grip berbasis waktu, parameter wajah yang terukur dan regression transfer/reacquisition.

### O3 — Anggaran inference dan kualitas adaptif

**Dependensi:** O0–O2. **Status:** cadence/policy opsional tersedia, hysteresis diuji; device budgets dan quality acceptance terbuka.

Pekerjaan:

- Atur cadence wajah/tangan berdasarkan durasi aktual dan backlog. Prioritaskan wajah; kurangi pekerjaan tangan saat tidak ada tangan atau tidak ada interaksi, tingkatkan respons ketika acquisition/holding aktif.
- Tetap satu worker dan bitmap bersama. Proses synchronous hand inference tidak dapat dipreempt saat sudah berjalan; ukur dampaknya sebelum menjanjikan target face FPS.
- Gunakan level input yang diuji, misalnya lebar 480/640, serta DPR 1/1,5. Pertahankan resolusi video preview dan koordinat/crop; perubahan resolusi tracking harus lulus pengujian fitting dan small-face recognition.
- Gunakan hysteresis dan periode evaluasi minimal dua detik agar kualitas tidak naik/turun setiap frame. Naikkan kembali kualitas hanya setelah beban stabil.
- Jaga CPU recovery, optional-hand failure, expiry dan callback pump. Jika perangkat tidak mampu memenuhi anggaran, tampilkan keterbatasan secara lokal dan catat profil yang gagal; jangan menonaktifkan tangan permanen karena satu sample lambat.

Acceptance:

- Tidak ada lebih dari satu bitmap dalam worker; tidak ada stale completion membuka frame session lain.
- Target face/hand dan budget durasi di bagian 5 terpenuhi pada profil perangkat yang diterima. Kegagalan di perangkat lain dilaporkan, tanpa klaim kompatibilitas universal.
- Perubahan kualitas tidak menyebabkan lompatan bridge, scale, crop, contact atau exposure; tetap dapat kembali ke konfigurasi baseline.
- Model tangan yang gagal/lambat tidak menghalangi startup wajah; actual-worker CPU recovery tetap melanjutkan hasil.

Output: scheduler berprioritas wajah, policy kualitas adaptif dan catatan hasil per profil.

### O4 — Biaya rendering dan alokasi hot path

**Dependensi:** O1 dan O3. **Status:** projection/contact caching dan rigid-mask presentation tersedia; GPU/counter/contact evidence ada, whole-pipeline budgets terbuka.

Pekerjaan:

- Profil CPU/GC/GPU dengan input sintetis. Cache projection/FOV saat dimensi tetap; gunakan ulang vector, matrix, raycaster dan scratch arrays setelah hotspot terbukti.
- Cache bounds lokal aset untuk contact test tanpa menyimpan transform dunia yang sudah kedaluwarsa. Pertahankan hit test GLB, contact preservation dan aturan disposal.
- Kurangi rekonstruksi dense mesh yang tidak perlu; gunakan koreksi rigid bersama ketika hanya pose presentasi berubah. Jangan mengurangi cakupan ear/hook masks demi skor performa.
- Pertahankan material/lens/temple effects, lighting dan render-on-demand ketika stabil. DPR adaptif harus diperiksa untuk kualitas rim tipis serta aliasing.
- Ukur CPU render submission secara terpisah dari GPU. GPU timing hanya dilaporkan bila capability tersedia dan sample valid.

Acceptance:

- Budget CPU submission dan frame pacing bagian 5 terpenuhi, tanpa regresi visual pada semua tiga aset.
- 20 start/stop dan 20 pergantian aset mengembalikan geometry/texture counts ke baseline; buffer temporal dan timer dibersihkan. Counter tersebut tidak dianggap bukti lengkap bebas heap leak.
- Tidak ada pertumbuhan alokasi/buffer yang tidak terbatas pada soak sintetis; live soak tidak menyimpan heap berisi data pengguna.

Output: optimasi hotspot yang terbukti, laporan biaya dan regression resource/visual.

### O5 — Qualification, rollout dan rollback

**Dependensi:** O0–O4. **Status:** regresi sintetis/native/GPU/privacy dan soak 10 menit lulus; live/mobile dan promosi default terbuka.

Pekerjaan:

- Jalankan build/typecheck, seluruh regression lama/baru, actual hashed SDK-worker continuity, GPU rendering dan controlled CPU recovery pada artefak akhir.
- Uji A/B kamera melalui Vanilla public API: diam, turn lambat/cepat, stop mendadak, pitch, roll, jarak, grip/release, wajah tertutup tangan, stop/restart dan reconnect.
- Uji desktop Chromium, iOS Safari, dan dua kelas Android Chrome yang tersedia; catat device/browser, refresh layar, delegate, resolusi dan preset. Jalankan soak kamera minimal 10 menit per profil.
- Periksa traffic saat kamera aktif: hanya aplikasi/aset/model/WASM yang diperlukan, tanpa body/URL/beacon berisi frame atau koordinat. Jangan menyimpan HAR yang dapat berisi data pribadi.
- Default candidate hanya setelah gate numerik dan live sesuai scope lulus. Profil yang belum diuji tetap terbuka; fitur prediction/grace tetap nonaktif bila gate sendiri gagal.

Acceptance:

- Semua gate kontinuitas, latency, visual alignment, resource cleanup dan privasi lulus untuk profil yang diklaim didukung.
- Tidak ada regresi satu-frame-lalu-hilang, mismatch worker, overshoot, ghost pose, hook leak atau grip jump.
- Evidence berisi konfigurasi, jenis input, hasil nyata dan batas pengujian. Tidak menerima milestone hanya karena build atau harness tersedia.
- Rollback tersedia ke preset baseline dengan perubahan default yang tercatat; hasil optimasi tidak otomatis memberi izin publish npm.

Output: matriks acceptance, ringkasan A/B, keputusan default/preset dan daftar profil belum diterima.

## 5. Target awal yang akan diperiksa di O0

Angka berikut adalah **target perencanaan**, bukan hasil pengukuran atau janji semua perangkat. O0 boleh mengusulkan revisi berdasarkan evidence; revisi harus dicatat sebelum acceptance kandidat, bukan menurunkan ambang diam-diam setelah tes gagal.

| Metrik | Desktop target | Mobile target | Cara menilai |
|---|---|---|---|
| Wajah, hasil selesai saat aktif | ≥25 hasil/detik | ≥20 hasil/detik | Counter inference selesai, terpisah dari frame kamera/draw |
| Tangan ketika acquisition/holding | ≥10 hasil/detik | ≥10 hasil/detik pada profil tangan yang diterima | Perangkat yang gagal tetap tidak diterima untuk interaksi tangan |
| Capture → CPU render submission p95 | ≤100 ms | ≤150 ms | Proxy software pipeline; tidak termasuk latency sensor/compositor fisik |
| CPU fit + apply + render submission p95 | ≤4 ms | ≤8 ms | Tidak termasuk inferensi, fixture generation atau GPU execution |
| Pacing saat animasi aktif, layar 60 Hz | ≥55 draw/detik; p95 interval ≤25 ms | ≥28 draw/detik; p95 interval ≤40 ms | Idle/static tidak dipaksa draw; layar lain dinormalisasi terhadap refresh |
| Temporal lag tambahan | ≤1 interval tracking, cap 50 ms | Sama | Ground truth sintetis; live menilai respons secara kualitatif |
| Jitter fixture diam | RMS posisi/rotasi ≤baseline | Sama | Fixture dan konfigurasi identik; bukan rekaman wajah pengguna |
| Kontinuitas normal, soak 10 menit | 0 restart tidak diinduksi; tidak ada freeze | Sama untuk profil yang diterima | Fault injection dinilai sebagai recovery tersendiri |

Smoothing atau prediksi tidak boleh diterima hanya karena FPS meningkat; alignment/occlusion dan responsiveness harus lulus bersamaan.

Catatan scope 13 Oktober: target draw ≥55 Hz mengasumsikan video sumber yang benar-benar memperbarui mendekati 60 Hz. Kamera ideal 30 Hz tidak wajib menghasilkan 55 draw berbeda; presentation sengaja berhenti saat media frame berulang. Ini klarifikasi sebelum promosi kandidat, bukan klaim budget telah lulus. Runtime blank-input saat ini tetap belum menutup target aktif pada perangkat.

## 6. Progres dan langkah berikutnya

- [x] Audit jalur tracking, renderer, filter wajah/tangan dan evidence yang tersedia.
- [x] Rencana, urutan milestone, target awal dan acceptance disiapkan.
- [x] O0 implementasi baseline/instrumentation/harness; live/controlled qualification terbuka.
- [x] O1 implementasi timeline/presentation; prediksi terpisah dan default belum dipromosikan.
- [x] O2 filter grip dan transfer/reacquisition; tuning filter wajah live terbuka.
- [x] O3 scheduler dan kualitas adaptif opt-in; acceptance perangkat terbuka.
- [x] O4 projection/contact/mask resources; budget pipeline penuh terbuka.
- [ ] O5 live/device qualification dan keputusan default.

Urutan implementasi: **O0**, lalu **O1**. Jangan mengubah cutoff, FPS kamera atau kualitas model secara serentak sebelum baseline tersedia. Acceptance mengikuti evidence aktual pada log M7, bukan keberadaan modul atau jumlah tes.
