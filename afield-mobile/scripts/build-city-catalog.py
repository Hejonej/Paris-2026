import pathlib,zipfile,json,re,sys
# Run from repository root with local GeoNames cities15000.zip and countryInfo.txt paths.
country={}
for line in pathlib.Path(sys.argv[2]).read_text().splitlines():
 if line and not line.startswith('#'):
  f=line.split('\t');country[f[0]]=f[4]
rows=[]
with zipfile.ZipFile(sys.argv[1]) as z:
 for line in z.read('cities15000.txt').decode().splitlines():
  f=line.split('\t');aliases=[x for x in f[3].split(',') if re.search('[가-힣]',x)]
  aliases=list(dict.fromkeys([f[1],f[2],*aliases]))
  rows.append([f[0],f[2] or f[1],country.get(f[8],f[8]),aliases,int(f[14])])
rows.sort(key=lambda x:-x[4])
p=pathlib.Path('afield-mobile/src/worldCities.ts');p.write_text('// GeoNames cities15000, CC BY 4.0. See assets/data/SOURCES.md.\nexport const worldRows: [string,string,string,string[],number][] = '+'JSON.parse('+json.dumps(json.dumps(rows,ensure_ascii=False,separators=(',',':')),ensure_ascii=False)+');\n')
print('World cities:',len(rows),'bytes:',p.stat().st_size)
p=pathlib.Path('afield-mobile/assets/data/SOURCES.md');p.parent.mkdir(parents=True,exist_ok=True);p.write_text('# City search data\n\nGeoNames cities15000.zip and countryInfo.txt, retrieved 2026-10-26.\nSource: https://download.geonames.org/export/dump/\nLicense: Creative Commons Attribution 4.0 https://creativecommons.org/licenses/by/4.0/\nAttribution: GeoNames https://www.geonames.org/\n\nDerived compact offline catalogue: English/ASCII name, country, original name and Korean alternate names, population for ranking. Existing curated aliases supplement it. Not every village or spelling is included; manual city/country entry remains available. Data is provided without warranty.\n')
