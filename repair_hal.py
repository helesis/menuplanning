import json, re, urllib.request, urllib.parse, http.cookiejar

DB_PATH = '/var/www/menuplanning/server/db.json'
PAGE = 'https://www.antalya.bel.tr/tr/halden-gunluk-fiyatlar'
API  = 'https://www.antalya.bel.tr/tr/seolink/VueData/GetVueData'
REGION = '67b1db61b752f39216d8392d'
REGION_NAME = 'Antalya Merkez'
PAGEID = '67863b6f3206e6473c59e2e8'
DBFIND = json.dumps([
  {"field":"urun_adi","wherecluse":"sorting","fieldValue":"Asc","pageparamsid":"Asc","isrequest":"False","fieldtype":"string"},
  {"field":"tarih","wherecluse":"=","fieldValue":"fiyattarih","pageparamsid":"fiyattarih","isrequest":"True","fieldtype":"string"},
  {"field":"hal_isimleri","wherecluse":"=","fieldValue":"halyerleri","pageparamsid":"halyerleri","isrequest":"True","fieldtype":"string"},
  {"field":"en_dusuk_fiyat_sayi","wherecluse":"!=","fieldValue":"0","pageparamsid":"0","isrequest":"false","fieldtype":"long"},
])
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

DATES = ['2026-06-03','2026-06-04','2026-06-05','2026-06-06','2026-06-07','2026-06-08','2026-06-09','2026-06-10']

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [('User-Agent', UA)]
page = opener.open(PAGE, timeout=30).read().decode('utf-8', 'ignore')
token = re.search(r"__RequestVerificationToken[\"'][^>]*value=[\"']([A-Za-z0-9_\-]+)", page).group(1)

def fetch(date_iso):
    rq = json.dumps({'halyerleri': REGION, 'fiyattarih': date_iso})
    body = urllib.parse.urlencode({
        '__RequestVerificationToken': token,
        'colllection': 'MarketPrices', 'lang': '1', 'dateformat': '',
        'dbfind': DBFIND, 'pageid': PAGEID, 'requestquery': rq,
        'collectiontype': '0', 'relationcollection': '', 'collectionfunction': '',
        'seolink': 'halden-gunluk-fiyatlar',
        'sourcetablerefcombobox': '', 'destinationtablerefcombobox': '',
        'tablerefselectprojectionfield': '', 'isexitingcontrolrequest': 'false',
    }).encode()
    req = urllib.request.Request(API, data=body, headers={
        'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest', 'Referer': PAGE,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    })
    raw = json.loads(opener.open(req, timeout=30).read().decode())
    if not raw.get('issuccess'):
        return None
    prods = json.loads(raw['data']).get('products', [])
    # Sunucu koduyla aynı doğrulama: sadece istenen tarihle eşleşen kayıtlar
    wanted = date_iso.replace('-', '')
    prods = [p for p in prods if p.get('tarih') and str(p['tarih'])[:8] == wanted]
    items = []
    for p in prods:
        if not p.get('urun_adi'):
            continue
        items.append({
            'name':  p['urun_adi'],
            'low':   p['en_dusuk_fiyat'] if isinstance(p.get('en_dusuk_fiyat'), str) else str(p.get('en_dusuk_fiyat_sayi') or ''),
            'high':  p['en_yuksek_fiyat'] if isinstance(p.get('en_yuksek_fiyat'), str) else str(p.get('en_yuksek_fiyat_sayi') or ''),
            'lowN':  p['en_dusuk_fiyat_sayi'] if isinstance(p.get('en_dusuk_fiyat_sayi'), (int, float)) else None,
            'highN': p['en_yuksek_fiyat_sayi'] if isinstance(p.get('en_yuksek_fiyat_sayi'), (int, float)) else None,
            'unit':  (p.get('birim_adi_combobox') or {}).get('birim_adi') or p.get('refUnitId') or '',
        })
    return items

from datetime import datetime, timezone
now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

db = json.load(open(DB_PATH))
hal = db.setdefault('halPrices', [])
by_date = {e['date']: e for e in hal}

for d in DATES:
    items = fetch(d)
    if items:
        if d in by_date:
            by_date[d]['items'] = items
            by_date[d]['syncedAt'] = now_iso
            print(f'{d}: GÜNCELLENDİ ({len(items)} ürün)')
        else:
            hal.append({'date': d, 'region': REGION_NAME, 'syncedAt': now_iso, 'items': items})
            print(f'{d}: EKLENDİ ({len(items)} ürün)')
    else:
        if d in by_date:
            hal.remove(by_date[d])
            print(f'{d}: gerçek veri yok → sahte kayıt SİLİNDİ')
        else:
            print(f'{d}: veri yok (yayınlanmamış/tatil), atlandı')

with open(DB_PATH, 'w') as f:
    json.dump(db, f, ensure_ascii=False, indent=2)
print('\ndb.json kaydedildi.')
