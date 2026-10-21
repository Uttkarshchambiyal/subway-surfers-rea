"""Recover the supplied APK's Jake meshes, skin, texture, and generic animation.

Run with .tools/unity-python/bin/python scripts/recovery/character-export.py.
UnityPy decodes serialized Unity objects, mesh compression, and ETC textures.
This script converts Unity's handedness, samples the shipped clip curves, and
exports ordinary glTF2 plus the same arrays as portable JSON. No replacement
geometry or authored poses are used.
"""
from __future__ import annotations

import bisect
import hashlib
import json
import math
import pathlib
import struct
import zlib

import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler

ROOT = pathlib.Path(__file__).resolve().parents[2]
REF = ROOT / "reference/recovered-character"
OUT = ROOT / "shared/recovered/character"
OUT.mkdir(parents=True, exist_ok=True)
ENV = UnityPy.load(*map(str, sorted((REF / "bundles").glob("*.bundle"))))


def vec(v):
    return [getattr(v, c) for c in ("xyzw" if hasattr(v, "w") else "xyz")]


def pos(v):
    return [v[0], v[1], -v[2]]


def quat(v):
    q = [-v[0], -v[1], v[2], v[3]]
    mag = math.sqrt(sum(c * c for c in q))
    return [c / mag for c in q] if mag > 1e-12 else [0, 0, 0, 1]


def euler_quat(v):
    # Unity Euler order is Z-X-Y, equivalently qY * qX * qZ.
    x, y, z = [math.radians(c) / 2 for c in v]
    sx, cx, sy, cy, sz, cz = math.sin(x), math.cos(x), math.sin(y), math.cos(y), math.sin(z), math.cos(z)
    return [cy*sx*cz + sy*cx*sz, sy*cx*cz - cy*sx*sz, cy*cx*sz - sy*sx*cz, cy*cx*cz + sy*sx*sz]


JAKEFILE = next(o.assets_file for o in ENV.objects if o.type.name == "Mesh" and o.read().m_Name == "jake_Mesh")
TRANSFORMS = {o.path_id: o.read() for o in JAKEFILE.objects.values() if o.type.name == "Transform"}
TRANSFORM_NAMES = {i: t.m_GameObject.deref_parse_as_object().m_Name for i, t in TRANSFORMS.items()}
AVATAR_ID = next(i for i, n in TRANSFORM_NAMES.items() if n == "avatar_jake")


def path_for(i):
    if i == AVATAR_ID:
        return ""
    t = TRANSFORMS[i]
    parent = t.m_Father.m_PathID
    if parent not in TRANSFORMS:
        return None
    prefix = path_for(parent)
    return None if prefix is None else "/".join(filter(None, [prefix, TRANSFORM_NAMES[i]]))


PATHS = {i: path_for(i) for i in TRANSFORMS}
INCLUDED = [i for i in TRANSFORMS if PATHS[i] is not None]
NODE_BY_ID = {i: j + 1 for j, i in enumerate(INCLUDED)}
NODE_BY_HASH = {zlib.crc32(PATHS[i].encode()): NODE_BY_ID[i] for i in INCLUDED}
NODES = [{"name": "RecoveredJake", "scale": [0.2, 0.2, 0.2], "children": [NODE_BY_ID[AVATAR_ID]]}]
for i in INCLUDED:
    t = TRANSFORMS[i]
    children = [NODE_BY_ID[p.m_PathID] for p in t.m_Children if p.m_PathID in NODE_BY_ID]
    n = {"name": TRANSFORM_NAMES[i], "translation": pos(vec(t.m_LocalPosition)),
         "rotation": quat(vec(t.m_LocalRotation)), "scale": vec(t.m_LocalScale),
         "extras": {"unityPathID": str(i), "unityPath": PATHS[i]}}
    if children:
        n["children"] = children
    NODES.append(n)

GLTF = {"asset": {"version": "2.0", "generator": "Local APK UnityPy recovery; character-export.py"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": NODES, "meshes": [], "skins": [],
        "materials": [{"name": "jake_outfit0_mat", "pbrMetallicRoughness": {
            "baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 1},
            "extensions": {"KHR_materials_unlit": {}}, "doubleSided": False}],
        "extensionsUsed": ["KHR_materials_unlit"], "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
        "textures": [{"sampler": 0, "source": 0}], "images": [{"uri": "jake_outfit0_tex.png"}],
        "bufferViews": [], "accessors": [], "animations": []}
BUFFER = bytearray()


def accessor(data, width, typ="f", target=None, bounds=False):
    global BUFFER
    while len(BUFFER) % 4:
        BUFFER.append(0)
    flat = [c for row in data for c in row] if width > 1 else list(data)
    start = len(BUFFER)
    BUFFER.extend(struct.pack("<" + typ * len(flat), *flat))
    view = {"buffer": 0, "byteOffset": start, "byteLength": len(BUFFER) - start}
    if target:
        view["target"] = target
    vi = len(GLTF["bufferViews"])
    GLTF["bufferViews"].append(view)
    a = {"bufferView": vi, "componentType": {"f": 5126, "H": 5123, "I": 5125}[typ],
         "count": len(data), "type": {1: "SCALAR", 2: "VEC2", 3: "VEC3", 4: "VEC4", 16: "MAT4"}[width]}
    if bounds:
        rows = data if width > 1 else [[v] for v in data]
        a["min"] = [min(r[j] for r in rows) for j in range(width)]
        a["max"] = [max(r[j] for r in rows) for j in range(width)]
    ai = len(GLTF["accessors"])
    GLTF["accessors"].append(a)
    return ai


MESHES_JSON = []
WEIGHT_CORRECTIONS = []
for obj in JAKEFILE.objects.values():
    if obj.type.name == "Texture2D" and obj.read().m_Name.startswith("jake_outfit"):
        tex = obj.read()
        tex.image.save(OUT / (tex.m_Name + ".png"))
    if obj.type.name != "SkinnedMeshRenderer":
        continue
    renderer = obj.read()
    mesh = renderer.m_Mesh.deref_parse_as_object()
    if mesh.m_Name not in ["jake_Mesh", "jake_head"]:
        continue
    handler = MeshHandler(mesh)
    handler.process()
    vertices = [pos(v) for v in handler.m_Vertices]
    normal_source = handler.m_Normals
    if not normal_source:
        normal_source = [[0.0, 0.0, 0.0] for _ in handler.m_Vertices]
        for group in handler.get_triangles():
            for ia, ib, ic in group:
                a, b, c = [handler.m_Vertices[i] for i in [ia, ib, ic]]
                u, v = [[p[i] - a[i] for i in range(3)] for p in [b, c]]
                normal = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
                for i in [ia, ib, ic]:
                    normal_source[i] = [a+b for a, b in zip(normal_source[i], normal)]
        normal_source = [[c/(math.sqrt(sum(v*v for v in n)) or 1) for c in n] for n in normal_source]
    normals = [pos(v) for v in normal_source]
    uv = [[v[0], 1-v[1]] for v in handler.m_UV0]
    weights = [list(v) for v in handler.m_BoneWeights]
    # UnityPy 1.25.4 MeshHandler.decompress_mesh computes the implicit fourth
    # compressed weight as 1 - integerSum (line 611). The first three already
    # hold packed integerWeight/31, so their exact residual is the fourth.
    # Preserve the source values and repair this decoder arithmetic only.
    for vertex, w in enumerate(weights):
        if w[3] < 0:
            before = w[3]
            w[3] = 1.0 - sum(w[:3])
            WEIGHT_CORRECTIONS.append({"mesh": mesh.m_Name, "vertex": vertex, "decoderValue": before,
                                       "sourceDerivedResidual": w[3]})
        assert all(c >= -1e-6 for c in w) and abs(sum(w) - 1) < 1e-5, (mesh.m_Name, vertex, w)
    joints = [list(v) for v in handler.m_BoneIndices]
    bind = [[getattr(m, f"e{r}{c}") * (-1 if (r == 2) != (c == 2) else 1)
             for c in range(4) for r in range(4)] for m in mesh.m_BindPose]
    joint_nodes = [NODE_BY_ID[p.m_PathID] for p in renderer.m_Bones]
    skin = {"name": mesh.m_Name + "_skin", "joints": joint_nodes,
            "inverseBindMatrices": accessor(bind, 16),
            "skeleton": NODE_BY_ID[next(i for i in INCLUDED if TRANSFORM_NAMES[i] == "Root")]}
    skin_index = len(GLTF["skins"])
    GLTF["skins"].append(skin)
    attrs = {"POSITION": accessor(vertices, 3, target=34962, bounds=True),
             "NORMAL": accessor(normals, 3, target=34962),
             "TEXCOORD_0": accessor(uv, 2, target=34962),
             "JOINTS_0": accessor(joints, 4, "H", target=34962),
             "WEIGHTS_0": accessor(weights, 4, target=34962)}
    indices = [[c for tri in group for c in reversed(tri)] for group in handler.get_triangles()]
    glmesh = {"name": mesh.m_Name, "primitives": [
        {"attributes": attrs, "indices": accessor(idx, 1, "H", target=34963), "material": 0} for idx in indices]}
    mesh_index = len(GLTF["meshes"])
    GLTF["meshes"].append(glmesh)
    go = renderer.m_GameObject.deref_parse_as_object()
    transform_id = next(i for i in INCLUDED if TRANSFORMS[i].m_GameObject.m_PathID == renderer.m_GameObject.m_PathID)
    NODES[NODE_BY_ID[transform_id]].update(mesh=mesh_index, skin=skin_index)
    MESHES_JSON.append({"name": mesh.m_Name, "node": NODE_BY_ID[transform_id], "positions": vertices,
                        "normals": normals, "uv": uv, "joints": joints, "weights": weights,
                        "indices": indices, "boneNodes": joint_nodes, "inverseBindMatrices": bind,
                        "unityPathID": str(mesh.object_reader.path_id)})


def streamed_channels(stream):
    data = struct.pack("<" + "I" * len(stream["data"]), *stream["data"])
    offset = 0
    channels = {}
    while offset < len(data):
        time, count = struct.unpack_from("<fI", data, offset)
        offset += 8
        for _ in range(count):
            index, a, b, c, d = struct.unpack_from("<Iffff", data, offset)
            offset += 20
            channels.setdefault(index, []).append((time, a, b, c, d))
    return channels


def sample_stream(keys, time):
    at = bisect.bisect_right([k[0] for k in keys], time) - 1
    at = max(0, min(at, len(keys)-1))
    kt, a, b, c, d = keys[at]
    if kt < -1e20 or kt > 1e20:
        return d
    dt = time - kt
    return ((a * dt + b) * dt + c) * dt + d


SELECTED = ["run", "RunSlow", "RunNormal", "RunFast", "jump", "hangtime", "landing", "roll",
            "dodgeLeft", "dodgeRight", "stumble", "stumbleSideLeft", "stumbleSideRight",
            "death_lower", "death_upper", "death_movingTrain", "introRun", "idlePaint",
            "Jake_Breathe", "Jake_Look_01", "Jake_Look_02", "Jake_Come_on", "Jake_ScrollbarPose"]
SELECTED += ["h_skate_on", "h_run", "h_left", "h_right", "h_jump", "h_hangtime", "h_landing", "h_roll",
             "superRun", "Jetpack_forward", "Jetpack_forward_2", "Jetpack_changeLane_left", "Jackpack_changeLane_Right"]
ANIMATIONS_JSON = []
USED_CLIP_NAMES = set()
for obj in ENV.objects:
    if obj.type.name != "AnimationClip":
        continue
    clip = obj.read_typetree()
    source_name = clip["m_Name"]
    if source_name not in SELECTED:
        continue
    name = source_name
    if name in USED_CLIP_NAMES:
        name += "_variant"
    USED_CLIP_NAMES.add(name)
    muscle = clip["m_MuscleClip"]
    data = muscle["m_Clip"]["data"]
    stream = data["m_StreamedClip"]
    dense = data["m_DenseClip"]
    const = data["m_ConstantClip"]["data"]
    streams = streamed_channels(stream)
    sn, dn = stream["curveCount"], dense["m_CurveCount"]
    duration = muscle["m_StopTime"] - muscle["m_StartTime"]
    rate = max(30.0, clip["m_SampleRate"])
    frame_count = math.ceil(duration * rate) + 1
    times = [min(i/rate, duration) for i in range(frame_count)]

    def value(index, time):
        if index < sn:
            return sample_stream(streams[index], time)
        index -= sn
        if index < dn:
            frame = max(0.0, min((time-dense["m_BeginTime"]) * dense["m_SampleRate"], dense["m_FrameCount"]-1))
            lo, hi = int(frame), min(int(frame)+1, dense["m_FrameCount"]-1)
            a, b = dense["m_SampleArray"][lo*dn+index], dense["m_SampleArray"][hi*dn+index]
            return a + (b-a) * (frame-lo)
        return const[index-dn]

    samplers, channels, tracks, skipped = [], [], [], []
    time_accessor = accessor(times, 1, bounds=True)
    index = 0
    for binding in clip["m_ClipBindingConstant"]["genericBindings"]:
        attr = binding["attribute"]
        is_transform = binding.get("typeID", binding.get("classID")) == 4
        width = (4 if attr == 2 else 3) if is_transform and attr in [1, 2, 3, 4] else 1
        node = NODE_BY_HASH.get(binding["path"])
        start = index
        index += width
        if not is_transform or node is None or attr not in [1, 2, 3, 4]:
            skipped.append({"binding": binding, "reason": "Unity Animator parameter or source rig helper not present in Jake"})
            continue
        values = [[value(start+c, time + muscle["m_StartTime"]) for c in range(width)] for time in times]
        target = {1: "translation", 2: "rotation", 3: "scale", 4: "rotation"}[attr]
        if attr == 1:
            values = [pos(v) for v in values]
        elif attr == 2:
            values = [quat(v) for v in values]
        elif attr == 4:
            values = [quat(euler_quat(v)) for v in values]
        if target == "rotation":
            for i in range(1, len(values)):
                if sum(a*b for a, b in zip(values[i-1], values[i])) < 0:
                    values[i] = [-c for c in values[i]]
        if not all(math.isfinite(c) for v in values for c in v):
            raise ValueError((name, binding, "nonfinite sampled clip"))
        output = accessor(values, 4 if target == "rotation" else 3)
        channels.append({"sampler": len(samplers), "target": {"node": node, "path": target}})
        samplers.append({"input": time_accessor, "output": output, "interpolation": "LINEAR"})
        tracks.append({"node": node, "path": target, "values": values})
    expected = sn + dn + len(const)
    assert index == expected, (name, index, expected)
    exported = {"name": name, "duration": duration, "sampleRate": rate, "times": times,
                "tracks": tracks, "sourceName": source_name, "sourcePathID": str(obj.path_id), "sourceAssetFile": obj.assets_file.name,
                "skippedBindings": skipped, "sourceSampleRate": clip["m_SampleRate"],
                "sourceLoopTime": muscle.get("m_LoopTime", False)}
    ANIMATIONS_JSON.append(exported)
    GLTF["animations"].append({"name": name, "channels": channels, "samplers": samplers,
                                "extras": {"duration": duration, "sourcePathID": str(obj.path_id)}})
    print("Animation", name, "duration", round(duration, 3), "tracks", len(tracks), "skipped", len(skipped))

GLTF["buffers"] = [{"byteLength": len(BUFFER), "uri": "jake.bin"}]
(OUT / "jake.gltf").write_text(json.dumps(GLTF, separators=(",", ":")))
(OUT / "jake.bin").write_bytes(BUFFER)
portable = {"schema": "unity-recovered-skinned-character-v1", "coordinates": "right handed Y-up, forward -Z; Unity Z reflected; mesh and skeleton in source units; wrapper scale 0.2",
            "source": json.loads((REF / "bundle-provenance.json").read_text()),
            "texture": "jake_outfit0_tex.png", "nodes": NODES, "meshes": MESHES_JSON,
            "animations": ANIMATIONS_JSON,
            "decoderCorrections": WEIGHT_CORRECTIONS,
            "limitations": ["Original shaders are represented by unlit atlas material.",
                            "Unity Animator scalar parameters are recorded as skipped bindings; transform curves are decoded.",
                            "Dense clip interpolation and glTF tracks use linear interpolation; streamed source cubic coefficients are sampled at >=30 Hz."]}
(OUT / "jake.json").write_text(json.dumps(portable, separators=(",", ":")))
# Self-contained GLB alongside the human-readable glTF and portable JSON.
glb = json.loads(json.dumps(GLTF))
glb["buffers"][0].pop("uri")
while len(BUFFER) % 4:
    BUFFER.append(0)
png = (OUT / "jake_outfit0_tex.png").read_bytes()
image_offset = len(BUFFER)
BUFFER.extend(png)
image_view = len(glb["bufferViews"])
glb["bufferViews"].append({"buffer": 0, "byteOffset": image_offset, "byteLength": len(png)})
glb["images"] = [{"bufferView": image_view, "mimeType": "image/png"}]
glb["buffers"][0]["byteLength"] = len(BUFFER)
while len(BUFFER) % 4:
    BUFFER.append(0)
gjson = json.dumps(glb, separators=(",", ":")).encode()
gjson += b" " * (-len(gjson) % 4)
total = 12 + 8 + len(gjson) + 8 + len(BUFFER)
(OUT / "jake.glb").write_bytes(struct.pack("<III", 0x46546c67, 2, total) + struct.pack("<II", len(gjson), 0x4e4f534a) + gjson + struct.pack("<II", len(BUFFER), 0x004e4942) + BUFFER)
manifest = {"source": portable["source"], "tool": {"UnityPy": UnityPy.__version__},
            "meshCount": len(MESHES_JSON), "vertexCount": sum(len(m["positions"]) for m in MESHES_JSON),
            "boneCount": len(GLTF["skins"][0]["joints"]), "nodeCount": len(NODES),
            "decoderCorrections": WEIGHT_CORRECTIONS,
            "clips": [{k: a[k] for k in ["name", "duration", "sourcePathID", "sourceAssetFile"]} for a in ANIMATIONS_JSON],
            "exports": [{"file": p.name, "bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(OUT.iterdir()) if p.is_file() and p.name != "manifest.json"]}
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print("Exported", manifest["vertexCount"], "vertices", manifest["boneCount"], "bones", len(ANIMATIONS_JSON), "clips")
