import json, sys

path = '/var/www/menuplanning/server/db.json'

with open(path, 'r') as f:
    content = f.read()

replacements = [
    ('ET VE TAVUK IZGARA KÖŞESİ', 'IZGARA KÖŞESİ'),
    ('ET TAVUK IZGARA KÖŞESİ',    'IZGARA KÖŞESİ'),
    ('KESİM SUNUM KÖŞESİ',        'KESİM & SUNUM KÖŞESİ'),
    ('KESİM KÖŞESİ',              'KESİM & SUNUM KÖŞESİ'),
    ('ARA SICAK VE SEBZE YEMEKLERİ', 'ARA SICAK & SEBZE YEMEKLERİ'),
    ('ARASICAK VE SEBZE YEMEKLERİ',  'ARA SICAK & SEBZE YEMEKLERİ'),
    ('KIZARTMALAR ÇEŞİTLERİ',     'KIZARTMA ÇEŞİTLERİ'),
    ('ZEYTİN VE TURŞU ÇEŞİTLERİ','ZEYTİN & TURŞU ÇEŞİTLERİ'),
    ('TURŞULAR / ZEYTİNLER',      'ZEYTİN & TURŞU ÇEŞİTLERİ'),
    ('SOĞUK ZEYTİNYAĞLI DOLMA ÇEŞİTLERİ', 'ZEYTİNYAĞLI DOLMA ÇEŞİTLERİ'),
    ('İŞTAH AÇICI MEZELER',                'İŞTAH AÇICI MEZE ÇEŞİTLERİ'),
    ('İŞTAH AÇICI SOĞUK MEZE ÇEŞİTLERİ',  'İŞTAH AÇICI MEZE ÇEŞİTLERİ'),
    ('SOĞUK İŞTAH AÇICI MEZE ÇEŞİTLERİ',  'İŞTAH AÇICI MEZE ÇEŞİTLERİ'),
]

total = 0
for old, new in replacements:
    count = content.count(old)
    if count:
        content = content.replace(old, new)
        print(f'  {count}x  {old}  →  {new}')
        total += count

with open(path, 'w') as f:
    f.write(content)

print(f'\nToplam {total} değişiklik uygulandı.')
