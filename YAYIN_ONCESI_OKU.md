# Sarıçam GM — Birleştirilmiş Çalışma Projesi (2026-10-13)

**UYARI: BU KOD PAKETİ CANLI YAYINA HAZIR DEĞİLDİR.**

Bu ZIP, kullanıcının 2026-10-07 tarihli tam proje ZIP'inden hazırlanmış **tek bir proje ağacıdır**. Önceki 1–7. aşama hazırlıklarında yapılmış ilgili değişiklikler projeye birleştirilmiş, mevcut yardımcı sunucu dosyaları korunmuş, kapalıyken ihbar süresi için yetkili ek API hazırlanmış, eski testler güncel kullanıcı kararıyla uyumlu hâle getirilmiştir. Bu işlem Firebase/Vercel'e erişmemiştir. Canlıya otomatik yükleme yapılmadı.

## Kapsama alınan istekler

- Mevcut 35 masa ve kalıcı QR değerleri; mevcut GM özel kodları/PIN'ler; masa/ihlal/geçmiş kayıtları koruma ilkesi.
- Mola başlangıcında Evet/Hayır sorusu, kalan süre ve QR geri dönüşü; mola bitişi tek başına ceza veya masa kaybı yaratmaz.
- Geçerli ihbardan itibaren 5 dakikalık sunucu doğrulaması; aynı ihbardan tek ihlal; 22.00 sonrasında cezasızlık.
- Son 7 günde 2 ihlal olursa 7 gün kısıtlama; yönetici istisnasında ceza geçmişini koruma.
- Kişinin kendi bıraktığı masaya özel 30 dakika; diğer uygun masalara izin.
- Yönetici onaylı cezasız masa boşaltma ve atomik masa atama; tek yönetici oturumu doğrulaması ve yönetici push yetkisi.
- 22:00 günlük kapanış sunucu işlemi; ayrı `api/cron-expire.js` güvenli zaman aşımı işleyicisi (zamanlayıcı henüz etkinleştirilmedi).
- Öğrenci giriş deneme sayaçlarının hesap bazında ayrıştırılması; bildirim kodu/ihbar kuyruğu düzeltmeleri; tekrar eden FCM token yazmalarının azaltılması.

## Tamamlanmış görünen ancak canlıda doğrulanması gereken işler

**Henüz TAMAMLANMAYANLAR / canlıya çıkış engelleri:**

1. **Kalıcı öğrenci Firebase kimlik oturumu:** Mevcut uygulama `browserSessionPersistence` ve `sessionStorage` kullanıyor. Tarayıcı sekmesinin tamamen kapanmasından sonra öğrencinin girişinin kalacağı şu an sağlanmış değildir. Yönetici ve öğrenci kimlikleri aynı Firebase Auth nesnesi üzerinden geçtiği için basitçe `localPersistence` seçmek diğer oturumu bozabilir. Rol bazlı ayrı Auth örnekleri ve veritabanı izinlerinin bütünleşik tasarımı ve testleri gerekir.
2. **Cihazlar kapalıyken ihbarın tam zamanında sonuçlanması:** `api/cron-expire.js` hazırlanmıştır; ancak `vercel.json` içinde **yalnızca 22:00 günlük cron etkin**. Hobby planındaki sık cron kısıtından dolayı dakikalık ihbar taraması varsayılan olarak açılmadı. `docs/vercel-cron-sikligi.md` okunmalı ve uygun güvenilir zamanlayıcı ayarlanmalıdır. Dakikalık cron bile işlem anında mutlak teslim garantisi vermez.
3. **Tam Vite derlemesi / arayüz render testi:** Kaynak ZIP içindeki `node_modules` Windows derleme ikililerini içeriyordu; çalışma ortamı Linux olduğu için Rollup/esbuild yerel modülleri bulunamadı. `npm run build` çalıştırılamadı; arayüzün kapsamlı SSR testi platform ikilisi nedeniyle **atlanmıştır**. React JSX, Babel parser ile doğrulandı. Gerçek platformunda temiz `npm ci` sonrası `npm test && npm run build` şarttır.
4. **Gerçek Firebase Emulator ve Firestore kuralları:** Aktif yönetici, özel masa izinleri ve 22:00 işlem yarışmaları emülatör ile sınanmadı. `firestore.rules` sunucu/istemciyle uyumlu sırada dağıtılmalı. Eski sürümlü tarayıcılardan yapılan yazmalar da test edilmelidir.
5. **Sürüm geçişi / toplu kayıt kurtarma:** Aynı öğrencinin eski-yeni sürümde açılan sekmeleri, ağ kopması sırasında kısmen tamamlanan toplu yönetici işlemleri ve veritabanındaki tüm eski kayıt çeşitleriyle entegrasyon testi eksik.
6. **Gerçek bildirim/Android, 22.00 cron ve Firestore kota testleri:** Telefon bildiriminin gerçekten alınması, pil izinleri, gecikmiş cron, 21.58 ihbarı, eş zamanlı müdahale ve kota artışları gerçek ortamda doğrulanmadı.

Bu koşullar sağlanmadan ZIP içeriğini çalışan sisteminin üzerine kopyalayıp yayınlamayın.

## Yerel test sonucu

- `node --test tests/*.test.js`: **110 toplam; 109 geçti, 1 platform nedeniyle atlandı, 0 başarısız**.
- `node --check` ile `api/*.js`, `server/*.js`, `src/*.js`, `main.js` ve diğer sunucu JS sözdizimi: geçti.
- React uygulamasının tam JSX kaynak kodu Babel parser ile doğrulandı.
- Testlerin çoğu mock Firestore / kaynak kod regresyon testidir. Gerçek Firebase kimlik, Firestore Emulator, tam Vite build, mobil FCM, Vercel zamanlayıcı uçtan uca testi DEĞİLDİR.

## İnceleme sırasında değiştirilmiş mevcut dosyalar

- `api/admin-login.js`
- `api/admin-student-create.js`
- `api/send-push.js`
- `api/student-desk.js`
- `api/student-login.js`
- `firestore.rules`
- `kutuphaneprogramıguncell.jsx`
- `public/firebase-messaging-sw.js`
- `server/student-activity.js`
- `server/student-auth.js`
- `src/cloud-transactions.js`
- `vercel.json`

## Projeye eklenen uygulama/sunucu dosyaları

- `.firebaserc`
- `api/cron-close.js`
- `api/cron-expire.js`
- `api/server-time.js`
- `server/admin-session.js`
- `server/daily-close.js`
- `server/push-authorization.js`

## Kurulum ve güvenli yayın öncesi yapılacaklar

1. Kendi Windows/Linux makinenizde bu projeyi ayrı klasöre açın. **Mevcut canlı proje dizininin üstüne doğrudan çıkarmayın.**
2. Mevcut Vercel/Firebase çevre değişkenlerini yeni bir `.env` dosyasına yerel olarak sağlarken, bu ZIP'in içinde `.env` olmadığını kontrol edin. Firebase Admin özel anahtarlarını hiç kimseyle paylaşmayın.
3. `npm ci` ardından `npm test` ve `npm run build` çalıştırın; derleme sonucu hatasız olmadan dağıtmayın.
4. Firestore veritabanının doğrulanmış güncel yedeğini alın. Özellikle `sgmUsers`, `sgmDesks`, `sgmConfig`, `sgmAudit`, `sgmViolations`, `sgmDeviceLocks`, `sgmAuthCodes` ve silinme işaretlerini yedekleyin. Testleri Firebase Emulator üzerinde yapın.
5. `firebase.json`, `firestore.rules` ve `docs/firebase-yayin-notu.md` birlikte gözden geçirilmeli. Vercel ile Firebase Hosting adresleri karıştırılmamalı.
6. `CRON_SECRET`, `FIREBASE_APP_ID`, Firebase Admin kimliği, Vercel planı ve senkronize saat konfigürasyonunu doğrulayın. Kapanış cron'u UTC 19:00 / TRT 22:00.
7. Kullanıcıların eski bağlantıları ve açık masa/ihbar durumlarıyla geriye dönük uyumluluğu tamamlayıp ondan sonra sürümü aşamalı yayımlayın.

## Gizli dosyalar

Kullanıcının yüklediği orijinal ZIP `.env`, `.git`, Windows `node_modules` ve `dist` içeriyordu. Bu teslim ZIP'i bunları **içermez**. `.env.example` ve `.firebaserc` yalnızca proje yapılandırmasıdır; hiçbir gizli sunucu anahtarı bu çalışma paketine kopyalanmamıştır. Vercel/Firebase kayıtlarına ve basılı QR değerlerine bu hazırlık sırasında müdahale edilmemiştir.
