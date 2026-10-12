import subprocess, json
staging=json.load(open(r"..\..\_master_work\corrective_wave\source_png_staging.json",encoding='utf-8'))
recs={r['ordinal']:r for r in staging['records']}
want=[1,250,501,543,563,585,900,1000,1300,1600,1800,1899]
args=['git','lfs','fetch','origin','--include']
args.append(','.join(f"oid={recs[n]['sha256']}" for n in want))
print(' '.join(args)[:400])
r=subprocess.run(args,capture_output=True,text=True)
print(r.stdout[-800:])
print(r.stderr[-500:])
