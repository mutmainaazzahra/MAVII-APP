# 📱 MAVII - Field Service Management System (FSMS) Mobile App

MAVII adalah aplikasi mobile yang dirancang khusus untuk para teknisi lapangan guna mengelola, melacak, dan menyelesaikan tugas (work orders) secara efisien. Aplikasi ini terintegrasi dengan modul GPS pelacakan lokasi, notifikasi push real-time, fungsionalitas offline, serta sistem pemetaan interaktif.

---

## 🚀 Fitur Utama

1. **Autentikasi & Manajemen Sesi Keamanan**
   - Autentikasi berbasis JWT Token yang aman.
   - Guard halaman berbasis peran ([AuthGuard](file:///c:/Projects/IONIC/mavii/src/app/core/guards/auth.guard.ts) & [RoleGuard](file:///c:/Projects/IONIC/mavii/src/app/core/guards/role.guard.ts)).
   - Fitur Lupa Kata Sandi & Reset Kata Sandi terintegrasi dengan Deep Linking (`mavii://reset-password`).
   - Manajemen profile, termasuk pembaruan informasi profil dan unggah foto profil (avatar).

2. **Manajemen Tugas & Status Pekerjaan**
   - Menerima penugasan tugas baru secara real-time.
   - Siklus hidup status tugas terstruktur: `assigned` (ditugaskan) ➡️ `accepted` (diterima) / `rejected` (ditolak) ➡️ `on-going` (sedang berjalan) ➡️ `completed` (selesai).
   - Detail informasi keluhan pelanggan, lokasi, serta catatan tindakan.

3. **Peta Interaktif & Pelacakan Lokasi (Geolocation)**
   - Integrasi peta berbasis Leaflet dan OpenStreetMap tanpa ketergantungan Google Maps SDK berbayar.
   - Perhitungan rute berkendara dan estimasi waktu perjalanan secara real-time via OSRM (Open Source Routing Machine).
   - Pengiriman koordinat lokasi teknisi ke server backend setiap 30 detik secara otomatis saat status kerja teknisi aktif (`online`).
   - Penanganan akurasi GPS tinggi dengan fallback hemat daya jika GPS terkunci lambat.

4. **Notifikasi Push FCM & Notifikasi Lokal**
   - Integrasi Firebase Cloud Messaging (FCM) untuk pengiriman notifikasi instan dari server backend Laravel.
   - Pendaftaran FCM Token otomatis ke backend saat login.
   - Penayangan notifikasi lokal saat aplikasi terbuka maupun di latar belakang melalui Capacitor Local Notifications.
   - Alert dialog interaktif dalam aplikasi untuk langsung melihat detail tugas baru yang masuk.

5. **Dukungan Sinkronisasi Offline & Cache**
   - Penyimpanan data cache lokal dengan performa tinggi via Capacitor Preferences ([OfflineStorageService](file:///c:/Projects/IONIC/mavii/src/app/core/services/offline-storage.service.ts)).
   - Interseptor HTTP pintar ([OfflineInterceptor](file:///c:/Projects/IONIC/mavii/src/app/core/interceptors/offline.interceptor.ts)) untuk menangkap kegagalan jaringan, memberi feedback toast yang informatif, serta mengamankan alur navigasi pengguna saat offline.
   - Cache detail tugas, daftar riwayat tugas, serta informasi profil.

---

## 🛠️ Tech Stack & Dependencies

- **Core Framework:** Angular v20.0.0 & Ionic Framework v8.0.0
- **Native Engine:** Capacitor v8.3.4 (Core, CLI, Android)
- **Maps & Geolocation:** Leaflet v1.9.4 & `@types/leaflet`
- **Native Plugins:**
  - `@capacitor/geolocation`: Akses GPS perangkat.
  - `@capacitor/camera`: Pengambilan foto sebagai bukti penyelesaian tugas.
  - `@capacitor/local-notifications` & `@capacitor/push-notifications`: Push & Local messaging.
  - `@capacitor/preferences`: Penyimpanan data offline terenkripsi/aman.
  - `@capacitor/network`: Deteksi status koneksi internet secara real-time.
  - `capacitor-email-composer` & `@ionic-native/social-sharing`: Ekspor data dan berbagi informasi.

---

## 📁 Struktur Proyek & File Penting

Berikut adalah beberapa berkas inti yang mendasari logika bisnis aplikasi MAVII:

- ⚙️ **Konfigurasi Project:**
  - [package.json](file:///c:/Projects/IONIC/mavii/package.json) - Manajemen modul dan script build.
  - [capacitor.config.ts](file:///c:/Projects/IONIC/mavii/capacitor.config.ts) - Konfigurasi integrasi native Android (ID App: `com.fsms.mavii`).
  - [ionic.config.json](file:///c:/Projects/IONIC/mavii/ionic.config.json) - Pengaturan Ionic CLI.
  - [src/index.html](file:///c:/Projects/IONIC/mavii/src/index.html) - Entry point HTML yang memuat stylesheet Leaflet, jsPDF, serta penanganan deep link.

- 🔒 **Sistem Keamanan & Routing:**
  - [src/app/app-routing.module.ts](file:///c:/Projects/IONIC/mavii/src/app/app-routing.module.ts) - Navigasi dan proteksi rute aplikasi.
  - [src/app/core/guards/auth.guard.ts](file:///c:/Projects/IONIC/mavii/src/app/core/guards/auth.guard.ts) - Guard pengecekan login.
  - [src/app/core/guards/role.guard.ts](file:///c:/Projects/IONIC/mavii/src/app/core/guards/role.guard.ts) - Guard pengecekan hak akses spesifik (role: `technician`).
  - [src/app/core/interceptors/auth.interceptor.ts](file:///c:/Projects/IONIC/mavii/src/app/core/interceptors/auth.interceptor.ts) - Menyisipkan JWT Authorization Header secara otomatis di setiap permintaan HTTP.
  - [src/app/core/interceptors/offline.interceptor.ts](file:///c:/Projects/IONIC/mavii/src/app/core/interceptors/offline.interceptor.ts) - Interseptor penanganan status offline dan error HTTP global.

- ⚙️ **Core Services:**
  - [auth.service.ts](file:///c:/Projects/IONIC/mavii/src/app/core/services/auth.service.ts) - Menangani otentikasi user, registrasi/login, logout, refresh profil.
  - [task.service.ts](file:///c:/Projects/IONIC/mavii/src/app/core/services/task.service.ts) - Layanan CRUD tugas (mendapatkan tugas, menerima/menolak tugas, memperbarui catatan tindakan, menyelesaikan tugas).
  - [location.service.ts](file:///c:/Projects/IONIC/mavii/src/app/core/services/location.service.ts) - Pelacakan posisi teknisi dan pengiriman koordinat ke Laravel API setiap 30 detik.
  - [notification.service.ts](file:///c:/Projects/IONIC/mavii/src/app/core/services/notification.service.ts) - Penanganan sinkronisasi notifikasi, registrasi FCM token, dan penjadwalan notifikasi lokal.
  - [offline-storage.service.ts](file:///c:/Projects/IONIC/mavii/src/app/core/services/offline-storage.service.ts) - Logika penyimpanan cache data lokal menggunakan Capacitor Preferences.

- 🎨 **Desain & Branding:**
  - [src/theme/variables.scss](file:///c:/Projects/IONIC/mavii/src/theme/variables.scss) - Skema palet warna kustom Mavii Blue (`#131DAA`), Mavii Orange (`#EF8E01`), serta pewarnaan status tugas.
  - [scripts/setup-splash.js](file:///c:/Projects/IONIC/mavii/scripts/setup-splash.js) - Script otomasi untuk menyalin gambar splash screen ke berbagai resolusi folder drawable Android.

---

## 🚀 Cara Menjalankan Project

### 1. Prasyarat (Prerequisites)
Pastikan Anda sudah menginstal alat-alat berikut di komputer Anda:
- Node.js LTS
- Android Studio (untuk build aplikasi Android)
- Ionic CLI secara global:
  ```bash
  npm install -g @ionic/cli
  ```

### 2. Instalasi Dependensi
Jalankan perintah berikut untuk menginstal semua library pendukung:
```bash
npm install
```

### 3. Konfigurasi Lingkungan (Environment)
Edit berkas `src/environments/environment.ts` atau `environment.prod.ts` untuk menyesuaikan endpoint backend API:
```typescript
export const environment = {
  production: false,
  apiUrl: 'https://mavii.my.id', // Endpoint Laravel API Anda
};
```

### 4. Jalankan di Browser (Web/Development)
Gunakan perintah berikut untuk menjalankan server pengembangan lokal:
```bash
npm start
# atau
ionic serve
```

### 5. Bangun untuk Android
Untuk melakukan sinkronisasi kode web ke dalam proyek native Android:
1. Pastikan Anda telah mengonfigurasi splash screen terlebih dahulu:
   ```bash
   npm run setup:splash
   ```
2. Lakukan build web dan sinkronisasi Capacitor:
   ```bash
   npm run build:android
   ```
3. Buka proyek di Android Studio untuk run langsung ke perangkat fisik/emulator:
   ```bash
   npx cap open android
   ```

---

- **Keamanan Baterai & Fallback:** Jika perangkat gagal mengembalikan koordinat GPS dengan akurasi tinggi (karena di dalam gedung atau sinyal lemah), sistem secara otomatis melakukan fallback menggunakan cache lokasi sebelumnya yang berumur di bawah 5 menit untuk menghemat baterai dan menjaga keandalan data.

---

## 🗑️ Penghapusan Cache & Pemeliharaan Aplikasi

Untuk melakukan reset cache data offline dan antrean sinkronisasi di aplikasi, teknisi dapat melakukannya melalui menu profil atau pengembang yang memanggil fungsi `clearAllCache()` di [offline-storage.service.ts](file:///c:/Projects/IONIC/mavii/src/app/core/services/offline-storage.service.ts). Hal ini berguna untuk memulihkan keadaan aplikasi jika terjadi konflik data lokal.
