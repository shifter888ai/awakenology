import unittest
from compare_http_reports import compare
def entry(url, **changes):
    value = dict(url=url, status=200, content_type="text/html", cache_control="public",
                 x_robots_tag="", vary="", content_security_policy="", strict_transport_security="",
                 robots_meta=[], location="")
    value.update(changes)
    return value
class ComparisonTests(unittest.TestCase):
    def test_identical(self):
        r={"http_baseline_matrix":[entry("https://awakenology.space/")]}
        self.assertEqual(compare(r,r),[])
    def test_security_header_regression_blocks(self):
        a={"http_baseline_matrix":[entry("https://awakenology.space/", x_robots_tag="noindex")]}
        b={"http_baseline_matrix":[entry("https://staging.example/", x_robots_tag="")]}
        self.assertTrue(any(x["field"]=="x_robots_tag" for x in compare(a,b)))
    def test_missing_route_blocks(self):
        a={"http_baseline_matrix":[entry("https://awakenology.space/")]}
        self.assertTrue(compare(a,{"http_baseline_matrix":[]}))
    def test_staging_hostname_not_redirect_difference(self):
        a={"http_baseline_matrix":[entry("https://awakenology.space/",status=302,location="https://awakenology.space/en/")]}
        b={"http_baseline_matrix":[entry("https://staging.example/",status=302,location="https://staging.example/en/")]}
        self.assertEqual(compare(a,b),[])
    def test_redirect_path_difference_blocks(self):
        a={"http_baseline_matrix":[entry("https://awakenology.space/",location="/en/")]}
        b={"http_baseline_matrix":[entry("https://staging.example/",location="/jp/")]}
        self.assertTrue(compare(a,b))
if __name__=="__main__": unittest.main()
