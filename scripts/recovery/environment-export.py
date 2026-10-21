"""Export original Subway Surfers environment geometry and UI to portable data.

Run with .tools/unity-python/bin/python. Coordinates, triangle winding, UVs and
transforms remain in Unity space. Large Unity path IDs are always string IDs.
"""
import collections, hashlib, json, math, pathlib, re
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler
from UnityPy.classes.PPtr import PPtr

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'reference/recovered-environment'
OUT = ROOT / 'shared/recovered/environment'
for d in (OUT, OUT / 'textures', OUT / 'sprites'):
    d.mkdir(exist_ok=True)
provenance = json.loads((SOURCE / 'catalog-dependencies.json').read_text())
env = UnityPy.load(*[str(ROOT / x['extracted']) for x in provenance['bundles']])
readers = {}
files = {}
for obj in env.objects:
    ident = f'{obj.assets_file.name}:{obj.path_id}'
    readers[ident] = obj
    files[obj.assets_file.name.lower()] = obj.assets_file
trees = {}
errors = []
unresolved = collections.Counter()

def oid(obj):
    return f'{obj.assets_file.name}:{obj.path_id}'

def ptr(obj, value):
    if not value or not value.get('m_PathID'):
        return None
    fid = value['m_FileID']
    target = obj.assets_file.name if not fid else obj.assets_file.externals[fid - 1].path.rsplit('/', 1)[-1]
    ident = f'{target}:{value["m_PathID"]}'
    if ident not in readers:
        unresolved[ident] += 1
    return ident

def tree(obj):
    key = oid(obj)
    if key not in trees:
        trees[key] = obj.read_typetree()
    return trees[key]

def normal(obj, value):
    if isinstance(value, dict):
        if set(value) == {'m_FileID', 'm_PathID'}:
            target = ptr(obj, value)
            return {'$ref': target} if target else None
        return {k: normal(obj, v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [normal(obj, x) for x in value]
    if isinstance(value, bytes):
        return {'bytes': len(value), 'sha256': hashlib.sha256(value).hexdigest()}
    if isinstance(value, float) and not math.isfinite(value):
        return str(value)
    return value

def xyz(v):
    return [v.get(x, 0) for x in ('x', 'y', 'z')]

def rgba(v):
    return [v.get(x, 1) for x in ('r', 'g', 'b', 'a')]

def filename(name, ident, suffix='.png'):
    return re.sub(r'[^a-zA-Z0-9_.-]+', '_', name) + '_' + hashlib.sha1(ident.encode()).hexdigest()[:8] + suffix

def flat(value, size=None):
    return [float(x) for item in (value or []) for x in (item[:size] if size else item)]

def finite_json(value):
    if isinstance(value, dict):
        return {k: finite_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [finite_json(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value):
        return str(value)
    return value

def go_for(ident):
    if not ident or ident not in readers:
        return None
    obj = readers[ident]
    if obj.type.name == 'GameObject':
        return ident
    return ptr(obj, tree(obj).get('m_GameObject'))

def name_for(ident):
    return tree(readers[ident]).get('m_Name', '') if ident in readers else ''

textures, sprites, meshes, materials, nodes = {}, {}, {}, {}, {}
atlases = {obj.read().m_Name: obj for obj in env.objects if obj.type.name == 'SpriteAtlas'}
for obj in env.objects:
    typ, ident = obj.type.name, oid(obj)
    if typ not in ('Texture2D', 'Sprite', 'Mesh', 'Material'):
        continue
    try:
        data = obj.read()
        name = data.m_Name
        if typ == 'Texture2D':
            file = 'textures/' + filename(name, ident)
            data.image.save(OUT / file)
            textures[ident] = {'name': name, 'file': file, 'width': data.m_Width,
                               'height': data.m_Height, 'unityTextureFormat': data.m_TextureFormat}
        elif typ == 'Sprite':
            file = 'sprites/' + filename(name, ident)
            # Unity stores atlas sprite aliases in prefab bundles with a null
            # local pointer. Resolve the shipped atlas tag across dependency
            # bundles, exactly as Addressables does at runtime.
            if not data.m_SpriteAtlas and data.m_AtlasTags:
                atlas = atlases.get(data.m_AtlasTags[0])
                if atlas:
                    data.m_SpriteAtlas = PPtr(m_FileID=0, m_PathID=atlas.path_id,
                                             assetsfile=atlas.assets_file)
            image = data.image
            image.save(OUT / file)
            sprites[ident] = {'name': name, 'file': file, 'width': image.width,
                              'height': image.height, 'rect': normal(obj, tree(obj)['m_Rect']),
                              'pivot': normal(obj, tree(obj).get('m_Pivot')),
                              'border': normal(obj, tree(obj).get('m_Border'))}
        elif typ == 'Mesh':
            handler = MeshHandler(data)
            handler.process()
            meshes[ident] = {'name': name, 'positions': flat(handler.m_Vertices, 3),
                             'normals': flat(handler.m_Normals, 3),
                             'uv': flat(handler.m_UV0, 2), 'colors': flat(handler.m_Colors, 4),
                             'submeshes': [{'indices': [int(i) for tri in group for i in tri]}
                                           for group in handler.get_triangles()],
                             'bounds': normal(obj, tree(obj)['m_LocalAABB'])}
        elif typ == 'Material':
            t = tree(obj)
            saved = t['m_SavedProperties']
            tex = {key: {'texture': ptr(obj, v['m_Texture']),
                         'scale': [v['m_Scale']['x'], v['m_Scale']['y']],
                         'offset': [v['m_Offset']['x'], v['m_Offset']['y']]}
                   for key, v in saved['m_TexEnvs']}
            colors = {key: rgba(v) for key, v in saved['m_Colors']}
            floats = dict(saved['m_Floats'])
            materials[ident] = {'name': name, 'shader': ptr(obj, t['m_Shader']),
                                'textures': tex, 'color': colors.get('_Color', [1, 1, 1, 1]),
                                'colors': colors, 'floats': floats,
                                'keywords': t.get('m_ValidKeywords', []),
                                'renderQueue': t.get('m_CustomRenderQueue', -1)}
    except Exception as exc:
        errors.append({'id': ident, 'type': typ, 'error': str(exc)})
print('resources', len(meshes), 'meshes', len(textures), 'textures', len(sprites), 'sprites', flush=True)

# The portable scene graph contains 3D Transforms; RectTransforms remain in UI
# data below so their native anchors/positions can be inspected independently.
transforms = {}
for obj in env.objects:
    if obj.type.name == 'Transform':
        t = tree(obj)
        transforms[oid(obj)] = ptr(obj, t['m_GameObject'])
for tid, gid in transforms.items():
    obj = readers[tid]
    t = tree(obj)
    go = readers[gid]
    gt = tree(go)
    children = [transforms.get(ptr(obj, x)) for x in t['m_Children']]
    node = {'name': gt['m_Name'], 'position': xyz(t['m_LocalPosition']),
            'rotation': [t['m_LocalRotation'][a] for a in ('x', 'y', 'z', 'w')],
            'scale': xyz(t['m_LocalScale']), 'children': [c for c in children if c],
            'parent': transforms.get(ptr(obj, t['m_Father'])),
            'mesh': None, 'materials': [], 'active': bool(gt['m_IsActive']),
            'rendererEnabled': True, 'components': []}
    for component in gt['m_Component']:
        cid = ptr(go, component['component'])
        if not cid or cid not in readers:
            continue
        cobj = readers[cid]
        ct = tree(cobj)
        ctyp = cobj.type.name
        if ctyp == 'MeshFilter':
            node['mesh'] = ptr(cobj, ct['m_Mesh'])
        elif ctyp in ('MeshRenderer', 'SkinnedMeshRenderer'):
            node['materials'] = [ptr(cobj, x) for x in ct['m_Materials']]
            node['rendererEnabled'] = bool(ct.get('m_Enabled', True))
            if ctyp == 'SkinnedMeshRenderer':
                node['mesh'] = ptr(cobj, ct['m_Mesh'])
        elif ctyp not in ('Transform',):
            entry = {'id': cid, 'type': ctyp, 'data': normal(cobj, ct)}
            if ctyp == 'MonoBehaviour':
                script = ptr(cobj, ct.get('m_Script'))
                entry['script'] = name_for(script)
                if '_asset' in ct:
                    node['themedAsset'] = ptr(cobj, ct['_asset'])
                if '_entityType' in ct:
                    node['entityType'] = ptr(cobj, ct['_entityType'])
            node['components'].append(entry)
    nodes[gid] = node

# Record highest-detail membership, since Unity LODGroup normally suppresses
# lower detail children even when their serialized m_IsActive flag is true.
for obj in env.objects:
    if obj.type.name != 'LODGroup':
        continue
    t = tree(obj)
    if not t.get('m_Enabled', True):
        continue
    for level, lod in enumerate(t['m_LODs']):
        for item in lod['renderers']:
            gid = go_for(ptr(obj, item['renderer']))
            if gid in nodes:
                nodes[gid]['lodLevel'] = min(level, nodes[gid].get('lodLevel', level))

config_objects = {}
ui_objects = {}
theme_id = None
track_configs = []
for obj in env.objects:
    typ = obj.type.name
    if typ not in ('MonoBehaviour', 'RectTransform'):
        continue
    t, ident = tree(obj), oid(obj)
    if typ == 'MonoBehaviour' and not ptr(obj, t.get('m_GameObject')):
        config_objects[ident] = {'name': t.get('m_Name', ''), 'data': normal(obj, t)}
    if t.get('m_Name') == 'IrelandSpring_Theme':
        theme_id = ident
    if typ == 'MonoBehaviour' and '_configurations' in t and t['_configurations'] and 'TrackType' in t['_configurations'][0]:
        track_configs.append({'root': go_for(ident), 'variants': [
            {'trackType': v['TrackType'], 'mesh': ptr(obj, v['MeshLOD0']),
             'meshLOD1': ptr(obj, v['MeshLOD1']),
             'materials': [ptr(obj, x) for x in v['Materials']]}
            for v in t['_configurations']]})
    if typ == 'RectTransform':
        ui_objects[ident] = normal(obj, t)

pools = {}
def visit_theme(ident):
    obj = readers[ident]
    t = tree(obj)
    parent = ptr(obj, t.get('_parent'))
    if parent:
        visit_theme(parent)
    for group in t.get('_groups', []):
        for ent in group['Entries']:
            key = ptr(obj, ent['Type'])
            pools[key] = {'group': group['Name'], 'typeName': name_for(key), 'typeId': key,
                          'prefabs': [go_for(ptr(obj, p)) for p in ent['Prefabs']]}
    for ent in t.get('_parentOverride', []):
        key = ptr(obj, ent['Type'])
        pools[key] = {**pools.get(key, {'group': 'Override', 'typeName': name_for(key), 'typeId': key}),
                      'prefabs': [go_for(ptr(obj, p)) for p in ent['Prefabs']]}
if theme_id:
    visit_theme(theme_id)
theme_config = next((v['data'] for v in config_objects.values() if v['name'] == 'IrelandSpring_Config'), {})
for mat in materials.values():
    main_id = mat['textures'].get('_MainTex', {}).get('texture')
    mat['mainTexture'] = textures.get(main_id, {}).get('file')
    mat['vertexColors'] = bool(mat['floats'].get('_HasVertexColors', 0))
    mat['transparent'] = mat['floats'].get('FADE_MODE', 0) != 0

bundle_map = {}
for member in provenance['bundles']:
    loaded = env.files[str(ROOT / member['extracted'])]
    for cab, data in loaded.files.items():
        if cab.lower() in files:
            bundle_map[cab] = {'member': member['member'], 'bundleSha256': member['sha256']}

result = {'format': 'subway-original-environment-1',
          'coordinateSystem': 'unity-left-handed-y-up-z-forward',
          'thirdParty': provenance['thirdParty'], 'apkSha256': provenance['apkSha256'],
          'meshes': meshes, 'materials': materials, 'textures': textures,
          'nodes': nodes, 'roots': [gid for gid, v in nodes.items() if not v['parent']],
          'pools': list(pools.values()), 'trackConfigurations': track_configs,
          'theme': theme_config, 'sourceFiles': bundle_map,
          'limitations': ['Unity shader bytecode is retained in source bundles; portable materials expose their serialized properties.',
                          'Particle simulation, Animator state machines and native method behavior are not implemented by this asset export.']}
(OUT / 'environment.json').write_text(json.dumps(finite_json(result), separators=(',', ':'), allow_nan=False) + '\n')
(OUT / 'ui.json').write_text(json.dumps({'format': 'subway-original-ui-1', 'sprites': sprites,
    'textures': textures, 'rectTransforms': ui_objects}, separators=(',', ':'), allow_nan=False) + '\n')
(OUT / 'configs.json').write_text(json.dumps(config_objects, separators=(',', ':'), allow_nan=False) + '\n')
(OUT / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
summary = {'meshes': len(meshes), 'materials': len(materials), 'textures': len(textures),
           'sprites': len(sprites), 'nodes': len(nodes), 'roots': len(result['roots']),
           'pools': len(pools), 'trackConfigurations': len(track_configs),
           'configs': len(config_objects), 'errors': errors,
           'unresolvedReferences': dict(unresolved)}
(SOURCE / 'export-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({k: v for k, v in summary.items() if k not in ('errors', 'unresolvedReferences')}, indent=2))
print('errors', len(errors), 'unresolved refs', len(unresolved))
