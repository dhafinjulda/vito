# Premium fitting implementation — 13 October 2026

SDK tetap produk utama; Vanilla hanya reference consumer. Semua gambar kamera,
landmark, pose, mask segmentasi dan gesture tetap sementara di perangkat. Tidak
ada upload, telemetry, snapshot persistence atau publikasi npm.

## Keputusan

- Pertahankan TypeScript, MediaPipe dalam classic worker, Three.js, GLB. Tangan
  tetap memakai kamera/worker yang sama; wajah selalu diproses lebih dulu.
- Bedakan clock capture, media frame dan receipt. Hasil worker dari frame yang
  dibekukan tidak boleh memperpanjang keberadaan pose atau pegangan.
- Kalibrasi tahap pertama memakai intrinsics kamera dan referensi ukuran lokal
  yang eksplisit. PnP/distortion estimation merupakan spike terpisah; tidak
  mengklaim pengukuran fisik hanya dari wajah kanonis.
- Compositing kamera di WebGL bersifat opt-in dan punya fallback preview DOM.
  Transmission material membaca camera background; seluruh tekstur/video lokal.
- Hair segmentation merupakan modul opsional di worker yang sudah ada, memakai
  ImageSegmenter dari dependency MediaPipe yang sudah dipin. Tidak menambah ONNX
  runtime sebelum manfaatnya terbukti. Mask hanya dipakai pada rear temple/ear
  tip ketika mounted di wajah; tidak menyembunyikan bingkai yang dipegang/crown.
  Ini bukan deteksi telinga atau estimasi depth rambut. Lisensi/provenance model
  dicatat; model tidak dibundel atau dicache otomatis.
- Kontak/remount memakai jarak dan orientasi serta hysteresis, bukan hanya radius
  posisi. Engsel/folding memerlukan rig aset terkalibrasi; tidak menebak pivot
  produk generik. Aset demo tidak diberi klaim SKU retail.

## Milestone

| ID | Implementasi | Acceptance | Progres |
|---|---|---|---|
| P1 | Frame freshness, duplicate suppression, stale result guard, media-clock velocity | Kamera beku tidak terus mengirim bitmap/menjaga pose; resume/reversal kembali tracking; callback fallback/backpressure/cleanup tetap lolos | Code + unit/public SDK video regression lolos |
| P2 | Typed camera intrinsics, cover-crop projection, transient face-size reference, physical asset scale | Frontal/off-centre, fx != fy, resize/crop, distance/scale dan contact ray cocok fixture; invalid config ditolak; tidak menyimpan profil biometrik | Code + 4 calibration fixtures dan actual camera projection lolos |
| P3 | Camera VideoTexture background + opt-in compositing/transmission | Warna/orientasi/cover benar; mirror sama DOM; camera texture masuk transmission target; frame baru dirender meski pose statis; stop menghapus tekstur; GPU checks | Code + GPU colour/transmission/cover dan lifecycle lolos; live optics terbuka |
| P4 | Hair segmentation optional + timestamped rear-part mask | Default tidak membuat/download graph; face first; satu bitmap; output mask ditutup/dibuang; mask stale/loss/head/held tidak dipakai; actual native blank model + synthetic shader check | Code + native model/combined graphs/shader/privacy lolos; live hair accuracy terbuka |
| P5 | Remount contact/orientation constraints + dimensional asset contract | Akuisisi tidak lompat; jarak/orientasi menentukan eligibility mount baru; near aligned remount settle 200 ms mengikuti mount; invalid release kembali ke mount sebelumnya; scale supplier eksplisit; reset/disposal | Code + 11 interaction fixtures lolos; free-body/folding dan live contact terbuka |
| P6 | Public Vanilla candidates + build/typecheck/unit/native/GPU/privacy evidence | Hasil nyata dicatat; kamera pengguna/mobile/real SKU diberi status terbuka bila belum diuji; eksperimen tidak menjadi default dari fixture saja | Code/reference UI/checks selesai; perangkat, subjek dan SKU eksternal tetap gate |

## Gate yang memerlukan perangkat atau aset eksternal

- Live A/B attachment, glare/lens response, profil/menengadah, keragaman rambut,
  hand grasp/remount dan cold graph compilation.
- iOS/Android device matrix, small-face resolution, thermal/resource budgets.
- Kalibrasi kamera yang benar dan SKU supplier dengan ukuran/rig/lisensi nyata.
- Mask rambut tidak membuktikan anatomical ear segmentation. PnP, distortion,
  automatic physical sizing, two-hand constraints dan folding rig tetap perlu
  evidence tersendiri sebelum scope itu diterima.

## Evidence log

### Implementasi 13 October

- Public options: `cameraCalibration`, `faceReferenceEyeSpanCm`,
  `cameraCompositing`, `lensOptics`, `hairOcclusion`; public
  `cameraCalibrationFromReference()` dan `GlassesAsset.physicalFit`. Options
  invalid ditolak sebelum membuat elemen/kamera. Tidak ada React/core UI import.
- Media-clock prediction memakai interval decoded frame, bukan jitter callback.
  Backup capture memakai `getVideoPlaybackQuality()` ketika rVFC senyap: clock
  pemutar yang maju sendiri tidak membuktikan gambar baru. Tanpa bukti decoded
  frame, pose kedaluwarsa; resume mengirim frame kembali tanpa restart worker.
- Hair model menggunakan dependency MediaPipe yang sama. Native graph benar
  berhasil initialize dan mengembalikan mask 640×360 pada input tracking 640×360.
  Callback-owned native outputs dilepas MediaPipe; hanya salinan Uint8 terikat
  1,048,576 pixels dikirim lokal. Mask berlaku <=500 ms, translasi kepala <3%
  eye span dan rotasi <5°, rear local-Z <=−0.1 pada semantic temple/ear-tip.
  Ketika stale/moving/held/crown/loss, approximate head volumes tetap fallback.
  Optional graph failure tidak mematikan wajah. Hair cost ikut budget adaptif
  dan metric `hairInference`. Cadence 300–1,000 ms bukan segmentasi 60 FPS.
- SDK default tetap direct presentation, adaptive quality off, compositing off,
  hair off, hands off. Aset Round Spectacles single mesh tidak memiliki semantic
  lens/temple sehingga tidak mendapat optics/hair/temple adaptation.

### Checks dan batas evidence

- `pnpm build`: exit 0, SDK/generator/Vanilla/Studio dan tiga GLB tervalidasi.
  Three.js chunks >500 kB masih memberi warning bundler. SDK 98.38 kB /
  29.08 kB gzip; worker `face-worker-DepdZ35-.js` 176.83 kB, protocol 6.
- `pnpm typecheck`: exit 0 keempat workspace. `pnpm test`: exit 0,
  **133 SDK + 6 generator = 139 tests**, offline cache policy lolos.
- [GPU evidence](evidence/premium-gpu.json): first camera frame [255,0,0,255],
  lens transmission merah→hijau [254,0,0,255]→[0,254,0,255]; empat quadrant dan
  portrait cover crop benar. Rear mask alpha 0, front alpha 255; expiry/held
  memulihkan rear. Top-down mask Y benar. Tiga GLB tidak mendapat WebGL error.
  Off-centre/fx != fy projection error 3.51e−16 pada fixture yang diketahui.
- [Freshness evidence](evidence/premium-freshness.json): decoded video dihentikan,
  playback clock maju 1.10 s tetapi tambahan bitmap **0** dan status searching.
  Resume menerima 20 frame pada jendela 700 ms, kembali tracking, restart **0**;
  tracks dihentikan. Synthetic face packets, actual video/public SDK.
- [Visibility](evidence/premium-visibility.json): **48/48** kasus public SDK,
  tiga mode presentation, hands on/off, hasil 40/250/500 ms, loss/reacquisition,
  silence expiry, stop. [Prediction](evidence/premium-prediction.json): tiga GLB,
  head/asset/mask/contact/owner/loss koheren, WebGL error 0. Ini tidak mengukur
  neural detection accuracy atau physical camera-to-display latency.
- [Native face continuity](evidence/premium-continuity.json) dan
  [intentional stall/CPU recovery](evidence/premium-recovery.json) lolos. Actual
  MediaPipe, blank video; recovery satu kali, kamera tidak diminta ulang.
- [Native Face + Hair](evidence/premium-native.json): 157 frame-done, 18 mask,
  no restart, no HTTP writes/body. [Face + Hand + Hair](evidence/premium-native-combined.json)
  menguji ketiga actual graph + compositing, bounded output dan teardown.
  Counter/timing boleh berbeda antarrun; tidak menjadi klaim recognized-face FPS.
  Run final combined: 208 completion, 81 hand result, 19 hair masks, restart 0,
  mirror sama, track/elemen dibuang dan HTTP writes/body 0. Window final face
  result 21.4 Hz, hand 12.8 Hz, draw 29.6 Hz, hair inference p95 63.6 ms pada
  blank input. Face-only run 30 Hz. Bukan quiet matched A/B; hair tetap opt-in.
- [Vanilla](evidence/premium-example.json): toggle/query kandidat, validasi,
  recreation, satu video/canvas, nilai reference tidak masuk URL; camera calls
  **0**, uncaught page errors **0**. Website memakai API publik.
- Model [inventory](evidence/hair-model-inventory.json): 781,618 bytes,
  SHA-256 dicatat tanpa menyimpan weights. Apache-2.0 dari official model card;
  license/provenance masuk third-party notices. Hash inventory bukan runtime
  integrity enforcement. Model tidak masuk cache allowlist atau bundle.
- Final SDK entry frozen sebagai `8458afc74cbd`, source/build inventory di
  [manifest](evidence/smoothness-premium-final-manifest.json), setelah build
  sukses dan tanpa edit source SDK berikutnya. Local frozen dist diabaikan Git.

### Temuan dan perbaikan selama verifikasi

- GPU first background semula transparan: VideoTexture baru menunggu callback
  berikutnya. `needsUpdate` initial kini meng-upload current decoded frame;
  DOM preview baru disembunyikan setelah background/draw siap.
- Review source Three.js r176 menemukan `VideoTexture` mendaftarkan rVFC loop
  yang tidak dibatalkan oleh `dispose()`. Camera background sekarang menggunakan
  local `Texture` dengan renderer video flags dan update dari clock SDK, tanpa
  callback video tambahan. Unit memastikan rVFC tidak didaftarkan; colour,
  transmission dan cover GPU checks tetap lolos. Texture dibuang saat stop.
- Test session opsional semula memanggil semua rAF termasuk capture fallback;
  diperbaiki menjadi callback render opportunity saja. Unit semua lolos.
- [Freshness initial](evidence/premium-freshness-initial.json) memakai fixed
  700 ms untuk acquisition dan gagal `acquired` saat initial GPU compilation.
  Harness kini menunggu actual tracking dengan deadline 5 s; checks frozen/resume
  tetap sama. [Prediction initial](evidence/premium-prediction-initial.json)
  memakai timestamp capture di masa depan; age guards mematikan extrapolation
  GLB pertama. Harness kini warm GPU dan memakai capture clock aktual yang lalu.
  Tidak melonggarkan guard runtime untuk membuat fixture lolos.

### Penggunaan dan acceptance yang belum ditutup

Contoh: `http://127.0.0.1:5173/?compositing=1&hairOcclusion=1&presentation=predicted&adaptiveQuality=1`.
Pilih Contour/Linea, buka eksperimen, lalu **Mulai kamera**. Konfigurasi dapat
diubah sebelum start; ukuran referensi bukan PD dan tidak disimpan.

Belum ada live/camera/mobile acceptance baru atau ten-minute soak build M8.
Previous M7 ten-minute soak tidak dialihkan ke build ini. Intrinsics/manual
reference tidak mengubah neural pose menjadi calibrated PnP, tidak memperbaiki
distorsi otomatis, tidak mengenali anatomical ears. Kontak tangan/crown/depth
tetap perkiraan. Invalid release kembali ke mount semula, bukan free fall.
Cold native graph compilation dapat memblokir worker sementara; deadline
initialization dibatasi, tetapi live pose tidak ditahan melewati freshness
budget untuk menutupi jeda. Optional cold-start visual continuity belum diterima.
Semua gate perangkat/aset di atas tetap terbuka; tidak publish npm.

- Baseline sebelumnya: 120 unit tests, 48 visibility cases, GPU/contact/resource
  checks dan native blank-stream 10-minute soak. Ini historis untuk build
  `db5ca25981bf`, bukan acceptance perubahan P1–P6.
- Sumber API: [MediaPipe Image Segmenter](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js),
  [model guide](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter),
  [Three.js VideoTexture](https://threejs.org/docs/pages/VideoTexture.html),
  [PnP reference](https://docs.opencv.org/4.13.0/d5/d1f/calib3d_solvePnP.html).
