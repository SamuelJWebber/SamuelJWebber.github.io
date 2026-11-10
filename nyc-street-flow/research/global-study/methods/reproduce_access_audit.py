"""Offline audit of the actual Kraus/Koch replication archive we acquired.
This is an access/provenance test, NOT a replication of the causal coefficient.
"""
from pathlib import Path
import json,zipfile,hashlib,re,csv,math
R=Path(__file__).resolve().parent
meta=json.loads((R/'zenodo-record.json').read_text());raw=(R/'kraus-koch-zenodo.zip').read_bytes()
assert hashlib.md5(raw).hexdigest()==meta['files'][0]['checksum'].split(':')[1]
with zipfile.ZipFile(R/'kraus-koch-zenodo.zip') as z:
 assert z.testzip() is None
 name=next(n for n in z.namelist() if n.endswith('/data/counters/panelAll.dta'))
 panel=z.read(name);text=panel.decode('utf-8');assert text.startswith('version https://git-lfs.github.com/spec/v1')
 expected_bytes=int(re.search(r'^size (\d+)',text,re.M)[1])
 expected_sha=re.search(r'oid sha256:([0-9a-f]+)',text)[1]
 report={'checked_on':'2026-11-05','acquired':True,'original_doi':'10.5281/zenodo.3973038','resolved_record':meta['id'],'archive_version':meta['metadata']['version'],'archive_publication_date':meta['metadata']['publication_date'],'archive_bytes':len(raw),'archive_sha256':hashlib.sha256(raw).hexdigest(),'md5_matches_repository':True,'file_count':len([n for n in z.namelist() if not n.endswith('/')]),'panel_path':name,'panel_bytes_present':len(panel),'panel_is_git_lfs_pointer':True,'referenced_panel_bytes':expected_bytes,'referenced_panel_sha256':expected_sha,'full_estimate_reproduced':False,'reason':'Archive contains code and historical output files but only a Git LFS pointer for the advertised final panel. The linked GitHub repository and media object returned HTTP404 during retrieval. Do not substitute the archived 2020 output table for the final2021 paper.'}
 (R/'replication-access-audit.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2))
