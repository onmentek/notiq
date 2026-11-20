# Notiq — Hızlı, Akıllı & Yarı Saydam Not Uygulaması

**Vercel + Turso (libSQL / FTS5)** altyapısıyla çalışan, hem **Web** hem de **Android APK** (Capacitor 8) olarak kullanılabilen, hız ve görsel ergonomi odaklı not uygulaması.

## Öne Çıkan Özellikler

- **Üstten Hızlı Yazma (Top-First Composer)**: Herhangi bir not kartına girdiğinizde imleç doğrudan kartın en üstündeki hızlı ekleme alanına odaklanır. Yazıp `Enter` dediğinizde yeni satır anında en üste eklenir; `Madde` (görev kutucuğu) veya `Saat` (`HH:MM —`) tek tıkla açılır. `Esc` ya da yarı saydam arka plana tıkladığınızda yarım kalan metin bile otomatik kaydedilir.
- **Akıllı Öncelik (Frecency Sıralaması)**: Sık açtığınız ve düzenlediğiniz not kartları üstel zaman sönümlemeli Frecency algoritmasıyla doğal olarak öne yükselir ve `Sık Kullanılan` filtresinde toplanır.
- **Yarı Saydam Geçişler & Hızlı Geçiş**:
  - **Karttan Büyüyen Cam Modal**: Tıklanan kartın konumundan yaylı (spring) animasyonla açılan buzlu cam pencere.
  - **Hızlı Bakış (`Space` / Göz ikonu)**: Yarı saydam önizleme penceresiyle karta tam girmeden anlık göz atma.
  - **Kartlar Arası Hızlı Geçiş**: Kart açıkken `Alt + ← / →`, yatay kaydırma (swipe) veya alttaki yarı saydam Hızlı Geçiş çubuğuyla karttan çıkmadan diğer karta geçme.
  - **Komut & Arama Paleti (`⌘K` / `Ctrl+K`)**: Türkçe karakter duyarsız (`alisveris` → `Alışveriş`), `#etiket`, `is:todo`, `is:pinned` destekli milisaniyelik arama.
- **Kart Üstünde Etkileşimli Görevler**: `- [ ]` satırları doğrudan kart önizlemesinde işaretlenebilir.
- **Çevrimdışı Öncelikli + Turso Bulut Senkronizasyonu**: Web ve Android APK çevrimdışı 0ms gecikmeyle çalışır; arka planda `/api/sync` üzerinden Turso ile çift yönlü eşitlenir.

## Kurulum & Yerel Çalıştırma

```bash
npm install
npm run dev
```

Yerel geliştirmede `TURSO_DATABASE_URL` tanımlı değilse otomatik olarak `file:./data/notes.db` (libSQL + FTS5) kullanılır.

## Vercel + Turso Kurulumu

1. [Turso](https://turso.tech) üzerinde veritabanı oluşturun:
   ```bash
   turso db create notiq
   turso db show notiq --url
   turso db tokens create notiq
   ```
2. Projeyi Vercel'e bağlayın ve aşağıdaki ortam değişkenlerini ekleyin:
   - `TURSO_DATABASE_URL` → `libsql://...turso.io`
   - `TURSO_AUTH_TOKEN` → Turso token
   - `SYNC_SECRET` *(opsiyonel)* → Çoklu cihaz erişimini korumak için gizli anahtar
3. İlk istek geldiğinde tablo ve FTS5 arama indeksleri otomatik oluşturulur.

## Android APK

Hazır derlenmiş APK dosyası: `dist/notiq-android.apk`

Kendiniz yeniden derlemek için:
```bash
npm run android:apk
```

Android uygulamasında **Ayarlar → Vercel + Turso Bağlantısı** bölümüne Vercel adresinizi (ör. `https://notiq.vercel.app`) girerek telefonunuz ile web tarayıcınız arasında canlı Turso senkronizasyonunu başlatabilirsiniz.
