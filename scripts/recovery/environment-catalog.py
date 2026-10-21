"""Recover exact Addressables dependency bundles from the supplied APK.

The catalog is parsed, rather than guessing dependency names. No downloads.
"""
import base64, hashlib, json, pathlib, struct, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
APK = ROOT / 'reference/subway-surfers-3.61.0.apk'
OUT = ROOT / 'reference/recovered-environment'
OUT.mkdir(exist_ok=True)
(OUT / 'bundles').mkdir(exist_ok=True)
z = zipfile.ZipFile(APK)
catalog_bytes = z.read('assets/aa/catalog.json')
c = json.loads(catalog_bytes)
k = base64.b64decode(c['m_KeyDataString'])
b = base64.b64decode(c['m_BucketDataString'])
e = base64.b64decode(c['m_EntryDataString'])
buckets = []
pos = 4
for i in range(struct.unpack_from('<i', b)[0]):
    off, n = struct.unpack_from('<ii', b, pos)
    pos += 8
    ix = list(struct.unpack_from('<' + 'i' * n, b, pos))
    pos += n * 4
    if k[off] == 0:
        length = struct.unpack_from('<i', k, off + 1)[0]
        key = k[off + 5:off + 5 + length].decode('utf8')
    else:
        key = {'serializedType': k[off], 'offset': off}
    buckets.append({'key': key, 'entries': ix})
entries = [struct.unpack_from('<7i', e, 4 + i * 28)
           for i in range(struct.unpack_from('<i', e)[0])]

seeds = [i for i, x in enumerate(buckets)
         if isinstance(x['key'], str) and (
             x['key'] == 'irelandspring_config' or
             any(t in x['key'].lower() for t in (
                 'ui_spriteatlas_', 'logo_subway_surfers_',
                 'ui_common_textures_', 'slice_mainmenu_', 'slice_pause_',
                 'core_route_config_', 'slice_run_', 'ui_run_view_',
                 'core_game_config_core_camera_', 'core_game_config_core_character_',
                 'mainrunner', 'sharedscene')))]
selected = set()
def add_entry(index):
    if index in selected:
        return
    selected.add(index)
    dep = entries[index][2]
    if dep >= 0:
        for child in buckets[dep]['entries']:
            add_entry(child)
for seed in seeds:
    for index in buckets[seed]['entries']:
        add_entry(index)
members = []
for index in sorted(selected):
    entry = entries[index]
    internal_id = c['m_InternalIds'][entry[0]]
    if not internal_id.endswith('.bundle'):
        continue
    member = 'assets/aa/' + internal_id.split('RuntimePath}/', 1)[1]
    raw = z.read(member)
    destination = OUT / 'bundles' / pathlib.Path(member).name
    destination.write_bytes(raw)
    members.append({'entry': index, 'catalogKey': buckets[entry[5]]['key'],
                    'member': member, 'bytes': len(raw),
                    'sha256': hashlib.sha256(raw).hexdigest(),
                    'extracted': str(destination.relative_to(ROOT))})
manifest = {'format': 'subway-addressables-dependency-recovery-1',
            'sourceApk': str(APK.relative_to(ROOT)),
            'apkSha256': hashlib.sha256(APK.read_bytes()).hexdigest(),
            'catalogMember': 'assets/aa/catalog.json',
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'seeds': [buckets[i] for i in seeds], 'bundles': members,
            'thirdParty': 'Original Subway Surfers assets; SYBO/Kiloo and respective rights holders. Local reference recovery.'}
(OUT / 'catalog-dependencies.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'seeds': len(seeds), 'bundles': len(members),
                  'bytes': sum(x['bytes'] for x in members)}, indent=2))
