import unittest
from staging_deployment_preflight import validate
PROD={"name":"awakenology","main":"./worker.js"}
PLAN={"worker_name":"awakenology-static-stage-isolated","deploy_enabled":False,"routes":[],"custom_domains":[],"copy_production_secrets":False,"private_editor_enabled":False,"indexing_allowed":False,"required_approval":"separate explicit staging deployment approval"}
class PreflightTests(unittest.TestCase):
    def test_safe_plan(self): self.assertEqual(validate(PROD,PLAN),[])
    def test_production_name_rejected(self): self.assertTrue(validate(PROD,{**PLAN,"worker_name":"awakenology"}))
    def test_routes_rejected(self): self.assertTrue(validate(PROD,{**PLAN,"routes":["awakenology.space/*"]}))
    def test_secret_copy_rejected(self): self.assertTrue(validate(PROD,{**PLAN,"copy_production_secrets":True}))
    def test_auto_deploy_rejected(self): self.assertTrue(validate(PROD,{**PLAN,"deploy_enabled":True}))
if __name__=="__main__": unittest.main()
