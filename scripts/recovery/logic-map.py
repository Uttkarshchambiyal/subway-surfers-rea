#!/usr/bin/env python3
"""Read-only IL2CPP v31 metadata/native registration mapping for supplied APK.

No target execution. Recovered names bind by codegen-module token table; field
offsets bind by metadata registration. Original files remain untouched.
"""
import argparse, hashlib, json, pathlib, re, struct, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'reference/recovered-logic'
META = ROOT / 'reference/native/global-metadata.dat'
ELF = ROOT / 'reference/native/libil2cpp.so'
mb = META.read_bytes()
eb = ELF.read_bytes()
names = ['stringLiteral','stringLiteralData','string','events','properties','methods','parameterDefaultValues','fieldDefaultValues','fieldAndParameterDefaultValueData','fieldMarshaledSizes','parameters','fields','genericParameters','genericParameterConstraints','genericContainers','nestedTypes','interfaces','vtableMethods','interfaceOffsets','typeDefinitions','images','assemblies','fieldRefs','referencedAssemblies','attributeData','attributeDataRange','unresolvedVirtualCallParameterTypes','unresolvedVirtualCallParameterRanges','windowsRuntimeTypeNames','windowsRuntimeStrings','exportedTypeDefinitions']
h = {n: struct.unpack_from('<II', mb, 8+i*8) for i,n in enumerate(names)}
assert struct.unpack_from('<II',mb) == (0xFAB11BAF,31)
def string(i):
    p = h['string'][0]+i
    return mb[p:mb.find(b'\0',p)].decode('utf-8',errors='replace')
def rows(n,fmt):
    o,s = h[n]; z = struct.calcsize(fmt)
    assert s % z == 0
    return [struct.unpack_from(fmt,mb,p) for p in range(o,o+s,z)]
fields = rows('fields','<IiI')
methods = rows('methods','<IiiiiiIHHHH')
params = rows('parameters','<IIi')
types = rows('typeDefinitions','<IIiiiiIIiiiiiiiiHHHHHHHHII')
assembly_image=next(i for i in rows('images','<IiiIiIiIiI') if string(i[0])=='Assembly-CSharp.dll')
assembly_start,assembly_count=assembly_image[2],assembly_image[3]
def in_assembly(ix):return assembly_start<=ix<assembly_start+assembly_count
sections = json.loads((ROOT/'reference/native/elf-map.json').read_text())['sections']
def off(va):
    for s in sections:
        if s['type']!=8 and s['va'] <= va < s['va']+s['size']:
            return s['off']+va-s['va']
    raise ValueError(hex(va))
rel={}
for s in sections:
    if s['type']==4:
        for p in range(s['off'],s['off']+s['size'],24):
            at,info,add=struct.unpack_from('<QQq',eb,p)
            if info&0xffffffff==1027: rel[at]=add
def u64(va):
    return rel.get(va,struct.unpack_from('<Q',eb,off(va))[0])
registration=0x46ba690
typeptr=u64(registration+56)
fieldptr=u64(registration+88)
codeptr=0x48a52b0
def native_type(index,depth=0):
    ptr=u64(typeptr+8*index)
    data,bits=struct.unpack_from('<QI',eb,off(ptr))
    enum=(bits>>16)&255
    primitive={1:'void',2:'bool',3:'char',4:'sbyte',5:'byte',6:'short',7:'ushort',8:'int',9:'uint',10:'long',11:'ulong',12:'float',13:'double',14:'string',24:'intptr',25:'uintptr',28:'object'}
    if enum in primitive: name=primitive[enum]
    elif enum in [17,18] and data<len(types):name=string(types[data][0])
    else:name='native-type-'+str(enum)+'-data-'+hex(data)
    return {'name':name,'enum':enum,'data':data,'attrs':hex(bits&65535),'pointer':hex(ptr),'byref':bool(bits&0x40000000)}
def typemap(ix):
    t=types[ix]
    try: fp=u64(fieldptr+8*ix)
    except (ValueError,struct.error):fp=0
    fs=[]
    for fi in range(t[8],t[8]+t[18]):
        f=fields[fi]
        try: fo=struct.unpack_from('<i',eb,off(fp)+(fi-t[8])*4)[0]
        except (ValueError,struct.error):fo=None
        fs.append({'name':string(f[0]),'offset':fo,'fieldIndex':fi,'nativeTypeIndex':f[1],'type':native_type(f[1]),'metadataOffset':h['fields'][0]+fi*12})
    ms=[]
    for mi in range(t[9],t[9]+t[16]):
        m=methods[mi]; token=m[6]; index=token&0xffffff
        address=u64(codeptr+(index-1)*8) if index and in_assembly(ix) else 0
        ps=[]
        for pi in range(m[4],m[4]+m[-1]):
            p=params[pi]
            ps.append({'name':string(p[0]),'type':native_type(p[2]),'index':pi})
        ms.append({'name':string(m[0]),'token':hex(token),'address':hex(address),'fileOffset':off(address) if address else None,'returnType':native_type(m[2]),'parameters':ps,'metadataOffset':h['methods'][0]+mi*36})
    return {'typeIndex':ix,'namespace':string(t[1]),'name':string(t[0]),'fieldsPointer':hex(fp),'fields':fs,'methods':ms}
def main():
    p=argparse.ArgumentParser();p.add_argument('--types',default='JumpUtils|JumpCurve|CharacterMotor|CharacterMotorAbilities|LaneStateInfo|RunStateInfo|CharacterCollision|TrackController|TrackControllerDynamic|TrackControllerStatic|RandomLane|CameraContext|GameplayCameraState|RunCameraState|CameraGroundedModifier|CameraOffsetModifier|CameraJumpModifier|CameraFieldOfViewModifier|CameraFlyModifier|CameraEnvironmentModifier|DefaultSpeedController|SpeedController|ScoreMultiplierManager|PointsPerDistanceControllerEntry|RunStatsTrackHelper|BoundaryTrackInfo|DistanceScaler|CustomJumpingState|DeterministicJumpingState|JumpingState|Chunk|ChunkBuilder|ChunkRandomizer|NodeChunk|SubwayChunk|CharacterInfo|RunSessionData|RunStats|RunStatsGroup')
    p.add_argument('--disassemble',nargs='*',default=[])
    p.add_argument('--all-index',action='store_true')
    a=p.parse_args(); pat=re.compile(a.types)
    selected=[typemap(i) for i,t in enumerate(types) if in_assembly(i) and pat.fullmatch(string(t[0]))]
    OUT.mkdir(parents=True,exist_ok=True)
    result={'sourceSHA256':hashlib.sha256(eb).hexdigest(),'metadataSHA256':hashlib.sha256(mb).hexdigest(),'mapping':'IL2CPP v31; Assembly-CSharp.dll method pointer table 0x48a52b0; metadata registration 0x46ba690 field-offset table '+hex(fieldptr),'boundary':'Static names, signatures and byte-backed offsets; virtual dispatch and runtime object selection remain unobserved.','types':selected}
    mapfile=OUT/'metadata-and-native-map.json'
    if mapfile.exists():
        previous=json.loads(mapfile.read_text())['types']
        byindex={t['typeIndex']:t for t in previous+selected}
        result['types']=sorted(byindex.values(),key=lambda t:t['typeIndex'])
    mapfile.write_text(json.dumps(result,indent=2)+'\n')
    if a.all_index:
        index=[]
        for ix,t in enumerate(types):
            if not in_assembly(ix):continue
            for mi in range(t[9],t[9]+t[16]):
                m=methods[mi]; token=m[6];ind=token&0xffffff
                address=u64(codeptr+(ind-1)*8)if ind else 0
                index.append({'typeIndex':ix,'type':string(t[0]),'namespace':string(t[1]),'name':string(m[0]),'token':hex(token),'address':hex(address),'parameters':[{'name':string(params[pi][0]),'type':native_type(params[pi][2])['name']}for pi in range(m[4],m[4]+m[-1])]})
        (OUT/'all-method-index.json').write_text(json.dumps(index,indent=2)+'\n')
    print('mapped',len(selected),'types',sum(len(t['methods'])for t in selected),'methods')
    obj='/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/llvm-objdump'
    manifest=[]
    allindexfile=OUT/'all-method-index.json'
    alladdresses=sorted({int(x['address'],16) for x in json.loads(allindexfile.read_text()) if int(x['address'],16)>0})if allindexfile.exists()else []
    for spec in a.disassemble:
        typ,method=spec.split('::',1)
        found=[(t,m) for t in selected for m in t['methods'] if t['name']==typ and m['name']==method]
        for t,m in found:
            start=int(m['address'],16)
            if not start:continue
            # Metadata sequence identifies exact sibling entry; cap to avoid unrelated output.
            greater=[x for x in alladdresses if x>start] or [int(n['address'],16)for n in t['methods'] if int(n['address'],16)>start]
            stop=min(greater) if greater else start+2048
            stop=min(stop,start+16000)
            command=[obj,'-d','--start-address='+hex(start),'--stop-address='+hex(stop),str(ELF)]
            run=subprocess.run(command,text=True,capture_output=True,check=True)
            filename=typ+'-'+method.replace('.','').replace('/','_')+'-'+hex(start)+'.txt'
            (OUT/filename).write_text(run.stdout)
            manifest.append({'method':spec,'address':hex(start),'endExclusive':hex(stop),'fileOffset':off(start),'byteLength':stop-start,'rangeSHA256':hashlib.sha256(eb[off(start):off(start)+stop-start]).hexdigest(),'file':filename,'command':command,'boundary':'Upper bound is next greater mapped Assembly-CSharp method entry when whole index exists, otherwise next declaring-type entry, capped at 16000 bytes. This may include internal helpers or omit out-of-line/dispatch targets; no CFG completeness claimed.'})
            print(filename,stop-start)
    if manifest:
        mf=OUT/'disassembly-manifest.json'
        old=json.loads(mf.read_text()) if mf.exists() else []
        bykey={(x['method'],x['address']):x for x in old+manifest}
        mf.write_text(json.dumps(list(bykey.values()),indent=2)+'\n')
if __name__=='__main__':main()
