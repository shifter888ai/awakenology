import unittest
from package_audit import sha
class PackageAuditTests(unittest.TestCase):
    def test_digest_stable(self):
        self.assertEqual(sha(b"hello"), "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")
    def test_digest_changes_on_mutation(self):
        self.assertNotEqual(sha(b"hello"), sha(b"hello!"))
if __name__ == "__main__": unittest.main()
