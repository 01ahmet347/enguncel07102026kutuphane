# Firebase yapılandırması — 4. aşama çalışma notu

Bu aşamada kullanıcıdan alınan `firebase.json` **değiştirilmeden** çalışma paketine eklendi; `firestore.rules` dosyası, bu JSON'un beklediği **paket kök dizinine** taşınan bir kopyayla tamamlandı. `docs/firestore.rules` da karşılaştırma taslağı olarak korunuyor. Mevcut kullanıcı, QR, PIN, parola veya Firestore belgelerinde değişiklik yapılmadı.

## Canlı dağıtım konusunda uyarı

**Henüz yayınlamayın.** Yeni kuralların Admin `adminSessionId` yetki kontrolü, önce sunucu `api/admin-login.js` ile aktif oturum belgesinin (`sgmAdminSessions/current`) oluşturulmasına, kullanıcı arayüzü ve diğer admin API'lerinin aynı sürümle eşleşmesine bağlıdır. Kuralları tek başına önce yayınlamak eski yönetici oturumlarının yazma yetkisini düşürür. Tüm admin API uçları henüz taranmış değildir. Yönetici yetkisi ayrıca Firebase Admin SDK kullanan her API'de `requireActiveAdmin` ile doğrulanmalıdır; Firestore kuralları Admin SDK çağrılarına uygulanmaz.

Mevcut Hosting ayarı tüm yolları `/index.html` üzerine yönlendiriyor. Bu yapı Vite SPA için korunmuştur; fakat uygulama **Firebase Hosting alan adından** açılıyorsa `/api/student-login`, `/api/student-desk`, `/api/admin-login` ve diğer Vercel serverless fonksiyonları otomatik çalışmaz. Dağıtım alan adı veya `/api` yönlendirme mimarisi ayrıca doğrulanmalı, bu aşamada kendiliğimizden değiştirilmemelidir. Yalnız Firestore kurallarını daha sonra dağıtmak için `firebase deploy --only firestore:rules` düşünülebilir; fakat ancak tüm entegrasyon ve Emulator testlerinden sonra.

Sunucu `FIREBASE_APP_ID` ile tarayıcı `VITE_FIREBASE_APP_ID` değerleri aynı `artifacts/{appId}/public/data` yolunu kullanmalıdır. Bu canlı ortamda doğrulanmamıştır.

## Sınamalar

`node --test tests/*.test.js` statik yol/politika kontrolleri ve mock işlem testleridir. Gerçek kuralların sözdizimi, yetkilendirme ve deny/allow davranışları Firebase Emulator ile henüz doğrulanmadı. Bunlar kullanıcıların sisteme erişimini etkilediğinden canlıya çıkmadan önce zorunludur.
