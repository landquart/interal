import unittest
from policy import *
class PolicyTests(unittest.TestCase):
 def test_unknown_not_negative(self):self.assertEqual(classify(0),'INSUFFICIENT_EVIDENCE')
 def test_competing(self):self.assertEqual(classify(BITS['inflection']|BITS['direct_derivation']),'COMPETING_ANALYSES')
 def test_alternative(self):self.assertEqual(disposition(True,True)['membership_operation'],'NONE')
 def test_homonym(self):
  s=dict(evidence_id='x',source_native='a',target_native='b',language='en',identity_verified=True,sense_verified=True,kind='direct_derivation')
  self.assertTrue(chain_valid([s]));self.assertFalse(chain_valid([s,dict(s,source_native='homonym')]))
  self.assertFalse(chain_valid([s,dict(s,source_native='b',language='de')]))
  self.assertFalse(chain_valid([dict(s,sense_verified=False)]));self.assertFalse(chain_valid([dict(s,kind='common_ancestor')]))
 def test_no_inferred_allomorph(self):
  from native import row_mask
  self.assertEqual(row_mask({'format':'glemm'},b'a\tb\tc'),BITS['unconfirmed'])
  self.assertEqual(row_mask({'format':'morphynet_inflection'},b'a\tb\tc\td'),BITS['inflection'])
  self.assertFalse(row_mask({'format':'morphynet_derivation'},b'manu\tmani\tN\tN\ti\tunknown')&BITS['allomorphy'])
if __name__=='__main__':unittest.main()
