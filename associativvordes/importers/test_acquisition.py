import hashlib
import http.client
import io
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from fetch_sources import acquisition_urls,download

class AcquisitionTests(unittest.TestCase):
    def test_official_pinned_api_fallback_is_checksum_checked(self):
        url='https://src.koda.cnrs.fr/nabil.hathout.1/glemm/-/raw/'+'a'*40+'/GLeMM_2.0/output/deu/pairs.tsv.bz2'
        body=b'actual fixture bytes';h=hashlib.sha256(body).hexdigest()
        with tempfile.TemporaryDirectory() as d,patch('fetch_sources.urlopen',side_effect=[http.client.RemoteDisconnected('closed'),io.BytesIO(body)]) as call:
            p=Path(d)/'raw';r=download(url,p,h,len(body));self.assertEqual(p.read_bytes(),body)
            self.assertEqual(call.call_count,2);self.assertIn('/api/v4/',r['used_url']);self.assertTrue(r['used_url'].endswith('ref='+'a'*40))
            self.assertEqual(call.call_args.args[0].full_url,r['used_url'])
    def test_no_fallback_to_mutable_or_unrelated_sources(self):
        for url in ['https://example.invalid/glemm','https://src.koda.cnrs.fr/nabil.hathout.1/glemm/-/raw/main/file']:
            self.assertEqual(list(acquisition_urls(url)),[url])
    def test_wrong_bytes_never_publish_or_silently_fallback(self):
        with tempfile.TemporaryDirectory() as d,patch('fetch_sources.urlopen',return_value=io.BytesIO(b'bad')):
            p=Path(d)/'raw'
            with self.assertRaises(ValueError):download('https://example.invalid/pinned',p,'0'*64,3)
            self.assertFalse(p.exists());self.assertEqual(list(Path(d).iterdir()),[])
    def test_optional_http2_client_still_requires_the_same_hash(self):
        data=b'fixture payload'
        def curl(args,**kwargs):
            Path(args[args.index('--output')+1]).write_bytes(data)
            return SimpleNamespace(returncode=0,stderr='')
        with tempfile.TemporaryDirectory() as d,patch('fetch_sources.urlopen',side_effect=http.client.RemoteDisconnected('closed')),patch('fetch_sources.shutil.which',return_value='/usr/bin/curl'),patch('fetch_sources.subprocess.run',side_effect=curl):
            p=Path(d)/'raw'
            r=download('https://example.invalid/pinned',p,hashlib.sha256(data).hexdigest(),len(data))
            self.assertEqual(r['transport'],'curl');self.assertEqual(p.read_bytes(),data)
            p.unlink()
            with self.assertRaises(ValueError):download('https://example.invalid/pinned',p,'0'*64,len(data))
            self.assertFalse(p.exists())

if __name__=='__main__':unittest.main()
