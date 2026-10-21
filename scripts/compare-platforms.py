"""Compare recorded deterministic simulation samples; not a UI/device test."""
from pathlib import Path
import json, math
root=Path(__file__).resolve().parents[1]
(root/'outputs').mkdir(exist_ok=True)
scenario=json.loads((root/'shared/test-vectors/scenarios.json').read_text())
data={p:json.loads((root/f'outputs/{p}/conformance.json').read_text()) for p in ['web','android','ios']}
errors=[]; comparisons=0;maxerror=0
for platform, report in data.items():
 if report.get('scenario')!=scenario['id']:errors.append(dict(platform=platform,field='scenario',expected=scenario['id'],actual=report.get('scenario')))
 ticks=[sample.get('tick') for sample in report['samples']]
 if ticks!=scenario['sampleTicks']:errors.append(dict(platform=platform,field='sampleTicks',expected=scenario['sampleTicks'],actual=ticks))
 for sample in report['samples']:
  for key in scenario['fields']:
   if not isinstance(sample.get(key),(int,float)) or not math.isfinite(sample[key]):raise ValueError(f'{platform}: invalid {key} at {sample.get("tick")}')
for platform in ['android','ios']:
 for a,b in zip(data['web']['samples'],data[platform]['samples']):
  if a['tick']!=b['tick']:errors.append(dict(platform=platform,field='tick',web=a['tick'],native=b['tick']))
  for key in scenario['fields']:
   comparisons+=1;diff=abs(a[key]-b[key]);maxerror=max(maxerror,diff)
   tol=0 if key in ['coins','score'] else scenario['numericTolerance']
   if diff>tol:errors.append(dict(platform=platform,tick=a['tick'],field=key,web=a[key],native=b[key],difference=diff))
result={'scenario':scenario['id'],'samplesPerPlatform':len(data['web']['samples']),'numericComparisons':comparisons,'maxAbsoluteDifference':maxerror,'pass':not errors,'differences':errors,'boundary':'Foundation Swift and JVM Kotlin simulation; does not establish iOS UI/runtime or device performance. Collision grace deliberately enabled per shared scenario. Individual collision tests separate.'}
(root/'outputs/cross-platform-comparison.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));raise SystemExit(bool(errors))
