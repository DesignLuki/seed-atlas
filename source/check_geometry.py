import bpy,sys,json
from pathlib import Path
D=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path.home()/'.codex/skills/blender-asset-qa/scripts'))
import qa_check
out={}
for parent in bpy.data.objects:
    pieces=[o.name for o in parent.children if o.type=='MESH']
    if parent.name=='tracks':
        for name in pieces:out[name]=qa_check.run(objects=[name],profile='render',eps=.00022,tol=.004,uv=False)
    elif pieces:
        out[parent.name]=qa_check.run(objects=pieces,profile='render',eps=.00022,tol=.004,uv=False)
(D/'review/geometry.json').write_text(json.dumps(out,indent=1,ensure_ascii=False))
for key,res in out.items():
    if res['errors']:print(key,res['errors'][:12])
