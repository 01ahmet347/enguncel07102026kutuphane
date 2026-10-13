# Cihazlar kapalıyken 5 dakikalık ihbarların değerlendirilmesi

`api/cron-expire.js`, sunucudaki `sgmDesks` koleksiyonundan süresi dolmuş rapor ve rezervasyonları güvenilir sunucu saatine göre atomik olarak işler. İstek yalnızca `Authorization: Bearer <CRON_SECRET>` ile kabul edilir. Aynı ihbar iki kez ceza yazmaz. Ancak bu endpoint **tek başına kendiliğinden zamanlanmaz**.

**Vercel Hobby:** Projede yer alan günlük kapanış cron'u (`0 19 * * *`) kullanılabilir; 1 dakikada bir ayrı cron eklemek plan sınırları nedeniyle Hobby için uygun olmayabilir. Hızlı ihbar işlemlerini güvenilir kılmak için Vercel Pro veya bu endpoint'i en fazla 1 dakikada bir çağıran güvenilir dış zamanlayıcı gerekir. Böyle bir zamanlayıcı olmadan, tüm cihazlar kapalıyken ihbarın 5. dakikanın hemen ardından değerlendirilmesi garanti edilemez.

**Vercel Pro örneği:** `vercel.json` dosyasına aşağıdaki ek cron tanımını elle ekleyin (mevcut günlük cron'u silmeyin): `{"path":"/api/cron-expire","schedule":"* * * * *"}`. Bu örnek pakette etkinleştirilmemiştir, çünkü mevcut Vercel planınız bilinmiyor. Cron dakikasına kesin çalışma garantisi vermez. Sınır anında QR taraması ile ihbar süresi çatışırsa Firestore transaction sonucu belirler.

Canlıya geçmeden önce CRON_SECRET, Firebase Admin ortam değişkenleri, Firestore emülatörü ve gerçek zamanlayıcı birlikte test edilmelidir. Günlük 22:00 kapanışından sonra hiçbir geç ihbar cezası yazılmamalıdır.
